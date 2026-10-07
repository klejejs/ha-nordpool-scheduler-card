import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UnsubscribeFunc } from 'home-assistant-js-websocket';

import type {
  HistorySegment,
  HistoryStreamMessage,
  HomeAssistant,
  LovelaceCard,
  LovelaceConfigForm,
  LovelaceGridOptions,
  NordpoolSchedulerCardConfig,
  RenderSlot,
  ScheduleSnapshot,
  SetSlotState,
} from './types';
import {
  buildRenderSlots,
  calculatePriceStats,
  formatDayHeading,
  formatPrice,
  localDateKey,
  nextSlotState,
  priceTier,
} from './format';
import { HistoryAccumulator } from './history';
import { sharedStyles } from './styles';

declare const __CARD_VERSION__: string;

console.info(
  `%c NORDPOOL-SCHEDULER-CARD %c ${__CARD_VERSION__} `,
  'color: white; background: #03a9f4; font-weight: 700;',
  'color: #03a9f4; background: white; font-weight: 700;'
);

const HISTORY_HOURS = 24;

export class NordpoolSchedulerCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: NordpoolSchedulerCardConfig;

  @state() private _data?: ScheduleSnapshot;

  @state() private _error?: string;

  @state() private _actionError?: string;

  @state() private _activeDate?: string;

  @state() private _historySegments: HistorySegment[] = [];

  private _pending = new Map<string, SetSlotState>();

  private _pendingRequestId = new Map<string, number>();

  private _requestCounter = 0;

  private _subscribedEntity?: string;

  private _unsubscribe?: UnsubscribeFunc;

  private _historyEntity?: string;

  private _unsubscribeHistory?: UnsubscribeFunc;

  private _historyTimer?: ReturnType<typeof setInterval>;

  private _historyAccumulator = new HistoryAccumulator();

  public static getStubConfig(hass: HomeAssistant): NordpoolSchedulerCardConfig {
    const entity = Object.keys(hass.states).find(
      (id) => id.startsWith('sensor.') && hass.states[id].attributes.vat_percent !== undefined
    );
    return { type: 'custom:nordpool-scheduler-card', entity: entity ?? '', show_name: true };
  }

  public static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        {
          name: 'entity',
          required: true,
          selector: { entity: { filter: { integration: 'nordpool_scheduler', domain: 'sensor' } } },
        },
        { name: 'name', selector: { text: {} } },
        { name: 'show_name', selector: { boolean: {} } },
        { name: 'show_day_tabs', selector: { boolean: {} } },
        { name: 'show_history', selector: { boolean: {} } },
        {
          name: 'history_entity',
          selector: {
            entity: { filter: { integration: 'nordpool_scheduler', domain: 'binary_sensor' } },
          },
        },
        {
          name: 'price_unit',
          selector: {
            select: {
              mode: 'dropdown',
              options: [
                { value: 'cents', label: 'Cents' },
                { value: 'currency', label: 'Currency' },
              ],
            },
          },
        },
      ],
    };
  }

  public getGridOptions(): LovelaceGridOptions {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  public getCardSize(): number {
    return 6;
  }

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    if (!config?.entity) {
      throw new Error('Entity must be specified');
    }
    this._config = { show_name: true, show_history: true, price_unit: 'cents', ...config };
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._subscribedEntity = undefined;
    this._teardownHistorySubscription();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.hass || !this._config?.entity) {
      return;
    }
    if (this._subscribedEntity !== this._config.entity) {
      this._subscribe();
    }
    if (this._data) {
      this._ensureHistorySubscription();
    }
  }

  private _subscribe(): void {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._data = undefined;
    this._error = undefined;
    const entityId = this._config!.entity!;
    this._subscribedEntity = entityId;
    this.hass!.connection.subscribeMessage<ScheduleSnapshot>(
      (data) => this._onSnapshot(entityId, data),
      {
        type: 'nordpool_scheduler/subscribe',
        entity_id: entityId,
      }
    )
      .then((unsub) => {
        if (this._subscribedEntity !== entityId) {
          // The config changed again before this subscription resolved; it's
          // already stale, so drop it instead of overwriting the current one.
          unsub();
          return;
        }
        this._unsubscribe = unsub;
      })
      .catch((err: unknown) => {
        if (this._subscribedEntity === entityId) {
          this._error = errorMessage(err);
        }
      });
  }

  private _onSnapshot(entityId: string, data: ScheduleSnapshot): void {
    if (this._subscribedEntity !== entityId) {
      return;
    }
    this._error = undefined;
    this._data = data;
    for (const [start, requested] of this._pending) {
      const slot = data.slots.find((s) => s.start === start);
      if (!slot) {
        this._pending.delete(start);
        this._pendingRequestId.delete(start);
        continue;
      }
      const confirmed =
        requested === 'default' ? slot.override === null : slot.override === requested;
      if (confirmed) {
        this._pending.delete(start);
        this._pendingRequestId.delete(start);
      }
    }
    const dateKeys = availableDateKeys(data);
    if (!this._activeDate || !dateKeys.includes(this._activeDate)) {
      this._activeDate = localDateKey(data.now_slot_start, data.time_zone);
    }
  }

  private _ensureHistorySubscription(): void {
    if (!this._config?.show_history) {
      this._teardownHistorySubscription();
      return;
    }
    if (!this._data || !this.hass) {
      return;
    }
    const entityId = this._config.history_entity || this._data.target_entity;
    if (this._historyEntity === entityId) {
      return;
    }
    this._teardownHistorySubscription();
    this._historyEntity = entityId;
    this._historyAccumulator = new HistoryAccumulator();
    this._historySegments = [];
    const startTime = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000);
    this.hass.connection
      .subscribeMessage<HistoryStreamMessage>(
        (msg) => {
          this._historyAccumulator.addMessage(msg, entityId, HISTORY_HOURS);
          this._historySegments = this._historyAccumulator.segments();
        },
        {
          type: 'history/stream',
          entity_ids: [entityId],
          start_time: startTime.toISOString(),
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        }
      )
      .then((unsub) => {
        this._unsubscribeHistory = unsub;
      })
      .catch(() => {
        // History is a nice-to-have; leave the bar empty on failure.
      });
    // No new stream message arrives while the target's state is unchanged,
    // so the last segment's end (rendered as "now") would otherwise freeze.
    this._historyTimer = setInterval(() => {
      this._historySegments = this._historyAccumulator.segments();
    }, 60000);
  }

  private _teardownHistorySubscription(): void {
    this._unsubscribeHistory?.();
    this._unsubscribeHistory = undefined;
    this._historyEntity = undefined;
    if (this._historyTimer !== undefined) {
      clearInterval(this._historyTimer);
      this._historyTimer = undefined;
    }
    // This runs from updated() on every render while history is off, so
    // assigning a fresh [] each time would schedule renders forever.
    if (this._historySegments.length > 0) {
      this._historySegments = [];
    }
  }

  private _onSlotClick(slot: RenderSlot): void {
    if (slot.isPast || !this._data || !this.hass) {
      return;
    }
    const raw = this._data.slots.find((s) => s.start === slot.start);
    if (!raw) {
      return;
    }
    const requested = nextSlotState(raw, this._pending.get(slot.start));
    this._pending.set(slot.start, requested);
    const requestId = ++this._requestCounter;
    this._pendingRequestId.set(slot.start, requestId);
    this.requestUpdate();

    this.hass
      .callService('nordpool_scheduler', 'set_slots', {
        config_entry: this._data.config_entry_id,
        slots: [{ start: slot.start, state: requested }],
      })
      .catch((err: unknown) => {
        if (this._pendingRequestId.get(slot.start) !== requestId) {
          // A newer click for this slot has already superseded this request.
          return;
        }
        this._pending.delete(slot.start);
        this._pendingRequestId.delete(slot.start);
        this._actionError = `Could not update ${slot.time}: ${errorMessage(err)}`;
        this.requestUpdate();
      });
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }
    if (this._error) {
      return html`<ha-card
        >${this._renderHeader()}
        <ha-alert alert-type="error"
          >Could not load "${this._config.entity}": ${this._error}</ha-alert
        >
      </ha-card>`;
    }
    if (!this._data) {
      return html`<ha-card>${this._renderHeader()}</ha-card>`;
    }

    const showTabs = this._config.show_day_tabs ?? false;
    const dateKeys = availableDateKeys(this._data);
    const visibleDates = showTabs && this._activeDate ? [this._activeDate] : dateKeys;
    const scheduledCount = this._data.slots.filter(
      (s) =>
        (this._pending.get(s.start) ?? (s.override !== null ? s.override : 'default')) !== 'default'
    ).length;
    const todaySlots = buildRenderSlots(
      this._data,
      dateKeys[0],
      this._pending,
      this._data.time_zone,
      this.hass.locale.language
    );
    const todayStats = calculatePriceStats(todaySlots);
    const currentSlot = todaySlots.find((s) => s.isCurrent);

    return html`
      <ha-card>
        ${this._renderHeader()}
        ${this._actionError
          ? html`<ha-alert
              alert-type="error"
              dismissable
              @alert-dismissed-clicked=${() => (this._actionError = undefined)}
              >${this._actionError}</ha-alert
            >`
          : nothing}
        ${this._renderInfoBar(scheduledCount, currentSlot?.price ?? null, todayStats)}
        ${this._config.show_history ? this._renderHistoryBar() : nothing}
        ${showTabs ? this._renderDayTabs(dateKeys) : nothing}
        ${visibleDates.map((dateKey) => this._renderDaySection(dateKey, showTabs))}
      </ha-card>
    `;
  }

  private _renderHeader(): TemplateResult | typeof nothing {
    if (!this._config?.show_name) {
      return nothing;
    }
    const name = this._config.name || this._data?.target_entity || 'Nordpool Scheduler';
    return html`<div class="card-header"><h2 class="card-title">${name}</h2></div>`;
  }

  private _renderInfoBar(
    scheduledCount: number,
    currentPrice: number | null,
    stats: ReturnType<typeof calculatePriceStats>
  ): TemplateResult {
    const unit = this._config!.price_unit ?? 'cents';
    const currency = this._data!.currency;
    const locale = this.hass!.locale.language;
    return html`
      <div class="info-bar">
        <div class="info-item">
          <span class="info-label">Current</span>
          <span class="info-value">${formatPrice(currentPrice, unit, currency, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Min</span>
          <span class="info-value">${formatPrice(stats?.min ?? null, unit, currency, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Avg</span>
          <span class="info-value">${formatPrice(stats?.avg ?? null, unit, currency, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Max</span>
          <span class="info-value">${formatPrice(stats?.max ?? null, unit, currency, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Scheduled</span>
          <span class="info-value">${scheduledCount}</span>
        </div>
      </div>
    `;
  }

  private _renderHistoryBar(): TemplateResult | typeof nothing {
    if (this._historySegments.length === 0) {
      return nothing;
    }
    const windowStart = Date.now() - HISTORY_HOURS * 60 * 60 * 1000;
    const totalDuration = HISTORY_HOURS * 60 * 60 * 1000;
    return html`
      <div class="history-container">
        <div class="history-label">Last ${HISTORY_HOURS}h</div>
        <div class="history-bar">
          ${this._historySegments.map((segment) => {
            const left = Math.max(
              0,
              ((segment.start.getTime() - windowStart) / totalDuration) * 100
            );
            const right = Math.min(
              100,
              ((segment.end.getTime() - windowStart) / totalDuration) * 100
            );
            const cls = segment.state === 'on' ? 'on' : 'off';
            return html`<div
              class="history-segment ${cls}"
              style="left: ${left}%; width: ${right - left}%"
              title="${segment.state}"
            ></div>`;
          })}
        </div>
      </div>
    `;
  }

  private _renderDayTabs(dateKeys: string[]): TemplateResult {
    return html`
      <div class="day-tabs">
        ${dateKeys.map(
          (dateKey) => html`
            <button
              class="day-tab ${dateKey === this._activeDate ? 'active' : ''}"
              @click=${() => (this._activeDate = dateKey)}
            >
              ${this._dayLabel(dateKey)}
            </button>
          `
        )}
      </div>
    `;
  }

  private _dayLabel(dateKey: string): string {
    const today = localDateKey(this._data!.now_slot_start, this._data!.time_zone);
    if (dateKey === today) {
      return 'Today';
    }
    const tomorrow = localDateKey(
      new Date(new Date(this._data!.now_slot_start).getTime() + 86400000).toISOString(),
      this._data!.time_zone
    );
    if (dateKey === tomorrow) {
      return 'Tomorrow';
    }
    return formatDayHeading(
      `${dateKey}T12:00:00Z`,
      this._data!.time_zone,
      this.hass!.locale.language
    );
  }

  private _renderDaySection(dateKey: string, showTabs: boolean): TemplateResult {
    const slots = buildRenderSlots(
      this._data!,
      dateKey,
      this._pending,
      this._data!.time_zone,
      this.hass!.locale.language
    );
    const hasPrices = slots.some((s) => s.price !== null);
    const stats = calculatePriceStats(slots);

    return html`
      ${showTabs ? nothing : html`<div class="day-heading">${this._dayLabel(dateKey)}</div>`}
      ${hasPrices
        ? html`<div class="schedule-grid">
            ${slots.map((slot) => this._renderSlot(slot, stats))}
          </div>`
        : html`<div class="placeholder-message">Prices published ~14:00 CET</div>`}
    `;
  }

  private _renderSlot(
    slot: RenderSlot,
    stats: ReturnType<typeof calculatePriceStats>
  ): TemplateResult {
    const tier = priceTier(slot.price, stats);
    const classes = [
      'time-slot',
      `tier-${tier}`,
      slot.effective === 'on' ? 'on' : '',
      slot.isCurrent ? 'current' : '',
      slot.isPast ? 'past' : '',
      slot.isPending ? 'pending' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const unit = this._config!.price_unit ?? 'cents';
    return html`
      <div
        class=${classes}
        role="button"
        tabindex=${slot.isPast ? -1 : 0}
        @click=${() => this._onSlotClick(slot)}
        @keydown=${(ev: KeyboardEvent) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this._onSlotClick(slot);
          }
        }}
      >
        ${slot.isOverridden ? html`<div class="override-dot"></div>` : nothing}
        <div class="time-label">${slot.time}</div>
        <div class="price-label">
          ${formatPrice(slot.price, unit, this._data!.currency, this.hass!.locale.language)}
        </div>
      </div>
    `;
  }

  static get styles() {
    return sharedStyles;
  }
}

function errorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

/** All local calendar days present in the snapshot, sorted, deduplicated. */
function availableDateKeys(data: ScheduleSnapshot): string[] {
  const keys = new Set(data.slots.map((s) => localDateKey(s.start, data.time_zone)));
  return Array.from(keys).sort();
}

if (!customElements.get('nordpool-scheduler-card')) {
  customElements.define('nordpool-scheduler-card', NordpoolSchedulerCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'nordpool-scheduler-card': NordpoolSchedulerCard;
  }
}

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

const win = window as Window;
win.customCards = win.customCards || [];
win.customCards.push({
  type: 'nordpool-scheduler-card',
  name: 'Nordpool Scheduler Card',
  description: 'Schedule an entity by 15-minute Nord Pool price slots.',
  preview: true,
  documentationURL: 'https://github.com/klejejs/ha-nordpool-scheduler-card',
});

import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UnsubscribeFunc } from 'home-assistant-js-websocket';

import type {
  AutoSnapshot,
  AverageWindow,
  HistorySegment,
  HistoryStreamMessage,
  HomeAssistant,
  LovelaceCard,
  LovelaceGridOptions,
  NordpoolSchedulerCardConfig,
  RenderSlot,
  ScheduleSnapshot,
  SetSlotState,
} from './types';
import {
  AVERAGE_LABELS,
  AVERAGE_WINDOWS,
  buildRenderSlots,
  calculatePriceStats,
  formatDayHeading,
  formatPrice,
  localDateKey,
  nextSlotState,
  priceTier,
} from './format';
import { isPriceSensor } from './editor';
import { HistoryAccumulator } from './history';
import { cogIcon, handIcon, robotIcon } from './icons';
import { sharedStyles } from './styles';

declare const __CARD_VERSION__: string;

console.info(
  `%c NORDPOOL-SCHEDULER-CARD %c ${__CARD_VERSION__} `,
  'color: white; background: #03a9f4; font-weight: 700;',
  'color: #03a9f4; background: white; font-weight: 700;'
);

const HISTORY_HOURS = 24;

type AutoSetting = 'run_hours' | 'max_price' | 'cheap_price';

export class NordpoolSchedulerCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: NordpoolSchedulerCardConfig;

  @state() private _data?: ScheduleSnapshot;

  @state() private _error?: string;

  @state() private _actionError?: string;

  @state() private _activeDate?: string;

  @state() private _historySegments: HistorySegment[] = [];

  @state() private _showSettings = false;

  private _pending = new Map<string, SetSlotState>();

  private _pendingRequestId = new Map<string, number>();

  private _requestCounter = 0;

  private _subscribedEntity?: string;

  private _subscriptionId = 0;

  private _unsubscribe?: UnsubscribeFunc;

  private _historyEntity?: string;

  private _unsubscribeHistory?: UnsubscribeFunc;

  private _historyRequestId = 0;

  private _historyTimer?: ReturnType<typeof setInterval>;

  private _historyAccumulator = new HistoryAccumulator();

  public static getStubConfig(hass: HomeAssistant): NordpoolSchedulerCardConfig {
    const entity = Object.keys(hass.states).find((id) => isPriceSensor(hass, id));
    return { type: 'custom:nordpool-scheduler-card', entity: entity ?? '', show_name: true };
  }

  public static async getConfigElement(): Promise<HTMLElement> {
    // The editor is built on ha-form, which the frontend loads with its own card editors.
    if (!customElements.get('ha-form')) {
      const entitiesCard = customElements.get('hui-entities-card') as
        | (CustomElementConstructor & { getConfigElement(): Promise<unknown> })
        | undefined;
      await entitiesCard?.getConfigElement();
    }
    return document.createElement('nordpool-scheduler-card-editor');
  }

  public getGridOptions(): LovelaceGridOptions {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  public getCardSize(): number {
    return this._shownAverages().length > 0 ? 7 : 6;
  }

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    if (!config?.entity) {
      throw new Error('Entity must be specified');
    }
    this._config = { show_name: true, show_history: true, ...config };
  }

  /** A prices entry has no target, so there is no schedule to show or change. */
  private get _pricesOnly(): boolean {
    return this._data?.target_entity === null;
  }

  private get _showHistory(): boolean {
    return Boolean(this._config?.show_history) && !this._pricesOnly;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    // Views move cards around on first layout; resubscribe without waiting
    // for the next hass update, which a quiet instance may not send for minutes.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._subscribedEntity = undefined;
    this._subscriptionId++;
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
    const subscriptionId = ++this._subscriptionId;
    this.hass!.connection.subscribeMessage<ScheduleSnapshot>(
      (data) => this._onSnapshot(subscriptionId, data),
      {
        type: 'nordpool_scheduler/subscribe',
        entity_id: entityId,
      }
    )
      .then((unsub) => {
        if (this._subscriptionId !== subscriptionId) {
          // Disconnected or resubscribed before this resolved; it's already
          // stale, so drop it instead of overwriting the current one.
          unsub();
          return;
        }
        this._unsubscribe = unsub;
      })
      .catch((err: unknown) => {
        if (this._subscriptionId === subscriptionId) {
          this._error = errorMessage(err);
        }
      });
  }

  private _onSnapshot(subscriptionId: number, data: ScheduleSnapshot): void {
    if (this._subscriptionId !== subscriptionId) {
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
    if (!this._showHistory) {
      this._teardownHistorySubscription();
      return;
    }
    if (!this._data || !this.hass) {
      return;
    }
    const entityId = this._data.target_entity;
    if (!entityId || this._historyEntity === entityId) {
      return;
    }
    this._teardownHistorySubscription();
    this._historyEntity = entityId;
    this._historyAccumulator = new HistoryAccumulator();
    this._historySegments = [];
    const startTime = new Date(Date.now() - HISTORY_HOURS * 60 * 60 * 1000);
    const requestId = ++this._historyRequestId;
    this.hass.connection
      .subscribeMessage<HistoryStreamMessage>(
        (msg) => {
          if (requestId !== this._historyRequestId) {
            return;
          }
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
        if (requestId !== this._historyRequestId) {
          // Torn down before the subscription resolved; don't leave it open.
          unsub();
          return;
        }
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
    this._historyRequestId++;
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
    if (slot.isPast || this._pricesOnly || !this._data || !this.hass) {
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

  private _toggleAuto(checkbox?: HTMLInputElement): void {
    const entity = this._data?.auto.switch_entity;
    if (!entity || !this.hass) {
      return;
    }
    this.hass.callService('switch', 'toggle', { entity_id: entity }).catch((err: unknown) => {
      // Lit won't re-set an unchanged .checked, so put the box back by hand.
      if (checkbox && this._data) {
        checkbox.checked = this._data.auto.enabled;
      }
      this._actionError = `Could not switch auto mode: ${errorMessage(err)}`;
    });
  }

  private _setAutoSetting(
    entity: string | null,
    setting: AutoSetting,
    label: string,
    ev: Event
  ): void {
    const input = ev.target as HTMLInputElement;
    const attempted = input.value;
    const value = input.valueAsNumber;
    if (!entity || !this.hass || Number.isNaN(value)) {
      return;
    }
    this.hass
      .callService('number', 'set_value', { entity_id: entity, value })
      .catch((err: unknown) => {
        // Lit won't re-set an unchanged .value; leave a newer edit alone.
        if (this._data && input.value === attempted) {
          input.value = String(this._data.auto[setting]);
        }
        this._actionError = `Could not set ${label}: ${errorMessage(err)}`;
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
    const manualCount = this._data.slots.filter(
      (s) =>
        (this._pending.get(s.start) ?? (s.override !== null ? s.override : 'default')) !== 'default'
    ).length;
    const autoCount = this._data.slots.filter(
      (s) => s.auto === true && s.start >= this._data!.now_slot_start
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
        ${this._showSettings && !this._pricesOnly ? this._renderSettings(this._data.auto) : nothing}
        ${this._renderInfoBar(manualCount, autoCount, currentSlot?.price ?? null, todayStats)}
        ${this._renderAverages()} ${this._showHistory ? this._renderHistoryBar() : nothing}
        ${showTabs ? this._renderDayTabs(dateKeys) : nothing}
        ${visibleDates.map((dateKey) => this._renderDaySection(dateKey, showTabs))}
        ${this._data.auto.enabled && !this._pricesOnly ? this._renderLegend() : nothing}
      </ha-card>
    `;
  }

  private _renderHeader(): TemplateResult | typeof nothing {
    const showName = this._config?.show_name ?? true;
    const auto = this._pricesOnly ? undefined : this._data?.auto;
    if (!showName && !auto) {
      return nothing;
    }
    const name =
      this._config?.name ||
      this._data?.target_entity ||
      this.hass?.states[this._config!.entity!]?.attributes.friendly_name ||
      'Nordpool Scheduler';
    return html`<div class="card-header">
      ${showName ? html`<h2 class="card-title">${name}</h2>` : html`<span></span>`}
      ${auto ? this._renderAutoControls(auto) : nothing}
    </div>`;
  }

  private _renderAutoControls(auto: AutoSnapshot): TemplateResult {
    const locale = this.hass!.locale.language;
    const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      auto.run_hours
    );
    return html`<div class="header-actions">
      <button
        class="auto-chip ${auto.enabled ? 'enabled' : ''}"
        aria-pressed=${auto.enabled ? 'true' : 'false'}
        title=${auto.enabled ? 'Auto mode is on. Click to turn it off' : 'Turn auto mode on'}
        ?disabled=${!auto.switch_entity}
        @click=${() => this._toggleAuto()}
      >
        ${robotIcon('chip-icon')} ${auto.enabled ? `Auto · ${hours} h/day` : 'Auto off'}
      </button>
      <button
        class="icon-button ${this._showSettings ? 'active' : ''}"
        title="Auto mode settings"
        aria-expanded=${this._showSettings ? 'true' : 'false'}
        @click=${() => (this._showSettings = !this._showSettings)}
      >
        ${cogIcon('button-icon')}
      </button>
    </div>`;
  }

  private _renderSettings(auto: AutoSnapshot): TemplateResult {
    return html`<div class="settings">
      <label class="setting setting-toggle">
        <span class="setting-label">Auto mode</span>
        <input
          type="checkbox"
          .checked=${auto.enabled}
          ?disabled=${!auto.switch_entity}
          @change=${(ev: Event) => this._toggleAuto(ev.target as HTMLInputElement)}
        />
      </label>
      <label class="setting">
        <span class="setting-label">Hours per day</span>
        <input
          type="number"
          min="0"
          max="24"
          step="0.25"
          .value=${String(auto.run_hours)}
          ?disabled=${!auto.run_hours_entity}
          @change=${(ev: Event) =>
            this._setAutoSetting(auto.run_hours_entity, 'run_hours', 'hours per day', ev)}
        />
      </label>
      <label class="setting">
        <span class="setting-label">Max price, c/kWh</span>
        <input
          type="number"
          min="0"
          max="1000"
          step="0.01"
          .value=${String(auto.max_price)}
          ?disabled=${!auto.max_price_entity}
          @change=${(ev: Event) =>
            this._setAutoSetting(auto.max_price_entity, 'max_price', 'max price', ev)}
        />
        <span class="setting-hint">Skip picks above this. 0 = off</span>
      </label>
      <label class="setting">
        <span class="setting-label">Cheap price, c/kWh</span>
        <input
          type="number"
          min="0"
          max="1000"
          step="0.01"
          .value=${String(auto.cheap_price)}
          ?disabled=${!auto.cheap_price_entity}
          @change=${(ev: Event) =>
            this._setAutoSetting(auto.cheap_price_entity, 'cheap_price', 'cheap price', ev)}
        />
        <span class="setting-hint">Always run at or below this. 0 = off</span>
      </label>
    </div>`;
  }

  private _renderLegend(): TemplateResult {
    return html`<div class="legend">
      <span class="legend-item">${robotIcon('legend-icon auto')} Auto pick</span>
      <span class="legend-item">${handIcon('legend-icon manual')} Your override</span>
      <span class="legend-item"><span class="legend-swatch"></span> Runs</span>
    </div>`;
  }

  private _renderInfoBar(
    manualCount: number,
    autoCount: number,
    currentPrice: number | null,
    stats: ReturnType<typeof calculatePriceStats>
  ): TemplateResult {
    const locale = this.hass!.locale.language;
    const autoOn = this._data!.auto.enabled;
    return html`
      <div class="info-bar">
        <div class="info-item">
          <span class="info-label">Current</span>
          <span class="info-value">${formatPrice(currentPrice, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Min</span>
          <span class="info-value">${formatPrice(stats?.min ?? null, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Avg</span>
          <span class="info-value">${formatPrice(stats?.avg ?? null, locale)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Max</span>
          <span class="info-value">${formatPrice(stats?.max ?? null, locale)}</span>
        </div>
        ${this._pricesOnly
          ? nothing
          : autoOn
            ? html`<div class="info-item">
                <span class="info-label">Auto / Manual</span>
                <span class="info-value">${autoCount} / ${manualCount}</span>
              </div>`
            : html`<div class="info-item">
                <span class="info-label">Overrides</span>
                <span class="info-value">${manualCount}</span>
              </div>`}
      </div>
    `;
  }

  /** The averages the row shows: those the integration sent and the config doesn't hide. */
  private _shownAverages(): AverageWindow[] {
    const averages = this._data?.averages;
    const hidden = this._config?.hide_averages ?? [];
    return AVERAGE_WINDOWS.filter((key) => averages?.[key] && !hidden.includes(key));
  }

  private _renderAverages(): TemplateResult | typeof nothing {
    const averages = this._data!.averages;
    const shown = this._shownAverages();
    if (!averages || shown.length === 0) {
      return nothing;
    }
    const locale = this.hass!.locale.language;
    const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    return html`
      <div class="averages">
        <span class="averages-title"
          >${this._pricesOnly ? 'Average price' : 'Average price while on'}</span
        >
        <div class="info-bar">
          ${shown.map((key) => {
            const average = averages[key]!;
            return html`<div class="info-item">
              <span class="info-label">${AVERAGE_LABELS[key]}</span>
              <span class="info-value">${formatPrice(average.price, locale)}</span>
              ${this._pricesOnly
                ? nothing
                : html`<span class="info-hint">${hours.format(average.running_hours)} h on</span>`}
            </div>`;
          })}
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
            const cls = isRunning(segment.state) ? 'on' : 'off';
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
    const price = formatPrice(slot.price, this.hass!.locale.language);
    if (this._pricesOnly) {
      const classes = [
        'time-slot',
        'readonly',
        `tier-${tier}`,
        slot.isCurrent ? 'current' : '',
        slot.isPast ? 'past' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return html`
        <div class=${classes}>
          <div class="time-label">${slot.time}</div>
          <div class="price-label">${price}</div>
        </div>
      `;
    }
    const classes = [
      'time-slot',
      `tier-${tier}`,
      slot.effective === 'on' ? 'on' : '',
      slot.isAutoPick ? 'auto-pick' : '',
      slot.isOverridden ? 'overridden' : '',
      slot.isCurrent ? 'current' : '',
      slot.isPast ? 'past' : '',
      slot.isPending ? 'pending' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const title = [
      slot.time,
      price,
      slot.effective === 'on' ? 'runs' : 'off',
      slot.isAutoPick ? 'auto pick' : '',
      slot.isOverridden ? 'your override' : '',
    ]
      .filter(Boolean)
      .join(', ');
    return html`
      <div
        class=${classes}
        role="button"
        title=${title}
        aria-label=${title}
        tabindex=${slot.isPast ? -1 : 0}
        @click=${() => this._onSlotClick(slot)}
        @keydown=${(ev: KeyboardEvent) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            this._onSlotClick(slot);
          }
        }}
      >
        ${slot.isAutoPick ? robotIcon('slot-marker auto-marker') : nothing}
        ${slot.isOverridden ? handIcon('slot-marker override-marker') : nothing}
        <div class="time-label">${slot.time}</div>
        <div class="price-label">${price}</div>
      </div>
    `;
  }

  static get styles() {
    return sharedStyles;
  }
}

/** Whether a target state counts as on, by the same rule as the integration's is_running. */
function isRunning(state: string): boolean {
  return !['off', 'unavailable', 'unknown'].includes(state);
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

import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCardEditor, hasConfigOrEntityChanged } from 'custom-card-helpers';

import {
  NordpoolSchedulerCardConfig,
  NordpoolSensorAttributes,
  TimeSlot,
  HistorySegment,
  HistoryState,
} from './types';
import {
  generateTimeSlots,
  getCurrentSlotIndex,
  getPriceColor,
  formatPrice,
  groupSlotsByHour,
  calculatePriceStats,
} from './utils';
import { sharedStyles } from './styles';

console.info(
  '%c NORDPOOL-SCHEDULER-CARD %c v1.0.0 ',
  'color: white; background: #03a9f4; font-weight: 700;',
  'color: #03a9f4; background: white; font-weight: 700;'
);

export class NordpoolSchedulerCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: NordpoolSchedulerCardConfig;
  @state() private _selectedSlots: Set<number> = new Set();
  @state() private _historySegments: HistorySegment[] = [];
  private _updateInterval?: number;

  // Public getter for config (required by custom-card-helpers)
  public get config(): NordpoolSchedulerCardConfig | undefined {
    return this._config;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._startUpdateTimer();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = undefined;
    }
  }

  private _startUpdateTimer(): void {
    // Calculate milliseconds until the next minute boundary
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    // Wait until the next minute, then update every minute exactly
    setTimeout(() => {
      this.requestUpdate();
      // Now set up the regular interval to fire at the start of each minute
      this._updateInterval = window.setInterval(() => {
        this.requestUpdate();
      }, 60000);
    }, msUntilNextMinute);
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./nordpool-scheduler-card-editor');
    return document.createElement('nordpool-scheduler-card-editor');
  }

  public static getStubConfig(): NordpoolSchedulerCardConfig {
    console.log('🎯 getStubConfig called - HA found the card!');
    return {
      type: 'custom:nordpool-scheduler-card',
      entity: '',
      name: 'Nordpool Scheduler',
      show_name: true,
      show_day_selector: false,
      compact_view: false,
    };
  }

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    if (!config) {
      console.warn('⚠️ nordpool-scheduler-card: No config provided, using defaults');
      config = {
        type: 'custom:nordpool-scheduler-card',
      };
    }

    this._config = {
      show_name: true,
      show_day_selector: false,
      compact_view: false,
      show_history: true,
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._config) {
      return false;
    }

    return hasConfigOrEntityChanged(this, changedProps, false);
  }

  protected updated(changedProps: PropertyValues) {
    super.updated(changedProps);

    // Sync local state with backend when entity state changes
    if (changedProps.has('hass') && this.hass && this._config?.entity) {
      const oldHass = changedProps.get('hass');
      const newState = this.hass.states[this._config.entity];
      const oldState = oldHass?.states[this._config.entity];

      if (!newState) {
        console.error('❌ Entity not found:', this._config.entity);
        console.log(
          'Available entities:',
          Object.keys(this.hass.states).filter((e) => e.includes('nordpool'))
        );
        return;
      }

      // Get entry_id from attributes
      const attributes = newState?.attributes as unknown as NordpoolSensorAttributes;
      const entryId = attributes?.entry_id;

      // Debug: Log entity state and attributes
      if (!entryId) {
        console.error('❌ entry_id not found in entity attributes');
        console.log('Entity:', this._config.entity);
        console.log('State:', newState.state);
        console.log('All attributes:', attributes);
        console.log('Available attribute keys:', Object.keys(attributes || {}));
      }

      // Only update if the scheduled_overrides actually changed in the backend
      if (newState && oldState) {
        const newAttrs = newState.attributes as unknown as NordpoolSensorAttributes;
        const oldAttrs = oldState.attributes as unknown as NordpoolSensorAttributes;

        if (
          newAttrs.scheduled_overrides_count !== oldAttrs.scheduled_overrides_count ||
          newAttrs.last_update !== oldAttrs.last_update
        ) {
          // Backend state changed - fetch from service
          this._fetchSchedule(entryId);
        }
      } else if (newState && !oldState) {
        // Initial load - fetch from service
        this._fetchSchedule(entryId);

        // Fetch history if enabled
        if (this._config.show_history !== false) {
          // Use configured history_entity or fall back to target_entity from attributes
          const targetEntity = this._config.history_entity || attributes?.target_entity;
          console.log('🔍 Target entity for history:', {
            configured_history_entity: this._config.history_entity,
            backend_target_entity: attributes?.target_entity,
            backend_target_entity_state: attributes?.target_entity_state,
            final_target_entity: targetEntity,
            all_attributes: Object.keys(attributes || {}),
          });
          if (targetEntity) {
            this._fetchHistory(targetEntity);
          } else {
            console.warn(
              '⚠️ No target_entity found. Please configure "history_entity" in card settings to show history.'
            );
          }
        }
      }
    }
  }

  private async _fetchSchedule(entryId: string | undefined) {
    if (!entryId || !this.hass || !this._config) {
      console.warn('⚠️ Cannot fetch schedule: missing requirements');
      return;
    }

    try {
      // Call service with WebSocket directly to request response
      const conn = (this.hass as any).connection;
      if (!conn || !conn.sendMessagePromise) {
        throw new Error('WebSocket connection not available');
      }

      const response = await conn.sendMessagePromise({
        type: 'call_service',
        domain: 'nordpool_scheduler',
        service: 'get_schedule',
        service_data: {
          entry_id: entryId,
        },
        return_response: true,
      });

      console.log('📥 Fetched schedule from service:', response);
      console.log('📥 Response structure:', {
        hasResponse: !!response.response,
        responseType: typeof response.response,
        responseKeys: response.response ? Object.keys(response.response) : 'none',
        responseValue: response.response,
      });

      // Update local state from service response
      if (response && response.response && typeof response.response === 'object') {
        // The backend returns: { schedule: { "0": true, "1": false, ... } }
        const slotsData =
          'schedule' in response.response
            ? response.response.schedule
            : 'slots' in response.response
              ? response.response.slots
              : response.response;

        console.log('📊 Parsed slots data:', {
          slotsDataType: typeof slotsData,
          slotsDataKeys: slotsData ? Object.keys(slotsData).slice(0, 10) : 'none',
          slotsDataSample: slotsData,
        });

        const enabledSlots = Object.entries(slotsData)
          .filter(([_, enabled]) => enabled === true)
          .map(([index]) => parseInt(index));

        this._selectedSlots = new Set(enabledSlots);
        console.log('🔄 Synced state from service:', {
          count: this._selectedSlots.size,
          slots: Array.from(this._selectedSlots)
            .sort((a, b) => a - b)
            .slice(0, 10),
        });
        this.requestUpdate();
      }
    } catch (err) {
      console.error('❌ Failed to fetch schedule:', err);
      // Fallback to sensor attributes if service call fails
      if (this._config?.entity) {
        const state = this.hass?.states[this._config.entity];
        const attributes = state?.attributes as unknown as NordpoolSensorAttributes;
        const scheduledOverrides = attributes?.scheduled_overrides || [];
        this._selectedSlots = new Set(scheduledOverrides.map((o) => o.slot));
        this.requestUpdate();
      }
    }
  }

  private async _fetchHistory(targetEntityId: string | undefined) {
    if (!targetEntityId || !this.hass) {
      console.warn('⚠️ Cannot fetch history: missing requirements', {
        targetEntityId,
        hasHass: !!this.hass,
      });
      return;
    }

    console.log('📊 Fetching history for entity:', targetEntityId);

    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const conn = (this.hass as any).connection;
      if (!conn || !conn.sendMessagePromise) {
        throw new Error('WebSocket connection not available');
      }

      // Validate entity ID format
      if (!targetEntityId.includes('.')) {
        console.error('❌ Invalid entity ID format:', targetEntityId);
        return;
      }

      // Check if entity exists
      if (!this.hass.states[targetEntityId]) {
        console.error('❌ Entity not found in hass.states:', targetEntityId);
        console.log(
          'Available similar entities:',
          Object.keys(this.hass.states)
            .filter((e) => e.includes(targetEntityId.split('.')[0]))
            .slice(0, 5)
        );
        return;
      }

      console.log('✅ Entity exists, fetching history...');

      const response = await conn.sendMessagePromise({
        type: 'history/history_during_period',
        start_time: yesterday.toISOString(),
        end_time: now.toISOString(),
        entity_ids: [targetEntityId],
        significant_changes_only: false,
      });

      console.log('📥 History API Response:', {
        response,
        isArray: Array.isArray(response),
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : 'null',
      });

      // Response can be either an array or an object with entity ID as key
      let history: HistoryState[] | undefined;

      if (Array.isArray(response) && response[0]) {
        // Old format: array with first element being the history
        history = response[0] as HistoryState[];
      } else if (response && typeof response === 'object') {
        // New format: object with entity ID as key
        const entityKey = Object.keys(response)[0];
        if (entityKey && response[entityKey]) {
          history = response[entityKey] as HistoryState[];
        }
      }

      if (history && Array.isArray(history) && history.length > 0) {
        console.log('📜 History data:', {
          historyLength: history.length,
          firstItem: history[0],
        });

        const segments: HistorySegment[] = [];

        for (let i = 0; i < history.length; i++) {
          const current = history[i];
          const next = history[i + 1];

          // Access state - it might be in 's' property or 'state' property
          const state = (current as any).s || current.state;
          const lastChanged = (current as any).lu
            ? new Date((current as any).lu * 1000)
            : new Date(current.last_changed);

          const start = lastChanged;
          const end = next
            ? (next as any).lu
              ? new Date((next as any).lu * 1000)
              : new Date(next.last_changed)
            : now;
          const duration = end.getTime() - start.getTime();

          segments.push({
            state: state,
            start,
            end,
            duration,
          });
        }

        this._historySegments = segments;
        console.log('📊 Fetched history:', {
          entity: targetEntityId,
          segments: segments.length,
          sample: segments.slice(0, 3),
        });
        this.requestUpdate();
      } else {
        console.warn('⚠️ No history data received or empty', {
          response,
          history,
        });
      }
    } catch (err: any) {
      console.error('❌ Failed to fetch history:', {
        entity: targetEntityId,
        error: err,
        message: err?.message,
        code: err?.code,
      });
    }
  }

  private _handleSlotClick(slot: TimeSlot): void {
    if (!this.hass || !this._config?.entity) return;

    const stateObj = this.hass.states[this._config.entity];
    if (!stateObj) {
      console.error('❌ Entity not found:', this._config.entity);
      return;
    }

    const attributes = stateObj.attributes as unknown as NordpoolSensorAttributes;
    const entryId = attributes.entry_id;

    if (!entryId) {
      console.error('❌ entry_id not found in entity attributes. Cannot update schedule.');
      console.log('Entity:', this._config.entity);
      console.log('State:', stateObj.state);
      console.log('All attributes:', attributes);
      console.log('Available attribute keys:', Object.keys(attributes || {}));
      return;
    }

    // Determine if slot should be enabled or disabled
    const isCurrentlySelected = this._selectedSlots.has(slot.index);
    const newEnabledState = !isCurrentlySelected;

    // Update local state immediately for instant UI feedback (optimistic update)
    const newSelectedSlots = new Set(this._selectedSlots);
    if (newEnabledState) {
      newSelectedSlots.add(slot.index);
    } else {
      newSelectedSlots.delete(slot.index);
    }
    this._selectedSlots = newSelectedSlots;
    this.requestUpdate();

    // Call the service to update single slot
    this.hass
      .callService('nordpool_scheduler', 'set_slot', {
        entry_id: entryId,
        slot_index: slot.index,
        enabled: newEnabledState,
      })
      .then(async () => {
        console.log(
          `✅ Slot ${slot.index} (${slot.time}) set to ${newEnabledState ? 'enabled' : 'disabled'}`
        );
        // Fetch fresh schedule from service
        await this._fetchSchedule(entryId);
      })
      .catch((err) => {
        console.error('❌ Service call failed:', err);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          error: err,
        });

        // Revert optimistic update on error
        const oldOverrides = attributes.scheduled_overrides || [];
        this._selectedSlots = new Set(oldOverrides.map((o) => o.slot));
        this.requestUpdate();

        // Show error to user
        alert(
          `Failed to update slot ${slot.time}: ${err.message || 'Unknown error'}\n\nCheck browser console and Home Assistant logs for details.`
        );
      });
  }

  private _renderSlot(
    slot: TimeSlot,
    minPrice: number,
    maxPrice: number,
    avgPrice: number
  ): TemplateResult {
    const color = getPriceColor(slot.price, minPrice, maxPrice, avgPrice);
    const classList = [
      'time-slot',
      slot.isSelected ? 'selected' : '',
      slot.isCurrentTime ? 'current' : '',
      slot.isTomorrow ? 'tomorrow' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return html`
      <div
        class="${classList}"
        @click="${() => this._handleSlotClick(slot)}"
        style="--slot-color: ${color}"
      >
        <div class="time-label">${slot.time}</div>
        <div class="price-label" style="color: ${color}">${formatPrice(slot.price)}</div>
      </div>
    `;
  }

  private _renderInfoBar(
    attributes: NordpoolSensorAttributes | null,
    scheduledCount: number,
    minPrice: number,
    maxPrice: number,
    avgPrice: number
  ): TemplateResult {
    if (!attributes) return html``;

    const currentPrice = attributes.prices?.[attributes.current_slot];

    return html`
      <div class="info-bar">
        <div class="info-item">
          <span class="info-label">Current</span>
          <span class="info-value">${formatPrice(currentPrice)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Min</span>
          <span class="info-value success">${formatPrice(minPrice)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Avg</span>
          <span class="info-value warning">${formatPrice(avgPrice)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Max</span>
          <span class="info-value error">${formatPrice(maxPrice)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Scheduled</span>
          <span class="info-value">${scheduledCount}</span>
        </div>
      </div>
    `;
  }

  private _renderHistoryBar(): TemplateResult {
    if (!this._config?.show_history || this._historySegments.length === 0) {
      return html``;
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const totalDuration = 24 * 60 * 60 * 1000; // 24 hours in ms

    return html`
      <div class="history-container">
        <div class="history-label">Last 24h:</div>
        <div class="history-bar">
          ${this._historySegments.map((segment) => {
            const startOffset = Math.max(0, segment.start.getTime() - yesterday.getTime());
            const endOffset = Math.min(totalDuration, segment.end.getTime() - yesterday.getTime());
            const width = ((endOffset - startOffset) / totalDuration) * 100;
            const left = (startOffset / totalDuration) * 100;

            const isOn = segment.state === 'on';
            const className = isOn ? 'history-segment on' : 'history-segment off';

            return html`
              <div
                class="${className}"
                style="left: ${left}%; width: ${width}%"
                title="${segment.state}: ${new Date(segment.start).toLocaleString()} - ${new Date(
                  segment.end
                ).toLocaleString()}"
              ></div>
            `;
          })}
        </div>
      </div>
    `;
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) {
      return html``;
    }

    const stateObj = this._config.entity ? this.hass.states[this._config.entity] : undefined;

    if (!stateObj) {
      return html`
        <ha-card>
          <div class="error-message">
            <ha-icon icon="mdi:alert-circle"></ha-icon>
            <div class="error-title">Entity Not Found</div>
            <div class="error-details">
              ${this._config.entity
                ? `Entity "${this._config.entity}" does not exist in Home Assistant.`
                : 'Please configure an entity in the card settings.'}
            </div>
          </div>
        </ha-card>
      `;
    }

    // Check if entity is unavailable
    if (stateObj.state === 'unavailable' || stateObj.state === 'unknown') {
      return html`
        <ha-card>
          <div class="error-message">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            <div class="error-title">Entity Unavailable</div>
            <div class="error-details">
              The sensor "${this._config.entity}" is currently unavailable.
              <br /><br />
              <strong>Possible causes:</strong>
              <ul>
                <li>The Nordpool Scheduler integration is not running</li>
                <li>The integration failed to initialize</li>
                <li>Check Home Assistant logs for errors</li>
              </ul>
            </div>
          </div>
        </ha-card>
      `;
    }

    const attributes = stateObj.attributes as unknown as NordpoolSensorAttributes;

    // Check for required attributes
    if (!attributes.entry_id || !attributes.prices) {
      return html`
        <ha-card>
          <div class="error-message">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            <div class="error-title">Invalid Entity</div>
            <div class="error-details">
              The entity "${this._config.entity}" is missing required attributes.
              <br /><br />
              <strong>Missing:</strong>
              <ul>
                ${!attributes.entry_id ? html`<li>entry_id</li>` : ''}
                ${!attributes.prices ? html`<li>prices</li>` : ''}
              </ul>
              <br />
              Please ensure this is a valid Nordpool Scheduler sensor.
            </div>
          </div>
        </ha-card>
      `;
    }
    const currentSlot = getCurrentSlotIndex();

    // Use backend state by default, only use local state if it's different (optimistic update in progress)
    const backendSlots = new Set((attributes.scheduled_overrides || []).map((o) => o.slot));
    const hasLocalChanges =
      this._selectedSlots.size !== backendSlots.size ||
      Array.from(this._selectedSlots).some((s) => !backendSlots.has(s));

    // Debug: Log state comparison
    console.group('🎨 Render State Debug');
    console.log('Backend slots:', {
      count: backendSlots.size,
      slots: Array.from(backendSlots).sort((a, b) => a - b),
    });
    console.log('Local slots (_selectedSlots):', {
      count: this._selectedSlots.size,
      slots: Array.from(this._selectedSlots).sort((a, b) => a - b),
    });
    console.log('Has local changes:', hasLocalChanges);

    // Only use optimistic local state if we have pending changes, otherwise use backend truth
    const displaySlots = hasLocalChanges ? this._selectedSlots : undefined;
    console.log(
      'Display slots (undefined = use backend):',
      displaySlots
        ? {
            count: displaySlots.size,
            slots: Array.from(displaySlots)
              .sort((a, b) => a - b)
              .slice(0, 10),
          }
        : 'undefined (using backend)'
    );

    const slots = generateTimeSlots(attributes, currentSlot, displaySlots);
    console.log(
      'Generated slots sample (first 5):',
      slots.slice(0, 5).map((s) => ({
        index: s.index,
        time: s.time,
        isSelected: s.isSelected,
      }))
    );
    console.groupEnd();

    // Calculate price statistics from visible slots
    const priceStats = calculatePriceStats(slots);

    const hourGroups = groupSlotsByHour(slots);

    const cardName = this._config.name || attributes.scheduler_name || 'Nordpool Scheduler';

    return html`
      <ha-card>
        ${this._config.show_name
          ? html`
              <div class="card-header">
                <h2 class="card-title">${cardName}</h2>
              </div>
            `
          : ''}
        ${this._renderInfoBar(
          attributes,
          hasLocalChanges ? this._selectedSlots.size : backendSlots.size,
          priceStats.min,
          priceStats.max,
          priceStats.avg
        )}
        ${this._renderHistoryBar()}

        <div class="schedule-grid ${this._config.compact_view ? 'compact' : ''}">
          ${hourGroups.map((hourSlots) => {
            return html`${hourSlots.map((slot) =>
              this._renderSlot(slot, priceStats.min, priceStats.max, priceStats.avg)
            )}`;
          })}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return sharedStyles;
  }

  public getCardSize(): number {
    return 9;
  }
}

// Register with Home Assistant's custom card registry FIRST
console.info(
  '%c🎴 NORDPOOL-SCHEDULER-CARD %c\n' + 'Version: 1.0.0\n' + 'Registering custom element...',
  'color: orange; font-weight: bold; background: black',
  'color: white; background: black'
);

// STEP 1: Register the custom element FIRST
try {
  if (!customElements.get('nordpool-scheduler-card')) {
    console.log('📝 About to register nordpool-scheduler-card...');
    console.log('📝 Class to register:', NordpoolSchedulerCard);
    console.log('📝 Has getStubConfig?:', typeof NordpoolSchedulerCard.getStubConfig);

    customElements.define('nordpool-scheduler-card', NordpoolSchedulerCard);
    console.info(
      '%c✅ nordpool-scheduler-card element registered successfully',
      'color: green; font-weight: bold'
    );

    // Verify registration immediately
    const check = customElements.get('nordpool-scheduler-card');
    console.log('🔍 Immediate verification:', check);
    console.log('🔍 Can get stub config?:', typeof check?.getStubConfig);

    // Make it globally accessible for HA
    (window as any).customElements.get('nordpool-scheduler-card');

    // Verify multiple times
    setTimeout(() => {
      const check2 = customElements.get('nordpool-scheduler-card');
      console.log('🔍 100ms later - still there:', !!check2);
    }, 100);

    setTimeout(() => {
      const check3 = customElements.get('nordpool-scheduler-card');
      console.log('🔍 500ms later - still there:', !!check3);
    }, 500);

    setTimeout(() => {
      const check4 = customElements.get('nordpool-scheduler-card');
      console.log('🔍 1000ms later - still there:', !!check4);
    }, 1000);

    setTimeout(() => {
      const check5 = customElements.get('nordpool-scheduler-card');
      console.log('🔍 2000ms later - still there:', !!check5);
    }, 2000);
  } else {
    console.warn('⚠️ nordpool-scheduler-card already registered');
  }
} catch (err) {
  console.error('❌ Failed to register nordpool-scheduler-card:', err);
}

// Export for debugging and HA access
(window as any).NordpoolSchedulerCard = NordpoolSchedulerCard;

// Also register in a way that HA's card picker might expect
if (typeof customElements !== 'undefined' && customElements.get) {
  console.log('🔍 Final check - element exists:', !!customElements.get('nordpool-scheduler-card'));
}

// Register in window.customCards for card picker
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

const win = window as any;
win.customCards = win.customCards || [];
win.customCards.push({
  type: 'custom:nordpool-scheduler-card',
  name: 'Nordpool Scheduler Card',
  description: 'A custom card for Nordpool price-based scheduling with 15-minute intervals',
  preview: false,
});

console.log('✅ Card registered and added to picker!');

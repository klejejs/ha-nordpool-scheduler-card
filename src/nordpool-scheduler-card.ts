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
  @state() private _activeTab: 'today' | 'tomorrow' = 'today';
  @state() private _optimisticDate?: string; // Track which date has optimistic changes
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
        // NEW: Backend now returns grouped by date: { schedule: { "2025-10-07": { 0: true, 4: true }, "2025-10-08": {...} } }
        const scheduleData =
          'schedule' in response.response ? response.response.schedule : response.response;

        console.log('📊 Parsed schedule data:', {
          scheduleDataType: typeof scheduleData,
          scheduleDataKeys: scheduleData ? Object.keys(scheduleData) : 'none',
          scheduleDataSample: scheduleData,
        });

        // Don't flatten the schedule - the backend returns date-grouped data
        // We should NOT store it in _selectedSlots as that's only for optimistic updates
        // The render method will read directly from attributes.scheduled_overrides
        // Just clear any optimistic state since we have fresh backend data
        this._selectedSlots = new Set();
        this._optimisticDate = undefined;
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

  private _getTodayDate(): string {
    // Use local date, not UTC
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private _getTomorrowDate(): string {
    // Use local date, not UTC
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private _handleSlotClick(slot: TimeSlot): void {
    // Don't allow clicking on past slots
    if (slot.isPast) {
      return;
    }

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

    // Determine target date based on mode
    let targetDate: string;
    if (this._config.show_day_tabs) {
      // Day tabs mode: explicit date based on active tab
      const todayDate = this._getTodayDate();
      const tomorrowDate = this._getTomorrowDate();
      targetDate = this._activeTab === 'tomorrow' ? tomorrowDate : todayDate;
      console.log('📅 Date calculation (day tabs):', {
        today: todayDate,
        tomorrow: tomorrowDate,
        activeTab: this._activeTab,
        selectedDate: targetDate,
      });
    } else {
      // Single view mode: rolling window logic
      // Slots >= currentSlot are today, slots < currentSlot are tomorrow
      const currentSlot = attributes.current_slot ?? 0;
      const todayDate = this._getTodayDate();
      const tomorrowDate = this._getTomorrowDate();
      targetDate = slot.index >= currentSlot ? todayDate : tomorrowDate;
      console.log('📅 Date calculation (rolling window):', {
        today: todayDate,
        tomorrow: tomorrowDate,
        slotIndex: slot.index,
        currentSlot,
        selectedDate: targetDate,
      });
    }

    // Determine if slot should be enabled or disabled
    const isCurrentlySelected = slot.isSelected;
    const newEnabledState = !isCurrentlySelected;

    console.log('🔄 Slot click - Current state:', {
      slotIndex: slot.index,
      time: slot.time,
      isCurrentlySelected,
      newEnabledState,
      targetDate,
    });

    // Update local state immediately for instant UI feedback (optimistic update)
    // Start with current backend state for this date, then apply the change
    const currentBackendSlots = new Set(
      (attributes.scheduled_overrides || []).filter((o) => o.date === targetDate).map((o) => o.slot)
    );

    console.log('📦 Backend slots for date:', {
      targetDate,
      count: currentBackendSlots.size,
      slots: Array.from(currentBackendSlots).sort((a, b) => a - b),
    });

    const newSelectedSlots = new Set(currentBackendSlots);
    if (newEnabledState) {
      newSelectedSlots.add(slot.index);
    } else {
      newSelectedSlots.delete(slot.index);
    }

    console.log('✨ New optimistic state:', {
      count: newSelectedSlots.size,
      slots: Array.from(newSelectedSlots).sort((a, b) => a - b),
    });

    this._selectedSlots = newSelectedSlots;
    this._optimisticDate = targetDate; // Track which date has optimistic changes
    this.requestUpdate();

    // Call set_slot service to toggle individual slot
    const serviceData = {
      entry_id: entryId,
      slot_index: slot.index,
      enabled: newEnabledState,
      date: targetDate,
    };

    console.log('🎯 Calling set_slot service:', {
      slot_index: slot.index,
      time: slot.time,
      enabled: newEnabledState,
      date: targetDate,
      mode: this._config.show_day_tabs ? 'day-tabs' : 'rolling-window',
      activeTab: this._config.show_day_tabs ? this._activeTab : 'N/A',
      serviceData,
    });

    this.hass
      .callService('nordpool_scheduler', 'set_slot', serviceData)
      .then(async () => {
        console.log(
          `✅ Slot ${slot.index} (${slot.time}) set to ${newEnabledState ? 'enabled' : 'disabled'} for ${targetDate}`
        );
        // Clear optimistic state and fetch fresh schedule
        this._optimisticDate = undefined;
        await this._fetchSchedule(entryId);
      })
      .catch((err) => {
        console.error('❌ Service call failed:', err);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          error: err,
        });

        // Revert optimistic update on error - restore backend state for this date
        const oldOverrides = (attributes.scheduled_overrides || [])
          .filter((o) => o.date === targetDate)
          .map((o) => o.slot);
        this._selectedSlots = new Set(oldOverrides);
        this._optimisticDate = undefined;
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
      slot.isPast ? 'past' : '',
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

  private _getAllSlotsForDay(
    attributes: NordpoolSensorAttributes,
    currentSlot: number,
    day: 'today' | 'tomorrow',
    displaySlots?: Set<number>
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const prices = attributes.prices || [];

    // Get scheduled slots - use displaySlots if provided (optimistic update), otherwise backend
    // This is the EXACT same approach as generateTimeSlots in utils.ts
    const targetDate = day === 'today' ? this._getTodayDate() : this._getTomorrowDate();

    const backendSlots = new Set(
      (attributes.scheduled_overrides || [])
        .filter((o) => o.date === targetDate) // Filter by date
        .map((o) => o.slot)
    );

    const scheduledSlots = displaySlots ?? backendSlots;

    console.log(`📅 _getAllSlotsForDay(${day}):`, {
      targetDate,
      optimisticDate: this._optimisticDate,
      displaySlotsProvided: !!displaySlots,
      displaySlotsCount: displaySlots?.size,
      backendSlotsCount: backendSlots.size,
      finalScheduledSlotsCount: scheduledSlots.size,
      usingOptimistic: !!displaySlots,
    });

    for (let i = 0; i < 96; i++) {
      const hour = Math.floor(i / 4);
      const minute = (i % 4) * 15;
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // For today: use direct price index, for tomorrow: offset by 96
      const priceIdx = day === 'today' ? i : 96 + i;
      const price = prices[priceIdx] !== undefined ? prices[priceIdx] : null;

      // A slot is in the past if it's today and before the current slot
      const isPast = day === 'today' && i < currentSlot;

      // NEW: With date-based scheduling, we just check if the slot is in scheduledSlots
      // (already filtered by date above)
      const isScheduledForThisDay = scheduledSlots.has(i);

      slots.push({
        index: i,
        hour,
        minute,
        time,
        price,
        isSelected: isScheduledForThisDay,
        isCurrentTime: day === 'today' && i === currentSlot,
        isTomorrow: day === 'tomorrow',
        isPast: isPast,
      });
    }

    return slots;
  }

  private _handleTabChange(newTab: 'today' | 'tomorrow'): void {
    // Clear ONLY optimistic date when switching tabs to prevent cross-contamination
    // Don't clear _selectedSlots as it causes UI to show 0 scheduled slots temporarily
    // The render method will automatically use backend state for the new tab
    this._optimisticDate = undefined;
    this._activeTab = newTab;
    console.log('🔄 Tab changed to:', newTab);
    // Request update to re-render with correct backend state for new tab
    this.requestUpdate();
  }

  private _renderDayTabs(): TemplateResult {
    return html`
      <div class="day-tabs">
        <button
          class="day-tab ${this._activeTab === 'today' ? 'active' : ''}"
          @click=${() => this._handleTabChange('today')}
        >
          Today
        </button>
        <button
          class="day-tab ${this._activeTab === 'tomorrow' ? 'active' : ''}"
          @click=${() => this._handleTabChange('tomorrow')}
        >
          Tomorrow
        </button>
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
    // In day tabs mode, only compare against slots for the current date
    let backendSlots: Set<number>;
    let currentDate: string;

    if (this._config.show_day_tabs) {
      currentDate = this._activeTab === 'tomorrow' ? this._getTomorrowDate() : this._getTodayDate();
      backendSlots = new Set(
        (attributes.scheduled_overrides || [])
          .filter((o) => o.date === currentDate)
          .map((o) => o.slot)
      );
    } else {
      // In single view, use all slots (rolling window)
      currentDate = this._getTodayDate();
      backendSlots = new Set((attributes.scheduled_overrides || []).map((o) => o.slot));
    }

    // Only consider local changes if we have an optimistic date that matches current view
    // This prevents stale _selectedSlots from previous tab from being used
    const hasOptimisticUpdate = this._optimisticDate === currentDate;
    const hasLocalChanges =
      hasOptimisticUpdate &&
      (this._selectedSlots.size !== backendSlots.size ||
        Array.from(this._selectedSlots).some((s) => !backendSlots.has(s)));

    // Debug: Log state comparison
    console.group('🎨 Render State Debug');
    if (this._config.show_day_tabs) {
      console.log('Day tabs mode - Active tab:', this._activeTab, 'Date:', currentDate);
    }
    console.log('Backend slots:', {
      count: backendSlots.size,
      slots: Array.from(backendSlots).sort((a, b) => a - b),
    });
    console.log('Local slots (_selectedSlots):', {
      count: this._selectedSlots.size,
      slots: Array.from(this._selectedSlots).sort((a, b) => a - b),
    });
    console.log('Has local changes:', hasLocalChanges);
    console.log('Optimistic date:', this._optimisticDate);
    console.log('Current date:', currentDate);

    // Only use optimistic local state if we have pending changes AND the optimistic date matches the current view
    // This prevents showing optimistic state for "today" when viewing "tomorrow" tab (and vice versa)
    const isOptimisticDateValid = !this._optimisticDate || this._optimisticDate === currentDate;
    const displaySlots = hasLocalChanges && isOptimisticDateValid ? this._selectedSlots : undefined;

    console.log(
      '🎨 Display slots (undefined = use backend):',
      displaySlots
        ? {
            count: displaySlots.size,
            slots: Array.from(displaySlots)
              .sort((a, b) => a - b)
              .slice(0, 10),
            optimisticDate: this._optimisticDate,
            currentDate: currentDate,
            isOptimisticDateValid: isOptimisticDateValid,
            showDayTabs: this._config.show_day_tabs,
            activeTab: this._config.show_day_tabs ? this._activeTab : 'N/A',
          }
        : {
            reason: 'using backend',
            hasLocalChanges: hasLocalChanges,
            isOptimisticDateValid: isOptimisticDateValid,
          }
    );

    // Use different slot generation for tabs vs normal view
    const slots = this._config.show_day_tabs
      ? this._getAllSlotsForDay(attributes, currentSlot, this._activeTab, displaySlots)
      : generateTimeSlots(attributes, currentSlot, displaySlots);

    console.log(
      'Generated slots sample (first 5):',
      slots.slice(0, 5).map((s) => ({
        index: s.index,
        time: s.time,
        isSelected: s.isSelected,
        isPast: s.isPast,
      }))
    );
    console.groupEnd();

    const displayedSlots = slots;

    // Calculate price statistics from visible slots
    const priceStats = calculatePriceStats(displayedSlots);

    const hourGroups = groupSlotsByHour(displayedSlots);

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
        ${this._renderHistoryBar()} ${this._config.show_day_tabs ? this._renderDayTabs() : ''}

        <div class="schedule-grid compact">
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

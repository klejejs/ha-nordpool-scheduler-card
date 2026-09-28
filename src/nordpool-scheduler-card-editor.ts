import { LitElement, html, TemplateResult, css, CSSResultGroup } from 'lit';
import { property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';

import { NordpoolSchedulerCardConfig } from './types';

export class NordpoolSchedulerCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: NordpoolSchedulerCardConfig;

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    this._config = config;
  }

  protected updated(changedProps: Map<string, any>): void {
    super.updated(changedProps);

    // Re-render when hass becomes available
    if (changedProps.has('hass') && this.hass) {
      this.requestUpdate();
    }
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config) {
      return;
    }

    const target = ev.target as any;
    const configValue = target.configValue;

    // For ha-entity-picker and similar HA components, value is in ev.detail.value
    let value: any;
    if (ev.detail && ev.detail.value !== undefined) {
      value = ev.detail.value;
    } else {
      value = target.value;
    }

    if (this._config[configValue] === value) {
      return;
    }

    let newConfig: NordpoolSchedulerCardConfig;

    if (target.checked !== undefined) {
      newConfig = {
        ...this._config,
        [configValue]: target.checked,
      };
    } else {
      newConfig = {
        ...this._config,
        [configValue]: value,
      };
    }

    fireEvent(this, 'config-changed', { config: newConfig });
  }

  private _getEntities(): string[] {
    if (!this.hass) {
      return [];
    }

    return Object.keys(this.hass.states)
      .filter((entity) => entity.startsWith('sensor.nordpool_scheduler_'))
      .sort();
  }

  private _getHistoryEntities(): string[] {
    if (!this.hass) {
      return [];
    }

    return Object.keys(this.hass.states)
      .filter((entity) => entity.startsWith('binary_sensor.nordpool_scheduler_'))
      .sort();
  }

  protected render(): TemplateResult {
    if (!this._config) {
      return html`<div>Loading configuration...</div>`;
    }

    const entities = this.hass ? this._getEntities() : [];

    return html`
      <div class="card-config">
        <div class="header">
          <h3>Nordpool Scheduler Card Configuration</h3>
        </div>

        <div class="option">
          ${this.hass
            ? html`
                <ha-selector
                  .hass=${this.hass}
                  .selector=${{
                    entity: {
                      domain: 'sensor',
                      include_entities: this._getEntities(),
                    },
                  }}
                  .value=${this._config.entity}
                  .label=${'Entity (required)'}
                  .configValue=${'entity'}
                  @value-changed=${this._valueChanged}
                ></ha-selector>
              `
            : html`
                <ha-textfield
                  label="Entity (required)"
                  .value=${this._config.entity || ''}
                  .configValue=${'entity'}
                  @input=${this._valueChanged}
                  placeholder="sensor.nordpool_scheduler_..."
                ></ha-textfield>
              `}
          <div class="helper-text">
            Select the Nordpool Scheduler sensor entity. It should have the 'prices' attribute.
          </div>
        </div>

        <div class="option">
          <ha-textfield
            label="Name (optional)"
            .value=${this._config.name || ''}
            .configValue=${'name'}
            @input=${this._valueChanged}
          ></ha-textfield>
          <div class="helper-text">
            Custom name for the card. Leave empty to use the sensor's name.
          </div>
        </div>

        <div class="option">
          ${this.hass
            ? html`
                <ha-selector
                  .hass=${this.hass}
                  .selector=${{
                    entity: {
                      include_entities: this._getHistoryEntities(),
                    },
                  }}
                  .value=${this._config.history_entity}
                  .label=${'History Entity (optional)'}
                  .configValue=${'history_entity'}
                  @value-changed=${this._valueChanged}
                ></ha-selector>
              `
            : html`
                <ha-textfield
                  label="History Entity (optional)"
                  .value=${this._config.history_entity || ''}
                  .configValue=${'history_entity'}
                  @input=${this._valueChanged}
                  placeholder="binary_sensor.nordpool_scheduler_..."
                ></ha-textfield>
              `}
          <div class="helper-text">
            Select the binary sensor entity to show on/off history for. Leave empty to hide the
            history bar.
          </div>
        </div>

        <div class="option checkbox-option">
          <ha-formfield label="Show Name">
            <ha-checkbox
              .checked=${this._config.show_name !== false}
              .configValue=${'show_name'}
              @change=${this._valueChanged}
            ></ha-checkbox>
          </ha-formfield>
          <div class="helper-text">Display the card title/name.</div>
        </div>

        <div class="option checkbox-option">
          <ha-formfield label="Compact View">
            <ha-checkbox
              .checked=${this._config.compact_view === true}
              .configValue=${'compact_view'}
              @change=${this._valueChanged}
            ></ha-checkbox>
          </ha-formfield>
          <div class="helper-text">Use a more compact layout with smaller spacing.</div>
        </div>

        <div class="option checkbox-option">
          <ha-formfield label="Show History">
            <ha-checkbox
              .checked=${this._config.show_history !== false}
              .configValue=${'show_history'}
              @change=${this._valueChanged}
            ></ha-checkbox>
          </ha-formfield>
          <div class="helper-text">
            Display a timeline showing the last 24 hours of on/off states.
          </div>
        </div>

        <div class="option checkbox-option">
          <ha-formfield label="Show Day Tabs">
            <ha-checkbox
              .checked=${this._config.show_day_tabs === true}
              .configValue=${'show_day_tabs'}
              @change=${this._valueChanged}
            ></ha-checkbox>
          </ha-formfield>
          <div class="helper-text">Split today and tomorrow into separate tabs.</div>
        </div>

        <div class="info-box">
          <ha-icon icon="mdi:information-outline"></ha-icon>
          <div class="info-content">
            <strong>How to use:</strong>
            <ul>
              <li>Click on time slots to schedule when the switch should be turned on</li>
              <li>Colors indicate price levels: green (lowest), yellow, orange, red (highest)</li>
              <li>Blue indicates a selected/scheduled slot</li>
              <li>Bold border shows the current time slot</li>
              <li>Small orange dot indicates tomorrow's slots (with tomorrow's prices)</li>
            </ul>
          </div>
        </div>

        ${entities.length === 0
          ? html`
              <div class="warning-box">
                <ha-icon icon="mdi:alert"></ha-icon>
                <div class="warning-content">
                  <strong>No Nordpool entities found</strong>
                  <p>
                    Make sure you have installed and configured the Nordpool Scheduler integration.
                  </p>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      .card-config {
        padding: 16px;
      }

      .header {
        margin-bottom: 24px;
      }

      .header h3 {
        margin: 0;
        color: var(--primary-text-color);
        font-size: 1.2em;
        font-weight: 500;
      }

      .option {
        margin-bottom: 24px;
      }

      .option ha-entity-picker {
        width: 100%;
        display: block;
      }

      .option ha-textfield {
        width: 100%;
        display: block;
      }

      .option.checkbox-option {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .helper-text {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        margin-top: 4px;
        padding-left: 4px;
      }

      ha-textfield,
      ha-entity-picker {
        width: 100%;
      }

      ha-formfield {
        display: flex;
        align-items: center;
      }

      .info-box,
      .warning-box {
        display: flex;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        margin-top: 24px;
      }

      .info-box {
        background: rgba(3, 169, 244, 0.1);
        border: 1px solid rgba(3, 169, 244, 0.3);
      }

      .warning-box {
        background: rgba(255, 152, 0, 0.1);
        border: 1px solid rgba(255, 152, 0, 0.3);
      }

      .info-box ha-icon {
        color: var(--info-color);
        --mdc-icon-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .warning-box ha-icon {
        color: var(--warning-color);
        --mdc-icon-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      .info-content,
      .warning-content {
        flex: 1;
      }

      .info-content strong,
      .warning-content strong {
        display: block;
        margin-bottom: 8px;
        color: var(--primary-text-color);
      }

      .info-content ul {
        margin: 8px 0 0 0;
        padding-left: 20px;
      }

      .info-content li {
        margin-bottom: 4px;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }

      .warning-content p {
        margin: 0;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }
    `;
  }
}

// Register the custom element
customElements.define('nordpool-scheduler-card-editor', NordpoolSchedulerCardEditor);
console.info('✅ Registered nordpool-scheduler-card-editor');

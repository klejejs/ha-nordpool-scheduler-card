import { LitElement, html, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import type { HaFormSchema, HomeAssistant, NordpoolSchedulerCardConfig } from './types';
import { AVERAGE_LABELS, AVERAGE_WINDOWS } from './format';

/** The scheduler's current price sensor carries `vat_percent`; its average price sensors don't. */
export function isPriceSensor(hass: HomeAssistant, entityId: string): boolean {
  return (
    entityId.startsWith('sensor.') && hass.states[entityId].attributes.vat_percent !== undefined
  );
}

/** `ha-form` is lazy-loaded by Home Assistant; the built-in button card's editor pulls it in. */
export async function loadHaForm(): Promise<void> {
  if (customElements.get('ha-form')) {
    return;
  }
  const buttonCard = customElements.get('hui-button-card') as
    | (CustomElementConstructor & { getConfigElement?: () => Promise<unknown> })
    | undefined;
  await buttonCard?.getConfigElement?.();
}

function buildSchema(priceSensors: string[]): HaFormSchema[] {
  return [
    {
      name: 'entity',
      required: true,
      selector: {
        entity: {
          include_entities: priceSensors,
          filter: { integration: 'nordpool_scheduler', domain: 'sensor' },
        },
      },
    },
    { name: 'name', selector: { text: {} } },
    { name: 'show_name', default: true, selector: { boolean: {} } },
    { name: 'show_day_tabs', selector: { boolean: {} } },
    { name: 'show_history', default: true, selector: { boolean: {} } },
    {
      name: 'hide_averages',
      selector: {
        select: {
          multiple: true,
          mode: 'list',
          options: AVERAGE_WINDOWS.map((value) => ({ value, label: AVERAGE_LABELS[value] })),
        },
      },
    },
    {
      name: 'history_entity',
      selector: {
        entity: { filter: { integration: 'nordpool_scheduler', domain: 'binary_sensor' } },
      },
    },
  ];
}

export class NordpoolSchedulerCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: NordpoolSchedulerCardConfig;

  private _schemaKey?: string;

  private _schema: HaFormSchema[] = [];

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    this._config = config;
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._currentSchema(this.hass)}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  /** Rebuilt only when the set of price sensors changes, so ha-form isn't re-rendered on every state update. */
  private _currentSchema(hass: HomeAssistant): HaFormSchema[] {
    const priceSensors = Object.keys(hass.states)
      .filter((id) => isPriceSensor(hass, id))
      .sort();
    const key = priceSensors.join(',');
    if (key !== this._schemaKey) {
      this._schemaKey = key;
      this._schema = buildSchema(priceSensors);
    }
    return this._schema;
  }

  private _computeLabel = (schema: HaFormSchema): string =>
    this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`) ||
    schema.name.charAt(0).toUpperCase() + schema.name.slice(1).replace(/_/g, ' ');

  private _valueChanged(ev: CustomEvent<{ value: NordpoolSchedulerCardConfig }>): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: ev.detail.value },
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get('nordpool-scheduler-card-editor')) {
  customElements.define('nordpool-scheduler-card-editor', NordpoolSchedulerCardEditor);
}

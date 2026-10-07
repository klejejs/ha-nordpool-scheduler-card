import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import type { UnsubscribeFunc } from 'home-assistant-js-websocket';

import { AVERAGE_LABELS, AVERAGE_WINDOWS } from './format';
import type {
  HaFormSchema,
  HomeAssistant,
  NordpoolSchedulerCardConfig,
  ScheduleSnapshot,
} from './types';

export class NordpoolSchedulerCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: NordpoolSchedulerCardConfig;

  /** The selected scheduler's target entity: null for a prices-only entry, undefined until known. */
  @state() private _targetEntity?: string | null;

  private _subscribedEntity?: string;

  private _subscriptionId = 0;

  private _unsubscribe?: UnsubscribeFunc;

  public setConfig(config: NordpoolSchedulerCardConfig): void {
    this._config = config;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    // A reattached editor resubscribes without waiting for the next hass update.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeTarget();
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    const entityId = this._config?.entity;
    if (this.hass && entityId !== this._subscribedEntity) {
      this._subscribeTarget(entityId);
    }
  }

  private _subscribeTarget(entityId: string | undefined): void {
    this._unsubscribeTarget();
    this._subscribedEntity = entityId;
    if (!entityId) {
      return;
    }
    const subscriptionId = this._subscriptionId;
    this.hass!.connection.subscribeMessage<ScheduleSnapshot>(
      (data) => {
        if (this._subscriptionId === subscriptionId) {
          this._targetEntity = data.target_entity;
        }
      },
      { type: 'nordpool_scheduler/subscribe', entity_id: entityId }
    )
      .then((unsub) => {
        if (this._subscriptionId !== subscriptionId) {
          unsub();
          return;
        }
        this._unsubscribe = unsub;
      })
      .catch(() => {
        // Not a scheduler sensor; offer every option.
      });
  }

  private _unsubscribeTarget(): void {
    this._subscriptionId++;
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._subscribedEntity = undefined;
    this._targetEntity = undefined;
  }

  private _schema(): HaFormSchema[] {
    return [
      {
        name: 'entity',
        required: true,
        selector: { entity: { filter: { integration: 'nordpool_scheduler', domain: 'sensor' } } },
      },
      { name: 'name', selector: { text: {} } },
      { name: 'show_name', default: true, selector: { boolean: {} } },
      { name: 'show_day_tabs', selector: { boolean: {} } },
      ...(this._targetEntity === null
        ? []
        : [{ name: 'show_history', default: true, selector: { boolean: {} } }]),
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
    ];
  }

  // Same labels as the frontend's own form editor.
  private _computeLabel = (schema: HaFormSchema): string =>
    this.hass?.localize(`ui.panel.lovelace.editor.card.generic.${schema.name}`) ||
    schema.name.charAt(0).toUpperCase() + schema.name.slice(1).split('_').join(' ');

  protected render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) {
      return nothing;
    }
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema()}
      .computeLabel=${this._computeLabel}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }

  private _valueChanged(ev: CustomEvent<{ value: NordpoolSchedulerCardConfig }>): void {
    ev.stopPropagation();
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

declare global {
  interface HTMLElementTagNameMap {
    'nordpool-scheduler-card-editor': NordpoolSchedulerCardEditor;
  }
}

import type { Connection, HassEntity } from 'home-assistant-js-websocket';

/**
 * Minimal subset of Home Assistant's frontend types this card relies on.
 * We can't import the frontend's own (internal) types, so these are
 * declared locally to match the real objects passed in at runtime.
 */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  connection: Connection;
  locale: { language: string };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<unknown>;
}

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  preview?: boolean;
  getCardSize(): number | Promise<number>;
  getGridOptions?(): LovelaceGridOptions;
  setConfig(config: LovelaceCardConfig): void;
}

export interface LovelaceGridOptions {
  columns?: number | 'full';
  rows?: number | 'auto';
  min_columns?: number;
  max_columns?: number;
  min_rows?: number;
  max_rows?: number;
}

export interface HaFormSchema {
  name: string;
  selector: Record<string, unknown>;
  required?: boolean;
  default?: unknown;
}

export interface LovelaceConfigForm {
  schema: HaFormSchema[];
}

/** Card configuration, as stored in the dashboard YAML/storage. */
export interface NordpoolSchedulerCardConfig extends LovelaceCardConfig {
  type: string;
  entity?: string;
  name?: string;
  show_name?: boolean;
  show_history?: boolean;
  show_day_tabs?: boolean;
  history_entity?: string;
  price_unit?: PriceUnit;
}

export type PriceUnit = 'cents' | 'currency';

export type SlotOverride = 'on' | 'off' | null;
export type SlotState = 'on' | 'off';
export type SetSlotState = 'on' | 'off' | 'default';
export type ControlMode = 'on_change' | 'enforce';

/** One 15-minute slot, as sent by nordpool_scheduler/subscribe. */
export interface SlotSnapshot {
  start: string;
  end: string;
  price: number | null;
  override: SlotOverride;
  effective: SlotState;
}

/** The full snapshot pushed by nordpool_scheduler/subscribe. */
export interface ScheduleSnapshot {
  config_entry_id: string;
  target_entity: string;
  default_state: SlotState;
  control_mode: ControlMode;
  time_zone: string;
  currency: string;
  vat_percent: number;
  now_slot_start: string;
  target_state: string | null;
  slots: SlotSnapshot[];
}

/** One rendered time slot, with everything the template needs. */
export interface RenderSlot {
  start: string;
  time: string;
  price: number | null;
  effective: SlotState;
  isOverridden: boolean;
  isCurrent: boolean;
  isPast: boolean;
  isPending: boolean;
}

export interface HistorySegment {
  state: string;
  start: Date;
  end: Date;
}

interface HassHistoryState {
  s: string;
  lu: number;
}

export interface HistoryStreamMessage {
  states: Record<string, HassHistoryState[]>;
}

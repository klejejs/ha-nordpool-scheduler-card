import { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'nordpool-scheduler-card': LovelaceCard;
    'nordpool-scheduler-card-editor': LovelaceCardEditor;
  }
}

export interface NordpoolSchedulerCardConfig extends LovelaceCardConfig {
  type: string;
  entity?: string;
  history_entity?: string;
  name?: string;
  show_name?: boolean;
  show_day_selector?: boolean;
  compact_view?: boolean;
  show_history?: boolean;
  show_day_tabs?: boolean;
}

export interface NordpoolSensorAttributes {
  prices: (number | null)[];
  current_slot: number;
  entry_id: string;
  scheduler_name: string;
  default_state: string;
  target_entity?: string;
  target_entity_state?: string;
  min_price?: number;
  max_price?: number;
  avg_price?: number;
  scheduled_overrides?: ScheduledOverride[];
  scheduled_overrides_count?: number;
  last_update?: string;
}

export interface ScheduledOverride {
  date: string; // NEW: ISO date "YYYY-MM-DD"
  time: string;
  datetime: string; // NEW: Combined "YYYY-MM-DD HH:MM"
  slot: number;
  state: string;
}

export interface TimeSlot {
  index: number;
  hour: number;
  minute: number;
  time: string;
  price: number | null;
  isSelected: boolean;
  isCurrentTime: boolean;
  isTomorrow: boolean;
  isPast?: boolean;
}

export interface HistoryState {
  state: string;
  last_changed: string;
  last_updated: string;
}

export interface HistorySegment {
  state: string;
  start: Date;
  end: Date;
  duration: number;
}

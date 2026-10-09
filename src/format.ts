import type {
  AverageWindow,
  RenderSlot,
  ScheduleSnapshot,
  SetSlotState,
  SlotSnapshot,
} from './types';

export const AVERAGE_LABELS: Record<AverageWindow, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
};
export const AVERAGE_WINDOWS = Object.keys(AVERAGE_LABELS) as AverageWindow[];

/** Format a slot's start time in the schedule's time zone, not the browser's. */
export function formatSlotTime(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

/** A locale-independent YYYY-MM-DD grouping key for a slot's local calendar day. */
export function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Format one local calendar day for a section header, e.g. "Monday, 28 September". */
export function formatDayHeading(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

/** Format a price that is already in cents/kWh. */
export function formatPrice(price: number | null, locale: string, withUnit = true): string {
  if (price === null) {
    return '—';
  }
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
  return withUnit ? `${formatted} c/kWh` : formatted;
}

export interface PriceStats {
  min: number;
  max: number;
  avg: number;
}

export function calculatePriceStats(slots: RenderSlot[]): PriceStats | null {
  const prices = slots.map((s) => s.price).filter((p): p is number => p !== null);
  if (prices.length === 0) {
    return null;
  }
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
  };
}

/** Price tier relative to today's range, used to color a slot. */
export function priceTier(
  price: number | null,
  stats: PriceStats | null
): 'unknown' | 'low' | 'mid' | 'high' {
  if (price === null || stats === null) {
    return 'unknown';
  }
  const midLow = stats.avg - (stats.avg - stats.min) / 2;
  const midHigh = stats.avg + (stats.max - stats.avg) / 2;
  if (price > midHigh) {
    return 'high';
  }
  if (price >= midLow) {
    return 'mid';
  }
  return 'low';
}

/**
 * The state a click on this slot should request next: a slot without an
 * override flips to the opposite of what auto mode or the default wants, and
 * an overridden slot goes back to following them.
 */
export function nextSlotState(
  slot: SlotSnapshot,
  pendingState: SetSlotState | undefined
): SetSlotState {
  const current = pendingState ?? slot.override ?? 'default';
  if (current !== 'default') {
    return 'default';
  }
  return slot.base === 'on' ? 'off' : 'on';
}

/** Build the slots to render for one local calendar day, applying pending clicks. */
export function buildRenderSlots(
  snapshot: ScheduleSnapshot,
  dateKey: string,
  pending: Map<string, SetSlotState>,
  timeZone: string,
  locale: string
): RenderSlot[] {
  return snapshot.slots
    .filter((slot) => localDateKey(slot.start, timeZone) === dateKey)
    .map((slot) => {
      const pendingState = pending.get(slot.start);
      const effective =
        pendingState === undefined
          ? slot.effective
          : pendingState === 'default'
            ? slot.base
            : pendingState;
      const isOverridden =
        pendingState === undefined ? slot.override !== null : pendingState !== 'default';
      return {
        start: slot.start,
        time: formatSlotTime(slot.start, timeZone, locale),
        price: slot.price,
        effective,
        isOverridden,
        isAutoPick: slot.auto === true,
        isCurrent: slot.start === snapshot.now_slot_start,
        isPast: slot.start < snapshot.now_slot_start,
        isPending: pendingState !== undefined,
      };
    });
}

/** Drop the grid rows before the one holding the current slot; a day without one is kept whole. */
export function dropPastRows(slots: RenderSlot[], rowSize: number): RenderSlot[] {
  const current = slots.findIndex((s) => s.isCurrent);
  return current < 0 ? slots : slots.slice(current - (current % rowSize));
}

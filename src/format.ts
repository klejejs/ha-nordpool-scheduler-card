import type { PriceUnit, RenderSlot, ScheduleSnapshot, SetSlotState, SlotSnapshot } from './types';

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

export function formatPrice(
  price: number | null,
  unit: PriceUnit,
  currency: string,
  locale: string
): string {
  if (price === null) {
    return '—';
  }
  const value = unit === 'cents' ? price * 100 : price;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const suffix = unit === 'cents' ? 'c' : currency;
  return `${formatted} ${suffix}/kWh`;
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

/** The state a click on this slot should request next; "default" clears the override. */
export function nextSlotState(
  slot: SlotSnapshot,
  pendingState: SetSlotState | undefined,
  defaultState: 'on' | 'off'
): SetSlotState {
  const effectiveNow =
    pendingState === undefined
      ? slot.effective
      : pendingState === 'default'
        ? defaultState
        : pendingState;
  const requested = effectiveNow === 'on' ? 'off' : 'on';
  return requested === defaultState ? 'default' : requested;
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
            ? snapshot.default_state
            : pendingState;
      const isOverridden =
        pendingState === undefined ? slot.override !== null : pendingState !== 'default';
      return {
        start: slot.start,
        time: formatSlotTime(slot.start, timeZone, locale),
        price: slot.price,
        effective,
        isOverridden,
        isCurrent: slot.start === snapshot.now_slot_start,
        isPast: slot.start < snapshot.now_slot_start,
        isPending: pendingState !== undefined,
      };
    });
}

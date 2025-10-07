import { TimeSlot, NordpoolSensorAttributes } from './types';

export const SLOTS_PER_DAY = 96;
export const MINUTES_PER_SLOT = 15;

/**
 * Get the current slot index based on current time
 */
export function getCurrentSlotIndex(): number {
  const now = new Date();
  return now.getHours() * 4 + Math.floor(now.getMinutes() / 15);
}

/**
 * Generate all time slots for the day
 */
export function generateTimeSlots(
  attributes: NordpoolSensorAttributes | null,
  currentSlot: number,
  selectedSlots?: Set<number>
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const prices = attributes?.prices || [];

  // Use provided selectedSlots (optimistic) or fall back to attributes
  const scheduledSlots =
    selectedSlots ?? new Set((attributes?.scheduled_overrides || []).map((o) => o.slot));

  console.log('📍 generateTimeSlots called:', {
    selectedSlots_provided: selectedSlots !== undefined,
    selectedSlots_count: selectedSlots?.size ?? 'undefined',
    backend_overrides_count: attributes?.scheduled_overrides?.length ?? 0,
    final_scheduledSlots_count: scheduledSlots.size,
    final_scheduledSlots: Array.from(scheduledSlots)
      .sort((a, b) => a - b)
      .slice(0, 10),
  });

  for (let i = 0; i < SLOTS_PER_DAY; i++) {
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * MINUTES_PER_SLOT;
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Calculate real index considering today/tomorrow
    const realIdx = currentSlot > i ? SLOTS_PER_DAY + i : i;
    const price = prices[realIdx] !== undefined ? prices[realIdx] : null;

    slots.push({
      index: i,
      hour,
      minute,
      time,
      price,
      isSelected: scheduledSlots.has(i),
      isCurrentTime: i === currentSlot,
      isTomorrow: i < currentSlot,
    });
  }

  return slots;
}

/**
 * Calculate min, max, and average prices from visible slots
 */
export function calculatePriceStats(slots: TimeSlot[]): {
  min: number;
  max: number;
  avg: number;
} {
  const validPrices = slots.map((s) => s.price).filter((p): p is number => p !== null);

  if (validPrices.length === 0) {
    return { min: 0, max: 1, avg: 0.5 };
  }

  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  const avg = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;

  return { min, max, avg };
}

/**
 * Get color for price based on price ranges (similar to frontend.yaml)
 */
export function getPriceColor(price: number | null, min: number, max: number, avg: number): string {
  if (price === null) {
    return 'var(--disabled-text-color)';
  }

  const midMax = avg + (max - avg) / 2;
  const midLow = avg - (avg - min) / 2;

  if (price > midMax) {
    return 'var(--error-color)'; // Red
  } else if (price <= midMax && price > avg) {
    return 'var(--warning-color)'; // Orange
  } else if (price <= avg && price >= midLow) {
    return 'var(--yellow-color)'; // Bright Yellow
  } else {
    return 'var(--success-color)'; // Green
  }
}

/**
 * Format price with currency (converts to cents)
 */
export function formatPrice(price: number | null | undefined, currency = '€'): string {
  if (price === null || price === undefined || typeof price !== 'number') return '---';
  const cents = price * 100;
  return `${cents.toFixed(2)} ${currency}`;
}

/**
 * Format time slot for display
 */
export function formatTimeSlot(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Group slots by hour (4 slots per hour)
 */
export function groupSlotsByHour(slots: TimeSlot[]): TimeSlot[][] {
  const grouped: TimeSlot[][] = [];
  for (let i = 0; i < slots.length; i += 4) {
    grouped.push(slots.slice(i, i + 4));
  }
  return grouped;
}

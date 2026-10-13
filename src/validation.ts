import { AVERAGE_WINDOWS } from './format';
import type { AutoWindow, Density } from './types';

const SLOT_MINUTES = 15;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const WHOLE_DAY_END = '23:59';
const DENSITIES: Density[] = ['normal', 'compact', 'super_compact'];
const BOOLEAN_OPTIONS = ['show_name', 'show_history', 'show_day_tabs', 'hide_past_slots'];

/** Every problem with the card's own options, as messages for the config error. */
export function configErrors(config: Record<string, unknown> | undefined): string[] {
  if (!config?.entity) {
    return ['Entity must be specified'];
  }
  const errors: string[] = [];
  const { entity, name, density, hide_averages: hidden, set_slots_service: service } = config;
  if (typeof entity !== 'string' || !/^sensor\.[a-z0-9_]+$/.test(entity)) {
    errors.push(`entity must be a sensor's entity ID, not ${JSON.stringify(entity)}`);
  }
  if (name !== undefined && typeof name !== 'string') {
    errors.push('name must be text');
  }
  for (const option of BOOLEAN_OPTIONS) {
    if (config[option] !== undefined && typeof config[option] !== 'boolean') {
      errors.push(`${option} must be true or false`);
    }
  }
  if (density !== undefined && !DENSITIES.includes(density as Density)) {
    errors.push(`density must be ${DENSITIES.join(', ')}, not ${JSON.stringify(density)}`);
  }
  if (hidden !== undefined) {
    if (!Array.isArray(hidden)) {
      errors.push('hide_averages must be a list');
    } else {
      hidden.forEach((value: unknown, i) => {
        if (!AVERAGE_WINDOWS.includes(value as (typeof AVERAGE_WINDOWS)[number])) {
          errors.push(
            `hide_averages can hold ${AVERAGE_WINDOWS.join(', ')}, not ${JSON.stringify(value)}`
          );
        } else if (hidden.indexOf(value) !== i) {
          errors.push(`hide_averages lists ${String(value)} more than once`);
        }
      });
    }
  }
  if (service !== undefined && (typeof service !== 'string' || !/^\w+\.\w+$/.test(service))) {
    errors.push(
      `set_slots_service must be an action like domain.service, not ${JSON.stringify(service)}`
    );
  }
  return errors;
}

function minutes(at: string): number {
  const [hours, mins] = at.split(':').map(Number);
  return hours * 60 + mins;
}

function slotsOf(hours: number): number {
  return Math.floor(Math.round(hours * 60) / SLOT_MINUTES);
}

function inWindow(at: number, window: AutoWindow): boolean {
  const start = minutes(window.start);
  const end = minutes(window.end);
  if (start === end) {
    return true;
  }
  return start < end ? start <= at && at < end : at >= start || at < end;
}

/** Which of a nominal day's slots, by index from 00:00, a window covers. */
function coveredSlots(window: AutoWindow): number[] {
  return [...Array(SLOTS_PER_DAY).keys()].filter((index) => inWindow(index * SLOT_MINUTES, window));
}

function label(window: AutoWindow): string {
  return `${window.start} to ${window.end}`;
}

function onBoundary(at: string, end: boolean): boolean {
  return (
    /^\d\d:\d\d$/.test(at) && (minutes(at) % SLOT_MINUTES === 0 || (end && at === WHOLE_DAY_END))
  );
}

function quarterHours(hours: number): boolean {
  return hours >= 0 && hours <= 24 && Number.isInteger((hours * 60) / SLOT_MINUTES);
}

function ownErrors(window: AutoWindow, cover: number[]): string[] {
  const errors: string[] = [];
  const name = `Window ${label(window)}`;
  const minRun = window.min_run_hours ?? 0;
  for (const [at, end] of [
    [window.start, false],
    [window.end, true],
  ] as const) {
    if (!onBoundary(at, end)) {
      errors.push(
        `${name}: ${at} isn't on a 15-minute boundary (:00, :15, :30 or :45, and To may also be 23:59)`
      );
    }
  }
  if (!quarterHours(window.hours)) {
    errors.push(`${name}: Run for must be whole quarter hours from 0 to 24 h`);
  }
  if (!quarterHours(minRun)) {
    errors.push(`${name}: Min run must be whole quarter hours from 0 to 24 h`);
  }
  for (const [price, value] of [
    ['max price', window.max_price],
    ['cheap price', window.cheap_price],
  ] as const) {
    if (!(value >= 0 && value <= 1000)) {
      errors.push(`${name}: the ${price} must be from 0 to 1000`);
    }
  }
  const covered = `${(cover.length * SLOT_MINUTES) / 60} h`;
  if (slotsOf(window.hours) > cover.length) {
    errors.push(`${name} runs for ${window.hours} h but only covers ${covered}`);
  }
  if (slotsOf(minRun) > cover.length) {
    errors.push(`${name} has a min run of ${minRun} h but only covers ${covered}`);
  }
  if (window.hours > 0 && minRun > window.hours) {
    errors.push(
      `${name} has a min run of ${minRun} h, longer than the ${window.hours} h it runs for`
    );
  }
  if (window.max_price > 0 && window.cheap_price > window.max_price) {
    errors.push(
      `${name} has a cheap price of ${window.cheap_price}, above its max price of ${window.max_price}`
    );
  }
  if (window.hours === 0 && window.cheap_price === 0) {
    errors.push(`${name} runs for 0 h and has no cheap price, so it never turns anything on`);
  }
  return errors;
}

/** The windows whose hours add up to more than the slots they cover together, if any. */
function unfittable(windows: AutoWindow[], covers: number[][]): AutoWindow[] {
  // A negative or missing Run for is its own error, and needs no slots here.
  const needs = windows.flatMap((window, i) =>
    Array<number>(Math.max(0, slotsOf(window.hours) || 0)).fill(i)
  );
  const holder = new Map<number, number>();
  const place = (need: number, seen: Set<number>): boolean => {
    for (const slot of covers[needs[need]]) {
      if (seen.has(slot)) {
        continue;
      }
      seen.add(slot);
      const held = holder.get(slot);
      if (held === undefined || place(held, seen)) {
        holder.set(slot, need);
        return true;
      }
    }
    return false;
  };
  for (let need = 0; need < needs.length; need++) {
    const seen = new Set<number>();
    if (!place(need, seen)) {
      const competing = new Set([
        needs[need],
        ...[...seen].map((slot) => needs[holder.get(slot)!]),
      ]);
      return [...competing].sort((a, b) => a - b).map((i) => windows[i]);
    }
  }
  return [];
}

/** Every rule the run limit breaks with these windows. */
export function runLimitErrors(
  windows: AutoWindow[],
  runsLimited: boolean,
  maxRuns: number
): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(maxRuns)) {
    errors.push(`Runs per day must be a whole number, not ${maxRuns}`);
  }
  const running = windows.filter((window) => slotsOf(window.hours) > 0).length;
  if (runsLimited && running > maxRuns) {
    errors.push(
      `${running} windows run for some time, but Limit runs allows only ${maxRuns} runs per day and each window needs one`
    );
  }
  return errors;
}

/** Every rule the windows break, worded as the integration words them. */
export function windowErrors(
  windows: AutoWindow[],
  runsLimited: boolean,
  maxRuns: number
): string[] {
  if (windows.length === 0) {
    return ['Add at least one time window. To stop auto mode, turn Auto mode off'];
  }
  const covers = windows.map(coveredSlots);
  const errors = windows.flatMap((window, i) => ownErrors(window, covers[i]));
  covers.forEach((cover, i) => {
    const same = covers.findIndex((other) => other.join() === cover.join());
    if (same < i) {
      errors.push(
        `Windows ${label(windows[same])} and ${label(windows[i])} cover the same time, so make them one window`
      );
    }
  });
  if (!windows.some((window, i) => slotsOf(window.hours) > covers[i].length)) {
    const unfit = unfittable(windows, covers);
    if (unfit.length > 0) {
      errors.push(
        `Windows ${unfit.map(label).join(', ')} run for more hours than they cover between them`
      );
    }
  }
  return runsLimited ? [...errors, ...runLimitErrors(windows, true, maxRuns)] : errors;
}

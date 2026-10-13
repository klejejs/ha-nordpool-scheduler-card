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
  if (service !== undefined && (typeof service !== 'string' || !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(service))) {
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
    /^([01]\d|2[0-3]):[0-5]\d$/.test(at) &&
    (minutes(at) % SLOT_MINUTES === 0 || (end && at === WHOLE_DAY_END))
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

/**
 * A window that may not get its hours, and the windows that pick before it, if any.
 * Windows pick narrowest first and may take any slot they cover, as auto mode does.
 */
function unfittable(windows: AutoWindow[], covers: number[][]): AutoWindow[] {
  // A negative or missing Run for is its own error, and needs no slots here.
  const needs = windows.map((window) => Math.max(0, slotsOf(window.hours) || 0));
  const order = windows
    .map((_, i) => i)
    .filter((i) => needs[i] > 0)
    .sort(
      (a, b) =>
        covers[a].length - covers[b].length || minutes(windows[a].start) - minutes(windows[b].start)
    );
  for (const [position, i] of order.entries()) {
    const own = new Set(covers[i]);
    const shared = (j: number) => covers[j].filter((slot) => own.has(slot)).length;
    const earlier = order.slice(0, position).filter((j) => shared(j) > 0);
    const taken = earlier.reduce((sum, j) => sum + Math.min(needs[j], shared(j)), 0);
    if (needs[i] > covers[i].length - taken) {
      return [...earlier, i].sort((a, b) => a - b).map((j) => windows[j]);
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
  if (!Number.isInteger(maxRuns) || maxRuns < 1 || maxRuns > 24) {
    errors.push(`Runs per day must be a whole number from 1 to 24, not ${maxRuns}`);
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
        `Windows ${unfit.map(label).join(', ')} can't all be sure of their hours: narrower windows pick first and can take the time the wider ones need`
      );
    }
  }
  return runsLimited ? [...errors, ...runLimitErrors(windows, true, maxRuns)] : errors;
}

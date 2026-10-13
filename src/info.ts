import { html, nothing, type TemplateResult } from 'lit';

import type { AutoWindow, NordpoolSchedulerCardConfig, ScheduleSnapshot } from './types';
import { AVERAGE_LABELS, formatHours, formatPrice, isWholeDay } from './format';
import { handIcon, robotIcon, stopIcon } from './icons';

// Every user-facing feature of the card and the integration is explained here.
// A change that adds or alters one updates this file in the same pull request.

export interface InfoContext {
  data?: ScheduleSnapshot;
  config: NordpoolSchedulerCardConfig;
  locale: string;
  /** The schedule comes from a Schedule sensor mirrored from another instance. */
  mirrored: boolean;
}

export function renderInfo(ctx: InfoContext): TemplateResult {
  const pricesOnly = ctx.data?.target_entity === null;
  return html`
    ${ctx.data ? renderThisScheduler(ctx.data, ctx.locale, ctx.mirrored) : nothing}
    ${pricesOnly ? renderPricesOnly() : renderScheduling(hasWindows(ctx.data))}
    ${renderNumbers(pricesOnly)} ${renderCardOptions(ctx.config, pricesOnly)}
    ${renderOtherInstance(pricesOnly)}
  `;
}

/** Whether the integration runs auto mode in time windows; assume so until it says. */
function hasWindows(data: ScheduleSnapshot | undefined): boolean {
  return !data || data.auto.windows !== undefined;
}

function fact(label: string, value: string): TemplateResult {
  return html`<dt>${label}</dt>
    <dd>${value}</dd>`;
}

function limit(price: number, locale: string): string {
  return price > 0 ? formatPrice(price, locale) : 'Off';
}

function renderThisScheduler(
  data: ScheduleSnapshot,
  locale: string,
  mirrored: boolean
): TemplateResult {
  const vat = `${data.vat_percent}%, included in every price`;
  if (data.target_entity === null) {
    return html`<section>
      <h3>This entry</h3>
      <dl class="info-facts">
        ${fact('Type', 'Prices only: shows prices, controls nothing')} ${fact('VAT', vat)}
      </dl>
    </section>`;
  }
  const auto = data.auto;
  const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(auto.run_hours);
  const runLimit =
    auto.runs_limited_entity === undefined
      ? nothing
      : fact('Run limit', auto.runs_limited ? `On, ${auto.max_runs ?? 1} per day` : 'Off');
  const common = html`${fact('Target', data.target_entity)}
  ${fact('Default state', data.default_state === 'on' ? 'On' : 'Off')}
  ${fact(
    'Manual toggles',
    data.control_mode === 'enforce'
      ? 'Enforce every 15 minutes'
      : 'Only act when the schedule changes'
  )}`;
  const rest = html`${data.stop_entity === undefined
    ? nothing
    : fact('Stop sensor', stopSensor(data))}
  ${fact('VAT', vat)} ${mirrored ? fact('Runs on', 'Another Home Assistant instance') : nothing}`;
  if (auto.windows) {
    return html`<section>
      <h3>This scheduler</h3>
      <dl class="info-facts">
        ${common} ${fact('Auto mode', auto.enabled ? `On, ${hours} h per day` : 'Off')}
        ${auto.windows.length === 0
          ? fact('Time windows', 'None, so auto mode runs nothing')
          : nothing}
        ${auto.windows.map((window, i) => fact(`Window ${i + 1}`, describeWindow(window, locale)))}
        ${runLimit} ${rest}
      </dl>
    </section>`;
  }
  const hasRange = auto.window_enabled_entity !== undefined;
  const range =
    auto.window_start === auto.window_end
      ? 'On, whole day (From equals To)'
      : `On, ${auto.window_start}–${auto.window_end}`;
  return html`<section>
    <h3>This scheduler</h3>
    <dl class="info-facts">
      ${common} ${fact('Auto mode', auto.enabled ? `On, ${hours} h per day` : 'Off')}
      ${fact('Max price', limit(auto.max_price ?? 0, locale))}
      ${fact('Cheap price', limit(auto.cheap_price ?? 0, locale))}
      ${hasRange ? fact('Hour range', auto.window_enabled ? range : 'Off') : nothing}
      ${hasRange
        ? fact(
            'Cheap price all day',
            auto.window_enabled
              ? onOff(auto.cheap_all_day)
              : `${onOff(auto.cheap_all_day)}, applies once the hour range is on`
          )
        : nothing}
      ${runLimit} ${rest}
    </dl>
  </section>`;
}

/** A window as one line: "06:00–08:00 · 45 min · max 25.00 c/kWh". */
function describeWindow(window: AutoWindow, locale: string): string {
  const parts = [
    isWholeDay(window)
      ? `Whole day (${window.start}–${window.end})`
      : `${window.start}–${window.end}`,
    formatHours(window.hours, locale),
  ];
  if (window.max_price > 0) {
    parts.push(`max ${formatPrice(window.max_price, locale)}`);
  }
  if (window.cheap_price > 0) {
    parts.push(`cheap at ${formatPrice(window.cheap_price, locale)} or less`);
  }
  if (window.min_run_hours !== undefined) {
    parts.push(
      window.min_run_hours > 0
        ? `runs at least ${formatHours(window.min_run_hours, locale)} at a time`
        : 'no min run'
    );
  }
  return parts.join(' · ');
}

function stopSensor(data: ScheduleSnapshot): string {
  if (!data.stop_entity) {
    return 'None';
  }
  return data.stopped
    ? `${data.stop_entity}, on now: the target is held off`
    : `${data.stop_entity}, off`;
}

function renderScheduling(windows: boolean): TemplateResult {
  return html`
    <section>
      <h3>What decides a slot</h3>
      <p>
        The day is split into 15-minute slots. For each one, the first of these that applies wins:
      </p>
      <ol>
        <li>${handIcon('info-icon manual')} <strong>Your override</strong>, if you clicked it.</li>
        <li>
          ${robotIcon('info-icon auto')} <strong>Auto mode's pick</strong>, while auto mode is on.
        </li>
        <li><strong>The default state</strong> (on or off) set in the integration.</li>
      </ol>
      <p>
        A <strong>stop sensor</strong>, while it is on, beats all three and keeps the target off.
      </p>
      <p>
        At 00, 15, 30 and 45 past each hour the scheduler turns the target on or off to match the
        current slot. Changing an override, auto mode or one of its settings re-checks the current
        slot straight away. A target that is unavailable is skipped for that slot.
      </p>
      <p>
        The integration's <strong>Scheduler enabled</strong> switch pauses all of this: the target
        is left as it is until the switch is back on.
      </p>
    </section>

    <section>
      <h3>Reading the grid</h3>
      <ul>
        <li>
          Green slots are cheap, yellow middling and red expensive, relative to that day's own price
          range, not to other days.
        </li>
        <li>
          <span class="legend-swatch"></span> A thick blue border means the target runs in that
          slot, unless the stop sensor holds it off.
        </li>
        <li>
          ${robotIcon('info-icon auto')} A robot in the top-left marks a slot auto mode picked. It
          is only shown while auto mode is on.
        </li>
        <li>
          ${handIcon('info-icon manual')} An orange hand in the top-right and a dashed border mark
          your override. An override that runs the target has an orange border.
        </li>
        <li>A faded robot next to the hand is an auto pick you overrode off.</li>
        <li>
          <span class="legend-swatch now"></span> The current slot has a ring in the text colour
          around it and a bold time. The ring sits outside the border, so its border still says whether it runs and
          whether that is auto mode's pick or your override.
        </li>
        <li>
          Past slots are faded and can't be clicked. Tomorrow shows a placeholder until Nord Pool
          publishes its prices, usually early afternoon CET.
        </li>
      </ul>
    </section>

    <section>
      <h3>Overrides</h3>
      <p>
        Click a slot to make it do the opposite of what auto mode or the default state wants. Click
        it again to remove the override, and it follows them again.
      </p>
      <p>
        Overriding the current slot switches the target at once, even if you toggled the target by
        hand. Overrides survive restarts, and are removed once their slot has passed.
      </p>
      <p>
        An override is also removed as soon as auto mode or the default state wants the same thing
        for its slot, for example after new prices, a change to auto mode's settings, or turning
        auto mode on or off. It doesn't come back if auto mode later changes back.
      </p>
    </section>

    ${windows ? renderAutoWindows() : renderDailyAuto()}

    <section>
      <h3>Stop sensor</h3>
      <p>
        Under the integration's <strong>Configure</strong> you can pick a
        <strong>Stop sensor</strong>: a binary sensor, input boolean or switch. While it is on, the
        target is kept off whatever the slot says, so floor heating stops once the room is warm
        enough however cheap the price. The scheduler doesn't read temperatures itself: a Threshold
        helper on a temperature sensor makes a good stop sensor.
      </p>
      <ul>
        <li>
          ${stopIcon('info-icon stop')} A red <strong>Stopped</strong> chip in the header shows
          while it is on and the scheduler is enabled. With <strong>Scheduler enabled</strong> off,
          the stop sensor does nothing either.
        </li>
        <li>
          It wins over auto mode's picks, the default state and your overrides. The grid keeps
          showing what the schedule wants, so its borders don't change while stopped.
        </li>
        <li>
          The target turns off as soon as it turns on, and the current slot applies again as soon as
          it turns off, without waiting for the next quarter hour.
        </li>
        <li>Auto mode doesn't pick extra slots to make up for the time it was stopped.</li>
        <li>While it is unavailable it is ignored, and the schedule carries on.</li>
        <li>
          With <strong>Only act when the schedule changes</strong>, the target is brought in line
          when the stop starts, when it ends, and at a restart while it is on, so a target turned on
          by hand is turned off too. A manual toggle in between is left alone. With
          <strong>Enforce every 15 minutes</strong>, it is turned off again at every slot.
        </li>
      </ul>
    </section>

    <section>
      <h3>Manual toggles</h3>
      <p>
        What happens when someone switches the target by hand is set under the integration's
        <strong>Configure</strong>:
      </p>
      <ul>
        <li>
          <strong>Only act when the schedule changes</strong> leaves the target alone until the
          schedule wants something different from the previous slot, or you change the current slot.
          This holds across restarts.
        </li>
        <li>
          <strong>Enforce every 15 minutes</strong> puts the target back in line with the schedule
          at every slot.
        </li>
      </ul>
    </section>
  `;
}

function renderAutoWindows(): TemplateResult {
  return html`
    <section>
      <h3>Auto mode</h3>
      <p>
        With auto mode on, the target runs in a list of <strong>time windows</strong>. Each window
        runs for its own time in the cheapest slots inside it, and outside every window the target
        is off.
      </p>
      <p>
        The chip in the header turns auto mode on or off and shows the hours per day, which is all
        the windows' hours added up. It also shows a lone window's times, or how many windows there
        are, and the run limit when it is on. The gear opens the settings, where you add, change and
        remove windows. Changes take effect at once.
      </p>
      <p>Set once for the whole scheduler:</p>
      <ul>
        <li><strong>Auto mode</strong>, on or off.</li>
        <li><strong>Limit runs</strong> and <strong>Runs per day</strong>, see Run limit below.</li>
      </ul>
      <p>Set on each window:</p>
      <ul>
        <li><strong>From</strong> and <strong>To</strong>: the time of day it covers.</li>
        <li><strong>Run for</strong>: how many hours it runs, in its cheapest slots.</li>
        <li>
          <strong>Max price</strong>: the slots it picks for its hours are never above this price. 0
          turns it off.
        </li>
        <li>
          <strong>Cheap price</strong>: its slots at or below this price run too, even past its
          hours. 0 turns it off.
        </li>
        <li>
          <strong>Min run</strong>: once it turns the target on, it stays on at least this long. 0
          turns it off. See Min run below.
        </li>
      </ul>
      <p>
        A new scheduler has one window, 00:00 to 23:59 for 2 hours with no prices set: the target
        runs in the two cheapest hours of each day.
      </p>
    </section>

    <section>
      <h3>Time windows</h3>
      <ul>
        <li>
          A To before From wraps past midnight: 20:00 to 00:00 is 20:00 to midnight, and 22:00 to
          06:00 covers that day's 00:00–06:00 and 22:00–midnight. From equal to To, or 00:00 to
          23:59, is the whole day.
        </li>
        <li>
          Each day, midnight to midnight, is picked on its own. A tie between equal prices goes to
          the earlier slot.
        </li>
        <li>
          The narrowest window picks first, so a morning window gets its slots before a whole-day
          window fills in around it. A slot one window picked isn't picked again by another.
        </li>
        <li>
          On an expensive day a window can run for less than its hours, or not at all, because it
          never picks a slot above its max price for its hours.
        </li>
        <li>
          A window that runs for 0 hours picks nothing, but its cheap price still applies. A
          whole-day window with 0 hours and a cheap price runs every cheap slot of the day.
        </li>
        <li>
          A day is only picked once every one of its slots has a price. Until then, for example
          tomorrow before Nord Pool publishes, slots inside a window that runs for some time follow
          the default state, and every other slot is off.
        </li>
      </ul>
    </section>

    <section>
      <h3>Run limit</h3>
      <p>
        With <strong>Limit runs</strong> on, each window runs its hours back to back, and the day
        makes at most <strong>Runs per day</strong> separate runs. Use it for a target like a boiler
        or floor heating that shouldn't start often.
      </p>
      <ul>
        <li>
          Every window that runs for some time gets at least one run. Narrower windows go first, and
          a window only takes more than one run when enough are left for the windows after it.
        </li>
        <li>
          Slots that join onto a run another window already made lengthen that run, and don't count
          as another one.
        </li>
        <li>A run never spans a slot above its window's max price.</li>
        <li>
          A slot at or below a cheap price only runs when it lengthens a run, never as a run of its
          own.
        </li>
        <li>A window that wraps past midnight is two stretches of the same day.</li>
        <li>
          Min run applies on top: every run is also at least its window's min run long. Two runs of
          at least an hour can't fit 1.5 hours, so such a window makes one 1.5-hour run.
        </li>
      </ul>
    </section>

    <section>
      <h3>Min run</h3>
      <p>
        A window's <strong>Min run</strong> is the shortest run it starts, so a boiler never runs
        for a lone 15 minutes. It works with Limit runs on or off.
      </p>
      <ul>
        <li>
          Its hours go to the cheapest stretches at least the min run long. With Run for 2 h and Min
          run 1 h that is one 2-hour run or two runs of at least an hour, never scattered slots.
        </li>
        <li>
          A run never spans a slot above the max price, so when no stretch under it is long enough
          the window runs for less than its hours, or not at all.
        </li>
        <li>
          A slot that joins onto a run another window already made counts that run's length, so it
          can lengthen the run by just 15 minutes.
        </li>
        <li>
          A cheap slot always runs when it lengthens a run. Cheap slots on their own only run in a
          stretch at least the min run long.
        </li>
        <li>
          Each day is picked on its own, so a run at midnight must be long enough within its own
          day.
        </li>
        <li>
          It only shapes auto mode's picks. Your overrides still switch single slots, and a stop
          sensor still cuts a run short.
        </li>
      </ul>
    </section>

    <section>
      <h3>What isn't allowed</h3>
      <p>
        Settings that contradict each other are refused, here and in the integration, with an error
        that names the problem. Nothing is changed until they're fixed.
      </p>
      <ul>
        <li>No windows at all. To stop auto mode, turn it off.</li>
        <li>
          From or To off a quarter hour. They fall on :00, :15, :30 or :45, and To may also be
          23:59.
        </li>
        <li>
          Run for or Min run longer than the window covers, or not in whole quarter hours. 22:00 to
          06:00 covers 8 hours.
        </li>
        <li>A min run longer than Run for, unless Run for is 0.</li>
        <li>A cheap price above the max price, when both are set.</li>
        <li>A window with 0 hours and no cheap price, which never runs anything.</li>
        <li>
          Two windows over the same time. From equal to To and 00:00 to 23:59 are both the whole
          day.
        </li>
        <li>
          More hours than the windows cover between them: 06:00 to 08:00 for 2 h and 06:00 to 09:00
          for 2 h need 4 hours of a 3-hour stretch.
        </li>
        <li>
          With Limit runs on, fewer runs per day than windows that run for some time, since each
          needs a run. A window with only a cheap price needs none.
        </li>
        <li>Runs per day that isn't a whole number.</li>
      </ul>
      <p>
        Windows saved before these rules that break one still run as they are. The settings show
        what is wrong, and the next change to the windows has to fix it. A window can't be removed
        when it is the last one.
      </p>
    </section>

    <section>
      <h3>Example: morning, evening and once more</h3>
      <p>Bathroom floor heating, with Limit runs on, 3 runs per day and three windows:</p>
      <ul>
        <li>06:00 to 08:00, run for 45 min, max price 25</li>
        <li>19:00 to 22:00, run for 1 h, max price 15, cheap price 3</li>
        <li>00:00 to 23:59, run for 15 min, max price 15</li>
      </ul>
      <ol>
        <li>
          06:00 to 08:00 is the narrowest window, so it goes first: the cheapest 45 unbroken minutes
          between 06:00 and 08:00, as long as no slot costs more than 25 c/kWh.
        </li>
        <li>
          19:00 to 22:00 goes next: its cheapest unbroken hour at no more than 15 c/kWh. A slot
          right next to that hour at 3 c/kWh or less runs too.
        </li>
        <li>
          The whole-day window takes the third run: its cheapest 15 minutes anywhere in the day at
          no more than 15 c/kWh. If that slot sits right next to the morning or evening run, it
          lengthens that run instead.
        </li>
        <li>
          On a day when nothing outside the morning costs 15 c/kWh or less, only the morning run
          happens: its window allows up to 25.
        </li>
        <li>
          Your overrides go on top: click a 12:00 slot to run it anyway, or a picked 20:00 slot to
          skip it. If a later change makes auto mode pick 12:00 or drop 20:00 by itself, the
          override is no longer needed and is removed.
        </li>
        <li>
          Give the whole-day window Run for 1 h and a min run of 1 h and it runs a whole hour in one
          go rather than four scattered slots: its cheapest unbroken hour at no more than 15 c/kWh,
          or slots that lengthen the morning or evening run when those are cheaper.
        </li>
      </ol>
      <p>
        Add a stop sensor that turns on when the bathroom passes 26 °C. If that happens at 06:30
        during the morning run, the target goes off at once and stays off until the bathroom cools
        and the sensor turns off. The time lost isn't made up later.
      </p>
    </section>

    <section>
      <h3>Example: one evening run, and up to two more</h3>
      <p>Limit runs on, 3 runs per day and two windows:</p>
      <ul>
        <li>20:00 to 00:00, run for 1 h</li>
        <li>00:00 to 23:59, run for 1.5 h</li>
      </ul>
      <ol>
        <li>
          The evening window is the narrower one, so its cheapest hour between 20:00 and midnight is
          picked first, as one run.
        </li>
        <li>
          That leaves two runs for the whole-day window. Its 1.5 hours go to the cheapest slots in
          at most two stretches: two short runs, one longer run, or added onto the evening run.
        </li>
        <li>
          Two more runs is the most it makes, not a promise. For exactly two more, use two windows
          instead, such as 00:00 to 12:00 and 12:00 to 20:00. To keep them out of the evening, end
          the whole-day window at 20:00.
        </li>
      </ol>
    </section>

    <section>
      <h3>Example: a set time, plus every cheap slot</h3>
      <p>Two windows:</p>
      <ul>
        <li>17:00 to 23:00, run for 2 h</li>
        <li>00:00 to 23:59, run for 0 h, cheap price 3</li>
      </ul>
      <p>
        The target runs in the two cheapest hours between 17:00 and 23:00, and in every slot of the
        day at 3 c/kWh or less. With Limit runs on, those cheap slots only run when they lengthen
        the evening run.
      </p>
    </section>

    <section>
      <h3>Coming from an older version</h3>
      <p>
        Auto mode used to have a single hours per day setting, max price and cheap price for the
        whole day, an hour range and cheap price all day. Updating the integration turned them into
        windows that pick exactly the same slots:
      </p>
      <ul>
        <li>Without an hour range: one window, 00:00 to 23:59, with the same hours and prices.</li>
        <li>
          With an hour range: one window over the range. With cheap price all day on too, a second
          window, 00:00 to 23:59 for 0 hours with the same prices, keeps the cheap slots outside the
          range running.
        </li>
      </ul>
    </section>
  `;
}

/** Auto mode of an integration from before time windows. */
function renderDailyAuto(): TemplateResult {
  return html`
    <section>
      <h3>Auto mode</h3>
      <p>
        The chip in the header turns auto mode on or off and shows its hours per day, plus the hour
        range and run limit when they are on. The gear opens its settings. Changes take effect at
        once.
      </p>
      <ul>
        <li>
          <strong>Hours per day</strong>: each day, midnight to midnight, runs in its cheapest slots
          adding up to this many hours. A tie goes to the earlier slot.
        </li>
        <li>
          <strong>Max price</strong>: a picked slot above this price doesn't run, so on an expensive
          day the target can run less than its hours. 0 turns it off.
        </li>
        <li>
          <strong>Cheap price</strong>: every slot at or below this price runs, even past the hours.
          0 turns it off.
        </li>
        <li>
          A day is only picked once every one of its slots has a price. Until then, for example
          tomorrow before Nord Pool publishes, its slots follow the default state.
        </li>
      </ul>
    </section>

    <section>
      <h3>Hour range</h3>
      <p>
        With <strong>Hour range</strong> on, auto mode only picks slots between From and To, and
        every slot outside them is off, whatever the default state.
      </p>
      <ul>
        <li>
          A To before From wraps past midnight, but each day is still picked on its own: 22:00 to
          06:00 covers that day's 00:00–06:00 and 22:00–midnight.
        </li>
        <li>From equal to To covers the whole day.</li>
        <li>
          <strong>Cheap price all day</strong> lets slots at or below the cheap price run outside
          the range too. Without it, cheap slots outside the range stay off.
        </li>
        <li>Slots outside the range are off even before their day has prices.</li>
      </ul>
    </section>

    <section>
      <h3>Run limit</h3>
      <p>
        With <strong>Limit runs</strong> on, the hours run in at most <strong>Runs per day</strong>
        stretches of back-to-back slots, the cheapest such stretches of the day. At 1, two hours run
        as one unbroken two-hour run. Use it for a target like a boiler that shouldn't start often.
      </p>
      <ul>
        <li>
          A run never spans a slot above the max price, so the target can run less than its hours.
        </li>
        <li>
          A slot at or below the cheap price only runs when it lengthens one of these runs, never as
          a run of its own.
        </li>
        <li>
          Each day counts its runs on its own, so an hour range that wraps past midnight is two
          stretches of the same day.
        </li>
      </ul>
    </section>

    <section>
      <h3>How the auto settings combine</h3>
      <p>
        Take 2 hours per day, a max price of 15, a cheap price of 3 and an hour range of 17:00 to
        23:00:
      </p>
      <ol>
        <li>Auto mode takes the 8 cheapest slots between 17:00 and 23:00.</li>
        <li>Any of those above 15 c/kWh are dropped.</li>
        <li>Any other slot between 17:00 and 23:00 at 3 c/kWh or less is added.</li>
        <li>
          Everything outside 17:00–23:00 is off, even a 1 c/kWh slot at 03:00, unless Cheap price
          all day is on, which runs that slot too.
        </li>
        <li>
          Your overrides go on top: click a 12:00 slot to run it anyway, or a picked 18:00 slot to
          skip it. If a later change makes auto mode pick 12:00 or drop 18:00 by itself, the
          override is no longer needed and is removed.
        </li>
      </ol>
      <p>
        Add a run limit of 1 and the 8 slots must be back to back: the cheapest unbroken two hours
        between 17:00 and 23:00 with no slot above 15 c/kWh. A 3 c/kWh slot then only runs if it
        joins onto that run.
      </p>
      <p>
        Add a stop sensor that turns on when the bathroom passes 26 °C. If that happens at 18:30
        during the run, the target goes off at once and stays off until the bathroom cools and the
        sensor turns off, even through a 22:00 slot you clicked to run. The time lost isn't made up
        later.
      </p>
    </section>
  `;
}

function renderPricesOnly(): TemplateResult {
  return html`<section>
    <h3>Prices only</h3>
    <p>
      This card shows a <strong>Prices only</strong> entry, which controls no entity. Slots can't be
      clicked, and auto mode, the override count and the history bar are hidden. Point the card at a
      scheduler's price sensor to schedule something.
    </p>
    <p>
      Green slots are cheap, yellow middling and red expensive, relative to that day's own price
      range. Tomorrow shows a placeholder until Nord Pool publishes its prices, usually early
      afternoon CET.
    </p>
  </section>`;
}

function renderNumbers(pricesOnly: boolean): TemplateResult {
  return html`<section>
    <h3>The numbers above the grid</h3>
    <ul>
      <li>
        Prices are in cents per kWh of your Nord Pool currency, VAT included. Areas still on hourly
        prices show each hour's price in all four of its slots.
      </li>
      <li>
        <strong>Current</strong> is this slot's price. <strong>Min</strong>,
        <strong>Avg</strong> and <strong>Max</strong> are today's.
      </li>
      ${pricesOnly
        ? html`<li>
            <strong>Average price</strong> is the plain average price so far today, this week, this
            month and this year. Weeks start on Monday.
          </li>`
        : html`<li>
              <strong>Auto / Manual</strong> counts the auto picks still to come and your overrides,
              while auto mode is on. With it off, <strong>Overrides</strong> counts your overrides
              alone.
            </li>
            <li>
              <strong>Average price while on</strong> is what the target's running time has cost per
              kWh so far today, this week, this month and this year, with how long it ran. Each
              slot's price counts for as long as the target was on in it, whoever turned it on.
              Weeks start on Monday.
            </li>
            <li>
              <strong>Last 24h</strong> shows when the target was on (green) and off (grey), from
              Home Assistant's history.
            </li>`}
    </ul>
  </section>`;
}

function onOff(value: boolean | undefined): string {
  return value ? 'On' : 'Off';
}

function renderCardOptions(
  config: NordpoolSchedulerCardConfig,
  pricesOnly: boolean
): TemplateResult {
  const density = { normal: 'Normal', compact: 'Compact', super_compact: 'Super compact' }[
    config.density ?? 'normal'
  ];
  const hidden = config.hide_averages ?? [];
  return html`<section>
    <h3>Card options</h3>
    <p>
      Set in the card editor. They only change how this card looks. An option the card doesn't
      accept, such as an unknown density, shows an error in place of the card.
    </p>
    <ul>
      <li>
        <strong>Density</strong>: Compact makes slots short, Super compact also fits eight slots per
        row and drops the price unit.
      </li>
      <li><strong>Day tabs</strong>: Today and Tomorrow as tabs instead of stacked.</li>
      <li>
        <strong>Hide past slots</strong>: leaves out today's rows that have fully passed, so each
        row still starts on the hour.
      </li>
      <li><strong>Hide averages</strong>: leaves some of the average prices out.</li>
      ${pricesOnly ? nothing : html`<li><strong>Show history</strong>: the Last 24h bar.</li>`}
    </ul>
    <dl class="info-facts">
      ${fact('Density', density ?? 'Normal')} ${fact('Day tabs', onOff(config.show_day_tabs))}
      ${fact('Hide past slots', onOff(config.hide_past_slots))}
      ${fact(
        'Hidden averages',
        hidden.length ? hidden.map((w) => AVERAGE_LABELS[w] ?? w).join(', ') : 'None'
      )}
      ${pricesOnly ? nothing : fact('Show history', onOff(config.show_history))}
    </dl>
  </section>`;
}

function renderOtherInstance(pricesOnly: boolean): TemplateResult {
  return html`<section>
    <h3>${pricesOnly ? 'Prices from another instance' : 'A scheduler on another instance'}</h3>
    <p>
      The card can show an entry that runs on another Home Assistant instance, mirrored here with
      Remote Home-Assistant. Point the card at the mirrored <strong>Schedule</strong> sensor.
      ${pricesOnly
        ? nothing
        : html`Clicking a slot goes through Remote Home-Assistant's proxy for
            <code>nordpool_scheduler.set_slots</code>, and changing the time windows through its
            proxy for <code>nordpool_scheduler.set_auto_windows</code>. The auto mode and run limit
            controls need their switches and number mirrored too, and the history bar needs the
            target mirrored and recorded here.`}
    </p>
  </section>`;
}

import { html, nothing, type TemplateResult } from 'lit';

import type { NordpoolSchedulerCardConfig, ScheduleSnapshot } from './types';
import { AVERAGE_LABELS, formatPrice } from './format';
import { handIcon, robotIcon } from './icons';

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
    ${pricesOnly ? renderPricesOnly() : renderScheduling()} ${renderNumbers(pricesOnly)}
    ${renderCardOptions(ctx.config, pricesOnly)} ${renderOtherInstance(pricesOnly)}
  `;
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
  const hasRange = auto.window_enabled_entity !== undefined;
  const hasRunLimit = auto.runs_limited_entity !== undefined;
  const range =
    auto.window_start === auto.window_end
      ? 'On, whole day (From equals To)'
      : `On, ${auto.window_start}–${auto.window_end}`;
  return html`<section>
    <h3>This scheduler</h3>
    <dl class="info-facts">
      ${fact('Target', data.target_entity)}
      ${fact('Default state', data.default_state === 'on' ? 'On' : 'Off')}
      ${fact(
        'Manual toggles',
        data.control_mode === 'enforce'
          ? 'Enforce every 15 minutes'
          : 'Only act when the schedule changes'
      )}
      ${fact('Auto mode', auto.enabled ? `On, ${hours} h per day` : 'Off')}
      ${fact('Max price', limit(auto.max_price, locale))}
      ${fact('Cheap price', limit(auto.cheap_price, locale))}
      ${hasRange ? fact('Hour range', auto.window_enabled ? range : 'Off') : nothing}
      ${hasRange
        ? fact(
            'Cheap price all day',
            auto.window_enabled
              ? onOff(auto.cheap_all_day)
              : `${onOff(auto.cheap_all_day)}, applies once the hour range is on`
          )
        : nothing}
      ${hasRunLimit
        ? fact('Run limit', auto.runs_limited ? `On, ${auto.max_runs ?? 1} per day` : 'Off')
        : nothing}
      ${fact('VAT', vat)} ${mirrored ? fact('Runs on', 'Another Home Assistant instance') : nothing}
    </dl>
  </section>`;
}

function renderScheduling(): TemplateResult {
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
          slot.
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
          The current slot has an inner ring. Past slots are faded and can't be clicked. Tomorrow
          shows a placeholder until Nord Pool publishes its prices, usually early afternoon CET.
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
    </section>

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
          skip it.
        </li>
      </ol>
      <p>
        Add a run limit of 1 and the 8 slots must be back to back: the cheapest unbroken two hours
        between 17:00 and 23:00 with no slot above 15 c/kWh. A 3 c/kWh slot then only runs if it
        joins onto that run.
      </p>
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
    <p>Set in the card editor. They only change how this card looks.</p>
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
            <code>nordpool_scheduler.set_slots</code>. The auto mode controls need its switches,
            numbers and times mirrored too, and the history bar needs the target mirrored and
            recorded here.`}
    </p>
  </section>`;
}

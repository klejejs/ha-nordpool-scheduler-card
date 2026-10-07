# Nordpool Scheduler Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories/)
[![GitHub Release](https://img.shields.io/github/v/release/klejejs/ha-nordpool-scheduler-card)](https://github.com/klejejs/ha-nordpool-scheduler-card/releases)
[![CI](https://github.com/klejejs/ha-nordpool-scheduler-card/actions/workflows/ci.yml/badge.svg)](https://github.com/klejejs/ha-nordpool-scheduler-card/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/klejejs/ha-nordpool-scheduler-card)](LICENSE)

A Lovelace card for the [Nordpool Scheduler](https://github.com/klejejs/ha-nordpool-scheduler-integration) integration. Shows Nord Pool prices in 15-minute slots, shows and controls the scheduler's auto mode, and lets you click a slot to override it.

![The card showing tomorrow's slots, with cheap slots in green and a run of slots scheduled on](docs/screenshot.png)

## Prerequisites

The [Nordpool Scheduler](https://github.com/klejejs/ha-nordpool-scheduler-integration) integration, set up with a scheduler entry. This card reads and writes through it — it doesn't talk to Nord Pool directly.

## Installation

### HACS

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=klejejs&repository=ha-nordpool-scheduler-card&category=plugin)

Or by hand:

1. HACS → the three-dot menu → **Custom repositories**
2. Add `https://github.com/klejejs/ha-nordpool-scheduler-card` with the category **Dashboard**
3. Install **Nordpool Scheduler Card**. HACS adds the dashboard resource for you.

### Manual

1. Download `nordpool-scheduler-card.js` from the latest release
2. Copy it to `config/www/nordpool-scheduler-card.js`
3. Settings → Dashboards → Resources → add `/local/nordpool-scheduler-card.js` as a JavaScript module

## Configuration

Add the card through the dashboard editor (search "Nordpool Scheduler"), or in YAML:

```yaml
type: custom:nordpool-scheduler-card
entity: sensor.nordpool_scheduler_boiler_electricity_price
name: Boiler # optional, defaults to the entity's name
show_name: true
show_history: true
show_day_tabs: false
history_entity: binary_sensor.nordpool_scheduler_boiler_scheduled_on # optional
```

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | required | The scheduler's electricity price sensor |
| `name` | string | entity name | Card title |
| `show_name` | boolean | `true` | Show the card title |
| `show_history` | boolean | `true` | Show a 24h on/off history bar |
| `show_day_tabs` | boolean | `false` | Today/Tomorrow tabs instead of stacked sections |
| `history_entity` | string | the scheduler's target entity | Entity the history bar tracks |

## Usage

Prices are shown in cents/kWh, VAT included.

### Auto mode

The chip in the header shows whether the scheduler's auto mode is on: blue with the hours per day when it is, grey "Auto off" when it isn't. Click it to turn auto mode on or off. The gear next to it opens a settings row with the same toggle and auto mode's hours per day, max price and cheap price. A price of 0 turns that limit off. Changes take effect at once.

### Slots

The border shows what the slot will actually do: a thick blue border means the entity runs.

- A robot in the top-left corner marks a slot auto mode picked. It is only shown while auto mode is on.
- An orange hand in the top-right corner and a dashed border mark your own override. An override that runs the entity has an orange border.
- A faded robot next to the hand is an auto pick you overrode off.

Click a slot to override it to the opposite of what auto mode or the default state wants. Click an overridden slot to remove the override, and the slot follows auto mode or the default again.

The info bar counts the upcoming auto picks and your overrides while auto mode is on, and your overrides alone while it is off.

Colors are relative to that day's own price range: green is cheap, red is expensive. A day with no published prices yet shows a placeholder instead of an empty grid.

## Development

```bash
yarn install
yarn build       # dist/nordpool-scheduler-card.js
yarn start       # rollup --watch, served on :5005
yarn lint        # eslint + tsc --noEmit
yarn format
```

Point a dashboard's Lovelace resource at `http://<dev-machine>:5005/nordpool-scheduler-card.js` while `yarn start` is running to iterate against a real Home Assistant instance.

## Releasing

Releases are made only through GitHub Releases. Pushing a tag on its own builds nothing.

Release Drafter keeps a draft release up to date on every merge to `main`. Its tag is the next minor version, or the next major one if a merged PR carries the `major` label. Its notes are grouped by PR label: `dependencies` (Renovate branches), `bug` (titles starting with "Fix") and `feature` (everything else). The labels are applied automatically when a PR opens, so relabel a PR before merging if it guessed wrong.

To release, publish that draft from the GitHub UI. If it should be a different version, change the tag, the release title and the "Full Changelog" link at the bottom of the notes together. The draft only fills them in once, so editing the tag alone leaves the other two pointing at the old version. The first release has no earlier one to count from, so set its version by hand.

Publishing runs the release workflow, which builds the card with the release's tag as its version and attaches `nordpool-scheduler-card.js` to the release. The card logs the version to the browser console. The version isn't stored anywhere in the code.

## License

MIT — see LICENSE.

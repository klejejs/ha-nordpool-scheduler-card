# Nordpool Scheduler Card

A Lovelace card for the [Nordpool Scheduler](https://github.com/klejejs/ha-nordpool-scheduler-integration) integration. Shows Nord Pool prices in 15-minute slots and lets you click a slot to turn the scheduled entity on or off for that slot.

## Installation

### HACS

1. HACS → Frontend → the three-dot menu → Custom repositories
2. Add this repository as a Lovelace/Dashboard resource
3. Install "Nordpool Scheduler Card"

### Manual

1. Download `nordpool-scheduler-card.js` from the latest release
2. Copy it to `config/www/nordpool-scheduler-card.js`
3. Settings → Dashboards → Resources → add `/local/nordpool-scheduler-card.js` as a JavaScript module

## Prerequisites

The [Nordpool Scheduler](https://github.com/klejejs/ha-nordpool-scheduler-integration) integration, set up with a scheduler entry. This card reads and writes through it — it doesn't talk to Nord Pool directly.

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
price_unit: cents # "cents" or "currency"
```

| Option | Type | Default | Description |
|---|---|---|---|
| `entity` | string | required | The scheduler's electricity price sensor |
| `name` | string | entity name | Card title |
| `show_name` | boolean | `true` | Show the card title |
| `show_history` | boolean | `true` | Show a 24h on/off history bar |
| `show_day_tabs` | boolean | `false` | Today/Tomorrow tabs instead of stacked sections |
| `history_entity` | string | the scheduler's target entity | Entity the history bar tracks |
| `price_unit` | string | `cents` | Show prices as cents or in the source currency |

## Usage

Click a slot to schedule the entity on for it; click an on slot to turn it off; click it a third time to remove the override and fall back to the scheduler's default state. A dot marks a slot with an explicit override — the border shows the state (on or off) that will actually apply, whether it comes from an override or the default.

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

## License

MIT — see LICENSE.

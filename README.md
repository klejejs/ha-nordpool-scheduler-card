# Nordpool Scheduler Card

A beautiful and intuitive custom Lovelace card for Home Assistant that provides a visual interface for the Nordpool Scheduler integration. Schedule your devices based on electricity prices with 15-minute precision.

![Nordpool Scheduler Card](https://via.placeholder.com/800x400.png?text=Nordpool+Scheduler+Card)

## Features

- **Visual Time Slot Selection**: 96 buttons representing 24 hours in 15-minute intervals
- **Price-Based Color Coding**: Instantly see which times have the lowest/highest electricity prices
  - 🟢 Green: Lowest prices
  - 🟡 Yellow: Below average
  - 🟠 Orange: Above average
  - 🔴 Red: Highest prices
  - 🔵 Blue: Selected/Scheduled
- **Real-time Updates**: Shows current time slot with bold border
- **Tomorrow's Prices**: Automatically displays tomorrow's prices when available (with indicator dot)
- **Price Statistics**: View min, max, avg, and current prices at a glance
- **Mushroom-Inspired Design**: Beautiful, modern UI following Mushroom card design patterns
- **Compact View**: Optional compact layout for space-constrained dashboards
- **Easy Configuration**: Visual editor with entity picker

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to "Frontend"
3. Click the three dots in the top right
4. Select "Custom repositories"
5. Add this repository URL
6. Install "Nordpool Scheduler Card"
7. Restart Home Assistant

### Manual Installation

1. Download the `nordpool-scheduler-card.js` file from the latest release
2. Copy it to `config/www/nordpool-scheduler-card/nordpool-scheduler-card.js`
3. Add the resource in Home Assistant:
   - Go to Settings → Dashboards → Resources
   - Click "Add Resource"
   - URL: `/local/nordpool-scheduler-card/nordpool-scheduler-card.js`
   - Resource type: JavaScript Module

## Prerequisites

This card requires the **Nordpool Scheduler** integration to be installed and configured. The integration provides:
- Price sensor with 24-48 hours of electricity prices
- Scheduling service that controls your switches/devices
- Automated execution at scheduled times

## Configuration

### Using the Visual Editor

1. Add a new card to your dashboard
2. Search for "Nordpool Scheduler Card"
3. Select your Nordpool Scheduler entity
4. Customize the options as needed

### YAML Configuration

```yaml
type: custom:nordpool-scheduler-card
entity: sensor.nordpool_scheduler_electricity_price
name: My Scheduler  # Optional
show_name: true  # Optional, default: true
show_prices: true  # Optional, default: true
compact_view: false  # Optional, default: false
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **Required** | The Nordpool Scheduler sensor entity |
| `name` | string | Optional | Custom name for the card |
| `show_name` | boolean | `true` | Show/hide the card title |
| `show_prices` | boolean | `true` | Show/hide prices on time slots |
| `compact_view` | boolean | `false` | Enable compact layout with smaller spacing |

## Usage

### Scheduling Time Slots

1. **Click on any time slot** to schedule it
2. **Click again** to unschedule
3. Selected slots will turn blue
4. The integration will automatically turn on your device at scheduled times

### Understanding the Interface

- **Bold Border**: Current time slot
- **Blue Background**: Scheduled/selected time
- **Faded Appearance**: Past time slots
- **Small Dot**: Tomorrow's time slot
- **Color Intensity**: Price level (green=cheap, red=expensive)

### Info Bar

At the bottom of the card, you'll see:
- **Current**: Current electricity price
- **Min**: Lowest price available
- **Avg**: Average price
- **Max**: Highest price available
- **Scheduled**: Number of scheduled time slots

## Development

### Setup Development Environment

The project includes a devcontainer for easy development:

1. Install Docker and VS Code with Dev Containers extension
2. Open the project in VS Code
3. Click "Reopen in Container" when prompted (or use Command Palette: "Dev Containers: Reopen in Container")
4. Wait for the container to build and dependencies to install
5. Start development with `yarn start`

The development server will be available at http://localhost:5000

### Building the Card

```bash
# Install dependencies
yarn install

# Development mode (with auto-reload)
yarn start

# Production build
yarn build

# Lint
yarn lint

# Format code
yarn format
```

### Testing with Home Assistant

#### Option 1: Use the development server (recommended for quick testing)
1. Run `yarn start` to start the dev server on port 5000
2. In your HA configuration, add the resource pointing to your dev machine:
   ```yaml
   lovelace:
     resources:
       - url: http://YOUR_DEV_MACHINE_IP:5000/nordpool-scheduler-card.js
         type: module
   ```
3. Changes will auto-reload

#### Option 2: Copy built files to Home Assistant
1. Build the card with `yarn build`
2. Copy `dist/nordpool-scheduler-card.js` to your HA's `www` folder:
   ```bash
   # Example if HA runs on another machine
   scp dist/nordpool-scheduler-card.js user@homeassistant:/config/www/
   ```
3. Add the resource in HA (Settings → Dashboards → Resources):
   - URL: `/local/nordpool-scheduler-card.js`
   - Type: JavaScript Module

#### Option 3: Use with HACS (for production)
Install via HACS as described in the Installation section above.

### Project Structure

```
.
├── .devcontainer/          # Development container configuration
├── component/              # Backend integration (read-only)
│   └── custom_components/
│       └── nordpool_scheduler/
├── src/                    # Frontend card source
│   ├── nordpool-scheduler-card.ts
│   ├── nordpool-scheduler-card-editor.ts
│   ├── types.ts
│   ├── utils.ts
│   └── styles.ts
├── dist/                   # Built files
└── package.json
```

## Inspiration

This card is inspired by the excellent [Mushroom Cards](https://github.com/piitaya/lovelace-mushroom) by @piitaya. The design follows Mushroom's clean, modern aesthetic and interaction patterns.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Support

If you find this card helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting issues
- 💡 Suggesting new features
- 🔀 Contributing code

## Changelog

### v1.0.0
- Initial release
- 96 time slots with 15-minute precision
- Price-based color coding
- Visual editor
- Compact view option
- Real-time updates

## Credits

- Mushroom Cards design inspiration by @piitaya
- Home Assistant community for the amazing platform

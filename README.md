# Plantain

Homebridge plugin for VH400 soil moisture sensors via VegeHub WiFi hub.

Exposes your plant's moisture level to Apple HomeKit as:
- **Humidity Sensor** - displays moisture percentage (VWC)
- **Contact Sensor** - triggers native iOS notifications when moisture drops below threshold

## Installation

```bash
npm install -g homebridge-plantain
```

Or install via Homebridge Config UI X.

## Configuration

Add to your Homebridge `config.json`:

```json
{
  "accessory": "Plantain",
  "name": "Fiddle Leaf Fig",
  "ip": "192.168.1.100",
  "channel": 1,
  "pollInterval": 60,
  "lowThreshold": 30
}
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `name` | Yes | - | Name shown in HomeKit |
| `ip` | Yes | - | VegeHub IP address |
| `channel` | No | 1 | VegeHub channel (1-4) |
| `pollInterval` | No | 60 | Seconds between polling |
| `lowThreshold` | No | 30 | VWC % below which contact sensor triggers |

## Notifications

To receive notifications when your plant needs water:

1. Open Apple Home app
2. Long-press the contact sensor accessory
3. Tap the gear icon
4. Enable "Notifications" → "When opened"

You'll get native iOS push notifications when moisture drops below your threshold.

## VH400 Conversion

Uses the official [VH400 piecewise curve](https://www.vegetronix.com/Products/VH400/VH400-Piecewise-Curve) to convert voltage to Volumetric Water Content (VWC).

## Hardware

- [VH400 Soil Moisture Sensor](https://www.vegetronix.com/Products/VH400/)
- [VegeHub WiFi Hub](https://www.vegetronix.com/Products/VG-HUB/)

## License

MIT

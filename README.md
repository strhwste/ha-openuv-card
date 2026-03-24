# UV Dashboard Card

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=strhwste&repository=ha-openuv-card&category=plugin)

A minimalist HACS-ready Lovelace card for Home Assistant 2026.3 that presents UV index, ozone, skin-type protection times, SPF recommendations, and sun protection guidance for a wall-mounted display.

![UV Dashboard Card Preview](https://github.com/user-attachments/assets/4f7a3500-b4d9-441e-9930-e32ce99e8b01)

<a href="https://buymeacoffee.com/strhwste" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>


## Installation

1. Add this repository to HACS as a **Dashboard** repository, or copy `uv-dashboard-card.js` to `/config/www/`.
2. Add the resource in Home Assistant:

   ```yaml
   lovelace:
     resources:
       - url: /local/uv-dashboard-card.js
         type: module
   ```

3. Add the card to a dashboard:

   ```yaml
   type: custom:uv-dashboard-card
   title: UV & Sun Protection
   language: auto
   ```

## Features

- **Automatic entity detection** – the card finds your OpenUV integration entities automatically (English & German entity names supported, including prefixed names like `sensor.openuv_*`)
- **Custom UV sensor** – optionally use your own hardware UV sensor for the current UV reading
- **SPF recommendations** – per-skin-type SPF guidance that adapts to the current UV level, with reapply reminders
- German and English UI built in
- Visual editor with entity pickers and custom UV sensor configuration
- Theme-aware styling using Home Assistant CSS variables
- Graceful handling for unavailable sensor values
- HACS discovery metadata via `window.customCards`

## Configuration

### Minimal (auto-detect everything)

```yaml
type: custom:uv-dashboard-card
```

### With a custom UV sensor

```yaml
type: custom:uv-dashboard-card
title: UV & Sun Protection
language: auto
custom_uv_sensor: sensor.my_personal_uv_sensor
```

### With manual entity overrides

If auto-detection does not find your entities, you can map them manually. Only specify the entities you need to override; the rest will still be auto-detected.

```yaml
type: custom:uv-dashboard-card
entities:
  current_uv: sensor.openuv_current_uv_index
  max_uv: sensor.openuv_max_uv_index
  uv_level: sensor.openuv_current_uv_level
  ozone: sensor.openuv_current_ozone_level
  protection_window: binary_sensor.openuv_protection_window
  skin_type_1: sensor.openuv_skin_type_1_safe_exposure_time
  skin_type_2: sensor.openuv_skin_type_2_safe_exposure_time
  skin_type_3: sensor.openuv_skin_type_3_safe_exposure_time
  skin_type_4: sensor.openuv_skin_type_4_safe_exposure_time
  skin_type_5: sensor.openuv_skin_type_5_safe_exposure_time
  skin_type_6: sensor.openuv_skin_type_6_safe_exposure_time
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | string | (auto from language) | Card title |
| `language` | `auto` / `de` / `en` | `auto` | UI language |
| `custom_uv_sensor` | string | – | Optional entity ID of a personal UV sensor for the current UV reading |
| `entities` | object | – | Manual entity mapping (see above). Unset roles use auto-detection |

## Entity auto-detection

The card scans your Home Assistant entities and automatically matches them by name. The following patterns are recognised:

| Role | Example entity IDs |
|---|---|
| Current UV index | `sensor.current_uv_index`, `sensor.openuv_current_uv_index`, `sensor.aktueller_uv_index` |
| Max UV index | `sensor.max_uv_index`, `sensor.openuv_max_uv_index`, `sensor.maximaler_uv_index` |
| UV level | `sensor.current_uv_level`, `sensor.aktueller_uv_wert` |
| Ozone | `sensor.current_ozone_level`, `sensor.aktueller_ozonwert` |
| Protection window | `binary_sensor.protection_window`, `sensor.schutzfenster` |
| Skin types 1–6 | `sensor.skin_type_N_safe_exposure_time`, `sensor.hauttyp_N_eigenschutzzeit` |

If auto-detection picks the wrong entity, override it using the visual editor or the `entities` config option.

# UV Dashboard Card

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=strhwste&repository=ha-openuv-card&category=plugin)

A minimalist HACS-ready Lovelace card for Home Assistant 2026.3 that presents UV index, ozone, skin-type protection times, and sun protection guidance for a wall-mounted display.

![UV Dashboard Card Preview](https://github.com/user-attachments/assets/4f7a3500-b4d9-441e-9930-e32ce99e8b01)

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
   title: UV & Sonnenschutz
   language: auto
   ```

## Features

- German and English UI built in
- Visual editor support for title and language
- Theme-aware styling using Home Assistant CSS variables
- Graceful handling for unavailable sensor values
- HACS discovery metadata via `window.customCards`

## Required entities

- `sensor.aktueller_ozonwert`
- `sensor.aktueller_uv_index`
- `sensor.aktueller_uv_wert`
- `sensor.maximaler_uv_index`
- `sensor.schutzfenster`
- `sensor.hauttyp_1_eigenschutzzeit`
- `sensor.hauttyp_2_eigenschutzzeit`
- `sensor.hauttyp_3_eigenschutzzeit`
- `sensor.hauttyp_4_eigenschutzzeit`
- `sensor.hauttyp_5_eigenschutzzeit`
- `sensor.hauttyp_6_eigenschutzzeit`

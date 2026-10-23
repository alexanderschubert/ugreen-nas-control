# UGREEN NAS Control

[![Release](https://img.shields.io/github/v/release/alexanderschubert/ugreen-nas-control?color=0078ff&label=release)](https://github.com/alexanderschubert/ugreen-nas-control/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/alexanderschubert/ugreen-nas-control/latest/total?color=00c853&label=downloads%20(latest))](https://github.com/alexanderschubert/ugreen-nas-control/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/alexanderschubert/ugreen-nas-control/fan.yml?branch=main&label=build)](https://github.com/alexanderschubert/ugreen-nas-control/actions/workflows/fan.yml)
[![Unraid](https://img.shields.io/badge/Unraid-7.0%2B-f15a2c)](https://unraid.net)
[![Model](https://img.shields.io/badge/model-DXP6800%20Pro%20%C2%B7%20DXP4800%20GT-0078ff)](#supported-model)
[![License: MIT](https://img.shields.io/github/license/alexanderschubert/ugreen-nas-control?color=lightgrey)](LICENSE)
[![Stars](https://img.shields.io/github/stars/alexanderschubert/ugreen-nas-control?style=flat&color=ffd60a)](https://github.com/alexanderschubert/ugreen-nas-control/stargazers)
[![Issues](https://img.shields.io/github/issues/alexanderschubert/ugreen-nas-control?color=ff8c00)](https://github.com/alexanderschubert/ugreen-nas-control/issues)

Unraid plugin **for the UGREEN DXP6800 Pro and DXP4800 GT**: system info, temperatures and fan control, like the
fan settings of UGOS.

- **System**: model, BIOS, CPU, memory, Unraid and kernel version, uptime
- **Temperatures**: CPU package and cores, mainboard, the fan controller's own sensors, every NVMe SSD,
  and every disk – read from Unraid, so sleeping disks are never woken up
- **Case view**: tiles for processor, memory, drives, NVMe and network; front with the six bays (disk, size,
  temperature, standby), rear with the LAN ports (link and speed), inside with the RAM slots, the two M.2 slots
  and the PCIe slot with the SSDs on its card
- **Fans**: live speed of the CPU fan and both case fans
- **Fan modes**: BIOS (no control), Quiet, Standard, Performance, Full speed, or your own curves;
  the CPU fan follows the CPU, the case fans the hottest disk or NVMe
- **Safety**: minimum speed, all fans at 100 % when the CPU or a disk gets too hot or the CPU temperature
  can't be read, an Unraid notification when a fan stops, and the BIOS values back when the plugin
  stops or is removed
- Dashboard tile, English and German interface

- **LEDs (optional)**: colour, effects, a status mode for disk activity and SMART warnings, night mode and a
  dashboard tile – a copy of [UGREEN LED Control](https://github.com/alexanderschubert/ugreen-led-control),
  **off until you switch it on** under *UGREEN NAS Control → LEDs*

## Supported model

Made for two models:

- **UGREEN DXP6800 Pro**: ITE IT8613E; CPU fan on header 2, case fans on headers 3 and 4
- **UGREEN DXP4800 GT**: ITE IT5571 embedded controller; CPU fan (fan1) and case fan (fan3), with rpm,
  manual speed and the curves; the CPU temperature comes from the AMD sensor (`k10temp`), the mainboard
  temperature from the controller

On any other model the plugin does not touch the fan
controller: it refuses to start and the settings page says so. System info and temperatures
still work, as they only read.

## Install

Unraid 7.0 or newer. In **Plugins → Install Plugin**:

```
https://raw.githubusercontent.com/alexanderschubert/ugreen-nas-control/main/plugin/ugreen-nas-control.plg
```

Settings: **Settings → UGREEN NAS Control**.

## How it works

Unraid's kernel has no driver for the IT8613E (the in-tree `it87` doesn't know it). The static Go tool
`ugreen-nas-fan` talks to the chip directly through `/dev/port`, the same way `sensors-detect` finds it:

- Super-I/O config ports `0x2e`/`0x2f` give the chip id (`0x8613`) and the base address of its
  environment controller (`0x0a30` on the DXP6800 Pro)
- fan speeds come from the tachometer counters, rpm = 1 350 000 / (2 × count)
- the BIOS leaves the PWM outputs in manual mode with a fixed duty cycle; the daemon changes that duty
  cycle every 2 seconds after the curves
- the first start after boot saves the BIOS values to `/var/run/ugreen-nas-control.bios`; stopping the
  daemon (also on update or removal) writes them back

On the DXP4800 GT there is no Super-I/O fan chip. The fans hang on the IT5571 embedded controller, which
the tool reaches through the standard ACPI EC ports `0x62` (data) and `0x66` (command/status), under the
same lock, with bounded waits and retries. CPU fan: mode register `0xb0`, duty `0xb1`, tachometer
`0x34`/`0x35`; case fan: `0xb4`, `0xb5`, `0x38`/`0x39`. Duty runs 0 to 198, the tachometer counter is the
rpm. Mode 0 is the controller's own curve, 1 is manual: stopping the daemon (also on update or removal) and
`restore` put the mode back to 0.

No kernel module, so Unraid updates don't break it.

| Path | What |
| --- | --- |
| `fan/` | Go tool: chip access, curves, sensors, daemon |
| `src/backend/ugreen-nas-ctl` | starts and stops the daemon |
| `src/web/` | settings page, dashboard tile, API |
| `led/` | copy of UGREEN LED Control: Go tool `i2c/`, backend and web under `src/` |
| `plugin/ugreen-nas-control.plg` | the Unraid plugin |

Settings are saved in `/boot/config/plugins/ugreen-nas-control/fan.cfg`.

## Command line

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl stop|start|status
```

## LEDs

The LED part is a copy of UGREEN LED Control (`led/`, the version is in `led/VERSION`) and talks to the LED
controller through `/dev/i2c-N` (on the DXP4800 GT through `/dev/mem`, no kernel module). It stays off until the switch under *UGREEN NAS Control → LEDs* is on, and then
adds *Settings → UGREEN LED Control* and its dashboard tile. It is only offered on the DXP6800 Pro and the DXP4800 GT, and not while
the standalone plugin *UGREEN LED Control*, the plugin *ugreenleds-driver* or the kernel module `led_ugreen` is
present, as they would write the same LEDs. If you used the standalone plugin, remove it first and switch the LEDs
on here; its settings are not carried over.

To take over a new version of the LED plugin:

```
LED_REPO=<url of that repository> scripts/sync-led.sh /path/to/ugreen-led-control v0.24.0
scripts/test-led-ctl.sh
```

`led/` is only ever the output of `scripts/sync-led.sh`, never edited by hand. `led/VERSION` records
`<describe> <commit> <repo url>` (`LED_REPO`, default `alexanderschubert/ugreen-led-control`).
`scripts/check-led.sh` fetches that commit, syncs it into a temporary directory and fails with the diff if
`led/` differs. CI runs it (`led-sync` job) whenever `led/`, `scripts/` or the workflow change.

## Development

The fan tool is built by CI (`Fan tool` workflow). For a test install on the NAS, put the CI artifact
at `build/ugreen-nas-fan` and run `scripts/install-dev.sh` (the LED tool, `build/ugreen-led-i2c`, is optional).

## Release

Raise `version` and add the changes in `plugin/ugreen-nas-control.plg`. After the merge to `main`
the `Tag release` workflow creates the tag `v<version>` and the release with the binary.

## License

[MIT](LICENSE)

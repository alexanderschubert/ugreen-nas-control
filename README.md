<p align="center"><img src="assets/icon.svg" alt="" width="112"></p>

# UGREEN NAS Control

[![Release](https://img.shields.io/github/v/release/alexanderschubert/ugreen-nas-control?color=0078ff&label=release)](https://github.com/alexanderschubert/ugreen-nas-control/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/alexanderschubert/ugreen-nas-control/latest/total?color=00c853&label=downloads%20(latest))](https://github.com/alexanderschubert/ugreen-nas-control/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/alexanderschubert/ugreen-nas-control/fan.yml?branch=main&label=build)](https://github.com/alexanderschubert/ugreen-nas-control/actions/workflows/fan.yml)
[![Unraid](https://img.shields.io/badge/Unraid-7.0%2B-f15a2c)](https://unraid.net)
[![Models](https://img.shields.io/badge/fans%20%C2%B7%20case-DXP6800%20Pro%20%C2%B7%20DXP4800%20GT-0078ff)](#supported-models)
[![LEDs](https://img.shields.io/badge/LEDs-all%20UGREEN%20DX%2FDXP-0078ff)](#supported-models)
[![License: MIT](https://img.shields.io/github/license/alexanderschubert/ugreen-nas-control?color=lightgrey)](LICENSE)
[![Stars](https://img.shields.io/github/stars/alexanderschubert/ugreen-nas-control?style=flat&color=ffd60a)](https://github.com/alexanderschubert/ugreen-nas-control/stargazers)
[![Unraid forum](https://img.shields.io/badge/support-Unraid%20forum-f15a2c)](https://forums.unraid.net/topic/201044-plugin-ugreen-nas-control-led-fan-and-system-control-for-ugreen-dxdxp-nas/)
[![Issues](https://img.shields.io/github/issues/alexanderschubert/ugreen-nas-control?color=ff8c00)](https://github.com/alexanderschubert/ugreen-nas-control/issues)

Unraid plugin for UGREEN DX/DXP NAS: **LED control on every model UGREEN LED Control knew**, and, for the
**DXP6800 Pro and DXP4800 GT**, fan control and a case view as well, like the fan settings of UGOS. The LED control
grew out of [UGREEN LED Control](https://github.com/alexanderschubert/ugreen-led-control).

- **System**: model, BIOS, CPU, memory, Unraid and kernel version, uptime
- **Temperatures**: CPU package and cores, mainboard, the fan controller's own sensors, every NVMe SSD,
  and every disk – read from Unraid, so sleeping disks are never woken up
- **Case view**: tiles for processor, memory, drives, NVMe and network; front with the bays (six on the DXP6800 Pro, four on the DXP4800 GT; disk, size,
  temperature, standby), rear with the LAN ports (link and speed), inside with the RAM slots, the two M.2 slots
  and the PCIe slot with the SSDs on its card (not on the DXP4800 GT)
- **Fans**: live speed of the CPU fan and both case fans
- **Fan modes**: BIOS (no control), Quiet, Standard, Performance, Full speed, or your own curves;
  the CPU fan follows the CPU, the case fans the hottest disk or NVMe
- **Safety**: minimum speed, all fans at 100 % when the CPU or a disk gets too hot or the CPU temperature
  can't be read, drives you choose that must not drive the case fans, an Unraid notification when a fan stops, and the BIOS values back when the plugin
  stops or is removed
- Dashboard tile, English, German and Spanish interface

- **LEDs (optional)**: colour, effects, a status mode for disk activity and SMART warnings, night mode and a
  dashboard tile, built in (it grew out of [UGREEN LED Control](https://github.com/alexanderschubert/ugreen-led-control)),
  **off until you switch it on** under *UGREEN NAS Control → LEDs*

## Supported models

Every UGREEN NASync model and what the plugin does for it (the same table is on the plugin's About page, with your model highlighted):

| Model | LEDs | Case view | Fan control |
| --- | --- | --- | --- |
| **DX series** | | | |
| DX4600 Pro | verified (miskcoo) | – | – |
| DX4700 / Plus | reported by users | – | – |
| **DXP series** | | | |
| DXP2800 | reported by users | front, rear | – |
| DXP2800 GT | untested | – | – |
| DXP480T Plus | power LED only | – | – |
| DXP4800 / Plus / Pro | confirmed | front, rear | – |
| DXP4800 GT | confirmed | front, rear, inside | yes |
| DXP6800 Pro | verified | front, rear, inside | yes |
| DXP6800 Ultra | untested | – | – |
| DXP8800 Plus | verified | front, rear | – |
| DXP8800 Ultra | untested | – | – |
| **iDX series** | | | |
| iDX6011 / iDX6011 Pro | untested | front, rear | – |
| **DH series** | | | |
| DH2300, DH4300 Plus | not offered (the LED part is enabled on DX, DXP and iDX only) | – | – |

Verified: tested by the author or by miskcoo. Confirmed or reported: users saw it on their device. Untested: the LEDs are enabled but the bay order is guessed. Fan control exists only where the wiring is known.

**Fans and case view** exist for two models, the only ones with known wiring:

- **UGREEN DXP6800 Pro**: ITE IT8613E; CPU fan on header 2, case fans on headers 3 and 4
- **UGREEN DXP4800 GT**: ITE IT5571 embedded controller; CPU fan (fan1) and case fan (fan3), with rpm,
  manual speed and the curves; the CPU temperature comes from the AMD sensor (`k10temp`), the mainboard
  temperature from the controller

The **case view** (front, rear, drives) also exists for the **DXP4800, DXP4800 Plus and DXP4800 Pro** (drawn after photos of the DXP4800 Plus) the **DXP8800 Plus** (front and rear as a row of ports, after the reviews' port lists), the **DXP2800** and the **iDX6011 / iDX6011 Pro** (both drawn after photos; the iDX with its display at the front); their M.2 slots are not mapped yet, so there is no inside view and no fan control. On any other model the plugin does not touch the fan controller (the fan group and the case view are not shown).
System info and temperatures still work, as they only read.

**LEDs** work on every UGREEN DX, DXP and iDX model that UGREEN LED Control knew; the controller is the same across
them. The bays are matched to the disks by SATA port, after
[miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller):

| Model | Bays → SATA ports | Status |
| --- | --- | --- |
| DXP6800 Pro | ata3, ata4, ata5, ata6, ata1, ata2 | verified |
| DXP8800 Plus | ata1 … ata8 | verified by miskcoo, confirmed by users |
| DXP4800 / Plus / Pro | ata1 … ata4 | confirmed by users |
| DXP4800 GT | ata1 … ata4 | confirmed (LED controller through `/dev/mem`) |
| DX4600 Pro | ata1 … ata4 | verified by miskcoo |
| DX4700, DXP2800 | ata1 … ataN | reported by users |
| DXP480T Plus | – | power LED only, confirmed by a user |
| iDX6011, iDX6011 Pro | bays 1–4 ASMedia, 5–6 chipset | **untested** (frames and LED numbers from reports of other plugins) |
| other UGREEN models | ata1 … ataN | **untested**, bay order guessed |

For a model marked untested the LEDs page says so; check with *Identify* that the right bay blinks and report
problems in the [issues](https://github.com/alexanderschubert/ugreen-nas-control/issues). Not supported: the DXP2800 V1.2 and
the other GT models, which miskcoo lists as experimental.

## Install

Unraid 7.0 or newer. In **Plugins → Install Plugin**:

```
https://raw.githubusercontent.com/alexanderschubert/ugreen-nas-control/main/plugin/ugreen-nas-control.plg
```

Settings: **Settings → UGREEN NAS Control**. The page has a sidebar; the page title and the controller chips at the top follow the entry you open:

| Group | Entry | What it has |
| --- | --- | --- |
| Cockpit | Overview | the front with the bays, fans and fan mode, processor, memory, network, all temperatures, LED summary |
| Cockpit | Case | drives in detail (with a link to the bay LEDs), rear, inside |
| Fans | Fan curves | the two curves; pick a preset or edit the points, then *Save* (an unsaved change is marked, *Discard* undoes it) |
| Fans | Safety | minimum speed, emergency limits, NVMe offset, fan-stopped notification; *Save* like the curves |
| LEDs | LED overview | the LED switch, mode, system and drive LEDs, preview (the other LED entries appear once it is on) |
| LEDs | Drive status, Night mode, Alerts & shutdown | bay assignment with *Identify* and status display; night mode; Unraid alerts and the shutdown signal |
| System | Settings | interface language and colour scheme |
| System | About | one System card (model, BIOS, CPU, memory, Unraid, kernel, uptime, the fan and LED controller), the plugin, links and thanks |

The fan mode on the Overview and everything on the LED pages apply at once; only the two fan pages save on request. The fan entries show on the two models with fan control only.

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
| `led/` | built-in LED control: Go tool `i2c/`, backend and web under `src/` |
| `plugin/ugreen-nas-control.plg` | the Unraid plugin |

Settings are saved in `/boot/config/plugins/ugreen-nas-control/fan.cfg`.

## Command line

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl stop|start|status
```

## LEDs

LED control is built in (`led/`: Go tool `i2c/`, backend and web under `src/`) and talks to the LED
controller through `/dev/i2c-N` (on the DXP4800 GT through `/dev/mem`, no kernel module). It replaces the standalone plugin
*UGREEN LED Control*. It stays off until the switch on *LEDs → LED overview* is on; then the
group **LEDs** of the sidebar also shows Drive status, Night mode and Alerts & shutdown, and the cockpit and the dashboard
tile show the colours of the LEDs live. LED overview has the mode, one card for the system LEDs and one for the drive LEDs
(colours, brightness, effects, single bays), a preview with Test and Reset, and the effect settings (speed, direction, only
when idle) once an animated effect is in use. LED control is offered on every UGREEN DX, DXP and iDX model (the product name starts with `DX`, `DXP` or `iDX`; see
[Supported models](#supported-models) for how far each is verified), and not while the plugin
*ugreenleds-driver* or the kernel module `led_ugreen` holds the controller. If the standalone plugin *UGREEN LED Control* is
installed too, both still run (the runtime files have their own names, the I2C bus lock is shared), but they write the same
LEDs and the last write wins: the page says so. Use one of them, best this one, and switch LED control off in the other or
remove it. **Take over its settings:** if the settings of the standalone plugin are found, the LEDs page offers *Take over the settings* (colours, effects, status mode, night mode; what this part had is kept as `leds.cfg.bak`), and the first time you switch LED control on without own settings they are taken over by themselves. Afterwards uninstall UGREEN LED Control under Plugins.

The LED code started as a copy of [UGREEN LED Control](https://github.com/alexanderschubert/ugreen-led-control) and is
maintained here now. `scripts/test-led-ctl.sh` checks the switch and conflict rules.

## Development

`scripts/harness/run.sh` starts a fake Unraid in Docker around the real plugin files: the real LED backend and `api.php` run against a stand-in for the LED chip, the NAS Control page is rendered with a fixed mock of the fan API (no hardware is touched). `run.sh sync` copies the repo files again after an edit.

The fan tool is built by CI (`Fan tool` workflow). For a test install on the NAS, put the CI artifact
at `build/ugreen-nas-fan` and run `scripts/install-dev.sh` (the LED tool, `build/ugreen-led-i2c`, is optional).

## Release

1. Raise `version` and add the changes in `plugin/ugreen-nas-control.plg`.
2. Update the MD5 of every download in the `.plg`: `python3 scripts/plg-hashes.py plugin/ugreen-nas-control.plg --binary ugreen-nas-fan=build/ugreen-nas-fan --binary ugreen-led-i2c=build/ugreen-led-i2c`. The files come from the working tree; the two binaries are the artifacts of the pull request's CI run (`Fan tool` workflow). Any change to a downloaded file changes its hash, so this is part of every pull request that touches `src/`, `led/` or `fan/`; CI fails on stale hashes (Unraid and Community Applications check them).
3. Merge to `main`. The `Tag release` workflow builds the binaries, checks the hashes, then creates the tag `v<version>` and the release with the binaries (an existing release asset is never replaced).

The plugin downloads its files from that tag and the binaries from the release. Wait for the workflow to finish (about a minute) before updating in Unraid; an update attempted earlier can leave GitHub caching a 404 for up to five minutes.

## Languages

The interface is available in German, English and Spanish (`src/web/js/i18n.js`, the LED pages in `led/src/web/js/i18n.js`). The Spanish texts of the LED part are ivolution's work from UGREEN LED Control; the Spanish texts of the rest were translated with Claude's help and would like a native speaker's review. To improve a language, translate only the values, keep `{placeholders}` and HTML tags as they are, and open a pull request or an issue. Missing texts show in English.

## Support

Questions and problems: the [support thread in the Unraid forum](https://forums.unraid.net/topic/201044-plugin-ugreen-nas-control-led-fan-and-system-control-for-ugreen-dxdxp-nas/). Bug reports and feature requests are also welcome as [GitHub issues](https://github.com/alexanderschubert/ugreen-nas-control/issues). Please include your NAS model, the Unraid and plugin versions and the output of:

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl status
```

## Community Applications

`ca_profile.xml` and `plugins/ugreen-nas-control.xml` are the Community Applications listing (author profile and plugin entry). The `<PluginURL>` in the listing must stay identical to the `pluginURL` of `plugin/ugreen-nas-control.plg`.

## Thanks

- [miskcoo](https://github.com/miskcoo/ugreen_leds_controller): the LED protocol and the bay mapping of the LED part
- [ivolution](https://github.com/ivolution): the Spanish translation of UGREEN LED Control, which the LED part and this plugin build on
- [j3n57h0m45](https://github.com/j3n57h0m45): the **DXP4800 GT** support: fan control through the IT5571 embedded controller, LEDs, the case view, the system view, light case pictures and the CI hardening
- everyone who tested on their model

## License

[MIT](LICENSE)

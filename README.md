# UGREEN NAS Control

Unraid plugin for UGREEN DXP NAS devices: system info, temperatures and fan control, like the
fan settings of UGOS.

- **System**: model, BIOS, CPU, memory, Unraid and kernel version, uptime
- **Temperatures**: CPU package and cores, mainboard, the fan controller's own sensors, every NVMe SSD,
  and every disk – read from Unraid, so sleeping disks are never woken up
- **Fans**: live speed of the CPU fan and both case fans
- **Fan modes**: BIOS (no control), Quiet, Standard, Performance, Full speed, or your own curves;
  the CPU fan follows the CPU, the case fans the hottest disk or NVMe
- **Safety**: minimum speed, all fans at 100 % when the CPU or a disk gets too hot or the CPU temperature
  can't be read, an Unraid notification when a fan stops, and the BIOS values back when the plugin
  stops or is removed
- Dashboard tile, English and German interface

The front LEDs are handled by the separate plugin
[UGREEN LED Control](https://github.com/alexanderschubert/ugreen-led-control).

## Supported models

| Model | Fan controller | Status |
| --- | --- | --- |
| DXP6800 Pro | ITE IT8613E | tested: CPU fan on header 2, case fans on headers 3 and 4 |

Other UGREEN models with an IT8613E are detected, but their fan headers may be wired differently.
Reports are welcome in the [issues](https://github.com/alexanderschubert/ugreen-nas-control/issues).

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

No kernel module, so Unraid updates don't break it.

| Path | What |
| --- | --- |
| `fan/` | Go tool: chip access, curves, sensors, daemon |
| `src/backend/ugreen-nas-ctl` | starts and stops the daemon |
| `src/web/` | settings page, dashboard tile, API |
| `plugin/ugreen-nas-control.plg` | the Unraid plugin |

Settings are saved in `/boot/config/plugins/ugreen-nas-control/fan.cfg`.

## Command line

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl stop|start|status
```

## Development

The fan tool is built by CI (`Fan tool` workflow). For a test install on the NAS, put the CI artifact
at `build/ugreen-nas-fan` and run `scripts/install-dev.sh`.

## Release

Raise `version` and add the changes in `plugin/ugreen-nas-control.plg`. After the merge to `main`
the `Tag release` workflow creates the tag `v<version>` and the release with the binary.

## License

[MIT](LICENSE)

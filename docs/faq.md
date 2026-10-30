# FAQ

## Features

- **Overview**: the NAS drawn with its bays, drive temperatures and live LED colours, fans and fan mode, CPU, memory, network.
- **Case view**: drives as cards, the rear with ports and LAN link speeds, and the inside (M.2, RAM, PCIe) on models where it is mapped. Dark and light.
- **Temperatures**: CPU, board, iGPU, fan controller, LAN chips, every NVMe SSD and disk. Read from Unraid, so sleeping disks stay asleep. Each sensor shows whether it steers the fans.
- **Fans** (DXP6800 Pro, DXP4800 GT): modes BIOS, Quiet, Standard, Performance, Full speed or your own curves; minimum speed; case fans can follow the CPU curve.
- **Fan measuring**: runs each fan from 10 to 100 % and records the rpm, so curves show real rpm. Takes minutes and is noisy; it aborts and returns the fans to 100 % when something gets too hot.
- **Safety**: all fans to 100 % when the CPU or a disk is too hot or the CPU temperature is unreadable, an NVMe limit with offset, drives excluded from fan control, a notification when a fan stops, BIOS values restored when the plugin stops. Fan control can be switched off in Settings.
- **LEDs** (off until you switch them on): colour, effects and brightness per LED, status mode for disk activity, errors and SMART warnings, network LED by link speed, night mode, Unraid alerts, shutdown signal.
- **Dashboard tile** with fans, temperatures, SSDs and live LEDs.
- Seven languages: English, German, Spanish, French, Italian, Dutch and Simplified Chinese (the last four machine-assisted); dark, light or "same as Unraid".

## Coming from UGREEN LED Control

This plugin replaces it. The LEDs page offers to take over its settings.

## Which models cannot run it

The DH2300 and DH4300 Plus use ARM chips (Rockchip) and cannot run Unraid, which needs a 64-bit x86 CPU. Only the x86 models are supported.

## Command line

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl status
```

Include their output in support requests, with the NAS model and the Unraid and plugin versions.

## Disclaimer

- Use at your own risk. The plugin writes to the fan controller (the embedded controller on the DXP4800 GT, the ITE IT8613E on the DXP6800 Pro) and controls the LEDs.
- Bad fan curves can let disks or the CPU run hot. Check temperatures after changing a curve; the emergency limit (all fans at 100 %) is a backstop, not a substitute.
- Not affiliated with or endorsed by UGREEN. Using it may affect the manufacturer's warranty.
- Provided as is, without warranty or liability.

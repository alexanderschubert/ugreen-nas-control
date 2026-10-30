# Related projects

As of 2026-10-29; re-check before relying on it.

Other community projects cover parts of what this plugin does. Stars, dates and licenses come from the GitHub API on that date; `?` means not verified.

## Projects

| Project                                                                                                   | Scope and hardware                                                                       | License                           | Activity                                      | Stars |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- | ----- |
| [FanCtrl Plus 2](https://github.com/andrebrait/fanctrlplus) (fork of ck9393)                              | Unraid fan control, any hwmon `pwm`, no UGREEN-specific data                             | GPL-2.0-only                      | 1.9.7, 2026-10-26                             | 9     |
| [FanCtrl Plus](https://github.com/ck9393/fanctrlplus)                                                     | Unraid fan control, any hwmon `pwm`                                                      | none stated                       | v1.3.3, 2025-10-07                            | 16    |
| [Dynamix Auto Fan Control](https://github.com/bergware/dynamix)                                           | Unraid, hottest disk to one hwmon fan                                                    | none stated                       | last change to `system-autofan` 2023-04-01    | 56    |
| [UGREEN-DXP-FAN-NAS-Driver](https://github.com/IT-Kuny/UGREEN-DXP-FAN-NAS-Driver)                         | it87 fan daemon: DXP2800/4800/8800, iDX6011 (Pro); README lists GT models as unsupported | GPL-3.0                           | v2.0.1, 2026-08-29                            | 31    |
| [ich777 it87-driver](https://github.com/ich777/unraid-it87-driver)                                        | Unraid it87 hwmon driver, no policy                                                      | MIT                               | 6.18.59-Unraid, 2026-10-27                    | 5     |
| [ich777 ugreenleds-driver](https://github.com/ich777/unraid-ugreenleds-driver) (forks by hanssep, guyp2k) | LEDs on DX4600, DX4700, DXP2800/4800/6800/8800, 480T; kernel module per Unraid release   | MIT                               | 6.18.47-Unraid, 2026-08-28; marked deprecated | 28    |
| [EllipticSet UGREEN-DXP4800Pro-LEDs](https://github.com/EllipticSet/UGREEN-DXP4800Pro-LEDs)               | LEDs, DXP4800 Pro only                                                                   | MIT (GPL-2.0 module in `vendor/`) | v1.6.1, 2026-10-26                            | 2     |
| [flybrys UGREEN-DXP4800GT-LED-Driver](https://github.com/flybrys/UGREEN-DXP4800GT-LED-Driver)             | LEDs, DXP4800 GT only                                                                    | MIT (GPL-2.0 module in `vendor/`) | v2026.09.25.5                                 | 1     |
| [noodlemctwoodle unraid-ugreen-idx6011-pro](https://github.com/noodlemctwoodle/unraid-ugreen-idx6011-pro) | iDX6011 Pro: touch LCD, LEDs, four fan curves                                            | MIT, with GPL-2.0 parts           | 2026.09.11.beta.14                            | 8     |
| [omgapuppy unraid-ugreen-idx6011-led-fan](https://github.com/omgapuppy/unraid-ugreen-idx6011-led-fan)     | iDX6011 / iDX6012: LEDs, read-only fan tach                                              | MIT                               | 2026.08.27.2                                  | 0     |
| [miskcoo ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller)                       | LED protocol, CLI, kernel module and services for Debian, TrueNAS, Proxmox               | MIT                               | v0.4-beta, 2026-07-07                         | 658   |
| [0x556c79 install_ugreen_leds_controller](https://github.com/0x556c79/install_ugreen_leds_controller)     | Installer for miskcoo's controller (TrueNAS/Proxmox side)                                | GPL-3.0                           | ?                                             | 109   |
| [andrewle8 ugreen-dxp4800-thermal-fix](https://github.com/andrewle8/ugreen-dxp4800-thermal-fix)           | Guide: BIOS SmartFan values, repaste, governor for DXP4800+                              | none stated                       | n/a                                           | 12    |

## Features

Columns: **US** this plugin; **FC2** FanCtrl Plus 2; **FC1** FanCtrl Plus; **DAF** Dynamix Auto Fan; **ITK** UGREEN-DXP-FAN-NAS-Driver; **KM** kernel-module LED plugins (ich777, hanssep, guyp2k); **EG** Elliptic and flybrys; **IDX** the two iDX6011 projects; **MSK** miskcoo. `y` yes, `n` no, `~` partial, `?` unverified, `-` not in scope.

| Feature                                                | US                         | FC2 | FC1 | DAF | ITK | KM  | EG  | IDX | MSK |
| ------------------------------------------------------ | -------------------------- | --- | --- | --- | --- | --- | --- | --- | --- |
| Multi-point fan curves                                 | y                          | n   | n   | n   | ~   | -   | -   | ~   | -   |
| Drives UGREEN fan chips without an extra kernel driver | y                          | n   | n   | n   | n   | -   | -   | y   | -   |
| Several fans with separate inputs                      | ~                          | y   | y   | y   | ~   | -   | -   | ~   | -   |
| Disk temperatures without waking disks                 | y                          | y   | y   | y   | ?   | -   | -   | ~   | -   |
| NVMe as fan input                                      | y                          | y   | y   | y   | ?   | -   | -   | n   | -   |
| GPU, HBA, NIC or custom script as fan input            | ~                          | y   | n   | n   | n   | -   | -   | n   | -   |
| Failsafe to 100 percent, BIOS values restored          | y                          | ~   | n   | n   | y   | -   | -   | y   | -   |
| Stall watchdog and notification                        | y                          | ~   | n   | n   | y   | -   | -   | y   | -   |
| Fan calibration (rpm per duty)                         | y                          | n   | n   | n   | n   | -   | -   | n   | -   |
| Fan speed history graph                                | n                          | y   | n   | n   | n   | -   | -   | ~   | -   |
| Fan settings export and import                         | ~                          | y   | n   | n   | ~   | n   | n   | n   | -   |
| Fan schedules, PID, mover or parity override           | n                          | n   | n   | n   | n   | -   | -   | n   | -   |
| Per-LED colour, brightness, effects                    | y                          | -   | -   | -   | -   | ~   | y   | y   | y   |
| Disk-activity LEDs                                     | y                          | -   | -   | -   | -   | y   | y   | y   | y   |
| SMART, standby and parity states on LEDs               | y                          | -   | -   | -   | -   | ~   | ~   | ~   | ~   |
| Network LED (speed, traffic, gateway)                  | y                          | -   | -   | -   | -   | y   | y   | ~   | y   |
| Night mode (LEDs)                                      | y                          | -   | -   | -   | -   | ~   | y   | ~   | n   |
| Identify a bay                                         | y                          | -   | -   | -   | -   | n   | y   | n   | ~   |
| LCD, touch screen, backlight                           | n                          | -   | -   | -   | -   | n   | n   | y   | n   |
| Dashboard tile on Unraid                               | y                          | y   | y   | n   | n   | n   | n   | y   | n   |
| Case view per model                                    | y                          | n   | n   | n   | n   | n   | ~   | y   | n   |
| No kernel module built per Unraid release              | y                          | y   | y   | y   | n   | n   | n   | n   | n   |
| Languages                                              | en, de, es, fr, it, nl, zh | n   | n   | n   | n   | n   | n   | n   | n   |
| CLI or API                                             | ~                          | n   | n   | n   | ~   | n   | ~   | n   | y   |
| In Community Apps                                      | not yet                    | ?   | y   | y   | n   | y   | ?   | ?   | n   |

## Running alongside other tools

Two programs that write the same fan or LED chip give no stable result. Which combinations reach the same hardware:

- **FanCtrl Plus (2) or Dynamix Auto Fan with an it87 hwmon driver** (the ich777 it87 plugin, or `ugreen-it87.plg`): they write `pwmN` through the kernel driver, this plugin writes the IT8613E registers through `/dev/port`. Both reach the same chip, so the speed alternates between two targets. Super-I/O index/data access (`0x2e`/`0x2f`) can also interleave with the kernel driver's own access.
- **UGREEN-DXP-FAN-NAS-Driver on a GT or iDX6011 Pro**: its it5571 backend uses the same EC as `backend/internal/fan/ec.go`.
- **Kernel-module LED plugins, the DXP4800 Pro / GT LED plugins, the iDX6011 plugins, or the standalone UGREEN LED Control**: all write the LED controller; the last write wins.
- FanCtrl Plus 2 states in its README that it does not run beside FanCtrl Plus for the same reason.

What this plugin does: `backend/internal/fan/conflict` detects these tools (running processes, installed plugins, loaded `it87` or `led_ugreen`, hwmon outputs in manual mode) and stops writing fan registers while a rival process runs. The page shows a banner naming the tool, with a switch to turn off this plugin's fan or LED control. It never edits or removes the other tool. Details: [architecture.md](architecture.md#rival-fan-and-led-tools).

## Licenses and reuse

| Project                                                                                        | License                | What may be reused                                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| miskcoo, ich777 drivers, Elliptic, flybrys (own parts), noodlemctwoodle (own parts), omgapuppy | MIT                    | Code, with the copyright and license notice kept (see [third-party.md](third-party.md)) |
| FanCtrl Plus 2, IT-Kuny, 0x556c79                                                              | GPL-2.0-only / GPL-3.0 | Facts only (register addresses, protocol layouts, file formats); no code                |
| `vendor/` kernel modules in Elliptic, flybrys; GPL parts of noodlemctwoodle                    | GPL-2.0                | Facts only                                                                              |
| FanCtrl Plus, Dynamix, andrewle8                                                               | none stated            | Facts only; no code (no license means all rights reserved)                              |

Facts such as addresses, formats and chip behaviour are not copyrightable; the entries below are re-derived from the hardware or from MIT code and credited.

## Hardware facts from other projects

Sources are file:line at the default-branch commit read on 2026-10-29.

| Fact                                                                                                                                                                            | Source                                                                                                                                      | Our code                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| DXP4800 GT LED MCU: DesignWare I2C adapter, address `0x3a`, register `0x5a` reads `0xc5b2`                                                                                      | flybrys `src/ugreen-gt-leds:69,79-80`@32c06cf                                                                                               | `backend/internal/led/chip/protocol.go:120-131`, `dwmem_linux.go:17-22`          |
| DXP4800 Pro LED MCU on the Intel I801 SMBus, same chip id, legacy 12-byte frames                                                                                                | EllipticSet `src/ugreen-pro-leds:129-135`, `src/preflight.sh:46-49`@ebed5bd                                                                 | `backend/internal/led/chip/protocol.go:106-117`                                  |
| Bays on `ata1`-`ata4` for GT and Pro                                                                                                                                            | flybrys `src/ugreen-gt-leds:29`@32c06cf                                                                                                     | `backend/internal/fan/hardware.go:82-85`, `web/models/dxp4800-gt.ts`             |
| Non-Pro iDX: power LED register 0, LAN 1, bays 2-7; checksum `0xa1` + command + parameters, big-endian                                                                          | omgapuppy `src/monitor.sh:118-127`@6196dc0                                                                                                  | `backend/internal/led/chip/protocol.go:133-146`                                  |
| IT5571 EC at ports `0x62`/`0x66`, read command `0x80`, write command `0x81`                                                                                                     | noodlemctwoodle `src/panel/ec.h:21,29`@d202a7c; omgapuppy `src/idx6011-fan-status.c:25-28`@6196dc0                                          | `backend/internal/fan/ec.go:19-26`                                               |
| iDX6011 Pro fans: tach `0x34/35` (cpu1), `0x38/39` (sys1); duty `0xB0/B1`, `0xB4/B5`; 198 = 100 percent; two more channels cpu2 `0x36/37`, `0xB2/B3`, sys2 `0x3A/3B`, `0xB6/B7` | noodlemctwoodle `src/panel/fan.h:8-12`@d202a7c; chip id `0x5571` in IT-Kuny `README.md` (supported-hardware list)@5c2d850                   | `backend/internal/fan/ec.go:34,39,53-54` (two channels)                          |
| iDX6011 Pro SATA order: Intel PCH (`0x8086`) = bays 3,4; ASMedia ASM1164 (`0x1b21`) = bays 1,2,5,6. Non-Pro: ASMedia = 1-4, Intel = 5,6                                         | noodlemctwoodle `src/monitor.sh:70-75`@d202a7c; omgapuppy `src/monitor.sh:70-75`@6196dc0                                                    | `backend/internal/led/ledctl/disks.go:263-312` (not yet checked on a real Pro)   |
| iDX6012 is accepted next to iDX6011                                                                                                                                             | omgapuppy `src/idx6011-fan-status.c:74-77`@6196dc0                                                                                          | `backend/internal/led/chip/protocol.go:311-317`, `web/models/idx6011.ts:7`       |
| Power LED stays dark after boot although the MCU reports on: write brightness 0, wait, then the value; iDX: mode reset (command `0x04`, checksum `0xa5`) before steady on       | flybrys `src/ugreen-gt-leds:357-361`@32c06cf; EllipticSet `src/ugreen-pro-leds:593-597`@ebed5bd; omgapuppy `src/monitor.sh:164-181`@6196dc0 | `backend/internal/led/ledctl/powerboot.go`                                       |
| Non-Pro iDX blink to steady on must pass through off                                                                                                                            | omgapuppy `src/monitor.sh:156-160`@6196dc0                                                                                                  | `backend/internal/led/chip`                                                      |
| iDX6011 Pro fan floor 25 percent, critical CPU 88 / disk 60, Pro detected by "Pro" in `product_name`                                                                            | noodlemctwoodle `src/panel/fan.h:25-38,102-105`@d202a7c                                                                                     | not used; `web/models/idx6011.ts` has no fan entry                               |
| IT8613E at `0xa30` also on DXP2800 (hwmon `it8613-isa-0a30`)                                                                                                                    | IT-Kuny `README.md:262`@5c2d850                                                                                                             | `backend/internal/fan/ite.go:42-46,60-102` (chip found; per-model channel table) |
| iDX6011 Pro backlight: EC register `0xA5`, 1 = full, 198 = off; touch panel needs the BIOS watchdog off                                                                         | noodlemctwoodle `src/panel/backlight.h:14,24`, `README.md` (watchdog section)@d202a7c                                                       | not used                                                                         |

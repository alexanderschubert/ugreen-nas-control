# Hardware watchdog

An embedded-controller (EC) watchdog resets the box when nothing feeds it. UGREEN's own driver arms it only when userspace opens `/dev/watchdog` (registering the device does not arm it). Whether the BIOS arms it at boot is not proven; community reports say some UGREEN boxes reset every few minutes under another OS, and the usual fix there is switching it off in the BIOS. The plugin feeds a timer that is already armed (by the BIOS or another tool) and never arms it: a frozen box then still reboots itself.

## Behaviour

- Models: DXP4800 GT and iDX6011 Pro (both IT5571 EC, [fan.md](fan.md#fan-chips)). Other models run no watchdog code. The plain iDX6011/iDX6012 keeps its own registers (`0x55`-`0x57`), read only: no petter, no write. There `0x98`/`0x99` is a fan tachometer, not the watchdog.
- Recommended BIOS setting: leave the watchdog armed.
- The plugin never arms it. While it is armed, the fan daemon rewrites the timeout at a third of the timeout, at least every 60 seconds. UGREEN's keepalive also sets the enable byte again; the plugin does not, and that a timeout rewrite alone reloads the counter is not proven on hardware.
- On stop the plugin returns the fans to the EC curve and clears the enable register.
- `ugreen-nas-fan status` reports `watchdog`, with `counter` (the timeout registers read back before the feed, read only; whether it counts down is not stated by UGREEN) while armed ([cli.md](cli.md)).
- Fan code writes only fan mode and duty, the watchdog timeout, the enable byte with 0, and (iDX6011 Pro) the backlight register. The wake registers `0x99`/`0x9A` (GT/Pro), the EUP and beeper registers (`0x9C`, `0x9E`) and `0xA5` on the plain iDX (beeper) are refused in code.
- Code: `backend/internal/fan/ec_watchdog.go`.

## EC registers

| Model                      | Enable | Timeout (big-endian seconds, 1..10000, UGREEN default 600) |
| -------------------------- | ------ | ---------------------------------------------------------- |
| DXP4800 GT, iDX6011 Pro    | `0x98` | `0xA2`, `0xA3`                                             |
| iDX6011, iDX6012 (no feed) | `0x55` | `0x56`, `0x57`                                             |

Source: UGREEN's published drivers at `kernel-6.12` `c75c5ab`: `ug_it55_4800gt_functions.c:529-536,550-560,615-640`, `ug_it55pro_functions.c:521-527`, `ug_it55_functions.c:466-472` ([third-party.md](third-party.md)). The GT registers were first derived from the stock driver `ug_4800gt-sio.ko`. Facts and design, no code. The design is pet-only, never arm.

## Sources

- [TrueNAS forum thread](https://forums.truenas.com/t/6910): UGREEN boxes reboot every few minutes under another OS while the BIOS watchdog is armed; the fix there is disabling it in the BIOS.
- [aloli/ugreen-hal](https://github.com/aloli/ugreen-hal) (BSD-2-Clause): the BIOS-armed watchdog and the reboot symptom; facts only.
- [miskcoo/ugreen_leds_controller issue #123](https://github.com/miskcoo/ugreen_leds_controller/issues/123) (no license stated): an independent EC watchdog map for the DXP2800 GT MCU (other registers, arms and kicks); reference only, nothing used.
- The iDX6011 Pro touch LCD needs the BIOS watchdog off; the plugin does not drive the LCD ([decisions.md](decisions.md#idx6011-pro-touch-lcd-dashboard)).

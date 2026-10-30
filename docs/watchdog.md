# Hardware watchdog

The BIOS of some UGREEN models arms an embedded-controller (EC) watchdog. Under Unraid nothing feeds it, so the box resets every few minutes; the usual fix elsewhere is switching it off in the BIOS. The plugin keeps it on instead: a frozen box reboots itself.

## Behaviour

- Models: DXP4800 GT and iDX6011 Pro (both IT5571 EC, [fan.md](fan.md#fan-chips)). Other models run no watchdog code. On the non-Pro iDX6011, `0x98`/`0x99` is a fan tachometer, not the watchdog.
- Recommended BIOS setting: leave the watchdog armed.
- The plugin never arms it. While it is armed, the fan daemon rewrites the timeout at a third of the timeout, at least every 60 seconds.
- On stop the plugin returns the fans to the EC curve and clears the enable register.
- `ugreen-nas-fan status` reports `watchdog` ([cli.md](cli.md)).
- Code: `backend/internal/fan/ec_watchdog.go`.

## EC registers

| Register       | Meaning             |
| -------------- | ------------------- |
| `0x98`         | enable              |
| `0xA2`, `0xA3` | timeout, big-endian |

Derived from the UGREEN stock driver `ug_4800gt-sio.ko` on a DXP4800 GT; reused as facts and design, no code. The design is pet-only, never arm.

## Sources

- [TrueNAS forum thread](https://forums.truenas.com/t/6910): UGREEN boxes reboot every few minutes under another OS while the BIOS watchdog is armed; the fix there is disabling it in the BIOS.
- [aloli/ugreen-hal](https://github.com/aloli/ugreen-hal) (BSD-2-Clause): the BIOS-armed watchdog and the reboot symptom; facts only.
- [miskcoo/ugreen_leds_controller issue #123](https://github.com/miskcoo/ugreen_leds_controller/issues/123) (no license stated): an independent EC watchdog map for the DXP2800 GT MCU (other registers, arms and kicks); reference only, nothing used.
- The iDX6011 Pro touch LCD needs the BIOS watchdog off; the plugin does not drive the LCD ([decisions.md](decisions.md#idx6011-pro-touch-lcd-dashboard)).

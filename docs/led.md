# LEDs

How the plugin drives the LEDs of DX, DXP and iDX models. Off until the user switches them on in the plugin.

## LED controller

All DX, DXP and iDX models share the same LED controller protocol, after [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller) (credits: [third-party.md](third-party.md)). Bays map to LEDs by SATA port.

- The LED part is offered when the DMI product name starts with `DX`, `DXP` or `iDX`, and not while the plugin _ugreenleds-driver_ or the kernel module `led_ugreen` holds the controller.
- Transport: SMBus (`/dev/i2c-N`), or `/dev/mem` on the DXP4800 GT (AMD DesignWare I2C). Protocol and frames: `backend/internal/led/chip/protocol.go`.
- Frames (`chip/frames.go`): DX/DXP models take the 12-byte I2C block write with the LED ID first; the iDX models and the DXP4800 GT an SMBus block without the ID. The DXP2800 tries the DX/DXP frame first, so boards that work today stay as they are, and when the controller does not acknowledge it (register 0x80) falls back to the iDX frame, which is the one UGREEN's own driver uses for that model (V1.2 board, [miskcoo#128](https://github.com/miskcoo/ugreen_leds_controller/issues/128)). The frame that worked last is tried first for the rest of the process. `UGREEN_LAYOUT=idx` forces the iDX frame by hand.
- Timing: blink on and off at least 100 ms; breath on at least 1000 ms, off at least 500 ms (the limits UGREEN's drivers apply). Shorter values are raised.
- iDX6011 Pro: the second LAN LED is register 2, name `netdev2` in `ugreen-led-i2c` (also part of `all`); the plugin pages do not offer it.
- Facts from UGREEN's GPL kernel drivers are cited as `file:line@c75c5ab` in the code and in [third-party.md](third-party.md); nothing is copied.
- If the standalone UGREEN LED Control plugin is installed too, both write the same LEDs and the last write wins ([conflicts.md](conflicts.md)).

## LED tool and backend

- `ugreen-led-i2c` (`backend/internal/led/chip`): writes colour, brightness and effects to the controller.
- `ugreen-led-ctl` (`backend/internal/led/ledctl`): decides what each LED shows (status mode from `disks.ini`, SMART and link speed, night mode, alerts, shutdown signal, effects) and calls the LED tool. Its runtime state is `/var/run/ugreen-nas-control.led*`, its settings `leds.cfg`. The behaviour it must keep is [SPEC.md](../backend/internal/led/ledctl/SPEC.md).
- `web/plugin/led/api.php` runs `ugreen-led-ctl` per request.
- `ugreen-nas-ctl led-*` switches the LED part on and off and imports the settings of UGREEN LED Control ([cli.md](cli.md)).
- Shutdown: the Unraid event script `plugin/event/stopping` runs `ugreen-nas-ctl event stopping`, which tells the LED backend so the power LED can signal it.

## Open questions for device owners

| Question                                                           | Why                                                                                                                                                                                   | Test                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| DXP4800 GT: little-endian or big-endian write checksum?            | We write little-endian (verified on a GT); UGREEN's driver writes big-endian (`leds-mcu.c:211-214@c75c5ab`) and the status read is big-endian. The MCU may ignore the write checksum. | `ugreen-led-i2c set power color 255 0 0` with each order, then `get power` and check the colour |
| iDX, DXP2800, GT blink: second field on-time or off-time?          | We send the on time, UGREEN's `leds-mcu.c:392-393@c75c5ab` sends the off time (the older driver sends on). Same result when on equals off.                                            | `blink 200 800` and watch the duty cycle                                                        |
| DXP2800 V1.2: does the fallback to the iDX frame light the LEDs?   | Untested, no V1.2 board at hand.                                                                                                                                                      | `ugreen-led-i2c set power color 0 255 0`, then `get power`                                      |
| iDX6011 Pro: does `netdev2` (register 2) light the second LAN LED? | From UGREEN's LED table (`leds-mcu.c:104-108@c75c5ab`), untested.                                                                                                                     | `ugreen-led-i2c set netdev2 color 0 255 0`                                                      |
| DXP480T Plus: address 0x26 or 0x31?                                | UGREEN's driver lists both (`dxp480t/leds-mcu-n76e003.c:40-43@c75c5ab`), we use 0x26.                                                                                                 | `ugreen-led-i2c scan`                                                                           |

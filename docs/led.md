# LEDs

How the plugin drives the LEDs of DX, DXP and iDX models. Off until the user switches them on in the plugin.

## LED controller

All DX, DXP and iDX models share the same LED controller protocol, after [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller) (credits: [third-party.md](third-party.md)). Bays map to LEDs by SATA port.

- The LED part is offered when the DMI product name starts with `DX`, `DXP` or `iDX`, and not while the plugin _ugreenleds-driver_ or the kernel module `led_ugreen` holds the controller.
- Transport: SMBus (`/dev/i2c-N`), or `/dev/mem` on the DXP4800 GT (AMD DesignWare I2C). Protocol and frames: `backend/internal/led/chip/protocol.go`.
- If the standalone UGREEN LED Control plugin is installed too, both write the same LEDs and the last write wins ([conflicts.md](conflicts.md)).

## LED tool and backend

- `ugreen-led-i2c` (`backend/internal/led/chip`): writes colour, brightness and effects to the controller.
- `ugreen-led-ctl` (`backend/internal/led/ledctl`): decides what each LED shows (status mode from `disks.ini`, SMART and link speed, night mode, alerts, shutdown signal, effects) and calls the LED tool. Its runtime state is `/var/run/ugreen-nas-control.led*`, its settings `leds.cfg`. The behaviour it must keep is [SPEC.md](../backend/internal/led/ledctl/SPEC.md).
- `web/plugin/led/api.php` runs `ugreen-led-ctl` per request.
- `ugreen-nas-ctl led-*` switches the LED part on and off and imports the settings of UGREEN LED Control ([cli.md](cli.md)).
- Shutdown: the Unraid event script `plugin/event/stopping` runs `ugreen-nas-ctl event stopping`, which tells the LED backend so the power LED can signal it.

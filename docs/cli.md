# Command line

All Go code is one binary, `ugreen-nas`, that runs as the tool its name says (multicall). The archive holds it once and the tool names as symbolic links. `ugreen-nas <tool> ...` works too (`ugreen-nas led-ctl status`).

| Tool             | Installed at                                                              | Code                                            |
| ---------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| `ugreen-nas-fan` | `/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan`     | `backend/internal/fan`, `backend/internal/mqtt` |
| `ugreen-nas-ctl` | `/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl`     | `backend/internal/nasctl`                       |
| `ugreen-led-ctl` | `/usr/local/emhttp/plugins/ugreen-nas-control/led/backend/ugreen-led-ctl` | `backend/internal/led/ledctl`                   |
| `ugreen-led-i2c` | `/usr/local/emhttp/plugins/ugreen-nas-control/led/backend/ugreen-led-i2c` | `backend/internal/led/chip`                     |

Run them as root on the NAS.

## ugreen-nas-fan

Talks to the fan chip, runs the curves every 2 s, reads sensors. Subcommands: `info`, `hardware`, `conflicts`, `cs201x`, `probe`, `probe-fans`, `backlight`, `status`, `history`, `set`, `calibrate`, `restore`, `daemon`, and `publish` (the MQTT publisher, [mqtt.md](mqtt.md)). Background: [fan.md](fan.md), [conflicts.md](conflicts.md), [watchdog.md](watchdog.md).

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-fan status
```

`status` prints sensors, chip state, presets and the daemon's state file (`/var/run/ugreen-nas-control.json`).

## ugreen-nas-ctl

- `start`, `stop`, `restart`, `status`: the fan daemon (pid file, error log).
- `mqtt-start`, `mqtt-stop`, `mqtt-status`: the MQTT publisher.
- `led-status`, `led-enable`, `led-disable`, `led-import`, `led-boot`, `led-stop`: the LED switch ([led.md](led.md)).
- `report`: anonymised JSON for a model report (below).
- `event stopping`: called by the Unraid event script at shutdown.

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl status
```

## Support requests

Include the output of both `status` commands, the NAS model and the Unraid and plugin versions.

## Report a model

Run the report on the Unraid box and paste the JSON into the [model report form](https://github.com/alexanderschubert/ugreen-nas-control/issues/new?template=model-report.yml):

```
/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas-ctl report
```

It prints the DMI product name, the chips found, the bus probe, the LED and fan self-test results and the plugin version as JSON, without serial numbers, IP addresses or drive names. Then tick in the form what works on your device. Without a shell, **About, Confirm my device** in the plugin opens a prepared issue with what you ticked. Check with _Identify_ on the LEDs page that the right bay blinks.

A report turns an _expected_ capability into _community_ ([how verification works](hardware.md#how-verification-works)). To add the model yourself: [development.md](development.md#add-a-model).

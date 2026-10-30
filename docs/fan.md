# Fan control

How `ugreen-nas-fan` reads and drives the fan chips. Unraid's kernel has no driver for them, so the tool talks to the chips through `/dev/port` (the DXP4800 GT and iDX6011 Pro through the ACPI EC ports), the way `sensors-detect` finds them. Which model has which fan wiring: `web/models/`. Commands: [cli.md](cli.md).

## Fan chips

### DXP6800 Pro, ITE IT8613E

- Super-I/O config ports `0x2e`/`0x2f` give the chip id (`0x8613`) and the base address of the environment controller (`0x0a30`).
- Fan speed comes from the tachometer counters: rpm = 1 350 000 / (2 x count).
- The BIOS leaves the PWM outputs in manual mode with a fixed duty cycle. The daemon changes it every 2 seconds following the curves.
- CPU fan on header 2, case fans on headers 3 and 4.

### DXP4800 GT, ITE IT5571 embedded controller

- Reached through the ACPI EC ports `0x62` (data) and `0x66` (command/status), under the same lock, with bounded waits and retries.
- CPU fan (fan1): mode register `0xb0`, duty `0xb1`, tachometer `0x34`/`0x35`. Case fan (fan3): `0xb4`, `0xb5`, `0x38`/`0x39`.
- Duty runs 0 to 198; the tachometer counter is the rpm. Mode 0 is the controller's own curve, 1 is manual.
- CPU temperature comes from the AMD sensor (`k10temp`), mainboard temperature from the controller.

### iDX6011 Pro, ITE IT5571 embedded controller

- Same controller as the DXP4800 GT, with four fans: tachometer `0x34`-`0x3b`, enable and duty `0xb0`-`0xb7`.
- Never below 25 % (the case fan stalls near 20 %); emergency limits 88 C CPU and 60 C disk.
- `ugreen-nas-fan backlight [set <0-100>]` reads and sets the LCD brightness (EC register `0xa5`, 1 = full, 198 = off) and touches nothing else of the display.

The EC watchdog of the DXP4800 GT and iDX6011 Pro: [watchdog.md](watchdog.md).

## Fan settings and pipeline order

- `fan.cfg` is v1 (no `cfg_version`) or v2 (`cfg_version="2"`). A v1 file loads with groups that repeat today's globals (the group curve, `min_run` = `min_pct`, `up_step` 100 = at once, `down_step` 2, no deadband, no kick-start, quiet hours and jobs off), so it decides exactly as before; v2 keys in a v1 file are ignored. The daemon never rewrites it. The first v2 save from the web page copies the file to `fan.cfg.bak` (once) and adds `cfg_version="2"`.
- v2 keys: per group `cpu_`/`case_` + `input`, `deadband`, `start_pct`, `start_ms`, `min_run`, `up_step`, `down_step`, `on_missing` (`fallback`, `curve_low`, `hold`); the group curves stay `cpu_curve`/`case_curve`. A fan can override any of them, and the curve, as `fan.<id>.<key>` (`fan.fan3.deadband`). Quiet hours: `quiet_enabled`, `quiet_from`, `quiet_to` (HH:MM, may cross midnight), `quiet_days` (`mon,tue,...`), `quiet_cap`, `quiet_scope` (`case`, `all`). Jobs: `job_mover`, `job_parity` (`off`, `floor`, `boost`) with `job_mover_pct`, `job_parity_pct`. Invalid values warn and keep the default (`ValidateSetting` in `config_v2.go`; `web/plugin/include/fan_v2.php` checks the same table before `api.php` saves).
- Input specs: `auto` (default: the CPU for `cpu`; the hottest non-ignored disk, or NVMe minus `nvme_offset`, for `case`), `cpu`, `disk_max[:disk1+disk2]`, `disk_avg[:disk1+disk2]`, `nvme`, `gpu`, `nic:<iface>`, `script:<name>`, `max:<spec>|<spec>` (2 to 8, no nesting).
- Order per tick: inputs, curve, shape (deadband, kick-start, minimum run speed, ramps), job floor or boost, quiet cap, emergency override. The emergency check runs first and its 100 % is never capped, ramped, held by a deadband or scheduled. A missing input follows `on_missing` and never leaves a group silently off; an unreadable CPU still raises `cpu_unreadable`. Script, GPU and NIC temperatures never trigger the disk emergency. The quiet cap never goes below `min_run`. Calibration pauses all of it.

## Safety logic

- The first start after boot saves the BIOS values to `/var/run/ugreen-nas-control.bios`. Stopping the daemon (also on update or removal) and `restore` write them back.
- All fans go to 100 % when the CPU or a disk reaches its limit, when the CPU temperature cannot be read, and when the hottest non-ignored NVMe minus the NVMe offset reaches the disk limit.
- With fan control switched off in Settings the tool makes no read or write on the fan chip.
- On any model not in `web/models/` with a `fan` entry, the plugin does not touch the fan controller.
- A fan that stops turning raises a notification. Drives can be excluded from fan control.
- Rival tools writing the same chip make the daemon read-only: [conflicts.md](conflicts.md).

## Fan history

- The daemon records every tick (2 s) into two rings in its own RAM (`backend/internal/fan/history.go`): 10 s steps for the last hour (360 points) and 60 s averages for the last 24 hours (1440 points). A point holds the CPU and hottest-drive temperature and, per fan (at most 6), speed, rpm, the driving input, its temperature and the modifiers: 56 bytes, about 100 KB in total, allocated once. Nothing is written to disk; a daemon restart starts it again.
- What drove a fan comes from the pipeline itself (`drive.go`, filled in `shape_pipeline.go`): the source (`cpu`, `disk:<name>` for the hottest drive, `disk_avg`, `nvme`, `gpu`, `nic:<iface>`, `script:<name>`, `idle`, `missing`, `hold`, `emergency:<reason>`; `bios`, `calibration`, `rival` while the daemon does not drive) and modifier bits (quiet cap, mover, parity, minimum speed, ramp, emergency, input missing). An emergency is never averaged away.
- Reading: `ugreen-nas-fan history [1h|24h]` asks the daemon over the unix socket `/var/run/ugreen-nas-control.history.sock` (root only; `UGREEN_FAN_HISTORY` in test builds) and prints one JSON object of arrays (`web/src/core/contract-fan-history.ts`). `api.php?action=fan_history&range=1h|24h` calls it. The socket costs nothing while nobody asks; the History page asks only while it is on screen.

## Fan probe for unknown wiring

Models with an IT8613E whose header wiring is not known (DXP2800, DXP4800, DXP4800 Plus, DXP4800 Pro, DXP8800 Plus) keep fan control off until a probe result is confirmed. `ugreen-nas-fan probe-fans run` takes about a minute and only starts on that command: the daemon is paused, one output at a time goes to 80 % for at most 8 seconds while the others hold 50 %, and the tach that responds is attributed to it. It never writes below 25 %, stops on a hot CPU or disk, a fan that stops turning, or SIGTERM, and puts the previous speeds back on every exit (`probe-fans restore` does that after a killed probe). The result is a proposal; `probe-fans confirm pwm2=cpu pwm3=case` saves it as `fan_map.json` next to `fan.cfg`, `probe-fans forget` removes it, `probe-fans tachs` reads the tach inputs without writing.

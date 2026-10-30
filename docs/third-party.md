# Third-party notices

## Credits

Maintainer: [Alexander Schubert](https://github.com/alexanderschubert). Contributor (merged code): [j3n57h0m45](https://github.com/j3n57h0m45): DXP4800 GT support (fans, LEDs, case and System view), UX overhaul, fan measuring, CI.

Prior work this project builds on; licenses and what is used follow below.

- [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller): LED protocol and bay mapping.
- [noodlemctwoodle/unraid-ugreen-idx6011-pro](https://github.com/noodlemctwoodle/unraid-ugreen-idx6011-pro) and [omgapuppy/unraid-ugreen-idx6011-led-fan](https://github.com/omgapuppy/unraid-ugreen-idx6011-led-fan): iDX6011 bay order, EC registers, LED frames.
- [flybrys/UGREEN-DXP4800GT-LED-Driver](https://github.com/flybrys/UGREEN-DXP4800GT-LED-Driver) and [EllipticSet/UGREEN-DXP4800Pro-LEDs](https://github.com/EllipticSet/UGREEN-DXP4800Pro-LEDs): LED controller buses.
- [IT-Kuny/UGREEN-DXP-FAN-NAS-Driver](https://github.com/IT-Kuny/UGREEN-DXP-FAN-NAS-Driver) and [smashah/ugreen-dxp-fan-cli](https://github.com/smashah/ugreen-dxp-fan-cli): fan chips and PWM channels.
- UGREEN LED Control (Unraid plugin by ivolution): the Spanish LED texts.
- UGREEN stock driver `ug_4800gt-sio.ko` (DXP4800 GT): the EC watchdog registers were derived from it; design: pet-only, never arm (see EC watchdog registers below).

## Hardware facts from community plugins

The iDX6011 / iDX6012 LED and fan handling uses facts (bay order, model names, the power LED start-up sequence, EC fan and backlight registers) read from these MIT-licensed
repositories. No code is copied; the source comments in `backend/internal/led/` and `backend/internal/fan/` name the file, line and commit.

| Repository                                                                                                                                                                                 | Commit               | Used for                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [noodlemctwoodle/unraid-ugreen-idx6011-pro](https://github.com/noodlemctwoodle/unraid-ugreen-idx6011-pro) (iDX6011 Pro)                                                                    | `d202a7c`            | Pro bay order (`src/monitor.sh:70-75`), power LED mode reset (`:119-127`), "Pro" in DMI (`src/panel/fan.h:38`); EC fan registers (`src/panel/fan.h:8-12`: tach `0x34`-`0x3b`, enable and duty `0xb0`-`0xb7`, `198` = 100 %), 25 % floor and critical limits (`:25-31`), EC backlight `0xA5` (`src/panel/backlight.h:14,24`); in `backend/internal/fan/ec.go`, `backend/internal/fan/ec_backlight.go`, `backend/internal/fan/fanmodels.go` |
| [omgapuppy/unraid-ugreen-idx6011-led-fan](https://github.com/omgapuppy/unraid-ugreen-idx6011-led-fan) (iDX6011 / iDX6012)                                                                  | `6196dc0`            | plain iDX bay order (`src/monitor.sh:70-75`), iDX6012 model name (`src/idx6011-fan-status.c:76`), power LED start-up (`src/monitor.sh:164-175`)                                                                                                                                                                                                                                                                                           |
| [flybrys/UGREEN-DXP4800GT-LED-Driver](https://github.com/flybrys/UGREEN-DXP4800GT-LED-Driver), [EllipticSet/UGREEN-DXP4800Pro-LEDs](https://github.com/EllipticSet/UGREEN-DXP4800Pro-LEDs) | `32c06cf`, `ebed5bd` | read only: why their power LED cycle is not needed here (`ugreen-gt-leds:357-361`, `ugreen-pro-leds:593-597`)                                                                                                                                                                                                                                                                                                                             |

All four are MIT licensed ("MIT License", Copyright (c) 2026 noodlemctwoodle (both iDX repositories), flybrys, EllipticSet respectively). The MIT terms
require the copyright and permission notice only for copies of the software or substantial portions of it; if code from them is ever
copied, add their full license text here first.

## miskcoo/ugreen_leds_controller

The LED protocol and the bay mapping follow [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller) (MIT).

Code or data copied from miskcoo would need this notice, which applies to the protocol description in `backend/internal/led/chip/protocol.go`:

```
MIT License

Copyright (c) 2024 miskcoo@gmail.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The miskcoo issue threads (#6, #22, #93, #100, #121, #122) are cited in `web/models/*.ts` and `backend/internal/led/chip/protocol.go` as evidence that models work; user reports only.

## Facts only, no code

| Project                                                                                   | License                         | What we use                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [IT-Kuny/UGREEN-DXP-FAN-NAS-Driver](https://github.com/IT-Kuny/UGREEN-DXP-FAN-NAS-Driver) | GPL-3.0                         | chip id `0x5571` for the iDX6011 Pro (`README.md:21-22`), IT8613E at `0xa30` on the DXP2800 (`README.md:262`, @5c2d850); `backend/internal/fan/ec.go`, `backend/internal/fan/fanmodels.go`; no code |
| [smashah/ugreen-dxp-fan-cli](https://github.com/smashah/ugreen-dxp-fan-cli)               | MIT (Copyright (c) 2026 M SHAH) | DXP4800 Plus drives its fans on `pwm2` and `pwm3` of the IT8613E; `backend/internal/fan/fanmodels.go`; no code                                                                                      |
| `vendor/` kernel modules in EllipticSet and flybrys, GPL parts of noodlemctwoodle         | GPL-2.0                         | nothing; not read for code                                                                                                                                                                          |

## EC watchdog registers

The EC watchdog registers (`0x98` enable, `0xA2`/`0xA3` timeout, big-endian) were derived from the UGREEN stock driver `ug_4800gt-sio.ko` on a DXP4800 GT. Reused as facts and design, no code: never arm, pet every timeout / 3 only while armed, clear `0x98` on stop after returning the fans to EC auto. Used in `backend/internal/fan/ec_watchdog.go`. As of 2026-10-29 no earlier public source for this EC register approach is known.

## Watchdog background

- [TrueNAS forum thread](https://forums.truenas.com/t/6910) (2024-06): UGREEN boxes reboot every few minutes under another OS while the BIOS watchdog is armed; the fix there is disabling it in the BIOS.
- [aloli/ugreen-hal](https://github.com/aloli/ugreen-hal) (BSD-2-Clause): the BIOS-armed watchdog and the reboot symptom; facts only.
- [miskcoo/ugreen_leds_controller issue #123](https://github.com/miskcoo/ugreen_leds_controller/issues/123) (Hacksawfred3232, 2026-08-30, no license stated): an independent EC watchdog map for the DXP2800 GT MCU (other registers, arms and kicks); reference only, nothing used.
- On the non-Pro iDX6011, `0x98`/`0x99` is a fan tachometer, not the watchdog (omgapuppy/unraid-ugreen-idx6011-led-fan), which is why the watchdog code runs only on the DXP4800 GT and iDX6011 Pro.

## ITE and Linux it87 register layout

Header 1 of the IT8613E (tach `0x0d`/`0x18`, duty `0x63`, control `0x15`) follows the pattern of the headers 2 to 4 verified on the DXP6800 Pro, in `backend/internal/fan/ite_headers.go`. The Linux `it87` driver (GPL-2.0) is not cited in the code and is not a source.

Other projects surveyed in [competition.md](competition.md) (FanCtrl Plus, Dynamix, andrewle8, ich777, 0x556c79) supply no facts or code to this repository.

## Development tooling

`.claude/skills/frontend-design/` (Apache-2.0) is developer tooling and not part of the plugin; its `LICENSE.txt` stays with it.

## Fonts

[Archivo](https://github.com/Omnibus-Type/Archivo) (Copyright 2020 The Archivo Project Authors, SIL Open Font License 1.1), the variable woff2 of the latin subset from `@fontsource-variable/archivo` 5.3.0, self-hosted by the Pages site in `docs/site/fonts/`; the licence text is `docs/site/fonts/OFL.txt`.

## Trademarks

UGREEN and Unraid are trademarks of their owners. This project is not affiliated with either.

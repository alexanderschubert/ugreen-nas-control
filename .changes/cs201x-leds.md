---
type: feat
---

DXP2800 GT: LED backend for the four ARGB channels of the CS201x controller (power, network, disk1, disk2), off until `cs201x_leds="1"` is set in `leds.cfg`; it shares the fan tool's lock and puts the LEDs back as found when the daemon stops. `ugreen-led-i2c cs201x` dumps the registers without writing. DXP6800 and DXP6800S use the same LED frames as the DXP2800; the iDX6012 Pro name (no such model) no longer counts as an iDX6011 Pro.

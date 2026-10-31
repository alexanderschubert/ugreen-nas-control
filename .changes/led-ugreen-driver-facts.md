---
type: fix
---

LEDs: the DXP2800 falls back to the frame UGREEN's own driver uses when the controller does not acknowledge the usual one (boards from December 2025); breath times are kept at UGREEN's minimums (on 1000 ms, off 500 ms); the second LAN LED of the iDX6011 Pro can be set as `netdev2` with `ugreen-led-i2c`.

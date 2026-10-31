---
type: feat
---

DXP2800 GT: fan control for the Chipsea CS201x, off until you run `ugreen-nas-fan cs201x confirm`. Duty in percent with a 25 % floor; when the daemon stops, the fans get the speed they had at the start (this chip has no automatic mode). The probe now also reports the 16-bit revision, a host interface that is off, the temperature inputs and the watchdog registers.

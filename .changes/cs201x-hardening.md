---
type: fix
---

DXP2800 GT: fan control no longer switches the controller's host interface on (it stays off when the BIOS hides it), and the daemon now restores the fans on SIGHUP/SIGQUIT or a crash and still sets every other fan to 100 % when one write fails; the minimum-speed field and calibration start at the 25 % the hardware runs at least.

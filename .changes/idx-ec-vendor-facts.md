---
type: model
---

iDX6011 Pro and DXP4800 GT: the embedded-controller registers now follow UGREEN's published drivers. The Pro's fourth fan shows the third fan's speed while it reads 0 (as UGREEN does) instead of counting as stopped, a backlight value of 0 (vendor default) is no longer an error, and fan code can only write fan, watchdog-timeout and (Pro) backlight registers. The plain iDX6011/6012 gets a read-only fan and watchdog reader; nothing is written there. The watchdog status shows the counter read back from the controller.

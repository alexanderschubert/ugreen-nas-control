package fan

import (
	"fmt"
)

// LCD backlight of the iDX6011 Pro, the only part of the display this tool touches. EC register 0xa5:
// 1 = full brightness ... 198 = off (noodlemctwoodle/unraid-ugreen-idx6011-pro, MIT, src/panel/backlight.h:14,24,
// @d202a7c; facts only, nothing copied). Not confirmed on a device with this plugin.
const (
	ecRegBacklight = 0xa5
	backlightFull  = 1
	backlightOff   = 198
)

// BacklightPct is the brightness in percent (100 = full, 0 = off). raw is the register as read.
func (c *EC) BacklightPct() (pct, raw int, err error) {
	v, err := c.read(ecRegBacklight)
	if err != nil {
		return 0, 0, err
	}
	if v < backlightFull || v > backlightOff {
		return 0, int(v), fmt.Errorf("backlight register holds 0x%02x, outside %d..%d", v, backlightFull, backlightOff)
	}
	return backlightToPct(v), int(v), nil
}

func (c *EC) SetBacklight(pct int) error {
	if pct < 0 || pct > 100 {
		return fmt.Errorf("brightness must be 0-100")
	}
	return c.write(ecRegBacklight, pctToBacklight(pct))
}

func pctToBacklight(pct int) byte {
	return byte(backlightOff - (pct*(backlightOff-backlightFull)+50)/100)
}

func backlightToPct(raw byte) int {
	return ((backlightOff-int(raw))*100 + (backlightOff-backlightFull)/2) / (backlightOff - backlightFull)
}

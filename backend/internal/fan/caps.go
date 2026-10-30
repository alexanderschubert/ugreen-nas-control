package fan

import "strings"

// FanCaps is what the web page may offer for this model, so that it holds no model list of its own (`fan_caps` in
// the status; absent for a model without fan control).
type FanCaps struct {
	Kind      string `json:"kind"`      // KindFixed or KindProbe
	Channels  int    `json:"channels"`  // fans the plugin drives; 0 on a probe model until a map is confirmed
	Watchdog  bool   `json:"watchdog"`  // the EC watchdog petter runs
	Backlight bool   `json:"backlight"` // the LCD backlight can be read and set
}

// WatchdogModel: the EC watchdog is fed on exactly the DXP4800 GT (register map from its UGOS driver) and the
// iDX6011 Pro. Never on the plain iDX6011 or the iDX6012 (Pro or not): 0x98/0x99 is the second system fan's
// tachometer there, and a write would be a fan register write, not a feed.
func WatchdogModel(model string) bool {
	return isDXP4800GT(model) || (strings.HasPrefix(model, "iDX6011") && strings.Contains(model, "Pro"))
}

func CapsFor(model string) (FanCaps, bool) {
	kind := FanKind(model)
	if kind == "" {
		return FanCaps{}, false
	}
	c := FanCaps{Kind: kind, Watchdog: WatchdogModel(model), Backlight: isIdxPro(model)}
	switch {
	case isDXP4800GT(model):
		c.Channels = len(ecChannels)
	case isIdxPro(model):
		c.Channels = len(ecChannelsIdxPro)
	case kind == KindProbe:
		if m, err := loadFanMap(model); err == nil {
			c.Channels = len(m.Outputs)
		}
	default:
		c.Channels = len(it8613Channels)
	}
	return c, true
}

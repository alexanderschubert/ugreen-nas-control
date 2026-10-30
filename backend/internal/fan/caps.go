package fan

// FanCaps is what the web page may offer for this model, so that it holds no model list of its own (`fan_caps` in
// the status; absent for a model without fan control).
type FanCaps struct {
	Kind      string `json:"kind"`      // KindFixed or KindProbe
	Channels  int    `json:"channels"`  // fans the plugin drives; 0 on a probe model until a map is confirmed
	Watchdog  bool   `json:"watchdog"`  // the EC watchdog petter runs
	Backlight bool   `json:"backlight"` // the LCD backlight can be read and set
}

// WatchdogModel: the EC watchdog is fed on exactly the DXP4800 GT and the iDX6011 Pro, which share one map
// (ug_it55_4800gt_functions.c:534-536, ug_it55pro_functions.c:525-527@c75c5ab). Never on the plain iDX6011/iDX6012:
// its watchdog sits at 0x55-0x57 (ug_it55_functions.c:470-472, read only here), and 0x98/0x99 is the second system
// fan's tach there (:30-31), so a write would be a fan register write, not a feed. An "iDX6012 Pro" does not exist.
func WatchdogModel(model string) bool {
	return isDXP4800GT(model) || model == "iDX6011 Pro"
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

package fan

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/alexanderschubert/ugreen-nas-control/internal/led/chip"
)

const (
	// KindFixed: the wiring is known (DXP6800 Pro, DXP4800 GT, iDX6011 Pro).
	KindFixed = "fixed"
	// KindProbe: an IT8613E whose header wiring is not known. Fan control stays off until the user confirmed a map
	// found by `probe-fans run`.
	KindProbe = "probe"
)

// FanKind says how the model's fans are reached, "" for a model without fan control (plain iDX6011 and iDX6012,
// every DX and the rest).
func FanKind(model string) string {
	switch {
	case strings.HasPrefix(model, "DXP6800"), isDXP4800GT(model), isIdxPro(model):
		return KindFixed
	case isProbeModel(model):
		return KindProbe
	}
	return ""
}

func isIdxPro(model string) bool { return chip.IdxLayout(model) == "idx-pro" }

// isProbeModel: the IT8613E models without a known header map. The IT8613E at 0xa30 on the DXP2800 shows a fan
// on tach 3 and none on tach 2; the DXP4800 Plus uses outputs 2 and 3 (see probeHints). The rest follows the
// same board family; nothing is assumed, the probe decides.
func isProbeModel(model string) bool {
	switch model {
	case "DXP2800", "DXP4800", "DXP4800 Plus", "DXP4800 Pro", "DXP8800 Plus":
		return true
	}
	return false
}

// probeHint is what community reports say about a model; the probe compares its result with it, never trusts it.
// Sources (facts only, nothing copied): IT-Kuny/UGREEN-DXP-FAN-NAS-Driver README:262 (GPL-3.0; DXP2800: IT8613E at
// 0xa30, fan2 0 rpm, fan3 1726 rpm) and smashah/ugreen-dxp-fan-cli (DXP4800 Plus drives pwm2 and pwm3).
type probeHint struct {
	PWMs  []string // outputs that should move a fan
	Tachs []string // tach inputs that should read a fan
}

var probeHints = map[string]probeHint{
	"DXP2800":      {Tachs: []string{"fan3"}},
	"DXP4800 Plus": {PWMs: []string{"pwm2", "pwm3"}},
}

// Fan floor of the probe models: the driver never writes less, and the probe never drives below it. Case fans of
// this class stall near 20 % (iDX6011 Pro measurement of the same family, noodlemctwoodle fan.h:25-31), so 25 %.
const probeFloorPct = 25

// Limits found for single models, more conservative than the defaults: iDX6011 Pro critical CPU 88 °C, disk 60 °C
// (noodlemctwoodle/unraid-ugreen-idx6011-pro, MIT, src/panel/fan.h:25-31@d202a7c).
func modelLimits(model string) (cpuCrit, diskCrit int, ok bool) {
	if isIdxPro(model) {
		return 88, 60, true
	}
	return 0, 0, false
}

// ApplyModelLimits lowers the emergency limits of a config to what the model needs; it never raises one.
func ApplyModelLimits(c Config, model string) Config {
	if cpu, disk, ok := modelLimits(model); ok {
		c.CPUCrit = min(c.CPUCrit, cpu)
		c.DiskCrit = min(c.DiskCrit, disk)
	}
	return c
}

// The confirmed fan map of a probe model. Without a valid one, fan control stays off.
var fanMapPath = envOr("UGREEN_FAN_MAP", filepath.Join(filepath.Dir(configPath), "fan_map.json"))

// FanMap is the file /boot/config/plugins/ugreen-nas-control/fan_map.json.
type FanMap struct {
	Version int            `json:"version"`
	Model   string         `json:"model"`
	Chip    string         `json:"chip"`
	Time    int64          `json:"time"`
	Outputs []FanMapOutput `json:"outputs"`
}

// FanMapOutput: fan ID (fan1..fan4, the daemon's roles) driven by output PWM, read on tach input Tach.
type FanMapOutput struct {
	ID   string `json:"id"`
	Role string `json:"role"` // cpu or case
	PWM  string `json:"pwm"`
	Tach string `json:"tach"`
}

var errNoFanMap = errors.New("no confirmed fan map")

// loadFanMap reads the map; errNoFanMap when there is none, another error when it does not fit this NAS.
func loadFanMap(model string) (*FanMap, error) {
	b, err := os.ReadFile(fanMapPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, errNoFanMap
	}
	if err != nil {
		return nil, err
	}
	var m FanMap
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("fan map unreadable: %w", err)
	}
	if err := m.validate(model); err != nil {
		return nil, fmt.Errorf("fan map ignored: %w", err)
	}
	return &m, nil
}

func (m *FanMap) validate(model string) error {
	if m.Version != 1 || m.Chip != "IT8613" {
		return errors.New("unknown format")
	}
	if m.Model != model {
		return fmt.Errorf("made for %q, this is %q", m.Model, model)
	}
	if len(m.Outputs) == 0 || len(m.Outputs) > itePWMCount {
		return errors.New("no fans in it")
	}
	var ids, pwms, tachs []string
	for _, o := range m.Outputs {
		if _, ok := iteHeaderOf("pwm", o.PWM, itePWMCount); !ok {
			return fmt.Errorf("unknown output %q", o.PWM)
		}
		if _, ok := iteHeaderOf("fan", o.Tach, len(it8613Headers)); !ok {
			return fmt.Errorf("unknown tach %q", o.Tach)
		}
		if r, ok := roles[o.ID]; !ok || r != o.Role {
			return fmt.Errorf("fan %q is not a %s fan", o.ID, o.Role)
		}
		if slices.Contains(ids, o.ID) || slices.Contains(pwms, o.PWM) || slices.Contains(tachs, o.Tach) {
			return errors.New("an id, output or tach is used twice")
		}
		ids, pwms, tachs = append(ids, o.ID), append(pwms, o.PWM), append(tachs, o.Tach)
	}
	return nil
}

// channels turns the map into daemon channels: tach of one header, PWM of another where the board crosses them.
func (m *FanMap) channels() []Channel {
	out := make([]Channel, 0, len(m.Outputs))
	for _, o := range m.Outputs {
		t, _ := iteHeaderOf("fan", o.Tach, len(it8613Headers))
		p, _ := iteHeaderOf("pwm", o.PWM, itePWMCount)
		out = append(out, iteChannel(o.ID, t, p))
	}
	slices.SortFunc(out, func(a, b Channel) int { return strings.Compare(a.ID, b.ID) })
	return out
}

// allocateIDs gives each chosen output a fan ID that fits its role (the daemon's roles table is fixed:
// fan1, fan2 = cpu, fan3, fan4 = case). "fanN" for pwmN when that fits, else the first free one.
func allocateIDs(choice map[string]string) ([]FanMapOutput, error) {
	pwms := make([]string, 0, len(choice))
	for pwm := range choice {
		pwms = append(pwms, pwm)
	}
	slices.Sort(pwms)

	used := map[string]bool{}
	var out []FanMapOutput
	for _, pwm := range pwms {
		n, _ := iteHeaderOf("pwm", pwm, itePWMCount)
		id := tachID(n + 1)
		if roles[id] == choice[pwm] && !used[id] {
			used[id] = true
			out = append(out, FanMapOutput{ID: id, Role: choice[pwm], PWM: pwm})
		}
	}
	for _, pwm := range pwms {
		if slices.ContainsFunc(out, func(o FanMapOutput) bool { return o.PWM == pwm }) {
			continue
		}
		var id string
		for _, c := range []string{"fan1", "fan2", "fan3", "fan4"} {
			if roles[c] == choice[pwm] && !used[c] {
				id = c
				break
			}
		}
		if id == "" {
			return nil, fmt.Errorf("at most two %s fans", choice[pwm])
		}
		used[id] = true
		out = append(out, FanMapOutput{ID: id, Role: choice[pwm], PWM: pwm})
	}
	slices.SortFunc(out, func(a, b FanMapOutput) int { return strings.Compare(a.ID, b.ID) })
	return out, nil
}

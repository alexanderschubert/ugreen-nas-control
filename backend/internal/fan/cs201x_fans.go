package fan

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"slices"
	"time"
)

// Fan driver of the DXP2800 GT (CS201x embedded controller). Registers and sequence after UGREEN's GPL-2.0-only
// driver ug_201x.c@c75c5ab (facts only): the fan registers are plain bytes behind the host-to-EC window, the duty
// is a percentage (0..100, ug_201x.c:311-328), the speed register is rpm (ug_201x.c:293-309). The driver has no
// automatic mode and does not hand the fans back on unload (ug_201x.c:816-832), so Restore writes the duty found
// at the start back.
//
// Off by default: the model counts as a fan model only with a confirmed map (`ugreen-nas-fan cs201x confirm`,
// stored in fan_map.json like the IT8613E models). Nothing is written before the first Snapshot or SetPWM; the
// host interface (cfg 0x30 = 1, ug_201x.c:264-266) is switched on there if it is off.
const (
	csChip = "CS201x"

	// csFloorPct: no duty below this is written. The stall point of the fans is not measured on this model; the
	// other GT-class models stall near 20 % (see probeFloorPct).
	csFloorPct = probeFloorPct
	// csSafePct is written back when no usable duty was saved: UGREEN's driver has no automatic mode to return to.
	csSafePct = 60
)

type csFan struct {
	id, role      string
	en, duty, spd uint32
}

// fan1 is the CPU fan (UGREEN fan0, "cpufan"), fan3 the system fan (UGREEN fan1, "sysfan1"): ug_201x.c:86-94,453-457.
var csFans = []csFan{
	{"fan1", "cpu", csRegFan0En, csRegFan0Duty, csRegFan0Spd},
	{"fan3", "case", csRegFan1En, csRegFan1Duty, csRegFan1Spd},
}

func csFanOf(id string) (csFan, bool) {
	i := slices.IndexFunc(csFans, func(f csFan) bool { return f.id == id })
	if i < 0 {
		return csFan{}, false
	}
	return csFans[i], true
}

type CS201x struct {
	p        Ports
	ec       csEC
	chans    []Channel
	active   bool // the host interface is on
	hostOn   bool // this instance made sure of it (writes allowed)
	prepared bool // fan enables and temperature inputs are set
}

var errCSNotConfirmed = errors.New("fan control of the DXP2800 GT is off until you confirm the fans: ugreen-nas-fan cs201x confirm")

// DetectCS201x opens the driver for a confirmed map. It only reads.
func DetectCS201x(p Ports, model string) (*CS201x, error) {
	m, err := loadCS201xMap(model)
	if err != nil {
		if errors.Is(err, errNoFanMap) {
			return nil, errCSNotConfirmed
		}
		return nil, err
	}
	w, err := csReadWindow(p, false)
	if err != nil {
		return nil, err
	}
	if !plausibleBase(w.Base) {
		return nil, fmt.Errorf("implausible base address 0x%04x of the embedded controller", w.Base)
	}
	c := &CS201x{p: p, ec: csEC{P: p, Base: w.Base}, active: w.Active&0x01 != 0}
	for _, o := range m.Outputs {
		c.chans = append(c.chans, Channel{ID: o.ID})
	}
	return c, nil
}

func (c *CS201x) Name() string     { return csChip }
func (c *CS201x) Describe() string { return "Chipsea CS201x embedded controller" }
func (c *CS201x) Details() map[string]any {
	return map[string]any{"base": fmt.Sprintf("0x%04x", c.ec.Base), "host_interface": c.active}
}
func (c *CS201x) Outputs() []Channel  { return c.chans }
func (c *CS201x) MaxDuty() byte       { return 100 }  // percent
func (c *CS201x) AutoDutyKnown() bool { return true } // no automatic mode: the register is the output

// switchOn makes sure the host interface is on; the first write path calls it.
func (c *CS201x) switchOn() error {
	if c.hostOn {
		return nil
	}
	w, err := csReadWindow(c.p, true)
	if err != nil {
		return err
	}
	if w.Active&0x01 == 0 || !plausibleBase(w.Base) {
		return errors.New("the host interface of the embedded controller does not switch on")
	}
	c.ec.Base, c.active, c.hostOn = w.Base, true, true
	return nil
}

// prepare sets what UGREEN sets at load before it uses the fans and temperatures (ug_201x.c:267-272), but only
// where it reads 0: the fan enables, and the temperature input of a channel whose temperature reads 0.
func (c *CS201x) prepare() error {
	if c.prepared {
		return nil
	}
	if err := c.switchOn(); err != nil {
		return err
	}
	set := func(reg uint32) error {
		if v, err := c.ec.Read(reg); err != nil || v != 0 {
			return err
		}
		return c.ec.Write(reg, 1)
	}
	for _, ch := range c.chans {
		f, _ := csFanOf(ch.ID)
		if err := set(f.en); err != nil {
			return err
		}
	}
	for _, t := range []struct{ temp, cfg uint32 }{{csRegNTC2, csRegADC2Cfg}, {csRegNTC4, csRegADC4Cfg}} {
		if v, err := c.ec.Read(t.temp); err != nil {
			return err
		} else if v == 0 {
			if err := set(t.cfg); err != nil {
				return err
			}
		}
	}
	c.prepared = true
	return nil
}

func (c *CS201x) readable() error {
	if !c.active {
		return errors.New("the host interface of the embedded controller is off")
	}
	return nil
}

func (c *CS201x) RPM(ch Channel) (int, error) {
	f, ok := csFanOf(ch.ID)
	if !ok {
		return 0, fmt.Errorf("unknown fan %q", ch.ID)
	}
	if err := c.readable(); err != nil {
		return 0, err
	}
	hi, err := c.ec.Read(f.spd)
	if err != nil {
		return 0, err
	}
	lo, err := c.ec.Read(f.spd + 1)
	if err != nil {
		return 0, err
	}
	return int(hi)<<8 | int(lo), nil
}

func (c *CS201x) PWM(ch Channel) (byte, bool, error) {
	f, ok := csFanOf(ch.ID)
	if !ok {
		return 0, false, fmt.Errorf("unknown fan %q", ch.ID)
	}
	if err := c.readable(); err != nil {
		return 0, false, err
	}
	d, err := c.ec.Read(f.duty)
	return d, false, err
}

func (c *CS201x) SetPWM(ch Channel, duty byte) error {
	f, ok := csFanOf(ch.ID)
	if !ok {
		return fmt.Errorf("unknown fan %q", ch.ID)
	}
	if err := c.prepare(); err != nil {
		return err
	}
	return c.ec.Write(f.duty, min(max(duty, csFloorPct), 100))
}

func (c *CS201x) temp(reg uint32) *int {
	if c.readable() != nil {
		return nil
	}
	v, err := c.ec.Read(reg)
	if err != nil || v == 0 || v == 0xff {
		return nil
	}
	t := int(v)
	return &t
}

// Temps: NTC2, UGREEN's cpu_temp. The mainboard (NTC4, board_temp) goes through BoardTemp.
func (c *CS201x) Temps() []*int   { return []*int{c.temp(csRegNTC2)} }
func (c *CS201x) BoardTemp() *int { return c.temp(csRegNTC4) }

// Snapshot is {enable, duty} per fan as found. It switches the host interface on (it must, to read) but writes
// nothing else.
func (c *CS201x) Snapshot() (Snapshot, error) {
	if err := c.switchOn(); err != nil {
		return nil, err
	}
	s := Snapshot{}
	for _, ch := range c.chans {
		f, _ := csFanOf(ch.ID)
		en, err := c.ec.Read(f.en)
		if err != nil {
			return nil, err
		}
		duty, err := c.ec.Read(f.duty)
		if err != nil {
			return nil, err
		}
		s[ch.ID] = [2]byte{en, duty}
	}
	return s, nil
}

// Restore writes the saved duty back, and the enable value where it differs. A fan without a usable saved duty
// (none, or 0, which would stop it) gets csSafePct: there is no automatic mode to give it to.
func (c *CS201x) Restore(s Snapshot) error {
	if err := c.switchOn(); err != nil {
		return err
	}
	var errs []error
	for _, ch := range c.chans {
		f, _ := csFanOf(ch.ID)
		saved, have := s[ch.ID]
		duty := min(saved[1], 100)
		if !have || duty == 0 {
			duty = csSafePct
		}
		errs = append(errs, c.ec.Write(f.duty, duty))
		if have && saved[0] <= 1 {
			if en, err := c.ec.Read(f.en); err == nil && en != saved[0] {
				errs = append(errs, c.ec.Write(f.en, saved[0]))
			}
		}
	}
	return errors.Join(errs...)
}

// loadCS201xMap reads the confirmed map of the DXP2800 GT from fan_map.json; errNoFanMap when there is none.
func loadCS201xMap(model string) (*FanMap, error) {
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
	if m.Version != 1 || m.Chip != csChip {
		return nil, errors.New("fan map ignored: unknown format")
	}
	if m.Model != model {
		return nil, fmt.Errorf("fan map ignored: made for %q, this is %q", m.Model, model)
	}
	var seen []string
	for _, o := range m.Outputs {
		f, ok := csFanOf(o.ID)
		if !ok || f.role != o.Role || slices.Contains(seen, o.ID) {
			return nil, fmt.Errorf("fan map ignored: bad entry %q", o.ID)
		}
		seen = append(seen, o.ID)
	}
	if len(seen) == 0 {
		return nil, errors.New("fan map ignored: no fans in it")
	}
	return &m, nil
}

// confirmCS201x saves the fans the user names (default: all) as the confirmed map. With the host interface on, a
// fan that reads no rpm is refused (nothing is connected there). It reads only.
func confirmCS201x(p Ports, model string, ids []string) (*FanMap, error) {
	if len(ids) == 0 {
		for _, f := range csFans {
			ids = append(ids, f.id)
		}
	}
	rd, err := ProbeCS201x(p, model)
	if err != nil {
		return nil, err
	}
	m := &FanMap{Version: 1, Model: model, Chip: csChip, Time: time.Now().Unix()}
	for _, id := range ids {
		f, ok := csFanOf(id)
		if !ok {
			return nil, fmt.Errorf("unknown fan %q (fan1 = cpu, fan3 = case)", id)
		}
		// The probe lists the fans in the order of csFans.
		if i := slices.IndexFunc(csFans, func(x csFan) bool { return x.id == id }); rd.HostEC == "active" && i < len(rd.Fans) && rd.Fans[i].RPM == 0 {
			return nil, fmt.Errorf("%s reads no rpm: nothing connected, or the fan is stopped", id)
		}
		m.Outputs = append(m.Outputs, FanMapOutput{ID: id, Role: f.role, PWM: "duty", Tach: "rpm"})
	}
	if err := writeJSONAtomic(fanMapPath, m); err != nil {
		return nil, fmt.Errorf("cannot save %s: %w", fanMapPath, err)
	}
	return m, nil
}

package main

import (
	"errors"
	"fmt"
	"strings"
)

// Chipsea CS201x Super-I/O with an embedded controller, as found in the
// DXP2800 GT: the fans hang on it. The register map is that of the register
// addresses UGREEN published for the chip (GPL kernel driver ug_201x.c); no
// code of it is used. The wiring was read on a real DXP2800 GT (issue #95):
// fan 0 is the CPU fan, fan 1 the system fan, duty in percent, rpm as a
// 16-bit number. There is no automatic mode: left alone the fans keep the
// duty the BIOS set (60 %).
const (
	cs201xID = 0x2011

	// Super-I/O config mode: the unlock key is written to the index port, the
	// same three bytes in reverse order lock it again.
	csLDNHost2EC = 0x0a

	// Offsets from the base address of the host-to-EC interface.
	csEcCtrl = 0x01 // 0 = one byte, no auto increment
	csEcAddr = 0x04 // 32-bit register address, least significant byte first
	csEcData = 0x08

	csRegFan0En   = 0x200053f0
	csRegFan1En   = 0x200053f1
	csRegFan0Duty = 0x200053f4 // percent, 0-100
	csRegFan1Duty = 0x200053f5
	csRegFan0Spd  = 0x200053f8 // high byte, the low byte follows; already rpm
	csRegFan1Spd  = 0x200053fa
	csRegNTC2     = 0x200053e2 // °C
	csRegNTC4     = 0x200053e4
	csRegFWVer    = 0x200054fc
)

var csEnterKey = []byte{0xa5, 0x69, 0x87}
var csExitKey = []byte{0x87, 0x69, 0xa5}

// CS201xReading is what the read-only probe found.
type CS201xReading struct {
	Model     string         `json:"model"`
	ChipID    string         `json:"chip_id"`
	Revision  string         `json:"revision"`
	HostEC    string         `json:"host_ec"` // active / not active
	Base      string         `json:"base,omitempty"`
	Fans      []CS201xFan    `json:"fans,omitempty"`
	Temps     map[string]int `json:"temps,omitempty"`
	FWVersion string         `json:"ec_firmware,omitempty"`
	Notes     []string       `json:"notes,omitempty"`
}

type CS201xFan struct {
	ID      string `json:"id"`
	Role    string `json:"role"`
	Enabled int    `json:"enabled_reg"`
	Duty    int    `json:"duty_pct"`
	RPM     int    `json:"rpm"`
}

func isDXP2800GT(model string) bool {
	return strings.HasPrefix(model, "DXP2800 GT")
}

// csConfig is what the Super-I/O config registers say about the chip.
type csConfig struct {
	id     uint16
	rev    byte
	active byte
	base   uint16
}

// csLocate reads the chip id and, if it is a CS201x, where the host interface
// of the embedded controller sits. It writes the unlock key to the config
// index port, the logical device number (device 0x0A) and nothing else, and
// leaves config mode again, whatever it found. It does not switch the host
// interface on.
func csLocate(p Ports) (csConfig, error) {
	var c csConfig
	for _, b := range csEnterKey {
		if err := p.Out(sioIndex, b); err != nil {
			return c, err
		}
	}
	read := func(reg byte) byte {
		if p.Out(sioIndex, reg) != nil {
			return 0xff
		}
		v, err := p.In(sioData)
		if err != nil {
			return 0xff
		}
		return v
	}
	leave := func() {
		for _, b := range csExitKey {
			_ = p.Out(sioIndex, b)
		}
	}
	defer leave()

	c.id = uint16(read(sioRegChipID))<<8 | uint16(read(sioRegChipID+1))
	c.rev = read(sioRegRev)
	if c.id != cs201xID {
		return c, fmt.Errorf("Super-I/O chip id 0x%04x, expected 0x%04x", c.id, cs201xID)
	}

	_ = p.Out(sioIndex, sioRegLDN)
	_ = p.Out(sioData, csLDNHost2EC)
	c.active = read(sioRegActive)
	c.base = uint16(read(sioRegBaseHi))<<8 | uint16(read(sioRegBaseLo))
	return c, nil
}

// csReadEC reads one byte of the embedded controller's register space.
func csReadEC(p Ports, base uint16, reg uint32) (byte, error) {
	if err := csLatch(p, base, reg); err != nil {
		return 0, err
	}
	return p.In(base + csEcData)
}

func csWriteEC(p Ports, base uint16, reg uint32, v byte) error {
	if err := csLatch(p, base, reg); err != nil {
		return err
	}
	return p.Out(base+csEcData, v)
}

// csLatch selects a register: one byte, no auto increment, the 32-bit address
// least significant byte first.
func csLatch(p Ports, base uint16, reg uint32) error {
	if err := p.Out(base+csEcCtrl, 0); err != nil {
		return err
	}
	for i := 0; i < 4; i++ {
		if err := p.Out(base+csEcAddr+uint16(i), byte(reg>>(8*i))); err != nil {
			return err
		}
	}
	return nil
}

// ProbeCS201x reads the chip ID, the base address of the embedded controller
// and its fan and temperature registers. What it writes: the unlock key to the
// config index port, the logical device number (to look at device 0x0A), and
// the address latch of the embedded controller (needed for every read). It
// never writes a data register, never switches the host interface on and never
// touches a fan setting.
func ProbeCS201x(p Ports, model string) (CS201xReading, error) {
	r := CS201xReading{Model: model, Temps: map[string]int{}}

	c, err := csLocate(p)
	r.ChipID = fmt.Sprintf("0x%04x", c.id)
	r.Revision = fmt.Sprintf("0x%02x", c.rev)
	if err != nil {
		return r, fmt.Errorf("%w: nothing else was read", err)
	}

	if c.active&0x01 == 0 {
		r.HostEC = "not active"
		r.Notes = append(r.Notes, "the host interface of the embedded controller is off; it is not switched on by this read-only probe")
		return r, errors.New("host interface of the embedded controller is not active")
	}
	r.HostEC = "active"
	if c.base < 0x100 || c.base == 0xffff {
		return r, fmt.Errorf("implausible base address 0x%04x", c.base)
	}
	r.Base = fmt.Sprintf("0x%04x", c.base)

	var firstErr error
	get := func(reg uint32) int {
		v, err := csReadEC(p, c.base, reg)
		if err != nil && firstErr == nil {
			firstErr = err
		}
		return int(v)
	}

	for i, f := range cs201xFans {
		r.Fans = append(r.Fans, CS201xFan{
			ID:      fmt.Sprintf("fan%d", i),
			Role:    f.role,
			Enabled: get(f.en),
			Duty:    get(f.duty),
			RPM:     get(f.spd)<<8 | get(f.spd+1),
		})
	}
	r.Temps["ntc2"] = int(int8(get(csRegNTC2)))
	r.Temps["ntc4"] = int(int8(get(csRegNTC4)))
	r.FWVersion = fmt.Sprintf("0x%02x", get(csRegFWVer))

	return r, firstErr
}

// csFan is one fan output of the embedded controller.
type csFan struct {
	id            string
	role          string
	en, duty, spd uint32
}

var cs201xFans = []csFan{
	{"csfan0", "cpu", csRegFan0En, csRegFan0Duty, csRegFan0Spd},
	{"csfan1", "case", csRegFan1En, csRegFan1Duty, csRegFan1Spd},
}

// The lowest duty this tool ever writes. The controller has no automatic mode
// of its own, so a fan left at a low value by a crashed daemon would stay
// there; 25 % is the value both fans were measured to turn at (about 1800 and
// 600 rpm).
const csMinDuty = 25

// CS201x is the embedded controller of the DXP2800 GT.
type CS201x struct {
	ports Ports
	base  uint16
	rev   byte
}

// DetectCS201x finds the chip, checks that the embedded controller answers and
// that the fan registers hold plausible values before anything may write.
func DetectCS201x(p Ports) (*CS201x, error) {
	c, err := csLocate(p)
	if err != nil {
		return nil, fmt.Errorf("no supported fan controller found (%w)", err)
	}
	if c.active&0x01 == 0 {
		return nil, errors.New("the host interface of the CS201x embedded controller is not enabled by the BIOS")
	}
	if c.base < 0x100 || c.base == 0xffff {
		return nil, fmt.Errorf("CS201x embedded controller at implausible address 0x%04x", c.base)
	}
	ec := &CS201x{ports: p, base: c.base, rev: c.rev}
	for _, f := range cs201xFans {
		duty, err := ec.read(f.duty)
		if err != nil {
			return nil, fmt.Errorf("CS201x embedded controller does not answer: %w", err)
		}
		if duty > 100 {
			return nil, fmt.Errorf("CS201x embedded controller answers unexpectedly (duty %d)", duty)
		}
	}
	return ec, nil
}

func (c *CS201x) read(reg uint32) (byte, error) { return csReadEC(c.ports, c.base, reg) }

func (c *CS201x) fan(ch Channel) (csFan, error) {
	for _, f := range cs201xFans {
		if f.id == ch.ID {
			return f, nil
		}
	}
	return csFan{}, fmt.Errorf("unknown fan %q", ch.ID)
}

func (c *CS201x) Name() string { return "CS2011" }

func (c *CS201x) Describe() string {
	return fmt.Sprintf("CS2011 embedded controller at 0x%04x", c.base)
}

func (c *CS201x) Details() map[string]any {
	return map[string]any{"revision": c.rev, "base": fmt.Sprintf("0x%04x", c.base)}
}

func (c *CS201x) Outputs() []Channel {
	out := make([]Channel, len(cs201xFans))
	for i, f := range cs201xFans {
		out[i] = Channel{ID: f.id}
	}
	return out
}

// Duty is a percentage.
func (c *CS201x) MaxDuty() byte { return 100 }

// The duty register is what drives the fan: there is no automatic mode.
func (c *CS201x) AutoDutyKnown() bool { return true }

func (c *CS201x) RPM(ch Channel) (int, error) {
	f, err := c.fan(ch)
	if err != nil {
		return 0, err
	}
	hi, err := c.read(f.spd)
	if err != nil {
		return 0, err
	}
	lo, err := c.read(f.spd + 1)
	if err != nil {
		return 0, err
	}
	return int(hi)<<8 | int(lo), nil
}

// PWM reports the duty; auto is only set while the fan is switched off.
func (c *CS201x) PWM(ch Channel) (duty byte, auto bool, err error) {
	f, err := c.fan(ch)
	if err != nil {
		return 0, false, err
	}
	if duty, err = c.read(f.duty); err != nil {
		return 0, false, err
	}
	en, err := c.read(f.en)
	if err != nil {
		return 0, false, err
	}
	return duty, en&1 == 0, nil
}

// SetPWM sets the duty, at least csMinDuty. Of the enable register only bit 0
// is touched: the BIOS leaves 0x11 and 0x21 there and the meaning of the other
// bits is not known. Every value written is read back.
func (c *CS201x) SetPWM(ch Channel, duty byte) error {
	f, err := c.fan(ch)
	if err != nil {
		return err
	}
	duty = min(max(duty, csMinDuty), 100)

	en, err := c.read(f.en)
	if err != nil {
		return err
	}
	if en&1 == 0 {
		if err := c.writeVerified(f.en, en|1); err != nil {
			return err
		}
	}
	return c.writeVerified(f.duty, duty)
}

func (c *CS201x) writeVerified(reg uint32, v byte) error {
	if err := csWriteEC(c.ports, c.base, reg, v); err != nil {
		return err
	}
	got, err := c.read(reg)
	if err != nil {
		return err
	}
	if got != v {
		return fmt.Errorf("embedded controller register 0x%08x: wrote 0x%02x, read back 0x%02x", reg, v, got)
	}
	return nil
}

func (c *CS201x) temp(reg uint32) *int {
	v, err := c.read(reg)
	if err != nil || v == 0 || v == 0xff {
		return nil
	}
	t := int(int8(v))
	return &t
}

// BoardTemp is the board NTC in °C.
func (c *CS201x) BoardTemp() *int { return c.temp(csRegNTC4) }

// Temps in °C: the NTC near the CPU.
func (c *CS201x) Temps() []*int { return []*int{c.temp(csRegNTC2)} }

// Snapshot keeps the enable register and the duty of every fan.
func (c *CS201x) Snapshot() (Snapshot, error) {
	s := Snapshot{}
	for _, f := range cs201xFans {
		en, err := c.read(f.en)
		if err != nil {
			return nil, err
		}
		duty, err := c.read(f.duty)
		if err != nil {
			return nil, err
		}
		s[f.id] = [2]byte{en, duty}
	}
	return s, nil
}

// Restore writes back what the BIOS had set: with no automatic mode, that is
// its duty. A fan the snapshot does not know is left alone.
func (c *CS201x) Restore(s Snapshot) error {
	var errs []error
	for _, f := range cs201xFans {
		v, ok := s[f.id]
		if !ok {
			continue
		}
		if v[1] > 100 {
			errs = append(errs, fmt.Errorf("%s: saved duty %d is not a percentage, not written back", f.id, v[1]))
			continue
		}
		errs = append(errs, c.writeVerified(f.duty, v[1]), c.writeVerified(f.en, v[0]))
	}
	return errors.Join(errs...)
}

package main

import "testing"

// fakeCS answers like the CS201x of the DXP2800 GT; it records every write.
type fakeCS struct {
	idx     byte
	id      uint16
	active  byte
	base    uint16
	ec      map[uint32]byte
	addr    [4]byte
	writes  []uint16        // ports written
	ecData  []byte          // values written to the data port
	cfgData []byte          // values written to the config data port
	written []uint32        // EC registers written, in order
	stuck   map[uint32]bool // writes to these registers have no effect
}

func newFakeCS() *fakeCS {
	return &fakeCS{id: 0x2011, active: 1, base: 0x200, ec: map[uint32]byte{
		csRegFan0En: 1, csRegFan1En: 1, csRegFan0Duty: 25, csRegFan1Duty: 25,
		csRegFan0Spd: 0x07, csRegFan0Spd + 1: 0x08, // 1800
		csRegFan1Spd: 0x02, csRegFan1Spd + 1: 0x58, // 600
		csRegNTC2: 41, csRegNTC4: 38, csRegFWVer: 0x12,
	}}
}

func (f *fakeCS) In(port uint16) (byte, error) {
	switch port {
	case sioData:
		switch f.idx {
		case 0x20:
			return byte(f.id >> 8), nil
		case 0x21:
			return byte(f.id), nil
		case 0x30:
			return f.active, nil
		case 0x60:
			return byte(f.base >> 8), nil
		case 0x61:
			return byte(f.base), nil
		}
		return 0, nil
	case f.base + csEcData:
		a := uint32(f.addr[0]) | uint32(f.addr[1])<<8 | uint32(f.addr[2])<<16 | uint32(f.addr[3])<<24
		return f.ec[a], nil
	}
	return 0xff, nil
}

func (f *fakeCS) Out(port uint16, v byte) error {
	f.writes = append(f.writes, port)
	switch {
	case port == sioIndex:
		f.idx = v
	case port == sioData:
		f.cfgData = append(f.cfgData, v)
	case port >= f.base+csEcAddr && port < f.base+csEcAddr+4:
		f.addr[port-f.base-csEcAddr] = v
	case port == f.base+csEcData:
		f.ecData = append(f.ecData, v)
		a := uint32(f.addr[0]) | uint32(f.addr[1])<<8 | uint32(f.addr[2])<<16 | uint32(f.addr[3])<<24
		f.written = append(f.written, a)
		if !f.stuck[a] {
			f.ec[a] = v
		}
	}
	return nil
}

func (f *fakeCS) Close() error { return nil }

func TestProbeCS201xReads(t *testing.T) {
	f := newFakeCS()
	r, err := ProbeCS201x(f, "DXP2800 GT")
	if err != nil {
		t.Fatal(err)
	}
	if r.ChipID != "0x2011" || r.Base != "0x0200" || r.HostEC != "active" {
		t.Fatalf("chip: %+v", r)
	}
	if len(r.Fans) != 2 || r.Fans[0].RPM != 1800 || r.Fans[1].RPM != 600 || r.Fans[0].Duty != 25 || r.Fans[0].Role != "cpu" {
		t.Fatalf("fans: %+v", r.Fans)
	}
	if r.Temps["ntc2"] != 41 || r.Temps["ntc4"] != 38 {
		t.Fatalf("temps: %+v", r.Temps)
	}
}

// The probe must never write an EC data register, and the only values it puts on
// the config data port select device 0x0A.
func TestProbeCS201xWritesNothingToTheEC(t *testing.T) {
	f := newFakeCS()
	if _, err := ProbeCS201x(f, "DXP2800 GT"); err != nil {
		t.Fatal(err)
	}
	if len(f.ecData) != 0 {
		t.Fatalf("data register written: %v", f.ecData)
	}
	if len(f.cfgData) != 1 || f.cfgData[0] != csLDNHost2EC {
		t.Fatalf("config data written: %v", f.cfgData)
	}
}

func TestProbeCS201xStopsOnOtherChip(t *testing.T) {
	f := newFakeCS()
	f.id = 0x8613
	if _, err := ProbeCS201x(f, "DXP2800 GT"); err == nil {
		t.Fatal("other chip accepted")
	}
	if len(f.cfgData) != 0 {
		t.Fatalf("went on after the wrong id: %v", f.cfgData)
	}
}

func TestProbeCS201xDoesNotSwitchTheECOn(t *testing.T) {
	f := newFakeCS()
	f.active = 0
	r, err := ProbeCS201x(f, "DXP2800 GT")
	if err == nil || r.HostEC != "not active" {
		t.Fatalf("got %+v, %v", r, err)
	}
	if len(f.cfgData) != 1 {
		t.Fatalf("config written: %v", f.cfgData)
	}
}

func TestIsDXP2800GT(t *testing.T) {
	if !isDXP2800GT("DXP2800 GT") || isDXP2800GT("DXP2800") || isDXP2800GT("DXP4800 GT") {
		t.Fatal("model match")
	}
}

func TestDetectCS201x(t *testing.T) {
	if _, err := DetectCS201x(newFakeCS()); err != nil {
		t.Fatal(err)
	}
	other := newFakeCS()
	other.id = 0x5571
	if _, err := DetectCS201x(other); err == nil {
		t.Fatal("other chip accepted")
	}
	off := newFakeCS()
	off.active = 0
	if _, err := DetectCS201x(off); err == nil {
		t.Fatal("inactive host interface accepted")
	}
	odd := newFakeCS()
	odd.ec[csRegFan1Duty] = 0xc6
	if _, err := DetectCS201x(odd); err == nil {
		t.Fatal("duty above 100 accepted")
	}
	for _, f := range []*fakeCS{other, off, odd} {
		if len(f.written) != 0 {
			t.Fatalf("a refused chip got writes: %x", f.written)
		}
	}
}

func TestCS201xReadings(t *testing.T) {
	c, err := DetectCS201x(newFakeCS())
	if err != nil {
		t.Fatal(err)
	}
	outs := c.Outputs()
	if len(outs) != 2 || roles[outs[0].ID] != "cpu" || roles[outs[1].ID] != "case" {
		t.Fatalf("outputs %+v", outs)
	}
	if rpm, _ := c.RPM(outs[0]); rpm != 1800 {
		t.Fatalf("cpu rpm %d", rpm)
	}
	if rpm, _ := c.RPM(outs[1]); rpm != 600 {
		t.Fatalf("case rpm %d", rpm)
	}
	if duty, auto, err := c.PWM(outs[0]); duty != 25 || auto || err != nil {
		t.Fatalf("pwm %d %v %v", duty, auto, err)
	}
	if tt := c.Temps(); len(tt) != 1 || tt[0] == nil || *tt[0] != 41 {
		t.Fatalf("temps %v", tt)
	}
	if bt := c.BoardTemp(); bt == nil || *bt != 38 {
		t.Fatalf("board %v", bt)
	}
}

// The duty is written, nothing else: the enable register of a running fan is not touched, and the duty never goes
// below the floor or above 100 %.
func TestCS201xSetPWM(t *testing.T) {
	f := newFakeCS()
	f.ec[csRegFan0En] = 0x11
	c, _ := DetectCS201x(f)
	out := c.Outputs()[0]

	if err := c.SetPWM(out, 60); err != nil {
		t.Fatal(err)
	}
	if f.ec[csRegFan0Duty] != 60 || f.ec[csRegFan0En] != 0x11 {
		t.Fatalf("duty %d enable 0x%02x", f.ec[csRegFan0Duty], f.ec[csRegFan0En])
	}
	for _, reg := range f.written {
		if reg != csRegFan0Duty {
			t.Fatalf("wrote register 0x%08x", reg)
		}
	}
	if err := c.SetPWM(out, 5); err != nil || f.ec[csRegFan0Duty] != csMinDuty {
		t.Fatalf("floor: duty %d err %v", f.ec[csRegFan0Duty], err)
	}
	if err := c.SetPWM(out, 250); err != nil || f.ec[csRegFan0Duty] != 100 {
		t.Fatalf("ceiling: duty %d err %v", f.ec[csRegFan0Duty], err)
	}
	if f.ec[csRegFan1Duty] != 25 {
		t.Fatalf("the other fan was touched: %d", f.ec[csRegFan1Duty])
	}
}

// A fan that is switched off is switched on through bit 0 only; the other bits stay.
func TestCS201xSetPWMKeepsEnableBits(t *testing.T) {
	f := newFakeCS()
	f.ec[csRegFan1En] = 0x20
	c, _ := DetectCS201x(f)
	if _, auto, _ := c.PWM(c.Outputs()[1]); !auto {
		t.Fatal("a switched-off fan is not reported as such")
	}
	if err := c.SetPWM(c.Outputs()[1], 40); err != nil {
		t.Fatal(err)
	}
	if f.ec[csRegFan1En] != 0x21 || f.ec[csRegFan1Duty] != 40 {
		t.Fatalf("enable 0x%02x duty %d", f.ec[csRegFan1En], f.ec[csRegFan1Duty])
	}
}

func TestCS201xSetPWMVerifiesTheWrite(t *testing.T) {
	f := newFakeCS()
	c, _ := DetectCS201x(f)
	f.stuck = map[uint32]bool{csRegFan0Duty: true}
	if err := c.SetPWM(c.Outputs()[0], 50); err == nil {
		t.Fatal("a write that did not stick was not noticed")
	}
}

// Stopping gives the fans back what the BIOS had: duty and enable byte, no other register.
func TestCS201xRestore(t *testing.T) {
	f := newFakeCS()
	f.ec[csRegFan0Duty], f.ec[csRegFan1Duty] = 60, 60
	f.ec[csRegFan0En], f.ec[csRegFan1En] = 0x11, 0x21
	c, _ := DetectCS201x(f)
	bios, err := c.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if bios["csfan0"] != [2]byte{0x11, 60} || bios["csfan1"] != [2]byte{0x21, 60} {
		t.Fatalf("snapshot %v", bios)
	}
	for _, o := range c.Outputs() {
		if err := c.SetPWM(o, 30); err != nil {
			t.Fatal(err)
		}
	}
	f.written = nil
	if err := c.Restore(bios); err != nil {
		t.Fatal(err)
	}
	if f.ec[csRegFan0Duty] != 60 || f.ec[csRegFan1Duty] != 60 || f.ec[csRegFan0En] != 0x11 || f.ec[csRegFan1En] != 0x21 {
		t.Fatalf("not restored: %d %d 0x%02x 0x%02x", f.ec[csRegFan0Duty], f.ec[csRegFan1Duty], f.ec[csRegFan0En], f.ec[csRegFan1En])
	}
	allowed := map[uint32]bool{csRegFan0Duty: true, csRegFan1Duty: true, csRegFan0En: true, csRegFan1En: true}
	for _, reg := range f.written {
		if !allowed[reg] {
			t.Fatalf("restore wrote register 0x%08x", reg)
		}
	}
}

func TestCS201xRestoreRefusesNonsense(t *testing.T) {
	f := newFakeCS()
	c, _ := DetectCS201x(f)
	f.written = nil
	if err := c.Restore(Snapshot{"csfan0": {0x11, 0xc6}}); err == nil {
		t.Fatal("a duty above 100 was written back")
	}
	if len(f.written) != 0 {
		t.Fatalf("written: %x", f.written)
	}
}

func TestDetectFansPicksTheCS201xOnADXP2800GT(t *testing.T) {
	chip, err := detectFans(newFakeCS(), "DXP2800 GT")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := chip.(*CS201x); !ok {
		t.Fatalf("got %T", chip)
	}
	if !ModelSupported("DXP2800 GT") || ModelSupported("DXP2800") {
		t.Fatal("model list")
	}
}

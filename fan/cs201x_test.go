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
	writes  []uint16 // ports written
	ecData  []byte   // values written to the data port
	cfgData []byte   // values written to the config data port
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

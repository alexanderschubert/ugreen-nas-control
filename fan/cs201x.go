package main

import (
	"errors"
	"fmt"
	"strings"
)

// Chipsea CS201x Super-I/O with an embedded controller, as found in the
// DXP2800 GT. This file only reads: it is the first step of a fan control for
// this model and exists so that the wiring can be checked on real hardware
// before anything is written. The register map is taken from the register
// addresses UGREEN published for the chip (GPL kernel driver ug_201x.c); no
// code of it is used.
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

// ProbeCS201x reads the chip ID, the base address of the embedded controller
// and its fan and temperature registers. What it writes: the unlock key to the
// config index port, the logical device number (to look at device 0x0A), and
// the address latch of the embedded controller (needed for every read). It
// never writes a data register, never switches the host interface on and never
// touches a fan setting.
func ProbeCS201x(p Ports, model string) (CS201xReading, error) {
	r := CS201xReading{Model: model, Temps: map[string]int{}}

	for _, b := range csEnterKey {
		if err := p.Out(sioIndex, b); err != nil {
			return r, err
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

	id := uint16(read(sioRegChipID))<<8 | uint16(read(sioRegChipID+1))
	r.ChipID = fmt.Sprintf("0x%04x", id)
	r.Revision = fmt.Sprintf("0x%02x", read(sioRegRev))
	if id != cs201xID {
		leave()
		return r, fmt.Errorf("Super-I/O chip id %s, expected 0x%04x: nothing else was read", r.ChipID, cs201xID)
	}

	_ = p.Out(sioIndex, sioRegLDN)
	_ = p.Out(sioData, csLDNHost2EC)
	active := read(sioRegActive)
	base := uint16(read(sioRegBaseHi))<<8 | uint16(read(sioRegBaseLo))
	leave()

	if active&0x01 == 0 {
		r.HostEC = "not active"
		r.Notes = append(r.Notes, "the host interface of the embedded controller is off; it is not switched on by this read-only probe")
		return r, errors.New("host interface of the embedded controller is not active")
	}
	r.HostEC = "active"
	if base < 0x100 || base == 0xffff {
		return r, fmt.Errorf("implausible base address 0x%04x", base)
	}
	r.Base = fmt.Sprintf("0x%04x", base)

	rd := func(reg uint32) (byte, error) {
		if err := p.Out(base+csEcCtrl, 0); err != nil {
			return 0, err
		}
		for i := 0; i < 4; i++ {
			if err := p.Out(base+csEcAddr+uint16(i), byte(reg>>(8*i))); err != nil {
				return 0, err
			}
		}
		return p.In(base + csEcData)
	}
	var firstErr error
	get := func(reg uint32) int {
		v, err := rd(reg)
		if err != nil && firstErr == nil {
			firstErr = err
		}
		return int(v)
	}

	for i, f := range []struct {
		role          string
		en, duty, spd uint32
	}{
		{"cpu", csRegFan0En, csRegFan0Duty, csRegFan0Spd},
		{"system", csRegFan1En, csRegFan1Duty, csRegFan1Spd},
	} {
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

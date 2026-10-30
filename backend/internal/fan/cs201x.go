package fan

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/alexanderschubert/ugreen-nas-control/internal/hw"
)

// Chipsea CS201x Super-I/O with an embedded controller (DXP2800 GT). Register addresses as published by UGREEN
// (GPL-2.0-only driver ug_201x.c@c75c5ab, cited as ug_201x.c:LINE); facts only, no code used. The probe below only
// reads; the fan driver is in cs201x_fans.go.
const (
	cs201xID = 0x2011 // ug_201x.c:30

	csLDNHost2EC = 0x0a // ug_201x.c:48

	// Offsets from the base address of the host-to-EC interface (ug_201x.c:80-84,215-248).
	csEcCtrl = 0x01 // 0 = one byte, no auto increment
	csEcAddr = 0x04 // 32-bit register address, least significant byte first
	csEcData = 0x08

	csRegFan0En   = 0x200053f0 // ug_201x.c:86-94
	csRegFan1En   = 0x200053f1
	csRegFan0Duty = 0x200053f4 // percent, 0-100 (ug_201x.c:311-328)
	csRegFan1Duty = 0x200053f5
	csRegFan0Spd  = 0x200053f8 // high byte, the low byte follows; already rpm
	csRegFan1Spd  = 0x200053fa
	csRegNTC2     = 0x200053e2 // cpu_temp, unsigned °C (ug_201x.c:99-100,276-291)
	csRegNTC4     = 0x200053e4 // board_temp
	csRegFWVer    = 0x200054fc // defined, never read by UGREEN (ug_201x.c:103)

	csRegADC2Cfg = 0x20005370 // UGREEN writes 1 ("temperature input") before reading temps (ug_201x.c:96-97,270-272)
	csRegADC4Cfg = 0x20005371

	csRegARGBFlow = 0x20005440 // written 1 at load, 0 at unload (ug_201x.c:102,789-790,817)
	csRegPWRSW    = 0x2000548c // written 0 at load (ug_201x.c:104)

	// Watchdog (ug_201x.c:105-111,330-374): read here, never written.
	csRegWdtCfg1    = 0x20005480
	csRegWdtCfg2    = 0x20005481 // 1 = running
	csRegWdtTimeout = 0x20005482 // high byte, the low byte follows
	csRegWdtCounter = 0x20005484 // high byte, the low byte follows
	csRegWdtFeed    = 0x20005488
)

var csEnterKey = []byte{0xa5, 0x69, 0x87} // ug_201x.c:185-205
var csExitKey = []byte{0x87, 0x69, 0xa5}

// csCounterGap is the pause between the two watchdog counter reads; tests shorten it.
var csCounterGap = 1500 * time.Millisecond

type CS201xReading struct {
	Model     string         `json:"model"`
	ChipID    string         `json:"chip_id"`
	Revision  string         `json:"revision"`
	HostEC    string         `json:"host_ec"` // active / not active
	Base      string         `json:"base,omitempty"`
	Fans      []CS201xFan    `json:"fans,omitempty"`
	Temps     map[string]int `json:"temps,omitempty"` // cpu (NTC2), board (NTC4), unsigned °C
	ADC       *CS201xADC     `json:"temp_inputs,omitempty"`
	Watchdog  *CS201xWdt     `json:"watchdog,omitempty"`
	ARGBFlow  *int           `json:"argb_flow_control,omitempty"`
	PWRSW     *int           `json:"pwrsw_cfg,omitempty"`
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

// CS201xADC: the temperature input registers UGREEN sets to 1 before it reads a temperature.
type CS201xADC struct {
	Ch2        int  `json:"ch2_cfg"`
	Ch4        int  `json:"ch4_cfg"`
	Configured bool `json:"configured"` // both read 1
}

// CS201xWdt: the watchdog registers as found. The unit is unverified (UGREEN's driver says seconds but clamps in
// minutes, ug_201x.c:659-724).
type CS201xWdt struct {
	Cfg1     int  `json:"cfg1"`
	Cfg2     int  `json:"cfg2"`
	Armed    bool `json:"armed"` // cfg2 bit 0
	Timeout  int  `json:"timeout"`
	Counter  int  `json:"counter"`
	Counter2 int  `json:"counter_later"`
	Counting bool `json:"counting"` // the counter moved between the two reads
	Feed     int  `json:"feed"`
}

func isDXP2800GT(model string) bool {
	return strings.HasPrefix(model, "DXP2800 GT")
}

// csWindow is what the Super-I/O window of the host-to-EC device tells.
type csWindow struct {
	id, rev uint16
	active  byte
	base    uint16
}

// csReadWindow opens the Super-I/O window, reads chip id, revision, the host interface state and the base address,
// and closes it again. It writes the unlock key, the device number and, only with enableHost and only when the
// interface is off, cfg 0x30 = 1 (ug_201x.c:264-266: UGREEN does that on every load). A chip id other than
// CS201x ends it before the device number is written.
func csReadWindow(p Ports, enableHost bool) (w csWindow, err error) {
	for _, b := range csEnterKey {
		if err := p.Out(sioIndex, b); err != nil {
			return w, err
		}
	}
	leave := func() {
		for _, b := range csExitKey {
			_ = p.Out(sioIndex, b)
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

	w.id = uint16(read(sioRegChipID))<<8 | uint16(read(sioRegChipID+1))
	w.rev = uint16(read(sioRegRev))<<8 | uint16(read(sioRegRev+1)) // 16 bit as UGREEN (ug_201x.c:155-164)
	if w.id != cs201xID {
		leave()
		return w, fmt.Errorf("Super-I/O chip id 0x%04x, expected 0x%04x: nothing else was read", w.id, cs201xID)
	}

	_ = p.Out(sioIndex, sioRegLDN)
	_ = p.Out(sioData, csLDNHost2EC)
	w.active = read(sioRegActive)
	if enableHost && w.active&0x01 == 0 {
		_ = p.Out(sioIndex, sioRegActive)
		_ = p.Out(sioData, 0x01)
		w.active = read(sioRegActive)
	}
	w.base = uint16(read(sioRegBaseHi))<<8 | uint16(read(sioRegBaseLo))
	leave()
	return w, nil
}

// csEC reads and writes EC registers through the host-to-EC window at base, outside the Super-I/O window.
type csEC struct {
	p    Ports
	base uint16
}

func (e csEC) latch(reg uint32) error {
	if err := e.p.Out(e.base+csEcCtrl, 0); err != nil {
		return err
	}
	for i := 0; i < 4; i++ {
		if err := e.p.Out(e.base+csEcAddr+uint16(i), byte(reg>>(8*i))); err != nil {
			return err
		}
	}
	return nil
}

func (e csEC) read(reg uint32) (byte, error) {
	if err := e.latch(reg); err != nil {
		return 0, err
	}
	return e.p.In(e.base + csEcData)
}

func (e csEC) write(reg uint32, v byte) error {
	if err := e.latch(reg); err != nil {
		return err
	}
	return e.p.Out(e.base+csEcData, v)
}

func plausibleBase(base uint16) bool { return base >= 0x100 && base != 0xffff }

// ProbeCS201x writes only the unlock key, the logical device number and the EC address latch (needed for every
// read). It never writes a data register, never switches the host interface on and never touches a fan or watchdog
// setting. A host interface that is off is reported, not an error.
func ProbeCS201x(p Ports, model string) (CS201xReading, error) {
	r := CS201xReading{Model: model, Temps: map[string]int{}}

	w, err := csReadWindow(p, false)
	r.ChipID = fmt.Sprintf("0x%04x", w.id)
	r.Revision = fmt.Sprintf("0x%04x", w.rev)
	if err != nil {
		return r, err
	}

	if w.active&0x01 == 0 {
		r.HostEC = "not active"
		r.Notes = append(r.Notes, "the host interface of the embedded controller is off (cfg 0x30 = 0); the read-only probe does not switch it on, so no EC register was read. The fan driver switches it on before its first write")
		if plausibleBase(w.base) {
			r.Base = fmt.Sprintf("0x%04x", w.base)
		}
		return r, nil
	}
	r.HostEC = "active"
	if !plausibleBase(w.base) {
		return r, fmt.Errorf("implausible base address 0x%04x", w.base)
	}
	r.Base = fmt.Sprintf("0x%04x", w.base)

	ec := csEC{p, w.base}
	var firstErr error
	get := func(reg uint32) int {
		v, err := ec.read(reg)
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
	// Unsigned bytes, as UGREEN reads them (ug_201x.c:276-291).
	r.Temps["cpu"] = get(csRegNTC2)
	r.Temps["board"] = get(csRegNTC4)
	r.ADC = &CS201xADC{Ch2: get(csRegADC2Cfg), Ch4: get(csRegADC4Cfg)}
	r.ADC.Configured = r.ADC.Ch2 == 1 && r.ADC.Ch4 == 1
	if !r.ADC.Configured {
		r.Notes = append(r.Notes, "the temperature input registers 0x20005370/71 are not 1; UGREEN sets them before reading temperatures, so the temperatures may read 0 or stale until the driver does")
	}

	wd := &CS201xWdt{Cfg1: get(csRegWdtCfg1), Cfg2: get(csRegWdtCfg2), Feed: get(csRegWdtFeed)}
	wd.Armed = wd.Cfg2&0x01 != 0
	wd.Timeout = get(csRegWdtTimeout)<<8 | get(csRegWdtTimeout+1)
	wd.Counter = get(csRegWdtCounter)<<8 | get(csRegWdtCounter+1)
	time.Sleep(csCounterGap)
	wd.Counter2 = get(csRegWdtCounter)<<8 | get(csRegWdtCounter+1)
	wd.Counting = wd.Counter2 != wd.Counter
	r.Watchdog = wd

	flow, pwrsw := get(csRegARGBFlow), get(csRegPWRSW)
	r.ARGBFlow, r.PWRSW = &flow, &pwrsw
	r.FWVersion = fmt.Sprintf("0x%02x", get(csRegFWVer))

	return r, firstErr
}

// cs201xCommand: no argument reads the chip (JSON); `confirm [fan1] [fan3]` switches fan control on for the named
// fans (default both) by saving the map; `forget` removes it.
func cs201xCommand() {
	model := productName()
	if !isDXP2800GT(model) {
		fail(fmt.Errorf("%q is not a DXP2800 GT", model))
	}
	args := os.Args[2:]
	if len(args) > 0 && args[0] == "forget" {
		if err := forgetMap(); err != nil {
			fail(err)
		}
		printJSON(map[string]any{"ok": true})
		return
	}
	p, err := hw.OpenPorts()
	if err != nil {
		fail(err)
	}
	defer func() { _ = p.Close() }()
	out := map[string]any{}
	if len(args) > 0 && args[0] == "confirm" {
		var m *FanMap
		err = withLock(func() (err error) { m, err = confirmCS201x(p, model, args[1:]); return })
		out["map"] = m
	} else {
		var rd CS201xReading
		err = withLock(func() (err error) { rd, err = ProbeCS201x(p, model); return })
		out["read"] = rd
	}
	out["ok"] = err == nil
	if err != nil {
		out["error"] = err.Error()
	}
	printJSON(out)
	if err != nil {
		os.Exit(1)
	}
}

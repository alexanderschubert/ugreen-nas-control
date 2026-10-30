package panel

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/alexanderschubert/ugreen-nas-control/internal/hw"
)

// Beeper is one way to sound the speaker. Off must be safe to call at any time, also when On failed half-way.
type Beeper interface {
	On(freq int) error
	Off() error
}

// Beep bounds. The vendor timer command takes 20..99999 ms (ug_sataio_beeper.c:23-25@c75c5ab); we stop at 2 s.
const (
	MinMs, MaxMs, DefaultMs = 20, 2000, 200 // 200 ms is the vendor's "one" beep
	MinHz, MaxHz            = 100, 8000
)

// BeepKind is the hardware path of a model's beeper.
type BeepKind int

const (
	PCSpeaker BeepKind = iota // PIT channel 2 and port 0x61
	ECByte                    // one byte of the IT5571 embedded controller
	PadReg                    // bit 0 of a pad register in MMIO
)

func (k BeepKind) String() string {
	return [...]string{"PC speaker", "EC register", "pad register"}[k]
}

// BeeperSpec is the beeper of one model group.
type BeeperSpec struct {
	Name    string
	Match   matcher
	Kind    BeepKind
	ECReg   byte   // ECByte
	PadAddr uint64 // PadReg
	Cite    string
}

// BeeperSpecs: the generic PC speaker for the models of the SATA/beeper driver (ug_sataio_beeper.c:535-583@c75c5ab)
// and the DX4700 (dx4700/ug_sata_beep-dx4700.c:164-189@c75c5ab). Models the vendor files do not name (DXP4800 GT,
// DXP2800 GT, DX4600) get no entry: no beeper path is known for them, so we refuse.
// The iDX6011 Pro uses EC 0x9E, never 0xA5: on that model 0xA5 is the backlight (ug_sataio_beeper.c:33-35@c75c5ab).
var BeeperSpecs = []BeeperSpec{
	{Name: "DXP2800, DXP2800S, DXP4800, DXP4800S", Match: matcher{exact: []string{"DXP2800", "DXP2800S", "DXP4800", "DXP4800S"}},
		Kind: PCSpeaker, Cite: "ug_sataio_beeper.c:63-79,305-311,535-545@c75c5ab"},
	{Name: "DXP4800 Plus, DXP4800 Pro", Match: matcher{prefix: []string{"DXP4800 Plus", "DXP4800 Pro"}},
		Kind: PCSpeaker, Cite: "ug_sataio_beeper.c:63-79,305-311,547-555@c75c5ab"},
	{Name: "DXP6800*, DXP8800*, FORT 6", Match: matcher{prefix: []string{"DXP6800", "DXP8800", "FORT 6"}},
		Kind: PCSpeaker, Cite: "ug_sataio_beeper.c:63-79,305-311,556-570@c75c5ab"},
	{Name: "DX4700", Match: matcher{exact: []string{"DX4700"}},
		Kind: PCSpeaker, Cite: "dx4700/ug_sata_beep-dx4700.c:164-189@c75c5ab"},
	{Name: "iDX6011, iDX6012", Match: matcher{exact: []string{"iDX6011", "iDX6012"}},
		Kind: ECByte, ECReg: 0xA5, Cite: "ug_sataio_beeper.c:26-35,126-171,299-304@c75c5ab"},
	{Name: "iDX6011 Pro", Match: matcher{exact: []string{"iDX6011 Pro"}},
		Kind: ECByte, ECReg: 0x9E, Cite: "ug_sataio_beeper.c:33,301-303@c75c5ab"},
	{Name: "DH2600", Match: matcher{prefix: []string{"DH2600"}},
		Kind: PadReg, PadAddr: 0xFD6E08B0, Cite: "dh2600/ug_sata_beep-dh2600.c:42,164-182@c75c5ab"},
	{Name: "DXP480T Plus", Match: matcher{prefix: []string{"DXP480T Plus"}},
		Kind: PadReg, PadAddr: 0xFD6E07E0, Cite: "dxp480t/ug-beeper-dxp480t.c:41-49,118-134@c75c5ab"},
}

// BeeperFor is the entry for a DMI product name, or nil.
func BeeperFor(product string) *BeeperSpec {
	for i := range BeeperSpecs {
		if BeeperSpecs[i].Match.ok(product) {
			return &BeeperSpecs[i]
		}
	}
	return nil
}

// Backends a Beep call may open; Env supplies the real or fake ones.
type openers struct {
	ports func() (hw.Ports, error)
	mem   func(write bool) (Mem, error)
}

// open returns the Beeper and a close func.
func (s *BeeperSpec) open(o openers) (Beeper, func(), error) {
	switch s.Kind {
	case PCSpeaker:
		p, err := o.ports()
		if err != nil {
			return nil, nil, err
		}
		return &speaker{p: p}, func() { _ = p.Close() }, nil
	case ECByte:
		p, err := o.ports()
		if err != nil {
			return nil, nil, err
		}
		return &ecBeeper{p: p, reg: s.ECReg, wait: ecWait}, func() { _ = p.Close() }, nil
	default:
		m, err := o.mem(true)
		if err != nil {
			return nil, nil, err
		}
		return &padBeeper{m: m, addr: s.PadAddr}, func() { _ = m.Close() }, nil
	}
}

// PC speaker: timer command 0xB6 to port 0x43, divisor low then high byte to port 0x42, on = set bits 0-1 of port
// 0x61, off = clear them (ug_sataio_beeper.c:63-79@c75c5ab). The vendor always uses divisor 0x0944 (2372, about
// 503 Hz); a chosen frequency is our own use of the same PIT (1.193182 MHz input clock).
const (
	pitCmd      = 0x43
	pitCh2      = 0x42
	pitGate     = 0x61
	pitSquare   = 0xB6
	pitClock    = 1193182
	pitVendorDv = 0x0944
)

type speaker struct{ p hw.Ports }

func (s *speaker) On(freq int) error {
	div := pitVendorDv
	if freq > 0 {
		div = (pitClock + freq/2) / freq
	}
	for _, w := range [][2]int{{pitCmd, pitSquare}, {pitCh2, div & 0xFF}, {pitCh2, div >> 8}} {
		if err := s.p.Out(uint16(w[0]), byte(w[1])); err != nil {
			return err
		}
	}
	v, err := s.p.In(pitGate)
	if err != nil {
		return err
	}
	return s.p.Out(pitGate, v|3)
}

func (s *speaker) Off() error {
	v, err := s.p.In(pitGate)
	if err != nil {
		return err
	}
	return s.p.Out(pitGate, v&^3)
}

// EC byte: ACPI EC ports data 0x62 and command 0x66, write = 0x81 reg value, read = 0x80 reg; the vendor writes, reads
// back, and repeats until they match, treating a read-back of 2 after writing 1 as success
// (ug_sataio_beeper.c:26-29,126-171@c75c5ab). We wait for IBF/OBF like the fan code and give up after a few tries.
const (
	ecData     = 0x62
	ecCmd      = 0x66
	ecOBF      = 0x01
	ecIBF      = 0x02
	ecCmdRead  = 0x80
	ecCmdWrite = 0x81
	ecTries    = 5
)

var ecWait = 100 * time.Millisecond

// ecBeeper writes exactly one register, fixed at construction, with 0 or 1 only.
type ecBeeper struct {
	p    hw.Ports
	reg  byte
	wait time.Duration
}

var errECTimeout = errors.New("embedded controller timeout")

func (e *ecBeeper) waitFlag(flag byte, set bool) error {
	deadline := time.Now().Add(e.wait)
	for {
		st, err := e.p.In(ecCmd)
		if err != nil {
			return err
		}
		if (st&flag != 0) == set {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("%w (status 0x%02x)", errECTimeout, st)
		}
		time.Sleep(100 * time.Microsecond)
	}
}

func (e *ecBeeper) send(port uint16, v byte) error {
	if err := e.waitFlag(ecIBF, false); err != nil {
		return err
	}
	return e.p.Out(port, v)
}

func (e *ecBeeper) set(v byte) error {
	var last error
	for i := 0; i < ecTries; i++ {
		got, err := e.writeRead(v)
		if err == nil && (got == v || (v == 1 && got == 2)) {
			return nil
		}
		if err == nil {
			err = fmt.Errorf("register 0x%02X reads back 0x%02X after writing %d", e.reg, got, v)
		}
		last = err
		time.Sleep(time.Duration(i+1) * time.Millisecond)
	}
	return last
}

func (e *ecBeeper) writeRead(v byte) (byte, error) {
	if st, err := e.p.In(ecCmd); err == nil && st&ecOBF != 0 {
		_, _ = e.p.In(ecData) // stale byte of an aborted read
	}
	for _, w := range []struct {
		port uint16
		v    byte
	}{{ecCmd, ecCmdWrite}, {ecData, e.reg}, {ecData, v}, {ecCmd, ecCmdRead}, {ecData, e.reg}} {
		if err := e.send(w.port, w.v); err != nil {
			return 0, err
		}
	}
	if err := e.waitFlag(ecOBF, true); err != nil {
		return 0, err
	}
	return e.p.In(ecData)
}

func (e *ecBeeper) On(int) error { return e.set(1) }
func (e *ecBeeper) Off() error   { return e.set(0) }

// Pad register: force bits 10..8 to 010 and set (on) or clear (off) bit 0, other bits kept
// (dh2600/ug_sata_beep-dh2600.c:164-182, dxp480t/ug-beeper-dxp480t.c:118-134@c75c5ab).
type padBeeper struct {
	m    Mem
	addr uint64
}

func (b *padBeeper) put(on bool) error {
	v, err := b.m.Read32(b.addr)
	if err != nil {
		return err
	}
	v = v&^(7<<8) | 1<<9
	if on {
		v |= 1
	} else {
		v &^= 1
	}
	return b.m.Write32(b.addr, v)
}

func (b *padBeeper) On(int) error { return b.put(true) }
func (b *padBeeper) Off() error   { return b.put(false) }

// Sound turns the beeper on for ms milliseconds. It always tries Off afterwards, also on error, panic and when ctx
// ends early (SIGINT/SIGTERM in the CLI). wait must return early when ctx is done.
func Sound(ctx context.Context, b Beeper, freq, ms int, wait func(context.Context, time.Duration)) (err error) {
	defer func() {
		if offErr := b.Off(); offErr != nil {
			err = errors.Join(err, fmt.Errorf("switching the beeper off failed: %w", offErr))
		}
	}()
	if err := b.On(freq); err != nil {
		return err
	}
	wait(ctx, time.Duration(ms)*time.Millisecond)
	return nil
}

package panel

import (
	"context"
	"fmt"
	"io"
	"time"
)

// Poll is the vendor's period (ug_gpio_btn.c:39,163-171@c75c5ab).
const Poll = 50 * time.Millisecond

// Pad is one button line: bit Bit of the 32-bit pad register at physical address Addr. The vendor reads some
// registers at an address that is not 4-byte aligned (readl at 0xFED81526, bit 0); we read the aligned word and
// shift the byte offset into the bit number, which selects the same bit on a little-endian CPU.
type Pad struct {
	Addr       uint64
	Bit        uint
	ActiveHigh bool
}

func (p Pad) word() uint64 { return p.Addr &^ 3 }
func (p Pad) bit() uint    { return p.Bit + uint(p.Addr&3)*8 }

// Pressed reports whether the button is held, from the register value w.
func (p Pad) Pressed(w uint32) bool {
	high := (w>>p.bit())&1 == 1
	return high == p.ActiveHigh
}

// ButtonSpec is how one model exposes its power and reset button.
type ButtonSpec struct {
	Name  string // vendor's group name, for the docs
	Match matcher
	Power *Pad // nil: not readable by address
	Reset *Pad
	// PowerPressPolls is the number of polls the power button must stay down before the vendor reports a press: 1
	// (the MCU forwards the press) and 100 (5 s) on the DXP2800 GT (ug_gpio_btn.c:88-96@c75c5ab).
	PowerPressPolls int
	Cite            string
}

const (
	// Vendor long-press constants (ug_gpio_btn.c:73-82,99-115@c75c5ab).
	resetPressPolls = 260 // 13 s; the vendor comment says 5 s
	powerReleasePol = 100 // a power release is only reported after 5 s down
	seenCap         = 1200
)

func pad(addr uint64, high bool) *Pad { return &Pad{Addr: addr, Bit: 1, ActiveHigh: high} }

// ButtonSpecs is in the vendor's if/else order (ug_gpio_btn.c:248-471@c75c5ab). Power is active high and reset active
// low everywhere except the DXP2800 GT, where both are active low on bit 16.
var ButtonSpecs = []ButtonSpec{
	{Name: "DXP2800, DXP2800S, DXP4800, DXP4800S", Match: matcher{exact: []string{"DXP2800", "DXP2800S", "DXP4800", "DXP4800S"}},
		Power: pad(0xFD6A0980, true), Reset: pad(0xFD6D0B50, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:248-272@c75c5ab"},
	{Name: "DXP4800 Plus, DXP4800 Pro", Match: matcher{prefix: []string{"DXP4800 Plus", "DXP4800 Pro"}},
		Power: pad(0xFD6A0980, true), Reset: pad(0xFD6D0A10, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:274-299@c75c5ab"},
	{Name: "DXP6800*, DXP8800*, FORT 6", Match: matcher{prefix: []string{"DXP6800", "DXP8800", "FORT 6"}},
		Power: pad(0xFD6A0B40, true), Reset: pad(0xFD6D0A10, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:301-325@c75c5ab"},
	{Name: "DXP480T Plus", Match: matcher{prefix: []string{"DXP480T Plus"}},
		Power: pad(0xFD6E0810, true), Reset: pad(0xFD6E0770, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:326-350@c75c5ab"},
	// The vendor comment says the iDX power key sits on ACPI and cannot be read by address (:353), yet it lists an
	// address; both are kept, the address is unconfirmed.
	{Name: "iDX6011*, iDX6012*", Match: matcher{prefix: []string{"iDX6011", "iDX6012"}},
		Power: pad(0xE0D20860, true), Reset: pad(0xE0D508A0, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:351-375@c75c5ab"},
	{Name: "DH2600", Match: matcher{prefix: []string{"DH2600"}},
		Power: pad(0xFD6D0B20, true), Reset: pad(0xFD6E0800, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:376-399@c75c5ab"},
	{Name: "DX4600*, DX4700*", Match: matcher{prefix: []string{"DX4600", "DX4700"}},
		Power: pad(0xFD6D0690, true), Reset: pad(0xFD6D0890, false), PowerPressPolls: 1, Cite: "ug_gpio_btn.c:400-423@c75c5ab"},
	{Name: "DXP4800 GT", Match: matcher{exact: []string{"DXP4800 GT"}},
		Power: &Pad{Addr: 0xFED81526, Bit: 0, ActiveHigh: true}, Reset: &Pad{Addr: 0xFED81522, Bit: 0, ActiveHigh: false},
		PowerPressPolls: 1, Cite: "ug_gpio_btn.c:424-447@c75c5ab"},
	{Name: "DXP2800 GT", Match: matcher{exact: []string{"DXP2800 GT"}},
		Power: &Pad{Addr: 0xFED81510, Bit: 16, ActiveHigh: false}, Reset: &Pad{Addr: 0xFED8150C, Bit: 16, ActiveHigh: false},
		PowerPressPolls: 100, Cite: "ug_gpio_btn.c:448-471@c75c5ab"},
}

// ButtonsFor is the entry for a DMI product name, or nil.
func ButtonsFor(product string) *ButtonSpec {
	for i := range ButtonSpecs {
		if ButtonSpecs[i].Match.ok(product) {
			return &ButtonSpecs[i]
		}
	}
	return nil
}

// State is the held state of both buttons.
type State struct{ Power, Reset bool }

// ReadState reads both pads. The DXP2800 GT driver also clears bit 23 of each register (pin to input); we never
// write, so on that model the pins are read as the firmware left them.
func (s *ButtonSpec) ReadState(m MemReader) (State, error) {
	var st State
	for _, b := range []struct {
		p   *Pad
		out *bool
	}{{s.Power, &st.Power}, {s.Reset, &st.Reset}} {
		if b.p == nil {
			continue
		}
		w, err := m.Read32(b.p.word())
		if err != nil {
			return st, err
		}
		*b.out = b.p.Pressed(w)
	}
	return st, nil
}

// Event names a Tracker emits.
const (
	EvDown    = "down"    // pad went active
	EvPress   = "press"   // the vendor driver reports the key press (power KEY_F20, reset KEY_F24)
	EvRelease = "release" // the vendor driver reports the key release
	EvUp      = "up"      // pad went inactive
)

// Event is one transition; Polls is how many 50 ms polls the pad had been active (for up/release).
type Event struct {
	Name  string
	Polls int
}

// Tracker follows one button the way the vendor driver does: it counts consecutive active polls, reports the press
// at a threshold and the release afterwards. Power: press after pressPolls, release only if held >= 100 polls. Reset:
// press after 260 polls, release if the press was reported (the vendor needs more than 260 and so misses a release
// at exactly 260; we do not).
type Tracker struct {
	reset      bool
	pressPolls int
	seen       int
	down       bool
	reported   bool
}

func NewPowerTracker(pressPolls int) *Tracker { return &Tracker{pressPolls: pressPolls} }
func NewResetTracker() *Tracker               { return &Tracker{reset: true, pressPolls: resetPressPolls} }

// Poll feeds one reading and returns the events it causes.
func (t *Tracker) Poll(active bool) []Event {
	var ev []Event
	if active {
		if !t.down {
			t.down = true
			ev = append(ev, Event{Name: EvDown})
		}
		if t.seen < seenCap {
			t.seen++
			if t.seen == t.pressPolls {
				t.reported = true
				ev = append(ev, Event{Name: EvPress, Polls: t.seen})
			}
		}
		return ev
	}
	if t.down {
		ev = append(ev, Event{Name: EvUp, Polls: t.seen})
		if t.reported && (t.reset || t.seen >= powerReleasePol) {
			ev = append(ev, Event{Name: EvRelease, Polls: t.seen})
		}
	}
	t.seen, t.down, t.reported = 0, false, false
	return ev
}

// Watch polls until ctx ends. tick delivers the polls (a 50 ms ticker in production); now stamps the lines.
func (s *ButtonSpec) Watch(ctx context.Context, m MemReader, out io.Writer, tick <-chan time.Time, now func() time.Time) error {
	st, err := s.ReadState(m)
	if err != nil {
		return err
	}
	say(out, "start: %s", describe(st))
	pw, rs := NewPowerTracker(s.PowerPressPolls), NewResetTracker()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-tick:
		}
		st, err := s.ReadState(m)
		if err != nil {
			return err
		}
		for _, b := range []struct {
			name   string
			t      *Tracker
			active bool
		}{{"power", pw, st.Power}, {"reset", rs, st.Reset}} {
			for _, e := range b.t.Poll(b.active) {
				line := fmt.Sprintf("%s %s %s", now().Format("15:04:05.000"), b.name, e.Name)
				if e.Polls > 0 {
					line += fmt.Sprintf(" (held %.2f s)", float64(e.Polls)*Poll.Seconds())
				}
				say(out, "%s", line)
			}
		}
	}
}

func describe(st State) string {
	word := func(b bool) string {
		if b {
			return "held"
		}
		return "released"
	}
	return fmt.Sprintf("power %s, reset %s", word(st.Power), word(st.Reset))
}

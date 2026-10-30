package fan

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
	"time"
)

func newFakeIdxEC() *fakeEC {
	f := newFakeEC()
	f.regs[0x36], f.regs[0x37] = 0x02, 0x58 // cpu2 600
	f.regs[0x3a], f.regs[0x3b] = 0x03, 0x20 // sys2 800
	f.regs[0xb3], f.regs[0xb7] = 30, 40
	return f
}

func TestIdxProFourFans(t *testing.T) {
	isolate(t, "iDX6011 Pro")
	f := newFakeIdxEC()
	chip, err := detectFans(f, "iDX6011 Pro")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"fan1": 977, "fan2": 600, "fan3": 731, "fan4": 800}
	if len(chip.Outputs()) != 4 {
		t.Fatalf("outputs = %v", outputIDs(chip.Outputs()))
	}
	for _, ch := range chip.Outputs() {
		if rpm, err := chip.RPM(ch); err != nil || rpm != want[ch.ID] {
			t.Errorf("%s = %d (%v), want %d", ch.ID, rpm, err, want[ch.ID])
		}
	}
	for id, role := range map[string]string{"fan1": "cpu", "fan2": "cpu", "fan3": "case", "fan4": "case"} {
		if roles[id] != role {
			t.Errorf("role of %s = %s", id, roles[id])
		}
	}

	// The GT keeps its two fans.
	gt, _ := detectFans(newFakeEC(), "DXP4800 GT")
	if len(gt.Outputs()) != 2 {
		t.Fatalf("GT outputs = %v", outputIDs(gt.Outputs()))
	}
}

func TestIdxProNeverBelowFloor(t *testing.T) {
	f := newFakeIdxEC()
	ec, _ := detectEC(f, ecSpecIdxPro)
	floor := byte((25*198 + 99) / 100) // 25 % of 198, rounded up
	for _, ch := range ec.Outputs() {
		for _, duty := range []byte{0, 1, floor - 1} {
			if err := ec.SetPWM(ch, duty); err != nil {
				t.Fatal(err)
			}
			if got := f.regs[ch.Duty]; got != floor {
				t.Errorf("%s: asked %d, wrote %d, want %d", ch.ID, duty, got, floor)
			}
		}
		_ = ec.SetPWM(ch, 255)
		if f.regs[ch.Duty] != ecMaxDuty {
			t.Errorf("%s: top duty %d", ch.ID, f.regs[ch.Duty])
		}
	}
	// The GT has no floor.
	g := newFakeEC()
	gt, _ := DetectEC(g)
	_ = gt.SetPWM(ecChannels[0], 0)
	if g.regs[0xb1] != 0 {
		t.Errorf("GT duty %d", g.regs[0xb1])
	}
}

func TestIdxProRestoreHandsBackAndDisarms(t *testing.T) {
	f := newFakeIdxEC()
	ec, _ := detectEC(f, ecSpecIdxPro)
	for _, ch := range ec.Outputs() {
		_ = ec.SetPWM(ch, 100)
	}
	f.regs[ecRegWdtEnable] = 1 // the BIOS armed the watchdog
	if err := ec.Restore(nil); err != nil {
		t.Fatal(err)
	}
	for _, reg := range []byte{0xb0, 0xb2, 0xb4, 0xb6} {
		if f.regs[reg] != ecModeAuto {
			t.Errorf("register %#x = %d, want auto", reg, f.regs[reg])
		}
	}
	if f.regs[ecRegWdtEnable] != 0 {
		t.Error("watchdog still armed after the stop")
	}
}

func TestIdxProLimits(t *testing.T) {
	c := ApplyModelLimits(defaultConfig(), "iDX6011 Pro")
	if c.CPUCrit != 88 || c.DiskCrit != 55 {
		t.Fatalf("cpu %d disk %d", c.CPUCrit, c.DiskCrit)
	}
	loose := defaultConfig()
	loose.CPUCrit, loose.DiskCrit = 100, 70
	if c := ApplyModelLimits(loose, "iDX6011 Pro"); c.CPUCrit != 88 || c.DiskCrit != 60 {
		t.Fatalf("cpu %d disk %d", c.CPUCrit, c.DiskCrit)
	}
	tight := defaultConfig()
	tight.CPUCrit = 75
	if c := ApplyModelLimits(tight, "iDX6011 Pro"); c.CPUCrit != 75 {
		t.Fatal("a stricter user limit was raised")
	}
	if c := ApplyModelLimits(defaultConfig(), "DXP6800 Pro"); c.CPUCrit != 90 {
		t.Fatal("limits applied to another model")
	}
}

func TestWatchdogNeverArms(t *testing.T) {
	f := newFakeEC()
	ec, _ := DetectEC(f)
	if err := ec.write(ecRegWdtEnable, 1); err == nil || len(f.writes) != 0 {
		t.Fatalf("arming was not refused (err %v, writes %v)", err, f.writes)
	}
	if err := ec.DisarmWatchdog(); err != nil || f.regs[ecRegWdtEnable] != 0 {
		t.Fatalf("disarm: %v", err)
	}
}

func TestWatchdogDisarmedWritesNothing(t *testing.T) {
	isolate(t, "iDX6011 Pro")
	f := newFakeIdxEC()
	ec, _ := detectEC(f, ecSpecIdxPro)
	p := &Petter{}
	now := time.Unix(1_000_000, 0)
	for i := 0; i < 5; i++ {
		st, ok, err := p.Tick(ec, now.Add(time.Duration(i)*time.Minute))
		if err != nil || !ok || st.Armed || st.LastPet != 0 {
			t.Fatalf("tick %d: %+v ok %v err %v", i, st, ok, err)
		}
	}
	if slices.Contains(f.writes, ecRegWdtHi) || slices.Contains(f.writes, ecRegWdtLo) || slices.Contains(f.writes, ecRegWdtEnable) {
		t.Fatalf("a disarmed watchdog was written: %v", f.writes)
	}
}

func TestWatchdogPetCadence(t *testing.T) {
	isolate(t, "DXP4800 GT")
	f := newFakeEC()
	f.regs[ecRegWdtEnable] = 1
	ec, _ := DetectEC(f)
	p := &Petter{}
	t0 := time.Unix(1_000_000, 0)

	pets := func() int {
		n := 0
		for _, r := range f.writes {
			if r == ecRegWdtLo {
				n++
			}
		}
		return n
	}

	// Timeout 300 s: timeout/3 is 100 s, capped at 60 s.
	st, _, err := p.Tick(ec, t0)
	if err != nil || !st.Armed || st.Timeout != 300 || st.Interval != 60 || st.LastPet != t0.Unix() {
		t.Fatalf("first tick: %+v (%v)", st, err)
	}
	if f.regs[ecRegWdtHi] != 0x01 || f.regs[ecRegWdtLo] != 0x2c {
		t.Fatalf("timeout registers %#x %#x, want 300", f.regs[ecRegWdtHi], f.regs[ecRegWdtLo])
	}
	for _, s := range []int{2, 30, 59} {
		p.Tick(ec, t0.Add(time.Duration(s)*time.Second))
	}
	if pets() != 1 {
		t.Fatalf("%d pets inside the first minute", pets())
	}
	p.Tick(ec, t0.Add(60*time.Second))
	if pets() != 2 {
		t.Fatalf("%d pets after a minute", pets())
	}
	if f.regs[ecRegWdtEnable] != 1 {
		t.Error("the enable byte changed")
	}

	// The state file carries it to `status`.
	st2 := ReadWatchdogStatus()
	if st2 == nil || !st2.Armed || st2.LastPet != t0.Add(60*time.Second).Unix() {
		t.Fatalf("state = %+v", st2)
	}
	b, _ := json.Marshal(st2)
	if !json.Valid(b) {
		t.Fatal("not JSON")
	}

	// A short timeout is fed at a third of it.
	q := &Petter{Timeout: 30}
	f.writes = nil
	q.Tick(ec, t0)
	q.Tick(ec, t0.Add(9*time.Second))
	q.Tick(ec, t0.Add(10*time.Second))
	if pets() != 2 {
		t.Fatalf("%d pets with a 30 s timeout", pets())
	}
}

func TestWatchdogOtherChipsAreSkipped(t *testing.T) {
	isolate(t, "DXP6800 Pro")
	chip, _ := Detect(newFakeITE())
	if _, ok, err := (&Petter{}).Tick(chip, time.Now()); ok || err != nil {
		t.Fatalf("ok %v err %v", ok, err)
	}
	if _, err := os.Stat(watchdogStatePath); err == nil {
		t.Fatal("a state file for a chip without an EC")
	}
}

func TestBacklight(t *testing.T) {
	f := newFakeIdxEC()
	ec, _ := detectEC(f, ecSpecIdxPro)
	f.regs[ecRegBacklight] = 1
	if pct, raw, err := ec.BacklightPct(); err != nil || pct != 100 || raw != 1 {
		t.Fatalf("full: %d %d %v", pct, raw, err)
	}
	f.regs[ecRegBacklight] = 198
	if pct, _, err := ec.BacklightPct(); err != nil || pct != 0 {
		t.Fatalf("off: %d %v", pct, err)
	}
	for _, bad := range []byte{0, 199, 255} {
		f.regs[ecRegBacklight] = bad
		if _, _, err := ec.BacklightPct(); err == nil {
			t.Errorf("register %d accepted", bad)
		}
	}
	for pct := 0; pct <= 100; pct++ {
		if err := ec.SetBacklight(pct); err != nil {
			t.Fatal(err)
		}
		if raw := f.regs[ecRegBacklight]; raw < 1 || raw > 198 {
			t.Fatalf("%d %% wrote %d", pct, raw)
		}
		if got, _, _ := ec.BacklightPct(); got != pct {
			t.Errorf("%d %% read back as %d %%", pct, got)
		}
	}
	if f.regs[ecRegBacklight] != 1 {
		t.Errorf("100 %% = %d", f.regs[ecRegBacklight])
	}
	_ = ec.SetBacklight(0)
	if f.regs[ecRegBacklight] != 198 {
		t.Errorf("0 %% = %d", f.regs[ecRegBacklight])
	}
	for _, bad := range []int{-1, 101} {
		if ec.SetBacklight(bad) == nil {
			t.Errorf("%d accepted", bad)
		}
	}
	// Nothing but the backlight register was written, apart from the register itself.
	for _, r := range f.writes {
		if r != ecRegBacklight {
			t.Errorf("wrote register %#x", r)
		}
	}
}

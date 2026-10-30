package fan

import (
	"encoding/json"
	"errors"
	"os"
	"time"
)

// EC watchdog, pet-only. An armed embedded-controller watchdog resets the box if nothing feeds it. This tool never
// arms it (never writes the enable byte non-zero, enforced in EC.write) and only feeds a timer that is already
// running. Arming happens elsewhere: UGREEN's driver arms only when userspace opens /dev/watchdog and registering the
// device does not arm (ug_it55_4800gt_functions.c:615-640@c75c5ab); whether the BIOS arms it at boot is not proven.
// Registers: enable 0x98, timeout 0xa2/0xa3 (big-endian seconds, 1..10000, default 600) on the DXP4800 GT
// (ug_it55_4800gt_functions.c:529-536,540-543,559-560) and the iDX6011 Pro (ug_it55pro_functions.c:521-527); the plain
// iDX6011/6012 use 0x55/0x56/0x57 (ug_it55_functions.c:466-472), where 0x98/0x99 is the second fan's tach. UGREEN has no
// ping op: its keepalive calls start again, which rewrites the timeout and sets enable = 1
// (ug_it55_4800gt_functions.c:557-584,600-606). Ours rewrites the timeout only, every timeout / 3 and only while
// the enable byte is set; that this reloads the counter on hardware is unproven. On stop clear the enable byte
// after returning both fans to EC auto. The counter (timeout registers read back, :550-556) is reported as read.
const (
	ecRegWdtEnable = 0x98 // read: armed when non-zero; written only with 0
	ecRegWdtHi     = 0xa2 // timeout in seconds, big-endian
	ecRegWdtLo     = 0xa3

	wdtDefaultTimeout = 300 // seed written by the petter
	wdtMinTimeout     = 1
	wdtMaxTimeout     = 10000
	wdtMaxInterval    = 60 * time.Second // never feed less often than this
)

var errNeverArm = errors.New("refusing to arm the EC watchdog")

type WatchdogStatus struct {
	Armed    bool   `json:"armed"`
	Timeout  int    `json:"timeout"`           // seconds
	Interval int    `json:"interval"`          // seconds between feeds
	LastPet  int64  `json:"last_pet"`          // unix time, 0 = never
	Time     int64  `json:"time"`              // when this was sampled
	State    string `json:"state"`             // WdtOff, WdtArmed or WdtActionNeeded, computed when read
	Counter  *int   `json:"counter,omitempty"` // timeout registers read back before the feed; only while armed
}

// Watchdog states for the page: it renders the word and does no clock maths.
const (
	WdtOff          = "off"
	WdtArmed        = "armed"
	WdtActionNeeded = "action_needed" // armed, but nothing fed it for more than twice the interval
)

func watchdogState(st WatchdogStatus, now time.Time) string {
	switch {
	case !st.Armed:
		return WdtOff
	case st.LastPet == 0 || now.Unix()-st.LastPet > 2*int64(st.Interval):
		return WdtActionNeeded
	}
	return WdtArmed
}

var watchdogStatePath = envOr("UGREEN_FAN_WATCHDOG", "/var/run/ugreen-nas-control.watchdog.json")

func wdtInterval(timeout int) time.Duration {
	return min(time.Duration(timeout)*time.Second/3, wdtMaxInterval)
}

var errNoWatchdog = errors.New("no watchdog registers for this model")

func (c *EC) wdtRegs() (*ecWdt, error) {
	if w := c.sp().wdt; w != nil {
		return w, nil
	}
	return nil, errNoWatchdog
}

// WatchdogArmed reads the enable byte (read only, also on the plain iDX).
func (c *EC) WatchdogArmed() (bool, error) {
	w, err := c.wdtRegs()
	if err != nil {
		return false, err
	}
	v, err := c.read(w.enable)
	return v != 0, err
}

// WatchdogCounter reads the timeout registers back, read only. UGREEN reads the same pair as its counter
// (ug_it55_4800gt_functions.c:550-556@c75c5ab) without saying whether it counts down.
func (c *EC) WatchdogCounter() (int, error) {
	w, err := c.wdtRegs()
	if err != nil {
		return 0, err
	}
	hi, err := c.read(w.hi)
	if err != nil {
		return 0, err
	}
	lo, err := c.read(w.lo)
	return int(hi)<<8 | int(lo), err
}

// WatchdogPet feeds a running timer by rewriting its timeout. It never touches the enable byte.
func (c *EC) WatchdogPet(timeout int) error {
	w, err := c.wdtRegs()
	if err != nil {
		return err
	}
	t := min(max(timeout, wdtMinTimeout), wdtMaxTimeout)
	if err := c.write(w.hi, byte(t>>8)); err != nil {
		return err
	}
	return c.write(w.lo, byte(t))
}

// DisarmWatchdog clears the enable byte; the only value this tool ever writes there.
func (c *EC) DisarmWatchdog() error {
	w, err := c.wdtRegs()
	if err != nil {
		return err
	}
	return c.write(w.enable, 0)
}

// Petter feeds the watchdog of an EC while it is armed. One per process; Tick runs under the fan lock.
// The daemon calls it every tick, also while it yields to another fan tool: feeding is harmless and keeps the box
// from resetting. A calibration or a probe calls it as well.
type Petter struct {
	Timeout int // seconds, 0 = wdtDefaultTimeout
	last    time.Time
	status  WatchdogStatus
	failed  bool // the last Tick failed (the daemon logs it once)
}

// Tick reads the enable byte and feeds the timer if it is armed and due. ok is false for a chip without an EC.
func (p *Petter) Tick(chip Fans, now time.Time) (st WatchdogStatus, ok bool, err error) {
	ec, isEC := chip.(*EC)
	// Defense in depth: the plain iDX6011/6012 gets no petter (its 0x98/0x99 is a fan tach, its own map is read only).
	if !isEC || !WatchdogModel(productName()) || ec.sp().wdt == nil || ec.sp().readOnly {
		return WatchdogStatus{}, false, nil
	}
	timeout := p.Timeout
	if timeout == 0 {
		timeout = wdtDefaultTimeout
	}
	timeout = min(max(timeout, wdtMinTimeout), wdtMaxTimeout)

	armed, err := ec.WatchdogArmed()
	if err != nil {
		return p.status, true, err
	}
	p.status.Armed, p.status.Timeout, p.status.Interval = armed, timeout, int(wdtInterval(timeout)/time.Second)
	p.status.Counter = nil
	if armed {
		if n, err := ec.WatchdogCounter(); err == nil {
			p.status.Counter = &n
		}
	}
	if armed && (p.last.IsZero() || now.Sub(p.last) >= wdtInterval(timeout)) {
		if err = ec.WatchdogPet(timeout); err == nil {
			p.last = now
			p.status.LastPet = now.Unix()
		}
	}
	p.status.Time = now.Unix()
	p.status.State = watchdogState(p.status, now)
	_ = writeJSONAtomic(watchdogStatePath, p.status)
	return p.status, true, err
}

// ReadWatchdogStatus is the last state a Petter wrote, nil if none (no EC, or nothing ticked since boot).
func ReadWatchdogStatus() *WatchdogStatus {
	b, err := os.ReadFile(watchdogStatePath)
	if err != nil {
		return nil
	}
	var st WatchdogStatus
	if json.Unmarshal(b, &st) != nil {
		return nil
	}
	st.State = watchdogState(st, time.Now())
	return &st
}

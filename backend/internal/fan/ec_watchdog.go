package fan

import (
	"encoding/json"
	"errors"
	"os"
	"time"
)

// EC watchdog, pet-only. The BIOS may arm the embedded controller's watchdog; if nothing feeds it the box resets.
// This tool never arms it (never writes 0x98 = 1, enforced in EC.write) and only feeds a timer that is already
// running. Registers derived from the UGOS driver ug_4800gt-sio.ko on a DXP4800 GT: wdt_enable
// 0x98, timeout 0xA2/0xA3 (big-endian seconds); pet = rewrite 0xA2/0xA3 with the timeout, every timeout / 3 and
// only while 0x98 is set; on stop clear 0x98 after returning both fans to EC auto. Same map on the iDX6011 Pro
// (EC id 0x5571), not confirmed there. Never on the plain iDX6011: 0x98/0x99 is a fan tachometer there.
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
	Timeout  int    `json:"timeout"`  // seconds
	Interval int    `json:"interval"` // seconds between feeds
	LastPet  int64  `json:"last_pet"` // unix time, 0 = never
	Time     int64  `json:"time"`     // when this was sampled
	State    string `json:"state"`    // WdtOff, WdtArmed or WdtActionNeeded, computed when read
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

func (c *EC) WatchdogArmed() (bool, error) {
	v, err := c.read(ecRegWdtEnable)
	return v != 0, err
}

// WatchdogPet feeds a running timer by rewriting its timeout. It never touches the enable byte.
func (c *EC) WatchdogPet(timeout int) error {
	t := min(max(timeout, wdtMinTimeout), wdtMaxTimeout)
	if err := c.write(ecRegWdtHi, byte(t>>8)); err != nil {
		return err
	}
	return c.write(ecRegWdtLo, byte(t))
}

// DisarmWatchdog clears the enable byte; the only value this tool ever writes there.
func (c *EC) DisarmWatchdog() error { return c.write(ecRegWdtEnable, 0) }

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
	// Defense in depth: other EC models (iDX6012 Pro) use these registers for fan tachometers.
	if !isEC || !WatchdogModel(productName()) {
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

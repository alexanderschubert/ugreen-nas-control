package main

import (
	"encoding/json"
	"fmt"
	"log/syslog"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

var (
	configPath = envOr("UGREEN_FAN_CONFIG", "/boot/config/plugins/ugreen-nas-control/fan.cfg")
	statePath  = envOr("UGREEN_FAN_STATE", "/var/run/ugreen-nas-control.json")
	biosPath   = envOr("UGREEN_FAN_BIOS", "/var/run/ugreen-nas-control.bios")
	notifyCmd  = "/usr/local/emhttp/webGui/scripts/notify"
)

const (
	tick = 2 * time.Second

	// Going up follows the curve at once; going down at most this much per tick,
	// so the fans don't hunt up and down.
	stepDown = 2

	// A fan that shows 0 rpm for this many ticks while driven counts as stalled.
	stallTicks = 8
)

// Role of each fan on the DXP6800 Pro.
var roles = map[string]string{"fan2": "cpu", "fan3": "case", "fan4": "case"}

// State is written after every tick for the web page and the dashboard.
type State struct {
	Time      int64          `json:"time"`
	Mode      string         `json:"mode"`
	Failsafe  string         `json:"failsafe"`
	CPUTemp   *int           `json:"cpu_temp"`
	CaseTemp  *int           `json:"case_temp"`
	CaseFrom  string         `json:"case_from"`
	Targets   map[string]int `json:"targets"`
	Stalled   []string       `json:"stalled"`
	ChipTemps []*int         `json:"chip_temps"`
}

// Decision is what one tick wants from the fans, apart from smoothing.
type Decision struct {
	CPU      int
	Case     int
	Failsafe string
	CaseTemp *int
	CaseFrom string
}

// Decide applies the curves, the minimum speed and the emergency rules.
func Decide(c Config, s Sensors) Decision {
	var d Decision

	disk, nvme := s.MaxDisk(), s.MaxNVMe()
	switch {
	case disk != nil && (nvme == nil || *disk >= *nvme-c.NVMeOffset):
		d.CaseTemp, d.CaseFrom = disk, "disk"
	case nvme != nil:
		t := *nvme - c.NVMeOffset
		d.CaseTemp, d.CaseFrom = &t, "nvme"
	}

	switch {
	case s.CPU == nil:
		d.Failsafe = "cpu_unreadable"
	case *s.CPU >= c.CPUCrit:
		d.Failsafe = "cpu_hot"
	case disk != nil && *disk >= c.DiskCrit:
		d.Failsafe = "disk_hot"
	}
	if d.Failsafe != "" {
		d.CPU, d.Case = 100, 100
		return d
	}

	d.CPU = c.CPUCurve.At(float64(*s.CPU))
	if d.CaseTemp != nil {
		d.Case = c.CaseCurve.At(float64(*d.CaseTemp))
	} else {
		// All disks asleep and no NVMe: the lowest point of the curve.
		d.Case = c.CaseCurve.At(-1)
	}

	if d.CPU < c.MinPct {
		d.CPU = c.MinPct
	}
	if d.Case < c.MinPct {
		d.Case = c.MinPct
	}
	return d
}

// Smooth moves the current speed towards the target: up at once, down slowly.
func Smooth(current, target int) int {
	if current < 0 || target >= current {
		return target
	}
	if current-target > stepDown {
		return current - stepDown
	}
	return target
}

func saveBIOS(chip *Chip) (Snapshot, error) {
	if b, err := os.ReadFile(biosPath); err == nil {
		var s Snapshot
		if json.Unmarshal(b, &s) == nil && len(s) > 0 {
			return s, nil
		}
	}
	s, err := chip.Snapshot()
	if err != nil {
		return nil, err
	}
	b, _ := json.Marshal(s)
	return s, os.WriteFile(biosPath, b, 0o644)
}

func runDaemon(chip *Chip) error {
	logger, _ := syslog.New(syslog.LOG_INFO|syslog.LOG_DAEMON, "ugreen-nas-control")
	logf := func(format string, args ...any) {
		msg := fmt.Sprintf(format, args...)
		if logger != nil {
			logger.Info(msg)
		} else {
			fmt.Fprintln(os.Stderr, msg)
		}
	}

	var bios Snapshot
	if err := withLock(func() (err error) { bios, err = saveBIOS(chip); return }); err != nil {
		return fmt.Errorf("cannot save the BIOS fan settings: %w", err)
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)

	current := map[string]int{}
	zero := map[string]int{}
	notified := map[string]bool{}
	lastMode, lastFailsafe := "", ""

	logf("fan control started (IT8613E at 0x%04x)", chip.Base)

	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		c := LoadConfig(configPath)
		s := ReadSensors()
		st := State{Time: time.Now().Unix(), Mode: c.Mode, CPUTemp: s.CPU, Targets: map[string]int{}}

		if c.Mode != lastMode {
			logf("fan mode: %s", c.Mode)
			lastMode = c.Mode
		}

		err := withLock(func() error {
			// "bios": hand the fans back and only watch.
			if c.Mode == "bios" {
				if len(current) > 0 {
					current = map[string]int{}
					return chip.Restore(bios)
				}
				return nil
			}

			d := Decide(c, s)
			st.Failsafe, st.CaseTemp, st.CaseFrom = d.Failsafe, d.CaseTemp, d.CaseFrom
			if d.Failsafe != lastFailsafe {
				if d.Failsafe != "" {
					logf("emergency: %s, all fans at 100%%", d.Failsafe)
				} else {
					logf("emergency over, back to the curves")
				}
				lastFailsafe = d.Failsafe
			}

			for _, ch := range chip.Channels {
				target := d.Case
				if roles[ch.ID] == "cpu" {
					target = d.CPU
				}
				cur, ok := current[ch.ID]
				if !ok || d.Failsafe != "" {
					cur = -1
				}
				next := Smooth(cur, target)
				if err := chip.SetPWM(ch, percentToDuty(next)); err != nil {
					return err
				}
				current[ch.ID] = next
				st.Targets[ch.ID] = next
			}
			return nil
		})
		if err != nil {
			logf("fan write failed: %v", err)
		}

		// Stalled fans: driven but no tachometer pulses.
		_ = withLock(func() error {
			for _, ch := range chip.Channels {
				rpm, err := chip.RPM(ch)
				if err != nil {
					continue
				}
				if rpm == 0 && current[ch.ID] >= 20 {
					zero[ch.ID]++
				} else {
					zero[ch.ID] = 0
					notified[ch.ID] = false
				}
				if zero[ch.ID] >= stallTicks {
					st.Stalled = append(st.Stalled, ch.ID)
					if !notified[ch.ID] {
						notified[ch.ID] = true
						logf("%s stands still", ch.ID)
						if c.StallNotify {
							notify(ch.ID)
						}
					}
				}
			}
			st.ChipTemps = chip.Temps()
			return nil
		})

		if b, err := json.Marshal(st); err == nil {
			_ = os.WriteFile(statePath+".tmp", b, 0o644)
			_ = os.Rename(statePath+".tmp", statePath)
		}

		select {
		case <-stop:
			_ = withLock(func() error { return chip.Restore(bios) })
			_ = os.Remove(statePath)
			logf("fan control stopped, BIOS fan settings restored")
			return nil
		case <-ticker.C:
		}
	}
}

func notify(id string) {
	name := map[string]string{"cpu": "CPU fan", "case": "Case fan"}[roles[id]]
	_ = exec.Command(notifyCmd, "-e", "UGREEN NAS Control", "-s", name+" stopped",
		"-d", fmt.Sprintf("%s (%s) reports 0 rpm although it is driven. Check the fan and its cable.", name, id),
		"-i", "alert").Run()
}

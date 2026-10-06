// ugreen-nas-fan reads and drives the fans of UGREEN DXP NAS devices through
// the ITE IT8613E environment controller, without a kernel module.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"syscall"
)

var lockPath = envOr("UGREEN_FAN_LOCK", "/var/run/ugreen-nas-control.lock")

// withLock keeps the index/data port pair to one process at a time
// (daemon, web page, command line).
func withLock(fn func() error) error {
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		return err
	}
	defer syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
	return fn()
}

func usage() {
	fmt.Fprint(os.Stderr, `Usage: ugreen-nas-fan <command>

  probe               fan controller found? (JSON)
  status              fans, temperatures and system info (JSON)
  info                system info only, no hardware access (JSON)
  set <fan|cpu|case|all> <0-100>
                      set a fan speed by hand (the daemon overrides it)
  restore             write back the fan settings the BIOS made
  daemon              run the fan curves until SIGTERM
`)
	os.Exit(2)
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "ERROR:", err)
	os.Exit(1)
}

func printJSON(v any) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func openChip() (*Chip, error) {
	p, err := openPorts()
	if err != nil {
		return nil, err
	}
	var chip *Chip
	err = withLock(func() (err error) { chip, err = Detect(p); return })
	if err != nil {
		p.Close()
		return nil, err
	}
	return chip, nil
}

type FanStatus struct {
	ID   string `json:"id"`
	Role string `json:"role"`
	RPM  int    `json:"rpm"`
	Pct  int    `json:"pct"`
	Auto bool   `json:"auto"`
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}

	switch os.Args[1] {
	case "info":
		printJSON(ReadInfo())

	case "probe":
		chip, err := openChip()
		if err != nil {
			printJSON(map[string]any{"ok": false, "error": err.Error()})
			os.Exit(1)
		}
		printJSON(map[string]any{"ok": true, "chip": fmt.Sprintf("IT%04X", chip.ID), "revision": chip.Revision, "base": fmt.Sprintf("0x%04x", chip.Base)})

	case "status":
		out := map[string]any{"ok": true, "info": ReadInfo(), "sensors": ReadSensors(), "presets": presets}

		if chip, err := openChip(); err != nil {
			out["chip_error"] = err.Error()
		} else {
			var fans []FanStatus
			var temps []*int
			_ = withLock(func() error {
				for _, ch := range chip.Channels {
					rpm, _ := chip.RPM(ch)
					duty, auto, _ := chip.PWM(ch)
					fans = append(fans, FanStatus{ID: ch.ID, Role: roles[ch.ID], RPM: rpm, Pct: dutyToPercent(duty), Auto: auto})
				}
				temps = chip.Temps()
				return nil
			})
			out["chip"] = fmt.Sprintf("IT%04X", chip.ID)
			out["fans"] = fans
			out["chip_temps"] = temps
		}

		if b, err := os.ReadFile(statePath); err == nil {
			var st State
			if json.Unmarshal(b, &st) == nil {
				out["daemon"] = st
			}
		}
		printJSON(out)

	case "set":
		if len(os.Args) != 4 {
			usage()
		}
		pct, err := strconv.Atoi(os.Args[3])
		if err != nil || pct < 0 || pct > 100 {
			fail(fmt.Errorf("speed must be 0-100"))
		}
		chip, err := openChip()
		if err != nil {
			fail(err)
		}
		var picked []Channel
		for _, ch := range chip.Channels {
			if os.Args[2] == "all" || os.Args[2] == ch.ID || os.Args[2] == roles[ch.ID] {
				picked = append(picked, ch)
			}
		}
		if len(picked) == 0 {
			fail(fmt.Errorf("unknown fan %q", os.Args[2]))
		}
		err = withLock(func() error {
			if _, err := saveBIOS(chip); err != nil {
				return err
			}
			for _, ch := range picked {
				if err := chip.SetPWM(ch, percentToDuty(pct)); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			fail(err)
		}
		fmt.Printf("%d fan(s) at %d%%.\n", len(picked), pct)

	case "restore":
		b, err := os.ReadFile(biosPath)
		if err != nil {
			fmt.Println("Nothing to restore: the fans still run as the BIOS set them.")
			return
		}
		var s Snapshot
		if err := json.Unmarshal(b, &s); err != nil {
			fail(err)
		}
		chip, err := openChip()
		if err != nil {
			fail(err)
		}
		if err := withLock(func() error { return chip.Restore(s) }); err != nil {
			fail(err)
		}
		fmt.Println("BIOS fan settings restored.")

	case "daemon":
		chip, err := openChip()
		if err != nil {
			fail(err)
		}
		if err := runDaemon(chip); err != nil {
			fail(err)
		}

	default:
		usage()
	}
}

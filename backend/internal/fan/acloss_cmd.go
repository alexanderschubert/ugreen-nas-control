package fan

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/alexanderschubert/ugreen-nas-control/internal/fan/conflict"
	"github.com/alexanderschubert/ugreen-nas-control/internal/hw"
)

// powerACRecordPath keeps what `power-on-ac set` last sent. The GT cannot be read back, so this is the only answer
// there; on other models it is shown next to the value read.
var powerACRecordPath = envOr("UGREEN_FAN_POWER_AC", "/boot/config/plugins/ugreen-nas-control/power_ac.json")

var errACUsage = errors.New("usage: power-on-ac [set on|off|last]")

type acRecord struct {
	Mode string `json:"mode"`
	Time int64  `json:"time"`
}

func readACRecord() *acRecord {
	b, err := os.ReadFile(powerACRecordPath)
	if err != nil {
		return nil
	}
	var r acRecord
	if json.Unmarshal(b, &r) != nil || r.Mode == "" {
		return nil
	}
	return &r
}

// runPowerAC is the command: no argument reads, `set <mode>` writes. rival returns an error while another fan tool
// runs (only asked for a write). The port lock is held for the whole access.
func runPowerAC(args []string, model string, env *acEnv, rival func() error, at time.Time) (map[string]any, error) {
	var want acMode
	switch {
	case len(args) == 0:
	case len(args) == 2 && args[0] == "set":
		m, ok := parseACMode(args[1])
		if !ok {
			return nil, errACUsage
		}
		want = m
	default:
		return nil, errACUsage
	}
	if want != "" {
		if err := rival(); err != nil {
			return nil, err
		}
	}
	defer env.close()

	out := map[string]any{"ok": true, "model": model}
	err := withLock(func() error {
		ac, err := powerACFor(model, env)
		if err != nil {
			return err
		}
		if want != "" {
			if err := ac.Set(want); err != nil {
				return err
			}
			if err := writeJSONAtomic(powerACRecordPath, acRecord{Mode: string(want), Time: at.Unix()}); err != nil {
				return fmt.Errorf("set, but the record could not be written: %w", err)
			}
			out["set"] = string(want)
		}
		st, err := ac.Get()
		if err != nil {
			return err
		}
		out["mode"], out["readable"], out["raw"], out["settable"], out["source"] = st.Mode, st.Readable, st.Raw, st.Settable, st.Source
		if want != "" {
			out["verified"] = st.Readable && st.Mode == want
		}
		if !st.Readable {
			out["note"] = "this model cannot report the setting; last_set is what this tool sent, not read back"
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if r := readACRecord(); r != nil {
		out["last_set"] = r
	} else {
		out["last_set"] = nil
	}
	return out, nil
}

// PowerACCommand is `ugreen-nas-fan power-on-ac [set on|off|last]`.
func PowerACCommand(args []string) {
	env := &acEnv{openPorts: hw.OpenPorts, openMem: hw.OpenMem}
	rival := func() error {
		if r := conflict.Blocking(detectConflicts(), conflict.Fan); len(r) > 0 {
			return fmt.Errorf("%s controls the fans too; switch one of the two off first", rivalNames(r))
		}
		return nil
	}
	out, err := runPowerAC(args, productName(), env, rival, time.Now())
	if errors.Is(err, errACUsage) {
		usage()
	}
	if err != nil {
		printJSON(map[string]any{"ok": false, "error": err.Error()})
		os.Exit(1)
	}
	printJSON(out)
}

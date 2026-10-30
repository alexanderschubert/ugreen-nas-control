package fan

import (
	"context"
	"time"
)

// The per-tick pipeline: inputs, curve, shape, job floor/boost, quiet cap, emergency override (docs/architecture.md).
// Safety: the emergency is decided first (Decide, from the raw sensors, never from a configured input) and its 100 %
// skips shape, job and quiet cap.

type controller struct {
	shape map[string]ShapeState
	held  map[string]int // last curve target per fan, for on_missing = hold
}

func newController() *controller {
	return &controller{shape: map[string]ShapeState{}, held: map[string]int{}}
}

// reset forgets everything: after a rival, bios mode or a calibration the speeds start from scratch.
func (k *controller) reset() {
	clear(k.shape)
	clear(k.held)
}

type tickIn struct {
	Cfg   Config
	Sens  Sensors
	In    InputSource
	Calib *CalibTable
	Now   time.Time
	Dt    time.Duration
	Jobs  JobStatus
	IDs   []string
}

type Plan struct {
	Decision
	Out         map[string]int
	QuietActive bool
	Job         string
	Cap         *int
	Missing     []string
}

// step runs the pipeline and returns the speed for every fan in IDs.
func (k *controller) step(ctx context.Context, t tickIn) Plan {
	c := t.Cfg
	d := Decide(c, t.Sens)
	p := Plan{Decision: d, Out: map[string]int{}}
	emergency := d.Failsafe != ""

	jobName, job := "", Job{Mode: "off"}
	if !emergency {
		jobName, job = ActiveJob(c.Mover, c.Parity, t.Jobs)
	}
	p.Job = jobName
	quiet := !emergency && QuietActive(c.Quiet, t.Now)
	p.QuietActive = quiet
	if quiet {
		p.Cap = &c.Quiet.Cap
	}

	var missing []string
	for _, id := range t.IDs {
		role := roles[id]
		g := c.ForChannel(id)
		st, ok := k.shape[id]
		if !ok {
			st = NewShapeState()
		}

		target := 100
		if !emergency {
			target = k.curveTarget(ctx, t, d, id, role, g, &missing)
			k.held[id] = target
		}

		sp := ShapeParams{
			Deadband: g.Deadband, StartPct: g.StartPct, StartMS: g.StartMS, MinRun: g.MinRun,
			UpStep: g.UpStep, DownStep: g.DownStep, AllowOff: g.AllowOff,
		}
		if t.Calib != nil {
			sp.StallStart = stallStart(t.Calib, id)
		}
		out, st := Shape(st, target, sp, t.Dt, emergency)

		if !emergency {
			if role == "case" && job.Mode != "off" {
				out = ApplyJob(out, job)
			}
			if quiet && (c.Quiet.Scope == "all" || role == "case") {
				jb := job
				if role != "case" {
					jb = Job{Mode: "off"}
				}
				out = ApplyQuiet(out, c.Quiet.Cap, g.MinRun, jb)
			}
			st.Current = out // the ramps start from what was written
		}
		k.shape[id] = st
		p.Out[id] = out
	}
	p.Missing = dedupe(missing)
	return p
}

// curveTarget: temperature of the fan's input through its curve, with the global minimum and case_follows_cpu.
func (k *controller) curveTarget(ctx context.Context, t tickIn, d Decision, id, role string, g Group, missing *[]string) int {
	c := t.Cfg
	var temp float64
	hasTemp := true
	switch {
	case g.Input.Kind != "":
		var ok bool
		if temp, ok = t.In.Read(ctx, g.Input); !ok {
			*missing = append(*missing, g.Input.String())
			switch g.OnMissing {
			case "hold":
				if h, ok := k.held[id]; ok {
					return h
				}
				fallthrough
			case "curve_low":
				temp = -1
			default: // fallback: the default input
				temp, hasTemp = autoTemp(d, t.Sens, role)
			}
		}
	default:
		temp, hasTemp = autoTemp(d, t.Sens, role)
	}
	if !hasTemp {
		temp = -1 // all disks asleep and no NVMe: the lowest point of the curve
	}
	target := g.Curve.At(temp)

	if role == "case" && c.CaseFollowsCPU {
		if cpu, ok := autoTemp(d, t.Sens, "cpu"); ok {
			target = max(target, c.CPU.Curve.At(cpu))
		}
	}
	// allow_off: a curve that says 0 may stop the fan; the global minimum applies otherwise. Job floors, quiet caps
	// (never below min_run) and the emergency are applied after this and still win.
	if g.AllowOff && target == 0 {
		return 0
	}
	return max(target, c.MinPct)
}

func autoTemp(d Decision, s Sensors, role string) (float64, bool) {
	if role == "cpu" {
		if s.CPU == nil {
			return 0, false
		}
		return float64(*s.CPU), true
	}
	if d.CaseTemp == nil {
		return 0, false
	}
	return float64(*d.CaseTemp), true
}

func dedupe(list []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range list {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

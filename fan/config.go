package main

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

// Point of a fan curve: at Temp °C the fan runs at Pct %.
type Point struct {
	Temp int
	Pct  int
}

type Curve []Point

// Fan modes as in UGOS; "bios" leaves the fans as the BIOS set them.
var presets = map[string][2]string{
	"quiet":       {"50:20,65:30,75:50,85:80,92:100", "35:20,40:25,45:40,50:70,55:100"},
	"standard":    {"45:25,60:35,70:55,80:80,88:100", "30:25,38:30,44:50,50:80,55:100"},
	"performance": {"40:35,55:50,65:70,75:90,85:100", "30:35,36:45,42:65,48:90,52:100"},
	"full":        {"0:100", "0:100"},
}

// Config is the saved settings file: key="value" lines, as in the LED plugin.
type Config struct {
	Mode        string
	CPUCurve    Curve
	CaseCurve   Curve
	MinPct      int
	CPUCrit     int
	DiskCrit    int
	NVMeOffset  int
	StallNotify bool
}

func defaultConfig() Config {
	cpu, _ := ParseCurve(presets["standard"][0])
	cs, _ := ParseCurve(presets["standard"][1])
	return Config{
		Mode:        "standard",
		CPUCurve:    cpu,
		CaseCurve:   cs,
		MinPct:      25,
		CPUCrit:     90,
		DiskCrit:    55,
		NVMeOffset:  15,
		StallNotify: true,
	}
}

func readValues(path string) map[string]string {
	values := map[string]string{}
	f, err := os.Open(path)
	if err != nil {
		return values
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		key, value, ok := strings.Cut(strings.TrimSpace(scanner.Text()), "=")
		if !ok || strings.HasPrefix(key, "#") {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"`)
	}
	return values
}

// LoadConfig reads the settings; anything missing or broken keeps its default.
func LoadConfig(path string) Config {
	c := defaultConfig()
	v := readValues(path)

	if m := v["mode"]; m == "bios" || m == "custom" || presets[m] != [2]string{} {
		c.Mode = m
	}

	cpu, cs := v["cpu_curve"], v["case_curve"]
	if p, ok := presets[c.Mode]; ok {
		cpu, cs = p[0], p[1]
	}
	if curve, err := ParseCurve(cpu); err == nil {
		c.CPUCurve = curve
	}
	if curve, err := ParseCurve(cs); err == nil {
		c.CaseCurve = curve
	}

	number := func(key string, def, min, max int) int {
		n, err := strconv.Atoi(v[key])
		if err != nil || n < min || n > max {
			return def
		}
		return n
	}
	c.MinPct = number("min_pct", c.MinPct, 10, 60)
	c.CPUCrit = number("cpu_crit", c.CPUCrit, 70, 105)
	c.DiskCrit = number("disk_crit", c.DiskCrit, 40, 70)
	c.NVMeOffset = number("nvme_offset", c.NVMeOffset, 0, 40)
	c.StallNotify = v["stall_notify"] != "0"

	return c
}

// ParseCurve reads "temp:pct,temp:pct,...", e.g. "40:30,60:50,80:100".
func ParseCurve(s string) (Curve, error) {
	var c Curve
	for _, part := range strings.Split(s, ",") {
		t, p, ok := strings.Cut(strings.TrimSpace(part), ":")
		if !ok {
			return nil, fmt.Errorf("curve point %q is not temp:pct", part)
		}
		temp, err1 := strconv.Atoi(t)
		pct, err2 := strconv.Atoi(p)
		if err1 != nil || err2 != nil || temp < 0 || temp > 120 || pct < 0 || pct > 100 {
			return nil, fmt.Errorf("curve point %q is out of range", part)
		}
		c = append(c, Point{Temp: temp, Pct: pct})
	}
	if len(c) == 0 {
		return nil, fmt.Errorf("empty curve")
	}
	sort.Slice(c, func(i, j int) bool { return c[i].Temp < c[j].Temp })
	return c, nil
}

func (c Curve) String() string {
	parts := make([]string, len(c))
	for i, p := range c {
		parts[i] = fmt.Sprintf("%d:%d", p.Temp, p.Pct)
	}
	return strings.Join(parts, ",")
}

// At gives the fan speed for a temperature, linear between the points.
func (c Curve) At(temp float64) int {
	if len(c) == 0 {
		return 100
	}
	if temp <= float64(c[0].Temp) {
		return c[0].Pct
	}
	for i := 1; i < len(c); i++ {
		a, b := c[i-1], c[i]
		if temp <= float64(b.Temp) {
			if b.Temp == a.Temp {
				return b.Pct
			}
			f := (temp - float64(a.Temp)) / float64(b.Temp-a.Temp)
			return a.Pct + int(f*float64(b.Pct-a.Pct)+0.5)
		}
	}
	return c[len(c)-1].Pct
}

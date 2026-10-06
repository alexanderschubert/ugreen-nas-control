package main

import (
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Where the sensors live; tests point these at a fake tree.
var (
	hwmonDir = envOr("UGREEN_HWMON", "/sys/class/hwmon")
	disksINI = envOr("UGREEN_DISKS_INI", "/var/local/emhttp/disks.ini")
)

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

type Temp struct {
	Name  string `json:"name"`
	Label string `json:"label,omitempty"`
	Temp  *int   `json:"temp"`
}

type Disk struct {
	Name    string `json:"name"`
	Device  string `json:"device"`
	Temp    *int   `json:"temp"`
	Standby bool   `json:"standby"`
	HDD     bool   `json:"hdd"`
}

// Sensors is everything the fan curves look at.
type Sensors struct {
	CPU      *int   `json:"cpu"`
	CPUCores []Temp `json:"cpu_cores"`
	NVMe     []Temp `json:"nvme"`
	Disks    []Disk `json:"disks"`
	Board    *int   `json:"board"`
}

func readInt(path string) (int, bool) {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(b)))
	return n, err == nil
}

func readString(path string) string {
	b, _ := os.ReadFile(path)
	return strings.TrimSpace(string(b))
}

func milli(path string) *int {
	n, ok := readInt(path)
	if !ok {
		return nil
	}
	t := (n + 500) / 1000
	return &t
}

// ReadSensors collects CPU (coretemp), NVMe (hwmon) and Unraid's disk temperatures.
// Disks are only read from disks.ini, so a spun-down disk is never woken up.
func ReadSensors() Sensors {
	var s Sensors

	dirs, _ := filepath.Glob(filepath.Join(hwmonDir, "hwmon*"))
	sort.Slice(dirs, func(i, j int) bool { return hwmonNumber(dirs[i]) < hwmonNumber(dirs[j]) })

	for _, dir := range dirs {
		switch readString(filepath.Join(dir, "name")) {
		case "coretemp":
			inputs, _ := filepath.Glob(filepath.Join(dir, "temp*_input"))
			sort.Slice(inputs, func(i, j int) bool { return tempNumber(inputs[i]) < tempNumber(inputs[j]) })
			for _, in := range inputs {
				label := readString(strings.TrimSuffix(in, "_input") + "_label")
				t := milli(in)
				if strings.HasPrefix(label, "Package") {
					if s.CPU == nil {
						s.CPU = t
					}
					continue
				}
				s.CPUCores = append(s.CPUCores, Temp{Name: label, Temp: t})
			}
		case "nvme":
			name := filepath.Base(readLink(filepath.Join(dir, "device")))
			s.NVMe = append(s.NVMe, Temp{Name: name, Label: readString(filepath.Join(dir, "temp1_label")), Temp: milli(filepath.Join(dir, "temp1_input"))})
		case "acpitz":
			if s.Board == nil {
				s.Board = milli(filepath.Join(dir, "temp1_input"))
			}
		}
	}

	// Without a package sensor the hottest core counts.
	if s.CPU == nil {
		for _, c := range s.CPUCores {
			if c.Temp != nil && (s.CPU == nil || *c.Temp > *s.CPU) {
				t := *c.Temp
				s.CPU = &t
			}
		}
	}

	s.Disks = readDisks(disksINI)
	return s
}

func readLink(path string) string {
	target, err := filepath.EvalSymlinks(path)
	if err != nil {
		return ""
	}
	return target
}

func hwmonNumber(path string) int {
	n, _ := strconv.Atoi(strings.TrimPrefix(filepath.Base(path), "hwmon"))
	return n
}

func tempNumber(path string) int {
	n, _ := strconv.Atoi(strings.TrimSuffix(strings.TrimPrefix(filepath.Base(path), "temp"), "_input"))
	return n
}

// readDisks parses Unraid's disks.ini: [section] lines and key="value" lines.
// NVMe devices are skipped; their own sensors are read above.
func readDisks(path string) []Disk {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	var disks []Disk
	var cur map[string]string

	flush := func() {
		if cur == nil || cur["device"] == "" || strings.HasPrefix(cur["device"], "nvme") {
			return
		}
		d := Disk{
			Name:    cur["name"],
			Device:  cur["device"],
			Standby: cur["spundown"] == "1",
			HDD:     cur["rotational"] != "0",
		}
		if n, err := strconv.Atoi(cur["temp"]); err == nil {
			d.Temp = &n
		}
		disks = append(disks, d)
	}

	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") {
			flush()
			cur = map[string]string{}
			continue
		}
		if key, value, ok := strings.Cut(line, "="); ok && cur != nil {
			cur[key] = strings.Trim(value, `"`)
		}
	}
	flush()

	return disks
}

// Hottest disk and NVMe; nil when none reports a temperature.
func (s Sensors) MaxDisk() *int {
	var max *int
	for _, d := range s.Disks {
		if d.Temp != nil && (max == nil || *d.Temp > *max) {
			max = d.Temp
		}
	}
	return max
}

func (s Sensors) MaxNVMe() *int {
	var max *int
	for _, n := range s.NVMe {
		if n.Temp != nil && (max == nil || *n.Temp > *max) {
			max = n.Temp
		}
	}
	return max
}

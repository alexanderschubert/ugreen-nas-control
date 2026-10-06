package main

import (
	"os"
	"path/filepath"
	"testing"
)

func intp(n int) *int { return &n }

func TestCurve(t *testing.T) {
	c, err := ParseCurve("60:50, 40:30,80:100")
	if err != nil {
		t.Fatal(err)
	}
	if c.String() != "40:30,60:50,80:100" {
		t.Fatalf("sorted = %s", c)
	}
	cases := map[float64]int{-1: 30, 20: 30, 40: 30, 50: 40, 60: 50, 70: 75, 80: 100, 95: 100}
	for temp, want := range cases {
		if got := c.At(temp); got != want {
			t.Errorf("At(%v) = %d, want %d", temp, got, want)
		}
	}

	for _, bad := range []string{"", "40", "40:101", "abc:20", "130:50"} {
		if _, err := ParseCurve(bad); err == nil {
			t.Errorf("ParseCurve(%q) should fail", bad)
		}
	}

	for name, p := range presets {
		if _, err := ParseCurve(p[0]); err != nil {
			t.Errorf("preset %s cpu: %v", name, err)
		}
		if _, err := ParseCurve(p[1]); err != nil {
			t.Errorf("preset %s case: %v", name, err)
		}
	}
}

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "fan.cfg")

	c := LoadConfig(path)
	if c.Mode != "standard" || c.MinPct != 25 || c.CPUCurve.String() != presets["standard"][0] {
		t.Fatalf("defaults = %+v", c)
	}

	os.WriteFile(path, []byte("mode=\"custom\"\ncpu_curve=\"40:30,90:100\"\ncase_curve=\"broken\"\nmin_pct=\"5\"\ncpu_crit=\"95\"\nstall_notify=\"0\"\n"), 0o644)
	c = LoadConfig(path)
	if c.Mode != "custom" || c.CPUCurve.String() != "40:30,90:100" || c.CaseCurve.String() != presets["standard"][1] {
		t.Fatalf("custom = %+v", c)
	}
	if c.MinPct != 25 || c.CPUCrit != 95 || c.StallNotify {
		t.Fatalf("numbers = %+v", c)
	}

	// A preset ignores the saved custom curves.
	os.WriteFile(path, []byte("mode=\"quiet\"\ncpu_curve=\"40:30,90:100\"\n"), 0o644)
	if c = LoadConfig(path); c.CPUCurve.String() != presets["quiet"][0] {
		t.Fatalf("quiet = %s", c.CPUCurve)
	}

	os.WriteFile(path, []byte("mode=\"turbo\"\n"), 0o644)
	if c = LoadConfig(path); c.Mode != "standard" {
		t.Fatalf("unknown mode = %s", c.Mode)
	}
}

func TestDecide(t *testing.T) {
	c := defaultConfig()

	// Idle: CPU 45 °C, disks 35 °C.
	s := Sensors{CPU: intp(45), Disks: []Disk{{Temp: intp(35)}, {Temp: nil, Standby: true}}, NVMe: []Temp{{Temp: intp(40)}}}
	d := Decide(c, s)
	if d.Failsafe != "" || d.CPU != 25 || d.CaseFrom != "disk" || *d.CaseTemp != 35 || d.Case != 28 {
		t.Fatalf("idle = %+v", d)
	}

	// Hot NVMe, minus the offset, beats the disks.
	s.NVMe = []Temp{{Temp: intp(65)}}
	d = Decide(c, s)
	if d.CaseFrom != "nvme" || *d.CaseTemp != 50 || d.Case != 80 {
		t.Fatalf("nvme = %+v", d)
	}

	// Everything asleep: lowest point, never below the minimum.
	d = Decide(c, Sensors{CPU: intp(40)})
	if d.CaseTemp != nil || d.Case != 25 || d.CPU != 25 {
		t.Fatalf("asleep = %+v", d)
	}

	for name, s := range map[string]Sensors{
		"cpu_unreadable": {},
		"cpu_hot":        {CPU: intp(91)},
		"disk_hot":       {CPU: intp(50), Disks: []Disk{{Temp: intp(56)}}},
	} {
		d = Decide(c, s)
		if d.Failsafe != name || d.CPU != 100 || d.Case != 100 {
			t.Errorf("%s = %+v", name, d)
		}
	}
}

func TestSmooth(t *testing.T) {
	cases := [][3]int{{-1, 40, 40}, {30, 60, 60}, {60, 30, 58}, {31, 30, 30}, {50, 50, 50}}
	for _, c := range cases {
		if got := Smooth(c[0], c[1]); got != c[2] {
			t.Errorf("Smooth(%d, %d) = %d, want %d", c[0], c[1], got, c[2])
		}
	}
}

func TestSensors(t *testing.T) {
	dir := t.TempDir()
	write := func(path, content string) {
		full := filepath.Join(dir, path)
		os.MkdirAll(filepath.Dir(full), 0o755)
		os.WriteFile(full, []byte(content), 0o644)
	}

	write("hwmon/hwmon0/name", "nvme\n")
	write("hwmon/hwmon0/temp1_input", "41850\n")
	write("hwmon/hwmon0/temp1_label", "Composite\n")
	os.MkdirAll(filepath.Join(dir, "devices/nvme0"), 0o755)
	os.Symlink(filepath.Join(dir, "devices/nvme0"), filepath.Join(dir, "hwmon/hwmon0/device"))
	write("hwmon/hwmon4/name", "acpitz\n")
	write("hwmon/hwmon4/temp1_input", "27800\n")
	write("hwmon/hwmon7/name", "coretemp\n")
	write("hwmon/hwmon7/temp1_input", "52000\n")
	write("hwmon/hwmon7/temp1_label", "Package id 0\n")
	write("hwmon/hwmon7/temp2_input", "49000\n")
	write("hwmon/hwmon7/temp2_label", "Core 0\n")
	write("hwmon/hwmon7/temp10_input", "51000\n")
	write("hwmon/hwmon7/temp10_label", "Core 8\n")
	write("disks.ini", `["parity"]
name="parity"
device="sdb"
temp="38"
spundown="0"
rotational="1"
["disk1"]
name="disk1"
device="sdc"
temp="*"
spundown="1"
rotational="1"
["cache"]
name="cache"
device="nvme0n1"
temp="41"
rotational="0"
["flash"]
name="flash"
device="sda"
temp="*"
rotational="1"
`)

	hwmonDir = filepath.Join(dir, "hwmon")
	disksINI = filepath.Join(dir, "disks.ini")
	s := ReadSensors()

	if s.CPU == nil || *s.CPU != 52 || len(s.CPUCores) != 2 || s.CPUCores[1].Name != "Core 8" {
		t.Fatalf("cpu = %v %+v", s.CPU, s.CPUCores)
	}
	if len(s.NVMe) != 1 || s.NVMe[0].Name != "nvme0" || *s.NVMe[0].Temp != 42 {
		t.Fatalf("nvme = %+v", s.NVMe)
	}
	if s.Board == nil || *s.Board != 28 {
		t.Fatalf("board = %v", s.Board)
	}
	if len(s.Disks) != 3 || !s.Disks[1].Standby || s.Disks[1].Temp != nil || *s.MaxDisk() != 38 {
		t.Fatalf("disks = %+v", s.Disks)
	}
}

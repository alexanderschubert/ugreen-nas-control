package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Where the hardware is read from; tests point these at a fake tree.
var (
	sysDir      = envOr("UGREEN_SYS", "/sys")
	dmidecodeBn = envOr("UGREEN_DMIDECODE", "dmidecode")
	mountsFile  = envOr("UGREEN_MOUNTS", "/proc/mounts")
)

// What a model has built in.
type layout struct {
	// The kernel's ata port of each bay, left to right (the same order as UGREEN LED
	// Control uses).
	bayPorts []int
	// The slot behind each PCIe root port: "m2-1", "m2-2", "system" (the internal M.2 of
	// the UGOS module) or "pcie" (a card in the PCIe slot). An NVMe behind any other
	// port counts as "pcie".
	slots map[string]string
}

// layoutFor knows the DXP6800 Pro (ata3..ata6, then ata1, ata2) and the DXP4800 GT
// (ata1..ata4). Any other model: no bays, every NVMe on the PCIe slot.
//
// DXP6800 Pro, from an Unraid box with four NVMe: the CPU's root port 00:06.0 is M.2 slot 1
// (x4, PCIe 4.0), 00:06.2 the PCIe slot (a card with one SSD, negotiated x1), and the
// chipset's 00:1c.0 the second M.2 slot (x2 negotiated) and 00:1c.2 the internal system
// slot (x1), the one of the UGOS module. Confirmed by the author for the SSD in the system slot.
func layoutFor(model string) layout {
	switch {
	case strings.HasPrefix(model, "DXP6800"):
		return layout{[]int{3, 4, 5, 6, 1, 2}, map[string]string{
			"0000:00:06.0": "m2-1", "0000:00:1c.0": "m2-2", "0000:00:1c.2": "system", "0000:00:06.2": "pcie",
		}}
	case strings.HasPrefix(model, "DXP4800 GT"):
		return layout{[]int{1, 2, 3, 4}, map[string]string{"0000:00:01.4": "m2-1", "0000:00:01.6": "m2-2"}}
	}
	return layout{}
}

type DIMM struct {
	Locator      string `json:"locator"`
	SizeMB       int    `json:"size_mb"`
	Type         string `json:"type"`
	SpeedMT      int    `json:"speed_mt"`
	ConfiguredMT int    `json:"configured_mt"`
	Manufacturer string `json:"manufacturer"`
	PartNumber   string `json:"part_number"`
}

type NVMe struct {
	ID        string `json:"id"`
	Model     string `json:"model"`
	SizeBytes int64  `json:"size_bytes"`
	Slot      string `json:"slot"` // "m2-1", "m2-2", "system" or "pcie"
	PCI       string `json:"pci"`
	Temp      *int   `json:"temp"`
	Role      string `json:"role,omitempty"` // Unraid's name for it: cache, a pool, disk1, ...
	Boot      bool   `json:"boot"`           // /boot (Unraid's flash) is on this SSD
}

type Bay struct {
	Bay       int    `json:"bay"`
	Present   bool   `json:"present"`
	Device    string `json:"device,omitempty"`
	Model     string `json:"model,omitempty"`
	SizeBytes int64  `json:"size_bytes,omitempty"`
	HDD       bool   `json:"hdd"`
	Role      string `json:"role,omitempty"` // Unraid's name: parity, disk1, ...
	ID        string `json:"id,omitempty"`   // Unraid's disk id: model_serial, as on its Main page
	Temp      *int   `json:"temp"`
	Standby   bool   `json:"standby"`
}

type NetPort struct {
	Name      string `json:"name"`
	Link      bool   `json:"link"`
	SpeedMbit int    `json:"speed_mbit"`
}

type Hardware struct {
	Model  string    `json:"model"`
	Memory []DIMM    `json:"memory"`
	NVMe   []NVMe    `json:"nvme"`
	Bays   []Bay     `json:"bays"`
	Net    []NetPort `json:"net"`
}

// ReadHardware looks at what is built in. It only reads: sysfs, Unraid's disks.ini
// (never the disks themselves) and dmidecode.
func ReadHardware() Hardware {
	s := ReadSensors()
	model := readString(filepath.Join(dmiDir, "product_name"))
	l := layoutFor(model)
	hw := Hardware{Model: model, Memory: readMemory(), NVMe: readNVMe(s, l), Net: readNet()}
	if len(l.bayPorts) > 0 {
		hw.Bays = readBays(s, l)
	}
	return hw
}

var sizeRe = regexp.MustCompile(`^(\d+)\s*(MB|MiB|GB|GiB|TB|TiB)$`)

// parseDmidecode reads the "Memory Device" blocks of `dmidecode -t memory`.
func parseDmidecode(out string) []DIMM {
	var dimms []DIMM
	var cur map[string]string

	flush := func() {
		if cur == nil {
			return
		}
		d := DIMM{
			Locator:      cur["Locator"],
			Type:         cur["Type"],
			Manufacturer: cur["Manufacturer"],
			PartNumber:   cur["Part Number"],
			SpeedMT:      mtPerSecond(cur["Speed"]),
			ConfiguredMT: mtPerSecond(cur["Configured Memory Speed"]),
		}
		if m := sizeRe.FindStringSubmatch(cur["Size"]); m != nil {
			n, _ := strconv.Atoi(m[1])
			switch m[2] {
			case "GB", "GiB":
				n *= 1024
			case "TB", "TiB":
				n *= 1024 * 1024
			}
			d.SizeMB = n
		}
		dimms = append(dimms, d)
	}

	for _, line := range strings.Split(out, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "Memory Device" {
			flush()
			cur = map[string]string{}
			continue
		}
		if key, value, ok := strings.Cut(trimmed, ":"); ok && cur != nil {
			if _, seen := cur[key]; !seen {
				cur[key] = strings.TrimSpace(value)
			}
		}
	}
	flush()

	return dimms
}

func mtPerSecond(s string) int {
	n, _ := strconv.Atoi(strings.Fields(s + " 0")[0])
	return n
}

func readMemory() []DIMM {
	out, err := exec.Command(dmidecodeBn, "-t", "memory").Output()
	if err != nil {
		return nil
	}
	return parseDmidecode(string(out))
}

var pciRe = regexp.MustCompile(`^[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\.[0-9a-f]$`)

// pciChain lists the PCI addresses on a sysfs path, root port first, device last.
func pciChain(path string) []string {
	var chain []string
	for _, part := range strings.Split(path, "/") {
		if pciRe.MatchString(part) {
			chain = append(chain, part)
		}
	}
	return chain
}

func sectorBytes(block string) int64 {
	n, _ := strconv.ParseInt(readString(filepath.Join(sysDir, "block", block, "size")), 10, 64)
	return n * 512
}

var (
	bootRe    = regexp.MustCompile(`^/dev/(nvme\d+)n\d+(?:p\d+)?$`)
	nvmeDevRe = regexp.MustCompile(`^(nvme\d+)n\d+`)
)

// bootNVMe names the NVMe controller /boot is mounted from ("" if /boot is on something else).
func bootNVMe() string {
	b, err := os.ReadFile(mountsFile)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) >= 2 && f[1] == "/boot" {
			if m := bootRe.FindStringSubmatch(f[0]); m != nil {
				return m[1]
			}
		}
	}
	return ""
}

// nvmeRoles maps an NVMe controller (nvme0) to its name in Unraid's disks.ini ("cache", "disk1",
// "flash", ...), taken from the section whose device is nvme0n1.
func nvmeRoles(path string) map[string]string {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	roles := map[string]string{}
	var cur map[string]string
	flush := func() {
		if cur == nil {
			return
		}
		if m := nvmeDevRe.FindStringSubmatch(cur["device"]); m != nil && cur["name"] != "" {
			roles[m[1]] = cur["name"]
		}
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

	return roles
}

func readNVMe(s Sensors, l layout) []NVMe {
	temps := map[string]*int{}
	for _, t := range s.NVMe {
		temps[t.Name] = t.Temp
	}
	roles, boot := nvmeRoles(disksINI), bootNVMe()

	paths, _ := filepath.Glob(filepath.Join(sysDir, "class", "nvme", "nvme*"))
	sort.Slice(paths, func(i, j int) bool { return nvmeNumber(paths[i]) < nvmeNumber(paths[j]) })

	var list []NVMe
	for _, p := range paths {
		id := filepath.Base(p)
		real := readLink(filepath.Join(p, "device"))
		chain := pciChain(real)

		d := NVMe{ID: id, Model: readString(filepath.Join(p, "model")), Slot: "pcie", Temp: temps[id]}
		if len(chain) > 0 {
			d.PCI = chain[len(chain)-1]
			// Behind a bridge the NVMe is the last address, the root port the first.
			if slot, ok := l.slots[chain[0]]; ok {
				d.Slot = slot
			}
		}
		d.SizeBytes = sectorBytes(id + "n1")
		d.Role = roles[id]
		d.Boot = id == boot || d.Role == "flash"
		list = append(list, d)
	}
	return list
}

func nvmeNumber(path string) int {
	n, _ := strconv.Atoi(strings.TrimPrefix(filepath.Base(path), "nvme"))
	return n
}

var ataRe = regexp.MustCompile(`/ata(\d+)/`)

func readBays(s Sensors, l layout) []Bay {
	byDevice := map[string]Disk{}
	for _, d := range s.Disks {
		byDevice[d.Device] = d
	}

	bays := make([]Bay, len(l.bayPorts))
	for i := range bays {
		bays[i].Bay = i + 1
	}

	devices, _ := filepath.Glob(filepath.Join(sysDir, "block", "sd*"))
	for _, dev := range devices {
		m := ataRe.FindStringSubmatch(readLink(filepath.Join(dev, "device")) + "/")
		if m == nil {
			continue
		}
		port, _ := strconv.Atoi(m[1])
		for i, p := range l.bayPorts {
			if p != port {
				continue
			}
			name := filepath.Base(dev)
			b := Bay{
				Bay:       i + 1,
				Present:   true,
				Device:    name,
				Model:     readString(filepath.Join(dev, "device", "model")),
				SizeBytes: sectorBytes(name),
				HDD:       readString(filepath.Join(dev, "queue", "rotational")) != "0",
			}
			if d, ok := byDevice[name]; ok {
				b.Role, b.ID, b.Temp, b.Standby, b.HDD = d.Name, d.ID, d.Temp, d.Standby, d.HDD
			}
			bays[i] = b
		}
	}
	return bays
}

func readNet() []NetPort {
	paths, _ := filepath.Glob(filepath.Join(sysDir, "class", "net", "e*"))
	sort.Strings(paths)

	var ports []NetPort
	for _, p := range paths {
		// Bridges, bonds and VLANs have no device behind them.
		if _, err := os.Stat(filepath.Join(p, "device")); err != nil {
			continue
		}
		port := NetPort{Name: filepath.Base(p)}
		if n, ok := readInt(filepath.Join(p, "speed")); ok && n > 0 {
			port.Link, port.SpeedMbit = readString(filepath.Join(p, "carrier")) == "1", n
		}
		ports = append(ports, port)
	}
	return ports
}

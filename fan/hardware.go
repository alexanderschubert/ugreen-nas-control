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
)

// The six bays of the DXP6800 Pro, left to right, and the kernel's ata port of each
// (the same order as UGREEN LED Control uses: ata3..ata6, then ata1, ata2).
var bayPorts = []int{3, 4, 5, 6, 1, 2}

// The two M.2 slots hang on the CPU's PCIe root ports; an NVMe behind any other
// port sits on a card in the PCIe slot.
var m2Slots = map[string]int{"0000:00:06.0": 1, "0000:00:06.2": 2}

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
	Slot      string `json:"slot"` // "m2-1", "m2-2" or "pcie"
	PCI       string `json:"pci"`
	Temp      *int   `json:"temp"`
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
	Memory []DIMM    `json:"memory"`
	NVMe   []NVMe    `json:"nvme"`
	Bays   []Bay     `json:"bays"`
	Net    []NetPort `json:"net"`
}

// ReadHardware looks at what is built in. It only reads: sysfs, Unraid's disks.ini
// (never the disks themselves) and dmidecode.
func ReadHardware() Hardware {
	s := ReadSensors()
	hw := Hardware{Memory: readMemory(), NVMe: readNVMe(s), Net: readNet()}
	if ModelSupported(readString(filepath.Join(dmiDir, "product_name"))) {
		hw.Bays = readBays(s)
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

func readNVMe(s Sensors) []NVMe {
	temps := map[string]*int{}
	for _, t := range s.NVMe {
		temps[t.Name] = t.Temp
	}

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
			if n, ok := m2Slots[chain[0]]; ok {
				d.Slot = "m2-" + strconv.Itoa(n)
			}
		}
		d.SizeBytes = sectorBytes(id + "n1")
		list = append(list, d)
	}
	return list
}

func nvmeNumber(path string) int {
	n, _ := strconv.Atoi(strings.TrimPrefix(filepath.Base(path), "nvme"))
	return n
}

var ataRe = regexp.MustCompile(`/ata(\d+)/`)

func readBays(s Sensors) []Bay {
	byDevice := map[string]Disk{}
	for _, d := range s.Disks {
		byDevice[d.Device] = d
	}

	bays := make([]Bay, len(bayPorts))
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
		for i, p := range bayPorts {
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

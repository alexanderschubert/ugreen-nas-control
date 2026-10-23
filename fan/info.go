package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

var dmiDir = envOr("UGREEN_DMI", "/sys/class/dmi/id")

// Info is what the overview shows about the NAS itself.
type Info struct {
	Model    string `json:"model"`
	BIOS     string `json:"bios"`
	BIOSDate string `json:"bios_date"`
	CPU      string `json:"cpu"`
	Threads  int    `json:"threads"`
	MemoryKB int    `json:"memory_kb"`
	Kernel   string `json:"kernel"`
	Unraid   string `json:"unraid"`
	Uptime   int    `json:"uptime"`
}

// ModelSupported tells whether the fan wiring of this tool (see roles and the
// IT8613E and IT5571 channels) is that of the machine: the DXP6800 Pro and the
// DXP4800 GT are known.
func ModelSupported(model string) bool {
	return strings.HasPrefix(model, "DXP6800") || isDXP4800GT(model)
}

// requireSupportedModel keeps every access to the fan controller ports to the model
// the tool was made for; other boards may wire the fan headers differently.
func requireSupportedModel() error {
	model := productName()
	if ModelSupported(model) {
		return nil
	}
	if model == "" {
		model = "unknown model"
	}
	return fmt.Errorf("%s is not supported: UGREEN NAS Control is made for the DXP6800 Pro and the DXP4800 GT only", model)
}

func ReadInfo() Info {
	info := Info{
		Model:    readString(filepath.Join(dmiDir, "product_name")),
		BIOS:     readString(filepath.Join(dmiDir, "bios_version")),
		BIOSDate: readString(filepath.Join(dmiDir, "bios_date")),
		Threads:  runtime.NumCPU(),
		Kernel:   readString("/proc/sys/kernel/osrelease"),
	}

	if f, err := os.Open("/proc/cpuinfo"); err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			if key, value, ok := strings.Cut(scanner.Text(), ":"); ok && strings.TrimSpace(key) == "model name" {
				info.CPU = strings.TrimSpace(value)
				break
			}
		}
		f.Close()
	}

	if f, err := os.Open("/proc/meminfo"); err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			fields := strings.Fields(scanner.Text())
			if len(fields) >= 2 && fields[0] == "MemTotal:" {
				info.MemoryKB, _ = strconv.Atoi(fields[1])
				break
			}
		}
		f.Close()
	}

	if v := readValues("/etc/unraid-version")["version"]; v != "" {
		info.Unraid = v
	}

	if fields := strings.Fields(readString("/proc/uptime")); len(fields) > 0 {
		if f, err := strconv.ParseFloat(fields[0], 64); err == nil {
			info.Uptime = int(f)
		}
	}

	return info
}

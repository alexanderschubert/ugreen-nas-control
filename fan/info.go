package main

import (
	"bufio"
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

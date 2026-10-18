package main

import (
	"os"
	"path/filepath"
	"testing"
)

const dmidecodeSample = `Handle 0x0010, DMI type 16, 23 bytes
Physical Memory Array
	Location: System Board Or Motherboard
	Number Of Devices: 2

Handle 0x0011, DMI type 17, 92 bytes
Memory Device
	Array Handle: 0x0010
	Size: 32 GiB
	Locator: Controller0-ChannelA-DIMM0
	Type: DDR5
	Speed: 5600 MT/s
	Manufacturer: Micron Technology
	Part Number: CT32G56C46S5.M16D1  
	Configured Memory Speed: 4800 MT/s

Handle 0x0012, DMI type 17, 92 bytes
Memory Device
	Size: No Module Installed
	Locator: Controller1-ChannelA-DIMM0
	Type: Unknown
	Speed: Unknown
`

func TestParseDmidecode(t *testing.T) {
	dimms := parseDmidecode(dmidecodeSample)
	if len(dimms) != 2 {
		t.Fatalf("%d modules", len(dimms))
	}
	d := dimms[0]
	if d.Locator != "Controller0-ChannelA-DIMM0" || d.SizeMB != 32768 || d.Type != "DDR5" ||
		d.SpeedMT != 5600 || d.ConfiguredMT != 4800 || d.PartNumber != "CT32G56C46S5.M16D1" {
		t.Errorf("%+v", d)
	}
	if dimms[1].SizeMB != 0 || dimms[1].SpeedMT != 0 {
		t.Errorf("empty slot: %+v", dimms[1])
	}
}

// fakeSys builds the parts of /sys that ReadHardware looks at, after a DXP6800 Pro.
func fakeSys(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	write := func(path, content string) {
		full := filepath.Join(dir, path)
		os.MkdirAll(filepath.Dir(full), 0o755)
		os.WriteFile(full, []byte(content), 0o644)
	}
	link := func(target, path string) {
		full := filepath.Join(dir, path)
		os.MkdirAll(filepath.Dir(full), 0o755)
		os.Symlink(filepath.Join(dir, target), full)
	}

	nvmes := []struct{ id, root, dev, model string }{
		{"nvme0", "0000:00:06.2", "0000:02:00.0", "CT500P310SSD8"},
		{"nvme1", "0000:00:1c.2", "0000:58:00.0", "WD Red SN700 1000GB"},
		{"nvme2", "0000:00:1c.0", "0000:57:00.0", "WD Red SN700 1000GB"},
		{"nvme3", "0000:00:06.0", "0000:01:00.0", "Samsung SSD 990 PRO 2TB"},
	}
	for _, n := range nvmes {
		base := "devices/pci0000:00/" + n.root + "/" + n.dev
		os.MkdirAll(filepath.Join(dir, base, "nvme", n.id), 0o755)
		write(base+"/nvme/"+n.id+"/model", n.model+"   \n")
		link(base+"/nvme/"+n.id, "class/nvme/"+n.id)
		link(base, "class/nvme/"+n.id+"/device")
		write("block/"+n.id+"n1/size", "3907029168\n")
	}

	// sda/sdb on the PCH controller (ata1, ata2), sdc..sdf on the ASMedia (ata3..ata6).
	disks := []struct {
		dev, pci string
		port     int
	}{
		{"sda", "0000:00:17.0", 1}, {"sdb", "0000:00:17.0", 2},
		{"sdc", "0000:5b:00.0", 3}, {"sdd", "0000:5b:00.0", 4},
		{"sde", "0000:5b:00.0", 5}, {"sdf", "0000:5b:00.0", 6},
	}
	for _, d := range disks {
		target := "devices/pci0000:00/" + d.pci + "/ata" + string(rune('0'+d.port)) + "/host0/target0:0:0/0:0:0:0"
		os.MkdirAll(filepath.Join(dir, target), 0o755)
		write(target+"/model", "ST8000VN004-2M21\n")
		link(target, "block/"+d.dev+"/device")
		write("block/"+d.dev+"/size", "15628053168\n")
		write("block/"+d.dev+"/queue/rotational", "1\n")
	}
	// A USB stick has no ata port and is no bay.
	os.MkdirAll(filepath.Join(dir, "devices/usb1/1-1"), 0o755)
	link("devices/usb1/1-1", "block/sdg/device")

	// Physical NICs have a device; a bridge does not.
	for _, n := range []struct{ name, speed, carrier string }{{"eth0", "10000", "1"}, {"eth1", "-1", "0"}, {"br0", "10000", "1"}} {
		if n.name != "br0" {
			os.MkdirAll(filepath.Join(dir, "class/net", n.name, "device"), 0o755)
		}
		write("class/net/"+n.name+"/speed", n.speed+"\n")
		write("class/net/"+n.name+"/carrier", n.carrier+"\n")
	}

	// hwmon, disks.ini and DMI
	write("class/hwmon/hwmon0/name", "nvme\n")
	write("class/hwmon/hwmon0/temp1_input", "41850\n")
	os.MkdirAll(filepath.Join(dir, "devices/x/nvme3"), 0o755)
	link("devices/x/nvme3", "class/hwmon/hwmon0/device")
	write("disks.ini", "[\"disk1\"]\nname=\"disk1\"\ndevice=\"sdc\"\ntemp=\"36\"\nspundown=\"0\"\nrotational=\"1\"\n"+
		"[\"parity\"]\nname=\"parity\"\ndevice=\"sde\"\ntemp=\"*\"\nspundown=\"1\"\nrotational=\"1\"\n")
	write("dmi/product_name", "DXP6800 Pro\n")
	write("dmidecode.sh", "#!/bin/sh\ncat <<'EOT'\n"+dmidecodeSample+"EOT\n")
	os.Chmod(filepath.Join(dir, "dmidecode.sh"), 0o755)

	oldSys, oldHwmon, oldINI, oldDMI, oldBin := sysDir, hwmonDir, disksINI, dmiDir, dmidecodeBn
	t.Cleanup(func() { sysDir, hwmonDir, disksINI, dmiDir, dmidecodeBn = oldSys, oldHwmon, oldINI, oldDMI, oldBin })
	sysDir, hwmonDir, disksINI = dir, filepath.Join(dir, "class/hwmon"), filepath.Join(dir, "disks.ini")
	dmiDir, dmidecodeBn = filepath.Join(dir, "dmi"), filepath.Join(dir, "dmidecode.sh")
}

func TestReadHardware(t *testing.T) {
	fakeSys(t)
	hw := ReadHardware()

	if len(hw.Memory) != 2 || hw.Memory[0].SizeMB != 32768 {
		t.Errorf("memory %+v", hw.Memory)
	}

	slots := map[string]string{}
	for _, n := range hw.NVMe {
		slots[n.ID] = n.Slot
	}
	want := map[string]string{"nvme0": "m2-2", "nvme1": "pcie", "nvme2": "pcie", "nvme3": "m2-1"}
	for id, slot := range want {
		if slots[id] != slot {
			t.Errorf("%s in %q, want %q", id, slots[id], slot)
		}
	}
	if hw.NVMe[0].Model != "CT500P310SSD8" || hw.NVMe[0].SizeBytes != 3907029168*512 {
		t.Errorf("nvme0 %+v", hw.NVMe[0])
	}
	if hw.NVMe[3].Temp == nil || *hw.NVMe[3].Temp != 42 || hw.NVMe[0].Temp != nil {
		t.Errorf("nvme temperatures %+v", hw.NVMe)
	}

	// bay 1..6 = ata3, ata4, ata5, ata6, ata1, ata2
	if len(hw.Bays) != 6 {
		t.Fatalf("%d bays", len(hw.Bays))
	}
	for i, dev := range []string{"sdc", "sdd", "sde", "sdf", "sda", "sdb"} {
		if !hw.Bays[i].Present || hw.Bays[i].Device != dev {
			t.Errorf("bay %d: %+v, want %s", i+1, hw.Bays[i], dev)
		}
	}
	if b := hw.Bays[0]; b.Role != "disk1" || b.Temp == nil || *b.Temp != 36 || b.Model != "ST8000VN004-2M21" {
		t.Errorf("bay 1 %+v", b)
	}
	if b := hw.Bays[2]; b.Role != "parity" || !b.Standby || b.Temp != nil {
		t.Errorf("bay 3 %+v", b)
	}

	if len(hw.Net) != 2 || !hw.Net[0].Link || hw.Net[0].SpeedMbit != 10000 || hw.Net[1].Link {
		t.Errorf("net %+v", hw.Net)
	}
}

func TestReadHardwareOtherModelHasNoBays(t *testing.T) {
	fakeSys(t)
	os.WriteFile(filepath.Join(dmiDir, "product_name"), []byte("DXP4800 Plus\n"), 0o644)
	if hw := ReadHardware(); hw.Bays != nil {
		t.Errorf("bays on another model: %+v", hw.Bays)
	}
}

func TestReadHardwareWithoutDmidecode(t *testing.T) {
	fakeSys(t)
	dmidecodeBn = "/nonexistent/dmidecode"
	if hw := ReadHardware(); len(hw.Memory) != 0 || len(hw.NVMe) != 4 {
		t.Errorf("%+v", hw)
	}
}

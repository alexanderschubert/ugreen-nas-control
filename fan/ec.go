package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// ACPI devices in sysfs; tests point this at a fake tree.
var acpiDevicesDir = envOr("UGREEN_ACPI_DEVICES", "/sys/bus/acpi/devices")

// The DXP4800 GT has no Super-I/O fan chip. Its fans hang on an ITE IT5571
// embedded controller, reached through the standard ACPI EC ports (no kernel
// driver binds them on Unraid). Sequence and registers are those of UGREEN's
// GPL driver (ug_it55_4800gt_functions.c, it55_helper.c).
const (
	ecDataPort = 0x62
	ecCmdPort  = 0x66 // command when written, status when read

	ecOBF = 0x01 // output buffer full: a byte waits at the data port
	ecIBF = 0x02 // input buffer full: the controller has not taken the last byte

	ecCmdRead  = 0x80
	ecCmdWrite = 0x81

	ecPoll  = 100 * time.Microsecond
	ecTries = 3

	// The chip id sits behind the Super-I/O ports at 0x4e/0x4f.
	ecSioIndex = 0x4e
	ecSioData  = 0x4f
	ecChipID   = 0x5571

	ecModeAuto   = 0 // the controller's own curve
	ecModeManual = 1

	// Duty cycle register range: 0 to 0xc6 (198).
	ecMaxDuty = 0xc6

	ecRegBoardTemp = 0x5f // °C
	ecRegCPUTemp   = 0x70 // °C, follows k10temp
)

// Longest wait for IBF or OBF; a variable so that the test can shorten it.
var ecWait = 500 * time.Millisecond

// IT5571 channels as wired on the DXP4800 GT: fan1 is the CPU fan, fan3 the
// case fan. fan2 and fan4 read 0 on this model and are left alone. The tachometer
// counter is the rpm itself.
var ecChannels = []Channel{
	{ID: "fan1", TachHigh: 0x34, TachLow: 0x35, Duty: 0xb1, Ctrl: 0xb0},
	{ID: "fan3", TachHigh: 0x38, TachLow: 0x39, Duty: 0xb5, Ctrl: 0xb4},
}

// EC is the IT5571 embedded controller of the DXP4800 GT.
type EC struct {
	ports Ports
}

// DetectEC checks the chip id and that the EC answers at the ACPI EC ports.
func DetectEC(p Ports) (*EC, error) {
	// With the kernel's ACPI EC driver bound, both sides would talk to the
	// controller at once and garble each other's transfers.
	bound, _ := filepath.Glob(filepath.Join(acpiDevicesDir, "PNP0C09:*", "driver"))
	for _, d := range bound {
		if _, err := os.Lstat(d); err == nil {
			return nil, fmt.Errorf("the kernel's ACPI embedded controller driver is bound (%s); refusing to share the controller with it", filepath.Dir(d))
		}
	}

	read := func(reg byte) (byte, error) {
		if err := p.Out(ecSioIndex, reg); err != nil {
			return 0, err
		}
		return p.In(ecSioData)
	}
	hi, err := read(0x20)
	if err != nil {
		return nil, err
	}
	lo, err := read(0x21)
	if err != nil {
		return nil, err
	}
	if id := uint16(hi)<<8 | uint16(lo); id != ecChipID {
		return nil, fmt.Errorf("no supported fan controller found (embedded controller id 0x%04x)", id)
	}

	c := &EC{ports: p}
	for _, ch := range ecChannels {
		mode, err := c.read(ch.Ctrl)
		if err != nil {
			return nil, fmt.Errorf("IT5571 embedded controller does not answer: %w", err)
		}
		if mode > ecModeManual {
			return nil, fmt.Errorf("IT5571 embedded controller answers unexpectedly (mode 0x%02x)", mode)
		}
	}
	return c, nil
}

// wait polls the status port until the flag is set or clear (IBF: the controller
// took the last byte; OBF: it put one out).
func (c *EC) wait(flag byte, set bool) error {
	deadline := time.Now().Add(ecWait)
	for {
		st, err := c.ports.In(ecCmdPort)
		if err != nil {
			return err
		}
		if (st&flag != 0) == set {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("embedded controller timeout (status 0x%02x)", st)
		}
		time.Sleep(ecPoll)
	}
}

func (c *EC) send(port uint16, v byte) error {
	if err := c.wait(ecIBF, false); err != nil {
		return err
	}
	return c.ports.Out(port, v)
}

func (c *EC) retry(fn func() error) (err error) {
	for i := 0; i < ecTries; i++ {
		if err = fn(); err == nil {
			return nil
		}
		time.Sleep(time.Duration(i+1) * 5 * time.Millisecond)
	}
	return err
}

func (c *EC) read(reg byte) (v byte, err error) {
	err = c.retry(func() error {
		// A byte left over from an aborted read would be taken for the answer.
		if st, err := c.ports.In(ecCmdPort); err == nil && st&ecOBF != 0 {
			_, _ = c.ports.In(ecDataPort)
		}
		if err := c.send(ecCmdPort, ecCmdRead); err != nil {
			return err
		}
		if err := c.send(ecDataPort, reg); err != nil {
			return err
		}
		if err := c.wait(ecOBF, true); err != nil {
			return err
		}
		v, err = c.ports.In(ecDataPort)
		return err
	})
	return
}

func (c *EC) write(reg, value byte) error {
	return c.retry(func() error {
		if err := c.send(ecCmdPort, ecCmdWrite); err != nil {
			return err
		}
		if err := c.send(ecDataPort, reg); err != nil {
			return err
		}
		return c.send(ecDataPort, value)
	})
}

func (c *EC) Name() string { return "IT5571" }

func (c *EC) Describe() string { return "IT5571 embedded controller" }

func (c *EC) Details() map[string]any {
	return map[string]any{"ports": fmt.Sprintf("0x%02x/0x%02x", ecDataPort, ecCmdPort)}
}

func (c *EC) Outputs() []Channel { return ecChannels }

func (c *EC) MaxDuty() byte { return ecMaxDuty }

// In auto mode the duty register keeps the last manual value, not the real output.
func (c *EC) AutoDutyKnown() bool { return false }

func (c *EC) RPM(ch Channel) (int, error) {
	hi, err := c.read(ch.TachHigh)
	if err != nil {
		return 0, err
	}
	lo, err := c.read(ch.TachLow)
	if err != nil {
		return 0, err
	}
	return int(hi)<<8 | int(lo), nil
}

func (c *EC) PWM(ch Channel) (duty byte, auto bool, err error) {
	if duty, err = c.read(ch.Duty); err != nil {
		return 0, false, err
	}
	mode, err := c.read(ch.Ctrl)
	if err != nil {
		return 0, false, err
	}
	return duty, mode == ecModeAuto, nil
}

func (c *EC) SetPWM(ch Channel, duty byte) error {
	if duty > ecMaxDuty {
		duty = ecMaxDuty
	}
	mode, err := c.read(ch.Ctrl)
	if err != nil {
		return err
	}
	// Duty first, then manual mode: the fan never sits at the stale duty.
	if err := c.write(ch.Duty, duty); err != nil {
		return err
	}
	if mode != ecModeManual {
		return c.write(ch.Ctrl, ecModeManual)
	}
	return nil
}

func (c *EC) temp(reg byte) *int {
	v, err := c.read(reg)
	if err != nil || v == 0 || v == 0xff {
		return nil
	}
	t := int(v)
	return &t
}

// BoardTemp is the mainboard temperature in °C; the GT has no acpitz sensor.
func (c *EC) BoardTemp() *int { return c.temp(ecRegBoardTemp) }

// Temps in °C: the EC's own CPU reading (the mainboard goes through BoardTemp).
func (c *EC) Temps() []*int { return []*int{c.temp(ecRegCPUTemp)} }

func (c *EC) Snapshot() (Snapshot, error) {
	s := Snapshot{}
	for _, ch := range ecChannels {
		mode, err := c.read(ch.Ctrl)
		if err != nil {
			return nil, err
		}
		duty, err := c.read(ch.Duty)
		if err != nil {
			return nil, err
		}
		s[ch.ID] = [2]byte{mode, duty}
	}
	return s, nil
}

// Restore hands the fans back to the EC's own curve, whatever the snapshot
// says: it may have been taken while a fan was still in manual mode.
func (c *EC) Restore(Snapshot) error {
	var errs []error
	for _, ch := range ecChannels {
		errs = append(errs, c.write(ch.Ctrl, ecModeAuto))
	}
	return errors.Join(errs...)
}

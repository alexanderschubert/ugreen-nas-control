package main

import (
	"path/filepath"
	"strings"
)

// Fans is a fan controller as the commands and the daemon see it: the
// IT8613E Super-I/O chip of the DXP6800 Pro or the IT5571 embedded controller
// of the DXP4800 GT. Callers hold the lock around every call.
type Fans interface {
	Name() string                                  // IT8613, IT5571
	Describe() string                              // for the log: where the chip sits
	Details() map[string]any                       // extra fields of probe
	Outputs() []Channel                            // fan headers in use
	MaxDuty() byte                                 // duty value of 100 %
	AutoDutyKnown() bool                           // duty register tells the real output in auto mode
	RPM(Channel) (int, error)                      // 0 when it stands or nothing is connected
	PWM(Channel) (duty byte, auto bool, err error) // auto: the controller's own curve drives it
	SetPWM(Channel, byte) error                    // switches to manual if needed
	Temps() []*int                                 // the controller's own sensors in °C; nil where none
	Snapshot() (Snapshot, error)                   // state to give back when the plugin lets go
	Restore(Snapshot) error
}

// BoardTemper is implemented by controllers that read the mainboard temperature.
type BoardTemper interface {
	BoardTemp() *int
}

// Channel is one fan header with its tachometer and PWM output.
type Channel struct {
	ID       string // fan2, fan3, ...
	TachLow  byte
	TachHigh byte
	Duty     byte
	Ctrl     byte
}

// Saved state of all outputs, written back when the plugin lets go.
type Snapshot map[string][2]byte // channel id -> {ctrl, duty}

func productName() string {
	return readString(filepath.Join(dmiDir, "product_name"))
}

func isDXP4800GT(model string) bool {
	return strings.HasPrefix(model, "DXP4800 GT")
}

// detectFans picks the controller by model: the GT has no Super-I/O fan chip,
// its fans hang on the embedded controller.
func detectFans(p Ports, model string) (Fans, error) {
	if isDXP4800GT(model) {
		ec, err := DetectEC(p)
		if err != nil {
			return nil, err
		}
		return ec, nil
	}
	chip, err := Detect(p)
	if err != nil {
		return nil, err
	}
	return chip, nil
}

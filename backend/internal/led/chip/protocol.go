package chip

import (
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/alexanderschubert/ugreen-nas-control/internal/hw"
	"github.com/alexanderschubert/ugreen-nas-control/internal/testenv"
)

// The LED controller of UGREEN NAS devices (I2C address 0x3a), as described by
// miskcoo/ugreen_leds_controller: one ID per LED, 12-byte block writes with a
// checksum, and an 11-byte status block per LED at register 0x81 + ID.

const (
	controllerAddr = 0x3a

	cmdBrightness = 0x01
	cmdColor      = 0x02
	cmdOnOff      = 0x03
	cmdBlink      = 0x04
	cmdBreath     = 0x05

	regLastCommandOK = 0x80
	regStatusBase    = 0x81
	statusLength     = 11

	minPeriod = 100
	maxPeriod = 0x7fff
)

var ledNames = []string{"power", "netdev", "disk1", "disk2", "disk3", "disk4", "disk5", "disk6", "disk7", "disk8"}

var modeNames = []string{"off", "on", "blink", "breath"}

// layout names a LED controller family that differs from the DX/DXP one: "idx-pro"
// (UGREEN iDX6011 Pro: two LAN LEDs, so disk1 is register 3) and "idx" (the same
// frames, disk1 is register 2). Both write SMBus blocks without the LED ID in the
// payload and with a big-endian checksum, as the vendor driver does (after klein0r's
// work on miskcoo/ugreen_leds_controller#93). It comes from the model name, or from
// UGREEN_LAYOUT to try it by hand; empty is the DX/DXP protocol.
var layoutState struct {
	mu  sync.Mutex
	set bool
	v   string
}

// getLayout is the layout in use; the first call reads UGREEN_LAYOUT and the DMI model name (not at process start).
func getLayout() string {
	layoutState.mu.Lock()
	defer layoutState.mu.Unlock()

	if !layoutState.set {
		layoutState.v, layoutState.set = detectLayout(hw.ProductName(hw.DMIDir)), true
	}

	return layoutState.v
}

func SetLayout(v string) {
	layoutState.mu.Lock()
	layoutState.v, layoutState.set = v, true
	layoutState.mu.Unlock()
}

// UseProduct picks the layout from a model name given by the caller (UGREEN_PRODUCT, a test DMI file);
// UGREEN_LAYOUT still wins.
func UseProduct(product string) { SetLayout(detectLayout(product)) }

func detectLayout(product string) string {
	if v := testenv.Get("UGREEN_LAYOUT"); v != "" {
		return v
	}

	return IdxLayout(product)
}

func idxFrames() bool {
	l := getLayout()
	return l == "idx" || l == "idx-pro"
}

func ledID(name string) (byte, error) {
	i := slices.Index(ledNames, name)
	if i < 0 {
		return 0, fmt.Errorf("unknown LED %q (power, netdev, disk1..disk8)", name)
	}
	if getLayout() == "idx-pro" && i >= 2 {
		i++ // the second LAN LED sits in between
	}
	return byte(i), nil
}

// commandPacket is the block written to register <id>: the ID, a fixed header,
// the command with four parameters and a big-endian checksum. The checksum
// covers the packet with a zero in place of the ID.
func commandPacket(id, command byte, params [4]byte) []byte {
	packet := []byte{id, 0xa0, 0x01, 0x00, 0x00, command, params[0], params[1], params[2], params[3]}

	sum := 0
	for _, b := range packet[1:] {
		sum += int(b)
	}

	return append(packet, byte(sum>>8), byte(sum))
}

// gtCommandPacket is the GT variant: an SMBus block payload without the ID and
// with a little-endian checksum over the same bytes.
func gtCommandPacket(command byte, params [4]byte) []byte {
	packet := []byte{0xa0, 0x01, 0x00, 0x00, command, params[0], params[1], params[2], params[3]}

	sum := 0
	for _, b := range packet {
		sum += int(b)
	}

	return append(packet, byte(sum), byte(sum>>8))
}

// idxCommandPacket is the iDX6011 variant: an SMBus block payload without the ID and
// with the checksum (0xa1 + command + parameters) high byte first.
func idxCommandPacket(command byte, params [4]byte) []byte {
	packet := []byte{0xa0, 0x01, 0x00, 0x00, command, params[0], params[1], params[2], params[3]}

	sum := 0
	for _, b := range packet {
		sum += int(b)
	}

	return append(packet, byte(sum>>8), byte(sum))
}

func clampPeriod(ms int) int { return min(max(ms, minPeriod), maxPeriod) }

// periodParams encodes blink/breath timing as the controller expects it:
// the whole cycle first, then the "on" part.
func periodParams(onMs, offMs int) [4]byte {
	on := clampPeriod(onMs)
	off := clampPeriod(offMs)
	cycle := on + off

	return [4]byte{byte(cycle >> 8), byte(cycle), byte(on >> 8), byte(on)}
}

type ledStatus struct {
	Name       string `json:"name"`
	Mode       string `json:"mode"`
	Brightness int    `json:"brightness"`
	Color      string `json:"color"`
	OnMs       int    `json:"on_ms"`
	OffMs      int    `json:"off_ms"`
}

var errBadStatus = errors.New("invalid status block")

// plainLine is the --plain output: "<name> <mode> <brightness> <R> <G> <B> <on_ms> <off_ms>".
func plainLine(s ledStatus) string {
	return fmt.Sprintf("%s %s %d %s %d %d", s.Name, s.Mode, s.Brightness, s.Color, s.OnMs, s.OffMs)
}

// parseStatus decodes the 11-byte status block: mode, brightness, R, G, B,
// cycle (2 bytes), on time (2 bytes), checksum (2 bytes) over the first nine.
func parseStatus(name string, block []byte) (ledStatus, error) {
	if len(block) != statusLength {
		return ledStatus{}, errBadStatus
	}

	sum := 0
	for _, b := range block[:9] {
		sum += int(b)
	}
	if sum == 0 || sum != int(block[9])<<8|int(block[10]) || int(block[0]) >= len(modeNames) {
		return ledStatus{}, errBadStatus
	}

	cycle := int(block[5])<<8 | int(block[6])
	on := int(block[7])<<8 | int(block[8])

	return ledStatus{
		Name:       name,
		Mode:       modeNames[block[0]],
		Brightness: int(block[1]),
		Color:      fmt.Sprintf("%d %d %d", block[2], block[3], block[4]),
		OnMs:       on,
		OffMs:      cycle - on,
	}, nil
}

func parseLeds(arg string) ([]string, error) {
	if arg == "all" {
		return ledNames, nil
	}

	var names []string
	for _, name := range strings.Split(arg, ",") {
		if _, err := ledID(name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, nil
}

func parseByte(arg string) (byte, error) {
	n, err := strconv.Atoi(arg)
	if err != nil || n < 0 || n > 255 {
		return 0, fmt.Errorf("%q is not a value between 0 and 255", arg)
	}
	return byte(n), nil
}

func parseMs(arg string) (int, error) {
	n, err := strconv.Atoi(arg)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%q is not a duration in ms", arg)
	}
	return n, nil
}

// buildCommand turns "color 255 0 0", "brightness 128", "on", "off",
// "blink 500 500" or "breath 1200 900" into a controller command.
func buildCommand(args []string) (byte, [4]byte, error) {
	if slices.Equal(args, []string{"reset"}) {
		return buildReset()
	}
	return buildPlainCommand(args)
}

// buildReset is the mode reset the iDX front panel needs before a steady on: command 0x04 with zero timing.
func buildReset() (byte, [4]byte, error) { return cmdBlink, [4]byte{}, nil }

func buildPlainCommand(args []string) (byte, [4]byte, error) {
	var params [4]byte

	if len(args) == 0 {
		return 0, params, errors.New("missing command")
	}

	want := map[string]int{"color": 3, "brightness": 1, "on": 0, "off": 0, "blink": 2, "breath": 2}
	n, ok := want[args[0]]
	if !ok {
		return 0, params, fmt.Errorf("unknown command %q", args[0])
	}
	if len(args)-1 != n {
		return 0, params, fmt.Errorf("%s needs %d value(s)", args[0], n)
	}

	switch args[0] {
	case "color":
		for i := range 3 {
			b, err := parseByte(args[1+i])
			if err != nil {
				return 0, params, err
			}
			params[i] = b
		}
		return cmdColor, params, nil

	case "brightness":
		b, err := parseByte(args[1])
		if err != nil {
			return 0, params, err
		}
		params[0] = b
		return cmdBrightness, params, nil

	case "on", "off":
		if args[0] == "on" {
			params[0] = 1
		}
		return cmdOnOff, params, nil

	default:
		on, err := parseMs(args[1])
		if err != nil {
			return 0, params, err
		}
		off, err := parseMs(args[2])
		if err != nil {
			return 0, params, err
		}
		command := byte(cmdBlink)
		if args[0] == "breath" {
			command = cmdBreath
		}
		return command, periodParams(on, off), nil
	}
}

// DXP480T Plus: address of the power LED controller and the register writes
// (register, value) for a steady white LED: red off, white off, white on,
// slow flash off, permanently on.
const dxp480tAddr = 0x26

var dxp480tWhite = [][2]byte{
	{0xa0, 1},
	{0xa0, 2},
	{0xb1, 2},
	{0x51, 0},
	{0x50, 0},
}

// IdxLayout is the layout of an iDX601x front panel by its DMI product name: "idx-pro" when the name
// says Pro (two LAN LEDs, disk registers shifted by one), "idx" for the plain iDX6011 and iDX6012
// (one LAN LED), "" for every other model.
//
// Facts, not code, from MIT-licensed community plugins (see docs/third-party.md):
//   - the plain iDX6012 is handled like the iDX6011: omgapuppy/unraid-ugreen-idx6011-led-fan
//     src/idx6011-fan-status.c:76 (model "iDX6011" or "iDX6012", commit 6196dc0), src/monitor.sh:118-122.
//   - the Pro is told apart by "Pro" in the product name: noodlemctwoodle/unraid-ugreen-idx6011-pro
//     (commit d202a7c) src/panel/fan.h:38.
func IdxLayout(product string) string {
	if !strings.HasPrefix(product, "iDX6011") && !strings.HasPrefix(product, "iDX6012") {
		return ""
	}
	if strings.Contains(product, "Pro") {
		return "idx-pro"
	}
	return "idx"
}

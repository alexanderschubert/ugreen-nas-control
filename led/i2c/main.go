// ugreen-led-i2c talks to the LED controller of UGREEN NAS devices directly
// over /dev/i2c-N, so no kernel module is needed.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

const usage = `Usage:
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] probe
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] [--plain] get <led[,led...]|all>
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] set <led[,led...]|all> <command>
  ugreen-led-i2c [--bus /dev/i2c-N] scan [all]
  ugreen-led-i2c [--bus /dev/i2c-N] [--force] dxp480t white
  ugreen-led-i2c [--speed 0-4] [--reverse] [--idle-only] effect <rainbow|temperature> <led[,led...]|all>

LEDs:     power, netdev, disk1 ... disk8
Commands: color <R> <G> <B> | brightness <0-255> | on | off
          blink <on_ms> <off_ms> | breath <on_ms> <off_ms>

scan      lists the I2C addresses that answer (read only), on one bus or with
          "all" on every /dev/i2c-N, for models whose controller isn't at 0x3a
dxp480t   DXP480T Plus: the power LED (controller at 0x26) to static white

--bus     the SMBus device (default: the "SMBus I801 adapter")
--force   use the address even while a kernel driver (led_ugreen) holds it
--plain   get prints one line per LED for shell scripts:
          <name> <mode> <brightness> <R> <G> <B> <on_ms> <off_ms>

effect runs until SIGTERM: rainbow moves a colour wave over the LEDs
(--speed, --reverse), temperature colours them by the CPU temperature
(blue 35 °C, green 45 °C, yellow 55 °C, red 65 °C). --idle-only pauses it
while any disk is busy.
`

func main() {
	os.Exit(run(os.Args[1:]))
}

func fail(err error) int {
	fmt.Fprintln(os.Stderr, "ERROR:", err)
	return 1
}

func usageError() int {
	fmt.Fprint(os.Stderr, usage)
	return 2
}

func printJSON(value any) {
	out, _ := json.MarshalIndent(value, "", "  ")
	fmt.Println(string(out))
}

func run(args []string) int {
	flags := flag.NewFlagSet("ugreen-led-i2c", flag.ContinueOnError)
	flags.Usage = func() { fmt.Fprint(os.Stderr, usage) }
	busPath := flags.String("bus", "", "")
	force := flags.Bool("force", false, "")
	plain := flags.Bool("plain", false, "")
	speed := flags.Int("speed", 2, "")
	reverse := flags.Bool("reverse", false, "")
	idleOnly := flags.Bool("idle-only", false, "")

	if err := flags.Parse(args); err != nil {
		return 2
	}
	args = flags.Args()

	if len(args) == 0 || (args[0] != "probe" && args[0] != "scan" && len(args) < 2) {
		return usageError()
	}

	if args[0] == "scan" {
		return runScan(*busPath, len(args) == 2 && args[1] == "all")
	}

	if args[0] == "dxp480t" {
		if len(args) != 2 || args[1] != "white" {
			return usageError()
		}
		return runDXP480T(*busPath, *force)
	}

	if args[0] == "effect" {
		if len(args) != 3 {
			return usageError()
		}
		leds, err := parseLeds(args[2])
		if err != nil {
			return fail(err)
		}
		options := effectOptions{
			name: args[1], leds: leds, speed: *speed, reverse: *reverse,
			idleOnly: *idleOnly, busPath: *busPath, force: *force,
		}
		if err := validateEffect(options); err != nil {
			return fail(err)
		}
		if err := runEffect(options); err != nil {
			return fail(err)
		}
		return 0
	}

	var leds []string
	var command byte
	var params [4]byte

	// Validate everything before touching the bus.
	switch args[0] {
	case "probe":
		leds = ledNames
	case "get", "set":
		var err error
		if leds, err = parseLeds(args[1]); err != nil {
			return fail(err)
		}
		if args[0] == "set" {
			if command, params, err = buildCommand(args[2:]); err != nil {
				return fail(err)
			}
		}
	default:
		return usageError()
	}

	b, err := openBus(*busPath, *force)
	if err != nil {
		return fail(err)
	}
	defer b.close()

	switch args[0] {
	case "probe":
		var found []string
		for _, name := range leds {
			if _, err := b.status(name); err == nil {
				found = append(found, name)
			}
		}
		printJSON(map[string]any{"bus": b.path, "address": "0x3a", "leds": found})
		if len(found) == 0 {
			return fail(fmt.Errorf("no LED answered on %s", b.path))
		}

	case "get":
		statuses := map[string]ledStatus{}
		for _, name := range leds {
			s, err := b.status(name)
			if err != nil {
				// "all" lists what exists; a named LED that doesn't answer is an error.
				if args[1] == "all" {
					continue
				}
				return fail(err)
			}
			statuses[name] = s
		}
		if *plain {
			for _, name := range leds {
				if s, ok := statuses[name]; ok {
					fmt.Println(plainLine(s))
				}
			}
		} else if len(leds) == 1 {
			printJSON(statuses[leds[0]])
		} else {
			printJSON(statuses)
		}

	case "set":
		for _, name := range leds {
			id, _ := ledID(name)
			if err := b.change(id, command, params); err != nil {
				return fail(fmt.Errorf("%s: %w", name, err))
			}
		}
	}

	return 0
}

func runScan(busPath string, all bool) int {
	paths, err := scanBuses(busPath, all)
	if err != nil {
		return fail(err)
	}

	result := map[string]any{}
	for _, path := range paths {
		found, busy, err := scanBus(path)
		if err != nil {
			result[path] = map[string]any{"error": err.Error()}
			continue
		}
		result[path] = map[string]any{"answer": found, "busy": busy}
	}
	printJSON(result)
	return 0
}

// The DXP480T Plus has a single power LED, on a simpler controller at 0x26. These are
// the register writes of ich777's ugreenleds-driver (tested there on a DXP480T Plus).
func runDXP480T(busPath string, force bool) int {
	b, err := openBusAt(busPath, dxp480tAddr, force)
	if err != nil {
		return fail(err)
	}
	defer b.close()

	for _, w := range dxp480tWhite {
		if err := b.writeByteData(w[0], w[1]); err != nil {
			return fail(fmt.Errorf("0x26 register 0x%02x: %w", w[0], err))
		}
	}
	return 0
}

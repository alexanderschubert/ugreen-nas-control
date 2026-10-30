// ugreen-nas is the one binary of the plugin. It runs as the tool its name says (the plugin installs the names as
// symlinks to it) or as `ugreen-nas <tool> ...`:
//
//	ugreen-nas-fan, fan       fan controller tool and daemon
//	ugreen-led-i2c, led-i2c   LED controller over /dev/i2c-N
//	ugreen-led-ctl, led-ctl   LED CLI and status daemon
//	ugreen-nas-ctl, nas-ctl   fan daemon control, LED switch, report
package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// tools maps every accepted name to the tool it runs.
var tools = map[string]string{
	"ugreen-nas-fan": "fan", "fan": "fan",
	"ugreen-led-i2c": "led-i2c", "led-i2c": "led-i2c",
	"ugreen-led-ctl": "led-ctl", "led-ctl": "led-ctl",
	"ugreen-nas-ctl": "nas-ctl", "nas-ctl": "nas-ctl",
}

func main() { os.Exit(run(os.Args)) }

// resolve picks the tool from the name the binary was started as, else from its first argument.
func resolve(args []string) (tool string, name string, rest []string, ok bool) {
	if len(args) == 0 {
		return "", "", nil, false
	}
	if t, ok := tools[filepath.Base(args[0])]; ok {
		return t, args[0], args[1:], true
	}
	if len(args) > 1 {
		if t, ok := tools[args[1]]; ok {
			return t, args[0] + " " + args[1], args[2:], true
		}
	}
	return "", "", nil, false
}

func run(args []string) int {
	tool, name, rest, ok := resolve(args)
	if !ok {
		fmt.Fprintln(os.Stderr, "Usage: ugreen-nas <fan|led-i2c|led-ctl|nas-ctl> [arguments]\n(or start it under the name of a tool: ugreen-nas-fan, ugreen-led-i2c, ugreen-led-ctl, ugreen-nas-ctl)")
		return 2
	}
	switch tool {
	case "fan":
		return runFan(rest)
	case "led-i2c":
		return runLEDI2C(rest)
	case "led-ctl":
		return runLEDCtl(name, rest)
	default:
		return runNasCtl(rest)
	}
}

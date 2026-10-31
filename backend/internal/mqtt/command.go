package mqtt

import (
	"encoding/json"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type command struct {
	Cmd    string `json:"cmd"`
	Target string `json:"target"`
	Name   string `json:"name"`
	TS     int64  `json:"ts"`
	Nonce  string `json:"nonce"`
}

type cmdResult struct {
	Nonce string `json:"nonce"`
	OK    bool   `json:"ok"`
	Text  string `json:"text"`
}

const (
	cmdMaxAge   = 30 * time.Second
	cmdMinSpace = 10 * time.Second
)

// commander validates and carries out commands. run is how a program is started (replaced in tests).
type commander struct {
	cfg     Config
	updates func() []Update
	run     func(name string, args ...string) error
	delay   time.Duration

	mu    sync.Mutex
	seen  map[string]time.Time
	lastC time.Time
}

// handle checks one command and returns the answer. The program is started by `after`, which the caller runs once
// the answer has been sent: a restart would otherwise take the answer down with it.
func (c *commander) handle(raw []byte, now time.Time) (res cmdResult, after func()) {
	var cmd command
	if err := json.Unmarshal(raw, &cmd); err != nil {
		return cmdResult{Text: "unreadable command"}, nil
	}
	res.Nonce = cmd.Nonce
	reject := func(text string) (cmdResult, func()) {
		logf("command %q rejected: %s", cmd.Cmd, text)
		res.Text = text
		return res, nil
	}

	if cmd.Nonce == "" || len(cmd.Nonce) > 64 {
		return reject("nonce missing")
	}
	age := now.Sub(time.Unix(cmd.TS, 0))
	if age > cmdMaxAge || age < -cmdMaxAge {
		return reject("command too old or clock apart")
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.seen == nil {
		c.seen = map[string]time.Time{}
	}
	for n, t := range c.seen {
		if now.Sub(t) > 2*cmdMaxAge {
			delete(c.seen, n)
		}
	}
	if _, dup := c.seen[cmd.Nonce]; dup {
		return reject("command already seen")
	}
	if len(c.seen) >= 256 {
		return reject("too many commands")
	}
	c.seen[cmd.Nonce] = now
	if now.Sub(c.lastC) < cmdMinSpace {
		return reject("too fast, wait a moment")
	}

	var prog []string
	switch cmd.Cmd {
	case "reboot", "shutdown":
		if !c.cfg.Control {
			return reject("remote control is switched off")
		}
		prog = []string{powerdownBin}
		if cmd.Cmd == "reboot" {
			prog = append(prog, "-r")
		}
	case "update":
		if !c.cfg.ControlUpdates {
			return reject("updates from the display are switched off")
		}
		if cmd.Target != "plugin" {
			return reject("only plugin updates can be installed this way")
		}
		file := ""
		for _, u := range c.updates() {
			if u.Kind == "plugin" && u.Name == cmd.Name {
				file = u.File
			}
		}
		if strings.HasPrefix(cmd.Name, "-") || file == "" || filepath.Base(file) != file {
			return reject("no such update")
		}
		prog = []string{pluginBin, "update", file}
	default:
		return reject("unknown command")
	}

	c.lastC = now
	logf("command %q accepted: %s", cmd.Cmd, strings.Join(prog, " "))
	res.OK, res.Text = true, "started"
	return res, func() {
		time.Sleep(c.delay)
		if err := c.run(prog[0], prog[1:]...); err != nil {
			logf("command %q failed: %v", cmd.Cmd, err)
		}
	}
}

func execRun(name string, args ...string) error {
	return exec.Command(name, args...).Run()
}

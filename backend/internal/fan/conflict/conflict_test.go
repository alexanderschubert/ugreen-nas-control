package conflict

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/alexanderschubert/ugreen-nas-control/internal/testenv"
)

func write(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func roots(t *testing.T) Roots {
	d := t.TempDir()
	return Roots{
		PluginsBoot: filepath.Join(d, "boot"), PluginsWeb: filepath.Join(d, "web"), ProcModules: filepath.Join(d, "modules"),
		SysModule: filepath.Join(d, "sysmodule"), Hwmon: filepath.Join(d, "hwmon"), Proc: filepath.Join(d, "proc"), Self: 1,
	}
}

func ids(list []Conflict) []string {
	var out []string
	for _, c := range list {
		out = append(out, c.Kind+":"+c.ID)
	}
	return out
}

func TestNothingFound(t *testing.T) {
	if got := roots(t).Detect(); len(got) != 0 {
		t.Fatalf("empty roots found %v", got)
	}
}

func TestPlugins(t *testing.T) {
	r := roots(t)
	for _, n := range []string{"fanctrlplus2", "ugreen-idx6011-pro", "unrelated"} {
		write(t, filepath.Join(r.PluginsBoot, n+".plg"), "<PLUGIN/>")
	}
	got := r.Detect()
	if want := []string{"plugin:fanctrlplus2", "plugin:ugreen-idx6011-pro"}; !reflect.DeepEqual(ids(got), want) {
		t.Fatalf("got %v want %v", ids(got), want)
	}
	if got[0].Severity != SeverityWarn || got[0].Name != "FanCtrl Plus 2" || !reflect.DeepEqual(got[1].Controls, []string{Fan, LED}) {
		t.Fatalf("bad fields %+v", got)
	}
	if len(Blocking(got, Fan)) != 0 {
		t.Fatal("an installed plugin must not block")
	}
}

func TestModules(t *testing.T) {
	r := roots(t)
	write(t, r.ProcModules, "it87 24576 0 - Live 0x0\nsnd 1 0 - Live 0x0\n")
	write(t, filepath.Join(r.SysModule, "led_ugreen", "version"), "1")
	if want := []string{"module:it87", "module:led_ugreen"}; !reflect.DeepEqual(ids(r.Detect()), want) {
		t.Fatalf("got %v", ids(r.Detect()))
	}
}

func TestHwmonManualOnly(t *testing.T) {
	r := roots(t)
	write(t, filepath.Join(r.Hwmon, "hwmon3", "name"), "it8613\n")
	write(t, filepath.Join(r.Hwmon, "hwmon3", "pwm2_enable"), "1\n")
	write(t, filepath.Join(r.Hwmon, "hwmon3", "pwm3_enable"), "1\n")
	write(t, filepath.Join(r.Hwmon, "hwmon3", "pwm4_enable"), "2\n")
	write(t, filepath.Join(r.Hwmon, "hwmon4", "name"), "k10temp\n")
	write(t, filepath.Join(r.Hwmon, "hwmon4", "pwm1_enable"), "1\n")
	write(t, filepath.Join(r.Hwmon, "hwmon5", "name"), "it5571\n")
	write(t, filepath.Join(r.Hwmon, "hwmon5", "pwm1_enable"), "2\n")
	got := r.Detect()
	if len(got) != 1 || got[0].Kind != KindHwmon || got[0].ID != "it8613" || got[0].Detail != "pwm2, pwm3 manual" || got[0].Severity != SeverityWarn {
		t.Fatalf("got %+v", got)
	}
}

func TestDaemons(t *testing.T) {
	r := roots(t)
	write(t, filepath.Join(r.Proc, "10", "cmdline"), "/bin/bash\x00/usr/local/emhttp/plugins/fanctrlplus2/scripts/fanctrlplus2_loop.sh\x00")
	write(t, filepath.Join(r.Proc, "11", "cmdline"), "/bin/bash\x00/usr/local/emhttp/plugins/dynamix.system.autofan/scripts/autofan\x00-c\x00x")
	write(t, filepath.Join(r.Proc, "12", "cmdline"), "/usr/bin/ugreen-leds\x00")
	write(t, filepath.Join(r.Proc, "13", "cmdline"), "/usr/local/bin/ugreen-nas-fan\x00daemon\x00") // ours
	write(t, filepath.Join(r.Proc, "14", "cmdline"), "vim\x00/tmp/notes/autofan-notes.txt\x00")     // only a similar name
	write(t, filepath.Join(r.Proc, "15", "cmdline"), "/bin/bash\x00/x/fanctrlplus2_loop.sh\x00")    // second copy
	write(t, filepath.Join(r.Proc, "1", "cmdline"), "/usr/bin/ugreen-pro-leds\x00")                 // Self is skipped
	write(t, filepath.Join(r.Proc, "self", "cmdline"), "ugreen-gt-leds\x00run\x00")                 // not a pid
	got := r.Detect()
	want := []string{"daemon:autofan", "daemon:fanctrlplus2_loop.sh", "daemon:ugreen-leds"}
	if !reflect.DeepEqual(ids(got), want) {
		t.Fatalf("got %v want %v", ids(got), want)
	}
	if n := len(Blocking(got, Fan)); n != 2 {
		t.Fatalf("fan blockers %d", n)
	}
	if b := Blocking(got, LED); len(b) != 1 || b[0].ID != "ugreen-leds" {
		t.Fatalf("led blockers %+v", b)
	}
}

func TestDefaultUsesEnv(t *testing.T) {
	if !testenv.Enabled {
		t.Skip("the release build ignores test variables; run with -tags testhooks")
	}
	t.Setenv("UGREEN_PROC", "/nope")
	if Default().Proc != "/nope" {
		t.Fatal("env ignored")
	}
}

// A plugin counts as installed with its .plg or its folder under /usr/local/emhttp/plugins.
func TestPluginFolder(t *testing.T) {
	r := roots(t)
	if err := os.MkdirAll(filepath.Join(r.PluginsWeb, "ugreenleds-driver"), 0o755); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(r.PluginsWeb, "autofan-file"), "not a folder")
	if got, want := ids(r.Detect()), []string{"plugin:ugreenleds-driver"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestDefaultIgnoresEnvInReleaseBuild(t *testing.T) {
	if testenv.Enabled {
		t.Skip("release build only")
	}
	t.Setenv("UGREEN_PROC", "/nope")
	if Default().Proc != "/proc" {
		t.Fatal("the release build honours UGREEN_PROC")
	}
}

// Our own pgrep -f ^/bin/bash /usr/bin/ugreen-leds carries the rival's path in an argument: not the rival.
func TestDaemonNameInArgumentsIsNoRival(t *testing.T) {
	r := roots(t)
	write(t, filepath.Join(r.Proc, "20", "cmdline"), "pgrep\x00-f\x00^/bin/bash /usr/bin/ugreen-leds\x00")
	write(t, filepath.Join(r.Proc, "21", "cmdline"), "grep\x00-r\x00ugreen-leds\x00/etc\x00")
	write(t, filepath.Join(r.Proc, "22", "cmdline"), "/usr/local/emhttp/plugins/ugreen-nas-control/backend/ugreen-nas\x00led-ctl\x00daemon\x00run\x00")
	write(t, filepath.Join(r.Proc, "23", "cmdline"), "/bin/bash\x00-x\x00/usr/bin/ugreen-leds\x00")
	got := r.Detect()
	if want := []string{"daemon:ugreen-leds"}; !reflect.DeepEqual(ids(got), want) {
		t.Fatalf("got %v want %v", ids(got), want)
	}
}

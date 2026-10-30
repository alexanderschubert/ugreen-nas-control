package fan

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/alexanderschubert/ugreen-nas-control/internal/hw"
	cs "github.com/alexanderschubert/ugreen-nas-control/internal/hw/cs201x"
)

// The fan tool, the LED backend (cs201x) and the front panel must lock the same file, with and without the env var.
func TestLockPathSameAsOtherUsers(t *testing.T) {
	old := lockPath
	lockPath = ""
	t.Cleanup(func() { lockPath = old })
	for _, env := range []string{"", filepath.Join(t.TempDir(), "env.lock")} {
		t.Setenv(hw.LockEnv, env)
		if cs.LockPath() != hw.LockPath() {
			t.Errorf("env %q: cs201x %q, hw %q", env, cs.LockPath(), hw.LockPath())
		}
		if env == "" {
			if hw.LockPath() != hw.DefaultLockPath {
				t.Errorf("default %q", hw.LockPath())
			}
			continue
		}
		if err := withLock(func() error { return nil }); err != nil {
			t.Fatal(err)
		}
		if _, err := os.Stat(env); err != nil {
			t.Errorf("fan lock not at %q: %v", env, err)
		}
	}
}

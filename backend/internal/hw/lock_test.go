package hw

import (
	"path/filepath"
	"testing"
)

func TestLockPathResolution(t *testing.T) {
	t.Setenv(LockEnv, "")
	if got := LockPath(); got != DefaultLockPath {
		t.Errorf("default: %q", got)
	}
	t.Setenv(LockEnv, "/tmp/x.lock")
	if got := LockPath(); got != "/tmp/x.lock" {
		t.Errorf("env: %q", got)
	}
	restore := SetLockPath("/tmp/y.lock")
	if got := LockPath(); got != "/tmp/y.lock" {
		t.Errorf("override: %q", got)
	}
	restore()
	if got := LockPath(); got != "/tmp/x.lock" {
		t.Errorf("restored: %q", got)
	}
}

func TestWithLockAtRunsAndReleases(t *testing.T) {
	path := filepath.Join(t.TempDir(), "lock")
	for range 2 { // a second acquisition proves the first released
		ran := false
		if err := WithLockAt(path, func() error { ran = true; return nil }); err != nil || !ran {
			t.Fatalf("ran %v err %v", ran, err)
		}
	}
	if err := WithLockAt(filepath.Join(t.TempDir(), "no", "dir", "lock"), func() error { return nil }); err == nil {
		t.Error("unopenable lock file must fail")
	}
}

package hw

import (
	"errors"
	"syscall"
	"time"

	"github.com/ugreen-nas-control/ugreen-nas-control/internal/fsx"
	"github.com/ugreen-nas-control/ugreen-nas-control/internal/testenv"
)

// The one flock every user of the shared index/data port pairs takes: the fan tool and daemon, the LED backend (via
// hw/cs201x) and the front panel's EC beeper. Without it two processes can interleave their address latches and
// one writes into the register the other meant.
const (
	// LockEnv is the single override of the lock path, honoured in testhooks builds only (testenv), like every other path override; release builds always use DefaultLockPath.
	LockEnv = "UGREEN_FAN_LOCK"
	// DefaultLockPath is the lock file when LockEnv is empty.
	DefaultLockPath = "/var/run/ugreen-nas-control.lock"
)

var lockOverride string

// SetLockPath points the lock at another file (tests); the returned func puts the old one back.
func SetLockPath(path string) (restore func()) {
	old := lockOverride
	lockOverride = path
	return func() { lockOverride = old }
}

// LockPath resolves the lock file: SetLockPath, then LockEnv, then DefaultLockPath.
func LockPath() string {
	if lockOverride != "" {
		return lockOverride
	}
	if v := testenv.Get(LockEnv); v != "" {
		return v
	}
	return DefaultLockPath
}

// WithLock runs fn while holding the exclusive lock at LockPath, waiting at most LockTimeout for it (ErrLockTimeout
// after that). Never nest it: a second flock on the same file, even from the same process, never succeeds.
func WithLock(fn func() error) error { return WithLockAt(LockPath(), fn) }

// WithLockAt is WithLock for an explicit path.
func WithLockAt(path string, fn func() error) error {
	f, err := fsx.OpenLock(path, 0o644)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()
	if err := FlockExclusive(int(f.Fd())); err != nil {
		return err
	}
	defer func() { _ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN) }()
	return fn()
}

// LockTimeout bounds every wait for the lock: well above any holder (a register burst of milliseconds, an EC
// access that gives up after its own budget), well below the watchdog feed gap (docs/watchdog.md). A variable for tests.
var LockTimeout = 5 * time.Second

const lockPoll = 10 * time.Millisecond

// ErrLockTimeout: another process held the lock for LockTimeout. Nothing was written; callers retry on the next tick.
var ErrLockTimeout = errors.New("timed out waiting for the hardware lock")

// FlockExclusive takes an exclusive flock on fd, polling without blocking until LockTimeout has passed.
func FlockExclusive(fd int) error {
	deadline := time.Now().Add(LockTimeout)
	for {
		err := syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB)
		switch {
		case err == nil:
			return nil
		case errors.Is(err, syscall.EINTR):
			continue
		case !errors.Is(err, syscall.EWOULDBLOCK):
			return err
		case !time.Now().Before(deadline):
			return ErrLockTimeout
		}
		time.Sleep(lockPoll)
	}
}

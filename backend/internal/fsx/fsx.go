// Package fsx writes the plugin's state files safely: a file is written to a temporary name in the same folder
// and renamed over the target, and nothing is created through a symbolic link. A crash never leaves half a file, and
// a link planted at a predictable name in /var/run or /boot/config cannot redirect a root write.
package fsx

import (
	"os"
	"path/filepath"
	"strconv"
	"syscall"
)

// WriteFile replaces path with data (like os.WriteFile, but atomic). A symbolic link at path is replaced, not followed.
func WriteFile(path string, data []byte, perm os.FileMode) error {
	tmp := filepath.Join(filepath.Dir(path), "."+filepath.Base(path)+".tmp"+strconv.Itoa(os.Getpid()))
	_ = os.Remove(tmp)
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, perm)
	if err != nil {
		return err
	}
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

// OpenTrunc opens path for writing, emptied (a log that is rewritten); it fails on a symbolic link.
func OpenTrunc(path string) (*os.File, error) {
	return os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, 0o644)
}

// OpenAppend opens path for appending; it fails on a symbolic link.
func OpenAppend(path string) (*os.File, error) {
	return os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND|syscall.O_NOFOLLOW, 0o644)
}

// OpenLock opens a lock file (flock); it fails on a symbolic link.
func OpenLock(path string, perm os.FileMode) (*os.File, error) {
	return os.OpenFile(path, os.O_RDWR|os.O_CREATE|syscall.O_NOFOLLOW, perm)
}

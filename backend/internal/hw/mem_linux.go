//go:build linux

package hw

import (
	"fmt"
	"os"
	"syscall"
)

type devMem struct{ f *os.File }

// OpenMem opens /dev/mem for reading and writing. Needs root; a kernel with STRICT_DEVMEM may refuse ranges a driver
// has claimed.
func OpenMem() (Mem, error) {
	f, err := os.OpenFile("/dev/mem", os.O_RDWR|syscall.O_SYNC, 0)
	if err != nil {
		return nil, err
	}
	return &devMem{f: f}, nil
}

func (m *devMem) Read(addr uint64, n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := m.f.ReadAt(b, int64(addr)); err != nil { //nolint:gosec // physical addresses are far below 2^63
		return nil, fmt.Errorf("read 0x%X: %w", addr, err)
	}
	return b, nil
}

func (m *devMem) Write(addr uint64, b []byte) error {
	if _, err := m.f.WriteAt(b, int64(addr)); err != nil { //nolint:gosec // as above
		return fmt.Errorf("write 0x%X: %w", addr, err)
	}
	return nil
}

func (m *devMem) Close() error { return m.f.Close() }

//go:build !linux

package main

import "errors"

// Only Linux has /dev/i2c-*; this lets the protocol tests run anywhere.

var errNotLinux = errors.New("I2C access is only supported on Linux")

type bus struct{ path string }

func openBus(string, bool) (*bus, error) {
	return nil, errNotLinux
}

func openBusAt(string, uintptr, bool) (*bus, error) {
	return nil, errNotLinux
}

func (b *bus) close() {}

func (b *bus) writeByteData(byte, byte) error {
	return errNotLinux
}

func scanBuses(string, bool) ([]string, error) {
	return nil, errNotLinux
}

func scanBus(string) (found, busy []string, err error) {
	return nil, nil, errNotLinux
}

func (b *bus) change(byte, byte, [4]byte) error {
	return errNotLinux
}

func (b *bus) status(string) (ledStatus, error) {
	return ledStatus{}, errNotLinux
}

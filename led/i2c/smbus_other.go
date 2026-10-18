//go:build !linux

package main

import "errors"

// Only Linux has /dev/i2c-*; this lets the protocol tests run anywhere.

type bus struct{ path string }

func openBus(string, bool) (*bus, error) {
	return nil, errors.New("I2C access is only supported on Linux")
}

func openBusAt(string, uintptr, bool) (*bus, error) {
	return nil, errors.New("I2C access is only supported on Linux")
}

func (b *bus) close() {}

func (b *bus) writeByteData(byte, byte) error {
	return errors.New("I2C access is only supported on Linux")
}

func scanBuses(string, bool) ([]string, error) {
	return nil, errors.New("I2C access is only supported on Linux")
}

func scanBus(string) (found, busy []string, err error) {
	return nil, nil, errors.New("I2C access is only supported on Linux")
}

func (b *bus) change(byte, byte, [4]byte) error {
	return errors.New("I2C access is only supported on Linux")
}

func (b *bus) status(string) (ledStatus, error) {
	return ledStatus{}, errors.New("I2C access is only supported on Linux")
}

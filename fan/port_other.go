//go:build !linux

package main

import "errors"

func openPorts() (Ports, error) {
	return nil, errors.New("I/O ports are only available on Linux")
}

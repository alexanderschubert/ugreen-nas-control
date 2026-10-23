package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestModelSupported(t *testing.T) {
	for model, want := range map[string]bool{
		"DXP6800 Pro":  true,
		"DXP6800 Plus": true,
		"DXP4800 Plus": false,
		"DXP4800 GT":   true,
		"DXP8800 Plus": false,
		"DX4600 Pro":   false,
		"":             false,
	} {
		if got := ModelSupported(model); got != want {
			t.Errorf("%q: got %v, want %v", model, got, want)
		}
	}
}

func TestRequireSupportedModel(t *testing.T) {
	old := dmiDir
	defer func() { dmiDir = old }()
	dmiDir = t.TempDir()

	if err := requireSupportedModel(); err == nil {
		t.Fatal("no DMI data: expected an error")
	}

	name := filepath.Join(dmiDir, "product_name")
	for model, ok := range map[string]bool{"DXP6800 Pro\n": true, "DXP4800 GT\n": true, "DXP4800 Pro\n": false} {
		if err := os.WriteFile(name, []byte(model), 0o644); err != nil {
			t.Fatal(err)
		}
		if err := requireSupportedModel(); (err == nil) != ok {
			t.Errorf("%q: err %v, want ok=%v", model, err, ok)
		}
	}
}

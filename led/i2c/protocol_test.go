package main

import (
	"bytes"
	"reflect"
	"testing"
)

func TestCommandPacketMatchesKernelDriver(t *testing.T) {
	// led-ugreen.c: cksum = 0xa1 + command + param1..param4, buf = {id, a0 01 00 00, cmd, p1..p4, hi, lo}
	got := commandPacket(4, cmdColor, [4]byte{255, 128, 0, 0})
	sum := 0xa1 + cmdColor + 255 + 128
	want := []byte{4, 0xa0, 0x01, 0x00, 0x00, cmdColor, 255, 128, 0, 0, byte(sum >> 8), byte(sum)}

	if !bytes.Equal(got, want) {
		t.Fatalf("packet = % x, want % x", got, want)
	}
}

func TestGTCommandPacketMatchesKernelDriver(t *testing.T) {
	// led-ugreen.c (chip 0xc5b2): no ID, cksum = 0xa1 + 0x02 + 255 + 128 = 0x0222, low byte first.
	got := gtCommandPacket(cmdColor, [4]byte{255, 128, 0, 0})
	want := []byte{0xa0, 0x01, 0x00, 0x00, 0x02, 0xff, 0x80, 0x00, 0x00, 0x22, 0x02}

	if !bytes.Equal(got, want) {
		t.Fatalf("packet = % x, want % x", got, want)
	}
}

func TestPeriodParams(t *testing.T) {
	// cycle 2100 = 0x0834, on 1200 = 0x04b0
	if got, want := periodParams(1200, 900), [4]byte{0x08, 0x34, 0x04, 0xb0}; got != want {
		t.Fatalf("periodParams = % x, want % x", got, want)
	}

	// Clamped to 100..0x7fff like the kernel driver.
	const cycle = 100 + 0x7fff
	if got, want := periodParams(10, 99999), [4]byte{cycle >> 8, cycle & 0xff, 0, 100}; got != want {
		t.Fatalf("clamped periodParams = % x, want % x", got, want)
	}
}

func statusBlock(mode, brightness, r, g, b byte, cycle, on int) []byte {
	block := []byte{mode, brightness, r, g, b, byte(cycle >> 8), byte(cycle), byte(on >> 8), byte(on)}
	sum := 0
	for _, v := range block {
		sum += int(v)
	}
	return append(block, byte(sum>>8), byte(sum))
}

func TestParseStatus(t *testing.T) {
	got, err := parseStatus("disk2", statusBlock(3, 43, 255, 38, 0, 2100, 1200))
	if err != nil {
		t.Fatal(err)
	}

	want := ledStatus{Name: "disk2", Mode: "breath", Brightness: 43, Color: "255 38 0", OnMs: 1200, OffMs: 900}
	if got != want {
		t.Fatalf("status = %+v, want %+v", got, want)
	}
}

func TestPlainLine(t *testing.T) {
	s := ledStatus{Name: "disk2", Mode: "breath", Brightness: 43, Color: "255 38 0", OnMs: 1200, OffMs: 900}
	if got, want := plainLine(s), "disk2 breath 43 255 38 0 1200 900"; got != want {
		t.Fatalf("plainLine = %q, want %q", got, want)
	}
}

func TestParseStatusRejectsBadBlocks(t *testing.T) {
	good := statusBlock(1, 255, 1, 2, 3, 0, 0)

	broken := append([]byte(nil), good...)
	broken[10] ^= 0xff

	badMode := statusBlock(7, 255, 1, 2, 3, 0, 0)

	for name, block := range map[string][]byte{
		"short":    good[:10],
		"checksum": broken,
		"all zero": make([]byte, statusLength),
		"bad mode": badMode,
	} {
		if _, err := parseStatus("power", block); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestParseLeds(t *testing.T) {
	got, err := parseLeds("power,disk3")
	if err != nil || !reflect.DeepEqual(got, []string{"power", "disk3"}) {
		t.Fatalf("parseLeds = %v, %v", got, err)
	}

	if all, _ := parseLeds("all"); len(all) != 10 {
		t.Fatalf("all = %v", all)
	}

	if _, err := parseLeds("disk9"); err == nil {
		t.Fatal("disk9 should be rejected")
	}
}

func TestBuildCommand(t *testing.T) {
	cases := []struct {
		args    []string
		command byte
		params  [4]byte
	}{
		{[]string{"color", "0", "52", "243"}, cmdColor, [4]byte{0, 52, 243, 0}},
		{[]string{"brightness", "43"}, cmdBrightness, [4]byte{43}},
		{[]string{"on"}, cmdOnOff, [4]byte{1}},
		{[]string{"off"}, cmdOnOff, [4]byte{0}},
		{[]string{"blink", "450", "450"}, cmdBlink, periodParams(450, 450)},
		{[]string{"breath", "1200", "900"}, cmdBreath, periodParams(1200, 900)},
	}

	for _, c := range cases {
		command, params, err := buildCommand(c.args)
		if err != nil || command != c.command || params != c.params {
			t.Errorf("%v: got %x % x %v, want %x % x", c.args, command, params, err, c.command, c.params)
		}
	}

	for _, bad := range [][]string{{}, {"color", "1", "2"}, {"brightness", "256"}, {"blink", "-1", "2"}, {"dance"}} {
		if _, _, err := buildCommand(bad); err == nil {
			t.Errorf("%v: expected an error", bad)
		}
	}
}

func TestDXP480TWhite(t *testing.T) {
	// Same writes as `i2cset -y <bus> 0x26 <register> <value> b` in ich777's driver.
	want := [][2]byte{{0xa0, 1}, {0xa0, 2}, {0xb1, 2}, {0x51, 0}, {0x50, 0}}

	if dxp480tAddr != 0x26 || len(dxp480tWhite) != len(want) {
		t.Fatalf("got address 0x%x and %d writes", dxp480tAddr, len(dxp480tWhite))
	}
	for i := range want {
		if dxp480tWhite[i] != want[i] {
			t.Errorf("write %d: got %x, want %x", i, dxp480tWhite[i], want[i])
		}
	}
}

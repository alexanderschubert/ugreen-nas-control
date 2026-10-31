package fsx

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteFileIsAtomicAndLeavesNoTemp(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "state")
	for _, text := range []string{"one\n", "two\n"} {
		if err := WriteFile(p, []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
		if got, _ := os.ReadFile(p); string(got) != text {
			t.Fatalf("got %q", got)
		}
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Errorf("leftovers: %v", entries)
	}
}

func TestWriteFileReplacesASymlinkInsteadOfFollowingIt(t *testing.T) {
	dir := t.TempDir()
	victim := filepath.Join(dir, "victim")
	if err := os.WriteFile(victim, []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(dir, "state")
	if err := os.Symlink(victim, p); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(p, []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(victim); string(got) != "keep" {
		t.Errorf("the link target was written: %q", got)
	}
	if st, _ := os.Lstat(p); st.Mode()&os.ModeSymlink != 0 {
		t.Error("state is still a link")
	}
}

func TestWriteFileRefusesAPlantedTempLink(t *testing.T) {
	dir := t.TempDir()
	victim := filepath.Join(dir, "victim")
	_ = os.WriteFile(victim, []byte("keep"), 0o644)
	// The temp name is predictable from the pid; it is removed first and then created with O_EXCL|O_NOFOLLOW.
	tmp := filepath.Join(dir, ".state.tmp"+itoa(os.Getpid()))
	_ = os.Symlink(victim, tmp)
	if err := WriteFile(filepath.Join(dir, "state"), []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(victim); string(got) != "keep" {
		t.Errorf("the link target was written: %q", got)
	}
}

func TestOpenersRefuseLinks(t *testing.T) {
	dir := t.TempDir()
	target := filepath.Join(dir, "t")
	_ = os.WriteFile(target, nil, 0o644)
	link := filepath.Join(dir, "l")
	_ = os.Symlink(target, link)
	if f, err := OpenTrunc(link); err == nil {
		_ = f.Close()
		t.Error("OpenTrunc followed a link")
	}
	if f, err := OpenAppend(link); err == nil {
		_ = f.Close()
		t.Error("OpenAppend followed a link")
	}
	if f, err := OpenLock(link, 0o644); err == nil {
		_ = f.Close()
		t.Error("OpenLock followed a link")
	}
}

func itoa(n int) string { return intString(n) }

func intString(n int) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for ; n > 0; n /= 10 {
		b = append([]byte{byte('0' + n%10)}, b...)
	}
	return string(b)
}

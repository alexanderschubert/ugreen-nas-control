package hw

// Mem is physical memory through /dev/mem, byte-addressed. Only the power-on-after-AC-loss command opens it, and only
// on the models whose setting is a memory-mapped register.
type Mem interface {
	Read(addr uint64, n int) ([]byte, error)
	Write(addr uint64, b []byte) error
	Close() error
}

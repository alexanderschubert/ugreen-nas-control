# Make everything outside the icon's rounded square transparent (rx = 14/64 of the size),
# with anti-aliased edges. Pure Python: decode RGBA PNG, rewrite alpha, encode again.
import struct, sys, zlib

def decode(path):
    data = open(path, 'rb').read()
    pos, idat = 8, b''
    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        if kind == b'IHDR':
            width, height, depth, ctype = struct.unpack('>IIBB', body[:10])
            assert depth == 8 and ctype == 6, 'expects 8-bit RGBA'
        elif kind == b'IDAT':
            idat += body
        pos += 12 + length
    raw, stride, rows, prev = zlib.decompress(idat), width * 4, [], bytearray(width * 4)
    for y in range(height):
        f, line = raw[y * (stride + 1)], bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - 4] if i >= 4 else 0
            b = prev[i]
            c = prev[i - 4] if i >= 4 else 0
            if f == 1: line[i] = (line[i] + a) & 255
            elif f == 2: line[i] = (line[i] + b) & 255
            elif f == 3: line[i] = (line[i] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    return width, height, rows

def encode(path, width, height, rows):
    def chunk(kind, body):
        return struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)

def coverage(x, y, size, radius, samples=4):
    inside = 0
    for sy in range(samples):
        for sx in range(samples):
            px, py = x + (sx + .5) / samples, y + (sy + .5) / samples
            cx = min(max(px, radius), size - radius)
            cy = min(max(py, radius), size - radius)
            inside += (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
    return inside / samples ** 2

BG = (0x1b, 0x22, 0x2b)
for path in sys.argv[1:]:
    width, height, rows = decode(path)
    radius = width * 14 / 64
    for y in range(height):
        for x in range(width):
            cov = coverage(x, y, width, radius)
            if cov < 1:
                i = x * 4
                rows[y][i:i + 4] = bytes((*BG, round(255 * cov)))
    encode(path, width, height, rows)
    print(path, 'corner alpha', rows[0][3], 'centre', list(rows[height // 2][width * 2:width * 2 + 4]))

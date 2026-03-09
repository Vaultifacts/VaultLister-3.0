"""Generate PNG icons for VaultLister Chrome extension — no external deps."""
import struct, zlib, os

def make_png(size, r, g, b):
    """Create a minimal valid PNG with a solid colour fill."""
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)
    ihdr = chunk(b'IHDR', ihdr_data)

    raw_rows = b''.join(b'\x00' + bytes([r, g, b] * size) for _ in range(size))
    idat = chunk(b'IDAT', zlib.compress(raw_rows))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend

# Purple gradient brand colour from generate-icons.html: #6366f1
R, G, B = 0x63, 0x66, 0xf1

icons_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                         'chrome-extension', 'icons')
os.makedirs(icons_dir, exist_ok=True)

for size in (16, 48, 128):
    path = os.path.join(icons_dir, f'icon{size}.png')
    with open(path, 'wb') as f:
        f.write(make_png(size, R, G, B))
    print(f'Written {path}  ({size}x{size})')

print('Done.')

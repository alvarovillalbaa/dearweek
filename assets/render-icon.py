"""Render Welyto's original geometric mark without external packages.

Run from this directory or the repository root. SVG is the editable source;
these matching raster targets are for Expo's native and web icon settings.
"""

from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parent
PAPER = (245, 240, 230)
OLIVE = (64, 84, 71)
CLAY = (189, 107, 77)
STROKES = [((220, 350), (358, 704)), ((358, 704), (512, 424)),
           ((512, 424), (666, 704)), ((666, 704), (804, 350))]


def segment_distance(x, y, start, end):
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    fraction = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - ax - fraction * dx, y - ay - fraction * dy)


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)


def render(filename, size, transparent=False, scale=1.0):
    # Approximate the small quadratic accent with short round-capped segments.
    accent = []
    for index in range(25):
        t = index / 24
        accent.append(((1-t)**2 * 364 + 2*(1-t)*t*512 + t*t*660,
                       (1-t)**2 * 814 + 2*(1-t)*t*866 + t*t*814))
    accent_segments = list(zip(accent, accent[1:]))
    rows = bytearray()
    width = 1024 / (size * scale)
    feather = width * .8
    for py in range(size):
        rows.append(0)
        y = (py + .5 - size/2) * width + 512
        for px in range(size):
            x = (px + .5 - size/2) * width + 512
            color = PAPER
            alpha = 0 if transparent else 255
            layers = []
            if 680 < x < 815 and 205 < y < 345:
                layers.append((CLAY, 62 - math.hypot(x-748, y-276)))
            if 174 < x < 850 and 304 < y < 750:
                distance = min(segment_distance(x, y, a, b) for a, b in STROKES)
                layers.append((OLIVE, 38 - distance))
            if 345 < x < 680 and 792 < y < 858:
                distance = min(segment_distance(x, y, a, b) for a, b in accent_segments)
                layers.append((CLAY, 14 - distance))
            for paint, inside in layers:
                coverage = max(0.0, min(1.0, .5 + inside / feather))
                if coverage == 0:
                    continue
                if transparent:
                    color = paint
                    alpha = max(alpha, round(coverage * 255))
                else:
                    color = tuple(round(old * (1-coverage) + new * coverage) for old, new in zip(color, paint))
            rows.extend((*color, alpha) if transparent else color)
    header = struct.pack('!IIBBBBB', size, size, 8, 6 if transparent else 2, 0, 0, 0)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    (ROOT / filename).write_bytes(data)
    print(f'{filename}: {size}x{size}, {len(data)} bytes')


if __name__ == '__main__':
    render('icon.png', 1024)
    render('adaptive-icon.png', 1024, transparent=True, scale=.8)
    render('splash-icon.png', 512, transparent=True, scale=.8)
    render('favicon.png', 64)

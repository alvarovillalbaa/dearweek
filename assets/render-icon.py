"""Render Dearweek's D and leaf mark without external packages.

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


def d_distance(x, y, left, radius):
    """Signed distance to the SVG's left rectangle and right semicircle."""
    if x >= 482:
        return radius - math.hypot(x - 482, y - 512)
    horizontal = x - left
    vertical = radius - abs(y - 512)
    if horizontal < 0 and vertical < 0:
        return -math.hypot(horizontal, vertical)
    return min(horizontal, vertical)


def cubic_points(start, first, second, end):
    points = []
    for index in range(1, 25):
        t = index / 24
        points.append(tuple((1-t)**3 * start[axis] + 3*(1-t)**2*t * first[axis]
                            + 3*(1-t)*t*t * second[axis] + t**3 * end[axis]
                            for axis in (0, 1)))
    return points


def inside_polygon(x, y, edges):
    inside = False
    for (ax, ay), (bx, by) in edges:
        if (ay > y) != (by > y) and x < (bx-ax) * (y-ay) / (by-ay) + ax:
            inside = not inside
    return inside


def segment_distance(x, y, start, end):
    ax, ay = start
    bx, by = end
    dx, dy = bx - ax, by - ay
    fraction = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - ax - fraction * dx, y - ay - fraction * dy)


def chunk(kind, data):
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)


def render(filename, size, transparent=False, scale=1.0):
    # These two cubic curves match the editable leaf path in icon.svg.
    leaf = [(434, 608)] + cubic_points((434, 608), (410, 498), (488, 420), (610, 410))
    leaf += cubic_points((610, 410), (632, 520), (560, 602), (434, 608))
    leaf_edges = list(zip(leaf, leaf[1:]))
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
            layers = [(OLIVE, min(d_distance(x, y, 276, 262), -d_distance(x, y, 364, 174)))]
            if 400 < x < 650 and 390 < y < 630:
                distance = min(segment_distance(x, y, a, b) for a, b in leaf_edges)
                layers.append((CLAY, distance if inside_polygon(x, y, leaf_edges) else -distance))
            if 438 < x < 602 and 420 < y < 600:
                layers.append((PAPER, 7 - segment_distance(x, y, (452, 586), (588, 434))))
            for paint, inside in layers:
                coverage = max(0.0, min(1.0, .5 + inside / feather))
                if coverage == 0:
                    continue
                if transparent:
                    previous = alpha / 255
                    combined = coverage + previous * (1-coverage)
                    color = tuple(round((new * coverage + old * previous * (1-coverage)) / combined)
                                  for old, new in zip(color, paint))
                    alpha = round(combined * 255)
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

"""Rasterize a WeerSport mark for the PWA icons. No prior PNG icons existed."""

import struct
import zlib
from pathlib import Path

LIME = (214, 250, 99, 255)
INK = (11, 37, 48, 255)
ROOT = Path(__file__).resolve().parents[1]


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int, paint) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(paint(x, y, size))
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def inside_round_rect(x: float, y: float, size: float, radius: float) -> bool:
    inset = radius
    if inset <= x <= size - inset or inset <= y <= size - inset:
        return 0 <= x < size and 0 <= y < size
    for cx, cy in (
        (inset, inset),
        (size - inset, inset),
        (inset, size - inset),
        (size - inset, size - inset),
    ):
        if (x - cx) ** 2 + (y - cy) ** 2 <= radius**2:
            return True
    return False


def point_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    if length == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    return ((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2) ** 0.5


def paint(x: int, y: int, size: int):
    if not inside_round_rect(x + 0.5, y + 0.5, size, size * 0.22):
        return (0, 0, 0, 0)
    points = (
        (0.16, 0.40),
        (0.32, 0.68),
        (0.48, 0.40),
        (0.64, 0.68),
        (0.84, 0.34),
    )
    stroke = size * 0.075
    for start, end in zip(points, points[1:]):
        distance = point_segment_distance(
            (x + 0.5) / size,
            (y + 0.5) / size,
            start[0],
            start[1],
            end[0],
            end[1],
        )
        if distance * size <= stroke / 2:
            return INK
    sun = (0.76 * size, 0.22 * size)
    if (x - sun[0]) ** 2 + (y - sun[1]) ** 2 <= (size * 0.045) ** 2:
        return INK
    return LIME


def main() -> None:
    target = ROOT / "public" / "icons"
    target.mkdir(parents=True, exist_ok=True)
    for name, size in (("pwa-192.png", 192), ("pwa-512.png", 512), ("apple-touch-icon.png", 180)):
        write_png(target / name, size, paint)
        print(target / name, size)


if __name__ == "__main__":
    main()

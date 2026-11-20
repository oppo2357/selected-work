"""Sample GSI DEM10B at an even metre spacing on a small local tangent plane."""
import io
import math
import struct
import urllib.request
from functools import cache
from pathlib import Path

from PIL import Image

CENTER = (34.29672, 132.31906)
STEP, COLS, ROWS = 8, 113, 111
ZOOM = 14


@cache
def tile(x, y):
    url = f"https://cyberjapandata.gsi.go.jp/xyz/dem_png/{ZOOM}/{x}/{y}.png"
    with urllib.request.urlopen(url, timeout=20) as response:
        return Image.open(io.BytesIO(response.read())).convert("RGB")


def sample(east, south):
    lat = CENTER[0] - south / 110930
    lon = CENTER[1] + east / (111320 * math.cos(math.radians(CENTER[0])))
    scale = (2 ** ZOOM) * 256
    px = int(scale * (lon + 180) / 360)
    py = int(scale * (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2)
    red, green, blue = tile(px // 256, py // 256).getpixel((px % 256, py % 256))
    raw = red * 65536 + green * 256 + blue
    if raw == 1 << 23:
        return -32768
    cm = raw - (1 << 24) if raw > (1 << 23) else raw
    return round(cm / 10)


if __name__ == "__main__":
    grid = [sample((x - (COLS - 1) / 2) * STEP, (z - (ROWS - 1) / 2) * STEP)
            for z in range(ROWS) for x in range(COLS)]
    Path(__file__).with_name("elevation.bin").write_bytes(struct.pack(f"<{len(grid)}h", *grid))
    print(f"{COLS} by {ROWS}, {grid.count(-32768)} missing, max {max(grid)/10} m")

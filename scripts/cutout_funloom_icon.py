"""抠掉 funloom_icon 白底，保留小蜘蛛（含眼睛白点）。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / "public" / "data" / "assets" / "funloom_icon.png"
PUBLIC = ROOT / "public" / "funloom_icon.png"
ORIG = ROOT / "public" / "data" / "assets" / "funloom_icon.orig.png"
HI = ROOT / "public" / "data" / "assets" / "funloom_icon@2x.png"


def is_bg(c: tuple[int, int, int, int]) -> bool:
    r, g, b, _a = c
    avg = (r + g + b) / 3
    return avg >= 235 and abs(r - g) < 18 and abs(g - b) < 18 and abs(r - b) < 18


def cutout(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    assert px is not None

    stack: list[tuple[int, int]] = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    seen: set[tuple[int, int]] = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        c = px[x, y]
        if not is_bg(c):
            continue
        px[x, y] = (255, 255, 255, 0)
        stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    # 去掉贴着透明边的浅色锯齿，不碰蜘蛛内部白眼
    changed = True
    while changed:
        changed = False
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or (r + g + b) / 3 < 240:
                    continue
                if abs(r - g) >= 25 or abs(g - b) >= 25:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                        px[x, y] = (255, 255, 255, 0)
                        changed = True
                        break
    return im


def main() -> None:
    src = ORIG if ORIG.exists() else ASSET
    if not ORIG.exists():
        ORIG.write_bytes(Path(src).read_bytes())
    im = cutout(src)
    for p in (ASSET, PUBLIC):
        im.save(p, "PNG")
    im.resize((80, 80), Image.Resampling.LANCZOS).save(HI, "PNG")
    data = list(im.getdata())
    trans = sum(1 for p in data if p[3] == 0)
    opaque = sum(1 for p in data if p[3] == 255)
    print(f"ok trans={trans} opaque={opaque} -> {ASSET}")


if __name__ == "__main__":
    main()

"""Contrast of the eight figure hues against --plate in both themes (needs 3:1). Run: python evals/contrast.py"""
import re
from pathlib import Path

css = (Path(__file__).resolve().parent.parent / "core/engine/assets/cognia.css").read_text(encoding="utf-8")


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


light = css.split(":root {", 1)[1].split("}", 1)[0]
dark = css.split(':root[data-theme="dark"] {', 1)[1].split("}", 1)[0]
bad = 0
for name, block in (("light", light), ("dark", dark)):
    plate = re.search(r"--plate:\s*(#[0-9a-f]{6})", block).group(1)
    for k, v in re.findall(r"--c-([a-z]+):\s*(#[0-9a-f]{6})", block):
        r = ratio(v, plate)
        bad += r < 3
        print(f"{name:5} {k:6} {v} {r:4.2f}" + ("  FAIL" if r < 3 else ""))
print("all hues reach 3:1" if not bad else f"{bad} hue(s) below 3:1")
raise SystemExit(1 if bad else 0)

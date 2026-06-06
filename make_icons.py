"""Generate OpenTuner PWA/favicon PNGs (tuning-fork glyph on a dark rounded square)."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
os.makedirs(OUT, exist_ok=True)

BG = (18, 22, 29, 255)        # #12161d
ACCENT = (78, 161, 255, 255)  # #4ea1ff
S = 1024  # supersample, then downscale


def draw_icon(size, maskable=False):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)

    scale = 0.60 if maskable else 0.72  # keep content in maskable safe zone
    cx = S // 2
    fork_h = int(S * scale)
    top = (S - fork_h) // 2
    prong_w = int(S * 0.10)
    gap = int(S * 0.16)
    prong_bottom = top + int(fork_h * 0.52)
    left_x = cx - gap // 2 - prong_w
    right_x = cx + gap // 2

    # prongs
    d.rounded_rectangle([left_x, top, left_x + prong_w, prong_bottom],
                        radius=prong_w // 2, fill=ACCENT)
    d.rounded_rectangle([right_x, top, right_x + prong_w, prong_bottom],
                        radius=prong_w // 2, fill=ACCENT)
    # base bar joining the prongs
    d.rounded_rectangle([left_x, prong_bottom - prong_w, right_x + prong_w, prong_bottom],
                        radius=prong_w // 2, fill=ACCENT)
    # stem
    stem_w = int(S * 0.11)
    stem_bottom = top + fork_h
    d.rounded_rectangle([cx - stem_w // 2, prong_bottom - prong_w // 2, cx + stem_w // 2, stem_bottom],
                        radius=stem_w // 2, fill=ACCENT)
    # foot
    r = int(S * 0.085)
    d.ellipse([cx - r, stem_bottom - r, cx + r, stem_bottom + r], fill=ACCENT)

    return img.resize((size, size), Image.LANCZOS)


targets = [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, False),
    ("favicon-32.png", 32, False),
]
for name, sz, mask in targets:
    draw_icon(sz, mask).save(os.path.join(OUT, name))
    print("wrote", name)

print("done ->", OUT)

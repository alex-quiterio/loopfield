#!/usr/bin/env python3
"""Draws the loopfield logo and the album covers as SVG.

Everything is generated from code with fixed random seeds, so running this
again produces exactly the same art. Run: python3 art/make_art.py
"""
import math
import pathlib
import random

OUT = pathlib.Path(__file__).parent
TAU = math.pi * 2

SERIF = "'Instrument Serif', 'Iowan Old Style', Georgia, serif"
CAPS = "Cinzel, 'Trajan Pro', 'Iowan Old Style', Georgia, serif"
MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace"
SANS = "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif"


def n(x):
    return f"{x:.1f}".rstrip("0").rstrip(".")


def path(points, close=True):
    d = "M" + " L".join(f"{n(x)} {n(y)}" for x, y in points)
    return d + (" Z" if close else "")


def lobed_ring(cx, cy, r, amp, lobes, phase=0.0, steps=360):
    """A circle whose radius swells `lobes` times: one loop of a cycle."""
    pts = []
    for i in range(steps):
        t = TAU * i / steps
        rr = r + amp * math.sin(lobes * t + phase)
        pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
    return path(pts)


def svg(w, h, body, defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def glow(id_, blur):
    return (
        f'<filter id="{id_}" x="-50%" y="-50%" width="200%" height="200%">'
        f'<feGaussianBlur stdDeviation="{blur}" result="b"/>'
        f'<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
    )


# --- logo ---------------------------------------------------------------------
# Three loops of 3, 5 and 7 lobes: cycles that never quite line up, the way the
# voices in "One Honest Node" do, around one shared centre.
RINGS = [(3, 0.355, "#f2c66d", 0.3), (5, 0.265, "#8fa8ff", 1.1), (7, 0.175, "#ffd9c2", 2.0)]


def mark(x, y, size, background=True):
    c = size / 2
    out = [f'<g transform="translate({n(x)} {n(y)})">']
    if background:
        out.append(f'<rect width="{n(size)}" height="{n(size)}" rx="{n(size * 0.22)}" fill="#070611"/>')
    out.append('<g filter="url(#glow)" fill="none" stroke-linejoin="round">')
    for lobes, r, color, phase in RINGS:
        out.append(
            f'<path d="{lobed_ring(c, c, size * r, size * 0.028, lobes, phase)}" '
            f'stroke="{color}" stroke-width="{n(size * 0.024)}"/>'
        )
    out.append("</g>")
    out.append(f'<circle cx="{n(c)}" cy="{n(c)}" r="{n(size * 0.035)}" fill="#f2c66d"/>')
    out.append("</g>")
    return "\n".join(out)


def logo():
    (OUT / "logo.svg").write_text(svg(512, 512, mark(0, 0, 512), glow("glow", 6)))
    body = "\n".join([
        '<rect width="1200" height="360" rx="48" fill="#070611"/>',
        mark(40, 40, 280, background=False),
        f'<text x="360" y="200" font-family="{MONO}" font-size="112" font-weight="700" '
        f'letter-spacing="2" fill="#ece8f6">loopfield</text>',
        f'<text x="364" y="262" font-family="{SANS}" font-size="30" letter-spacing="7" '
        f'fill="#948db6">ALBUMS WRITTEN AS CODE</text>',
    ])
    (OUT / "logo-wordmark.svg").write_text(svg(1200, 360, body, glow("glow", 4)))


# --- shared cover pieces -----------------------------------------------------------
def stars(rng, count, w, h, top, color, rmax=1.8):
    out = []
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h * top)
        out.append(
            f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(rng.uniform(0.5, rmax))}" '
            f'fill="{color}" opacity="{rng.uniform(0.25, 0.9):.2f}"/>'
        )
    return "\n".join(out)


def ridge(rng, y, rough, w=1000, steps=9):
    """A mountain line by midpoint displacement, closed down to the bottom."""
    pts = [(0, y), (w, y)]
    disp = rough
    for _ in range(steps):
        nxt = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            nxt += [(x0, y0), ((x0 + x1) / 2, (y0 + y1) / 2 + rng.uniform(-disp, disp))]
        nxt.append(pts[-1])
        pts = nxt
        disp *= 0.55
    return path(pts + [(w, 1000), (0, 1000)])


def small_mark(x, y, size):
    return mark(x, y, size, background=False)


def footer(label, color):
    return (
        small_mark(48, 44, 56)
        + f'\n<text x="116" y="80" font-family="{MONO}" font-size="20" letter-spacing="8" '
        f'fill="{color}">LOOPFIELD · {label}</text>'
    )


# --- I · The Quixote Protocol --------------------------------------------------------
def cover_quixote():
    rng = random.Random(1605)  # the year Don Quixote was first printed
    defs = (
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#05040d"/><stop offset=".5" stop-color="#15103a"/>'
        '<stop offset=".74" stop-color="#5b3a63"/><stop offset=".86" stop-color="#e08e5a"/>'
        '<stop offset="1" stop-color="#f2c66d"/></linearGradient>'
        '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1cf"/>'
        '<stop offset=".4" stop-color="#f2c66d"/><stop offset="1" stop-color="#f2c66d" stop-opacity="0"/></radialGradient>'
        + glow("glow", 3)
    )
    body = ['<rect width="1000" height="1000" fill="url(#sky)"/>', stars(rng, 260, 1000, 1000, 0.62, "#dfe4ff")]

    # an orbit, and the small sun travelling on it
    body.append('<circle cx="700" cy="250" r="150" fill="none" stroke="#8fa8ff" stroke-opacity=".35" stroke-width="2"/>')
    sx, sy = 700 + 150 * math.cos(-2.3), 250 + 150 * math.sin(-2.3)
    body.append(f'<circle cx="{n(sx)}" cy="{n(sy)}" r="34" fill="url(#sun)"/>')
    body.append(f'<circle cx="{n(sx)}" cy="{n(sy)}" r="9" fill="#fff1cf"/>')

    # the murmuration: thousands of short strokes along one curving body,
    # dark against the dusk band of the sky
    birds = []
    for _ in range(2200):
        s = rng.random()
        x = 400 + 520 * s + 50 * math.sin(6.0 * s)
        y = 690 - 160 * math.sin(math.pi * s) + 55 * math.sin(3 * math.pi * s + 0.4)
        thick = 6 + 46 * math.sin(math.pi * s) ** 0.8 * (0.6 + 0.4 * math.sin(9 * s))
        ang = rng.gauss(0, 1) * 0.9
        x += math.cos(ang + 1.3) * rng.gauss(0, 1) * thick
        y += math.sin(ang + 1.3) * rng.gauss(0, 1) * thick
        dx = 520 + 300 * math.cos(6.0 * s)
        dy = -160 * math.pi * math.cos(math.pi * s) + 165 * math.pi * math.cos(3 * math.pi * s + 0.4)
        l = math.hypot(dx, dy) or 1
        ln = rng.uniform(3, 6)
        birds.append(f"M{n(x)} {n(y)} l{n(dx / l * ln)} {n(dy / l * ln)}")
    body.append(
        f'<path d="{" ".join(birds)}" stroke="#0d0919" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>'
    )

    # the hill, and the windmill he mistook for a giant
    body.append('<path d="M0 860 C 180 800, 330 790, 480 830 S 820 880, 1000 840 L1000 1000 L0 1000 Z" fill="#0a0716"/>')
    hx, hy = 300, 650
    body.append(f'<path d="M{hx - 46} 835 L{hx - 26} {hy + 20} L{hx + 26} {hy + 20} L{hx + 46} 835 Z" fill="#0a0716"/>')
    body.append(f'<path d="M{hx - 34} {hy + 24} L{hx} {hy - 14} L{hx + 34} {hy + 24} Z" fill="#0a0716"/>')
    for k in range(4):
        a = math.radians(22 + 90 * k)
        ca, sa = math.cos(a), math.sin(a)
        px, py = -sa, ca  # perpendicular, for the sail width
        x0, y0 = hx + ca * 14, hy + sa * 14
        x1, y1 = hx + ca * 210, hy + sa * 210
        sail = [(x0, y0), (x1, y1), (x1 + px * 34, y1 + py * 34), (x0 + px * 22, y0 + py * 22)]
        body.append(f'<path d="{path(sail)}" fill="#0a0716"/>')
        lattice = []
        for j in range(1, 9):
            f = j / 9
            ax, ay = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            w = 22 + 12 * f
            lattice.append(f"M{n(ax)} {n(ay)} l{n(px * w)} {n(py * w)}")
        body.append(f'<path d="{" ".join(lattice)}" stroke="#f2c66d" stroke-opacity=".18" stroke-width="1.5"/>')
    body.append(f'<circle cx="{hx}" cy="{hy}" r="10" fill="#0a0716"/>')

    body.append(footer("I", "#c9c2e6"))
    body.append(
        f'<text x="500" y="938" text-anchor="middle" font-family="{SERIF}" font-style="italic" '
        f'font-size="64" fill="#f2c66d">The Quixote Protocol</text>'
    )
    (OUT / "covers" / "quixote.svg").write_text(svg(1000, 1000, "\n".join(body), defs))


# --- II · Transmissions from 2089 ----------------------------------------------------
def cover_city():
    rng = random.Random(2089)
    defs = (
        '<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">'
        '<rect width="4" height="1" fill="#ffffff" opacity=".04"/></pattern>' + glow("glow", 5)
    )
    body = ['<rect width="1000" height="1000" fill="#05050a"/>']
    rain = []
    for _ in range(320):
        x, y, l = rng.uniform(-100, 1000), rng.uniform(0, 1000), rng.uniform(12, 40)
        rain.append(f"M{n(x)} {n(y)} l{n(l * 0.18)} {n(l)}")
    body.append(f'<path d="{" ".join(rain)}" stroke="#3df2ff" stroke-opacity=".16" stroke-width="1.2"/>')

    # a signal ring with a noisy, broken radius, torn into red and cyan
    pts, r = [], 0.0
    for i in range(240):
        r = r * 0.82 + rng.gauss(0, 9)
        spike = 40 if rng.random() < 0.03 else 0
        t = TAU * i / 240
        rr = 250 + r + spike
        pts.append((500 + rr * math.cos(t), 450 + rr * math.sin(t)))
    ring = path(pts)
    body.append(f'<path d="{ring}" fill="none" stroke="#ff2e4d" stroke-width="5" transform="translate(9 0)" opacity=".85" filter="url(#glow)"/>')
    body.append(f'<path d="{ring}" fill="none" stroke="#3df2ff" stroke-width="5" transform="translate(-9 0)" opacity=".75"/>')
    body.append(f'<path d="{ring}" fill="none" stroke="#f4f5ff" stroke-width="2"/>')

    # corrupted bands
    for _ in range(14):
        y, h = rng.uniform(150, 760), rng.uniform(2, 14)
        x, w = rng.uniform(0, 600), rng.uniform(120, 500)
        c = rng.choice(["#ff2e4d", "#3df2ff", "#f4f5ff"])
        body.append(f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" fill="{c}" opacity="{rng.uniform(.15, .6):.2f}"/>')

    body.append('<rect width="1000" height="1000" fill="url(#scan)"/>')
    body.append(footer("II", "#ff2e4d"))
    for dx, color in [(-4, "#3df2ff"), (4, "#ff2e4d"), (0, "#f4f5ff")]:
        body.append(
            f'<text x="{60 + dx}" y="880" font-family="{MONO}" font-size="56" font-weight="800" '
            f'letter-spacing="6" fill="{color}">TRANSMISSIONS</text>'
            f'<text x="{60 + dx}" y="944" font-family="{MONO}" font-size="56" font-weight="800" '
            f'letter-spacing="6" fill="{color}">FROM 2089</text>'
        )
    body.append(
        f'<text x="940" y="944" text-anchor="end" font-family="{MONO}" font-size="16" letter-spacing="4" '
        f'fill="#6f7290">SECTOR 7 · 52.37N 4.90E</text>'
    )
    (OUT / "covers" / "city.svg").write_text(svg(1000, 1000, "\n".join(body), defs))


# --- III · The Old World -----------------------------------------------------------------
def cover_old():
    rng = random.Random(1137)
    defs = (
        '<radialGradient id="air" cx=".5" cy=".46" r=".7"><stop offset="0" stop-color="#3a2410"/>'
        '<stop offset=".55" stop-color="#140f09"/><stop offset="1" stop-color="#07080a"/></radialGradient>'
        '<radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3d0"/>'
        '<stop offset=".45" stop-color="#f0c060"/><stop offset="1" stop-color="#e8b04a" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dca0"/>'
        '<stop offset=".6" stop-color="#e8b04a"/><stop offset="1" stop-color="#8a5a1c"/></linearGradient>'
        + glow("glow", 4)
    )
    body = ['<rect width="1000" height="1000" fill="url(#air)"/>']
    cx, cy = 500, 470
    rays = []
    for i in range(96):
        a = TAU * i / 96
        level = abs(math.sin(i * 0.37)) * 0.6 + rng.random() * 0.4  # a frequency spectrum, frozen
        r0, r1 = 120, 130 + level * 230
        rays.append(f"M{n(cx + math.cos(a) * r0)} {n(cy + math.sin(a) * r0)} L{n(cx + math.cos(a) * r1)} {n(cy + math.sin(a) * r1)}")
    body.append(f'<path d="{" ".join(rays)}" stroke="#e8b04a" stroke-width="3" stroke-linecap="round" opacity=".75" filter="url(#glow)"/>')
    body.append(f'<circle cx="{cx}" cy="{cy}" r="190" fill="url(#sun)"/>')
    body.append(f'<circle cx="{cx}" cy="{cy}" r="78" fill="#fff3d0"/>')

    for y, rough, color in [(600, 150, "#2a1f12"), (680, 120, "#1a140c"), (770, 90, "#0d0b07")]:
        body.append(f'<path d="{ridge(rng, y, rough)}" fill="{color}"/>')

    embers = []
    for _ in range(140):
        x, y = rng.uniform(0, 1000), rng.uniform(250, 900)
        embers.append(
            f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(rng.uniform(1, 3.2))}" fill="#f0a040" opacity="{rng.uniform(.25, .9):.2f}"/>'
        )
    body.append("\n".join(embers))

    body.append(footer("III", "#e8b04a"))
    body.append(
        f'<text x="500" y="918" text-anchor="middle" font-family="{CAPS}" font-size="78" font-weight="700" '
        f'letter-spacing="14" fill="url(#gold)">THE OLD WORLD</text>'
    )
    (OUT / "covers" / "old.svg").write_text(svg(1000, 1000, "\n".join(body), defs))


# --- IV · Edges of the Map ----------------------------------------------------------------
def cover_edge():
    rng = random.Random(7000)
    defs = (
        '<linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060a"/>'
        '<stop offset=".7" stop-color="#0b1c2a"/><stop offset="1" stop-color="#12293a"/></linearGradient>'
        '<radialGradient id="fire" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffcf8a"/>'
        '<stop offset=".35" stop-color="#d98c4a"/><stop offset="1" stop-color="#d98c4a" stop-opacity="0"/></radialGradient>'
        '<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>'
        + glow("glow", 3)
    )
    body = ['<rect width="1000" height="1000" fill="url(#night)"/>', stars(rng, 180, 1000, 1000, 0.55, "#e8f6ff", 1.5)]

    # aurora: layered curtains, each a sum of slow sines
    for layer in range(6):
        base = 230 + layer * 55
        ph = [rng.uniform(0, TAU) for _ in range(3)]
        pts = []
        for i in range(201):
            x = i * 5
            y = base + 40 * math.sin(x * 0.006 + ph[0]) + 22 * math.sin(x * 0.017 + ph[1]) + 9 * math.sin(x * 0.05 + ph[2])
            pts.append((x, y))
        d = path(pts, close=False)
        color = "#9fdcff" if layer % 2 == 0 else "#7ff0c8"
        body.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{34 - layer * 4}" opacity="{.22 - layer * .025:.3f}" filter="url(#soft)"/>')
        body.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.5" opacity="{.6 - layer * .07:.2f}"/>')

    # the ice shelf, the station on the left and a fire far to the right
    body.append('<path d="M0 760 L240 752 L420 768 L640 756 L1000 764 L1000 1000 L0 1000 Z" fill="#0a141c"/>')
    body.append('<path d="M0 760 L240 752 L420 768 L640 756 L1000 764" fill="none" stroke="#e8f6ff" stroke-opacity=".4" stroke-width="1.5"/>')
    body.append('<rect x="150" y="728" width="54" height="26" fill="#0a141c" stroke="#9fdcff" stroke-opacity=".35"/>')
    body.append('<path d="M188 728 L188 690" stroke="#9fdcff" stroke-opacity=".5" stroke-width="2"/>')
    body.append('<circle cx="188" cy="688" r="3" fill="#ff5a5a" filter="url(#glow)"/>')
    body.append('<rect x="160" y="736" width="8" height="6" fill="#ffe7a8"/>')
    body.append('<circle cx="830" cy="752" r="46" fill="url(#fire)"/>')
    body.append('<circle cx="830" cy="756" r="5" fill="#ffe7a8"/>')

    snow = []
    for _ in range(240):
        x, y = rng.uniform(0, 1000), rng.uniform(0, 1000)
        snow.append(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(rng.uniform(.8, 2.6))}" fill="#e8f6ff" opacity="{rng.uniform(.2, .75):.2f}"/>')
    body.append("\n".join(snow))

    body.append(footer("IV", "#9fdcff"))
    body.append(
        f'<text x="500" y="900" text-anchor="middle" font-family="{SANS}" font-size="62" font-weight="300" '
        f'letter-spacing="20" fill="#e8f6ff">EDGES OF THE MAP</text>'
    )
    body.append(
        f'<text x="500" y="946" text-anchor="middle" font-family="{SANS}" font-size="18" letter-spacing="8" '
        f'fill="#7590a0">70°N · AND SOMEWHERE FAR SOUTH</text>'
    )
    (OUT / "covers" / "edge.svg").write_text(svg(1000, 1000, "\n".join(body), defs))


if __name__ == "__main__":
    (OUT / "covers").mkdir(exist_ok=True)
    logo()
    cover_quixote()
    cover_city()
    cover_old()
    cover_edge()
    for f in sorted(OUT.rglob("*.svg")):
        print(f.relative_to(OUT), f.stat().st_size // 1024, "KB")

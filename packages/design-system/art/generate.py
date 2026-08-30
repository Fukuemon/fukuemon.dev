# -*- coding: utf-8 -*-
"""版画風の挿絵を生成する。5 つの図柄が同じ版 (荒れ・霧・階調) を共有する。"""
import math, random

W, H = 1200, 400


def defs(sfx, rough_freq="0.045 0.09", rough_scale=7, fade=(1.0, 0.80, 0.10)):
    a, b, c = fade
    return f'''  <defs>
    <filter id="rough-{sfx}" x="-8%" y="-8%" width="116%" height="116%">
      <feTurbulence type="fractalNoise" baseFrequency="{rough_freq}" numOctaves="3" seed="9" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="{rough_scale}" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <linearGradient id="fade-{sfx}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="{a}"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="{b}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="{c}"/>
    </linearGradient>
    <mask id="mist-{sfx}"><rect width="{W}" height="{H}" fill="url(#fade-{sfx})"/></mask>
  </defs>'''


def svg(sfx, label, inner):
    return (f'<svg class="art" viewBox="0 0 {W} {H}" role="img" aria-label="{label}"'
            f' preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">\n'
            f'{defs(sfx)}\n{inner}\n</svg>')


def paths(ps, ind=6):
    sp = " " * ind
    return "\n".join(f'{sp}<path d="{p}"/>' for p in ps)


# ---------------------------------------------------------------- 木立
def art_woodland():
    def trees(seed, n, x0, x1, base_y, hmin, hmax, wmin, wmax, nb):
        r = random.Random(seed)
        tr, br = [], []
        for i in range(n):
            x = x0 + (x1 - x0) * (i + r.uniform(0.1, 0.9)) / n
            base, h, w = base_y + r.uniform(-8, 10), r.uniform(hmin, hmax), r.uniform(wmin, wmax)
            lean, top = r.uniform(-0.06, 0.06) * h, base_y - 0
            top = base - h
            tr.append(f"M{x-w/2:.1f} {base:.1f}"
                      f"C{x-w*0.40+lean*0.25:.1f} {base-h*0.35:.1f} {x-w*0.20+lean*0.7:.1f} {base-h*0.72:.1f} {x-w*0.10+lean:.1f} {top:.1f}"
                      f"L{x+w*0.10+lean:.1f} {top:.1f}"
                      f"C{x+w*0.20+lean*0.7:.1f} {base-h*0.72:.1f} {x+w*0.40+lean*0.25:.1f} {base-h*0.35:.1f} {x+w/2:.1f} {base:.1f}Z")
            for _ in range(r.randint(*nb)):
                t = r.uniform(0.40, 0.96)
                by, bx = base - h * t, x + lean * t
                d, bl = r.choice([-1, 1]), r.uniform(0.14, 0.34) * h
                ex, ey = bx + d * bl, by - bl * r.uniform(0.55, 0.95)
                br.append(f"M{bx:.1f} {by:.1f}Q{bx+d*bl*0.5:.1f} {by-bl*0.12:.1f} {ex:.1f} {ey:.1f}")
                if r.random() < 0.55:
                    b2 = bl * r.uniform(0.35, 0.6)
                    br.append(f"M{ex:.1f} {ey:.1f}Q{ex+d*b2*0.5:.1f} {ey-b2*0.15:.1f} {ex+d*b2*0.8:.1f} {ey-b2:.1f}")
        return tr, br

    def ridge(seed, y_l, y_r, x0, x1, thick):
        r = random.Random(seed); n = 190
        top = []
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t
            y = y_l + (y_r - y_l) * (t ** 0.62)
            y -= abs(math.sin(t * 47.0 + 0.7)) * r.uniform(3, 13) + r.uniform(0, 6)
            top.append((x, y))
        bot = []
        for i in range(n + 1):
            t = i / n; x = x1 - (x1 - x0) * t
            bot.append((x, y_l + (y_r - y_l) * ((1 - t) ** 0.62) + thick * (0.5 + 0.5 * math.sin((1 - t) * 2.2))))
        p = top + bot
        return f"M{p[0][0]:.1f} {p[0][1]:.1f}" + "".join(f"L{x:.1f} {y:.1f}" for x, y in p[1:]) + "Z"

    ft, fb = trees(11, 24, 500, 1240, 352, 90, 210, 3, 8, (2, 4))
    mt, mb = trees(29, 13, 540, 1220, 366, 130, 290, 6, 15, (3, 6))
    nt, nb_ = trees(47, 4, 660, 1180, 380, 210, 340, 12, 22, (4, 7))
    inner = f'''  <g filter="url(#rough-wood)">
    <g mask="url(#mist-wood)">
      <g fill="var(--wood-3)">
{paths(ft)}
      </g>
      <g fill="none" stroke="var(--wood-3)" stroke-width="1.4" stroke-linecap="round">
{paths(fb)}
      </g>
      <g fill="var(--wood-2)">
{paths(mt)}
      </g>
      <g fill="none" stroke="var(--wood-2)" stroke-width="2" stroke-linecap="round">
{paths(mb)}
      </g>
      <g fill="var(--wood-1)" opacity="0.86">
{paths(nt)}
      </g>
      <g fill="none" stroke="var(--wood-1)" stroke-width="2.6" stroke-linecap="round" opacity="0.86">
{paths(nb_)}
      </g>
    </g>
    <path d="{ridge(5, 436, 132, 300, 1250, 82)}" fill="var(--wood-1)"/>
  </g>'''
    return svg("wood", "霧のなかの木立と、手前を横切る斜面", inner)


# ---------------------------------------------------------------- 竹
def art_bamboo(w=W, h=H, sfx='bamboo', n_scale=1.0, label='竹林'):
    r = random.Random(23)
    layers = []
    specs = [("var(--wood-3)", max(3, round(15*n_scale)), 6, 13, 1.0),
             ("var(--wood-2)", max(2, round(9*n_scale)), 12, 22, 1.0),
             ("var(--wood-1)", max(1, round(4*n_scale)), 22, 36, 0.9)]
    for ci, (col, n, wmin, wmax, op) in enumerate(specs):
        stalks, nodes, leaves = [], [], []
        for i in range(n):
            x = w * (i + r.uniform(0.15, 0.85)) / n
            sw = r.uniform(wmin, wmax)
            lean = r.uniform(-26, 26)
            top = r.uniform(-60, 40)
            # 幹は上へわずかに細る
            stalks.append(f"M{x-sw/2:.1f} {h+10:.1f}L{x+sw/2:.1f} {h+10:.1f}"
                          f"L{x+lean+sw*0.34:.1f} {top:.1f}L{x+lean-sw*0.34:.1f} {top:.1f}Z")
            # 節: 地の色で横に切る
            y = h - r.uniform(10, 60)
            while y > top + 24:
                t = (h - y) / (h - top)
                cx = x + lean * t
                cw = sw * (1 - 0.66 * t)
                nodes.append(f"M{cx-cw*0.62:.1f} {y:.1f}L{cx+cw*0.62:.1f} {y-2.4:.1f}")
                y -= r.uniform(58, 96)
            # 葉: 上部から 3-6 枚
            for _ in range(r.randint(3, 6)):
                t = r.uniform(0.62, 1.0)
                by = h - (h - top) * t
                bx = x + lean * t
                d = r.choice([-1, 1])
                ln = r.uniform(48, 132) * (0.55 + 0.45 * (ci + 1) / 3)
                ex, ey = bx + d * ln, by - ln * r.uniform(0.15, 0.55)
                mx, my = (bx + ex) / 2, (by + ey) / 2
                leaves.append(f"M{bx:.1f} {by:.1f}Q{mx:.1f} {my-ln*0.20:.1f} {ex:.1f} {ey:.1f}"
                              f"Q{mx:.1f} {my+ln*0.10:.1f} {bx:.1f} {by:.1f}Z")
        layers.append(f'''    <g fill="{col}" opacity="{op}">
{paths(stalks)}
{paths(leaves)}
    </g>
    <g fill="none" stroke="var(--paper)" stroke-width="3.4" stroke-linecap="butt" opacity="{op}">
{paths(nodes)}
    </g>''')
    inner = (f'  <g filter="url(#rough-{sfx})">\n    <g mask="url(#mist-{sfx})">\n'
             + "\n".join(layers) + "\n    </g>\n  </g>")
    d = defs(sfx).replace(f'width="{W}" height="{H}"', f'width="{w}" height="{h}"')
    return (f'<svg class="art" viewBox="0 0 {w} {h}" role="img" aria-label="{label}"'
            f' preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">\n'
            f'{d}\n{inner}\n</svg>')


# ---------------------------------------------------------------- 水面
def art_ripple():
    r = random.Random(31)
    groups = []
    centers = [(300, 306, 1.0, "var(--wood-3)", 8), (770, 244, 1.0, "var(--wood-2)", 7), (1055, 340, 1.0, "var(--wood-1)", 5)]
    for gi, (cx, cy, op, col, n) in enumerate(centers):
        arcs = []
        for i in range(n):
            rx = 46 + i * r.uniform(40, 62)
            ry = rx * 0.27
            # 円弧を 1-2 本の欠けのある楕円として引く
            a0 = r.uniform(0, math.tau)
            span = r.uniform(3.6, 6.0)
            pts = []
            steps = 64
            for k in range(steps + 1):
                a = a0 + span * k / steps
                wob = 1 + 0.045 * math.sin(a * 5 + i)
                pts.append((cx + rx * wob * math.cos(a), cy + ry * wob * math.sin(a)))
            arcs.append(f"M{pts[0][0]:.1f} {pts[0][1]:.1f}" + "".join(f"L{x:.1f} {y:.1f}" for x, y in pts[1:]))
        groups.append(f'''    <g fill="none" stroke="{col}" stroke-linecap="round" stroke-width="{2.4 - gi*0.5:.1f}" opacity="{op}">
{paths(arcs)}
    </g>''')
    # 浮かぶ葉を数枚
    leaves = []
    for _ in range(5):
        x, y = r.uniform(120, 1120), r.uniform(180, 380)
        ln = r.uniform(16, 38)
        d = r.choice([-1, 1])
        leaves.append(f"M{x:.1f} {y:.1f}Q{x+d*ln*0.5:.1f} {y-ln*0.30:.1f} {x+d*ln:.1f} {y-ln*0.06:.1f}"
                      f"Q{x+d*ln*0.5:.1f} {y+ln*0.16:.1f} {x:.1f} {y:.1f}Z")
    groups.append(f'''    <g fill="var(--wood-1)" opacity="0.9">
{paths(leaves)}
    </g>''')
    inner = '  <g filter="url(#rough-ripple)">\n    <g mask="url(#mist-ripple)">\n' + "\n".join(groups) + "\n    </g>\n  </g>"
    return ('<svg class="art" viewBox="0 0 1200 400" role="img" aria-label="水面に広がる波紋と、浮かぶ葉"'
            ' preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">\n'
            + defs("ripple", rough_scale=3) + "\n" + inner + "\n</svg>")


# ---------------------------------------------------------------- 遠い山
def art_ridge():
    r = random.Random(53)
    layers = []
    specs = [("var(--wood-3)", 176, 62, 0.85), ("var(--wood-2)", 262, 48, 0.92), ("var(--wood-1)", 336, 34, 1.0)]
    for li, (col, base_y, amp, op) in enumerate(specs):
        n = 240
        pts = []
        for i in range(n + 1):
            t = i / n
            x = -20 + (W + 40) * t
            y = base_y
            y -= amp * (0.55 * math.sin(t * 5.3 + li * 2.1) + 0.30 * math.sin(t * 11.7 + li) + 0.15 * math.sin(t * 23.1 + li * 3))
            y += r.uniform(-3.5, 3.5)
            pts.append((x, y))
        d = (f"M{pts[0][0]:.1f} {H+20:.1f}L{pts[0][0]:.1f} {pts[0][1]:.1f}"
             + "".join(f"L{x:.1f} {y:.1f}" for x, y in pts[1:])
             + f"L{pts[-1][0]:.1f} {H+20:.1f}Z")
        layers.append(f'    <g fill="{col}" opacity="{op}"><path d="{d}"/></g>')
    inner = ('  <g filter="url(#rough-ridge)">\n    <g mask="url(#mist-ridge)">\n'
             + "\n".join(layers) + "\n    </g>\n  </g>")
    return svg("ridge", "霧のなかに重なる遠い山", inner)


# ---------------------------------------------------------------- 草
def art_grass():
    r = random.Random(71)
    layers = []
    specs = [("var(--wood-3)", 150, 60, 170, 1.2, 0.9), ("var(--wood-2)", 95, 90, 240, 1.9, 1.0), ("var(--wood-1)", 46, 130, 320, 2.8, 1.0)]
    for col, n, hmin, hmax, sw, op in specs:
        blades, heads = [], []
        for i in range(n):
            x = -30 + (W + 60) * (i + r.uniform(0.1, 0.9)) / n
            base = H + r.uniform(0, 24)
            h = r.uniform(hmin, hmax)
            d = r.choice([-1, 1])
            bend = r.uniform(0.10, 0.42) * h * d
            ex, ey = x + bend, base - h
            blades.append(f"M{x:.1f} {base:.1f}Q{x+bend*0.18:.1f} {base-h*0.58:.1f} {ex:.1f} {ey:.1f}")
            if r.random() < 0.28:
                heads.append(f"M{ex:.1f} {ey:.1f}q{bend*0.10:.1f} {-h*0.09:.1f} {bend*0.02:.1f} {-h*0.16:.1f}"
                             f"q{-bend*0.14:.1f} {h*0.05:.1f} {-bend*0.02:.1f} {h*0.16:.1f}Z")
        layers.append(f'''    <g fill="none" stroke="{col}" stroke-width="{sw}" stroke-linecap="round" opacity="{op}">
{paths(blades)}
    </g>
    <g fill="{col}" opacity="{op}">
{paths(heads)}
    </g>''')
    inner = '  <g filter="url(#rough-grass)">\n    <g mask="url(#mist-grass)">\n' + "\n".join(layers) + "\n    </g>\n  </g>"
    return svg("grass", "風に傾く草叢と穂", inner)


ARTS = {
    "woodland": ("木立", art_woodland),
    "bamboo":   ("竹",   art_bamboo),
    "ripple":   ("水面", art_ripple),
    "ridge":    ("遠い山", art_ridge),
    "grass":    ("草",   art_grass),
}

if __name__ == "__main__":
    for k, (label, fn) in ARTS.items():
        s = fn()
        open(f"_art_{k}.svg.frag", "w").write(s)
        print(f"{k:<9} {label:<4} {len(s):>7} bytes  {s.count('<path'):>4} paths")

    tall = art_bamboo(w=560, h=980, sfx="bambootall", n_scale=0.62, label="縦に伸びる竹林")
    open("_art_bamboo_tall.svg.frag", "w").write(tall)
    print(f'{"bamboo(tall)":<9} {"竹 縦":<4} {len(tall):>7} bytes  {tall.count("<path"):>4} paths')

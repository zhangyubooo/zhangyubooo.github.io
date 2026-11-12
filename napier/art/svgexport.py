# Make the tall screens' page SVGs in this folder from the design's own PIL generator.
# Usage: copy this file into the handoff's source_scripts/ (next to lib.py, rod15.py,
# rod16.py; Gelasio in ../fonts/) and run:  python3 svgexport.py <this art folder>
#
# It runs the PIL page generators, but records every drawing call as SVG instead of pixels.
# Coordinates stay in the scripts' supersampled px space (units × SS), viewBox 3600 × 7622.
# Interactive parts (pager, avatar + hint bubble) are not drawn: the web page builds them.
import sys, os, math, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from lib import SS, u, W, HU, F, BG1, BG2, ACC

FONTS = {}          # id(font) -> (style, px)
_origF = lib.F
def F2(sz, style=''):
    f = _origF(sz, style)
    FONTS[id(f)] = (style, max(1, int(round(sz * SS))))
    return f
lib.F = F2

def col(c):
    if c is None: return 'none', 1
    if len(c) == 4: return 'rgb(%d,%d,%d)' % c[:3], c[3] / 255
    return 'rgb(%d,%d,%d)' % tuple(c), 1

def n(v): return ('%.1f' % v).rstrip('0').rstrip('.')

class FakeDraw:
    def __init__(self, out): self.out = out
    def _paint(self, fill, outline, width):
        a = []
        fc, fo = col(fill); a.append('fill="%s"' % fc)
        if fo < 1: a.append('fill-opacity="%.3f"' % fo)
        if outline is not None and width:
            oc, oo = col(outline); a.append('stroke="%s" stroke-width="%s"' % (oc, n(width)))
            if oo < 1: a.append('stroke-opacity="%.3f"' % oo)
        return ' '.join(a)
    def rectangle(self, box, fill=None, outline=None, width=0):
        self.rounded_rectangle(box, 0, fill, outline, width)
    def rounded_rectangle(self, box, radius=0, fill=None, outline=None, width=0):
        x0, y0, x1, y1 = box; x1 += 1; y1 += 1
        r = ' rx="%s"' % n(radius) if radius else ''
        if fill is not None:
            self.out.append('<rect x="%s" y="%s" width="%s" height="%s"%s %s/>' % (n(x0), n(y0), n(x1 - x0), n(y1 - y0), r, self._paint(fill, None, 0)))
        if outline is not None and width:
            h = width / 2
            r2 = ' rx="%s"' % n(max(0, radius - h)) if radius else ''
            self.out.append('<rect x="%s" y="%s" width="%s" height="%s"%s %s/>' % (n(x0 + h), n(y0 + h), n(x1 - x0 - width), n(y1 - y0 - width), r2, self._paint(None, outline, width)))
    def line(self, pts, fill=None, width=1, joint=None):
        oc, oo = col(fill)
        self.out.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"%s/>' % (
            ' '.join('%s,%s' % (n(a), n(b)) for a, b in pts), oc, n(width), '' if oo == 1 else ' stroke-opacity="%.3f"' % oo))
    def ellipse(self, box, fill=None, outline=None, width=0):
        x0, y0, x1, y1 = box; x1 += 1; y1 += 1
        cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
        if fill is not None:
            self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" %s/>' % (n(cx), n(cy), n(rx), n(ry), self._paint(fill, None, 0)))
        if outline is not None and width:
            h = width / 2
            self.out.append('<ellipse cx="%s" cy="%s" rx="%s" ry="%s" %s/>' % (n(cx), n(cy), n(rx - h), n(ry - h), self._paint(None, outline, width)))
    def polygon(self, pts, fill=None, outline=None, width=1):
        self.out.append('<polygon points="%s" %s/>' % (' '.join('%s,%s' % (n(a), n(b)) for a, b in pts),
                                                     self._paint(fill, outline, width if outline is not None else 0)))
    def arc(self, box, start, end, fill=None, width=1):
        x0, y0, x1, y1 = box; x1 += 1; y1 += 1
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; r = (x1 - x0) / 2 - width / 2
        a0, a1 = math.radians(start), math.radians(end)
        large = 1 if (end - start) % 360 > 180 else 0
        oc, _ = col(fill)
        self.out.append('<path d="M%s %s A%s %s 0 %d 1 %s %s" fill="none" stroke="%s" stroke-width="%s"/>' % (
            n(cx + r * math.cos(a0)), n(cy + r * math.sin(a0)), n(r), n(r), large,
            n(cx + r * math.cos(a1)), n(cy + r * math.sin(a1)), oc, n(width)))
    def text(self, xy, t, font=None, fill=None, anchor='la', **kw):
        style, px = FONTS.get(id(font), ('', 40))
        x, y = xy
        a = font.getbbox(t, anchor=anchor); b = font.getbbox(t, anchor='ls')
        x += a[0] - b[0]; y += a[1] - b[1]
        c, o = col(fill)
        attrs = 'x="%s" y="%s" font-size="%d" fill="%s"' % (n(x), n(y), px, c)
        if 'I' in style: attrs += ' font-style="italic"'
        if 'B' in style: attrs += ' font-weight="bold"'
        elif 'M' in style: attrs += ' font-weight="500"'
        if o < 1: attrs += ' fill-opacity="%.3f"' % o
        self.out.append('<text %s>%s</text>' % (attrs, html.escape(t, quote=False)))

class SvgPage(lib.Page):
    def __init__(self):
        self.out = []
        self.d = FakeDraw(self.out)
        self.ask_q = None
    def overlay(self, fn): fn(self.d)
    def avatar(self, cx, cy, r, ring=True, dot=True):
        self.out.append('<clipPath id="av%d"><circle cx="%s" cy="%s" r="%s"/></clipPath>' % (len(self.out), n(u(cx)), n(u(cy)), n(u(r))))
        self.out.append('<image href="images/napier-avatar.jpg" x="%s" y="%s" width="%s" height="%s" clip-path="url(#av%d)"/>' % (
            n(u(cx - r)), n(u(cy - r)), n(u(2 * r)), n(u(2 * r)), len(self.out) - 1))
        if ring: self.circle(cx, cy, r, outline=ACC, width=4)
        if dot:
            a = math.radians(45); dx, dy = cx + r * math.cos(a) * 0.98, cy + r * math.sin(a) * 0.98
            self.circle(dx, dy, max(9, r * 0.19), fill=lib.ONLINE, outline=BG2, width=4)
    def nav(self, i, n_, footer=None): pass            # built in HTML
    def ask(self, question): self.ask_q = question      # built in HTML
    def upside(self, cx, cy, t, size=34, color=lib.DIM):
        f = F2(size, 'I')
        a = f.getbbox(t, anchor='mm'); b = f.getbbox(t, anchor='ls')
        x, y = u(cx) + a[0] - b[0], u(cy) + a[1] - b[1]
        c, _ = col(color)
        self.out.append('<text x="%s" y="%s" font-size="%d" font-style="italic" fill="%s" transform="rotate(180 %s %s)">%s</text>' % (
            n(x), n(y), int(round(size * SS)), c, n(u(cx)), n(u(cy)), html.escape(t, quote=False)))
    def svg(self):
        head = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" font-family="Georgia, Gelasio, serif">'
                '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb%s"/>'
                '<stop offset="1" stop-color="rgb%s"/></linearGradient></defs>'
                '<rect width="100%%" height="100%%" fill="url(#bg)"/>') % (u(W), u(HU), str(BG1), str(BG2))
        return head + ''.join(self.out) + '</svg>'
lib.Page = SvgPage

import prompt
def plate_svg(p, x0, y, S, k, ncol=5, windows=True, tab=0.31):
    X0, X1 = u(x0 - tab * S), u(x0 + ncol * S + 6)
    Y0, Y1 = u(y - 6), u(y + S + 6)
    sub = S / 5.0
    d = 'M%s %sH%sV%sH%sZ' % (X0, Y0, X1, Y1, X0)
    holes = []
    if windows:
        for j in range(ncol):
            for (r, c) in (prompt.TENS[k], prompt.UNIT[k]):
                hx, hy = x0 + j * S + c * sub, y + r * sub
                holes.append((hx, hy))
                a0, b0, a1, b1 = u(hx) + u(3), u(hy) + u(3), u(hx + sub) - u(3), u(hy + sub) - u(3)
                d += 'M%s %sH%sV%sH%sZ' % (a0, b0, a1, b1, a0)
    p.out.append('<path d="%s" fill="rgb(13,14,18)" fill-rule="evenodd"/>' % d)
    h = u(2) / 2
    p.out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="rgb(70,76,90)" stroke-width="%s"/>' % (
        n(X0 + h), n(Y0 + h), n(X1 - X0 - 2 * h), n(Y1 - Y0 - 2 * h), u(2)))
    for hx, hy in holes:
        p.rect(hx + 3, hy + 3, sub - 6, sub - 6, outline=ACC, width=3)
    p.text(x0 - tab * S / 2, y + S / 2 + 2, str(k), F2(S * 0.24, 'B'), ACC, 'mm')
    for j in range(ncol):
        p.line([(x0 + j * S + 4, y + S - 4), (x0 + j * S + S * 0.18, y + S * 0.82)], (150, 60, 50), 3)
        p.line([(x0 + (j + 1) * S - S * 0.18, y + S * 0.18), (x0 + (j + 1) * S - 4, y + 4)], (150, 60, 50), 3)
prompt.plate = plate_svg
prompt.F = F2
import loc
loc.F = F2

import rod15, rod16
for m in (rod15, rod16, prompt, loc): m.F = F2

if __name__ == '__main__':
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    meta = {}
    for name, mod in (('promptuary', rod15), ('location', rod16)):
        meta[name] = []
        for i, fn in enumerate(mod.PAGES):
            p = fn()
            path = os.path.join(outdir, '%s-p%d.svg' % (name, i + 1))
            open(path, 'w', encoding='utf-8').write(p.svg())
            meta[name].append({'ask': p.ask_q, 'bytes': os.path.getsize(path)})
            print(path, os.path.getsize(path))
    print(json.dumps(meta, ensure_ascii=False, indent=1))

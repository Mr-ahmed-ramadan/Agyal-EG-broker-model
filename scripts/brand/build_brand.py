"""Build the public Agyal brand kit into apps/client-web/public/brand.

Wordmarks are outlined from the OFL fonts (Cormorant Garamond, Amiri) so the
files render identically on machines that have neither font installed.

    pip install fonttools uharfbuzz resvg-py
    # Put the TrueType files for Cormorant Garamond 700 and Amiri 700 in
    # FONTS_DIR (fonts.googleapis.com/css2 serves .ttf to a plain curl) and
    # point LATIN and ARABIC below at them.
    python3 scripts/brand/build_brand.py FONTS_DIR apps/client-web/public/brand

The page itself, apps/client-web/public/brand/index.html, is hand-written.
"""
import os, sys, shutil, zipfile
import resvg_py
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONTS, OUT = sys.argv[1], sys.argv[2]
LATIN = os.path.join(FONTS, 'co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_hg9GnM.ttf')
ARABIC = os.path.join(FONTS, 'J7acnpd8CGxBHp2VkZY4.ttf')

FOREST, BRONZE, IVORY, INK = '#2F5A45', '#A8823A', '#F7F4EC', '#16211B'
WAYS = {  # colourway -> (strokes and wordmark, the bronze doorway)
    'color': (FOREST, BRONZE),
    'mono': (INK, INK),
    'ivory': (IVORY, BRONZE),
}

def arch(fg, accent):
    return (f'<path d="M9.5 56V31a22.5 22.5 0 0 1 45 0v25" fill="none" stroke="{fg}" stroke-width="5" stroke-linejoin="round"/>'
            f'<path d="M21 56V33.5a11 11 0 0 1 22 0V56" fill="none" stroke="{fg}" stroke-width="5" stroke-linejoin="round"/>'
            f'<path d="M28.5 56v-9a3.5 3.5 0 0 1 7 0v9z" fill="{accent}"/>')

def seal(fg, accent):
    return (f'<circle cx="32" cy="32" r="24.5" fill="none" stroke="{fg}" stroke-width="4.5"/>'
            f'<path d="M20 46V32a12 12 0 0 1 24 0v14" fill="none" stroke="{fg}" stroke-width="4.5" stroke-linejoin="round"/>'
            f'<path d="M28 46v-9a4 4 0 0 1 8 0v9z" fill="{accent}"/>')

def ladder(fg, accent):
    rungs = ''.join(f'<rect x="16" y="{y}" width="{w}" height="5.5" rx="2.75" fill="{fg}"/>'
                    for y, w in ((12, 17), (25, 25), (38, 33)))
    return (f'<rect x="8" y="8" width="5.5" height="48" rx="2.75" fill="{fg}"/>' + rungs +
            f'<rect x="16" y="51" width="41" height="5.5" rx="2.75" fill="{accent}"/>')

MARKS = {'arch': arch, 'seal': seal, 'ladder': ladder}

def svg(viewbox, body, label='Agyal'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" aria-label="{label}">'
            f'<title>{label}</title>{body}</svg>\n')

def word(path, text, size):
    """Shape `text` and return (svg path data, bounds) at `size` units, baseline at y=0."""
    blob = hb.Blob.from_file_path(path)
    face = hb.Face(blob)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True})
    tt = TTFont(path)
    gs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    scale = size / tt['head'].unitsPerEm
    pen = SVGPathPen(gs)
    bounds = BoundsPen(gs)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        t = (scale, 0, 0, -scale, (x + pos.x_offset) * scale, -pos.y_offset * scale)
        gs[name].draw(TransformPen(pen, t))
        gs[name].draw(TransformPen(bounds, t))
        x += pos.x_advance
    return pen.getCommands(), bounds.bounds, x * scale

def lockup(lang, fg, accent):
    # Measured from the arch's visible edges (x 7..57, y 6..56, strokes
    # included), not its 64-unit box, so the gap reads as drawn.
    MX0, MX1, MY0, MY1, gap, pad = 7, 57, 6, 56, 14, 4
    if lang == 'en':
        d, (x0, y0, x1, y1), _ = word(LATIN, 'Agyal', 50)
        mx = 0
        tx = MX1 + gap - x0
    else:
        d, (x0, y0, x1, y1), _ = word(ARABIC, 'أجيال', 52)
        tx = MX0 - x0
        mx = (x1 - x0) + gap
    base = MY1  # the wordmark sits on the arch's floor
    top = min(MY0, base + y0) - pad
    bottom = max(MY1, base + y1) + pad
    width = (MX1 - MX0) + gap + (x1 - x0)
    body = (f'<g transform="translate({mx:.2f} 0)">{arch(fg, accent)}</g>'
            f'<path transform="translate({tx:.2f} {base})" d="{d}" fill="{fg}"/>')
    vb = f'{MX0 - pad} {top:.2f} {width + 2 * pad:.2f} {bottom - top:.2f}'
    return svg(vb, body, 'Agyal' if lang == 'en' else 'أجيال')

def app_icon():
    body = (f'<rect width="64" height="64" rx="14" fill="{FOREST}"/>'
            f'<g transform="translate(9.6 10.4) scale(0.7)">{arch(IVORY, BRONZE)}</g>')
    return svg('0 0 64 64', body)

def write(rel, text):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(text)
    return p

def png(svg_rel, png_rel, w, h):
    # resvg keeps the alpha channel; a browser screenshot flattens it to white.
    data = resvg_py.svg_to_bytes(svg_path=os.path.join(OUT, svg_rel), width=w, height=h)
    dst = os.path.join(OUT, png_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as f:
        f.write(bytes(data))

def main():
    if os.path.isdir(OUT):
        for sub in ('svg', 'png'):
            shutil.rmtree(os.path.join(OUT, sub), ignore_errors=True)
    files = []
    for mark, draw in MARKS.items():
        for way, (fg, acc) in WAYS.items():
            files.append(write(f'svg/agyal-{mark}-{way}.svg', svg('0 0 64 64', draw(fg, acc))))
            png(f'svg/agyal-{mark}-{way}.svg', f'png/agyal-{mark}-{way}-1024.png', 1024, 1024)
    for lang in ('en', 'ar'):
        for way, (fg, acc) in WAYS.items():
            rel = f'svg/agyal-lockup-{lang}-{way}.svg'
            text = lockup(lang, fg, acc)
            write(rel, text)
            vb = [float(v) for v in text.split('viewBox="')[1].split('"')[0].split()]
            w = 1600
            png(rel, f'png/agyal-lockup-{lang}-{way}.png', w, round(w * vb[3] / vb[2]))
    write('svg/agyal-app-icon.svg', app_icon())
    png('svg/agyal-app-icon.svg', 'png/agyal-app-icon-1024.png', 1024, 1024)
    png('svg/agyal-app-icon.svg', 'png/agyal-app-icon-180.png', 180, 180)

    zpath = os.path.join(OUT, 'agyal-brand-kit.zip')
    if os.path.exists(zpath):
        os.remove(zpath)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for sub in ('svg', 'png'):
            for name in sorted(os.listdir(os.path.join(OUT, sub))):
                z.write(os.path.join(OUT, sub, name), f'agyal-brand-kit/{sub}/{name}')
        z.writestr('agyal-brand-kit/README.txt', README)
    print('built', len(os.listdir(os.path.join(OUT, 'svg'))), 'svg,',
          len(os.listdir(os.path.join(OUT, 'png'))), 'png')

README = """Agyal brand kit

Primary mark: the arch (agyal-arch-*). Seal and ladder are alternates.

Colourways
  color  - forest #2F5A45 with the bronze #A8823A doorway, for light grounds
  ivory  - ivory #F7F4EC with the bronze doorway, for dark or forest grounds
  mono   - one colour, for single-ink printing and engraving

Wordmarks are outlined from Cormorant Garamond (Agyal) and Amiri (Arabic),
both under the SIL Open Font License, so the files need no fonts installed.

Clear space on all sides is the height of the bronze doorway.
Do not recolour, tilt, outline, stretch or add effects to the mark.

https://invest.egypt.agyal.net/brand
"""

main()

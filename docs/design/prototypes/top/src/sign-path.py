# 使い方: uv run --with fonttools python -I src/sign-path.py <書体のファイル> <文字列> <出力の SVG>
# 書体から文字列の輪郭を取り出し、1 本の path を持つ SVG に書く。署名を、書体を配らずに線として HTML に置くために使う。
# 字の送りは、書体の送り幅だけを使う。カーニングと合字は当てない。
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

font_path, text, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
font = TTFont(font_path)
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
hhea = font["hhea"]
pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))
x = 0
for ch in text:
    name = cmap[ord(ch)]
    glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, hhea.ascent)))
    x += font["hmtx"][name][0]
height = hhea.ascent - hhea.descent
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x} {height}" data-source="{font["name"].getDebugName(4)}">'
    f'<path d="{pen.getCommands()}"/></svg>\n'
)
with open(out_path, "w", encoding="utf-8") as f:
    f.write(svg)
print(x, height, len(svg))

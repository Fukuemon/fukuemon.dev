#!/usr/bin/env node
// 挿絵の SVG を、版の仕様を共有するパラメータから組み、packages/ui/src/art/ に書き出す。
// 使い方: node scripts/build-art.mjs [--check]
//   --check は書き出さず、書き出すはずの中身と今のファイルを比べる。CI で生成物のずれを見つけるのに使う
// 終了コード: 0 は書き出した（--check では一致した）、1 は --check で食い違うかファイルがない
// 色は --fd-color-text と --fd-color-surface だけで塗り、濃さは --fd-art-* の不透明度で決める。生の色の値を書かない
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "packages/ui/src/art");
const W = 1200;
const H = 400;
const INK = "var(--fd-color-text)";
const PAPER = "var(--fd-color-surface)";
const tone = (name) => `style="opacity:var(--fd-art-${name})"`;

// 生成し直しても同じ SVG になるよう、乱数の種を固定する
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const n = (v) => Number(v.toFixed(1));

// 霧: 下端が濃く、上端で地の色へなじむ。mask は alpha で読み、白の色の値を書かない
function defs(id, { rough, mistTop }) {
  return [
    "<defs>",
    `<filter id="${id}-rough" x="-5%" y="-5%" width="110%" height="110%">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="3" seed="7" result="noise"/>`,
    `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${rough}" xChannelSelector="R" yChannelSelector="G"/>`,
    "</filter>",
    `<linearGradient id="${id}-fade" x1="0" y1="1" x2="0" y2="0">`,
    `<stop offset="0" stop-opacity="1"/>`,
    `<stop offset="0.5" stop-opacity="0.85"/>`,
    `<stop offset="1" stop-opacity="${mistTop}"/>`,
    "</linearGradient>",
    `<mask id="${id}-mist" mask-type="alpha">`,
    `<rect width="${W}" height="${H}" fill="url(#${id}-fade)"/>`,
    "</mask>",
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-opacity="1"/>`,
    `<stop offset="1" stop-opacity="0"/>`,
    "</linearGradient>",
    "</defs>",
  ].join("\n");
}

const open = (extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice"${extra}>`;

// sky は霧だけを掛け、荒れを掛けない。荒れで上端の辺がずれ、空に筋が出るため
function plate(id, inner, opts, sky = []) {
  return [
    open(),
    defs(id, opts),
    `<g mask="url(#${id}-mist)">`,
    ...sky,
    `<g filter="url(#${id}-rough)">`,
    ...inner,
    "</g>",
    "</g>",
    "</svg>",
    "",
  ].join("\n");
}

function ridgePath(r, base, amps) {
  const waves = amps.map(([amp, len]) => ({ amp, f: (2 * Math.PI) / len, p: r() * 6.28 }));
  let d = `M-20 ${H + 10}`;
  for (let x = -20; x <= W + 20; x += 8) {
    const y = base + waves.reduce((s, w) => s + w.amp * Math.sin(w.f * x + w.p), 0);
    d += `L${x} ${n(y)}`;
  }
  return `${d}L${W + 20} ${H + 10}Z`;
}

// 層は地の色で下を隠してから墨を重ねる。後ろの層が透けないので、ダークで近景を暗くしても奥の稜線が出ない
const layer = (d, name) => [
  `<path d="${d}" fill="${PAPER}"/>`,
  `<path d="${d}" fill="${INK}" ${tone(name)}/>`,
];

// 一文字ぼかし: 上端から下へ薄れる空の帯
const ichimonji = (id, height, name) =>
  `<rect width="${W}" height="${height}" fill="${INK}" fill-opacity="1" mask="url(#${id}-sky-mask)" ${tone(name)}/>`;
const skyMask = (id, height) =>
  `<mask id="${id}-sky-mask" mask-type="alpha"><rect width="${W}" height="${height}" fill="url(#${id}-sky)"/></mask>`;

// 霞の山並み: 3 層の稜線。霞の帯は動きの層（kasumi-motion.svg）が持つ
function kasumi() {
  const id = "fd-art-kasumi";
  const r = rng(11);
  const layers = [
    [
      200,
      [
        [38, 520],
        [14, 170],
      ],
      "far",
    ],
    [
      265,
      [
        [30, 430],
        [10, 120],
      ],
      "mid",
    ],
    [
      330,
      [
        [22, 610],
        [9, 90],
      ],
      "near",
    ],
  ];
  const inner = layers.flatMap(([base, amps, name]) => layer(ridgePath(r, base, amps), name));
  return plate(id, inner, { rough: 5, mistTop: 0.05 });
}

// 霞の帯（すやり霞）: 地の色の帯の縁を、帯の形に伸ばした放射のグラデーションで四方にぼかす
// 荒れを掛けると端が棒に見えるので、版の層に入れない
function kasumiMotion() {
  const id = "fd-art-kasumi-motion";
  const bands = [
    [-160, 180, 520],
    [540, 200, 560],
    [60, 246, 480],
    [680, 256, 520],
  ];
  return [
    open(),
    "<defs>",
    `<radialGradient id="${id}-edge">`,
    `<stop offset="0" stop-opacity="1"/>`,
    `<stop offset="0.55" stop-opacity="0.9"/>`,
    `<stop offset="1" stop-opacity="0"/>`,
    "</radialGradient>",
    `<mask id="${id}-mask" mask-type="alpha" maskContentUnits="objectBoundingBox">`,
    `<rect width="1" height="1" fill="url(#${id}-edge)"/>`,
    "</mask>",
    "</defs>",
    ...bands.map(
      ([x, y, w]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="34" fill="${PAPER}" mask="url(#${id}-mask)"/>`,
    ),
    "</svg>",
    "",
  ].join("\n");
}

// 青海波: 同心の弧の段を重ね、下の段ほど濃くする。密なので低い帯でも幅を埋める
function seigaiha() {
  const id = "fd-art-seigaiha";
  const R = 36;
  const step = R * 0.5;
  const rows = Math.ceil(H / step) + 2;
  const inner = [];
  for (let j = 0; j < rows; j++) {
    const y = j * step;
    const opacity = n((0.15 + 0.45 * (j / rows)) * 100) / 100;
    const off = j % 2 ? R : 0;
    const units = [];
    for (let x = -R + off; x <= W + R; x += R * 2) {
      const arcs = [1, 0.75, 0.5, 0.25]
        .map((k) => `M${n(x - R * k)} ${y}A${R * k} ${R * k} 0 0 1 ${n(x + R * k)} ${y}`)
        .join("");
      units.push(`<path d="M${x - R} ${y}A${R} ${R} 0 0 1 ${x + R} ${y}Z" fill="${PAPER}"/>`);
      units.push(`<path d="${arcs}" fill="none"/>`);
    }
    inner.push(
      `<g stroke="${INK}" stroke-opacity="${opacity}" stroke-width="2.4">`,
      ...units,
      "</g>",
    );
  }
  return plate(id, inner, { rough: 3, mistTop: 0.2 });
}

function clump(cx, cy, rad) {
  const ds = [];
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + (i / 25) * Math.PI;
    ds.push(
      `M${cx} ${n(cy + rad * 0.15)}L${n(cx + Math.cos(a) * rad)} ${n(cy + Math.sin(a) * rad * 0.45)}`,
    );
  }
  return [
    `<path d="${ds.join("")}" stroke="${INK}" stroke-width="2.2" fill="none"/>`,
    `<ellipse cx="${cx}" cy="${n(cy + rad * 0.12)}" rx="${rad}" ry="${n(rad * 0.18)}" fill="${INK}"/>`,
  ];
}

// 月と松: 空の一文字ぼかしと遠い稜線、右下から入る松の枝。月は動きの層（moon-pine-motion.svg）が持つ
// 月は題の文字に重ねないよう、霞の掛からない右寄りに置き、松の枝は月の下を通す
function moonPine() {
  const id = "fd-art-moon-pine";
  const r = rng(5);
  const trunk = "M1240 430C1170 380 1120 340 1060 312C990 280 900 268 780 262";
  const branch = "M1090 326C1030 352 960 356 890 348M960 284C940 250 900 236 850 232";
  const clumps = [
    [790, 256, 64],
    [880, 236, 54],
    [850, 222, 50],
    [930, 340, 60],
    [1010, 290, 62],
    [1110, 312, 66],
    [720, 270, 42],
  ].flatMap(([x, y, s]) => clump(n(x + (r() - 0.5) * 10), y, s));
  const sky = [skyMask(id, 260), ichimonji(id, 260, "mid")];
  const inner = [
    ...layer(
      ridgePath(r, 360, [
        [16, 640],
        [6, 140],
      ]),
      "far",
    ),
    `<g ${tone("near")}>`,
    `<path d="${trunk}" stroke="${INK}" stroke-width="22" fill="none" stroke-linecap="round"/>`,
    `<path d="${branch}" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>`,
    ...clumps,
    "</g>",
  ];
  return plate(id, inner, { rough: 4, mistTop: 0.6 }, sky);
}

// 月: 地の色で空を抜き、その上に --fd-art-moon の濃さの墨を重ねる。ライトでは紙の白、ダークでは明るい月になる
function moonPineMotion() {
  return [
    open(),
    `<circle cx="900" cy="118" r="52" fill="${PAPER}"/>`,
    `<circle cx="900" cy="118" r="52" fill="${INK}" ${tone("moon")}/>`,
    "</svg>",
    "",
  ].join("\n");
}

const files = {
  "kasumi.svg": kasumi(),
  "kasumi-motion.svg": kasumiMotion(),
  "seigaiha.svg": seigaiha(),
  "moon-pine.svg": moonPine(),
  "moon-pine-motion.svg": moonPineMotion(),
};

const check = process.argv.includes("--check");
let stale = 0;
for (const [name, content] of Object.entries(files)) {
  const path = join(OUT, name);
  const shown = relative(ROOT, path);
  if (!check) {
    writeFileSync(path, content);
    console.log(shown);
  } else if (!existsSync(path)) {
    console.error(`${shown} がない。--check を外して作る`);
    stale++;
  } else if (readFileSync(path, "utf8") !== content) {
    console.error(`${shown} が生成器と食い違う。--check を外して作り直し、一緒にコミットする`);
    stale++;
  }
}
if (stale) process.exit(1);

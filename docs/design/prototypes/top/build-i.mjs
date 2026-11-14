// 使い方: node docs/design/prototypes/top/build-i.mjs（リポジトリの直下で流す）
// 門をくぐって立体の庭のプロフィールへ入る形の試作 i-mon.html と、場面のバンドル vendor/i-scene.bundle.js を書く。
// 試作では URL の引数で上書きできる。
//   ?visit=first|garden|html（最初の訪問、2 回目に庭を出す形、2 回目にふつうの HTML を出す形）
// 署名は src/sign.svg を読む。自筆の署名に替えるときは、このファイルを、同じ形（viewBox と、輪郭を塗った path を 1 本）の SVG に差し替える。線（stroke）で描いた SVG は出ない。
// 今の src/sign.svg は、書体 Great Vibes（SIL Open Font License 1.1）の輪郭を src/sign-path.py で取り出したものである。
//   ?season=spring|summer|autumn|winter  ?time=morning|day|evening|night  ?sign=0（署名を出さない）
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brush, render } from "./src/h-strokes.mjs";
import { DESIGN, GATE, GATE_Z, WALL, STEPS, STEP_R, MOUNTAINS, STATIONS, project } from "./src/i-layout.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../..");
const shared = readFileSync(join(here, "src", "shared.css"), "utf8");
const tokens = shared.slice(0, shared.indexOf("* { box-sizing"));
const logo = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="15" cy="9" r="3.5" fill="currentColor"/><path d="M4 19Q9 12 13 16T20 15V20H4Z" fill="currentColor"/></svg>';

// 墨の絵。山並み、塀、門、飛び石、石、松の順に描く。門と塀と飛び石は、立体の配置を最初のカメラで投影した位置に置く。
function inkArt() {
  const B = brush(7);
  const P = (x, y, z) => project([x, y, z]);
  for (const m of MOUNTAINS) B.mountain(m.peaks, m.base, m.x0, m.x1, m.n, m.alpha, m.t0);

  [-1, 1].forEach((s, i) => {
    const a = P(s * WALL.x0, WALL.roofY, GATE_Z), b = P(s * WALL.x1, WALL.roofY, GATE_Z), g0 = P(s * WALL.x0, 0, GATE_Z);
    const end = s < 0 ? -60 : DESIGN.w + 60;
    B.add("mid", [[a[0], a[1]], [(a[0] + end) / 2, a[1] + 3], [end, b[1] - 2]], { w: 11, a: 0.8, dry: 0.55, t0: 700 + i * 160, dur: 520, tin: 0.04 });
    B.add("mid", [[a[0], a[1] + 14], [(a[0] + end) / 2, a[1] + 16], [end, a[1] + 13]], { w: 3, a: 0.45, dry: 0.7, t0: 820 + i * 160, dur: 460 });
    B.add("mid", [[g0[0] + s * 8, g0[1]], [(g0[0] + end) / 2, g0[1] + 4], [end, g0[1] + 1]], { w: 3, a: 0.4, dry: 0.85, t0: 980 + i * 140, dur: 480 });
    for (let k = 0; k < 4; k++) {
      const x = a[0] + s * (90 + k * 150);
      B.add("mid", [[x, a[1] + 22], [x + 2, (a[1] + g0[1]) / 2], [x - 1, g0[1] - 6]], { w: 2, a: 0.16, dry: 0.9, t0: 1050 + k * 50, dur: 260 });
    }
  });

  GATE.posts.forEach(([x, y, z, w, h], i) => {
    const top = P(x, y + h / 2, z), bot = P(x, 0, z);
    B.add("mid", [[bot[0], top[1]], [bot[0] + 2, (top[1] + bot[1]) / 2], [bot[0], bot[1]]], { w: w * top[2] * 0.9, a: 0.88, dry: 0.5, t0: 1180 + i * 190, dur: 430, tin: 0.03, tout: 0.2 });
  });
  GATE.beams.forEach(([x, y, z, w, h]) => {
    const a = P(x - w / 2, y, z), b = P(x + w / 2, y, z);
    B.add("mid", [[a[0], a[1]], [(a[0] + b[0]) / 2, a[1] - 2], [b[0], b[1]]], { w: h * a[2] * 0.9, a: 0.85, dry: 0.5, t0: 1620, dur: 380, tin: 0.04, tout: 0.2 });
  });
  // 屋根。棟、軒、両端の破風を太い線で囲み、間に瓦の線を引く。鳥居に見えないよう、屋根の面を台形に見せる。
  const rf = GATE.roof;
  const rl = P(-rf.halfW, rf.ridgeY + 0.08, GATE_Z), rr = P(rf.halfW, rf.ridgeY + 0.08, GATE_Z);
  const el = P(-rf.halfW, rf.eaveY, GATE_Z + rf.depth), er = P(rf.halfW, rf.eaveY, GATE_Z + rf.depth);
  B.add("mid", [[rl[0] - 8, rl[1] - 6], [rl[0] + 90, rl[1]], [(rl[0] + rr[0]) / 2, rl[1] + 1], [rr[0] - 90, rr[1]], [rr[0] + 8, rr[1] - 6]], { w: 20, a: 0.9, dry: 0.45, t0: 1900, dur: 480, tin: 0.05, tout: 0.2 });
  [[rl, el, -1], [rr, er, 1]].forEach(([r0, e0, s], i) => {
    B.add("mid", [[r0[0], r0[1]], [(r0[0] + e0[0]) / 2 + s * 3, (r0[1] + e0[1]) / 2], [e0[0] + s * 6, e0[1] + 4]], { w: 9, a: 0.85, dry: 0.5, t0: 2040 + i * 90, dur: 260 });
  });
  B.add("mid", [[el[0] - 10, el[1] - 4], [el[0] + 110, el[1] + 2], [(el[0] + er[0]) / 2, el[1] + 4], [er[0] - 110, er[1] + 2], [er[0] + 10, er[1] - 4]], { w: 13, a: 0.88, dry: 0.5, t0: 2220, dur: 500, tin: 0.05, tout: 0.2 });
  B.add("mid", [[el[0] + 20, el[1] + 16], [(el[0] + er[0]) / 2, el[1] + 18], [er[0] - 20, er[1] + 16]], { w: 3, a: 0.5, dry: 0.7, t0: 2330, dur: 420 });
  for (let k = 1; k < 22; k++) {
    const u = k / 22, x0 = rl[0] + (rr[0] - rl[0]) * u, x1 = el[0] + (er[0] - el[0]) * u;
    B.add("mid", [[x0, rl[1] + 10], [(x0 + x1) / 2, (rl[1] + el[1]) / 2 + 3], [x1, el[1] - 7]], { w: 2.6, a: 0.5, dry: 0.6, t0: 2360 + k * 14, dur: 150 });
  }
  // 内側へ開いた扉。
  [-1, 1].forEach((s, i) => {
    const d = GATE.door, n0 = P(s * d.x, d.h, GATE_Z - 0.08), f0 = P(s * d.x, d.h, GATE_Z - 0.08 - d.len), f1 = P(s * d.x, 0, GATE_Z - 0.08 - d.len), n1 = P(s * d.x, 0, GATE_Z - 0.08);
    B.add("mid", [[n0[0], n0[1]], [(n0[0] + f0[0]) / 2, (n0[1] + f0[1]) / 2], [f0[0], f0[1]]], { w: 3, a: 0.6, dry: 0.6, t0: 2520 + i * 70, dur: 200 });
    B.add("mid", [[f0[0], f0[1]], [f0[0], (f0[1] + f1[1]) / 2], [f1[0], f1[1]]], { w: 3.4, a: 0.6, dry: 0.6, t0: 2580 + i * 70, dur: 260 });
    [0.35, 0.7].forEach((u) => B.add("mid", [[n0[0], n0[1] + (n1[1] - n0[1]) * u], [(n0[0] + f0[0]) / 2, (n0[1] + f0[1]) / 2 + ((n1[1] + f1[1]) / 2 - (n0[1] + f0[1]) / 2) * u], [f0[0], f0[1] + (f1[1] - f0[1]) * u]], { w: 2, a: 0.35, dry: 0.75, t0: 2660 + i * 70, dur: 160 }));
  });

  STEPS.forEach(([x, z], i) => {
    const c = P(x, 0, z);
    if (c[1] > DESIGN.h + 40) return;
    const rx = STEP_R * c[2], ry = rx * Math.min(0.5, (1.55 * c[2]) / 1060) * 1.1, arc = [];
    for (let q = 0; q <= 14; q++) { const an = Math.PI * 2 * (q / 14) - 2.6; arc.push([c[0] + Math.cos(an) * rx, c[1] + Math.sin(an) * ry]); }
    B.add("mid", arc, { w: z > GATE_Z ? 4 : 2.4, a: z > GATE_Z ? 0.6 : 0.35, dry: 0.7, t0: 2480 + i * 60, dur: 260 });
  });
  B.stone(330, 729, 190, 112, 1350);
  B.stone(213, 731, 80, 42, 1560);

  B.add("near", [[1690, 520], [1612, 430], [1560, 330], [1522, 240], [1500, 150]], { w: 30, a: 0.8, dry: 0.5, t0: 2500, dur: 520, tin: 0.02 });
  B.add("near", [[1700, 500], [1626, 420], [1576, 322], [1538, 236]], { w: 9, a: 0.85, dry: 0.35, t0: 2620, dur: 460, tin: 0.02 });
  B.branch([[1508, 160], [1400, 104], [1262, 72], [1120, 70], [1000, 96]], 11, 2850, 480, 6, 50);
  B.branch([[1548, 322], [1470, 312], [1392, 328], [1330, 362]], 7, 3120, 380, 3, 44);
  const r = render(B.strokes);
  const pine = B.tints.map((t) => `<circle cx="${Math.round(t.x)}" cy="${Math.round(t.y)}" r="${Math.round(t.r)}"/>`).join("");
  return { ...r, pine, strokes: B.strokes.length };
}
const art = inkArt();

const esbuild = join(root, "node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/bin/esbuild");
const bundle = execFileSync(esbuild, [
  join(here, "src", "i-scene.js"), "--bundle", "--minify", "--format=iife",
  `--alias:three/addons=${join(here, "vendor/three/examples/jsm")}`, `--alias:three=${join(here, "vendor/three/build/three.module.js")}`, "--log-level=warning",
], { maxBuffer: 1 << 26 }).toString();
writeFileSync(join(here, "vendor", "i-scene.bundle.js"), bundle);

// 配る形のスクリプト。季節と時間帯を決め、庭を出すときだけ場面のバンドルを読み込む。
const prod = `(function(){var h=document.documentElement,d=new Date,t=d.getHours(),q=new URLSearchParams(location.search),v=q.get("visit"),seen=false;window.__born=performance.now();h.dataset.season=q.get("season")||["winter","spring","summer","autumn"][Math.floor((d.getMonth()+1)%12/3)];h.dataset.time=q.get("time")||(t<5?"night":t<10?"morning":t<16?"day":t<19?"evening":"night");try{seen=!!localStorage.getItem("fd-top-seen");localStorage.setItem("fd-top-seen","1")}catch(e){}if(v)seen=v!=="first";if(matchMedia("(prefers-reduced-motion: reduce)").matches||v==="html")return;h.classList.add("stage-on");if(!seen)h.classList.add("intro");if(q.get("sign")!=="0")h.classList.add("sign-on");var s=document.createElement("script");s.src="vendor/i-scene.bundle.js";s.defer=true;s.onerror=function(){h.classList.remove("stage-on","intro")};document.head.appendChild(s)})()`;

const css = `${tokens}
:root { --art-ink: var(--fd-color-text); --art-pine: var(--fd-primitive-color-green-700); }
@media (prefers-color-scheme: dark) { :root { --art-pine: var(--fd-primitive-color-green-300); } }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--fd-color-surface); color: var(--fd-color-text); font-family: var(--font-sans); font-size: 1rem; line-height: 1.7; overflow-x: hidden; }
a { color: var(--fd-color-link); }
:focus-visible { outline: 4px solid var(--fd-color-focus-outline); outline-offset: 4px; box-shadow: 0 0 0 4px var(--fd-color-focus-halo); }
.site-header { display: flex; align-items: baseline; gap: 2rem; flex-wrap: wrap; padding: 1rem 2rem; border-bottom: 1px solid var(--fd-color-border); }
.site-header .logo { color: var(--fd-color-text); }
.site-header .logo svg { display: block; }
.site-header ul { display: flex; gap: 1.5rem; list-style: none; margin: 0; padding: 0; }
.site-header nav a { color: var(--fd-color-text); text-decoration: none; padding: 0.5rem 0; display: inline-block; }
.site-header nav a[aria-current="page"] { color: var(--fd-color-current-page); border-bottom: 2px solid var(--fd-color-current-page); }
main { max-width: 44rem; margin: 0 auto; padding: 2.5rem 2rem 6rem; }
h1, h2 { font-family: var(--font-mincho); font-weight: 600; line-height: 1.5; margin: 0 0 0.5rem; }
h1 { font-size: 1.75rem; outline: none; }
h2 { font-size: 1.375rem; }
.fuda { padding: 2rem 0; border-top: 1px solid var(--fd-color-border); }
.fuda:first-child { border-top: 0; padding-top: 0; }
.fuda p { margin: 0 0 0.75rem; }
.fuda .lead { color: var(--fd-color-text-secondary); }
.fuda ul, .fuda dl { margin: 0; padding: 0; list-style: none; }
.fuda li { padding-block: 0.375rem; border-block-start: 1px solid var(--fd-color-border); display: flex; gap: 1rem; }
.fuda li time { flex: none; inline-size: 4.5rem; color: var(--fd-color-text-secondary); font-variant-numeric: tabular-nums; }
.fuda dt { font-size: 0.875rem; color: var(--fd-color-text-secondary); margin-block-start: 0.5rem; }
.fuda dd { margin: 0; }
.fuda .links { display: flex; gap: 1.5rem; }
.fuda .links li { border: 0; }

.stage, .garden-nav, .skip-intro { display: none; }
html.stage-on { overflow: hidden; }
html.stage-on .stage { display: block; position: fixed; inset: 0; z-index: 20; overflow: hidden; background: var(--fd-color-surface); container-type: size; }
.stage canvas.gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity 500ms linear; }
html.gl-on .stage canvas.gl { opacity: 1; }
.ink-svg { position: absolute; left: 50%; top: 50%; translate: -50% -50%; aspect-ratio: 16 / 9; width: 100cqw; display: none; pointer-events: none; overflow: visible; }
@container (max-aspect-ratio: 16 / 9) { .ink-svg { width: 177.78cqh; } }
@container (max-aspect-ratio: 1 / 1) { .ink-svg { width: 125cqw; } }
html.intro .ink-svg { display: block; }
.ink-svg path { fill: none; stroke: var(--art-ink); stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1 2; stroke-dashoffset: 0; }
.ink-svg .far { filter: url(#f-wash); }
.ink-svg .mid, .ink-svg .near .lines { filter: url(#f-dry); }
.ink-svg .pine { fill: url(#g-pine); opacity: 0.2; }
.ink-svg .near { transform-origin: 100% 0; transform-box: view-box; }
html.sign-on { --ink0: 600ms; }
html.intro .ink-svg path { transition: stroke-dashoffset var(--d) cubic-bezier(0.45, 0, 0.55, 1) calc(var(--t) + var(--ink0, 0ms)), opacity 60ms linear calc(var(--t) + var(--ink0, 0ms)); }
html.intro .ink-svg .pine { transition: opacity 700ms ease calc(2700ms + var(--ink0, 0ms)); }
@property --sign-w { syntax: "<percentage>"; inherits: false; initial-value: 135%; }
.sign { display: none; position: absolute; left: 5cqw; bottom: 4cqh; width: clamp(11rem, 24cqw, 24rem); height: auto; fill: var(--art-ink); rotate: -5deg; pointer-events: none; mask-image: linear-gradient(100deg, #000 calc(var(--sign-w) - 14%), transparent var(--sign-w)); }
html.intro.sign-on .sign { display: block; transition: --sign-w 1500ms cubic-bezier(0.45, 0, 0.4, 1) 150ms; }
@starting-style { html.intro.sign-on .sign { --sign-w: 0%; } }
html.enter.sign-on .sign { opacity: 0; transition: opacity 500ms linear 1150ms; }
@starting-style {
  html.intro .ink-svg path { stroke-dashoffset: 1.02; opacity: 0; }
  html.intro .ink-svg .pine { opacity: 0; }
}
html.enter .ink-svg .far, html.enter .ink-svg .mid { opacity: 0; transition: opacity 500ms linear 1150ms; }
html.enter .ink-svg .near { opacity: 0; transform: translate(14%, -20%) scale(1.8); transition: transform 1500ms cubic-bezier(0.5, 0, 0.9, 0.6) 1300ms, opacity 900ms linear 1800ms; }

.cards3d { position: absolute; inset: 0; }
html.stage-on .fuda { width: 25rem; max-width: none; padding: 0; border: 0; font-size: 1rem; line-height: 1.9; color: var(--scene-text); opacity: 0; transition: opacity 700ms ease; }
html.stage-on .fuda :is(h1, h2) { font-size: 1.5rem; padding-block-end: 0.625rem; margin-block-end: 1rem; border-block-end: 1px solid color-mix(in srgb, currentColor 35%, transparent); }
html.stage-on .fuda p { margin-block-end: 1rem; }
html.stage-on .fuda p:last-child { margin-block-end: 0; }
html.stage-on .fuda li { padding-block: 0.625rem; border-color: color-mix(in srgb, currentColor 25%, transparent); }
html.stage-on .fuda li:first-child { border-block-start: 0; padding-block-start: 0; }
html.stage-on .fuda :is(.lead, time, dt) { color: inherit; opacity: 0.8; }
html.stage-on .fuda a { color: var(--scene-link); }
html.stage-on .fuda.on-water { width: 24rem; font-size: 1.25rem; line-height: 1.7; color: #fcfbf8; font-weight: 500; text-shadow: 0 0 0.5em rgba(12, 24, 28, 0.9), 0 0 0.15em rgba(12, 24, 28, 0.9); }
html.stage-on .fuda.on-water dt { margin-block-start: 0.875rem; }
html.stage-on.cards-on .fuda.is-current { opacity: 1; }
html.stage-on .fuda:not(.is-current) { pointer-events: none !important; }
@media (max-width: 640px) { html.stage-on .fuda { width: 17.5rem; line-height: 1.8; } html.stage-on .fuda.on-water { width: 17.5rem; font-size: 1.125rem; } }
html.stage-on .site-header { position: fixed; inset: 0 0 auto 0; z-index: 30; border-bottom-color: transparent; opacity: 0; transition: opacity 600ms ease; }
html.garden .site-header { opacity: 1; }
html.garden .garden-nav { display: flex; position: fixed; z-index: 30; inset: auto 1.25rem 1.25rem 1.25rem; align-items: center; justify-content: center; pointer-events: none; }
.garden-nav > * { pointer-events: auto; }
.garden-nav .stops { display: flex; }
.garden-nav .tools { position: absolute; right: 0; bottom: 0; display: flex; gap: 1rem; }
.garden-nav button, .skip-intro { font: inherit; font-size: 0.875rem; padding: 0.5rem 1.125rem; cursor: pointer; color: var(--fd-color-text); background: var(--fd-color-surface); border: 1px solid var(--fd-color-border-field); }
.garden-nav .stops button + button { margin-inline-start: -1px; }
.garden-nav .stops button[aria-current="true"] { position: relative; color: var(--fd-color-surface); background: var(--fd-color-text); border-color: var(--fd-color-text); }
.garden-nav .tools button { padding: 0.5rem 0.25rem; border: 0; background: none; text-decoration: underline; text-underline-offset: 0.25em; color: var(--scene-ui, var(--fd-color-text)); }
.garden-nav .tools button[aria-pressed="true"] { text-decoration-thickness: 2px; font-weight: 700; }
@media (max-width: 900px) { html.garden .garden-nav { flex-direction: column; gap: 0.25rem; bottom: 0.75rem; } .garden-nav .tools { position: static; } .garden-nav button { padding-inline: 0.875rem; } }
html.intro .skip-intro { display: block; position: fixed; z-index: 30; right: 1.25rem; bottom: 1.25rem; }
html.no-anim .stage *, html.no-anim .fuda { transition: none !important; }
`;

const stationButtons = STATIONS.map((s) => `<button type="button" data-station="${s.id}">${s.label}</button>`).join("");
const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fukuemon.dev</title>
<script>${prod}</script>
<style>${css}</style>
</head>
<body>
<header class="site-header">
  <a class="logo" href="./i-mon.html" aria-label="fukuemon.dev のトップ">${logo}</a>
  <nav aria-label="サイトの中の移動">
    <ul>
      <li><a href="#articles">記事</a></li>
      <li><a href="#hands-on">ハンズオン</a></li>
      <li><a href="./i-mon.html" aria-current="page">筆者について</a></li>
    </ul>
  </nav>
</header>
<main id="main">
  <section class="fuda" aria-labelledby="f-nanori">
    <h1 id="f-nanori" tabindex="-1">筆者について</h1>
    <p class="lead">名乗りの見本。色と版面は ADR-0024 のまま。</p>
    <p>自己紹介の本文の見本。どんな仕事をしていて、このサイトに何を書いているかを、数行で書く。</p>
    <p>関心のある技術と、記事とハンズオンの使い分けを書く。</p>
  </section>
  <section class="fuda" aria-labelledby="f-keireki">
    <h2 id="f-keireki">経歴</h2>
    <ul>
      <li><time>2018</time><span>経歴の見本の 1 行目。所属と役割を書く。</span></li>
      <li><time>2021</time><span>経歴の見本の 2 行目。担当した領域を書く。</span></li>
      <li><time>2024</time><span>経歴の見本の 3 行目。今の仕事を書く。</span></li>
    </ul>
  </section>
  <section class="fuda" aria-labelledby="f-gijutsu">
    <h2 id="f-gijutsu">技術スタック</h2>
    <dl>
      <dt>言語</dt><dd>見本: TypeScript、Go、Rust</dd>
      <dt>フロントエンド</dt><dd>見本: Astro、React、Tailwind CSS</dd>
      <dt>基盤</dt><dd>見本: Cloudflare Workers、Terraform</dd>
    </dl>
  </section>
  <section class="fuda" aria-labelledby="f-yomimono">
    <h2 id="f-yomimono">読み物</h2>
    <p>記事とハンズオンへの入口の見本。</p>
    <ul class="links">
      <li><a href="#articles">記事を読む</a></li>
      <li><a href="#hands-on">ハンズオンを試す</a></li>
    </ul>
  </section>
</main>
<div class="stage">
  <canvas class="gl" aria-hidden="true"></canvas>
  ${readFileSync(join(here, "src", "sign.svg"), "utf8").trim().replace("<svg ", '<svg class="sign" aria-hidden="true" focusable="false" ')}
  <svg class="ink-svg" viewBox="0 0 ${DESIGN.w} ${DESIGN.h}" aria-hidden="true" focusable="false">
    <defs>
      <filter id="f-dry" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.9" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.4 2.9" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <filter id="f-wash" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <radialGradient id="g-pine"><stop offset="0" stop-color="var(--art-pine)"/><stop offset="1" stop-color="var(--art-pine)" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="far">${art.layers.far.join("")}</g>
    <g class="mid">${art.layers.mid.join("")}</g>
    <g class="near"><g class="pine">${art.pine}</g><g class="lines">${art.layers.near.join("")}</g></g>
  </svg>
</div>
<nav class="garden-nav" aria-label="庭の中の移動">
  <div class="stops">${stationButtons}</div>
  <div class="tools">
    <button type="button" class="pause" aria-pressed="false">動きを止める</button>
    <button type="button" class="plain">文だけで読む</button>
  </div>
</nav>
<button class="skip-intro" type="button">飛ばす</button>
</body>
</html>
`;
writeFileSync(join(here, "i-mon.html"), html);
const svg = html.slice(html.indexOf('<svg class="ink-svg"'), html.indexOf("</svg>", html.indexOf('<svg class="ink-svg"')) + 6);
const own = readFileSync(join(here, "src", "i-scene.js"), "utf8") + readFileSync(join(here, "src", "i-layout.mjs"), "utf8");
const gz = (s) => gzipSync(s).length;
console.log(JSON.stringify({
  strokes: art.strokes, paths: art.paths, html: Buffer.byteLength(html), htmlGz: gz(html), svg: Buffer.byteLength(svg), svgGz: gz(svg),
  css: Buffer.byteLength(css), headScript: Buffer.byteLength(prod), bundle: Buffer.byteLength(bundle), bundleGz: gz(bundle), ownJs: Buffer.byteLength(own),
}));

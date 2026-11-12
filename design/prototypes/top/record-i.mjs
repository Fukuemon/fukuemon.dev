// 使い方: node design/prototypes/top/build-i.mjs の後に、node design/prototypes/top/record-i.mjs [video] [still] [measure]（リポジトリの直下で流す）
// 門をくぐって庭へ入る形（i-mon.html）を録画し、コマの一覧と静止画の一覧を作り、LCP、FPS、設定ごとの状態を測る。
// 結果の数値は checks/2026-11-12-i-mon-measure.json に書く。
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(join(here, "../../../package.json"))("playwright");
const url = (q) => `file://${join(here, "i-mon.html")}?${q}`;
const gpu = ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const want = (k) => process.argv.length < 3 || process.argv.includes(k);
const wide = { width: 1440, height: 900 }, phone = { width: 390, height: 844 };
mkdirSync(join(here, "webm"), { recursive: true });
mkdirSync(join(here, "shots"), { recursive: true });
const browser = await chromium.launch({ args: gpu });
const fail = (label) => (e) => { console.error(label, e.message || e); process.exitCode = 1; };

if (want("video")) {
  const runs = [
    { name: "autumn-day", q: "visit=first&season=autumn&time=day", scheme: "light", size: wide, tour: true, sheet: true },
    { name: "winter-night-dark", q: "visit=first&season=winter&time=night", scheme: "dark", size: wide },
    { name: "spring-morning-390", q: "visit=first&season=spring&time=morning", scheme: "light", size: phone, sheet: true },
    { name: "summer-evening-second", q: "visit=garden&season=summer&time=evening", scheme: "light", size: wide, tour: true, short: true },
  ];
  for (const r of runs) {
    const context = await browser.newContext({ viewport: r.size, colorScheme: r.scheme, recordVideo: { dir: join(here, "webm"), size: r.size } });
    const page = await context.newPage();
    page.on("pageerror", fail(r.name));
    await page.goto(url(r.q));
    await page.waitForTimeout(r.short ? 2500 : 9900);
    if (r.tour) for (let i = 0; i < 3; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(2300); }
    const video = await page.video().path();
    await context.close();
    const mp4 = join(here, `2026-11-12-i-mon-${r.name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-movflags", "+faststart", "-an", mp4]);
    if (r.sheet) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-t", "10", "-i", mp4, "-vf", `fps=2,scale=${r.size.width < 600 ? 200 : 480}:-1,tile=${r.size.width < 600 ? "10x2" : "5x4"}`, "-frames:v", "1", join(here, "frames", `i-mon-${r.name}-sheet.png`)]);
    rmSync(video);
    console.log("録画", r.name);
  }
}

// 静止画を撮り、名前を添えて 1 枚の一覧にする。
async function sheet(file, cols, items) {
  const shots = [];
  for (const it of items) {
    const page = await browser.newPage({ viewport: it.size || wide, colorScheme: it.scheme || "light", reducedMotion: it.reduce ? "reduce" : "no-preference", javaScriptEnabled: it.nojs ? false : true });
    page.on("pageerror", fail(it.label));
    await page.goto(url(it.q));
    await page.waitForTimeout(it.wait || 1800);
    for (let i = 0; i < (it.right || 0); i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(1900); }
    const p = join(here, "shots", `i-${file}-${shots.length}.png`);
    await page.screenshot({ path: p });
    shots.push({ p, label: it.label, w: (it.size || wide).width });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: cols * 500 + 20, height: 400 } });
  const sheetHtml = join(here, "shots", `i-${file}-sheet.html`);
  writeFileSync(sheetHtml, `<!doctype html><body style="margin:10px;font:14px sans-serif;background:#fff;display:grid;grid-template-columns:repeat(${cols},490px);gap:10px;align-items:end">${shots.map((s) => `<figure style="margin:0;text-align:center"><img src="file://${s.p}" style="${s.w < 600 ? "height:300px" : "width:490px"};display:block;margin:0 auto;border:1px solid #ccc"><figcaption>${s.label}</figcaption></figure>`).join("")}</body>`);
  await page.goto(`file://${sheetHtml}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(here, "checks", `2026-11-12-i-mon-${file}.png`), fullPage: true });
  await page.close();
  shots.forEach((s) => rmSync(s.p));
  rmSync(sheetHtml);
  console.log("一覧", file);
}
if (want("still")) {
  await sheet("seasons", 4, ["spring", "summer", "autumn", "winter"].flatMap((s) => [{ label: `${s}・昼`, q: `visit=garden&season=${s}&time=day` }]).concat(
    [{ label: "summer・夜（蛍）", q: "visit=garden&season=summer&time=night" }, { label: "winter・夜・ダーク", q: "visit=garden&season=winter&time=night", scheme: "dark" }, { label: "spring・朝・幅 390px", q: "visit=garden&season=spring&time=morning", size: phone }, { label: "autumn・夕・幅 390px", q: "visit=garden&season=autumn&time=evening", size: phone }]));
  await sheet("times", 4, ["morning", "day", "evening", "night"].flatMap((t) => [{ label: `autumn・${t}・ライト`, q: `visit=garden&season=autumn&time=${t}` }]).concat(
    ["morning", "day", "evening", "night"].map((t) => ({ label: `autumn・${t}・ダーク`, q: `visit=garden&season=autumn&time=${t}`, scheme: "dark" }))));
  await sheet("stations", 4, [0, 1, 2, 3].map((i) => ({ label: ["松の枝の和紙に名乗り", "もみじの枝の和紙に経歴", "池のほとりの松の枝の和紙に技術", "灯籠のそばの和紙に読み物"][i], q: "visit=garden&season=autumn&time=day", right: i })));
  await sheet("stations-390-dark", 4, [0, 1, 2, 3].map((i) => ({ label: `文 ${i + 1}・幅 390px`, q: "visit=garden&season=autumn&time=day", right: i, size: phone })).concat([0, 1, 2, 3].map((i) => ({ label: `文 ${i + 1}・夜・ダーク`, q: "visit=garden&season=autumn&time=night", right: i, scheme: "dark" }))));
  await sheet("intro", 4, [
    { label: "署名（1.2 秒）", q: "visit=first&season=autumn&time=day", wait: 1200 },
    { label: "墨の絵（3.4 秒）ライト", q: "visit=first&season=autumn&time=day", wait: 3400 },
    { label: "色が差す（4.7 秒）", q: "visit=first&season=autumn&time=day", wait: 4700 },
    { label: "門をくぐる（6.1 秒）", q: "visit=first&season=autumn&time=day", wait: 6100 },
    { label: "和紙の前（9.2 秒）", q: "visit=first&season=autumn&time=day", wait: 9200 },
    { label: "署名なし（3.0 秒、sign=0）", q: "visit=first&season=autumn&time=day&sign=0", wait: 3000 },
    { label: "墨の絵（3.4 秒）ダーク", q: "visit=first&season=autumn&time=night", wait: 3400, scheme: "dark" },
        { label: "墨の絵（3.4 秒）幅 390px", q: "visit=first&season=autumn&time=day", wait: 3400, size: phone },
    { label: "門をくぐる（6.1 秒）幅 390px", q: "visit=first&season=autumn&time=day", wait: 6100, size: phone },
  ]);
  await sheet("fallback", 3, [
    { label: "動きを減らす設定", q: "visit=first&season=autumn&time=day", reduce: true },
    { label: "JavaScript が動かない", q: "visit=first&season=autumn&time=day", nojs: true },
    { label: "2 回目にふつうの HTML を出す形", q: "visit=html&season=autumn&time=day" },
  ]);
}

if (want("measure")) {
  const out = {};
  const lcpInit = () => {
    window.__lcp = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), tag: e.element ? e.element.tagName : "", text: e.element ? e.element.textContent.trim().slice(0, 12) : "" });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  };
  const read = (page) => page.evaluate(() => ({
    lcp: window.__lcp, marks: window.__marks, stats: window.__garden ? window.__garden.stats() : null, cls: document.documentElement.className,
    h1: document.querySelector("h1").textContent, h1Opacity: getComputedStyle(document.querySelector("h1").closest(".fuda")).opacity,
  }));
  for (const [label, q, rate] of [["最初の訪問", "visit=first&season=autumn&time=day", 1], ["最初の訪問・CPU 4 倍遅く", "visit=first&season=autumn&time=day", 4], ["2 回目に庭", "visit=garden&season=autumn&time=day", 1], ["2 回目に庭・CPU 4 倍遅く", "visit=garden&season=autumn&time=day", 4], ["ふつうの HTML", "visit=html&season=autumn&time=day", 1]]) {
    const page = await browser.newPage({ viewport: wide });
    page.on("pageerror", fail(label));
    if (rate > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate });
    await page.addInitScript(lcpInit);
    await page.goto(url(q));
    if (q.includes("first")) {
      await page.waitForFunction(() => window.__marks && window.__marks.enter, null, { timeout: 30000 });
      await page.evaluate(() => window.__garden.resetPerf());
      await page.waitForFunction(() => window.__marks.done, null, { timeout: 30000 });
    } else await page.waitForTimeout(3000);
    out[label] = await read(page);
    await page.close();
  }
  {
    // 途中の Tab、飛ばすボタン、札へのフォーカス、「文だけで読む」を確かめる。
    const page = await browser.newPage({ viewport: wide });
    page.on("pageerror", fail("操作"));
    await page.goto(url("visit=first&season=autumn&time=day"));
    await page.waitForTimeout(1500);
    const tree = await page.locator("body").ariaSnapshot();
    out["イントロの間のアクセシビリティツリーに h1 があるか"] = /heading "筆者について" \[level=1\]/.test(tree);
    await page.click(".skip-intro");
    await page.waitForTimeout(400);
    out["1.5 秒で「飛ばす」"] = await page.evaluate(() => ({ cls: document.documentElement.className, focus: document.activeElement.textContent.trim(), h1Opacity: getComputedStyle(document.querySelector(".fuda")).opacity }));
    await page.locator(".fuda a").first().focus();
    await page.waitForTimeout(1800);
    out["札の中のリンクにフォーカスした後の札の番号（0 始まり）"] = await page.evaluate(() => window.__garden.station());
    out["庭のアクセシビリティツリー"] = (await page.locator("body").ariaSnapshot()).split("\n").filter((l) => /heading|navigation|button|link/.test(l)).map((l) => l.trim());
    await page.click(".garden-nav .plain");
    await page.waitForTimeout(300);
    out["「文だけで読む」の後"] = await page.evaluate(() => ({ cls: document.documentElement.className, focus: document.activeElement.tagName, cards: [...document.querySelectorAll("main .fuda")].length, styled: [...document.querySelectorAll("main .fuda")].filter((e) => e.getAttribute("style")).length }));
    await page.close();
  }
  for (const [label, opt] of [["動きを減らす設定", { reducedMotion: "reduce" }], ["JavaScript が動かない", { javaScriptEnabled: false }]]) {
    const page = await browser.newPage({ viewport: wide, ...opt });
    await page.goto(url("visit=first&season=autumn&time=day"));
    await page.waitForTimeout(600);
    out[label] = { cls: await page.locator("html").getAttribute("class"), stage: await page.locator(".stage").evaluate((e) => getComputedStyle(e).display), cards: await page.locator("main .fuda").count(), h1Visible: await page.locator("h1").isVisible() };
    await page.close();
  }
  {
    const b = await chromium.launch({ args: ["--disable-3d-apis"] });
    const page = await b.newPage({ viewport: wide });
    await page.goto(url("visit=first&season=autumn&time=day"));
    await page.waitForTimeout(2500);
    out["WebGL が使えない"] = { cls: await page.locator("html").getAttribute("class"), stage: await page.locator(".stage").evaluate((e) => getComputedStyle(e).display), h1Visible: await page.locator("h1").isVisible() };
    await b.close();
  }
  writeFileSync(join(here, "checks", "2026-11-12-i-mon-measure.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
}
await browser.close();

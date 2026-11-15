#!/usr/bin/env node
// トップの最初の訪問のイントロを、CPU を遅くして Chrome の trace に撮り、区間ごとの最長タスクとコマ落ちを出す。
// ビルドした apps/web/dist/ を配るので、pnpm run build の後に、リポジトリの直下で流す。
//
//   node scripts/measure-top-intro.mjs [--runs 5] [--cpu 4] [--bundle-delay 0] [--dist apps/web/dist] [--out intro-results]
//
// CPU の遅さは、renderer のメインスレッドだけに掛かる。ラスタと GPU の処理には掛からないので、墨の線の filter を描き直す時間は、遅い端末より少なく出る。
// --bundle-delay は、場面のバンドル（garden-entry）の応答を遅らせる ms である。場面の組み立てが、墨の線を描く遷移（イントロから 600〜5600 ms）と重なる条件を作る。
// 区間は、html に class intro が付いた時刻を 0 として測る。
//   ink: 墨の線を描く区間（600〜5600 ms）
//   assemble: イントロから scene-ready まで（場面の組み立て）
//   enter: 色が差してから garden-ready まで
// longestTaskMs は、区間と重なる renderer のメインスレッドの RunTask の最長である。
// dropped は、trace の PipelineReporter の state が STATE_DROPPED のフレームの数である。frames は、その区間で始まったフレームの数である。
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const { values: opt } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    cpu: { type: "string", default: "4" },
    "bundle-delay": { type: "string", default: "0" },
    dist: { type: "string", default: "apps/web/dist" },
    out: { type: "string", default: "intro-results" },
  },
});
const runs = Number(opt.runs);
const cpu = Number(opt.cpu);
const bundleDelay = Number(opt["bundle-delay"]);
const DIST = resolve(opt.dist);
if (
  ![runs, cpu, bundleDelay].every((n) => Number.isFinite(n) && n >= 0) ||
  runs < 1 ||
  cpu < 1 ||
  !Number.isInteger(runs)
) {
  console.error("--runs は 1 以上の整数、--cpu は 1 以上、--bundle-delay は 0 以上の数にする");
  process.exit(2);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
const GZIP = new Set([".html", ".js", ".css", ".svg", ".json"]);
/** 圧縮の時間を応答の時刻に入れないよう、パスごとに 1 回だけ読んで圧縮する */
const cache = new Map();
/** 遅らせた応答の数。--bundle-delay が掛かったかの確認に使う */
let delayedResponses = 0;
const server = createServer((req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const file = resolve(DIST, `.${path.endsWith("/") ? `${path}index.html` : path}`);
    if (!file.startsWith(DIST + sep) || !statSync(file).isFile()) throw new Error("not found");
    const ext = extname(file);
    const head = {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    };
    let body = cache.get(file);
    if (!body) {
      body = readFileSync(file);
      if (GZIP.has(ext)) body = gzipSync(body);
      cache.set(file, body);
    }
    if (GZIP.has(ext)) head["content-encoding"] = "gzip";
    const delayed = path.includes("garden-entry");
    if (delayed) delayedResponses++;
    setTimeout(() => res.writeHead(200, head).end(body), delayed ? bundleDelay : 0);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
if (!existsSync(join(DIST, "index.html"))) {
  console.error(`${DIST}/index.html が無い。pnpm run build の後に流す`);
  process.exit(2);
}
if (!existsSync(chromium.executablePath())) {
  console.error("Playwright の Chromium が無い。pnpm exec playwright install chromium で入れる");
  process.exit(2);
}
mkdirSync(opt.out, { recursive: true });

const CATEGORIES = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "cc",
  "benchmark",
  "toplevel",
  "blink.user_timing",
];
const CLASSES = ["stage-on", "intro", "scene-ready", "enter", "garden-ready"];

/** trace の JSON から、区間ごとの最長タスクとコマ落ちを出す */
function analyze(text) {
  const events = JSON.parse(text).traceEvents;
  const marks = {};
  let main;
  for (const e of events) {
    if (e.name?.startsWith("cls:") && marks[e.name.slice(4)] === undefined) {
      marks[e.name.slice(4)] = e.ts;
      main = { pid: e.pid, tid: e.tid };
    }
  }
  const missing = CLASSES.filter((c) => marks[c] === undefined);
  if (!main || missing.length > 0)
    throw new Error(`イントロの class の時刻が trace に無い: ${missing.join(", ")}`);
  const base = marks.intro;
  const rel = (ts) => (ts - base) / 1000;
  const tasks = events
    .filter((e) => e.name === "RunTask" && e.ph === "X" && e.pid === main.pid && e.tid === main.tid)
    .map((e) => ({ start: rel(e.ts), end: rel(e.ts + e.dur), dur: e.dur / 1000 }));
  const frames = events
    .filter(
      (e) =>
        e.name === "PipelineReporter" &&
        e.ph === "b" &&
        e.args?.frame_reporter?.frame_type === "FORKED" &&
        e.ts >= base,
    )
    .map((e) => ({ start: rel(e.ts), state: e.args.frame_reporter.state }));
  const windows = {
    ink: [600, 5600],
    assemble: [0, rel(marks["scene-ready"])],
    enter: [rel(marks.enter), rel(marks["garden-ready"])],
  };
  const row = {
    marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, Math.round(rel(v))])),
  };
  for (const [name, [from, to]] of Object.entries(windows)) {
    const inside = tasks.filter((t) => t.end > from && t.start < to);
    const fs = frames.filter((f) => f.start >= from && f.start < to);
    row[name] = {
      longestTaskMs: Math.round(inside.reduce((max, t) => Math.max(max, t.dur), 0)),
      tasksOver50ms: inside.filter((t) => t.dur > 50).length,
      frames: fs.length,
      dropped: fs.filter((f) => f.state === "STATE_DROPPED").length,
    };
  }
  return row;
}

const median = (xs) => {
  const s = [...xs].toSorted((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rows = [];
try {
  for (let i = 0; i < runs; i++) {
    const profile = mkdtempSync(join(tmpdir(), "measure-intro-"));
    const context = await chromium.launchPersistentContext(profile, {
      args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 1.75,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
      await page.addInitScript((classes) => {
        const seen = new Set();
        const note = () => {
          for (const c of classes) {
            if (document.documentElement.classList.contains(c) && !seen.has(c)) {
              seen.add(c);
              performance.mark(`cls:${c}`);
            }
          }
        };
        new MutationObserver(note).observe(document, {
          subtree: true,
          attributes: true,
          attributeFilter: ["class"],
        });
      }, CLASSES);
      await cdp.send("Tracing.start", {
        traceConfig: { includedCategories: CATEGORIES, recordMode: "recordAsMuchAsPossible" },
        transferMode: "ReturnAsStream",
      });
      const complete = new Promise((ok) => cdp.once("Tracing.tracingComplete", ok));
      await page.goto(`${origin}/`, { waitUntil: "commit" });
      // 庭がふつうのページに戻った回（stage-on が外れた）は、待たずに失敗にする。判定は 250 ms ごとにして、測るメインスレッドに毎フレーム入れない。
      const outcome = await page.waitForFunction(
        () => {
          const c = document.documentElement.classList;
          if (c.contains("garden-ready")) return "ready";
          return performance.now() > 1000 && !c.contains("stage-on") ? "plain" : false;
        },
        null,
        { timeout: 120_000, polling: 250 },
      );
      if ((await outcome.jsonValue()) === "plain") throw new Error("庭がふつうのページに戻った");
      await page.waitForTimeout(1000);
      await cdp.send("Tracing.end");
      const { stream } = await complete;
      let text = "";
      for (;;) {
        const { data, eof } = await cdp.send("IO.read", { handle: stream });
        text += data;
        if (eof) break;
      }
      const row = { run: i, ...analyze(text) };
      if (bundleDelay > 0 && delayedResponses === 0)
        throw new Error("場面のバンドルの応答が無く、--bundle-delay が掛かっていない");
      rows.push(row);
      console.log(JSON.stringify(row));
    } finally {
      await context.close();
      rmSync(profile, { recursive: true, force: true });
    }
  }
} finally {
  server.close();
}

const summary = { conditions: { runs, cpu, bundleDelay }, median: {}, rows };
for (const w of ["ink", "assemble", "enter"]) {
  summary.median[w] = Object.fromEntries(
    ["longestTaskMs", "tasksOver50ms", "frames", "dropped"].map((k) => [
      k,
      median(rows.map((r) => r[w][k])),
    ]),
  );
}
const file = join(
  opt.out,
  `${new Date().toISOString().replace(/[:.]/g, "-")}-cpu${cpu}-delay${bundleDelay}.json`,
);
writeFileSync(file, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ file, median: summary.median }));

#!/usr/bin/env node
// トップを Lighthouse で測る。既定は、2 回目以降の訪問（localStorage に fd-top-seen がある状態）で 5 回測り、中央値を出す。
// ビルドした apps/web/dist/ を配るので、pnpm run build の後に、リポジトリの直下で流す。
//
//   node scripts/measure-top-lighthouse.mjs [--visit second|first|plain] [--runs 5] [--gpu metal|swiftshader] [--throttling simulate|devtools] [--out lighthouse-results]
//
// 条件は、Lighthouse の既定の mobile（Moto G Power の画面と、Slow 4G と CPU 4 倍の遅さ）である。
// 既定の --throttling simulate は、絞らずに読み込んだ記録から遅い端末の値を推定する。devtools は、絞った通信と CPU の上で読み込む。
// 実行ごとに新しいプロファイルで Chrome を起動し、前の実行のシェーダとディスクのキャッシュを持ち越さない。
// 配信は Cache-Control: no-store にする。fd-top-seen を残すために Lighthouse のストレージの消去を止めるので、代わりに HTTP のキャッシュを使わせない。
// 文字のファイルは gzip で送る。本番の配信が圧縮して返すためである。
// 配信は TLS の無い HTTP/1.1 である。本番の配信の HTTP/2 と Brotli とは、通信の値が違う。
// 庭の最初の 1 枚が、ページの最初の描画に入った回は、LCP が FCP と同じ値になる。その回は lcpIsFcp を true にする。
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { loadavg, tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";
import { gzipSync } from "node:zlib";

const LIGHTHOUSE = "lighthouse@13.6.0";
const DIST = resolve("apps/web/dist");
const SEED = "/__seed-top-seen";

const { values: opt } = parseArgs({
  options: {
    visit: { type: "string", default: "second" },
    runs: { type: "string", default: "5" },
    gpu: { type: "string", default: "metal" },
    throttling: { type: "string", default: "simulate" },
    out: { type: "string", default: "lighthouse-results" },
  },
});
if (!["second", "first", "plain"].includes(opt.visit))
  throw new Error(`--visit が不正: ${opt.visit}`);
if (!["metal", "swiftshader"].includes(opt.gpu)) throw new Error(`--gpu が不正: ${opt.gpu}`);
if (!["simulate", "devtools"].includes(opt.throttling))
  throw new Error(`--throttling が不正: ${opt.throttling}`);
const runs = Number(opt.runs);
if (!Number.isInteger(runs) || runs < 1) throw new Error(`--runs が不正: ${opt.runs}`);
statSync(join(DIST, "index.html"));

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  if (path === SEED) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(`<script>localStorage.setItem("fd-top-seen","1")</script>`);
    return;
  }
  const file = resolve(DIST, `.${path.endsWith("/") ? `${path}index.html` : path}`);
  try {
    if (!file.startsWith(DIST + sep) || !statSync(file).isFile()) throw new Error("not found");
    const type = types[extname(file)] ?? "application/octet-stream";
    const head = { "content-type": type, "cache-control": "no-store" };
    let body = readFileSync(file);
    if (!type.startsWith("font/")) {
      body = gzipSync(body);
      head["content-encoding"] = "gzip";
    }
    res.writeHead(200, head).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://localhost:${server.address().port}`;

const { chromium } = createRequire(resolve("package.json"))("playwright");
const gpuFlags =
  opt.gpu === "metal"
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const chromeFlags = (profile) =>
  [
    "--headless=new",
    `--user-data-dir=${profile}`,
    ...gpuFlags,
    ...(opt.visit === "plain" ? ["--force-prefers-reduced-motion"] : []),
  ].join(" ");

/** 新しいプロファイルに fd-top-seen を書く。庭を描かないページで書き、シェーダのキャッシュを温めない */
async function seed(profile) {
  const ctx = await chromium.launchPersistentContext(profile, { args: gpuFlags });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(origin + SEED);
  const seen = await page.evaluate(() => localStorage.getItem("fd-top-seen"));
  await ctx.close();
  if (seen !== "1") throw new Error("fd-top-seen を書けなかった");
}

const ms = (a, k) => Math.round(a[k].numericValue);
mkdirSync(opt.out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const label = [opt.visit, opt.gpu, opt.throttling].join("-");
const rows = [];
try {
  for (let i = 0; i < runs; i++) {
    const profile = mkdtempSync(join(tmpdir(), "measure-top-"));
    try {
      if (opt.visit !== "first") await seed(profile);
      const report = join(opt.out, `${stamp}-${label}-${i}.json`);
      const load = loadavg()[0];
      await promisify(execFile)(
        "npx",
        [
          "--yes",
          LIGHTHOUSE,
          `${origin}/`,
          `--chrome-flags=${chromeFlags(profile)}`,
          "--disable-storage-reset",
          "--only-categories=performance",
          `--throttling-method=${opt.throttling}`,
          "--output=json",
          `--output-path=${report}`,
          "--quiet",
        ],
        { env: { ...process.env, CHROME_PATH: chromium.executablePath() } },
      );
      const r = JSON.parse(readFileSync(report, "utf8"));
      const a = r.audits;
      const observed = a.metrics.details.items[0];
      const row = {
        run: i,
        score: Math.round(r.categories.performance.score * 100),
        fcp: ms(a, "first-contentful-paint"),
        lcp: ms(a, "largest-contentful-paint"),
        tbt: ms(a, "total-blocking-time"),
        si: ms(a, "speed-index"),
        cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
        observedFcp: observed.observedFirstContentfulPaint,
        observedLcp: observed.observedLargestContentfulPaint,
        observedLoad: observed.observedLoad,
        lcpIsFcp: observed.observedLargestContentfulPaint === observed.observedFirstContentfulPaint,
        lcpElement: a["lcp-breakdown-insight"]?.details?.items?.find((d) => d.type === "node")
          ?.selector,
        benchmarkIndex: r.environment.benchmarkIndex,
        loadavgBefore: Number(load.toFixed(2)),
        loadavgAfter: Number(loadavg()[0].toFixed(2)),
        report,
      };
      writeFileSync(
        report.replace(/\.json$/, ".jpg"),
        Buffer.from(a["final-screenshot"].details.data.split(",")[1], "base64"),
      );
      rows.push(row);
      console.log(JSON.stringify(row));
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  }
} finally {
  server.close();
}

const median = (k) => {
  const v = rows.map((r) => r[k]).sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const summary = {
  lighthouse: LIGHTHOUSE,
  visit: opt.visit,
  gpu: opt.gpu,
  throttling: opt.throttling,
  runs: rows.length,
  lcpIsFcpRuns: rows.filter((r) => r.lcpIsFcp).length,
  median: Object.fromEntries(
    ["score", "fcp", "lcp", "tbt", "si", "cls"].map((k) => [k, median(k)]),
  ),
  rows,
};
writeFileSync(join(opt.out, `${stamp}-${label}-summary.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ lcpIsFcpRuns: summary.lcpIsFcpRuns, ...summary.median }));

#!/usr/bin/env node
// トップを Lighthouse で測る。既定は、2 回目以降の訪問（localStorage に fd-top-seen がある状態）で 5 回測り、中央値を出す。
// ビルドした apps/web/dist/ を配るので、pnpm run build の後に、リポジトリの直下で流す。
//
//   node scripts/measure-top-lighthouse.mjs [--visit second|first|reduced-motion] [--runs 5] [--gpu metal|swiftshader] [--throttling simulate|devtools] [--out lighthouse-results]
//
// 条件は、Lighthouse の既定の mobile（Moto G Power の画面と、Slow 4G と CPU 4 倍の遅さ）である。
// 既定の --throttling simulate は、スロットリングを掛けずに読み込んだ記録から遅い端末の値を推定する。devtools は、通信と CPU にスロットリングを掛けて読み込む。
// 実行ごとに新しいプロファイルで Chrome を起動し、前の実行のシェーダとディスクのキャッシュを持ち越さない。
// 配信は Cache-Control: no-store にする。fd-top-seen を残すために Lighthouse のストレージの消去を止めるので、代わりに HTTP のキャッシュを使わせない。
// テキストのファイル（HTML、CSS、JavaScript、JSON、XML、SVG）は gzip で送る。本番の配信が圧縮して返すためである。
// 配信は TLS の無い HTTP/1.1 である。本番の配信の HTTP/2 と Brotli とは、通信の値が違う。
// 庭の最初の 1 枚が、ページの最初の描画に入った回は、LCP が FCP と同じ値になる。その回は lcpIsFcp を true にする。
import { execFile } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { loadavg, tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";

const LIGHTHOUSE = "lighthouse@13.6.0";
const DIST = resolve("apps/web/dist");
const SEED_PATH = "/__seed-top-seen";
const METRICS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "total-blocking-time",
  "speed-index",
  "cumulative-layout-shift",
];

/** 1 行の理由を出し、終了コード 2 で終わる */
function fail(message) {
  console.error(message);
  process.exit(2);
}

const { values: opt } = parseArgs({
  options: {
    visit: { type: "string", default: "second" },
    runs: { type: "string", default: "5" },
    gpu: { type: "string", default: "metal" },
    throttling: { type: "string", default: "simulate" },
    out: { type: "string", default: "lighthouse-results" },
  },
});
if (!["second", "first", "reduced-motion"].includes(opt.visit))
  fail(`--visit が不正: ${opt.visit}`);
if (!["metal", "swiftshader"].includes(opt.gpu)) fail(`--gpu が不正: ${opt.gpu}`);
if (!["simulate", "devtools"].includes(opt.throttling))
  fail(`--throttling が不正: ${opt.throttling}`);
const runs = Number(opt.runs);
if (!Number.isInteger(runs) || runs < 1) fail(`--runs が不正: ${opt.runs}`);
if (!existsSync(join(DIST, "index.html")))
  fail(`${DIST}/index.html が無い。pnpm run build の後に流す`);
// CHROME_PATH が無効だと、Lighthouse が別の Chrome で測ることがあるので、先に止める。
if (!existsSync(chromium.executablePath()))
  fail("Playwright の Chromium が無い。pnpm exec playwright install chromium で入れる");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const GZIP = new Set([".html", ".js", ".css", ".svg", ".json", ".xml"]);
/** 配るファイルの本体とヘッダ。圧縮の時間を応答の時間に入れないよう、パスごとに 1 回だけ読んで圧縮する */
const files = new Map();
function load(file) {
  let hit = files.get(file);
  if (!hit) {
    const ext = extname(file);
    const head = {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    };
    let body = readFileSync(file);
    if (GZIP.has(ext)) {
      body = gzipSync(body);
      head["content-encoding"] = "gzip";
    }
    hit = { head, body };
    files.set(file, hit);
  }
  return hit;
}
const server = createServer((req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    if (path === SEED_PATH) {
      // キーと値は、apps/web/src/features/top-garden/stage/visit.ts の takeFirstVisit が書くものと同じにする。
      // --visit first では、値を書かずにプロファイルを 1 回開く。訪問の種類の差を localStorage の値だけにする。
      const write = new URL(req.url ?? "/", "http://localhost").searchParams.get("write") === "1";
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      res.end(write ? `<script>localStorage.setItem("fd-top-seen","1")</script>` : "<p>seed</p>");
      return;
    }
    const file = resolve(DIST, `.${path.endsWith("/") ? `${path}index.html` : path}`);
    if (!file.startsWith(DIST + sep) || !statSync(file).isFile()) throw new Error("not found");
    const { head, body } = load(file);
    res.writeHead(200, head).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://localhost:${server.address().port}`;

// npx が取得する Lighthouse には、手元の token などの環境変数を渡さない。
const childEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG", "npm_config_cache"]
    .filter((k) => process.env[k] !== undefined)
    .map((k) => [k, process.env[k]]),
);

const gpuFlags =
  opt.gpu === "metal"
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const chromeFlags = (profile) =>
  [
    "--headless=new",
    `--user-data-dir=${profile}`,
    ...gpuFlags,
    ...(opt.visit === "reduced-motion" ? ["--force-prefers-reduced-motion"] : []),
  ].join(" ");

/**
 * 新しいプロファイルを、庭を描かないページで 1 回開いて閉じる。シェーダのキャッシュは温めない。
 * @param write true のときは、fd-top-seen を書く
 */
async function seed(profile, write) {
  const ctx = await chromium.launchPersistentContext(profile, { args: gpuFlags });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(`${origin}${SEED_PATH}?write=${write ? 1 : 0}`);
    const seen = await page.evaluate(() => localStorage.getItem("fd-top-seen"));
    if (seen !== (write ? "1" : null)) throw new Error(`fd-top-seen が想定と違う: ${seen}`);
  } finally {
    await ctx.close();
  }
}

/** レポートの JSON から 1 回の値を取り出す。指標が欠けていたら、その名前を付けて投げる */
function readRow(r) {
  const a = r.audits;
  const score = r.categories.performance.score;
  if (!Number.isFinite(score)) throw new Error("Performance の score が無い");
  for (const k of METRICS)
    if (!Number.isFinite(a[k]?.numericValue)) throw new Error(`${k} の値が無い`);
  const observed = a.metrics?.details?.items?.[0] ?? {};
  const fcp = observed.observedFirstContentfulPaint;
  const lcp = observed.observedLargestContentfulPaint;
  const ms = (k) => Math.round(a[k].numericValue);
  return {
    score: Math.round(score * 100),
    fcp: ms("first-contentful-paint"),
    lcp: ms("largest-contentful-paint"),
    tbt: ms("total-blocking-time"),
    si: ms("speed-index"),
    cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
    observedFcp: fcp,
    observedLcp: lcp,
    observedLoad: observed.observedLoad,
    lcpIsFcp: Number.isFinite(fcp) && Number.isFinite(lcp) && fcp === lcp,
    lcpElement: a["lcp-breakdown-insight"]?.details?.items?.find((d) => d.type === "node")
      ?.selector,
    benchmarkIndex: r.environment.benchmarkIndex,
  };
}

mkdirSync(opt.out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const label = [opt.visit, opt.gpu, opt.throttling].join("-");
const rows = [];
const median = (k) => {
  const v = rows.map((r) => r[k]).sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
/** 結果を書く。途中の回が失敗したときは、それまでの回と失敗を書き、中央値は書かない */
const writeSummary = (error) => {
  const summary = {
    lighthouse: LIGHTHOUSE,
    visit: opt.visit,
    gpu: opt.gpu,
    throttling: opt.throttling,
    runs: rows.length,
    ...(error
      ? { failedRun: rows.length, error: String(error) }
      : {
          lcpIsFcpRuns: rows.filter((r) => r.lcpIsFcp).length,
          median: Object.fromEntries(
            ["score", "fcp", "lcp", "tbt", "si", "cls"].map((k) => [k, median(k)]),
          ),
        }),
    rows,
  };
  writeFileSync(join(opt.out, `${stamp}-${label}-summary.json`), JSON.stringify(summary, null, 2));
  return summary;
};

try {
  for (let i = 0; i < runs; i++) {
    const profile = mkdtempSync(join(tmpdir(), "measure-top-"));
    // --chrome-flags は空白で区切られるので、空白を含むパスはフラグが割れる。
    if (/\s/.test(profile)) fail(`一時ディレクトリのパスに空白がある: ${profile}`);
    try {
      await seed(profile, opt.visit !== "first");
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
        // 1 回は 1 分前後で終わる。止まったときに、配信とプロファイルを残したまま待ち続けない。
        { env: { ...childEnv, CHROME_PATH: chromium.executablePath() }, timeout: 600_000 },
      );
      const r = JSON.parse(readFileSync(report, "utf8"));
      const row = {
        run: i,
        ...readRow(r),
        loadavgBefore: Number(load.toFixed(2)),
        loadavgAfter: Number(loadavg()[0].toFixed(2)),
        report,
      };
      const shot = r.audits["final-screenshot"]?.details?.data;
      if (shot)
        writeFileSync(report.replace(/\.json$/, ".jpg"), Buffer.from(shot.split(",")[1], "base64"));
      rows.push(row);
      console.log(JSON.stringify(row));
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  }
} catch (e) {
  writeSummary(e);
  console.error(`${rows.length} 回目で失敗した`, e);
  process.exitCode = 1;
} finally {
  server.close();
}

if (!process.exitCode) {
  const summary = writeSummary();
  console.log(JSON.stringify({ lcpIsFcpRuns: summary.lcpIsFcpRuns, ...summary.median }));
}

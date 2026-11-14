// Yaegi の WASM をビルドし、wasm/yaegi-0.wasm と wasm/yaegi-1.wasm の 2 つに分ける。WASM はコミットせず、ビルドのたびに作る。
// 分けるのは、Workers の静的なファイルの 1 つの上限（25 MiB）を、WASM の全体が超えるためである。ブラウザで 2 つをつないでコンパイルする。
// Go のバージョンは mise.toml にある。wasm_exec.js は同じ Go のものをコミットしておき、食い違うときはビルドを失敗させる。
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const goroot = execFileSync("go", ["env", "GOROOT"], { encoding: "utf8" }).trim();
const vendored = join(root, "src/worker/vendor/wasm_exec.js");
if (
  readFileSync(join(goroot, "lib/wasm/wasm_exec.js"), "utf8") !== readFileSync(vendored, "utf8")
) {
  console.error(
    `${vendored} が、Go の ${goroot}/lib/wasm/wasm_exec.js と違う。Go を上げたときは、そのファイルをコピーする`,
  );
  process.exit(1);
}

const out = join(root, "wasm");
const whole = join(out, "yaegi.wasm");
mkdirSync(out, { recursive: true });
execFileSync("go", ["build", "-trimpath", "-ldflags=-s -w", "-o", whole, "."], {
  cwd: join(root, "go"),
  env: { ...process.env, GOOS: "js", GOARCH: "wasm" },
  stdio: "inherit",
});

const LIMIT = 25 * 1024 * 1024;
const bytes = readFileSync(whole);
const half = Math.ceil(bytes.length / 2);
if (half >= LIMIT) {
  console.error(`WASM が ${bytes.length} バイトあり、2 つに分けても 25 MiB を超える`);
  process.exit(1);
}
writeFileSync(join(out, "yaegi-0.wasm"), bytes.subarray(0, half));
writeFileSync(join(out, "yaegi-1.wasm"), bytes.subarray(half));
rmSync(whole);

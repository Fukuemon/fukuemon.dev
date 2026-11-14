import type { GoRunner } from "../index";
import { joinParts } from "./parts";
import { createGoRunner } from "./runner";

// WASM は、Workers の静的なファイルの上限に収まるよう、ビルドで 2 つに分けてある (scripts/build-wasm.mjs)
const parts = [
  new URL("../../wasm/yaegi-0.wasm", import.meta.url),
  new URL("../../wasm/yaegi-1.wasm", import.meta.url),
];

/** Go を動かすツールの GoRunner。Yaegi の WASM は、load か実行を呼ぶまで取得しない。 */
export function createBrowserGoRunner(): GoRunner {
  return createGoRunner({
    compile: async () => WebAssembly.compileStreaming(await joinParts(parts)),
    createWorker: () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
  });
}

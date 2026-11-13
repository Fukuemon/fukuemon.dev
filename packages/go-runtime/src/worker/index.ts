import type { GoRunner } from "../index";
import { createGoRunner } from "./runner";

export { createGoRunner } from "./runner";
export type { WorkerLike } from "./runner";

// WASM は、Workers の静的なファイルの上限に収まるよう、ビルドで 2 つに分けてある (scripts/build-wasm.mjs)
const parts = [
  new URL("../../wasm/yaegi-0.wasm", import.meta.url),
  new URL("../../wasm/yaegi-1.wasm", import.meta.url),
];

/** 分けた WASM を順につなぎ、取得しながらコンパイルする。 */
async function compileParts(): Promise<WebAssembly.Module> {
  const responses = await Promise.all(parts.map((url) => fetch(url)));
  for (const response of responses) {
    if (!response.ok)
      throw new Error(`${response.url} を取得できませんでした（${response.status}）`);
  }
  const joined = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const response of responses) {
        const reader = response.body!.getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          controller.enqueue(chunk.value);
        }
      }
      controller.close();
    },
  });
  return WebAssembly.compileStreaming(
    new Response(joined, { headers: { "content-type": "application/wasm" } }),
  );
}

/** Go を動かすツールの GoRunner。Yaegi の WASM は、load か実行を呼ぶまで取得しない。 */
export function createBrowserGoRunner(): GoRunner {
  return createGoRunner({
    compile: compileParts,
    createWorker: () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
  });
}

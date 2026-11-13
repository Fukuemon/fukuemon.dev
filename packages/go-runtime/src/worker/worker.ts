import "./vendor/wasm_exec.js";

import { sameOriginFetch } from "./guard";
import type { FromWorker, ToWorker } from "./runner";

// tsconfig に WebWorker の lib を足すと DOM の lib と衝突するので、使う 2 つだけを型にする
const scope = globalThis as unknown as {
  postMessage: (message: FromWorker) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent<ToWorker>) => void) => void;
  location: { origin: string };
};

const post = scope.postMessage.bind(scope);
globalThis.fetch = sameOriginFetch(globalThis.fetch.bind(globalThis), scope.location.origin);

// Yaegi の標準出力と標準エラーは、wasm_exec.js の fs.writeSync に届く。両方を 1 つの出力として送る
const decoder = new TextDecoder();
globalThis.fs.writeSync = (_fd, buf) => {
  post({ type: "output", chunk: decoder.decode(buf, { stream: true }) });
  return buf.length;
};

scope.addEventListener("message", (event) => {
  const { module, input } = event.data;
  globalThis.goRunnerInput = JSON.stringify(input);
  const go = new Go();
  go.exit = (code) => post({ type: "exit", code });
  WebAssembly.instantiate(module, go.importObject)
    .then((instance) => go.run(instance))
    .catch((error: unknown) => {
      post({ type: "crashed", message: error instanceof Error ? error.message : String(error) });
    });
});

import { PGlite } from "@electric-sql/pglite";

import { type FromWorker, type ToWorker, createHandler } from "./handler";

// tsconfig に WebWorker の lib を足すと DOM の lib と衝突するので、使う 2 つだけを型にする
const scope = globalThis as unknown as {
  postMessage: (message: FromWorker) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent<ToWorker>) => void) => void;
};

const handle = createHandler(() => PGlite.create(), scope.postMessage.bind(scope));
scope.addEventListener("message", (event) => {
  void handle(event.data);
});

// テストの preload。console-trace.cjs より先に読み、パイプで受ける標準出力を端末に見せる。
// ワーカーのスレッドでは変えず、console-trace.cjs が親のスレッドから受け取る値を確かめられるようにする
"use strict";

if (require("node:worker_threads").isMainThread) process.stdout.isTTY = true;

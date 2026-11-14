// テストの preload。console-trace.cjs より先に読み、パイプで受ける標準出力を端末に見せる
"use strict";

process.stdout.isTTY = true;

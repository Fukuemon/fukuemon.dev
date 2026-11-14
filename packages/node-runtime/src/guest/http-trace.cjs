// 実行環境の中の Node が --require で読む preload。HTTP のサーバーが受けたリクエストとレスポンスを、1 件を 1 行の JSON にして標準出力に書く。
// 行の形は src/http-records.ts が読む。訪問者のプログラムを止めないよう、記録の処理の失敗は握りつぶす (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
"use strict";

const http = require("node:http");
const { AsyncLocalStorage } = require("node:async_hooks");

const PREFIX = "@@fd:http ";
const FROM_HEADER = "x-playground-from";
const BODY_LIMIT = 64 * 1024;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

let listening;
// 処理中のリクエストを受けたサーバーのポート。1 つのプロセスが複数のサーバーを持つときも、fetch した側を区別する
const handling = new AsyncLocalStorage();
let sequence = 0;

const write = (record) => {
  try {
    process.stdout.write(PREFIX + JSON.stringify(record) + "\n");
  } catch {
    // 標準出力を閉じたプロセスでは記録しない
  }
};

/** このプロセスを、送信先から区別する値。待ち受けているときはポート、待ち受けていないときはプロセスの ID である。 */
const senderId = () =>
  handling.getStore() ?? (listening === undefined ? `pid-${process.pid}` : String(listening));

function createBody() {
  const chunks = [];
  let size = 0;
  let kept = 0;
  return {
    add(chunk, encoding) {
      if (chunk === undefined || chunk === null || typeof chunk === "function") return;
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : typeof chunk === "string"
          ? Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8")
          : Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      size += buffer.length;
      if (kept < BODY_LIMIT) {
        const part = buffer.subarray(0, BODY_LIMIT - kept);
        chunks.push(Buffer.from(part));
        kept += part.length;
      }
    },
    toJSON() {
      if (size === 0) return undefined;
      const bytes = Buffer.concat(chunks);
      const truncated = size > bytes.length;
      let text = null;
      if (!bytes.includes(0)) {
        try {
          // 上限で切った末尾の、途中で切れた文字は、stream で読み捨てる
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: truncated });
        } catch {
          text = null;
        }
      }
      return { text, size, truncated };
    },
  };
}

const pairs = (raw) => {
  const headers = [];
  for (let i = 0; i + 1 < raw.length; i += 2) headers.push({ name: raw[i], value: raw[i + 1] });
  return headers;
};

/** 送った通りのレスポンスのヘッダ。writeHead に渡したヘッダは getHeaders に入らないことがあるので、送った頭の文字列から読む。 */
function responseHeaders(res) {
  if (typeof res._header === "string") {
    return res._header
      .split("\r\n")
      .slice(1)
      .filter((line) => line.includes(":"))
      .map((line) => {
        const at = line.indexOf(":");
        return { name: line.slice(0, at), value: line.slice(at + 1).trim() };
      });
  }
  return Object.entries(res.getHeaders()).flatMap(([name, value]) =>
    (Array.isArray(value) ? value : [value]).map((item) => ({ name, value: String(item) })),
  );
}

function trace(server, req, res) {
  const startedAt = Date.now();
  const id = ++sequence;
  const requestBody = createBody();
  const responseBody = createBody();

  // data の購読を足すと、流れ出すので、訪問者の処理より先に本文を読んでしまう。emit を包んで、読まれた分だけを写す
  const emit = req.emit;
  req.emit = function (event, chunk) {
    if (event === "data") requestBody.add(chunk);
    return emit.apply(this, arguments);
  };
  const resWrite = res.write;
  res.write = function (chunk, encoding) {
    responseBody.add(chunk, encoding);
    return resWrite.apply(this, arguments);
  };
  const resEnd = res.end;
  res.end = function (chunk, encoding) {
    responseBody.add(chunk, encoding);
    return resEnd.apply(this, arguments);
  };

  let done = false;
  const finish = (sent) => {
    if (done) return;
    done = true;
    const address = server.address();
    write({
      type: "exchange",
      id,
      pid: process.pid,
      from: typeof req.headers[FROM_HEADER] === "string" ? req.headers[FROM_HEADER] : null,
      to: address && typeof address === "object" ? address.port : null,
      startedAt,
      durationMs: Date.now() - startedAt,
      method: req.method,
      url: req.url,
      request: { headers: pairs(req.rawHeaders), body: requestBody.toJSON() },
      response: sent
        ? { status: res.statusCode, headers: responseHeaders(res), body: responseBody.toJSON() }
        : null,
    });
  };
  res.on("finish", () => finish(true));
  res.on("close", () => finish(res.writableFinished));
}

// oxlint-disable-next-line typescript/unbound-method -- 包んだ emit から、サーバーを this にして呼ぶ
const serverEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, ...args) {
  let port;
  try {
    if (event === "request") {
      trace(this, args[0], args[1]);
      const address = this.address();
      if (address && typeof address === "object") port = String(address.port);
    }
    if (event === "listening") {
      const address = this.address();
      if (address && typeof address === "object") {
        listening ??= address.port;
        write({ type: "listen", pid: process.pid, port: address.port });
      }
    }
  } catch {
    // 記録できなくても、訪問者のサーバーは動かす
  }
  if (port !== undefined) return handling.run(port, () => serverEmit.call(this, event, ...args));
  return serverEmit.call(this, event, ...args);
};

const isLoopback = (input) => {
  try {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return LOOPBACK.has(url.hostname);
  } catch {
    return false;
  }
};

// 実行環境の中のサーバーへの fetch にだけ、送信元を示すヘッダを足す。外のサーバーには送らない
const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function") {
  globalThis.fetch = function (input, init) {
    if (!isLoopback(input)) return originalFetch.call(this, input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    if (!headers.has(FROM_HEADER)) headers.set(FROM_HEADER, senderId());
    return originalFetch.call(this, input, { ...init, headers });
  };
}

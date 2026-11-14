// 実行環境の中の Node が --require で読む preload。HTTP のサーバーが受けたリクエストとレスポンスを、1 件を 1 行の JSON にして標準出力に書く。
// 行の形は src/http-records.ts が読む。訪問者のプログラムを止めないよう、記録の処理の失敗は握りつぶす (docs/adr/0054-record-http-and-console-with-prefixed-lines.md)
"use strict";

const http = require("node:http");
const { AsyncLocalStorage } = require("node:async_hooks");

const PREFIX = "@@fd:http ";
const FROM_HEADER = "x-playground-from";
const BODY_LIMIT = 64 * 1024;
// URL の hostname は、IPv6 のアドレスを [] で囲んで返す
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

let listening;
// 処理中のリクエストを受けたサーバーのポート。1 つのプロセスが複数のサーバーを持つときも、fetch した側を区別する
const handling = new AsyncLocalStorage();
const traced = new WeakSet();

const quietly = (run) => {
  try {
    run();
  } catch {
    // 記録できなくても、訪問者のプログラムは動かす
  }
};

const write = (record) =>
  quietly(() => process.stdout.write(PREFIX + JSON.stringify(record) + "\n"));

// 記録はプロセスをまたいで時刻の順に並べ直すので、プロセスの間でそろう時計を使う。WebContainers では、performance.timeOrigin がプロセスごとにずれる
const now = () => Date.now();

const portOf = (server) => {
  const address = server.address();
  return address && typeof address === "object" ? address.port : undefined;
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
      const textEncoding = typeof encoding === "string" ? encoding : "utf8";
      // 上限まで写した後は、大きさだけを数え、本文を写さない
      if (kept >= BODY_LIMIT && typeof chunk === "string") {
        size += Buffer.byteLength(chunk, textEncoding);
        return;
      }
      const buffer = Buffer.isBuffer(chunk)
        ? chunk
        : typeof chunk === "string"
          ? Buffer.from(chunk, textEncoding)
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
const responseHeaders = (res) =>
  String(res._header ?? "")
    .split("\r\n")
    .slice(1)
    .filter((line) => line.includes(":"))
    .map((line) => {
      const at = line.indexOf(":");
      return { name: line.slice(0, at), value: line.slice(at + 1).trim() };
    });

function trace(port, req, res) {
  const startedAt = now();
  const requestBody = createBody();
  const responseBody = createBody();

  // data の購読を足すと、流れ出すので、訪問者の処理より先に本文を読んでしまう。emit を包んで、読まれた分だけを写す
  const emit = req.emit;
  req.emit = function (event, chunk) {
    if (event === "data") quietly(() => requestBody.add(chunk));
    return emit.apply(this, arguments);
  };
  const resWrite = res.write;
  res.write = function (chunk, encoding) {
    quietly(() => responseBody.add(chunk, encoding));
    return resWrite.apply(this, arguments);
  };
  const resEnd = res.end;
  res.end = function (chunk, encoding) {
    quietly(() => responseBody.add(chunk, encoding));
    return resEnd.apply(this, arguments);
  };

  let done = false;
  const finish = (sent) => {
    if (done) return;
    done = true;
    write({
      type: "exchange",
      from: typeof req.headers[FROM_HEADER] === "string" ? req.headers[FROM_HEADER] : null,
      to: port,
      startedAt,
      durationMs: now() - startedAt,
      method: req.method,
      url: req.url,
      request: { headers: pairs(req.rawHeaders), body: requestBody.toJSON() },
      response: sent
        ? { status: res.statusCode, headers: responseHeaders(res), body: responseBody.toJSON() }
        : null,
    });
  };
  res.on("finish", () => quietly(() => finish(true)));
  res.on("close", () => quietly(() => finish(res.writableFinished)));
}

// oxlint-disable-next-line typescript/unbound-method -- 包んだ emit から、サーバーを this にして呼ぶ
const serverEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, ...args) {
  let port;
  quietly(() => {
    if (event === "listening" || event === "request") port = portOf(this);
    if (event === "listening" && port !== undefined) {
      listening ??= port;
      write({ type: "listen", port });
    }
    // 訪問者のコードが同じリクエストで request を出し直したときは、2 回記録しない
    if (event === "request" && port !== undefined && !traced.has(args[1])) {
      traced.add(args[1]);
      trace(port, args[0], args[1]);
    }
  });
  if (event === "request" && port !== undefined) {
    return handling.run(String(port), () => serverEmit.call(this, event, ...args));
  }
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

/** 送信元を示すヘッダを足した init。ヘッダを組めないときは undefined を返し、元の fetch に任せる。 */
function withSender(input, init) {
  try {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    if (!headers.has(FROM_HEADER)) headers.set(FROM_HEADER, senderId());
    return { ...init, headers };
  } catch {
    return undefined;
  }
}

// 実行環境の中のサーバーへの fetch にだけ、送信元を示すヘッダを足す。外のサーバーには送らない
const originalFetch = globalThis.fetch;
if (typeof originalFetch === "function") {
  globalThis.fetch = function (input, init) {
    const added = isLoopback(input) ? withSender(input, init) : undefined;
    return originalFetch.call(this, input, added ?? init);
  };
}

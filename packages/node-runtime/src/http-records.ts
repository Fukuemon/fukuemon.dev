import type { BackendProcess } from "./backend";
import { type WritableStore, createStore } from "./store";
import type { HttpBody, HttpRecord, ProcessInfo } from "./types";

type HttpPeer = HttpRecord["from"];
type HttpHeaderLine = HttpRecord["request"]["headers"][number];

/** preload が記録の行の頭に付ける文字列。guest/http-trace.cjs と同じ値にする (apps/playground/DesignDoc.md の「記録を読む形」)。 */
export const HTTP_PREFIX = "@@fd:http ";

/** 1 つの実行環境が持つ HTTP の記録の上限。超えたときは、古いものから捨てる。 */
const MAX_RECORDS = 500;

/** 出力の末尾が記録の行の頭の途中で切れたときに、続きを待つ時間。続きが来なければ、端末に出す。 */
const HOLD_MS = 50;

/** 記録の行の頭が見つかってから、改行を待つ文字数の上限。超えたら、記録の行ではないとみなして端末に出す。 */
const MAX_LINE_CHARS = 4 * 1024 * 1024;

/** text の末尾が、prefix の先頭の何文字と一致するか。prefix の全体と一致するときは数えない。 */
function partialPrefixLength(text: string, prefix: string): number {
  for (let length = Math.min(prefix.length - 1, text.length); length > 0; length--) {
    if (text.endsWith(prefix.slice(0, length))) return length;
  }
  return 0;
}

/**
 * プロセスの出力から、記録の行を抜き出す。onText には記録の行を除いた出力を、onLine には記録の行の頭を除いた中身を渡す。
 * 記録の行は、出力の途中で切れて届くので、頭か改行が届くまで手元に置く。頭の途中で切れたものは、HOLD_MS の後に端末に出す。
 */
export function createRecordLineFilter(
  onText: (text: string) => void,
  onLine: (line: string) => void,
  prefix = HTTP_PREFIX,
) {
  let held = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const release = () => {
    timer = undefined;
    if (held === "") return;
    const text = held;
    held = "";
    onText(text);
  };

  const push = (chunk: string) => {
    clearTimeout(timer);
    timer = undefined;
    let text = held + chunk;
    held = "";
    let out = "";
    for (;;) {
      const at = text.indexOf(prefix);
      if (at === -1) break;
      const end = text.indexOf("\n", at);
      if (end === -1) {
        if (text.length - at > MAX_LINE_CHARS) break;
        out += text.slice(0, at);
        held = text.slice(at);
        if (out !== "") onText(out);
        return;
      }
      out += text.slice(0, at);
      onLine(text.slice(at + prefix.length, end).replace(/\r$/, ""));
      text = text.slice(end + 1);
    }
    const keep = partialPrefixLength(text, prefix);
    out += text.slice(0, text.length - keep);
    held = text.slice(text.length - keep);
    if (out !== "") onText(out);
    if (held !== "") timer = setTimeout(release, HOLD_MS);
  };

  return {
    push,
    /** 手元に置いた出力を、記録の行でなかったものとして端末に出す。プロセスが終わったときに呼ぶ。 */
    flush: () => {
      clearTimeout(timer);
      release();
    },
  };
}

/**
 * process の出力から記録の行を除き、onLine に渡す。購読ごとに、行を抜き出す処理を 1 つ作る。
 * プロセスが終わったときは、手元に置いた出力を、記録の行でなかったものとして購読した側に渡す。
 */
export function withoutRecordLines(
  process: BackendProcess,
  onLine: (line: string) => void,
): BackendProcess {
  const subscribe = (onChunk: (chunk: string) => void) => {
    const filter = createRecordLineFilter(onChunk, onLine);
    void process.exit.then(filter.flush, filter.flush);
    return process.output.subscribe(filter.push);
  };
  return { ...process, output: { subscribe } };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toHeaders = (value: unknown): HttpHeaderLine[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const headers: HttpHeaderLine[] = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.name !== "string" || typeof item.value !== "string") {
      return undefined;
    }
    headers.push({ name: item.name, value: item.value });
  }
  return headers;
};

const toBody = (value: unknown): HttpBody | undefined | false => {
  if (value === undefined) return undefined;
  if (
    !isObject(value) ||
    !(typeof value.text === "string" || value.text === null) ||
    typeof value.size !== "number" ||
    typeof value.truncated !== "boolean"
  ) {
    return false;
  }
  return { text: value.text, size: value.size, truncated: value.truncated };
};

type ParsedLine =
  | { type: "listen"; port: number }
  | {
      type: "exchange";
      from: string | null;
      to: number;
      record: Omit<HttpRecord, "id" | "from" | "to">;
    };

/** 記録の行の中身を読む。訪問者のプログラムも同じ頭の行を出せるので、形に合わないものは捨てる。 */
export function parseHttpLine(line: string): ParsedLine | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isObject(value)) return undefined;
  if (value.type === "listen") {
    return typeof value.port === "number" ? { type: "listen", port: value.port } : undefined;
  }
  if (value.type !== "exchange" || !isObject(value.request)) return undefined;
  const { from, to, method, url, startedAt, durationMs, request, response } = value;
  const requestHeaders = toHeaders(request.headers);
  const requestBody = toBody(request.body);
  if (
    !(typeof from === "string" || from === null) ||
    typeof to !== "number" ||
    typeof method !== "string" ||
    typeof url !== "string" ||
    typeof startedAt !== "number" ||
    typeof durationMs !== "number" ||
    requestHeaders === undefined ||
    requestBody === false
  ) {
    return undefined;
  }
  let parsedResponse: HttpRecord["response"];
  if (response !== null && response !== undefined) {
    const responseHeaders = isObject(response) ? toHeaders(response.headers) : undefined;
    const responseBody = isObject(response) ? toBody(response.body) : false;
    if (
      !isObject(response) ||
      typeof response.status !== "number" ||
      responseHeaders === undefined ||
      responseBody === false
    ) {
      return undefined;
    }
    parsedResponse = {
      status: response.status,
      headers: responseHeaders,
      ...(responseBody && { body: responseBody }),
    };
  }
  return {
    type: "exchange",
    from,
    to,
    record: {
      method,
      url,
      startedAt,
      durationMs,
      request: { headers: requestHeaders, ...(requestBody && { body: requestBody }) },
      ...(parsedResponse && { response: parsedResponse }),
    },
  };
}

const BROWSER: HttpPeer = { id: "browser", name: "ブラウザ" };

const portName = (port: number) => `${port} 番のサーバー`;

/**
 * 送信元を示すヘッダの値を、通信した側にする。値が無いものは、ブラウザからの通信である。
 * 値は preload が付けたものとは限らない。訪問者が付けた値は、そのまま名前にする。
 */
function peerOf(from: string | null, names: ReadonlyMap<number, string>): HttpPeer {
  if (from === null) return BROWSER;
  if (/^\d+$/.test(from)) {
    const port = Number(from);
    return { id: `port:${port}`, name: names.get(port) ?? portName(port) };
  }
  const pid = /^pid-(\d+)$/.exec(from)?.[1];
  if (pid !== undefined) return { id: `pid:${pid}`, name: "Node のプロセス" };
  return { id: `header:${from}`, name: from };
}

/** 記録の行を出したプロセス。サーバーの名前に、起動のコマンドの名前を使う。 */
export type RecordSource = Pick<ProcessInfo, "kind" | "name">;

/**
 * HTTP の記録の store。記録の行を受けて、リクエストを受けた時刻の順に並べる。
 * 記録の行は、プロセスごとの出力から届くので、届いた順はリクエストの順と違うことがある。
 * サーバーの名前は、待ち受けた行を出したプロセスの名前にする。シェルで起動したサーバーは、ポートの番号で呼ぶ。
 */
export function createHttpRecords(maxRecords = MAX_RECORDS) {
  const state: RecordsState = {
    store: createStore<readonly HttpRecord[]>([]),
    names: new Map(),
    count: 0,
    max: maxRecords,
  };
  return {
    store: state.store,
    accept: (line: string, source: RecordSource) => accept(state, line, source),
  };
}

type RecordsState = {
  store: WritableStore<readonly HttpRecord[]>;
  /** 待ち受けたポートと、サーバーの名前。 */
  names: Map<number, string>;
  count: number;
  max: number;
};

/** 記録の行を、記録の一覧に当てる。待ち受けた行は names を書き換え、名前の変わったサーバーの記録を直す。 */
function accept(state: RecordsState, line: string, source: RecordSource) {
  const parsed = parseHttpLine(line);
  if (parsed?.type === "listen") {
    const name = source.kind === "command" ? source.name : portName(parsed.port);
    state.names.set(parsed.port, name);
    state.store.set(renamePort(state.store.getSnapshot(), parsed.port, name));
  }
  if (parsed?.type === "exchange") addExchange(state, parsed);
}

function addExchange(state: RecordsState, parsed: Extract<ParsedLine, { type: "exchange" }>) {
  state.count += 1;
  const record: HttpRecord = {
    id: String(state.count),
    from: peerOf(parsed.from, state.names),
    to: { id: `port:${parsed.to}`, name: state.names.get(parsed.to) ?? portName(parsed.to) },
    ...parsed.record,
  };
  state.store.set(insertByStart(state.store.getSnapshot(), record, state.max));
}

/** port のサーバーを指す記録の名前を直す。直す記録が無いときは、同じ配列を返す。 */
function renamePort(records: readonly HttpRecord[], port: number, name: string) {
  const id = `port:${port}`;
  const stale = (peer: HttpPeer) => peer.id === id && peer.name !== name;
  if (!records.some((record) => stale(record.from) || stale(record.to))) return records;
  const renamePeer = (peer: HttpPeer) => (peer.id === id ? { id, name } : peer);
  return records.map((record) => ({
    ...record,
    from: renamePeer(record.from),
    to: renamePeer(record.to),
  }));
}

/** record を、受けた時刻の順の位置に入れる。同じ時刻のものは、後に入れる。上限を超えたら、古いものから捨てる。 */
function insertByStart(records: readonly HttpRecord[], record: HttpRecord, max: number) {
  let at = records.length;
  while (at > 0 && (records[at - 1]?.startedAt ?? 0) > record.startedAt) at -= 1;
  const next = [...records.slice(0, at), record, ...records.slice(at)];
  return next.length > max ? next.slice(next.length - max) : next;
}

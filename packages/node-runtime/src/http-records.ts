import { type WritableStore, createStore } from "./store";
import type { RecordSource } from "./record-lines";
import type { HttpBody, HttpRecord } from "./types";

type HttpPeer = HttpRecord["from"];
type HttpHeaderLine = HttpRecord["request"]["headers"][number];

/** 1 つの実行環境が持つ HTTP の記録の上限。超えたときは、古いものから捨てる。 */
const MAX_RECORDS = 500;

/**
 * 1 行の記録の大きさの上限。訪問者のプログラムも記録の行を出せるので、preload が出す大きさを超えた分を切る。
 * 本文の文字数は、preload が記録する 64 KB を UTF-8 で読んだ文字数を超えない値にする。
 */
const MAX_BODY_TEXT = 64 * 1024;
const MAX_HEADERS = 100;
const MAX_URL = 8 * 1024;
/** ヘッダの名前と値の文字数の上限。超えた分は切り、末尾に「…」を付ける。 */
const MAX_HEADER_TEXT = 8 * 1024;
/** メソッドと送信元のヘッダの値の文字数の上限。超えた行は、記録の行ではないとみなして捨てる。 */
const MAX_METHOD = 32;
const MAX_FROM = 256;
/** 名前を覚えるサーバーの数の上限。超えた後に待ち受けたサーバーは、ポートの番号で呼ぶ。 */
const MAX_NAMES = 100;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPort = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 65535;

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isStatus = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 100 && (value as number) <= 999;

/** 文字列を max 文字までにする。サロゲートペアの途中では切らない。 */
const cut = (text: string, max: number) => {
  if (text.length <= max) return text;
  const end = /[\uD800-\uDBFF]/.test(text.charAt(max - 1)) ? max - 1 : max;
  return text.slice(0, end);
};

const cutHeader = (text: string) =>
  text.length > MAX_HEADER_TEXT ? `${cut(text, MAX_HEADER_TEXT)}…` : text;

type HeaderList = { headers: HttpHeaderLine[]; omittedHeaders?: number };

/** ヘッダの一覧を読む。上限を超えた分は捨て、捨てた数を omittedHeaders に入れる。 */
const toHeaders = (value: unknown): HeaderList | undefined => {
  if (!Array.isArray(value)) return undefined;
  const headers: HttpHeaderLine[] = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.name !== "string" || typeof item.value !== "string") {
      return undefined;
    }
    if (headers.length < MAX_HEADERS)
      headers.push({ name: cutHeader(item.name), value: cutHeader(item.value) });
  }
  const omitted = value.length - headers.length;
  return omitted > 0 ? { headers, omittedHeaders: omitted } : { headers };
};

/** 本文を読む。文字数の上限を超えた分は切り、truncated を立てる。 */
const toBody = (value: unknown): HttpBody | undefined | false => {
  if (value === undefined) return undefined;
  if (
    !isObject(value) ||
    !(typeof value.text === "string" || value.text === null) ||
    !isCount(value.size) ||
    typeof value.truncated !== "boolean"
  ) {
    return false;
  }
  if (value.text !== null && value.text.length > MAX_BODY_TEXT) {
    return {
      text: cut(value.text, MAX_BODY_TEXT),
      size: Math.max(value.size, value.text.length),
      truncated: true,
    };
  }
  return { text: value.text, size: value.size, truncated: value.truncated };
};

/** URL を読む。上限を超えた分は切り、urlTruncated を立てる。 */
const toUrl = (url: string) =>
  url.length > MAX_URL ? { url: cut(url, MAX_URL), urlTruncated: true } : { url };

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
    return isPort(value.port) ? { type: "listen", port: value.port } : undefined;
  }
  if (value.type !== "exchange" || !isObject(value.request)) return undefined;
  const { from, to, method, url, startedAt, durationMs, request, response } = value;
  const requestHeaders = toHeaders(request.headers);
  const requestBody = toBody(request.body);
  if (
    !((typeof from === "string" && from.length <= MAX_FROM) || from === null) ||
    !isPort(to) ||
    typeof method !== "string" ||
    method.length > MAX_METHOD ||
    typeof url !== "string" ||
    !isCount(startedAt) ||
    !isCount(durationMs) ||
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
      !isStatus(response.status) ||
      responseHeaders === undefined ||
      responseBody === false
    ) {
      return undefined;
    }
    parsedResponse = {
      status: response.status as number,
      ...responseHeaders,
      ...(responseBody && { body: responseBody }),
    };
  }
  return {
    type: "exchange",
    from,
    to,
    record: {
      method,
      ...toUrl(url),
      startedAt,
      durationMs,
      request: { ...requestHeaders, ...(requestBody && { body: requestBody }) },
      ...(parsedResponse && { response: parsedResponse }),
    },
  };
}

/** ブラウザからの通信の、送った側の id。 */
export const BROWSER_PEER_ID = "browser";

const BROWSER: HttpPeer = { id: BROWSER_PEER_ID, name: "ブラウザ" };

const portName = (port: number) => `${port} 番のサーバー`;

/**
 * 送信元を示すヘッダの値を、通信した側にする。値が無いものは、ブラウザからの通信である。
 * 待ち受けていないプロセスは、区別の色が足りなくならないよう、まとめて 1 つの側にする。
 * 値は preload が付けたものとは限らない。訪問者が付けた値は、そのまま名前にする。
 */
function peerOf(from: string | null, names: ReadonlyMap<number, string>): HttpPeer {
  if (from === null) return BROWSER;
  if (/^\d+$/.test(from)) {
    const port = Number(from);
    return { id: `port:${port}`, name: names.get(port) ?? portName(port) };
  }
  if (/^pid-\d+$/.test(from)) return { id: "process", name: "Node のプロセス" };
  return { id: `header:${from}`, name: from };
}

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
    if (!state.names.has(parsed.port) && state.names.size >= MAX_NAMES) return;
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

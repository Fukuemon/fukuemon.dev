import { BROWSER_PEER_ID, type HttpBody, type HttpRecord } from "@fukuemon/node-runtime";
import type { HttpActor, HttpExchange, HttpMessage } from "@fukuemon/ui";

const bytes = (size: number) =>
  size < 1024 ? `${size} バイト` : `${Math.round((size / 1024) * 10) / 10} KB`;

/** 本文を、詳細に出す文にする。テキストでない本文と、上限で切った本文は、そのことを文で添える。 */
export function bodyText(body: HttpBody): string {
  if (body.text === null) return `（テキストでない本文、${bytes(body.size)}）`;
  if (!body.truncated) return body.text;
  return `${body.text}\n…（先頭だけを記録しました。全体は ${bytes(body.size)}）`;
}

/** 記録を詳細の形にする。上限を超えて捨てたヘッダは、その数を末尾の行で示す。 */
const toMessage = (message: HttpRecord["request"]): HttpMessage => ({
  headers: message.omittedHeaders
    ? [
        ...message.headers,
        { name: "…", value: `ほかに ${message.omittedHeaders} 個のヘッダを省きました` },
      ]
    : message.headers,
  ...(message.body && { body: bodyText(message.body) }),
});

/**
 * 記録に出た、通信した側。ブラウザを先に、記録に初めて出た順に並べる。
 * 並べた順で区別の色が決まる。後から届いた記録が前に入るときと、上限で古い記録が消えるときは、色が変わることがある。
 */
export function actorsOf(records: readonly HttpRecord[]): HttpActor[] {
  const actors = new Map<string, HttpActor>();
  for (const record of records) {
    for (const peer of [record.from, record.to])
      actors.set(peer.id, { id: peer.id, name: peer.name });
  }
  return [...actors.values()].sort(
    (a, b) => Number(b.id === BROWSER_PEER_ID) - Number(a.id === BROWSER_PEER_ID),
  );
}

/** 1 件の記録を、一覧と詳細に渡す形にする。 */
export function toExchange(record: HttpRecord): HttpExchange {
  return {
    id: record.id,
    fromId: record.from.id,
    toId: record.to.id,
    method: record.method,
    url: record.urlTruncated ? `${record.url}…（URL の先頭だけを記録しました）` : record.url,
    request: toMessage(record.request),
    ...(record.response && {
      status: record.response.status,
      response: toMessage(record.response),
    }),
  };
}

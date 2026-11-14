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

const toMessage = (message: { headers: HttpMessage["headers"]; body?: HttpBody }): HttpMessage => ({
  headers: message.headers,
  ...(message.body && { body: bodyText(message.body) }),
});

/**
 * HTTP の記録を、一覧と詳細に渡す形にする。通信した側は、ブラウザを先に、記録に初めて出た順に並べる。
 * 並べた順で区別の色が決まる。後から届いた記録が前に入るときと、上限で古い記録が消えるときは、色が変わることがある。
 */
export function toHttpView(records: readonly HttpRecord[]): {
  actors: HttpActor[];
  exchanges: HttpExchange[];
} {
  const actors = new Map<string, HttpActor>();
  const exchanges = records.map((record): HttpExchange => {
    for (const peer of [record.from, record.to])
      actors.set(peer.id, { id: peer.id, name: peer.name });
    return {
      id: record.id,
      fromId: record.from.id,
      toId: record.to.id,
      method: record.method,
      url: record.url,
      request: toMessage(record.request),
      ...(record.response && {
        status: record.response.status,
        response: toMessage(record.response),
      }),
    };
  });
  const ordered = [...actors.values()].sort(
    (a, b) => Number(b.id === BROWSER_PEER_ID) - Number(a.id === BROWSER_PEER_ID),
  );
  return { actors: ordered, exchanges };
}

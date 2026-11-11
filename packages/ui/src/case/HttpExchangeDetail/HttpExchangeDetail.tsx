import { useId } from "react";

import { Disclosure } from "../../base/Disclosure/Disclosure";
import { Table } from "../../base/Table/Table";
import {
  type HttpActor,
  type HttpExchange,
  HttpExchangeSummary,
  type HttpHeader,
  type HttpMessage,
} from "../HttpExchangeList/HttpExchangeList";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

export type HttpExchangeDetailProps = {
  title?: string;
  actors: readonly HttpActor[];
  /** 渡さないときは、行き来を選ぶよう案内する。 */
  exchange?: HttpExchange;
  /** 渡すと、詳細の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
};

const COOKIE_HEADERS = new Set(["cookie", "set-cookie"]);

const isCookie = (header: HttpHeader) => COOKIE_HEADERS.has(header.name.toLowerCase());

function HeaderTable({ caption, headers }: { caption: string; headers: readonly HttpHeader[] }) {
  return (
    <Table caption={caption}>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>名前</Table.HeaderCell>
          <Table.HeaderCell>値</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {headers.map((header, index) => (
          <Table.Row key={`${header.name}-${index}`}>
            <Table.HeaderCell scope="row">
              <span className="font-mono text-code-dense break-words">{header.name}</span>
            </Table.HeaderCell>
            <Table.Cell>
              <span className="font-mono text-code-dense break-all">{header.value}</span>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function MessageBody({ label, body }: { label: string; body: string }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-dense font-bold" id={labelId}>
        {label}
      </p>
      <pre
        aria-labelledby={labelId}
        className="overflow-x-auto bg-code-surface p-4 font-mono text-code-dense text-code-text focus-visible:focus-ring"
        role="region"
        tabIndex={0}
      >
        {body}
      </pre>
    </div>
  );
}

function MessageSection({
  side,
  message,
}: {
  side: "リクエスト" | "レスポンス";
  message?: HttpMessage;
}) {
  const headers = message?.headers.filter((header) => !isCookie(header)) ?? [];
  return (
    <Disclosure defaultOpen summary={side}>
      <div className="flex flex-col gap-4">
        {headers.length > 0 ? (
          <HeaderTable caption={`${side}のヘッダ`} headers={headers} />
        ) : (
          <p className="text-body-dense text-text-secondary">ヘッダはありません。</p>
        )}
        {message?.body !== undefined && <MessageBody body={message.body} label={`${side}の本文`} />}
      </div>
    </Disclosure>
  );
}

/**
 * 1 つの行き来の、ヘッダ、Cookie、本文。Cookie は、リクエストの Cookie とレスポンスの Set-Cookie のヘッダを、ヘッダの表から分けて出す。
 * 長い URL とヘッダの値は折り返し、本文はその枠の中だけで横に送る。
 */
export function HttpExchangeDetail({
  title = "通信の詳細",
  actors,
  exchange,
  state,
}: HttpExchangeDetailProps) {
  const paneState: ToolPaneState =
    state ??
    (exchange === undefined
      ? { kind: "empty", message: "一覧から通信を選ぶと、ここに詳細を出します。" }
      : { kind: "ready" });
  const cookies = [
    ...(exchange?.request?.headers ?? []),
    ...(exchange?.response?.headers ?? []),
  ].filter(isCookie);

  return (
    <ToolPane state={paneState} title={title}>
      {exchange !== undefined && (
        <div className="flex flex-col gap-4 p-4">
          <p className="flex flex-col gap-2">
            <HttpExchangeSummary actors={actors} exchange={exchange} />
          </p>
          <MessageSection message={exchange.request} side="リクエスト" />
          {exchange.status !== undefined && (
            <MessageSection message={exchange.response} side="レスポンス" />
          )}
          {cookies.length > 0 && (
            <Disclosure defaultOpen summary="Cookie">
              <HeaderTable caption="Cookie のヘッダ" headers={cookies} />
            </Disclosure>
          )}
        </div>
      )}
    </ToolPane>
  );
}

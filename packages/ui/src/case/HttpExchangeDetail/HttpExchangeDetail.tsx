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
    <Table caption={caption} density="compact">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>名前</Table.HeaderCell>
          <Table.HeaderCell>値</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {headers.map((header, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- 同じ名前のヘッダが並ぶことがあり、並びも変わらない (context/conventions.md)
          <Table.Row key={`${header.name}-${index}`}>
            <Table.HeaderCell scope="row">
              <span className="font-mono text-code-compact break-words">{header.name}</span>
            </Table.HeaderCell>
            <Table.Cell>
              <span className="font-mono text-code-compact break-all">{header.value}</span>
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
    <div className="flex flex-col gap-1">
      <p className="text-label-compact" id={labelId}>
        {label}
      </p>
      <pre
        aria-labelledby={labelId}
        className="overflow-x-auto bg-code-surface p-2 font-mono text-code-compact text-code-text focus-visible:focus-ring"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- pre は section に替えられない。包むと余白と背景を外の要素へ移し、見た目が変わる
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
    <Disclosure defaultOpen density="compact" summary={side}>
      <div className="flex flex-col gap-2">
        {headers.length > 0 ? (
          <HeaderTable caption={`${side}のヘッダ`} headers={headers} />
        ) : (
          <p className="text-body-compact text-text-secondary">ヘッダはありません。</p>
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
          <p className="flex flex-col">
            <HttpExchangeSummary actors={actors} exchange={exchange} />
          </p>
          <MessageSection message={exchange.request} side="リクエスト" />
          {exchange.status !== undefined && (
            <MessageSection message={exchange.response} side="レスポンス" />
          )}
          {cookies.length > 0 && (
            <Disclosure defaultOpen density="compact" summary="Cookie">
              <HeaderTable caption="Cookie のヘッダ" headers={cookies} />
            </Disclosure>
          )}
        </div>
      )}
    </ToolPane>
  );
}

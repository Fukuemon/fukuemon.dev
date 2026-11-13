import { clsx } from "clsx";

import { StatusBadge, type StatusBadgeProps } from "../../base/StatusBadge/StatusBadge";
import { ToolPane, type ToolPaneState } from "../ToolPane/ToolPane";

/** 通信する者。1 つの流れの中で、並べた順に区別の色を 1 つずつ当てる。 */
export type HttpActor = { id: string; name: string };

export type HttpHeader = { name: string; value: string };

/** リクエストかレスポンスの片側。 */
export type HttpMessage = { headers: readonly HttpHeader[]; body?: string };

/** 1 つの行き来。status が無いものは、レスポンスが届かなかったリクエストである。 */
export type HttpExchange = {
  id: string;
  fromId: string;
  toId: string;
  method: string;
  url: string;
  status?: number;
  request?: HttpMessage;
  response?: HttpMessage;
};

export type HttpExchangeListProps = {
  title?: string;
  actors: readonly HttpActor[];
  exchanges: readonly HttpExchange[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** 渡すと、一覧の代わりに読み込み中かエラーを出す。 */
  state?: Extract<ToolPaneState, { kind: "loading" | "error" }>;
};

// クラスの名前を連結で組むと Tailwind が CSS を出さないので、区別の色ごとに書き並べる
const ACTOR_CLASS_NAMES = [
  "text-categorical-1",
  "text-categorical-2",
  "text-categorical-3",
  "text-categorical-4",
  "text-categorical-5",
  "text-categorical-6",
] as const;

/** 者の名前を、区別の色で書く。色は actors の中の順で決まり、7 つ目からは最初の色に戻る。 */
function ActorName({ actors, id }: { actors: readonly HttpActor[]; id: string }) {
  const index = Math.max(
    0,
    actors.findIndex((actor) => actor.id === id),
  );
  return (
    <span className={clsx("font-bold", ACTOR_CLASS_NAMES[index % ACTOR_CLASS_NAMES.length])}>
      {actors.find((actor) => actor.id === id)?.name ?? id}
    </span>
  );
}

/** 状態コードの印の種類と文字。packages/ui/DesignDoc.md の「HTTP の流れの色」の対応に従う。 */
const statusOf = (status: number | undefined): Required<StatusBadgeProps> => {
  if (status === undefined) return { tone: "danger", label: "届かなかった" };
  const label = String(status);
  if (status >= 500) return { tone: "danger", label };
  if (status >= 400) return { tone: "warning", label };
  if (status >= 300) return { tone: "info", label };
  if (status >= 200) return { tone: "success", label };
  return { tone: "neutral", label };
};

/** 1 つの行き来の、者の間の向き、メソッド、URL、状態コードの 2 行。一覧の行と詳細の頭に使う。 */
export function HttpExchangeSummary({
  actors,
  exchange,
}: {
  actors: readonly HttpActor[];
  exchange: HttpExchange;
}) {
  const status = statusOf(exchange.status);
  return (
    <>
      <span className="flex flex-wrap items-center gap-x-1.5 text-compact">
        <ActorName actors={actors} id={exchange.fromId} />
        <span aria-hidden="true" className="text-text-secondary">
          →
        </span>
        <span className="sr-only">から</span>
        <ActorName actors={actors} id={exchange.toId} />
      </span>
      <span className="flex w-full min-w-0 items-start gap-2">
        <span className="shrink-0 font-mono text-code-compact font-bold">{exchange.method}</span>
        <span className="min-w-0 flex-1 font-mono text-code-compact break-all">{exchange.url}</span>
        <StatusBadge label={status.label} tone={status.tone} />
      </span>
    </>
  );
}

/**
 * 行き来したリクエストとレスポンスを、起きた順に並べた一覧。行ごとに、者、メソッド、URL、状態コードを出す。
 * 者の名前と状態コードは、色と一緒に文字でも出す。行を押すと onSelect を呼ぶ。
 */
export function HttpExchangeList({
  title = "HTTP の流れ",
  actors,
  exchanges,
  selectedId,
  onSelect,
  state,
}: HttpExchangeListProps) {
  const paneState: ToolPaneState =
    state ??
    (exchanges.length === 0
      ? { kind: "empty", message: "まだ通信がありません。" }
      : { kind: "ready" });
  return (
    <ToolPane state={paneState} title={title}>
      <ol className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {exchanges.map((exchange) => {
          const isSelected = exchange.id === selectedId;
          return (
            <li className="border-b border-border" key={exchange.id}>
              <button
                aria-current={isSelected ? "true" : undefined}
                className={clsx(
                  "flex min-h-6 w-full cursor-pointer flex-col border-l-2 px-3 py-1 text-left hover:bg-surface-subtle focus-visible:focus-ring",
                  isSelected ? "border-primary bg-surface-subtle" : "border-transparent",
                )}
                onClick={() => onSelect(exchange.id)}
                type="button"
              >
                <HttpExchangeSummary actors={actors} exchange={exchange} />
              </button>
            </li>
          );
        })}
      </ol>
    </ToolPane>
  );
}

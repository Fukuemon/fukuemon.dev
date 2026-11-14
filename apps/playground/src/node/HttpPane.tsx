import type { HttpRecord } from "@fukuemon/node-runtime";
import { HttpExchangeDetail, HttpExchangeList } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { actorsOf, toExchange } from "./http-view";
import { bootFailureMessage } from "./messages";

const NO_RECORDS: readonly HttpRecord[] = [];
const noRecords = { subscribe: () => () => undefined, getSnapshot: () => NO_RECORDS };

/** HTTP の記録と、起動に失敗したときに一覧に出す状態。 */
export function useHttpRecords() {
  const { runtime, reason } = useRuntime();
  const store = runtime?.httpExchanges ?? noRecords;
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const state =
    reason === undefined
      ? undefined
      : ({
          kind: "error",
          title: "HTTP の流れを記録できません",
          message: bootFailureMessage(reason),
        } as const);
  return { state, records };
}

/** 実行環境の中のサーバーが受けた HTTP のリクエストとレスポンスを、受けた順に並べるペイン。 */
export function HttpListPane() {
  const { state, records } = useHttpRecords();
  const { selection, dispatch } = useSelection();
  return (
    <HttpExchangeList
      actors={actorsOf(records)}
      exchanges={records.map(toExchange)}
      onSelect={(id) => dispatch({ type: "select-exchange", id })}
      selectedId={selection.exchange}
      state={state}
    />
  );
}

/** HTTP の一覧で選んだ通信の、ヘッダ、Cookie、本文を出すペイン。 */
export function HttpDetailPane() {
  const { records } = useHttpRecords();
  const { selection } = useSelection();
  const record = records.find((item) => item.id === selection.exchange);
  return <HttpExchangeDetail actors={actorsOf(records)} exchange={record && toExchange(record)} />;
}

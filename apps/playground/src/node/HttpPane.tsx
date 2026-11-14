import type { HttpRecord } from "@fukuemon/node-runtime";
import { HttpExchangeDetail, HttpExchangeList } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { toHttpView } from "./http-view";
import { bootFailureMessage } from "./messages";

const NO_RECORDS: readonly HttpRecord[] = [];
const noRecords = { subscribe: () => () => undefined, getSnapshot: () => NO_RECORDS };

function useHttpView() {
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
  return { state, ...toHttpView(records) };
}

/** 実行環境の中のサーバーが受けた HTTP のリクエストとレスポンスを、受けた順に並べるペイン。 */
export function HttpListPane() {
  const { state, actors, exchanges } = useHttpView();
  const { selection, dispatch } = useSelection();
  return (
    <HttpExchangeList
      actors={actors}
      exchanges={exchanges}
      onSelect={(id) => dispatch({ type: "select-exchange", id })}
      selectedId={selection.exchange}
      state={state}
    />
  );
}

/** HTTP の一覧で選んだ通信の、ヘッダ、Cookie、本文を出すペイン。 */
export function HttpDetailPane() {
  const { state, actors, exchanges } = useHttpView();
  const { selection } = useSelection();
  return (
    <HttpExchangeDetail
      actors={actors}
      exchange={exchanges.find((exchange) => exchange.id === selection.exchange)}
      state={state}
    />
  );
}

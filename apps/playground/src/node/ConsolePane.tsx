import type { ConsoleRecord } from "@fukuemon/node-runtime";
import { ConsoleEntryList } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { toEntry } from "./console-view";
import { useRuntime } from "./context";
import { bootFailureMessage } from "./messages";

const NO_RECORDS: readonly ConsoleRecord[] = [];
const noRecords = { subscribe: () => () => undefined, getSnapshot: () => NO_RECORDS };

/** コンソールの記録と、起動に失敗したときにコンソールに出す状態。 */
export function useConsoleRecords() {
  const { runtime, reason } = useRuntime();
  const store = runtime?.consoleEntries ?? noRecords;
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const state =
    reason === undefined
      ? undefined
      : ({
          kind: "error",
          title: "コンソールを記録できません",
          message: bootFailureMessage(reason),
        } as const);
  return { state, records };
}

/** Node のプロセスとプレビューのページが `console.*` で出したログを、届いた順に並べるペイン。 */
export function ConsolePane() {
  const { state, records } = useConsoleRecords();
  return <ConsoleEntryList entries={records.map(toEntry)} state={state} />;
}

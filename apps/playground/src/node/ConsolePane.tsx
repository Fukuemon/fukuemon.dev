import type { ConsoleRecord } from "@fukuemon/node-runtime";
import { ConsoleEntryList } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { CONSOLE_FAILURE_TITLE, toEntry } from "./console-view";
import { useRuntime } from "./context";
import { bootFailureMessage } from "./messages";

const NO_RECORDS: readonly ConsoleRecord[] = [];
const noRecords = { subscribe: () => () => undefined, getSnapshot: () => NO_RECORDS };

/** Node のプロセスとプレビューのページが `console.*` で出したログを、届いた順に並べるペイン。 */
export function ConsolePane() {
  const { runtime, reason } = useRuntime();
  const store = runtime?.consoleEntries ?? noRecords;
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <ConsoleEntryList
      entries={records.map(toEntry)}
      state={
        reason === undefined
          ? undefined
          : { kind: "error", title: CONSOLE_FAILURE_TITLE, message: bootFailureMessage(reason) }
      }
    />
  );
}

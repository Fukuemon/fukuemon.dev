import type { SqlDatabase, SqlResponse } from "@fukuemon/sql-runtime";
import { EditorFrame } from "@fukuemon/ui";
import { useState, useTransition } from "react";

import { SqlConsole } from "../sql-console/SqlConsole";
import { useRuntime } from "./context";
import { SQL_PANE_QUERY, SQL_STOPPED_HINT, bootFailureMessage } from "./messages";

/**
 * DB を使うプロジェクトの、SQL のペイン。Node のコードと同じ DB（実行環境の中の PGlite）に、DB のプロセスの標準入出力で SQL を送る。
 * 実行環境を起動できなかったときは、理由だけを出す。
 */
export function SqlPane() {
  const { runtime, reason } = useRuntime();
  if (reason !== undefined) {
    return (
      <div className="size-full p-1">
        <EditorFrame
          files={[]}
          onSelect={() => undefined}
          state={{
            kind: "error",
            title: "SQL を実行できません",
            message: bootFailureMessage(reason),
          }}
          title="SQL"
        >
          {() => null}
        </EditorFrame>
      </div>
    );
  }
  const database = runtime.database;
  if (!database) return null;
  return <SqlPaneConsole database={database} />;
}

function SqlPaneConsole({ database }: { database: SqlDatabase }) {
  const [query, setQuery] = useState(SQL_PANE_QUERY);
  const [running, startRunning] = useTransition();

  const run = (sql: string) =>
    new Promise<SqlResponse>((resolve) => {
      startRunning(async () => {
        resolve(await database.run(sql));
      });
    });

  return (
    <div className="size-full p-1">
      <SqlConsole
        dense
        fileName="query.sql"
        onChange={setQuery}
        onRun={run}
        running={running}
        status={database.status}
        stoppedHint={SQL_STOPPED_HINT}
        value={query}
      />
    </div>
  );
}

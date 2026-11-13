import type { ProcessInfo } from "@fukuemon/node-runtime";
import { IconButton, Tabs, TerminalFrame } from "@fukuemon/ui";
import { useSyncExternalStore } from "react";

import { useRuntime, useSelection } from "./context";
import { bootFailureMessage, processLabel, shellName } from "./messages";
import { ProcessTerminal } from "./ProcessTerminal";
import { colorScheme } from "./terminal-theme";

// getSnapshot は同じ参照を返す。呼ぶたびに新しい配列を返すと、描画が止まらなくなる
const NO_PROCESSES: readonly ProcessInfo[] = [];
const noProcesses = { subscribe: () => () => undefined, getSnapshot: () => NO_PROCESSES };

/** 端末のペイン。起動したプロセスをタブで並べ、選んだプロセスの出力と入力を端末に出す。 */
export function TerminalPane() {
  const { runtime, reason } = useRuntime();
  const { selection, dispatch } = useSelection();
  const store = runtime?.processes.list ?? noProcesses;
  const processes = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const themeName = useSyncExternalStore(colorScheme.subscribe, colorScheme.getSnapshot);
  const selected = processes.find((info) => info.id === selection.terminal) ?? processes[0];
  const handle = selected && runtime?.processes.get(selected.id);

  const openShell = async () => {
    if (!runtime) return;
    const shell = await runtime.processes.startShell({ name: shellName(processes) });
    dispatch({ type: "select-terminal", id: shell.id });
  };

  return (
    <TerminalFrame
      actions={
        runtime && (
          <IconButton
            icon={
              <svg aria-hidden="true" height="20" viewBox="0 0 20 20" width="20">
                <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
            label="新しい端末"
            onClick={() => void openShell().catch(() => undefined)}
          />
        )
      }
      state={
        reason !== undefined
          ? { kind: "error", title: "端末を開けません", message: bootFailureMessage(reason) }
          : selected === undefined
            ? { kind: "loading", label: "シェルを起動しています" }
            : undefined
      }
      themeName={themeName}
    >
      {(theme) =>
        selected && (
          <Tabs
            items={processes.map((info) => ({
              id: info.id,
              label: processLabel(info),
              content: handle && <ProcessTerminal handle={handle} key={handle.id} theme={theme} />,
            }))}
            label="プロセス"
            onSelect={(id) => dispatch({ type: "select-terminal", id })}
            panel="flush"
            selectedId={selected.id}
          />
        )
      }
    </TerminalFrame>
  );
}

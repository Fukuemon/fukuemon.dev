import type { BackendInstance, BackendProcess } from "./backend";
import { type RecordSource, withoutRecordLines } from "./record-lines";
import { createOutputLog } from "./output";
import { type WritableStore, createStore } from "./store";
import type { NodeRuntime, ProcessHandle, ProcessInfo } from "./types";

const SHELL_NAME = "シェル";

/**
 * 実装のプロセスを、出力を記録する ProcessHandle にする。終了したら、出力の購読を外して onExit を呼ぶ。
 * 実装が exit を失敗させたときも、終了したことにする。終了コードは、異常終了を表す 1 にする。
 */
function toHandle(id: string, process: BackendProcess, onExit: (code: number) => void) {
  const output = createOutputLog();
  const stop = process.output.subscribe(output.append);
  const exit = process.exit.catch(() => 1);
  void exit.then((code) => {
    stop();
    onExit(code);
  });
  const handle: ProcessHandle = {
    id,
    output,
    write: process.write,
    resize: process.resize,
    kill: process.kill,
    exit,
  };
  return { handle, stop };
}

type Tracked = Map<string, ReturnType<typeof toHandle>>;

/** process を一覧に入れ、出力を記録する。終了したら、一覧の状態に終了コードを入れる。 */
function trackProcess(
  { list, tracked }: { list: WritableStore<readonly ProcessInfo[]>; tracked: Tracked },
  process: BackendProcess,
  info: Pick<ProcessInfo, "kind" | "name">,
): ProcessHandle {
  const id = String(tracked.size + 1);
  const entry = toHandle(id, process, (code) =>
    list.set(
      list
        .getSnapshot()
        .map((item) => (item.id === id ? { ...item, status: { kind: "exited", code } } : item)),
    ),
  );
  tracked.set(id, entry);
  list.set([...list.getSnapshot(), { id, ...info, status: { kind: "running" } }]);
  return entry.handle;
}

/** 起動したプロセスの一覧と、出力の記録。終了したプロセスも一覧に残し、出力を読める。 */
export function createProcesses(
  instance: BackendInstance,
  onRecordLine: (line: string, source: RecordSource) => void,
): {
  api: NodeRuntime["processes"];
  dispose: () => void;
} {
  const list = createStore<readonly ProcessInfo[]>([]);
  const tracked: Tracked = new Map();
  const track = (process: BackendProcess, info: Pick<ProcessInfo, "kind" | "name">) =>
    trackProcess(
      { list, tracked },
      withoutRecordLines(process, (l) => onRecordLine(l, info)),
      info,
    );

  return {
    api: {
      list,
      get: (id) => tracked.get(id)?.handle,
      start: async (command, args, options = {}) =>
        track(await instance.spawn(command, args, { terminal: options.terminal }), {
          kind: "command",
          name: options.name ?? [command, ...args].join(" "),
        }),
      startShell: async (options = {}) =>
        track(await instance.spawnShell({ terminal: options.terminal }), {
          kind: "shell",
          name: options.name ?? SHELL_NAME,
        }),
    },
    dispose: () => {
      for (const { stop } of tracked.values()) stop();
    },
  };
}

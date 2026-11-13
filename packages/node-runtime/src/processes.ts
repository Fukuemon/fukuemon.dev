import type { BackendInstance, BackendProcess } from "./backend";
import { createOutputLog } from "./output";
import { createStore } from "./store";
import type { NodeRuntime, ProcessHandle, ProcessInfo, ProcessStatus } from "./types";

const SHELL_NAME = "シェル";

/** 起動したプロセスの一覧と、出力の記録。終了したプロセスも一覧に残し、出力を読める。 */
export function createProcesses(instance: BackendInstance): {
  api: NodeRuntime["processes"];
  dispose: () => void;
} {
  const list = createStore<readonly ProcessInfo[]>([]);
  const handles = new Map<string, ProcessHandle>();
  const unsubscribes = new Set<() => void>();
  let next = 1;

  const setStatus = (id: string, status: ProcessStatus) =>
    list.set(list.getSnapshot().map((info) => (info.id === id ? { ...info, status } : info)));

  const track = (process: BackendProcess, name: string): ProcessHandle => {
    const id = String(next++);
    const output = createOutputLog();
    const unsubscribe = process.output.subscribe(output.append);
    unsubscribes.add(unsubscribe);
    // 実装が exit を失敗させたときも、終了したことにする。終了コードは、異常終了を表す 1 にする
    const exit = process.exit.catch(() => 1);
    void exit.then((code) => {
      unsubscribe();
      unsubscribes.delete(unsubscribe);
      setStatus(id, { kind: "exited", code });
    });
    const handle: ProcessHandle = {
      id,
      output,
      write: process.write,
      resize: process.resize,
      kill: process.kill,
      exit,
    };
    handles.set(id, handle);
    list.set([...list.getSnapshot(), { id, name, status: { kind: "running" } }]);
    return handle;
  };

  return {
    api: {
      list,
      get: (id) => handles.get(id),
      start: async (command, args, options = {}) =>
        track(
          await instance.spawn(command, args, { terminal: options.terminal }),
          options.name ?? [command, ...args].join(" "),
        ),
      startShell: async (options = {}) =>
        track(
          await instance.spawnShell({ terminal: options.terminal }),
          options.name ?? SHELL_NAME,
        ),
    },
    dispose: () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      unsubscribes.clear();
    },
  };
}

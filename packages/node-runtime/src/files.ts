import type { BackendFiles } from "./backend";
import { createStore } from "./store";
import type { FileEntry, NodeRuntime } from "./types";

const NODE_MODULES = "node_modules";

const join = (directory: string, name: string) =>
  directory === "" ? name : `${directory}/${name}`;

/**
 * node_modules の下は、パッケージのディレクトリ（`node_modules/<名前>` と `node_modules/@scope/<名前>`）までを読み、その中身を読まない。
 * 中身まで読むと、ツリーの項目が数千になるためである。
 */
function shouldDescend(path: string): boolean {
  const parts = path.split("/");
  const at = parts.lastIndexOf(NODE_MODULES);
  if (at === -1) return true;
  const rest = parts.slice(at + 1);
  if (rest.length === 0) return true;
  return rest.length === 1 && rest[0]?.startsWith("@") === true;
}

/** ディレクトリを先に、それぞれを名前の順に並べた、作業ディレクトリの全体の一覧。 */
async function listTree(files: BackendFiles, directory = ""): Promise<FileEntry[]> {
  const items = [...(await files.list(directory))].sort(
    (a, b) =>
      Number(b.kind === "directory") - Number(a.kind === "directory") ||
      a.name.localeCompare(b.name),
  );
  const entries: FileEntry[] = [];
  for (const item of items) {
    const path = join(directory, item.name);
    entries.push({ path, kind: item.kind });
    if (item.kind === "directory" && shouldDescend(path)) {
      entries.push(...(await listTree(files, path)));
    }
  }
  return entries;
}

const sameTree = (a: readonly FileEntry[], b: readonly FileEntry[]) =>
  a.length === b.length &&
  a.every((entry, i) => entry.path === b[i]?.path && entry.kind === b[i]?.kind);

/**
 * ファイルの操作と、ツリーの store。変更の通知を受けるたびにツリーを読み直す。
 * 読み直している間に通知が来たときは、終わってからもう 1 度だけ読み直す。
 */
export async function createFiles(
  files: BackendFiles,
): Promise<{ api: NodeRuntime["files"]; dispose: () => void }> {
  const tree = createStore<readonly FileEntry[]>(await listTree(files));
  const listeners = new Set<(paths: readonly string[]) => void>();
  type Waiter = { resolve: () => void; reject: (error: unknown) => void };
  let waiting: Waiter[] = [];
  let running = false;
  let disposed = false;

  // 呼んだ後に始まった 1 回の読み直しが終わると解決する。通知が続いても、ループの終わりを待たない
  const loop = async () => {
    running = true;
    while (waiting.length > 0) {
      const batch = waiting;
      waiting = [];
      const next = disposed ? undefined : await listTree(files).catch(() => undefined);
      try {
        if (!disposed && next && !sameTree(next, tree.getSnapshot())) tree.set(next);
        for (const waiter of batch) waiter.resolve();
      } catch (error) {
        for (const waiter of batch) waiter.reject(error);
      }
    }
    running = false;
  };

  // node_modules のパッケージの中身の変更は、パッケージのディレクトリがツリーにあれば、ツリーを変えない
  const changesTree = (path: string) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join("/");
      if (!shouldDescend(ancestor)) {
        return !tree.getSnapshot().some((entry) => entry.path === ancestor);
      }
    }
    return true;
  };

  const refresh = () =>
    new Promise<void>((resolve, reject) => {
      waiting.push({ resolve, reject });
      if (!running) void loop();
    });

  const unwatch = files.watch((paths) => {
    if (paths.some(changesTree)) {
      refresh().catch((error: unknown) => console.error("ファイルのツリーを読み直せない", error));
    }
    for (const listener of listeners) listener(paths);
  });

  // 操作の後は、通知を待たずに読み直す。通知が遅れても、ツリーに結果がすぐ出る
  const thenRefresh =
    <A extends unknown[]>(operation: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      await operation(...args);
      await refresh();
    };

  const decoder = new TextDecoder();
  return {
    api: {
      tree,
      changes: {
        subscribe: (onChange) => {
          listeners.add(onChange);
          return () => listeners.delete(onChange);
        },
      },
      read: async (path) => decoder.decode(await files.readFile(path)),
      // 既にあるファイルの中身を書いても、ツリーは変わらない
      write: async (path, contents) => {
        const exists = tree.getSnapshot().some((entry) => entry.path === path);
        await (exists
          ? files.writeFile(path, contents)
          : thenRefresh(files.writeFile)(path, contents));
      },
      createDirectory: thenRefresh(files.mkdir),
      rename: thenRefresh(files.rename),
      remove: thenRefresh(files.remove),
    },
    dispose: () => {
      disposed = true;
      unwatch();
      listeners.clear();
    },
  };
}

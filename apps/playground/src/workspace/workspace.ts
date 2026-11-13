import type { PlaygroundTool } from "../project/project";

/** 保存したレコードの読み込みの結果。IndexedDB を読めないときは unavailable である。 */
export type WorkspaceLoad<T> =
  | { kind: "empty" }
  | { kind: "saved"; record: T }
  | { kind: "unavailable" };

export type Workspace<T> = {
  load: () => Promise<WorkspaceLoad<T>>;
  /** 保存してあるレコードを、丸ごと置き換える。IndexedDB を読めなかった後は、書き込まない。 */
  save: (record: T) => Promise<void>;
};

const DATABASE = "fukuemon-playground";
const STORE = "workspaces";

/** デフォルトのプロジェクトの保存のキーに使う、埋め込みの ID の代わりの値。埋め込みの ID の形（`a/b`）と重ならない。 */
const DEFAULT_KEY = "default";

export const workspaceKey = (tool: PlaygroundTool, embedId: string | undefined) =>
  `${tool}:${embedId ?? DEFAULT_KEY}`;

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.addEventListener("success", () => resolve(req.result));
    req.addEventListener("error", () => reject(req.error));
  });

const openDatabase = (factory: IDBFactory) => {
  const req = factory.open(DATABASE, 1);
  req.addEventListener("upgradeneeded", () => req.result.createObjectStore(STORE));
  return request(req);
};

/**
 * 訪問者のファイルを、ツールの名前と埋め込みの ID の組のキーで、play.fukuemon.dev の IndexedDB に保存する (ADR-0050)。
 * IndexedDB を読めないことは、ページを開いている間だけ持ち、その間は書き込まない。
 */
export function createWorkspace<T>(
  tool: PlaygroundTool,
  embedId: string | undefined,
  factory: () => IDBFactory | undefined = () => globalThis.indexedDB,
): Workspace<T> {
  const key = workspaceKey(tool, embedId);
  let database: Promise<IDBDatabase> | undefined;
  let unavailable = false;
  const connect = () => {
    const idb = factory();
    database ??= idb ? openDatabase(idb) : Promise.reject(new Error("IndexedDB が無い"));
    return database;
  };
  return {
    load: async () => {
      try {
        const db = await connect();
        const record = await request<T | undefined>(
          db.transaction(STORE).objectStore(STORE).get(key),
        );
        return record === undefined ? { kind: "empty" } : { kind: "saved", record };
      } catch {
        unavailable = true;
        return { kind: "unavailable" };
      }
    },
    save: async (record) => {
      if (unavailable) return;
      const db = await connect();
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(record, key);
      // 容量の超過は commit のときに起きるので、トランザクションの終わりで結果を決める
      await new Promise<void>((resolve, reject) => {
        transaction.addEventListener("complete", () => resolve());
        transaction.addEventListener("abort", () => reject(transaction.error));
        transaction.addEventListener("error", () => reject(transaction.error));
      });
    },
  };
}

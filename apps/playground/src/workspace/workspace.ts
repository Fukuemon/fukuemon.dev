import type { PlaygroundTool } from "../project/project";

/** 保存したレコードの読み込みの結果。IndexedDB を読めないときは unavailable である。 */
export type WorkspaceLoad<T> =
  | { kind: "empty" }
  | { kind: "saved"; record: T }
  | { kind: "unavailable" };

/** 値と、値が変わったことの購読と、値を変える関数。 */
type Listenable<T> = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => T;
  set: (value: T) => void;
};

export type Workspace<T> = {
  load: () => Promise<WorkspaceLoad<T>>;
  /** 保存してあるレコードを、丸ごと置き換える。IndexedDB を読めなかった後は、書き込まない。 */
  save: (record: T) => Promise<void>;
  /** 保存してあるレコードを消す。IndexedDB を読めなかった後は、何もしない。待っている保存の後に消すため、createSaver の clear を通して呼ぶ。 */
  clear: () => Promise<void>;
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
    save: (record) => write((store) => store.put(record, key)),
    clear: () => write((store) => store.delete(key)),
  };

  async function write(operation: (store: IDBObjectStore) => void) {
    if (unavailable) return;
    const db = await connect();
    const transaction = db.transaction(STORE, "readwrite");
    operation(transaction.objectStore(STORE));
    // 容量の超過は commit のときに起きるので、トランザクションの終わりで結果を決める
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener("complete", () => resolve());
      transaction.addEventListener("abort", () => reject(transaction.error));
      transaction.addEventListener("error", () => reject(transaction.error));
    });
  }
}

/** 保存の列。保存の途中に来たレコードは、最新の 1 件だけを持ち、保存が終わってから書く。 */
export type Saver<T> = {
  /** keepFailure のときは、保存が通っても、keepFailure でない保存の失敗で立った failed を戻さない。訪問者の変更でない書き込みに使う。 */
  save: (record: T, options?: { keepFailure?: boolean }) => void;
  /** 待っているレコードを捨て、途中の保存が終わってから、保存してあるレコードを消す。 */
  clear: () => Promise<void>;
  /** 保存が失敗したときは true である。keepFailure でない保存が通ると false に戻る。keepFailure の保存が通ったときは、keepFailure の保存の失敗だけで立っていれば false に戻る。clear が通ると false に戻る。 */
  failed: { subscribe: (onChange: () => void) => () => void; getSnapshot: () => boolean };
};

/**
 * Workspace への書き込みを 1 列に並べる。1 文字の入力ごとに書き込みを重ねないためと、消した後に古い保存が書き戻さないためである。
 */
export function createSaver<T>(workspace: Workspace<T>): Saver<T> {
  const failed = createStore(false);
  // 訪問者の変更の保存の失敗は、書き直しの成功で消さないため、keepFailure でない保存の失敗を別に持つ (ADR-0070)
  let failedByNormal = false;
  let queued: { record: T; keepFailure: boolean } | undefined;
  let tail = Promise.resolve();
  let draining = false;
  // clear の後に来た保存を、clear の前の列が書かないように、clear のたびに世代を進める
  let generation = 0;
  const drain = async (own: number) => {
    while (queued && own === generation) {
      const { record, keepFailure } = queued;
      queued = undefined;
      await workspace.save(record).then(
        () => {
          if (!keepFailure) failedByNormal = false;
          if (!failedByNormal) failed.set(false);
        },
        () => {
          if (!keepFailure) failedByNormal = true;
          failed.set(true);
        },
      );
    }
    if (own === generation) draining = false;
  };
  return {
    save: (record, { keepFailure = false } = {}) => {
      queued = { record, keepFailure };
      if (draining) return;
      draining = true;
      const own = generation;
      tail = tail.then(() => drain(own));
    },
    clear: () => {
      queued = undefined;
      generation++;
      draining = false;
      const cleared = tail.then(async () => {
        await workspace.clear();
        failedByNormal = false;
        failed.set(false);
      });
      tail = cleared.catch(() => undefined);
      return cleared;
    },
    failed,
  };
}

function createStore<T>(initial: T): Listenable<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

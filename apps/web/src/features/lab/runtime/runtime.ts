type ExecResult = {
  fields: { name: string }[];
  /** Worker 側で上限まで切られた行 */
  rows: unknown[][];
  /** 切る前の行数 */
  total: number;
  affectedRows: number;
};

export type Runtime = {
  version: string;
  /** 流し直しに失敗した手順の番号。完了表示と DB がずれている */
  replayFailed: readonly number[];
  exec: (source: string) => Promise<{ results: ExecResult[]; ms: number }>;
};

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/** Vite が `new URL(..., import.meta.url)` を静的に解決するので、パスは literal で置く */
const WORKERS = {
  pglite: () => new Worker(new URL("./pglite.worker.ts", import.meta.url), { type: "module" }),
} satisfies Record<string, () => Worker>;

export type RuntimeKind = keyof typeof WORKERS;

/** メインスレッドだと重いクエリでタブごと固まる (実測で rAF が 28 秒途切れた) */
class Session {
  #worker: Worker | undefined;
  #seq = 0;
  #pending = new Map<number, Pending>();
  #booting: Promise<string> | undefined;
  #replayFailed: number[] = [];
  /** 中断した Session は二度と使わない。boot なしで exec を送ってしまう */
  #dead = false;
  #version: string | undefined;

  constructor(
    private readonly kind: RuntimeKind,
    private readonly setup?: string,
    private readonly replay: string[] = [],
  ) {}

  #spawn(): Worker {
    const make = WORKERS[this.kind];
    // frontmatter の runtime に対応する Worker が無いまま公開されうる
    if (!make) throw new Error(`${String(this.kind)} の実行環境はまだありません`);
    const w = make();
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; error?: string }>) => {
      const p = this.#pending.get(e.data.id);
      if (!p) return;
      this.#pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data);
      else p.reject(new Error(e.data.error ?? "不明な失敗"));
    };
    // 落ちた Worker を残すと、次の postMessage が応答せず Promise が解けない
    w.onerror = (e) => {
      const err = new Error(e.message || "Worker が落ちました");
      this.cancel();
      this.#failAll(err);
    };
    return w;
  }

  #failAll(err: Error): void {
    for (const p of this.#pending.values()) p.reject(err);
    this.#pending.clear();
  }

  #send<T>(msg: Record<string, unknown>): Promise<T> {
    // 中断後に待ち行列のタスクが来ると Worker が boot なしで復活し、
    // pool の外にいるので誰も terminate できなくなる
    if (this.#dead) return Promise.reject(new Error("中断しました"));
    const w = (this.#worker ??= this.#spawn());
    const id = ++this.#seq;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ ...msg, id });
    });
  }

  boot(): Promise<string> {
    this.#booting ??= this.#send<{ version: string; replayFailed: number[] }>({
      kind: "boot",
      setup: this.setup,
      replay: this.replay,
    })
      .then((r) => {
        this.#version = r.version;
        this.#replayFailed = r.replayFailed;
        return r.version;
      })
      .catch((e: unknown) => {
        // 残すと再試行が永久に同じ失敗を返す
        this.cancel();
        throw e;
      });
    return this.#booting;
  }

  exec(source: string): Promise<{ results: ExecResult[]; ms: number }> {
    return this.#send<{ results: ExecResult[]; ms: number }>({ kind: "exec", sql: source });
  }

  get dead(): boolean {
    return this.#dead;
  }

  /** 未了の Session へ exec を送ると失敗する */
  get booted(): boolean {
    return this.#version !== undefined;
  }

  get version(): string | undefined {
    return this.#version;
  }

  get replayFailed(): readonly number[] {
    return this.#replayFailed;
  }

  /** 実行中でも止める。この Session は以後使わない */
  cancel(): void {
    this.#dead = true;
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#booting = undefined;
    this.#version = undefined;
    this.#failAll(new Error("中断しました"));
  }
}

const pool = new Map<string, Session>();

/** 単一接続の engine は同時実行を受けない */
let queue: Promise<unknown> = Promise.resolve();

export function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** 起動のときだけ使う材料。すでに起きている Session には効かない */
export type BootSpec = {
  setup?: string;
  /**
   * 進捗は localStorage に残るが DB はメモリなので、流し直さないと表示と中身が食い違う。
   * 完了済みの全手順を渡す。パネルごとに変えると最初の 1 つが状態を固定する。
   */
  replay?: string[];
};

/** `key` ごとに 1 インスタンスを共有する。`boot` は起動のときだけ効く */
export async function getRuntime(
  key: string,
  kind: RuntimeKind,
  boot: BootSpec = {},
): Promise<Runtime> {
  const found = pool.get(key);
  const live = found && !found.dead ? found : undefined;
  const session = live ?? new Session(kind, boot.setup, boot.replay ?? []);
  pool.set(key, session);
  try {
    const version = await session.boot();
    return { version, replayFailed: session.replayFailed, exec: (source) => session.exec(source) };
  } catch (e) {
    // 残すと再試行が永久に同じ失敗を返す
    if (pool.get(key) === session) pool.delete(key);
    throw e;
  }
}

/** 起動済みの Session にだけ相乗りする。無ければ起動せず `undefined` を返す */
export function peekRuntime(key: string): Runtime | undefined {
  const s = pool.get(key);
  if (!s || s.dead || !s.booted) return undefined;
  return { version: s.version ?? "", replayFailed: s.replayFailed, exec: (source) => s.exec(source) };
}

/** 「中断」と「初めから」はどちらもこれで足りる。次の実行は起動からやり直す */
export function dropRuntime(key: string): void {
  pool.get(key)?.cancel();
  pool.delete(key);
}

import {
  BootError,
  type BootOptions,
  type FileContents,
  type NodeRuntime,
  type ProcessHandle,
  type ReadAllOptions,
  ReadLimitError,
} from "@fukuemon/node-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nodeDefaultProject } from "../project/defaults";
import type { ProjectLoad } from "../project/project";
import type { Workspace, WorkspaceLoad } from "../workspace/workspace";
import {
  type NodeProject,
  type NodeRecord,
  type NodeSession,
  type NodeSessionOptions,
  READ_TIMEOUT_MS,
  SAVE_DELAY_MS,
  SAVE_MAX_DELAY_MS,
  createNodeSession,
  createNodeSessionOpener,
} from "./session";
import { SAVE_LIMIT } from "./save-rules";

const project: NodeProject = {
  ...nodeDefaultProject,
  version: "v1",
  files: { "index.js": "a", "package.json": "{}" },
  start: [
    { command: "node", args: ["auth.js"], name: "認可サーバー" },
    { command: "node", args: ["client.js"], name: "クライアント" },
  ],
};

const savedRecord: NodeRecord = { files: { "index.js": "b" }, version: "v1", savedAt: 1 };

/** 起動した実行環境の代わり。ファイルは text のマップで持ち、変更の通知はテストから出す。 */
function fakeRuntime(
  files: Readonly<Record<string, string>>,
  installExit: number | Promise<number>,
) {
  const contents = new Map(Object.entries(files));
  /** シンボリックリンクのパス。readAll は kind を other にして返す。 */
  const links = new Set<string>();
  const calls: string[] = [];
  const listeners = new Set<(paths: readonly string[]) => void>();
  const handles: (ProcessHandle & { killed: boolean })[] = [];
  const handle = (exit: Promise<number>) => {
    let finish: (code: number) => void = () => undefined;
    const created = {
      id: String(handles.length),
      killed: false,
      write: vi.fn(),
      kill: () => {
        created.killed = true;
        finish(130);
      },
      exit: Promise.race([exit, new Promise<number>((resolve) => (finish = resolve))]),
    } as unknown as ProcessHandle & { killed: boolean };
    handles.push(created);
    return created;
  };
  // 除くディレクトリは読み、上限は数だけを見る。除くディレクトリの絞り込みは、session が受け取った後にもう 1 度行う
  const readAll = vi.fn(async (options?: ReadAllOptions): Promise<readonly FileContents[]> => {
    if (options?.limit && contents.size > options.limit.files) throw new ReadLimitError();
    return [...contents].map(([path, text]) => ({
      path,
      kind: links.has(path) ? "other" : "file",
      size: text.length,
      text,
    }));
  });
  const runtime = {
    files: {
      changes: {
        subscribe: (onChange: (paths: readonly string[]) => void) => {
          listeners.add(onChange);
          return () => listeners.delete(onChange);
        },
      },
      readAll,
      write: vi.fn(async (path: string, text: string) => {
        contents.set(path, text);
      }),
      createDirectory: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    processes: {
      get: (id: string) => handles.find((created) => created.id === id),
      startShell: vi.fn(async () => {
        calls.push("shell");
        return handle(new Promise(() => undefined));
      }),
      start: vi.fn(
        async (command: string, args: readonly string[], options?: { name?: string }) => {
          calls.push(`${command} ${args.join(" ")} (${options?.name})`);
          // 起動のコマンドは終了しない。終了を待つと、次のコマンドが起動しない
          return handle(
            command === "npm" ? Promise.resolve(installExit) : new Promise<number>(() => undefined),
          );
        },
      ),
    },
    dispose: vi.fn(async () => {
      calls.push("dispose");
    }),
  } as unknown as NodeRuntime;
  return {
    runtime,
    calls,
    contents,
    links,
    readAll,
    handles,
    /** 実行環境の中のコマンドがファイルを書いたときと同じく、中身を変えて通知を出す。 */
    change: (path: string, text?: string) => {
      if (text !== undefined) contents.set(path, text);
      for (const listener of listeners) listener([path]);
    },
  };
}

type Fake = ReturnType<typeof fakeRuntime>;

function fakeWorkspace() {
  const saves: NodeRecord[] = [];
  const workspace = {
    load: async () => ({ kind: "empty" }) as const,
    save: vi.fn(async (record: NodeRecord) => {
      saves.push(record);
    }),
    clear: vi.fn(async () => undefined),
  } satisfies Workspace<NodeRecord>;
  return { workspace, saves };
}

function setup(
  saved: WorkspaceLoad<NodeRecord> = { kind: "empty" },
  { installExit = 0 as number | Promise<number> } = {},
) {
  const runtimes: Fake[] = [];
  const booted: BootOptions["files"][] = [];
  const boot = vi.fn(async ({ files }: BootOptions) => {
    booted.push(files);
    const fake = fakeRuntime(files, installExit);
    runtimes.push(fake);
    return fake.runtime;
  });
  const { workspace, saves } = fakeWorkspace();
  const session = createNodeSession({
    project,
    saved,
    storage: workspace,
    embedId: "oauth/demo",
    boot,
    now: () => 9,
  });
  const visitor = async () => {
    const result = await session.runtime.getSnapshot();
    if (result.kind !== "running") throw new Error("起動していない");
    return result.runtime;
  };
  const latest = () => {
    const fake = runtimes.at(-1);
    if (!fake) throw new Error("起動していない");
    return fake;
  };
  return { session, workspace, saves, runtimes, booted, boot, visitor, latest };
}

/** 保存のための読み込みを始め、終わらせずに止める。破棄も止める。返す関数で、それぞれを終わらせる。 */
const holdSaveReadAndDispose = async (fake: Fake, stale: Record<string, string>) => {
  let finishRead: () => void = () => undefined;
  fake.readAll.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = () =>
          resolve(
            Object.entries(stale).map(([path, text]) => ({
              path,
              kind: "file",
              size: text.length,
              text,
            })),
          );
      }),
  );
  let release: () => void = () => undefined;
  vi.mocked(fake.runtime.dispose).mockReturnValueOnce(
    new Promise<void>((resolve) => (release = resolve)),
  );
  fake.change("index.js");
  await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
  return { finishRead: () => finishRead(), release: () => release() };
};

/** 起動と、起動の後のプロセスの起動が終わるまで進める。 */
const settle = async (session: NodeSession) => {
  await session.runtime.getSnapshot();
  await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("起動", () => {
  it("保存したファイルが無いときは、初期ファイルで起動し、シェル、npm install、起動のコマンドの順に起動する", async () => {
    const { session, booted, latest } = setup();
    await settle(session);
    expect({ booted, calls: latest().calls }).toStrictEqual({
      booted: [project.files],
      calls: [
        "shell",
        "npm install (npm install)",
        "node auth.js (認可サーバー)",
        "node client.js (クライアント)",
      ],
    });
  });

  it("npm install が失敗したときは、起動のコマンドを実行しない", async () => {
    const { session, latest } = setup({ kind: "empty" }, { installExit: 1 });
    await settle(session);
    expect(latest().calls).toStrictEqual(["shell", "npm install (npm install)"]);
  });

  it("保存したファイルがあるときは、保存したファイルで起動し、起動のコマンドを実行しない", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    expect({ booted, calls: latest().calls }).toStrictEqual({
      booted: [savedRecord.files],
      calls: ["shell", "npm install (npm install)"],
    });
  });

  it("IndexedDB を読めないときは、初期ファイルで起動し、canSave を false にする", async () => {
    const { session, booted } = setup({ kind: "unavailable" });
    await settle(session);
    expect({ booted, canSave: session.canSave }).toStrictEqual({
      booted: [project.files],
      canSave: false,
    });
  });

  it.each([
    ["文字列でない中身", { files: { "a.js": 1 }, version: "v1" }],
    ["親の階層を含むパス", { files: { "../a.js": "a" }, version: "v1" }],
    ["__proto__ のパス", JSON.parse('{"files":{"__proto__":"a"},"version":"v1"}')],
    ["文字列でない version", { files: {}, version: 1 }],
    ["ファイルとディレクトリが同じ名前のパス", { files: { a: "x", "a/b": "y" }, version: "v1" }],
    ["オブジェクトでない値", "x"],
  ])(
    "保存したレコードが %s を持つときは、保存したファイルが無いときと同じに扱う",
    async (_, record) => {
      const { session, booted, saves } = setup({ kind: "saved", record: record as NodeRecord });
      await settle(session);
      expect({ booted, hasSaved: session.hasSaved.getSnapshot(), saves }).toStrictEqual({
        booted: [project.files],
        hasSaved: false,
        saves: [],
      });
    },
  );

  it("保存したバージョンがプロジェクトと違うときは、versionChanged を true にする", async () => {
    const { session } = setup({ kind: "saved", record: { ...savedRecord, version: "v0" } });
    await settle(session);
    expect(session.versionChanged.getSnapshot()).toBe(true);
  });

  it("記事から開いていないプロジェクトでは、保存したバージョンが違っても versionChanged を true にしない", async () => {
    const { workspace } = fakeWorkspace();
    const session = createNodeSession({
      project,
      saved: { kind: "saved", record: { ...savedRecord, version: "v0" } },
      storage: workspace,
      boot: async ({ files }) => fakeRuntime(files, 0).runtime,
    });
    await settle(session);
    expect(session.versionChanged.getSnapshot()).toBe(false);
  });

  it("保存したレコードに保存しないパスがあるときは、除いたファイルで起動し、除いた後のレコードを書き直す", async () => {
    const record = {
      ...savedRecord,
      files: { "index.js": "b", ".env": "TOKEN=x", "dist/a.js": "d" },
    };
    const { session, booted, saves } = setup({ kind: "saved", record });
    await settle(session);
    expect({ booted, saved: saves.map((saved) => saved.files) }).toStrictEqual({
      booted: [{ "index.js": "b" }],
      saved: [{ "index.js": "b" }],
    });
  });

  it("書き直しが失敗したときは、次の変更で、読んだファイルのレコードを書く", async () => {
    const { workspace, saves } = fakeWorkspace();
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    const runtimes: Fake[] = [];
    const session = createNodeSession({
      project,
      saved: { kind: "saved", record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } } },
      storage: workspace,
      embedId: "oauth/demo",
      boot: async ({ files }) => {
        const fake = fakeRuntime(files, 0);
        runtimes.push(fake);
        return fake.runtime;
      },
    });
    await settle(session);
    runtimes[0]?.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((saved) => saved.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("保存しないファイルだけを持つレコードは、空の作業ディレクトリで起動し、空のレコードを書き直す", async () => {
    const record = { ...savedRecord, files: { ".env": "x" } };
    const { session, booted, saves, latest } = setup({ kind: "saved", record });
    await settle(session);
    expect({
      booted,
      saved: saves.map((saved) => saved.files),
      calls: latest().calls,
    }).toStrictEqual({ booted: [{}], saved: [{}], calls: ["shell", "npm install (npm install)"] });
  });

  it("保存したレコードに保存しないパスが無いときは、起動のときに書き直さない", async () => {
    const { session, saves } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    expect(saves).toStrictEqual([]);
  });

  it("起動できないときは、理由を返す", async () => {
    const { workspace } = fakeWorkspace();
    const session = createNodeSession({
      project,
      saved: { kind: "empty" },
      storage: workspace,
      boot: async () => {
        throw new BootError("not-isolated");
      },
    });
    expect(await session.runtime.getSnapshot()).toStrictEqual({
      kind: "unavailable",
      reason: "not-isolated",
    });
  });
});

describe("保存", () => {
  it("保存のための読み込みが上限までに終わらないときは、次の変更で保存する", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + READ_TIMEOUT_MS);
    latest().change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "d" }]);
  });

  it("訪問者が操作する前の変更は、保存しない", async () => {
    const { session, saves, latest } = setup();
    await settle(session);
    latest().change("package-lock.json", "{}");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("訪問者がファイルに書いた後の変更は、待つ間の通知をまとめて 1 回保存する", async () => {
    const { session, saves, visitor, latest } = setup();
    await settle(session);
    await (await visitor()).files.write("index.js", "c");
    latest().change("index.js");
    latest().change("package-lock.json", "{}");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([
      {
        files: { "index.js": "c", "package.json": "{}", "package-lock.json": "{}" },
        version: "v1",
        savedAt: 9,
      },
    ]);
  });

  it("通知が続いても、最初の通知から上限の時間のうちに保存する", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    for (let i = 0; i < SAVE_MAX_DELAY_MS / (SAVE_DELAY_MS / 2); i++) {
      latest().change("index.js", String(i));
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS / 2);
    }
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "7" }]);
  });

  it("読み込みの途中に保存の時が来たときは、読み終えてから 1 回だけ読み直す", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    let release: () => void = () => undefined;
    fake.readAll.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return [{ path: "index.js", kind: "file", size: 1, text: "old" }];
    });
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fake.change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect({
      saves: saves.map((record) => record.files),
      reads: fake.readAll.mock.calls.length,
    }).toStrictEqual({
      saves: [{ "index.js": "old" }, { "index.js": "d" }],
      reads: 2,
    });
  });

  it("端末への入力の後の変更も保存する", async () => {
    const { session, saves, visitor, latest } = setup();
    await settle(session);
    const shell = (await visitor()).processes.get("0");
    shell?.write("touch a\r");
    latest().change("a", "");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => Object.keys(record.files))).toStrictEqual([
      ["index.js", "package.json", "a"],
    ]);
  });

  it("node_modules の下だけの通知では、保存しない", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().change("node_modules/ms/index.js");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("前に保存した中身と同じときは、保存しない", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().contents.clear();
    latest().change("index.js", "b");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("保存してあったバージョンを、次の保存に引き継ぐ", async () => {
    const { session, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, version: "v0" },
    });
    await settle(session);
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.version)).toStrictEqual(["v0"]);
  });

  it("保存が失敗した後は、同じ中身でも次の変更で書き直す", async () => {
    const { session, workspace, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    workspace.save.mockRejectedValueOnce(new Error("QuotaExceededError"));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    latest().change("index.js");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("IndexedDB を読めないときは、保存しても hasSaved を true にしない", async () => {
    const { session, visitor, latest } = setup({ kind: "unavailable" });
    await settle(session);
    await (await visitor()).files.write("index.js", "c");
    latest().change("index.js");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(session.hasSaved.getSnapshot()).toBe(false);
  });

  it("保存すると、hasSaved を true にする", async () => {
    const { session, visitor, latest } = setup();
    await settle(session);
    await (await visitor()).files.write("index.js", "c");
    latest().change("index.js");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(session.hasSaved.getSnapshot()).toBe(true);
  });
});

describe("保存しないファイル", () => {
  /** 保存しないファイルを、作業ディレクトリに置く。 */
  const putUnsaved = (fake: Fake) => {
    fake.contents.set(".env", "TOKEN=x");
    fake.contents.set("dist/a.js", "d");
    fake.contents.set(".git/HEAD", "ref");
    fake.contents.set("link.txt", "outside");
    fake.links.add("link.txt");
  };

  it("`.env`、`dist/`、`.git`、リンクは保存しない。起動し直した後の作業ディレクトリには、リンクのほかを残す", async () => {
    const { session, saves, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    putUnsaved(latest());
    latest().contents.set("index.js", "c");
    await session.restart();
    expect({ saved: saves.at(-1)?.files, booted: booted.at(-1) }).toStrictEqual({
      saved: { "index.js": "c" },
      booted: {
        "index.js": "c",
        ".env": "TOKEN=x",
        "dist/a.js": "d",
        ".git/HEAD": "ref",
      },
    });
  });

  it("保存しないパスだけの変更の通知では、作業ディレクトリを読まない", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    fake.change(".env", "TOKEN=x");
    fake.change("dist/a.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(fake.readAll).not.toHaveBeenCalled();
  });

  /** 作業ディレクトリのファイルを、保存の上限を超える数にする。 */
  const fillOverLimit = (fake: Fake) => {
    for (let i = 0; i < SAVE_LIMIT.files; i++) fake.contents.set(`f/${i}.txt`, "");
  };

  it("上限を超えたら、保存せずに前のレコードを残し、overLimit を立てる", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    fillOverLimit(latest());
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect({ saves: saves.length, overLimit: session.overLimit.getSnapshot() }).toStrictEqual({
      saves: 0,
      overLimit: true,
    });
  });

  it("上限を超えた後に下回ったら、保存して overLimit を戻す", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    fillOverLimit(fake);
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    for (let i = 0; i < SAVE_LIMIT.files; i++) fake.contents.delete(`f/${i}.txt`);
    fake.change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect({
      saves: saves.map((record) => record.files),
      overLimit: session.overLimit.getSnapshot(),
    }).toStrictEqual({ saves: [{ "index.js": "d" }], overLimit: false });
  });

  it("書き直しが失敗した後に上限を超えても、除いた後のレコードを書く", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    fillOverLimit(latest());
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect({
      saves: saves.map((record) => record.files),
      overLimit: session.overLimit.getSnapshot(),
    }).toStrictEqual({ saves: [{ "index.js": "b" }], overLimit: true });
  });

  it("書き直しが失敗した後に、保存のための読み込みが失敗しても、除いた後のレコードを書く", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    latest().readAll.mockRejectedValueOnce(new Error("ELOOP"));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "b" }]);
  });

  it("書き直しが失敗した後に、起動し直す前の読み込みが失敗しても、除いた後のレコードを書く", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    latest().readAll.mockRejectedValueOnce(new Error("ELOOP"));
    await session.restart();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "b" }]);
  });

  it("書き直しが失敗した後に、初期の状態に戻す途中で保存のための読み込みが失敗しても、除いた後のレコードを書かない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    let failRead: (error: Error) => void = () => undefined;
    latest().readAll.mockImplementationOnce(() => new Promise((_, reject) => (failRead = reject)));
    let finishClear: () => void = () => undefined;
    workspace.clear.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (finishClear = () => resolve(undefined))),
    );
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const reset = session.reset();
    await vi.advanceTimersByTimeAsync(0);
    failRead(new Error("ELOOP"));
    await vi.advanceTimersByTimeAsync(0);
    finishClear();
    await reset;
    await vi.advanceTimersByTimeAsync(0);
    expect({ saves: saves.length, hasSaved: session.hasSaved.getSnapshot() }).toStrictEqual({
      saves: 0,
      hasSaved: false,
    });
  });

  it("書き直しが失敗した後に新しい保存がキューにあれば、保存しないパスだけの通知が来ても、除いた後のレコードを書かない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    let finish: () => void = () => undefined;
    workspace.save.mockImplementationOnce(async (record) => {
      await new Promise<void>((resolve) => (finish = resolve));
      saves.push(record);
    });
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("書き直しが失敗した後に、保存しないパスだけの通知が来ても、除いた後のレコードを書く", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    expect({
      saves: saves.map((record) => record.files),
      reads: latest().readAll.mock.calls.length,
    }).toStrictEqual({ saves: [{ "index.js": "b" }], reads: 0 });
  });

  it("書き直しを書いている間は、保存しないパスだけの通知が来ても、書き直しを重ねない", async () => {
    const { session, workspace, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    let finish: () => void = () => undefined;
    workspace.save.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    latest().change("node_modules/ms/index.js", "y");
    latest().change("dist/a.js", "z");
    await vi.advanceTimersByTimeAsync(0);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(workspace.save.mock.calls.length).toBe(2);
  });

  it("訪問者の変更の保存が失敗した後に、書き直しが通っても、保存の失敗の案内を消さない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    expect({
      saves: saves.map((record) => record.files),
      failed: session.saveFailed.getSnapshot(),
    }).toStrictEqual({ saves: [{ "index.js": "b" }], failed: true });
  });

  it("書き直しを書いている間に訪問者の保存が待ちに入っても、書き直しが通ったときに、訪問者の保存の失敗の案内を消さない", async () => {
    const { session, workspace, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    let finishRewrite: () => void = () => undefined;
    workspace.save.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishRewrite = resolve)),
    );
    workspace.save.mockImplementationOnce(() => new Promise<void>(() => undefined));
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    latest().change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    finishRewrite();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.saveFailed.getSnapshot()).toBe(true);
  });

  it("書き直しの失敗だけで出た保存の失敗の案内は、書き直しが通ると消す", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    const before = session.saveFailed.getSnapshot();
    latest().change("node_modules/ms/index.js", "x");
    await vi.advanceTimersByTimeAsync(0);
    expect({
      before,
      saves: saves.map((record) => record.files),
      failed: session.saveFailed.getSnapshot(),
    }).toStrictEqual({ before: true, saves: [{ "index.js": "b" }], failed: false });
  });

  it("起動に失敗した実行環境を起動し直すときも、書き直しが失敗していれば、除いた後のレコードを書く", async () => {
    const { workspace, saves } = fakeWorkspace();
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    const boot = vi.fn(async ({ files }: BootOptions) => fakeRuntime(files, 0).runtime);
    boot.mockRejectedValueOnce(new Error("起動できない"));
    const session = createNodeSession({
      project,
      saved: { kind: "saved", record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } } },
      storage: workspace,
      embedId: "oauth/demo",
      boot,
    });
    await settle(session);
    await session.restart();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "b" }]);
  });

  it("書き直しが失敗した後の保存が終わる前に上限を超えても、古いレコードで置き換えない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    let finish: () => void = () => undefined;
    workspace.save.mockImplementationOnce(async (record) => {
      await new Promise<void>((resolve) => (finish = resolve));
      saves.push(record);
    });
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fillOverLimit(latest());
    latest().change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("書き直しが終わる前に新しい保存が待ちに入り、書き直しが失敗した後に上限を超えても、古いレコードで置き換えない", async () => {
    const { workspace, saves } = fakeWorkspace();
    let fail: (error: Error) => void = () => undefined;
    let finish: () => void = () => undefined;
    workspace.save
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)))
      .mockImplementationOnce(async (record) => {
        await new Promise<void>((resolve) => (finish = resolve));
        saves.push(record);
      });
    const runtimes: Fake[] = [];
    const session = createNodeSession({
      project,
      saved: { kind: "saved", record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } } },
      storage: workspace,
      embedId: "oauth/demo",
      boot: async ({ files }) => {
        const fake = fakeRuntime(files, 0);
        runtimes.push(fake);
        return fake.runtime;
      },
    });
    await settle(session);
    const fake = runtimes[0];
    if (!fake) throw new Error("起動していない");
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fail(new Error("容量の超過"));
    await vi.advanceTimersByTimeAsync(0);
    fillOverLimit(fake);
    fake.change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("保存が終わる前に同じ中身の保存が待ちに入り、前の保存が失敗した後に上限を超えても、古いレコードで置き換えない", async () => {
    const { workspace, saves } = fakeWorkspace();
    let fail: (error: Error) => void = () => undefined;
    let finish: () => void = () => undefined;
    workspace.save
      .mockRejectedValueOnce(new Error("容量の超過"))
      .mockImplementationOnce(() => new Promise<void>((_, reject) => (fail = reject)))
      .mockImplementationOnce(async (record) => {
        await new Promise<void>((resolve) => (finish = resolve));
        saves.push(record);
      });
    const runtimes: Fake[] = [];
    const session = createNodeSession({
      project,
      saved: { kind: "saved", record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } } },
      storage: workspace,
      embedId: "oauth/demo",
      boot: async ({ files }) => {
        const fake = fakeRuntime(files, 0);
        runtimes.push(fake);
        return fake.runtime;
      },
    });
    await settle(session);
    const fake = runtimes[0];
    if (!fake) throw new Error("起動していない");
    fake.change("index.js", "a");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fake.change("index.js", "a");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fail(new Error("容量の超過"));
    await vi.advanceTimersByTimeAsync(0);
    fillOverLimit(fake);
    fake.change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "a" }]);
  });

  it("書き直しの後の保存が成功すれば、次の保存が失敗した後に上限を超えても書き直さない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    latest().change("index.js", "d");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    fillOverLimit(latest());
    latest().change("index.js", "e");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("書き直しが通った後は、上限を超えても書き直さない", async () => {
    const { session, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    await settle(session);
    fillOverLimit(latest());
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "b" }]);
  });

  it("書き直しが失敗した後に初期の状態に戻すと、上限を超えても書き直さない", async () => {
    const { session, workspace, saves, latest } = setup({
      kind: "saved",
      record: { ...savedRecord, files: { "index.js": "b", ".env": "x" } },
    });
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    await settle(session);
    await session.reset();
    await settle(session);
    // 戻した後は操作するまで保存しないので、実行のボタンで操作した扱いにする
    await session.run();
    fillOverLimit(latest());
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("初期の状態に戻すと、overLimit を戻す", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    fillOverLimit(latest());
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    await session.reset();
    expect(session.overLimit.getSnapshot()).toBe(false);
  });

  it("保存のための読み込みには上限を渡し、起動し直すときの読み込みには渡さない", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    await session.restart();
    expect(fake.readAll.mock.calls.map(([options]) => options?.limit)).toStrictEqual([
      SAVE_LIMIT,
      undefined,
    ]);
  });

  it("初期の状態に戻した後に、前の実行環境の保存の読み込みが終わっても、overLimit を立てない", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    let fail: () => void = () => undefined;
    fake.readAll.mockImplementationOnce(
      () => new Promise((_, reject) => (fail = () => reject(new ReadLimitError()))),
    );
    fake.change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    await session.reset();
    fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.overLimit.getSnapshot()).toBe(false);
  });

  it("上限を超えたまま起動し直しても、保存しない", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    for (let i = 0; i < SAVE_LIMIT.files; i++) latest().contents.set(`f/${i}.txt`, "");
    await session.restart();
    expect({ saves: saves.length, overLimit: session.overLimit.getSnapshot() }).toStrictEqual({
      saves: 0,
      overLimit: true,
    });
  });
});

describe("restart", () => {
  it("訪問者が操作した後なら、起動し直す前に読んだファイルを保存する", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().contents.set("index.js", "c");
    await session.restart();
    expect(saves.map((record) => record.files)).toStrictEqual([{ "index.js": "c" }]);
  });

  it("作業ディレクトリのファイルを読み、古い実行環境を破棄し、そのファイルで起動し直し、起動のコマンドは実行しない", async () => {
    const { session, booted, runtimes, latest } = setup();
    await settle(session);
    latest().contents.set("new.js", "n");
    await session.restart();
    await vi.advanceTimersByTimeAsync(0);
    expect({
      booted: booted.at(-1),
      disposed: runtimes[0]?.calls.at(-1),
      calls: latest().calls,
    }).toStrictEqual({
      booted: { "index.js": "a", "package.json": "{}", "new.js": "n" },
      disposed: "dispose",
      calls: ["shell", "npm install (npm install)"],
    });
  });

  it("作業ディレクトリを上限までに読めず、保存のために読んだ結果も無いときは、前に起動したときのファイルで起動し直す", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    expect({
      booted: booted.at(-1),
      readFailed: session.restartReadFailed.getSnapshot(),
    }).toStrictEqual({ booted: savedRecord.files, readFailed: true });
  });

  it("作業ディレクトリの読み込みが失敗したときは、前に起動したときのファイルで起動し直し、restartReadFailed を立てる", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockRejectedValueOnce(new Error("EIO"));
    await session.restart();
    expect({
      booted: booted.at(-1),
      readFailed: session.restartReadFailed.getSnapshot(),
    }).toStrictEqual({ booted: savedRecord.files, readFailed: true });
  });

  it("続けて読めなかったときは、restartReadFailed を false に戻してから、もう 1 度立てる", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const values: boolean[] = [];
    session.restartReadFailed.subscribe(() => values.push(session.restartReadFailed.getSnapshot()));
    for (let i = 0; i < 2; i++) {
      latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
      const restarted = session.restart();
      await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
      await restarted;
    }
    expect(values).toStrictEqual([true, false, true]);
  });

  it("作業ディレクトリを読めて起動し直すと、restartReadFailed を false に戻す", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    await session.restart();
    expect(session.restartReadFailed.getSnapshot()).toBe(false);
  });

  it("初期の状態に戻すと、restartReadFailed を false に戻す", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    await session.reset();
    expect(session.restartReadFailed.getSnapshot()).toBe(false);
  });

  it("作業ディレクトリを読めずに起動し直した後の保存は、保存したファイルを初期ファイルで上書きしない", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    latest().change("package-lock.json", "{}");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.at(-1)?.files).toStrictEqual({ "index.js": "b", "package-lock.json": "{}" });
  });

  it("訪問者が操作する前なら、起動し直しても保存しない", async () => {
    const { session, saves, latest } = setup();
    await settle(session);
    latest().contents.set("index.js", "c");
    await session.restart();
    expect(saves).toStrictEqual([]);
  });

  it("作業ディレクトリを上限までに読めないときは、保存のために最後に読んだファイルで起動し直す", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    expect({
      booted: booted.at(-1),
      readFailed: session.restartReadFailed.getSnapshot(),
    }).toStrictEqual({ booted: { "index.js": "c" }, readFailed: true });
  });

  it("起動に失敗した実行環境を起動し直すときは、作業ディレクトリを読まず、案内を変えない", async () => {
    const { session, boot, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    boot.mockRejectedValueOnce(new Error("起動できない"));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    await session.restart();
    expect({
      booted: booted.at(-1),
      readFailed: session.restartReadFailed.getSnapshot(),
    }).toStrictEqual({ booted: savedRecord.files, readFailed: true });
  });

  it("起動し直している間に重ねて呼んでも、1 回だけ起動し直す", async () => {
    const { session, boot } = setup();
    await settle(session);
    await Promise.all([session.restart(), session.restart()]);
    expect(boot.mock.calls.length).toBe(2);
  });

  it("起動し直すと、commandFailed を false に戻す", async () => {
    const { session, latest } = setup();
    await settle(session);
    vi.mocked(latest().runtime.processes.start).mockRejectedValueOnce(new Error("起動できない"));
    await session.run().catch(() => undefined);
    await session.restart();
    expect(session.commandFailed.getSnapshot()).toBe(false);
  });

  it("起動し直している間は busy を true にし、終わると false に戻す", async () => {
    const { session } = setup();
    await settle(session);
    const seen: boolean[] = [];
    session.busy.subscribe(() => seen.push(session.busy.getSnapshot()));
    await session.restart();
    expect(seen).toStrictEqual([true, false]);
  });

  it("破棄している間に前の保存の読み込みが終わっても、次に読めないときは起動し直す前に読んだファイルで起動する", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const fake = latest();
    const held = await holdSaveReadAndDispose(fake, { "index.js": "old" });
    fake.contents.set("index.js", "c");
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(0);
    held.finishRead();
    await vi.advanceTimersByTimeAsync(0);
    held.release();
    await restarted;
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const again = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await again;
    expect(booted.at(-1)).toStrictEqual({ "index.js": "c" });
  });
});

describe("reset", () => {
  it("保存したファイルを消し、初期ファイルで起動し直して、起動のコマンドも実行する", async () => {
    const { session, workspace, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    await session.reset();
    await vi.advanceTimersByTimeAsync(0);
    expect({
      cleared: workspace.clear.mock.calls.length,
      booted: booted.at(-1),
      calls: latest().calls,
      hasSaved: session.hasSaved.getSnapshot(),
    }).toStrictEqual({
      cleared: 1,
      booted: project.files,
      calls: [
        "shell",
        "npm install (npm install)",
        "node auth.js (認可サーバー)",
        "node client.js (クライアント)",
      ],
      hasSaved: false,
    });
  });

  it("戻した後は、訪問者が操作するまで、変更を保存しない", async () => {
    const { session, saves, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    await session.reset();
    latest().change("package-lock.json", "{}");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("戻す前に予約した保存は、消した後に書かない", async () => {
    const { session, saves, runtimes } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    runtimes[0]?.change("index.js", "c");
    await session.reset();
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("保存したファイルを消せないときは、失敗し、起動し直さずに保存を続ける", async () => {
    const { session, workspace, saves, boot, latest } = setup({
      kind: "saved",
      record: savedRecord,
    });
    await settle(session);
    workspace.clear.mockRejectedValueOnce(new Error("消せない"));
    const error = await session.reset().catch((reason: Error) => reason.message);
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect({
      error,
      boots: boot.mock.calls.length,
      saves: saves.map((record) => record.files),
    }).toStrictEqual({
      error: "消せない",
      boots: 1,
      saves: [{ "index.js": "b" }, { "index.js": "c" }],
    });
  });

  it("保存したファイルを消せないときは、commandFailed を戻さない", async () => {
    const { session, workspace, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    vi.mocked(latest().runtime.processes.start).mockRejectedValueOnce(new Error("起動できない"));
    await session.run().catch(() => undefined);
    workspace.clear.mockRejectedValueOnce(new Error("消せない"));
    await session.reset().catch(() => undefined);
    expect(session.commandFailed.getSnapshot()).toBe(true);
  });

  it("訪問者が操作する前に消せなかったときは、作業ディレクトリを読み直さない", async () => {
    const { session, workspace, latest } = setup();
    await settle(session);
    workspace.clear.mockRejectedValueOnce(new Error("消せない"));
    await session.reset().catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(latest().readAll.mock.calls.length).toBe(0);
  });

  it("消せなかったときの読み込みが終わらなくても、失敗を返して busy を false に戻す", async () => {
    const { session, workspace, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    workspace.clear.mockRejectedValueOnce(new Error("消せない"));
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    await session.reset().catch(() => undefined);
    expect(session.busy.getSnapshot()).toBe(false);
  });

  it("訪問者の変更の保存が失敗した後に戻すと、saveFailed を false にする", async () => {
    const { session, workspace, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    workspace.save.mockRejectedValueOnce(new Error("容量の超過"));
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    const before = session.saveFailed.getSnapshot();
    await session.reset();
    expect({ before, after: session.saveFailed.getSnapshot() }).toStrictEqual({
      before: true,
      after: false,
    });
  });

  it("戻すと、versionChanged を false にする", async () => {
    const { session } = setup({ kind: "saved", record: { ...savedRecord, version: "v0" } });
    await settle(session);
    await session.reset();
    expect(session.versionChanged.getSnapshot()).toBe(false);
  });

  it("戻している間に、前の実行環境へ入力しても、戻した後の変更を保存しない", async () => {
    const { session, saves, visitor, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const old = await visitor();
    const resetting = session.reset();
    void old.files.write("index.js", "x");
    await resetting;
    latest().change("package-lock.json", "{}");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves).toStrictEqual([]);
  });

  it("破棄している間に前の保存の読み込みが終わっても、戻した後に読めないときは初期ファイルで起動する", async () => {
    const { session, booted, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    const held = await holdSaveReadAndDispose(latest(), { "index.js": "old" });
    const resetting = session.reset();
    await vi.advanceTimersByTimeAsync(0);
    held.finishRead();
    await vi.advanceTimersByTimeAsync(0);
    held.release();
    await resetting;
    latest().readAll.mockReturnValueOnce(new Promise(() => undefined));
    const restarted = session.restart();
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await restarted;
    expect(booted.at(-1)).toStrictEqual(project.files);
  });
});

describe("run", () => {
  it("初めて開いた後の npm install の途中に押しても、動いている起動のコマンドは 1 組だけである", async () => {
    let installed: (code: number) => void = () => undefined;
    const { session, latest } = setup(
      { kind: "empty" },
      { installExit: new Promise<number>((resolve) => (installed = resolve)) },
    );
    await settle(session);
    const running = session.run();
    installed(0);
    await running;
    const commands = latest().handles.slice(2);
    expect(commands.map((handle) => handle.killed)).toStrictEqual([true, true, false, false]);
  });

  it("自動の実行で起動のコマンドを起動できないときは、commandFailed を true にする", async () => {
    let installed: (code: number) => void = () => undefined;
    const { session, latest } = setup(
      { kind: "empty" },
      { installExit: new Promise<number>((resolve) => (installed = resolve)) },
    );
    await settle(session);
    vi.mocked(latest().runtime.processes.start).mockRejectedValue(new Error("起動できない"));
    installed(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(session.commandFailed.getSnapshot()).toBe(true);
  });

  it("起動の途中に押したときは、起動を待ってから実行する", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await session.run();
    expect(latest().calls.slice(2)).toStrictEqual([
      "node auth.js (認可サーバー)",
      "node client.js (クライアント)",
    ]);
  });

  it("押した後の変更は、保存する", async () => {
    const { session, saves, latest } = setup();
    await settle(session);
    await session.run();
    latest().change("index.js", "c");
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(saves.length).toBe(1);
  });

  it("前の起動のコマンドを止めてから、起動のコマンドを実行する", async () => {
    const { session, latest } = setup();
    await settle(session);
    const before = latest().handles.slice(2);
    await session.run();
    expect({
      killed: before.map((handle) => handle.killed),
      calls: latest().calls.slice(4),
    }).toStrictEqual({
      killed: [true, true],
      calls: ["node auth.js (認可サーバー)", "node client.js (クライアント)"],
    });
  });

  it("保存したファイルがあるときも、押すと起動のコマンドを実行する", async () => {
    const { session, latest } = setup({ kind: "saved", record: savedRecord });
    await settle(session);
    await session.run();
    expect(latest().calls.slice(2)).toStrictEqual([
      "node auth.js (認可サーバー)",
      "node client.js (クライアント)",
    ]);
  });
});

describe("createNodeSessionOpener", () => {
  const opened = (embedId?: string) =>
    Promise.resolve<ProjectLoad<"node">>({ kind: "opened", project, embedId });

  it("埋め込みの ID の保存先を開き、同じ埋め込みの ID には同じ Promise を返す", async () => {
    const load = opened("c/e");
    const { workspace } = fakeWorkspace();
    const openWorkspace = vi.fn(() => workspace);
    const create = vi.fn<(options: NodeSessionOptions) => NodeSession>(() => ({}) as NodeSession);
    const open = createNodeSessionOpener(() => load, openWorkspace, create);
    const first = open("?project=c/e");
    expect({
      same: first === open("?project=c/e"),
      embedId: openWorkspace.mock.calls,
    }).toStrictEqual({ same: true, embedId: [["c/e"]] });
  });

  it("形に合わない埋め込みの ID では、保存先を開かない", async () => {
    const openWorkspace = vi.fn(() => fakeWorkspace().workspace);
    const open = createNodeSessionOpener(
      () => Promise.resolve({ kind: "failed", embedId: "../x" }),
      openWorkspace,
    );
    expect({ load: await open("?project=../x"), calls: openWorkspace.mock.calls }).toStrictEqual({
      load: { kind: "failed", embedId: "../x" },
      calls: [],
    });
  });

  it("保存したレコードを読んでから、NodeSession を作る", async () => {
    const { workspace } = fakeWorkspace();
    const saved = { kind: "saved", record: savedRecord } as const;
    const create = vi.fn<(options: NodeSessionOptions) => NodeSession>(() => ({}) as NodeSession);
    const open = createNodeSessionOpener(
      () => opened(undefined),
      () => ({ ...workspace, load: async () => saved }),
      create,
    );
    await open("");
    expect(create.mock.calls[0]?.[0].saved).toStrictEqual(saved);
  });

  it("プロジェクトの埋め込みの ID を NodeSession に渡す", async () => {
    const create = vi.fn<(options: NodeSessionOptions) => NodeSession>(() => ({}) as NodeSession);
    const open = createNodeSessionOpener(
      () => opened("c/e"),
      () => fakeWorkspace().workspace,
      create,
    );
    await open("?project=c/e");
    expect(create.mock.calls[0]?.[0].embedId).toBe("c/e");
  });
});

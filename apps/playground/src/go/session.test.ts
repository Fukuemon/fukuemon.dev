import type { GoExit, GoFiles, GoRunner, LoadPhase } from "@fukuemon/go-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProjectLoad } from "../project/project";
import type { Workspace, WorkspaceLoad } from "../workspace/workspace";
import { type GoRecord, OUTPUT_LIMIT, createGoSession, createGoSessionOpener } from "./session";

const project = {
  tool: "go",
  version: "v1",
  files: { "main.go": "package main", "a/a.go": "package a" },
  open: "main.go",
} as const;

type Pending = {
  files: GoFiles;
  onOutput: (chunk: string) => void;
  finish: (exit: GoExit) => void;
};

function fakeRunner() {
  const calls: { kind: "run" | "test"; pending: Pending }[] = [];
  const stop = vi.fn();
  const start = (kind: "run" | "test") => (files: GoFiles, onOutput: (c: string) => void) => {
    let finish: (exit: GoExit) => void = () => {};
    const done = new Promise<GoExit>((resolve) => (finish = resolve));
    calls.push({ kind, pending: { files, onOutput, finish } });
    return {
      done,
      stop: () => {
        stop();
        finish({ kind: "stopped" });
      },
    };
  };
  const runner: GoRunner = {
    phase: { subscribe: () => () => {}, getSnapshot: (): LoadPhase => ({ kind: "idle" }) },
    load: vi.fn(async () => {}),
    run: start("run"),
    test: start("test"),
  };
  return { runner, calls, stop };
}

function fakeWorkspace() {
  const saved: GoRecord[] = [];
  const workspace: Workspace<GoRecord> = {
    load: async () => ({ kind: "empty" }),
    save: vi.fn(async (record: GoRecord) => {
      saved.push(record);
    }),
  };
  return { workspace, saved };
}

function setup(saved: WorkspaceLoad<GoRecord> = { kind: "empty" }) {
  const { runner, calls, stop } = fakeRunner();
  const { workspace, saved: records } = fakeWorkspace();
  const session = createGoSession({
    project,
    embedId: "c/e",
    saved,
    storage: workspace,
    runner,
    now: () => 42,
  });
  return { session, calls, stop, records };
}

describe("createGoSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("保存したファイルが無いときは、プロジェクトのファイルで開く", () => {
    const { session } = setup();
    expect(session.fileSet.getSnapshot()).toStrictEqual({ files: project.files, directories: [] });
    expect([session.openPath, session.canSave, session.embedId]).toStrictEqual([
      "main.go",
      true,
      "c/e",
    ]);
  });

  it("保存したファイルがあるときは、それで開き、open が無ければ最初のファイルを開く", () => {
    const record = { version: "v0", savedAt: 1, files: { "b.go": "b" }, directories: ["d"] };
    const { session } = setup({ kind: "saved", record });
    expect(session.fileSet.getSnapshot()).toStrictEqual({
      files: { "b.go": "b" },
      directories: ["d"],
    });
    expect(session.openPath).toBe("b.go");
  });

  it.each([
    ["null", null],
    ["文字列でない中身", { version: "v", files: { "a.go": 1 }, directories: [] }],
    ["配列でないディレクトリ", { version: "v", files: {}, directories: "x" }],
    ["親の階層を含むパス", { version: "v", files: { "../a.go": "a" }, directories: [] }],
    ["正規化していないディレクトリ", { version: "v", files: {}, directories: ["./d"] }],
    ["文字列でない version", { version: 1, files: {}, directories: [] }],
  ])("保存した値が %s のときは、プロジェクトのファイルで開く", (_, record) => {
    const { session } = setup({ kind: "saved", record: record as unknown as GoRecord });
    expect(session.fileSet.getSnapshot().files).toStrictEqual(project.files);
  });

  it("IndexedDB を読めないときは canSave を false にする", () => {
    expect(setup({ kind: "unavailable" }).session.canSave).toBe(false);
  });

  it("ファイルを変えると、ストアを変える", () => {
    const { session } = setup();
    session.write("b.go", "b");
    session.createDirectory("empty");
    session.rename("b.go", "c.go");
    session.remove("a");
    expect(session.fileSet.getSnapshot()).toStrictEqual({
      files: { "main.go": "package main", "c.go": "b" },
      directories: ["empty"],
    });
  });

  it("保存の途中の変更は、最新の 1 件だけを、保存が終わってから丸ごと書く", async () => {
    const { session, records } = setup();
    session.write("b.go", "1");
    session.write("b.go", "2");
    session.write("b.go", "3");
    await vi.waitFor(() => expect(records).toHaveLength(2));
    expect(records.map((record) => record.files["b.go"])).toStrictEqual(["1", "3"]);
  });

  it("保存するレコードは、ファイルとディレクトリの一式と、バージョンと、時刻を持つ", () => {
    const { session, records } = setup();
    session.createDirectory("empty");
    expect(records[0]).toStrictEqual({
      files: project.files,
      directories: ["empty"],
      version: "v1",
      savedAt: 42,
    });
  });

  it("createFile は、既にあるファイルを空にしない", () => {
    const { session } = setup();
    session.createFile("main.go");
    expect(session.read("main.go")).toBe("package main");
  });

  it("保存してあったバージョンを引き継いで保存する", () => {
    const record = { version: "v0", savedAt: 1, files: { "b.go": "b" }, directories: [] };
    const { session, records } = setup({ kind: "saved", record });
    session.write("b.go", "c");
    expect(records.at(-1)?.version).toBe("v0");
  });

  it("保存に失敗したら saveFailed を true にし、次の保存が通ったら false に戻す", async () => {
    const { runner } = fakeRunner();
    const save = vi
      .fn<Workspace<GoRecord>["save"]>()
      .mockRejectedValueOnce(new Error("QuotaExceededError"))
      .mockResolvedValue(undefined);
    const session = createGoSession({
      project,
      embedId: undefined,
      saved: { kind: "empty" },
      storage: { load: async () => ({ kind: "empty" }), save },
      runner,
    });
    const seen: boolean[] = [];
    session.saveFailed.subscribe(() => seen.push(session.saveFailed.getSnapshot()));
    session.write("a.go", "1");
    await vi.waitFor(() => expect(seen).toHaveLength(1));
    session.write("a.go", "2");
    await vi.waitFor(() => expect(seen).toStrictEqual([true, false]));
  });

  it("実行が失敗で終わっても、実行中の値を戻し、failed を返す", async () => {
    const { runner } = fakeRunner();
    runner.run = () => ({ done: Promise.reject(new Error("boom")), stop: () => {} });
    const { workspace } = fakeWorkspace();
    const session = createGoSession({
      project,
      embedId: undefined,
      saved: { kind: "empty" },
      storage: workspace,
      runner,
    });
    const result = await session.run();
    expect([result, session.running.getSnapshot()]).toStrictEqual([
      { kind: "done", exit: { kind: "failed", message: "boom" }, output: "", truncated: false },
      false,
    ]);
  });

  it("実行を始められないときも、実行中の値を戻す", async () => {
    const { runner } = fakeRunner();
    runner.test = () => {
      throw new Error("no worker");
    };
    const { workspace } = fakeWorkspace();
    const session = createGoSession({
      project,
      embedId: undefined,
      saved: { kind: "empty" },
      storage: workspace,
      runner,
    });
    await expect(session.test()).rejects.toThrow("no worker");
    expect(session.running.getSnapshot()).toBe(false);
  });

  it("失敗した変更は、保存しない", () => {
    const { session, records } = setup();
    expect(session.write("a", "x")).toStrictEqual({ ok: false, reason: "「a」はディレクトリです" });
    expect(records).toHaveLength(0);
  });

  it("read はファイルの中身を返し、ディレクトリと無いパスは undefined を返す。list は path の下を返す", () => {
    const { session } = setup();
    expect([session.read("./main.go"), session.read("a"), session.read("../x")]).toStrictEqual([
      "package main",
      undefined,
      undefined,
    ]);
    expect(session.list("a")).toStrictEqual([{ path: "a/a.go", kind: "file" }]);
    expect(session.list()).toHaveLength(3);
  });

  it("run は実行中の値を変え、出力を貯めて、終わり方と出力を返す", async () => {
    const { session, calls } = setup();
    const result = session.run();
    expect(session.running.getSnapshot()).toBe(true);
    expect(await session.run()).toStrictEqual({ kind: "busy" });
    const { pending } = calls[0]!;
    pending.onOutput("hello\n");
    pending.finish({ kind: "exited", exitCode: 0 });
    expect(await result).toStrictEqual({
      kind: "done",
      exit: { kind: "exited", exitCode: 0 },
      output: "hello\n",
      truncated: false,
    });
    expect(session.running.getSnapshot()).toBe(false);
    expect(session.output.getSnapshot()).toMatchObject({ kind: "run", text: "hello\n" });
  });

  it("実行を始めたときのファイルの写しを渡し、test は test を呼ぶ", async () => {
    const { session, calls } = setup();
    const result = session.test();
    session.write("main.go", "changed");
    expect(calls[0]).toMatchObject({ kind: "test", pending: { files: project.files } });
    calls[0]!.pending.finish({ kind: "exited", exitCode: 1 });
    expect(await result).toMatchObject({ exit: { kind: "exited", exitCode: 1 } });
  });

  it("時間の上限を過ぎたら止めて、timeout を返す", async () => {
    vi.useFakeTimers();
    const { session, stop } = setup();
    const result = session.run({ timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ exit: { kind: "timeout" } });
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("stop は実行中の実行を止め、実行していないときは何もしない", async () => {
    const { session, stop } = setup();
    session.stop();
    expect(stop).not.toHaveBeenCalled();
    const result = session.run();
    session.stop();
    expect(await result).toMatchObject({ exit: { kind: "stopped" } });
  });

  it("出力が上限を超えたら、後ろを捨てて truncated にする", async () => {
    const { session, calls } = setup();
    const result = session.run();
    const { pending } = calls[0]!;
    pending.onOutput("x".repeat(OUTPUT_LIMIT));
    pending.onOutput("yy");
    pending.onOutput("zz");
    pending.finish({ kind: "exited", exitCode: 0 });
    const done = await result;
    expect(done.kind === "done" && [done.output.length, done.truncated]).toStrictEqual([
      OUTPUT_LIMIT,
      true,
    ]);
  });
});

describe("createGoSessionOpener", () => {
  const opened = Promise.resolve<ProjectLoad<"go">>({ kind: "opened", project, embedId: "c/e" });

  it("同じプロジェクトの読み込みには、同じ Promise を返し、保存したファイルを読んで開く", async () => {
    const { workspace } = fakeWorkspace();
    const openWorkspace = vi.fn(() => workspace);
    const open = createGoSessionOpener(
      () => opened,
      openWorkspace,
      () => fakeRunner().runner,
    );
    const first = open("?project=c/e");
    expect(open("?project=c/e")).toBe(first);
    const load = await first;
    expect(load.kind === "opened" && load.session.embedId).toBe("c/e");
    expect(openWorkspace).toHaveBeenCalledWith("c/e");
  });

  it("プロジェクトを読めないときは、failed をそのまま返す", async () => {
    const failed = Promise.resolve<ProjectLoad<"go">>({ kind: "failed", embedId: "x/y" });
    const open = createGoSessionOpener(() => failed);
    expect(await open("?project=x/y")).toStrictEqual({ kind: "failed", embedId: "x/y" });
  });
});

import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import { type Workspace, createSaver, createWorkspace, workspaceKey } from "./workspace";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("workspaceKey", () => {
  it("ツールの名前と埋め込みの ID の組にし、デフォルトのプロジェクトは default にする", () => {
    expect(workspaceKey("go", "abc/demo")).toBe("go:abc/demo");
    expect(workspaceKey("go", undefined)).toBe("go:default");
  });
});

describe("createWorkspace", () => {
  it("保存したレコードを、同じキーで読み、ほかのキーとは分ける", async () => {
    const factory = new IDBFactory();
    const first = createWorkspace<{ n: number }>("go", "a/b", () => factory);
    expect(await first.load()).toStrictEqual({ kind: "empty" });
    await first.save({ n: 1 });
    await first.save({ n: 2 });
    expect(await createWorkspace("go", "a/b", () => factory).load()).toStrictEqual({
      kind: "saved",
      record: { n: 2 },
    });
    expect(await createWorkspace("go", "a/c", () => factory).load()).toStrictEqual({
      kind: "empty",
    });
  });

  it("IndexedDB が無いときは unavailable を返し、その後は書き込まない", async () => {
    const workspace = createWorkspace<{ n: number }>("go", undefined, () => undefined);
    expect(await workspace.load()).toStrictEqual({ kind: "unavailable" });
    await expect(workspace.save({ n: 1 })).resolves.toBeUndefined();
  });

  it("clear は、同じキーのレコードだけを消す", async () => {
    const factory = new IDBFactory();
    const first = createWorkspace<{ n: number }>("node", "a/b", () => factory);
    const other = createWorkspace<{ n: number }>("node", "a/c", () => factory);
    await first.save({ n: 1 });
    await other.save({ n: 2 });
    await first.clear();
    expect([await first.load(), await other.load()]).toStrictEqual([
      { kind: "empty" },
      { kind: "saved", record: { n: 2 } },
    ]);
  });

  it("IndexedDB が無いときの clear は、何もせずに終わる", async () => {
    const workspace = createWorkspace<{ n: number }>("node", undefined, () => undefined);
    await workspace.load();
    await expect(workspace.clear()).resolves.toBeUndefined();
  });
});

/** save を呼んだ順に、終わらせる時を決められる Workspace。 */
function manualWorkspace() {
  const log: string[] = [];
  const pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const workspace: Workspace<number> = {
    load: async () => ({ kind: "empty" }),
    save: (n) =>
      new Promise<void>((resolve, reject) => {
        log.push(`save ${n}`);
        pending.push({ resolve, reject });
      }),
    clear: async () => {
      log.push("clear");
    },
  };
  const settle = async (error?: Error) => {
    const next = pending.shift();
    if (error) next?.reject(error);
    else next?.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { workspace, log, settle };
}

describe("createSaver", () => {
  it("保存の途中に来たレコードは、最新の 1 件だけを、保存が終わってから書く", async () => {
    const { workspace, log, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1);
    await tick();
    saver.save(2);
    saver.save(3);
    await settle();
    await settle();
    expect(log).toStrictEqual(["save 1", "save 3"]);
  });

  it("clear は、待っているレコードを捨て、途中の保存の後に消し、clear の後の保存はその後に書く", async () => {
    const { workspace, log, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1);
    await tick();
    saver.save(2);
    const cleared = saver.clear();
    saver.save(3);
    await settle();
    await cleared;
    await tick();
    expect(log).toStrictEqual(["save 1", "clear", "save 3"]);
  });

  it("保存が失敗すると failed が true になり、次の保存が通ると false に戻る", async () => {
    const { workspace, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    const seen: boolean[] = [];
    saver.failed.subscribe(() => seen.push(saver.failed.getSnapshot()));
    saver.save(1);
    await tick();
    await settle(new Error("QuotaExceededError"));
    saver.save(2);
    await tick();
    await settle();
    expect(seen).toStrictEqual([true, false]);
  });

  it("keepFailure の保存が通っても、failed を戻さない", async () => {
    const { workspace, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1);
    await tick();
    await settle(new Error("QuotaExceededError"));
    saver.save(2, { keepFailure: true });
    await tick();
    await settle();
    expect(saver.failed.getSnapshot()).toBe(true);
  });

  it("keepFailure の保存を書いている間に待ちに入った通常の保存が通ると、failed を戻す", async () => {
    const { workspace, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1);
    await tick();
    await settle(new Error("QuotaExceededError"));
    saver.save(2, { keepFailure: true });
    await tick();
    saver.save(3);
    await settle();
    await settle();
    expect(saver.failed.getSnapshot()).toBe(false);
  });

  it("待ちにある keepFailure の保存を通常の保存が置き換えると、通ったときに failed を戻す", async () => {
    const { workspace, log, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1);
    await tick();
    saver.save(2, { keepFailure: true });
    saver.save(3);
    await settle(new Error("QuotaExceededError"));
    await settle();
    expect({ log, failed: saver.failed.getSnapshot() }).toStrictEqual({
      log: ["save 1", "save 3"],
      failed: false,
    });
  });

  it("keepFailure の保存が失敗すると、failed を true にする", async () => {
    const { workspace, settle } = manualWorkspace();
    const saver = createSaver(workspace);
    saver.save(1, { keepFailure: true });
    await tick();
    await settle(new Error("QuotaExceededError"));
    expect(saver.failed.getSnapshot()).toBe(true);
  });
});

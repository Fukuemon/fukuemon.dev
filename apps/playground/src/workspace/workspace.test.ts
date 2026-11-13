import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import { createWorkspace, workspaceKey } from "./workspace";

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
});

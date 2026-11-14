import { describe, expect, it, vi } from "vitest";

import type { Workspace } from "../workspace/workspace";
import { type NodeRecord, createRecordSaver } from "./record-saver";

const record: NodeRecord = { files: { "index.js": "b" }, version: "v1", savedAt: 1 };

describe("createRecordSaver", () => {
  it("書き直しを待ちに入れたまま消して失敗しても、後で書き直す", async () => {
    const saves: NodeRecord[] = [];
    const storage = {
      load: async () => ({ kind: "empty" }) as const,
      save: vi.fn(async (next: NodeRecord) => {
        saves.push(next);
      }),
      clear: vi.fn(async () => undefined).mockRejectedValueOnce(new Error("消せない")),
    } satisfies Workspace<NodeRecord>;
    const saver = createRecordSaver({
      storage,
      record,
      needsRewrite: true,
      canSave: true,
      projectVersion: "v1",
      now: () => 9,
    });
    const cleared = saver.clear();
    await expect(cleared).rejects.toThrow("消せない");
    saver.rewriteIfUnsaved();
    await vi.waitFor(() => expect(saves.map((saved) => saved.files)).toStrictEqual([record.files]));
  });
});

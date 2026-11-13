import type { NodeRuntime } from "@fukuemon/node-runtime";
import { describe, expect, it, vi } from "vitest";

import { syncFile } from "./file-sync";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(initial: string) {
  let contents = initial;
  let release: () => void = () => undefined;
  let holdWrites = false;
  const listeners = new Set<(paths: readonly string[]) => void>();
  const files = {
    read: vi.fn(async () => contents),
    write: vi.fn(async (_: string, text: string) => {
      if (holdWrites) await new Promise<void>((resolve) => (release = resolve));
      contents = text;
    }),
    changes: {
      subscribe: (onChange: (paths: readonly string[]) => void) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    },
  } as unknown as NodeRuntime["files"];
  let doc = "";
  const document = { read: () => doc, replace: vi.fn((text: string) => (doc = text)) };
  return {
    files,
    document,
    setDoc: (text: string) => (doc = text),
    getDoc: () => doc,
    /** コマンドがファイルを書き換えたときと同じく、中身を変えて通知する。 */
    changeFromCommand: (text: string, path = "index.js") => {
      contents = text;
      for (const listener of listeners) listener([path]);
    },
    holdWrites: () => {
      holdWrites = true;
      return () => release();
    },
    listeners: () => listeners.size,
  };
}

describe("syncFile", () => {
  it("開いたときに、ファイルの中身をエディタに写す", async () => {
    const s = setup("hello");
    syncFile(s.files, "index.js", s.document);
    await flush();
    expect(s.getDoc()).toBe("hello");
  });

  it("入力を、ファイルに書き込む", async () => {
    const s = setup("");
    const sync = syncFile(s.files, "index.js", s.document);
    await flush();
    sync.input("typed");
    expect(s.files.write).toHaveBeenCalledWith("index.js", "typed");
  });

  it("コマンドがファイルを書き換えたときは、エディタの中身を置き換える", async () => {
    const s = setup("a");
    syncFile(s.files, "index.js", s.document);
    await flush();
    s.changeFromCommand("b");
    await flush();
    expect(s.getDoc()).toBe("b");
  });

  it("ほかのファイルの通知では、読み直さない", async () => {
    const s = setup("a");
    syncFile(s.files, "index.js", s.document);
    await flush();
    s.changeFromCommand("b", "other.js");
    await flush();
    expect(s.getDoc()).toBe("a");
  });

  it("自分が書いた中身の通知では、置き換えない", async () => {
    const s = setup("");
    const sync = syncFile(s.files, "index.js", s.document);
    await flush();
    s.setDoc("typed more");
    sync.input("typed");
    await flush();
    s.changeFromCommand("typed");
    await flush();
    expect(s.document.replace).toHaveBeenCalledTimes(0);
  });

  it("書き込みの途中の通知では、置き換えない", async () => {
    const s = setup("");
    const sync = syncFile(s.files, "index.js", s.document);
    await flush();
    const release = s.holdWrites();
    s.setDoc("x");
    sync.input("x");
    s.changeFromCommand("old");
    await flush();
    expect(s.getDoc()).toBe("x");
    release();
  });

  it("書き込みが失敗しても、後の通知で読み直す", async () => {
    const s = setup("");
    vi.mocked(s.files.write).mockRejectedValueOnce(new Error("EACCES"));
    const sync = syncFile(s.files, "index.js", s.document);
    await flush();
    sync.input("x");
    await flush();
    s.changeFromCommand("from command");
    await flush();
    expect(s.getDoc()).toBe("from command");
  });

  it("読めないときと、閉じた後は、置き換えない", async () => {
    const s = setup("a");
    vi.mocked(s.files.read).mockRejectedValueOnce(new Error("ENOENT"));
    const sync = syncFile(s.files, "index.js", s.document);
    await flush();
    expect(s.getDoc()).toBe("");
    sync.close();
    expect(s.listeners()).toBe(0);
  });
});

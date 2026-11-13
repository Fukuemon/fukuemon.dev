import type { NodeRuntime } from "@fukuemon/node-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncFile } from "./file-sync";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(initial: string) {
  let contents = initial;
  const listeners = new Set<(paths: readonly string[]) => void>();
  const files = {
    read: vi.fn(async () => contents),
    write: vi.fn(async (_: string, text: string) => {
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
  const document = {
    read: () => doc,
    replace: vi.fn((text: string, _options?: { initial?: boolean }) => {
      doc = text;
    }),
    setEditable: vi.fn(),
  };
  return {
    files,
    document,
    setDoc: (text: string) => {
      doc = text;
    },
    getDoc: () => doc,
    /** コマンドがファイルを書き換えたときと同じく、中身を変えて通知する。 */
    changeFromCommand: (text: string, path = "index.js") => {
      contents = text;
      for (const listener of listeners) listener([path]);
    },
    listeners: () => listeners.size,
  };
}

/** 開いて、最初の読み込みを終えた状態。 */
async function opened(initial: string) {
  const s = setup(initial);
  const sync = syncFile(s.files, "index.js", s.document);
  await flush();
  return { ...s, sync };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncFile", () => {
  it("開いたときに、ファイルの中身を、元に戻す履歴に入れずにエディタに写す", async () => {
    const s = await opened("hello");
    expect(s.document.replace.mock.calls).toStrictEqual([["hello", { initial: true }]]);
  });

  it("最初に読めたら、入力を受け付ける", async () => {
    const s = await opened("hello");
    expect(s.document.setEditable.mock.calls).toStrictEqual([[true]]);
  });

  it("読めないときは、入力を受け付けない", async () => {
    const s = setup("a");
    vi.mocked(s.files.read).mockRejectedValueOnce(new Error("ENOENT"));
    syncFile(s.files, "index.js", s.document);
    await flush();
    expect(s.document.setEditable).not.toHaveBeenCalled();
  });

  it("入力を、ファイルに書き込む", async () => {
    const s = await opened("");
    s.sync.input("typed");
    expect(s.files.write).toHaveBeenCalledWith("index.js", "typed");
  });

  it("コマンドがファイルを書き換えたときは、元に戻す履歴に入れて、エディタの中身を置き換える", async () => {
    const s = await opened("a");
    s.changeFromCommand("b");
    await flush();
    expect(s.document.replace.mock.calls.at(-1)).toStrictEqual(["b", { initial: false }]);
  });

  it("ほかのファイルの通知では、読み直さない", async () => {
    const s = await opened("a");
    s.changeFromCommand("b", "other.js");
    await flush();
    expect(s.getDoc()).toBe("a");
  });

  it("自分が書いた中身の通知では、置き換えない", async () => {
    const s = await opened("");
    s.setDoc("typed more");
    s.sync.input("typed");
    await flush();
    s.changeFromCommand("typed");
    await flush();
    expect(s.getDoc()).toBe("typed more");
  });

  it("書き込みの途中の通知では、置き換えない", async () => {
    const s = await opened("");
    vi.mocked(s.files.write).mockImplementationOnce(() => new Promise(() => undefined));
    s.setDoc("x");
    s.sync.input("x");
    s.changeFromCommand("old");
    await flush();
    expect(s.getDoc()).toBe("x");
  });

  it("書き込みが失敗しても、後の通知で読み直す", async () => {
    const s = await opened("");
    vi.mocked(s.files.write).mockRejectedValueOnce(new Error("EACCES"));
    s.sync.input("x");
    await flush();
    s.changeFromCommand("from command");
    await flush();
    expect(s.getDoc()).toBe("from command");
  });

  it("読み込みの途中で閉じたときは、読めた後も置き換えない", async () => {
    const s = setup("late");
    let resolve: (text: string) => void = () => undefined;
    vi.mocked(s.files.read).mockImplementationOnce(() => new Promise<string>((r) => (resolve = r)));
    const sync = syncFile(s.files, "index.js", s.document);
    sync.close();
    resolve("late");
    await flush();
    expect(s.document.replace).not.toHaveBeenCalled();
  });

  it("閉じると、変更の通知の購読を外す", async () => {
    const s = await opened("a");
    s.sync.close();
    expect(s.listeners()).toBe(0);
  });
});

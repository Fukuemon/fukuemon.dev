import { afterEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_CONSOLE_MESSAGE } from "./console-records";
import { CONSOLE_PREFIX } from "./record-lines";
import { bootWithBackend } from "./runtime";
import { bootFake, createFakeBackend, flush, initialFiles } from "./test/fake-backend";
import { BootError } from "./types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("bootWithBackend", () => {
  it("初期ファイルで起動し、ファイルのツリーを、ディレクトリを先に名前の順で返す", async () => {
    const { runtime } = await bootFake();
    expect(runtime.files.tree.getSnapshot()).toStrictEqual([
      { path: "src", kind: "directory" },
      { path: "src/app.js", kind: "file" },
      { path: "index.js", kind: "file" },
      { path: "package.json", kind: "file" },
    ]);
  });

  it("cross-origin isolation が無いときは、not-isolated の BootError で失敗する", async () => {
    const fake = createFakeBackend({ supported: false });
    const error = await failure(bootWithBackend(fake.backend, { files: initialFiles }));
    expect(error).toStrictEqual(new BootError("not-isolated"));
  });

  it("cross-origin isolation が無いときは、実装を起動しない", async () => {
    const fake = createFakeBackend({ supported: false });
    await failure(bootWithBackend(fake.backend, { files: initialFiles }));
    expect(fake.instances).toHaveLength(0);
  });

  it("実装の起動の失敗は、元の誤りを cause に持つ failed の BootError にする", async () => {
    const fake = createFakeBackend();
    const cause = new Error("boot");
    fake.failBoot(cause);
    const error = await failure(bootWithBackend(fake.backend, { files: initialFiles }));
    expect(error).toStrictEqual(new BootError("failed", { cause }));
  });

  it("上限までに起動しないときは、timeout の BootError で失敗する", async () => {
    vi.useFakeTimers();
    const fake = createFakeBackend();
    fake.holdBoot();
    const booting = failure(bootWithBackend(fake.backend, { files: initialFiles }, 1000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await booting).toStrictEqual(new BootError("timeout"));
  });

  it("上限を過ぎた後に起動した実行環境を、破棄する", async () => {
    vi.useFakeTimers();
    const fake = createFakeBackend();
    const release = fake.holdBoot();
    const booting = failure(bootWithBackend(fake.backend, { files: initialFiles }, 1000));
    await vi.advanceTimersByTimeAsync(1000);
    await booting;
    vi.useRealTimers();
    release();
    await flush();
    expect(fake.instances[0]?.state.tornDown).toBe(true);
  });

  it("ツリーを読めないときは、起動した実行環境を破棄する", async () => {
    const fake = createFakeBackend();
    const boot = fake.backend.boot;
    fake.backend.boot = async (options) => {
      const instance = await boot(options);
      instance.files.list = async () => {
        throw new Error("readdir");
      };
      return instance;
    };
    await failure(bootWithBackend(fake.backend, { files: initialFiles }));
    expect(fake.instances[0]?.state.tornDown).toBe(true);
  });
});

describe("ports", () => {
  it("実装が知らせたポートを、store で返す", async () => {
    const { runtime, created } = await bootFake();
    const port = { port: 3000, url: "https://a", sandbox: "allow-scripts", allow: "" };
    created.emitPorts([port]);
    expect(runtime.ports.getSnapshot()).toStrictEqual([port]);
  });

  it.each([
    ["http: の URL", "http://3001.example.test"],
    ["このページと同じ origin の URL", "https://play.example.test/preview"],
    ["大文字のホスト名で書いた、このページと同じ origin の URL", "https://PLAY.example.test/"],
    ["既定のポートを書いた、このページと同じ origin の URL", "https://play.example.test:443/"],
    ["javascript: の URL", "javascript:alert(1)"],
    ["URL でない文字列", "not a url"],
  ])("%s のポートは、一覧に出さない", async (_, url) => {
    vi.stubGlobal("location", { origin: "https://play.example.test" });
    const { runtime, created } = await bootFake();
    const allowed = { port: 3000, url: "https://3000.example.test", sandbox: "", allow: "" };
    created.emitPorts([allowed, { ...allowed, port: 3001, url }]);
    expect(runtime.ports.getSnapshot()).toStrictEqual([allowed]);
  });
});

describe("records", () => {
  it("HTTP とコンソールの記録は、空の store を返す", async () => {
    const { runtime } = await bootFake();
    expect([
      runtime.httpExchanges.getSnapshot(),
      runtime.consoleEntries.getSnapshot(),
    ]).toStrictEqual([[], []]);
  });

  it("プレビューのページから届いたコンソールの記録を、コンソールの store に入れる", async () => {
    vi.useFakeTimers();
    try {
      const { runtime, created } = await bootFake();
      created.emitPorts([
        { port: 3000, url: "https://3000.example.test", sandbox: "", allow: "" },
        { port: 3001, url: "http://3001.example.test", sandbox: "", allow: "" },
      ]);
      const message = {
        type: PREVIEW_CONSOLE_MESSAGE,
        level: "info",
        time: 5,
        args: [{ kind: "null" }],
      };
      // プレビューのタブに出さないポート（https: でない）のページからの記録は入れない
      created.emitPreviewMessage(message, 3001);
      created.emitPreviewMessage(message, 3000);
      vi.advanceTimersByTime(20);
      expect(runtime.consoleEntries.getSnapshot()).toStrictEqual([
        {
          id: "1",
          level: "info",
          time: 5,
          source: { kind: "preview", port: 3000 },
          args: [{ kind: "null" }],
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("プロセスが出したコンソールの記録の行を、プロセスの名前を出力元にしてコンソールの store に入れ、端末に出さない", async () => {
    vi.useFakeTimers();
    try {
      const { runtime, created } = await bootFake();
      const handle = await runtime.processes.start("node", ["index.js"], { name: "サーバー" });
      const line = JSON.stringify({ level: "error", time: 7, args: [{ kind: "null" }] });
      created.processes[0]?.emit(`ok\n${CONSOLE_PREFIX}${line}\n`);
      vi.advanceTimersByTime(20);
      expect(runtime.consoleEntries.getSnapshot()).toStrictEqual([
        {
          id: "1",
          level: "error",
          time: 7,
          source: { kind: "process", name: "サーバー" },
          args: [{ kind: "null" }],
        },
      ]);
      expect(handle.output.read()).toBe("ok\n");
    } finally {
      vi.useRealTimers();
    }
  });

  it("プレビューに入れるスクリプトに、記録を送る先として、このページの origin を渡す", async () => {
    vi.stubGlobal("location", { origin: "https://play.example.test" });
    const { fake } = await bootFake();
    expect(fake.previewScripts[0]).toContain('"https://play.example.test"');
  });

  it("dispose の後は、プレビューのメッセージを受けない", async () => {
    const { runtime, created } = await bootFake();
    await runtime.dispose();
    expect(created.messageListeners()).toBe(0);
  });
});

describe("dispose", () => {
  it("2 回呼んでも、実装を 1 回だけ破棄する", async () => {
    const { runtime, created } = await bootFake();
    const teardown = vi.spyOn(created.instance, "teardown");
    await Promise.all([runtime.dispose(), runtime.dispose()]);
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("ファイルとポートの通知の購読を外す", async () => {
    const { runtime, created } = await bootFake();
    await runtime.dispose();
    expect([created.files.watchers(), created.portListeners()]).toStrictEqual([0, 0]);
  });

  it("破棄した後の通知では、ツリーを読み直さない", async () => {
    const { runtime, created } = await bootFake();
    const before = runtime.files.tree.getSnapshot();
    const write = created.files.api.writeFile;
    await runtime.dispose();
    await write("late.txt", "");
    await flush();
    expect(runtime.files.tree.getSnapshot()).toBe(before);
  });
});

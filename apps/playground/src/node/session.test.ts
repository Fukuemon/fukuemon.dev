import { BootError, type NodeRuntime, type ProcessHandle } from "@fukuemon/node-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nodeDefaultProject } from "../project/defaults";
import { type NodeProject, createRuntimeStarter, startProject } from "./session";

const project: NodeProject = {
  ...nodeDefaultProject,
  start: [
    { command: "node", args: ["auth.js"], name: "認可サーバー" },
    { command: "node", args: ["client.js"], name: "クライアント" },
  ],
};

function fakeRuntime(installExit: number) {
  const calls: string[] = [];
  const handle = (exit: number) => ({ exit: Promise.resolve(exit) }) as unknown as ProcessHandle;
  const runtime = {
    processes: {
      startShell: vi.fn(async () => {
        calls.push("shell");
        return handle(0);
      }),
      start: vi.fn(
        async (command: string, args: readonly string[], options?: { name?: string }) => {
          calls.push(`${command} ${args.join(" ")} (${options?.name})`);
          // 起動のコマンドは終了しない。終了を待つと、次のコマンドが起動しない
          return command === "npm"
            ? handle(installExit)
            : ({ exit: new Promise(() => undefined) } as unknown as ProcessHandle);
        },
      ),
    },
  } as unknown as NodeRuntime;
  return { runtime, calls };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startProject", () => {
  it("シェル、npm install、起動のコマンドの順に起動し、起動のコマンドの終了を待たない", async () => {
    const { runtime, calls } = fakeRuntime(0);
    await startProject(runtime, project);
    expect(calls).toStrictEqual([
      "shell",
      "npm install (npm install)",
      "node auth.js (認可サーバー)",
      "node client.js (クライアント)",
    ]);
  });

  it("npm install が失敗したときは、起動のコマンドを実行しない", async () => {
    const { runtime, calls } = fakeRuntime(1);
    await startProject(runtime, project);
    expect(calls).toStrictEqual(["shell", "npm install (npm install)"]);
  });
});

describe("createRuntimeStarter", () => {
  const runtime = {} as NodeRuntime;

  it("プロセスの起動を待たずに、running を返す", async () => {
    const start = vi.fn(() => new Promise<void>(() => undefined));
    expect(await createRuntimeStarter(async () => runtime, start)(project)).toStrictEqual({
      kind: "running",
      runtime,
    });
  });

  it("プロジェクトの初期ファイルで起動する", async () => {
    const boot = vi.fn(async () => runtime);
    await createRuntimeStarter(boot, async () => undefined)(project);
    expect(boot.mock.calls).toStrictEqual([[{ files: project.files }]]);
  });

  it("DB を使うプロジェクトでは、DB のプロセスと初期データの SQL を起動に渡す", async () => {
    const boot = vi.fn(async () => runtime);
    const withDatabase = { ...project, database: true, initialSql: "create table t ();" };
    await createRuntimeStarter(boot, async () => undefined)(withDatabase);
    expect(boot.mock.calls).toStrictEqual([
      [{ files: project.files, database: true, initialSql: "create table t ();" }],
    ]);
  });

  it("起動した実行環境で、プロジェクトのプロセスを起動する", async () => {
    const start = vi.fn(async () => undefined);
    await createRuntimeStarter(async () => runtime, start)(project);
    expect(start.mock.calls).toStrictEqual([[runtime, project]]);
  });

  it("同じプロジェクトには、同じ Promise を返す", () => {
    const startRuntime = createRuntimeStarter(
      async () => runtime,
      async () => undefined,
    );
    expect(startRuntime(project)).toBe(startRuntime(project));
  });

  it("同じプロジェクトでは、1 回だけ起動する", () => {
    const boot = vi.fn(async () => runtime);
    const startRuntime = createRuntimeStarter(boot, async () => undefined);
    void startRuntime(project);
    void startRuntime(project);
    expect(boot).toHaveBeenCalledTimes(1);
  });

  it("起動の失敗は、BootError の理由を持つ unavailable にする", async () => {
    const boot = vi.fn(async () => Promise.reject(new BootError("not-isolated")));
    expect(await createRuntimeStarter(boot)(project)).toStrictEqual({
      kind: "unavailable",
      reason: "not-isolated",
    });
  });

  it("BootError でない失敗は、failed の unavailable にする", async () => {
    const boot = vi.fn(async () => Promise.reject(new Error("unknown")));
    expect(await createRuntimeStarter(boot)(project)).toStrictEqual({
      kind: "unavailable",
      reason: "failed",
    });
  });

  it("プロセスの起動が失敗しても、running のまま返す", async () => {
    const boot = vi.fn(async () => runtime);
    const start = vi.fn(async () => Promise.reject(new Error("spawn")));
    expect(await createRuntimeStarter(boot, start)(project)).toStrictEqual({
      kind: "running",
      runtime,
    });
  });
});

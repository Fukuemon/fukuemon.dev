import {
  BootError,
  type BootFailureReason,
  type BootOptions,
  type NodeRuntime,
  bootNodeRuntime,
} from "@fukuemon/node-runtime";

import type { ProjectLoad } from "../project/project";
import { shellName } from "./messages";

export type NodeProject = Extract<ProjectLoad<"node">, { kind: "opened" }>["project"];

/** 起動した実行環境か、起動できなかった理由。 */
export type RuntimeResult =
  | { kind: "running"; runtime: NodeRuntime }
  | { kind: "unavailable"; reason: BootFailureReason };

/**
 * 起動した実行環境で、シェル、npm install、起動のコマンドの順に起動する。
 * npm install が 0 でない終了コードで終わったときは、起動のコマンドを実行しない。起動のコマンドは、前のコマンドの終了を待たずに起動する。
 */
export async function startProject(runtime: NodeRuntime, project: NodeProject): Promise<void> {
  await runtime.processes.startShell({ name: shellName([]) });
  const install = await runtime.processes.start("npm", ["install"], { name: "npm install" });
  if ((await install.exit) !== 0) return;
  for (const { command, args, name } of project.start) {
    await runtime.processes.start(command, args, { name });
  }
}

/**
 * プロジェクトの初期ファイルで実行環境を起動し、startProject を進める。プロジェクトごとに、1 つの実行環境を起動する。
 * React の use に渡すので、同じプロジェクトには、同じ Promise を返す。プロセスの起動は待たずに解決する。
 */
export function createRuntimeStarter(
  boot: (options: BootOptions) => Promise<NodeRuntime> = bootNodeRuntime,
  start: (runtime: NodeRuntime, project: NodeProject) => Promise<void> = startProject,
) {
  const started = new WeakMap<NodeProject, Promise<RuntimeResult>>();
  const run = async (project: NodeProject): Promise<RuntimeResult> => {
    try {
      const runtime = await boot({ files: project.files });
      void start(runtime, project).catch((error: unknown) => {
        console.error("プロセスを起動できない", error);
      });
      return { kind: "running", runtime };
    } catch (error) {
      console.error("実行環境を起動できない", error);
      return { kind: "unavailable", reason: error instanceof BootError ? error.reason : "failed" };
    }
  };
  return (project: NodeProject): Promise<RuntimeResult> => {
    const result = started.get(project) ?? run(project);
    started.set(project, result);
    return result;
  };
}

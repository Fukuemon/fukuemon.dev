import type { BackendInstance, RuntimeBackend } from "./backend";
import { createConsoleRecords } from "./console-records";
import { createFiles } from "./files";
import { previewConsoleScript } from "./preview-console";
import { createHttpRecords } from "./http-records";
import { createProcesses } from "./processes";
import type { RecordKind, RecordSource } from "./record-lines";
import { createStore } from "./store";
import { BootError, type BootOptions, type NodeRuntime, type OpenPort } from "./types";

/** bootNodeRuntime を呼んでから、Promise が解決するまでの上限。 */
const BOOT_TIMEOUT_MS = 30_000;

const ignore = () => undefined;

/**
 * プレビューの iframe に入れてよい URL か。https: で、このページと別の origin のものだけを許す。
 * 同じ origin のページを、allow-same-origin を付けた iframe で開くと、プレビューのスクリプトがこのページを操作できるためである。
 */
function isPreviewUrl(url: string) {
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return parsed.protocol === "https:" && parsed.origin !== pageOrigin();
}

/** このページの origin。ブラウザの外（テスト）では undefined である。 */
const pageOrigin = () => ("location" in globalThis ? globalThis.location.origin : undefined);

async function createNodeRuntime(instance: BackendInstance): Promise<NodeRuntime> {
  const files = await createFiles(instance.files);
  const http = createHttpRecords();
  const consoleRecords = createConsoleRecords();
  const acceptLine: Record<RecordKind, (line: string, source: RecordSource) => void> = {
    http: http.accept,
    console: consoleRecords.acceptLine,
  };
  const processes = createProcesses(instance, (line, source, kind) =>
    acceptLine[kind](line, source),
  );
  const ports = createStore<readonly OpenPort[]>([]);
  const unsubscribePorts = instance.ports.subscribe((open) =>
    ports.set(open.filter((port) => isPreviewUrl(port.url))),
  );
  // 直下の確認でプレビューのタブから除いたポートのページは、コンソールにも出さない
  const unsubscribePreview = instance.previewMessages.subscribe((message, port) => {
    if (ports.getSnapshot().some((open) => open.port === port)) {
      consoleRecords.acceptPreviewMessage(message, port);
    }
  });
  let disposed: Promise<void> | undefined;
  return {
    files: files.api,
    processes: processes.api,
    ports,
    httpExchanges: http.store,
    consoleEntries: consoleRecords.store,
    dispose: () => {
      disposed ??= (async () => {
        unsubscribePorts();
        unsubscribePreview();
        consoleRecords.dispose();
        files.dispose();
        processes.dispose();
        await instance.teardown();
      })();
      return disposed;
    },
  };
}

/**
 * backend で実行環境を起動する。timeoutMs までに起動しないときは、BootError（timeout）で失敗し、後から起動した実行環境を破棄する。
 * cross-origin isolation が無いブラウザでは、起動せずに BootError（not-isolated）で失敗する。
 */
export async function bootWithBackend(
  backend: RuntimeBackend,
  options: BootOptions,
  timeoutMs = BOOT_TIMEOUT_MS,
): Promise<NodeRuntime> {
  if (!backend.isSupported()) throw new BootError("not-isolated");
  const booting = (async () => {
    const instance = await backend.boot({
      files: options.files,
      previewScript: previewConsoleScript(pageOrigin() ?? "null"),
    });
    try {
      return await createNodeRuntime(instance);
    } catch (cause) {
      await instance.teardown().catch(ignore);
      throw cause;
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BootError("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([booting, timeout]);
  } catch (cause) {
    if (cause instanceof BootError) {
      void booting.then((runtime) => runtime.dispose(), ignore).catch(ignore);
      throw cause;
    }
    throw new BootError("failed", { cause });
  } finally {
    clearTimeout(timer);
  }
}

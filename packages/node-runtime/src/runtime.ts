import type { BackendInstance, RuntimeBackend } from "./backend";
import { startDatabase } from "./database";
import { createFiles } from "./files";
import { createProcesses } from "./processes";
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
  const pageOrigin = "location" in globalThis ? globalThis.location.origin : undefined;
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return parsed.protocol === "https:" && parsed.origin !== pageOrigin;
}

async function createNodeRuntime(
  instance: BackendInstance,
  options: BootOptions,
): Promise<NodeRuntime> {
  // DB のプロセスは、訪問者のプロセスより先に起動する。訪問者のコードが、起動のコマンドで接続するためである
  const db = options.database ? await startDatabase(instance, options.initialSql) : undefined;
  const files = await createFiles(instance.files);
  const processes = createProcesses(instance);
  const ports = createStore<readonly OpenPort[]>([]);
  const unsubscribePorts = instance.ports.subscribe((open) =>
    ports.set(open.filter((port) => isPreviewUrl(port.url))),
  );
  let disposed: Promise<void> | undefined;
  return {
    files: files.api,
    processes: processes.api,
    ports,
    httpExchanges: createStore<readonly never[]>([]),
    consoleEntries: createStore<readonly never[]>([]),
    ...(db && { database: db.database }),
    dispose: () => {
      disposed ??= (async () => {
        unsubscribePorts();
        db?.dispose();
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
  let started: BackendInstance | undefined;
  const booting = (async () => {
    const instance = await backend.boot({
      files: options.files,
      database: options.database === true,
    });
    started = instance;
    try {
      return await createNodeRuntime(instance, options);
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
      // DB の依存の npm install のように、終わらない段階で止まっていても、起動した実行環境を破棄する
      void started?.teardown().catch(ignore);
      void booting.then((runtime) => runtime.dispose(), ignore).catch(ignore);
      throw cause;
    }
    throw new BootError("failed", { cause });
  } finally {
    clearTimeout(timer);
  }
}

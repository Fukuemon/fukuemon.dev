import type { BackendInstance, RuntimeBackend } from "./backend";
import { createFiles } from "./files";
import { createProcesses } from "./processes";
import { createStore } from "./store";
import { BootError, type BootOptions, type NodeRuntime, type OpenPort } from "./types";

/** bootNodeRuntime を呼んでから、Promise が解決するまでの上限。 */
const BOOT_TIMEOUT_MS = 30_000;

const ignore = () => undefined;

async function createNodeRuntime(instance: BackendInstance): Promise<NodeRuntime> {
  const files = await createFiles(instance.files);
  const processes = createProcesses(instance);
  const ports = createStore<readonly OpenPort[]>([]);
  const unsubscribePorts = instance.ports.subscribe(ports.set);
  let disposed: Promise<void> | undefined;
  return {
    files: files.api,
    processes: processes.api,
    ports,
    httpExchanges: createStore<readonly never[]>([]),
    consoleEntries: createStore<readonly never[]>([]),
    dispose: () => {
      disposed ??= (async () => {
        unsubscribePorts();
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
    const instance = await backend.boot({ files: options.files });
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

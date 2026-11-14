import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

import {
  type BackendFiles,
  type BackendInstance,
  type BackendProcess,
  type DirectoryItem,
  type RuntimeBackend,
} from "../backend";
import type { OpenPort, TerminalSize } from "../types";
import httpTraceSource from "../guest/http-trace.cjs?raw";
import { toBackendError } from "./errors";
import { toTree } from "./tree";

// 実行環境が追加するファイルは、訪問者の作業ディレクトリの外に置く (docs/adr/0052-runtime-files-outside-workdir.md)
const RUNTIME_DIRECTORY = "/tmp/fukuemon-playground";
const PORTS_FILE = `${RUNTIME_DIRECTORY}/ports.json`;
const HTTP_TRACE_FILE = `${RUNTIME_DIRECTORY}/http-trace.cjs`;

// プレビューは WebContainers が割り当てる別の origin で開くので、同じ origin の権限を渡しても、このページには届かない
const PREVIEW_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals allow-popups";
const PREVIEW_ALLOW = "cross-origin-isolated";

const DEFAULT_TERMINAL: TerminalSize = { cols: 80, rows: 24 };

// 実行環境が自分で起動するプロセス（writeOutside の node）には渡さない
const env = { PLAYGROUND_PORTS_FILE: PORTS_FILE, NODE_OPTIONS: `--require ${HTTP_TRACE_FILE}` };

function toBackendProcess(process: WebContainerProcess): BackendProcess {
  const listeners = new Set<(chunk: string) => void>();
  let piping = false;
  const writer = process.input.getWriter();
  return {
    output: {
      subscribe: (onChunk) => {
        listeners.add(onChunk);
        // 最初の購読で読み始める。読み始めるより前の出力は、ストリームに残る
        if (!piping) {
          piping = true;
          void process.output
            .pipeTo(
              new WritableStream({
                write: (chunk) => {
                  for (const listener of listeners) listener(chunk);
                },
              }),
            )
            .catch(() => undefined);
        }
        return () => listeners.delete(onChunk);
      },
    },
    write: (data) => void writer.write(data).catch(() => undefined),
    resize: (size) => process.resize(size),
    kill: () => process.kill(),
    exit: process.exit,
  };
}

const rethrow = (error: unknown) => {
  throw toBackendError(error);
};

function createBackendFiles(container: WebContainer): BackendFiles {
  const fs = container.fs;
  return {
    list: async (directory) => {
      const items = await fs
        .readdir(directory === "" ? "." : directory, { withFileTypes: true })
        .catch(rethrow);
      return items.map(
        (item): DirectoryItem => ({
          name: item.name,
          // WebContainers の Dirent には isSymbolicLink が無く、リンクは isFile も isDirectory も false を返す
          kind: item.isDirectory() ? "directory" : item.isFile() ? "file" : "other",
        }),
      );
    },
    readFile: (path) => fs.readFile(path).catch(rethrow),
    writeFile: (path, contents) => fs.writeFile(path, contents),
    mkdir: async (path) => {
      await fs.mkdir(path, { recursive: true });
    },
    rename: (from, to) => fs.rename(from, to),
    remove: (path) => fs.rm(path, { recursive: true, force: true }),
    watch: (onChange) => {
      const watcher = fs.watch(".", { recursive: true }, (_, filename) => {
        onChange([typeof filename === "string" ? filename : new TextDecoder().decode(filename)]);
      });
      return () => watcher.close();
    },
  };
}

/**
 * 作業ディレクトリの外に、ファイルを書く。
 * ADR-0052 の試作と同じく、実行環境の中の Node で書く。WebContainers のファイルの API で作業ディレクトリの外に書けるかは、確かめていない。
 * 値は環境変数で渡す。WebContainers は、改行を含む環境変数の値を、最初の行で切るので、中身は base64 の 1 行にする。
 */
async function writeOutside(container: WebContainer, path: string, contents: string) {
  const script =
    "const fs=require('fs'),p=require('path');" +
    "fs.mkdirSync(p.dirname(process.env.TARGET),{recursive:true});" +
    "fs.writeFileSync(process.env.TARGET,Buffer.from(process.env.CONTENTS,'base64'))";
  const bytes = new TextEncoder().encode(contents);
  const process = await container.spawn("node", ["-e", script], {
    env: {
      TARGET: path,
      CONTENTS: btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")),
    },
    output: false,
  });
  const code = await process.exit;
  if (code !== 0) throw new Error(`${path} を書けない: ${code}`);
}

function createPorts(container: WebContainer) {
  const open = new Map<number, string>();
  const listeners = new Set<(ports: readonly OpenPort[]) => void>();
  let writing = Promise.resolve();

  const publish = () => {
    const ports = [...open.entries()]
      .sort(([a], [b]) => a - b)
      .map(
        ([port, url]): OpenPort => ({ port, url, sandbox: PREVIEW_SANDBOX, allow: PREVIEW_ALLOW }),
      );
    for (const listener of listeners) listener(ports);
    const contents = JSON.stringify(Object.fromEntries(open));
    // 書き込みの順を、通知の順にそろえる
    writing = writing
      .then(() => writeOutside(container, PORTS_FILE, contents))
      .catch(() => undefined);
  };

  const unsubscribe = container.on("port", (port, type, url) => {
    if (type === "open") open.set(port, url);
    else open.delete(port);
    publish();
  });

  return {
    ready: () => writeOutside(container, PORTS_FILE, "{}"),
    ports: {
      subscribe: (onChange: (ports: readonly OpenPort[]) => void) => {
        listeners.add(onChange);
        return () => listeners.delete(onChange);
      },
    },
    dispose: unsubscribe,
  };
}

/** WebContainers で動く実行環境。WebContainers を import するのは、このファイルだけである (apps/playground/DesignDoc.md)。 */
export const webContainerBackend: RuntimeBackend = {
  isSupported: () => globalThis.crossOriginIsolated === true,
  boot: async ({ files }): Promise<BackendInstance> => {
    const container = await WebContainer.boot({ coep: "require-corp", workdirName: "project" });
    try {
      await container.mount(toTree(files));
      await writeOutside(container, HTTP_TRACE_FILE, httpTraceSource);
      const ports = createPorts(container);
      await ports.ready();
      return {
        files: createBackendFiles(container),
        spawn: async (command, args, options = {}) =>
          toBackendProcess(
            await container.spawn(command, [...args], {
              env,
              terminal: options.terminal ?? DEFAULT_TERMINAL,
            }),
          ),
        spawnShell: async (options = {}) =>
          toBackendProcess(
            await container.spawn("jsh", [], {
              env,
              terminal: options.terminal ?? DEFAULT_TERMINAL,
            }),
          ),
        ports: ports.ports,
        teardown: async () => {
          ports.dispose();
          container.teardown();
        },
      };
    } catch (cause) {
      container.teardown();
      throw cause;
    }
  },
};

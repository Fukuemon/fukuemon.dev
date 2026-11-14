// oxlint-disable-next-line typescript/triple-slash-reference -- このファイルを import する apps/playground の tsc にも、?bundle の型を読ませる
/// <reference path="./guest-modules.d.ts" />
import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

import type {
  BackendFiles,
  BackendInstance,
  BackendProcess,
  DirectoryItem,
  RuntimeBackend,
} from "../backend";
import dbPackageSource from "../guest/db-package.json?raw";
import { DB_SERVER_FILE, DB_SOCKET_PATH } from "../guest/db-protocol";
// oxlint-disable-next-line import/default -- vite.ts の guestBundle が、束ねた文字列を default で返す
import dbServerSource from "../guest/db-server.ts?bundle";
import keepAliveSource from "../guest/keep-alive.cjs?raw";
import type { OpenPort, TerminalSize } from "../types";
import { toTree } from "./tree";

// 実行環境が追加するファイルは、訪問者の作業ディレクトリの外に置く (docs/adr/0052-runtime-files-outside-workdir.md)
const RUNTIME_DIRECTORY = "/tmp/fukuemon-playground";
const PORTS_FILE = `${RUNTIME_DIRECTORY}/ports.json`;
const KEEP_ALIVE_FILE = `${RUNTIME_DIRECTORY}/keep-alive.cjs`;
// DB のプロセスのスクリプトと、npm install で入れる依存を置く
const DB_DIRECTORY = `${RUNTIME_DIRECTORY}/db`;

// プレビューは WebContainers が割り当てる別の origin で開くので、同じ origin の権限を渡しても、このページには届かない
const PREVIEW_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-modals allow-popups";
const PREVIEW_ALLOW = "cross-origin-isolated";

const DEFAULT_TERMINAL: TerminalSize = { cols: 80, rows: 24 };

const socketDirectory = DB_SOCKET_PATH.slice(0, DB_SOCKET_PATH.lastIndexOf("/"));

/** 訪問者のプロセスとシェルに渡す環境変数。実行環境が自分で起動するプロセスには渡さない (ADR-0052)。 */
function visitorEnv(database: boolean): Record<string, string> {
  if (!database) return { PLAYGROUND_PORTS_FILE: PORTS_FILE };
  return {
    PLAYGROUND_PORTS_FILE: PORTS_FILE,
    NODE_OPTIONS: `--require ${KEEP_ALIVE_FILE}`,
    PGHOST: socketDirectory,
    PGUSER: "postgres",
    PGDATABASE: "postgres",
    DATABASE_URL: `postgres://postgres@${encodeURIComponent(socketDirectory)}/postgres`,
  };
}

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

function createBackendFiles(container: WebContainer): BackendFiles {
  const fs = container.fs;
  return {
    list: async (directory) => {
      const items = await fs.readdir(directory === "" ? "." : directory, { withFileTypes: true });
      return items.map(
        (item): DirectoryItem => ({
          name: item.name,
          kind: item.isDirectory() ? "directory" : "file",
        }),
      );
    },
    readFile: (path) => fs.readFile(path),
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
  boot: async ({ files, database }): Promise<BackendInstance> => {
    const container = await WebContainer.boot({ coep: "require-corp", workdirName: "project" });
    try {
      await container.mount(toTree(files));
      if (database) {
        await writeOutside(container, KEEP_ALIVE_FILE, keepAliveSource);
        await writeOutside(container, `${DB_DIRECTORY}/package.json`, dbPackageSource);
        await writeOutside(container, `${DB_DIRECTORY}/${DB_SERVER_FILE}`, dbServerSource);
      }
      const env = visitorEnv(database);
      const ports = createPorts(container);
      await ports.ready();
      return {
        files: createBackendFiles(container),
        spawn: async (command, args, options = {}) =>
          toBackendProcess(
            await container.spawn(
              command,
              [...args],
              options.internal ? {} : { env, terminal: options.terminal ?? DEFAULT_TERMINAL },
            ),
          ),
        spawnShell: async (options = {}) =>
          toBackendProcess(
            await container.spawn("jsh", [], {
              env,
              terminal: options.terminal ?? DEFAULT_TERMINAL,
            }),
          ),
        ports: ports.ports,
        guestDirectory: DB_DIRECTORY,
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

import { DB_SOCKET_PATH } from "../guest/db-protocol";

const socketDirectory = DB_SOCKET_PATH.slice(0, DB_SOCKET_PATH.lastIndexOf("/"));

/**
 * 訪問者のプロセスとシェルに渡す環境変数。実行環境が自分で起動するプロセスには渡さない (ADR-0052)。
 * DB を使うときは、接続先と、Unix ドメインソケットに接続している間はプロセスを終了させない preload を渡す (ADR-0053)。
 */
export function visitorEnv(options: {
  database: boolean;
  portsFile: string;
  keepAliveFile: string;
}): Record<string, string> {
  if (!options.database) return { PLAYGROUND_PORTS_FILE: options.portsFile };
  return {
    PLAYGROUND_PORTS_FILE: options.portsFile,
    NODE_OPTIONS: `--require ${options.keepAliveFile}`,
    PGHOST: socketDirectory,
    PGUSER: "postgres",
    PGDATABASE: "postgres",
    DATABASE_URL: `postgres://postgres@${encodeURIComponent(socketDirectory)}/postgres`,
  };
}

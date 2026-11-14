import { DB_SOCKET_PATH } from "../guest/db-protocol";

const socketDirectory = DB_SOCKET_PATH.slice(0, DB_SOCKET_PATH.lastIndexOf("/"));

/**
 * 訪問者のプロセスとシェルに渡す環境変数。実行環境が自分で起動するプロセスには渡さない (ADR-0052)。
 * HTTP を記録する preload を、全ての訪問者のプロセスに読ませる (ADR-0054)。
 * DB を使うときは、接続先と、Unix ドメインソケットに接続している間はプロセスを終了させない preload を足す (ADR-0053)。
 */
export function visitorEnv(options: {
  database: boolean;
  portsFile: string;
  httpTraceFile: string;
  keepAliveFile: string;
}): Record<string, string> {
  const httpTrace = `--require ${options.httpTraceFile}`;
  if (!options.database) {
    return { PLAYGROUND_PORTS_FILE: options.portsFile, NODE_OPTIONS: httpTrace };
  }
  return {
    PLAYGROUND_PORTS_FILE: options.portsFile,
    NODE_OPTIONS: `${httpTrace} --require ${options.keepAliveFile}`,
    PGHOST: socketDirectory,
    PGUSER: "postgres",
    PGDATABASE: "postgres",
    DATABASE_URL: `postgres://postgres@${encodeURIComponent(socketDirectory)}/postgres`,
  };
}

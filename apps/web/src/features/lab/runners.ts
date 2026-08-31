import type { Runner } from "~/lib/remark-lab";

/**
 * フェンスの言語から実行パネルを引く。engine を足すときはここへ 1 行足す。
 * `path` は MDX へ import 文として注入されるので、`~/` で書く。
 * 相対パスはサブディレクトリのコンテンツで解決できない。
 */
export const RUNNERS: Record<string, Runner> = {
  sql: {
    name: "SqlRunner",
    path: "~/features/lab/panel/SqlRunner",
    engine: "Postgres",
    kind: "pglite",
  },
};

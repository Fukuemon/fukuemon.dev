import { build } from "rolldown";
import type { Plugin } from "vite";

const QUERY = "?bundle";

// 実行環境の中で npm install するので、束ねない。バージョンは src/guest/db-package.json にある
const EXTERNAL = ["@electric-sql/pglite", "@electric-sql/pglite-socket"];

/**
 * `<path>?bundle` の import を、path を 1 つの ES module に束ねた文字列にする。
 * webcontainer/ は、DB のプロセスのスクリプトを、この文字列で実行環境に書く。束ねた結果は、コミットしない (apps/playground/DesignDoc.md の SQL)。
 */
export function guestBundle(): Plugin {
  return {
    name: "node-runtime-guest-bundle",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(QUERY)) return null;
      const resolved = await this.resolve(source.slice(0, -QUERY.length), importer, {
        skipSelf: true,
      });
      return resolved ? `${resolved.id}${QUERY}` : null;
    },
    async load(id) {
      if (!id.endsWith(QUERY)) return null;
      const input = id.slice(0, -QUERY.length);
      const result = await build({
        input,
        platform: "node",
        external: EXTERNAL,
        write: false,
        output: { format: "esm" },
        logLevel: "warn",
      });
      const [chunk] = result.output;
      if (!chunk || chunk.type !== "chunk") throw new Error(`${input} を束ねられない`);
      for (const module of chunk.moduleIds) this.addWatchFile(module);
      return `export default ${JSON.stringify(chunk.code)};`;
    },
  };
}

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import {
  type PlaygroundProject,
  type PlaygroundTool,
  playgroundConfigSchema,
  playgroundProjectSchema,
} from "@fukuemon/playground-project";

const CONFIG_FILE = "playground.json";

/** 埋め込みの名前。埋め込みの ID の後ろの半分になるので、プレイグラウンドが受け付ける形に合わせる */
const EMBED_NAME = /^[a-z0-9][a-z0-9-]*$/;

export const isEmbedName = (name: string) => EMBED_NAME.test(name);

export const embedId = (contentId: string, name: string) => `${contentId}/${name}`;

/** 記事の Markdown があるディレクトリの下の、プロジェクトのディレクトリ */
export const projectDir = (articlePath: string, name: string) =>
  join(dirname(articlePath), "playground", name);

export const playgroundOrigin = (env: Record<string, string | undefined> = process.env) =>
  env.PUBLIC_PLAYGROUND_ORIGIN ?? "https://play.fukuemon.dev";

/** 記事の iframe の URL。クエリには埋め込みの ID だけを書く (ADR-0049) */
export const embedUrl = (origin: string, tool: PlaygroundTool, id: string) =>
  `${origin}/${tool}/?project=${id}`;

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"))
    .sort();
}

/** プロジェクトのディレクトリを読み、ツールのページが読む JSON の形にする。設定と JSON が schema に合わないときは失敗する。 */
export function readProject(dir: string): PlaygroundProject {
  const configPath = join(dir, CONFIG_FILE);
  if (!existsSync(configPath)) throw new Error(`${configPath} が無い`);
  const config = playgroundConfigSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));
  const files = Object.fromEntries(
    listFiles(dir)
      .filter((path) => path !== CONFIG_FILE)
      .map((path) => [path, readFileSync(join(dir, path), "utf8")]),
  );
  const initialSql =
    "initialSql" in config && config.initialSql !== undefined
      ? readFileSync(join(dir, config.initialSql), "utf8")
      : undefined;
  const body = { ...config, files, ...(initialSql === undefined ? {} : { initialSql }) };
  const version = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const parsed = playgroundProjectSchema.safeParse({ ...body, version });
  if (!parsed.success)
    throw new Error(`${dir} のプロジェクトが schema に合わない: ${parsed.error.message}`);
  return parsed.data;
}

import { type FileContents, type ReadAllOptions, isExcludedPath } from "@fukuemon/node-runtime";

import { isSafeFilePath } from "../project/project";

export const BYTES_PER_MB = 1_048_576;

/** 中身を読む 1 つのファイルの上限（1 MB）。超えるファイルは、保存せず、起動し直すときにも渡さない。 */
const MAX_FILE_BYTES = BYTES_PER_MB;

/**
 * 保存しないディレクトリの名前。どの階層でも当てはまり、同じ名前のファイルも保存しない。
 * `node_modules` と、よく出るビルドの出力とキャッシュと、`.git` である。`build` と `out` は、ソースのディレクトリにも使う名前なので入れない (ADR-0077)。
 */
const EXCLUDED_DIRECTORIES = ["node_modules", ".git", "dist", ".next", ".nuxt", ".cache", ".turbo"];

/** 保存する作業ディレクトリの上限。超えたら保存せず、前に保存したレコードを残す。 */
export const SAVE_LIMIT = { files: 1_000, bytes: 10 * BYTES_PER_MB };

/** 起動し直すときに、作業ディレクトリを読む範囲。保存しないファイルも、起動し直した後の作業ディレクトリに残す。 */
export const RESTART_READ: ReadAllOptions = { exclude: ["node_modules"], maxBytes: MAX_FILE_BYTES };

/** 保存のために、作業ディレクトリを読む範囲。保存しないディレクトリを読まず、上限を超えたら読むのをやめる。 */
export const SAVE_READ: ReadAllOptions = {
  exclude: EXCLUDED_DIRECTORIES,
  maxBytes: MAX_FILE_BYTES,
  limit: SAVE_LIMIT,
};

/** シークレットを置くことの多いファイルの名前。`.env.` で始まる名前も当てはまる。 */
const SECRET_FILES = new Set([
  ".env",
  ".envrc",
  ".npmrc",
  ".netrc",
  ".yarnrc",
  ".yarnrc.yml",
  ".git-credentials",
]);

/** シークレットを置くことの多いファイルか。どの階層でも当てはまる。 */
const isSecretFile = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  return SECRET_FILES.has(name) || name.startsWith(".env.");
};

/** そのパスのファイルを保存しないか。変更の通知が、保存しないパスだけのときは、保存を予約しない。 */
export const isExcludedFromSave = (path: string) =>
  isExcludedPath(path, EXCLUDED_DIRECTORIES) || isSecretFile(path);

/**
 * files.readAll の結果のうち、起動し直すときに渡すファイル。テキストとして読めないもの、規則に合わないパス、
 * ファイルでもディレクトリでもないもの（リンク）を除く。リンクを渡すと、指す先の中身を持つ通常のファイルになり、保存されるためである (ADR-0076)。
 */
export function filesForRestart(entries: readonly FileContents[]): Record<string, string> {
  const files: Record<string, string> = {};
  for (const { path, kind, text } of entries) {
    if (kind === "file" && text !== null && isSafeFilePath(path)) files[path] = text;
  }
  return files;
}

/** 保存したレコードのファイルから、保存しないパスを落とす。規則を足す前に保存したレコードに、シークレットのファイルが残るためである。 */
export const withoutExcludedFromSave = (
  files: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(Object.entries(files).filter(([path]) => !isExcludedFromSave(path)));

type SaveFiles = { kind: "within"; files: Record<string, string> } | { kind: "over-limit" };

/**
 * files.readAll の結果のうち、保存するファイル。保存しないディレクトリの下のもの、シークレットを置くことの多いファイル、
 * ファイルでもディレクトリでもないもの（リンク）を除く。保存しないディレクトリの外のファイルが上限を超えたときは、over-limit を返す。
 * 上限は、SAVE_READ の files.readAll と同じく、テキストとして読めないファイルとリンクも数える。
 */
export function filesToSave(entries: readonly FileContents[]): SaveFiles {
  const read = entries.filter(({ path }) => !isExcludedPath(path, EXCLUDED_DIRECTORIES));
  const bytes = read.reduce((sum, { size }) => sum + size, 0);
  if (read.length > SAVE_LIMIT.files || bytes > SAVE_LIMIT.bytes) return { kind: "over-limit" };
  return {
    kind: "within",
    files: filesForRestart(read.filter(({ path }) => !isSecretFile(path))),
  };
}

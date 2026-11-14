import type { FileEntry } from "@fukuemon/node-runtime";
import type { TreeNode } from "@fukuemon/ui";

type MutableNode = { id: string; label: string; children?: MutableNode[] };

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")));
/** パスの最後の名前。 */
export const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** 実行環境のファイルの一覧を、FileTree の木にする。項目の id は、作業ディレクトリからのパスである。一覧の順を保つ。 */
export function toTreeNodes(entries: readonly FileEntry[]): TreeNode[] {
  const roots: MutableNode[] = [];
  const directories = new Map<string, MutableNode>();
  for (const entry of entries) {
    const node: MutableNode = { id: entry.path, label: nameOf(entry.path) };
    if (entry.kind === "directory") {
      node.children = [];
      directories.set(entry.path, node);
    }
    const parent = directories.get(parentOf(entry.path));
    (parent?.children ?? roots).push(node);
  }
  return roots;
}

/** 親のディレクトリのパスと名前から、新しい項目のパスを作る。 */
export const childPath = (parentId: string | undefined, name: string) =>
  parentId === undefined ? name : `${parentId}/${name}`;

/** 項目の名前を変えたときの、新しいパス。ディレクトリは変えない。 */
export const renamedPath = (path: string, name: string) =>
  childPath(parentOf(path) || undefined, name);

/** path が base そのものか、base のディレクトリの下にあるか。 */
export const isWithin = (path: string, base: string) =>
  path === base || path.startsWith(`${base}/`);

/** 初期ファイルの一覧。実行環境を起動できなかったときに、読み取り専用のツリーに使う。 */
export function projectEntries(files: Readonly<Record<string, string>>): FileEntry[] {
  const directories = new Set<string>();
  for (const path of Object.keys(files)) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
  }
  return [
    ...[...directories].sort().map((path): FileEntry => ({ path, kind: "directory" })),
    ...Object.keys(files)
      .sort()
      .map((path): FileEntry => ({ path, kind: "file" })),
  ];
}

/**
 * 新しい項目と、名前を変えた項目の名前を確かめ、使えないときは理由の文を返す。
 * 同じパスの項目があるときは、上書きしない。`/` を含む名前と、`.` と `..` は、ほかのディレクトリを指すので断る。
 * FileTree の欄も同じ名前を断るが、FileTree を通らない呼び出しでもツリーの一覧にある項目を上書きしないよう、実行の前に確認する。中身を読まないディレクトリ（node_modules の下）の項目は見ない。
 */
export function nameError(
  name: string,
  path: string,
  existing: ReadonlySet<string>,
): string | undefined {
  if (name.includes("/") || name === "." || name === "..") {
    return "名前に / を含めることと、. と .. だけの名前にすることはできません。";
  }
  if (existing.has(path)) return `${path} は既にあります。別の名前にしてください。`;
  return undefined;
}

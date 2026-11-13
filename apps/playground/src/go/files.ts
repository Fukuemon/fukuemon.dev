import type { TreeNode } from "@fukuemon/ui";

/**
 * Go を動かすツールのファイルの一式。ファイルはツールのルートからのパスで持つ。
 * directories は、訪問者が作ったディレクトリである。ファイルを持たないディレクトリも、一覧に出して保存するために持つ。
 * ファイルの親のディレクトリは、directories に無くても、一覧に出す。
 */
export type GoWorkspace = {
  files: Readonly<Record<string, string>>;
  directories: readonly string[];
};

export type EntryKind = "file" | "directory";

export type FileEntry = { path: string; kind: EntryKind };

export type Change = { ok: true; workspace: GoWorkspace } | { ok: false; reason: string };

/** 相対パスを、先頭と末尾の `/` と `./` を除いた形にする。`..`、空の階層、`\` を含むパスは undefined を返す。 */
export function normalizePath(path: string): string | undefined {
  const segments = path
    .trim()
    .replace(/^\.?\/+/, "")
    .replace(/\/+$/, "")
    .split("/");
  if (segments.some((s) => s === "" || s === "." || s === ".." || s.includes("\\"))) {
    return undefined;
  }
  return segments.join("/");
}

const parentsOf = (path: string): string[] => {
  const parts = path.split("/");
  return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join("/"));
};

const isUnder = (path: string, directory: string) => path.startsWith(`${directory}/`);

const allDirectories = (workspace: GoWorkspace): Set<string> => {
  const directories = new Set<string>();
  for (const directory of workspace.directories) {
    directories.add(directory);
    for (const parent of parentsOf(directory)) directories.add(parent);
  }
  for (const path of Object.keys(workspace.files)) {
    for (const parent of parentsOf(path)) directories.add(parent);
  }
  return directories;
};

export function kindOf(workspace: GoWorkspace, path: string): EntryKind | undefined {
  if (Object.hasOwn(workspace.files, path)) return "file";
  return allDirectories(workspace).has(path) ? "directory" : undefined;
}

/** ディレクトリとファイルを、パスの順で返す。path を渡すと、その下の全ての階層だけを返す。 */
export function listEntries(workspace: GoWorkspace, path?: string): FileEntry[] {
  const entries: FileEntry[] = [
    ...[...allDirectories(workspace)].map((p) => ({ path: p, kind: "directory" as const })),
    ...Object.keys(workspace.files).map((p) => ({ path: p, kind: "file" as const })),
  ];
  return entries
    .filter((entry) => path === undefined || isUnder(entry.path, path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

const failed = (reason: string): Change => ({ ok: false, reason });

const checkNew = (workspace: GoWorkspace, path: string): string | undefined => {
  if (kindOf(workspace, path)) return `「${path}」は既にあります`;
  const blocking = parentsOf(path).find((parent) => kindOf(workspace, parent) === "file");
  return blocking ? `「${blocking}」はファイルなので、その下に作れません` : undefined;
};

/** ファイルを書く。無ければ作り、親のディレクトリも一覧に出す。 */
export function writeFile(workspace: GoWorkspace, rawPath: string, contents: string): Change {
  const path = normalizePath(rawPath);
  if (!path) return failed(`「${rawPath}」はファイルのパスにできません`);
  if (kindOf(workspace, path) === "directory") return failed(`「${path}」はディレクトリです`);
  if (!Object.hasOwn(workspace.files, path)) {
    const reason = checkNew(workspace, path);
    if (reason) return failed(reason);
  }
  return { ok: true, workspace: { ...workspace, files: { ...workspace.files, [path]: contents } } };
}

export function createDirectory(workspace: GoWorkspace, rawPath: string): Change {
  const path = normalizePath(rawPath);
  if (!path) return failed(`「${rawPath}」はディレクトリのパスにできません`);
  const reason = checkNew(workspace, path);
  if (reason) return failed(reason);
  return { ok: true, workspace: { ...workspace, directories: [...workspace.directories, path] } };
}

const movePath = (path: string, from: string, to: string) =>
  path === from ? to : isUnder(path, from) ? to + path.slice(from.length) : path;

/** ファイルかディレクトリの名前を変える。ディレクトリのときは、下のファイルとディレクトリも移す。 */
export function rename(workspace: GoWorkspace, rawFrom: string, rawTo: string): Change {
  const from = normalizePath(rawFrom);
  const to = normalizePath(rawTo);
  const kind = from && kindOf(workspace, from);
  if (!from || !kind) return failed(`「${rawFrom}」はありません`);
  if (!to) return failed(`「${rawTo}」は名前にできません`);
  if (to === from) return { ok: true, workspace };
  if (isUnder(to, from)) return failed("ディレクトリを、自分の下に移せません");
  const reason = checkNew(workspace, to);
  if (reason) return failed(reason);
  const files = Object.fromEntries(
    Object.entries(workspace.files).map(([path, contents]) => [movePath(path, from, to), contents]),
  );
  const directories = workspace.directories.map((path) => movePath(path, from, to));
  return { ok: true, workspace: { files, directories } };
}

/** ファイルかディレクトリを消す。ディレクトリのときは、下のファイルとディレクトリも消す。 */
export function remove(workspace: GoWorkspace, rawPath: string): Change {
  const path = normalizePath(rawPath);
  if (!path || !kindOf(workspace, path)) return failed(`「${rawPath}」はありません`);
  const keep = (p: string) => p !== path && !isUnder(p, path);
  const files = Object.fromEntries(Object.entries(workspace.files).filter(([p]) => keep(p)));
  // 消したディレクトリの親が空になっても、一覧から消えないようにする
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : undefined;
  const directories = [...workspace.directories.filter(keep), ...(parent ? [parent] : [])];
  return { ok: true, workspace: { files, directories: [...new Set(directories)] } };
}

/** FileTree に渡す木。各階層で、ディレクトリを先に、名前の順で並べる。項目の id はパスである。 */
export function toTree(workspace: GoWorkspace): TreeNode[] {
  const build = (parent: string | undefined): TreeNode[] => {
    const prefix = parent === undefined ? "" : `${parent}/`;
    const children = listEntries(workspace).filter(
      (entry) => entry.path.startsWith(prefix) && !entry.path.slice(prefix.length).includes("/"),
    );
    const directories = children.filter((e) => e.kind === "directory");
    const files = children.filter((e) => e.kind === "file");
    return [
      ...directories.map((e) => ({
        id: e.path,
        label: e.path.slice(prefix.length),
        children: build(e.path),
      })),
      ...files.map((e) => ({ id: e.path, label: e.path.slice(prefix.length) })),
    ];
  };
  return build(undefined);
}

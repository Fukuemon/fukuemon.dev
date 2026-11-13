import type { FileSystemTree } from "@webcontainer/api";

/** 作業ディレクトリからのパスと中身の組を、WebContainers の mount に渡す木にする。 */
export function toTree(files: Readonly<Record<string, string>>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/");
    const name = parts.pop();
    if (name === undefined) continue;
    let directory = root;
    for (const part of parts) {
      // constructor のような Object.prototype の名前を、継承した値として読まない
      const node =
        (Object.hasOwn(directory, part) ? directory[part] : undefined) ??
        (directory[part] = { directory: {} });
      if (!("directory" in node)) throw new Error(`${part} はディレクトリではない`);
      directory = node.directory;
    }
    directory[name] = { file: { contents } };
  }
  return root;
}

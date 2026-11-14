import type { FileSystemTree } from "@webcontainer/api";

/**
 * 作業ディレクトリからのパスと中身の組を、WebContainers の mount に渡すツリーの形にする。
 * パスは、`@fukuemon/playground-project` の schema で検証したものを渡す。`__proto__` と `..` の区切りは、schema が拒否する。
 */
export function toTree(files: Readonly<Record<string, string>>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const slash = path.lastIndexOf("/");
    const parts = slash < 0 ? [] : path.slice(0, slash).split("/");
    let directory = root;
    for (const part of parts) {
      // constructor のような Object.prototype の名前を、継承した値として読まない
      const node =
        (Object.hasOwn(directory, part) ? directory[part] : undefined) ??
        (directory[part] = { directory: {} });
      if (!("directory" in node)) throw new Error(`${part} はディレクトリではない`);
      directory = node.directory;
    }
    directory[path.slice(slash + 1)] = { file: { contents } };
  }
  return root;
}

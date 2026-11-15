import type { FileEntry, ProcessInfo } from "@fukuemon/node-runtime";

import { isWithin } from "./tree";

/** 画面の選択の状態。開いたファイルと、選んだ項目は、作業ディレクトリからのパスで持つ。 */
export type Selection = {
  treeItem?: string;
  openFiles: readonly string[];
  activeFile?: string;
  terminal?: string;
  preview?: number;
  /** HTTP の一覧で選んだ記録の id。 */
  exchange?: string;
  /** 下のペインで選んだタブ。選んでいないときは端末を出す。 */
  bottom?: BottomTab;
};

export type BottomTab = "terminal" | "console" | "http";

export type SelectionAction =
  | { type: "select-item"; path: string; isFile: boolean }
  | { type: "select-tab"; path: string }
  | { type: "close-tab"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "removed"; path: string }
  | { type: "select-terminal"; id: string }
  | { type: "select-preview"; port: number }
  | { type: "select-exchange"; id: string }
  | { type: "select-bottom"; tab: BottomTab };

export const initialSelection = (open: string): Selection => ({
  treeItem: open,
  openFiles: [open],
  activeFile: open,
});

const move = (path: string, from: string, to: string) =>
  isWithin(path, from) ? to + path.slice(from.length) : path;

export function selectionReducer(state: Selection, action: SelectionAction): Selection {
  switch (action.type) {
    case "select-item":
      if (!action.isFile) return { ...state, treeItem: action.path };
      return {
        ...state,
        treeItem: action.path,
        openFiles: state.openFiles.includes(action.path)
          ? state.openFiles
          : [...state.openFiles, action.path],
        activeFile: action.path,
      };
    case "select-tab":
      return { ...state, activeFile: action.path, treeItem: action.path };
    case "close-tab": {
      const index = state.openFiles.indexOf(action.path);
      const openFiles = state.openFiles.filter((path) => path !== action.path);
      const activeFile =
        state.activeFile === action.path
          ? openFiles[Math.min(index, openFiles.length - 1)]
          : state.activeFile;
      return { ...state, openFiles, activeFile };
    }
    case "renamed":
      return {
        ...state,
        // 名前を変えた項目を選ぶ。タブには開かない
        treeItem: action.to,
        openFiles: state.openFiles.map((path) => move(path, action.from, action.to)),
        activeFile: state.activeFile && move(state.activeFile, action.from, action.to),
      };
    case "removed": {
      const openFiles = state.openFiles.filter((path) => !isWithin(path, action.path));
      const activeFile =
        state.activeFile !== undefined && isWithin(state.activeFile, action.path)
          ? openFiles[0]
          : state.activeFile;
      const treeItem =
        state.treeItem !== undefined && isWithin(state.treeItem, action.path)
          ? undefined
          : state.treeItem;
      return { ...state, openFiles, activeFile, treeItem };
    }
    case "select-terminal":
      return { ...state, terminal: action.id };
    case "select-preview":
      return { ...state, preview: action.port };
    case "select-exchange":
      return { ...state, exchange: action.id };
    case "select-bottom":
      return { ...state, bottom: action.tab };
  }
}

/**
 * 端末のペインに出すプロセス。選んだプロセスが一覧に無いときは、0 でない終了コードで終わったプロセスを先に出す。
 * npm install の失敗に気づけるようにするためである。
 */
export function shownProcess(
  processes: readonly ProcessInfo[],
  selected: string | undefined,
): ProcessInfo | undefined {
  return (
    processes.find((info) => info.id === selected) ??
    processes.find((info) => info.status.kind === "exited" && info.status.code !== 0) ??
    processes[0]
  );
}

/**
 * エディタのペインに出すタブと、選ぶタブ。端末のコマンドが消したか名前を変えたファイルは、ツリーから無くなった時点で出さない。
 * ツリーを読む前（entries が undefined）は、開いたファイルを全て出す。
 */
export function shownFiles(
  selection: Pick<Selection, "openFiles" | "activeFile">,
  entries: readonly FileEntry[] | undefined,
): { openFiles: readonly string[]; activeFile: string | undefined } {
  const existing = entries && new Set(entries.map((entry) => entry.path));
  const openFiles = selection.openFiles.filter((path) => existing?.has(path) ?? true);
  const activeFile =
    selection.activeFile !== undefined && openFiles.includes(selection.activeFile)
      ? selection.activeFile
      : openFiles[0];
  return { openFiles, activeFile };
}

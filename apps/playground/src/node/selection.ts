import { isWithin } from "./tree";

/** 画面の選択の状態。開いたファイルと、選んだ項目は、作業ディレクトリからのパスで持つ。 */
export type Selection = {
  treeItem?: string;
  openFiles: readonly string[];
  activeFile?: string;
  terminal?: string;
  preview?: number;
};

export type SelectionAction =
  | { type: "select-item"; path: string; isFile: boolean }
  | { type: "select-tab"; path: string }
  | { type: "close-tab"; path: string }
  | { type: "renamed"; from: string; to: string }
  | { type: "removed"; path: string }
  | { type: "select-terminal"; id: string }
  | { type: "select-preview"; port: number };

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
        treeItem: state.treeItem && move(state.treeItem, action.from, action.to),
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
  }
}

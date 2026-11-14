import { EditorState, type Extension, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createContext } from "react";

/**
 * エディタの状態（中身、元に戻す履歴、カーソル）を、ファイルのパスごとに保つ入れ物。
 * 配置が替わってエディタを作り直しても、履歴を残すために使う。入れ物はページの配置より上で 1 つ作る。
 */
export type EditorStates = Map<string, EditorState>;

/** CodeEditor に、状態を保つ入れ物を渡す。渡さないときは、作り直すたびに履歴が消える。 */
export const EditorStatesContext = createContext<EditorStates | undefined>(undefined);

/**
 * 前に保った状態があれば、今の拡張に付け替えて返す。無ければ doc から作る。
 * 保った状態は前の拡張の関数を持つので、付け替えないと古い handler を呼ぶ。付け替えても履歴とカーソルは残る。
 */
export function restoreState(
  saved: EditorStates | undefined,
  key: string,
  doc: string,
  extensions: Extension[],
): EditorState {
  const kept = saved?.get(key);
  return kept
    ? kept.update({ effects: StateEffect.reconfigure.of(extensions) }).state
    : EditorState.create({ doc, extensions });
}

/** 更新のたびに、状態を入れ物に書く拡張。入れ物が無いときは何もしない。 */
export const keepState = (saved: EditorStates | undefined, key: string): Extension =>
  saved ? EditorView.updateListener.of((update) => saved.set(key, update.state)) : [];

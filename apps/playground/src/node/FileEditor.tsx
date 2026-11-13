import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import type { NodeRuntime } from "@fukuemon/node-runtime";

import { CodeEditor } from "../code-editor/CodeEditor";
import { syncFile } from "./file-sync";
import { languageOf } from "./language";

// 入力のたびに書き込むので、Ctrl か ⌘ と S のキーは何もしない。ブラウザがページを保存するのを止める
const noSave = keymap.of([{ key: "Mod-s", run: () => true, preventDefault: true }]);

function languageExtension(path: string): Extension[] {
  const language = languageOf(path);
  if (language === undefined) return [];
  if (language.kind === "json") return [json()];
  return [javascript({ jsx: language.jsx, typescript: language.typescript })];
}

type FileEditorProps = {
  path: string;
  /** 渡すと、実行環境のファイルを読み、入力を書き込む。渡さないときは、initialText を読み取り専用で出す。 */
  files?: NodeRuntime["files"];
  initialText: string;
};

/** 1 つのファイルを開くエディタ。開くファイルを替えるときは、呼ぶ側が key を替える。 */
export function FileEditor({ path, files, initialText }: FileEditorProps) {
  return (
    <CodeEditor
      connect={files && ((document) => syncFile(files, path, document))}
      initialText={files ? "" : initialText}
      label={path}
      extensions={[...languageExtension(path), noSave]}
    />
  );
}

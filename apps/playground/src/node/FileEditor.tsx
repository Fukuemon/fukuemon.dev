import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { NodeRuntime } from "@fukuemon/node-runtime";
import { useEffect, useRef } from "react";

import { codeEditorExtensions } from "../code-editor/extensions";
import { syncFile } from "./file-sync";
import { languageOf } from "./language";

function languageExtension(path: string): Extension[] {
  const language = languageOf(path);
  if (language === undefined) return [];
  if (language.kind === "json") return [json()];
  return [javascript({ jsx: language.jsx, typescript: language.typescript })];
}

export type FileEditorProps = {
  path: string;
  /** 渡すと、実行環境のファイルを読み、入力を書き込む。渡さないときは、initialText を読み取り専用で出す。 */
  files?: NodeRuntime["files"];
  initialText: string;
};

/**
 * 1 つのファイルを開く CodeMirror 6 のエディタ。入力のたびに、実行環境のファイルに書き込む。
 * コマンドがファイルを書き換えたときは、変更の通知を受けて、エディタの中身を置き換える。
 */
export function FileEditor({ path, files, initialText }: FileEditorProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let sync: ReturnType<typeof syncFile> | undefined;
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      doc: files ? "" : initialText,
      extensions: [
        ...codeEditorExtensions({ label: path }),
        ...languageExtension(path),
        EditorState.readOnly.of(files === undefined),
        EditorView.updateListener.of((update) => {
          // 実行環境から読んだ中身を写したときは、書き戻さない
          if (!update.docChanged || update.transactions.some((t) => t.isUserEvent("load"))) return;
          sync?.input(update.state.doc.toString());
        }),
      ],
    });
    if (files) {
      sync = syncFile(files, path, {
        read: () => view.state.doc.toString(),
        replace: (text) =>
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: text },
            userEvent: "load",
          }),
      });
    }
    return () => {
      sync?.close();
      view.destroy();
    };
  }, [path, files, initialText]);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}

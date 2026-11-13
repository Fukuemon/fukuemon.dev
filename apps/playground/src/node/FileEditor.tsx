import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { NodeRuntime } from "@fukuemon/node-runtime";
import { useEffect, useRef } from "react";

import { codeEditorExtensions } from "../code-editor/extensions";
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
    let lastWritten: string | undefined;
    let writing = 0;
    let closed = false;
    const view = new EditorView({
      parent: parentRef.current ?? undefined,
      doc: files ? "" : initialText,
      extensions: [
        ...codeEditorExtensions({ label: path }),
        ...languageExtension(path),
        EditorState.readOnly.of(files === undefined),
        EditorView.updateListener.of((update) => {
          // 実行環境から読んだ中身を写したときは、書き戻さない
          if (
            !files ||
            !update.docChanged ||
            update.transactions.some((t) => t.isUserEvent("load"))
          )
            return;
          const text = update.state.doc.toString();
          lastWritten = text;
          writing++;
          void files.write(path, text).finally(() => writing--);
        }),
      ],
    });
    if (!files) return () => view.destroy();

    const load = async () => {
      const text = await files.read(path).catch(() => undefined);
      // 自分が書いた中身の通知と、書き込みの途中の通知では、入力中の中身を置き換えない
      if (closed || text === undefined || writing > 0 || text === lastWritten) return;
      if (text === view.state.doc.toString()) return;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        userEvent: "load",
      });
    };
    void load();
    const unsubscribe = files.changes.subscribe((paths) => {
      if (paths.includes(path)) void load();
    });
    return () => {
      closed = true;
      unsubscribe();
      view.destroy();
    };
  }, [path, files, initialText]);

  return <div className="min-h-0 flex-1 overflow-hidden" ref={parentRef} />;
}

import {
  EditorFrame,
  FileTree,
  Link,
  Notice,
  PageLoading,
  PreviewFrame,
  SplitPane,
  TerminalFrame,
} from "@fukuemon/ui";
import { type ReactNode, Suspense, use, useReducer, useSyncExternalStore } from "react";

import { nodeDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { RuntimeContext, SelectionContext, useRuntime } from "./context";
import { EditorPane } from "./EditorPane";
import { FilesPane } from "./FilesPane";
import { BOOT_LABEL } from "./messages";
import { PreviewPane } from "./PreviewPane";
import { initialSelection, selectionReducer } from "./selection";
import { type NodeSession, createNodeSessionOpener } from "./session";
import { TerminalPane } from "./TerminalPane";
import { Toolbar } from "./Toolbar";

const openSession = createNodeSessionOpener(createProjectLoader("node", nodeDefaultProject));

const pendingState = { kind: "pending" } as const;

/** 起動の Promise を読むだけで何も描かず、外の Suspense に、画面の右下の PageLoading を出させる。 */
function BootWait() {
  useRuntime();
  return null;
}

/**
 * SplitPane の領域を、ペインで埋める。ToolPane は高さを持たないので、縦の flex で広げる。
 * SplitPane の領域は外にはみ出す描画を切るので、フォーカスの輪が入る 4px の余白を、全てのペインに取る。
 */
function Pane({
  fallback,
  editorFocusRing = false,
  children,
}: {
  fallback: ReactNode;
  /** 中の CodeMirror にフォーカスがあるときに、ペインを輪で囲む。 */
  editorFocusRing?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="size-full p-1">
      <div
        className={`flex size-full flex-col [&>section]:flex-1 ${editorFocusRing ? "has-[.cm-focused]:focus-ring" : ""}`}
      >
        <Suspense fallback={fallback}>{children}</Suspense>
      </div>
    </div>
  );
}

const title = (
  <h1 className="font-heading font-semibold text-heading-sm text-text">Node の実行環境</h1>
);

function NodeLayout({ session, embedded }: { session: NodeSession; embedded: boolean }) {
  const { project } = session;
  const [selection, dispatch] = useReducer(selectionReducer, project.open, initialSelection);
  const runtime = useSyncExternalStore(session.runtime.subscribe, session.runtime.getSnapshot);
  return (
    <RuntimeContext value={{ project, runtime }}>
      <Toolbar session={session} title={!embedded && title} />
      <SelectionContext value={{ selection, dispatch }}>
        <Suspense fallback={<PageLoading label={BOOT_LABEL} />}>
          <BootWait />
        </Suspense>
        <div className="min-h-0 flex-1">
          <SplitPane
            defaultSize={20}
            label="ファイルのツリーの幅"
            primary={
              <Pane
                fallback={<FileTree items={[]} onSelect={() => undefined} state={pendingState} />}
              >
                <FilesPane />
              </Pane>
            }
            secondary={
              <SplitPane
                defaultSize={70}
                label="端末の高さ"
                orientation="vertical"
                primary={
                  <SplitPane
                    label="エディタとプレビューの幅"
                    primary={
                      <Pane
                        editorFocusRing
                        fallback={
                          <EditorFrame files={[]} onSelect={() => undefined} state={pendingState}>
                            {() => null}
                          </EditorFrame>
                        }
                      >
                        <EditorPane />
                      </Pane>
                    }
                    secondary={
                      <Pane
                        fallback={
                          <PreviewFrame state={pendingState} url="">
                            {null}
                          </PreviewFrame>
                        }
                      >
                        <PreviewPane />
                      </Pane>
                    }
                  />
                }
                secondary={
                  <Pane fallback={<TerminalFrame state={pendingState}>{() => null}</TerminalFrame>}>
                    <TerminalPane />
                  </Pane>
                }
              />
            }
          />
        </div>
      </SelectionContext>
    </RuntimeContext>
  );
}

function NodeTool({ search, embedded }: { search: string; embedded: boolean }) {
  const load = use(openSession(search));
  if (load.kind === "failed") {
    return (
      <>
        {!embedded && title}
        <Notice title="プロジェクトを開けませんでした" tone="danger">
          {isEmbedId(load.embedId)
            ? `埋め込みの ID「${load.embedId}」のプロジェクトを読めませんでした。`
            : "プロジェクトを読めませんでした。"}{" "}
          <Link href={`${SITE_ORIGIN}/playground`}>プレイグラウンドの一覧</Link>
          から開き直してください。
        </Notice>
      </>
    );
  }
  return <NodeLayout embedded={embedded} session={load.session} />;
}

/** Node の実行環境のページ。埋め込みのときは、ページのヘッダを出さない。 */
export function NodePage({ search, embedded }: { search: string; embedded: boolean }) {
  return (
    <main className="flex h-dvh min-w-0 flex-col gap-2 p-2">
      <Suspense fallback={<PageLoading label={BOOT_LABEL} />}>
        <NodeTool embedded={embedded} search={search} />
      </Suspense>
    </main>
  );
}

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
import { type ReactNode, Suspense, use, useReducer } from "react";

import { nodeDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { RuntimeContext, SelectionContext, useRuntime } from "./context";
import { EditorPane } from "./EditorPane";
import { FilesPane } from "./FilesPane";
import { BOOT_LABEL } from "./messages";
import { PreviewPane } from "./PreviewPane";
import { initialSelection, selectionReducer } from "./selection";
import { type NodeProject, createRuntimeStarter } from "./session";
import { SqlPane } from "./SqlPane";
import { TerminalPane } from "./TerminalPane";

const loadProject = createProjectLoader("node", nodeDefaultProject);
const startRuntime = createRuntimeStarter();

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

/**
 * 右の列。DB を使うプロジェクトでは、プレビューの下に SQL のペインを置き、Node のコードの結果と DB の中身を並べて見られるようにする。
 */
function PreviewColumn({ database }: { database: boolean }) {
  const preview = (
    <Pane
      fallback={
        <PreviewFrame state={pendingState} url="">
          {null}
        </PreviewFrame>
      }
    >
      <PreviewPane />
    </Pane>
  );
  if (!database) return preview;
  return (
    <SplitPane
      label="プレビューと SQL の高さ"
      orientation="vertical"
      primary={preview}
      secondary={
        <Pane fallback={null}>
          <SqlPane />
        </Pane>
      }
    />
  );
}

function NodeLayout({ project }: { project: NodeProject }) {
  const [selection, dispatch] = useReducer(selectionReducer, project.open, initialSelection);
  return (
    <RuntimeContext value={{ project, runtime: startRuntime(project) }}>
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
                    secondary={<PreviewColumn database={project.database === true} />}
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

function NodeTool({ search }: { search: string }) {
  const load = use(loadProject(search));
  if (load.kind === "failed") {
    return (
      <Notice title="プロジェクトを開けませんでした" tone="danger">
        {isEmbedId(load.embedId)
          ? `埋め込みの ID「${load.embedId}」のプロジェクトを読めませんでした。`
          : "プロジェクトを読めませんでした。"}{" "}
        <Link href={`${SITE_ORIGIN}/playground`}>プレイグラウンドの一覧</Link>
        から開き直してください。
      </Notice>
    );
  }
  return <NodeLayout project={load.project} />;
}

/** Node の実行環境のページ。埋め込みのときは、ページのヘッダを出さない。 */
export function NodePage({ search, embedded }: { search: string; embedded: boolean }) {
  return (
    <main className="flex h-dvh min-w-0 flex-col gap-2 p-2">
      {!embedded && (
        <h1 className="font-heading text-heading-md font-semibold text-text">Node の実行環境</h1>
      )}
      <Suspense fallback={<PageLoading label={BOOT_LABEL} />}>
        <NodeTool search={search} />
      </Suspense>
    </main>
  );
}

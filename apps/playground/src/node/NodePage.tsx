import {
  EditorFrame,
  FileTree,
  Link,
  Notice,
  PreviewFrame,
  SplitPane,
  TerminalFrame,
} from "@fukuemon/ui";
import { type ReactNode, Suspense, use, useReducer } from "react";

import { nodeDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { RuntimeContext, SelectionContext } from "./context";
import { EditorPane } from "./EditorPane";
import { FilesPane } from "./FilesPane";
import { PreviewPane } from "./PreviewPane";
import { initialSelection, selectionReducer } from "./selection";
import { type NodeProject, createRuntimeStarter } from "./session";
import { TerminalPane } from "./TerminalPane";

const loadProject = createProjectLoader("node", nodeDefaultProject);
const startRuntime = createRuntimeStarter();

const booting = { kind: "loading", label: "実行環境を起動しています" } as const;

/** SplitPane の領域を、ペインで埋める。ToolPane は高さを持たないので、縦の flex で広げる。 */
function Pane({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <div className="flex size-full min-h-0 flex-col [&>section]:flex-1">
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
}

function Workspace({ project }: { project: NodeProject }) {
  const [selection, dispatch] = useReducer(selectionReducer, project.open, initialSelection);
  return (
    <RuntimeContext value={{ project, runtime: startRuntime(project) }}>
      <SelectionContext value={{ selection, dispatch }}>
        <div className="min-h-0 flex-1">
          <SplitPane
            defaultSize={18}
            label="ファイルのツリーの幅"
            primary={
              <Pane fallback={<FileTree items={[]} onSelect={() => undefined} state={booting} />}>
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
                        fallback={
                          <EditorFrame files={[]} onSelect={() => undefined} state={booting}>
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
                          <PreviewFrame state={booting} url="">
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
                  <Pane fallback={<TerminalFrame state={booting}>{() => null}</TerminalFrame>}>
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
  return <Workspace project={load.project} />;
}

/** Node の実行環境のページ。埋め込みのときは、ページのヘッダを出さない。 */
export function NodePage({ search, embedded }: { search: string; embedded: boolean }) {
  return (
    <main className="flex h-dvh min-w-0 flex-col gap-2 p-2">
      {!embedded && <h1 className="font-heading text-heading-md text-text">Node の実行環境</h1>}
      <Suspense
        fallback={
          <p className="text-body-dense text-text-secondary">プロジェクトを読み込んでいます</p>
        }
      >
        <NodeTool search={search} />
      </Suspense>
    </main>
  );
}

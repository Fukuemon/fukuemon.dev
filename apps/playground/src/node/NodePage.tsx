import {
  EditorFrame,
  FileDrawer,
  FileTree,
  IconButton,
  Link,
  Notice,
  PageLoading,
  PaneTabs,
  PreviewFrame,
  SplitPane,
  TerminalFrame,
} from "@fukuemon/ui";
import { type ReactNode, Suspense, use, useReducer, useState } from "react";

import { EDITOR_ICON, FOLDER_ICON, PREVIEW_ICON, TERMINAL_ICON } from "../layout/icons";
import { type LayoutMode, useLayoutMode } from "../layout/useLayoutMode";

import { nodeDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { RuntimeContext, SelectionContext, useRuntime, useSelection } from "./context";
import { EditorPane } from "./EditorPane";
import { FilesPane } from "./FilesPane";
import { BOOT_LABEL } from "./messages";
import { PreviewPane } from "./PreviewPane";
import { type SelectionAction, initialSelection, selectionReducer } from "./selection";
import { type NodeProject, createRuntimeStarter } from "./session";
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
  flush = false,
  children,
}: {
  fallback: ReactNode;
  /** 中の CodeMirror にフォーカスがあるときに、ペインを輪で囲む。 */
  editorFocusRing?: boolean;
  /** 記事の枠の中で 1 つずつ出すときに、余白と角の丸めを外し、ペインの面を枠いっぱいに置く（docs/adr/0073-layered-panes-and-radius-in-playground.md）。 */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={flush ? "size-full" : "size-full p-1"}>
      <div
        className={[
          "flex size-full flex-col [&>section]:flex-1",
          !flush && "rounded-pane",
          editorFocusRing &&
            (flush ? "has-[.cm-focused]:focus-ring-inset" : "has-[.cm-focused]:focus-ring"),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <Suspense fallback={fallback}>{children}</Suspense>
      </div>
    </div>
  );
}

const filesFallback = <FileTree items={[]} onSelect={() => undefined} state={pendingState} />;
const editorFallback = (
  <EditorFrame files={[]} onSelect={() => undefined} state={pendingState}>
    {() => null}
  </EditorFrame>
);
const previewFallback = (
  <PreviewFrame state={pendingState} url="">
    {null}
  </PreviewFrame>
);
const terminalFallback = <TerminalFrame state={pendingState}>{() => null}</TerminalFrame>;

/** PC の配置。ファイルの木、エディタ、プレビュー、端末を並べ、仕切りで幅と高さを変える。 */
function WidePanes() {
  return (
    <div className="min-h-0 flex-1">
      <SplitPane
        defaultSize={20}
        label="ファイルのツリーの幅"
        primary={
          <Pane fallback={filesFallback}>
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
                  <Pane editorFocusRing fallback={editorFallback}>
                    <EditorPane />
                  </Pane>
                }
                secondary={
                  <Pane fallback={previewFallback}>
                    <PreviewPane />
                  </Pane>
                }
              />
            }
            secondary={
              <Pane fallback={terminalFallback}>
                <TerminalPane />
              </Pane>
            }
          />
        }
      />
    </div>
  );
}

const NARROW_PANES = ["editor", "terminal", "preview"] as const;
type NarrowPane = (typeof NARROW_PANES)[number];

/**
 * 狭い配置。ファイルの木をドロワーで出し、エディタ、端末、プレビューをタブで 1 つずつ出す。
 * ドロワーでファイルを選ぶと、ドロワーを閉じてエディタのタブに替える。フォルダの行は開閉だけをし、ドロワーを閉じない。
 */
function NarrowPanes({ mode, embedded }: { mode: Exclude<LayoutMode, "wide">; embedded: boolean }) {
  const { selection, dispatch } = useSelection();
  const [pane, setPane] = useState<NarrowPane>("editor");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const dispatchInDrawer = (action: SelectionAction) => {
    dispatch(action);
    if (action.type === "select-item" && action.isFile) {
      setDrawerOpen(false);
      setPane("editor");
    }
  };
  return (
    <div className="min-h-0 flex-1">
      <PaneTabs
        items={[
          {
            id: "editor",
            label: "エディタ",
            icon: EDITOR_ICON,
            content: (
              <Pane editorFocusRing fallback={editorFallback} flush={embedded}>
                <EditorPane />
              </Pane>
            ),
          },
          {
            id: "terminal",
            label: "端末",
            icon: TERMINAL_ICON,
            content: (
              <Pane fallback={terminalFallback} flush={embedded}>
                <TerminalPane />
              </Pane>
            ),
          },
          {
            id: "preview",
            label: "プレビュー",
            icon: PREVIEW_ICON,
            content: (
              <Pane fallback={previewFallback} flush={embedded}>
                <PreviewPane />
              </Pane>
            ),
          },
        ]}
        label="ペイン"
        leading={
          <IconButton icon={FOLDER_ICON} label="ファイル" onClick={() => setDrawerOpen(true)} />
        }
        onSelect={(id) => setPane(NARROW_PANES.find((name) => name === id) ?? "editor")}
        flush={embedded}
        placement={mode === "short" ? "start" : embedded ? "top" : "bottom"}
        selectedId={pane}
      />
      <FileDrawer
        description="ファイルを選ぶと、エディタで開きます"
        initialFocus='[role="treeitem"][tabindex="0"]'
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Node の実行環境"
      >
        <SelectionContext value={{ selection, dispatch: dispatchInDrawer }}>
          <Pane fallback={filesFallback}>
            <FilesPane />
          </Pane>
        </SelectionContext>
      </FileDrawer>
    </div>
  );
}

function NodeLayout({ project, embedded }: { project: NodeProject; embedded: boolean }) {
  const [selection, dispatch] = useReducer(selectionReducer, project.open, initialSelection);
  const mode = useLayoutMode();
  return (
    <RuntimeContext value={{ project, runtime: startRuntime(project) }}>
      <SelectionContext value={{ selection, dispatch }}>
        <Suspense fallback={<PageLoading label={BOOT_LABEL} />}>
          <BootWait />
        </Suspense>
        {mode === "wide" ? <WidePanes /> : <NarrowPanes embedded={embedded} mode={mode} />}
      </SelectionContext>
    </RuntimeContext>
  );
}

function NodeTool({ search, embedded }: { search: string; embedded: boolean }) {
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
  return <NodeLayout embedded={embedded} project={load.project} />;
}

/** Node の実行環境のページ。埋め込みのときは、ページのヘッダを出さない。高さの低い画面では、題を出さない。 */
export function NodePage({ search, embedded }: { search: string; embedded: boolean }) {
  const mode = useLayoutMode();
  return (
    <main
      className={
        embedded && mode !== "wide"
          ? "flex h-dvh min-w-0 flex-col bg-surface-pane"
          : "flex h-dvh min-w-0 flex-col gap-1.5 bg-surface-ground p-1.5"
      }
    >
      {!embedded && (
        <h1 className="px-1.5 font-heading text-heading-sm font-semibold text-text short:sr-only">
          Node の実行環境
        </h1>
      )}
      <Suspense fallback={<PageLoading label={BOOT_LABEL} />}>
        <NodeTool embedded={embedded} search={search} />
      </Suspense>
    </main>
  );
}

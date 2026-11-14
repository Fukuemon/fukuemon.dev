import type { EditorState } from "@codemirror/state";
import {
  Button,
  ConfirmDialog,
  EditorFrame,
  FileDrawer,
  FileTree,
  type FileTreeResult,
  IconButton,
  Link,
  Loading,
  Notice,
  PaneTabs,
  SplitPane,
  StatusBadge,
  TerminalFrame,
} from "@fukuemon/ui";
import {
  Suspense,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { EDITOR_ICON, FOLDER_ICON, OUTPUT_ICON } from "../layout/icons";
import { useLayoutMode } from "../layout/useLayoutMode";
import { usePaneFocus } from "../layout/usePaneFocus";
import { goDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { GoEditor } from "./GoEditor";
import {
  type Change,
  isSameOrUnder,
  joinPath,
  kindOf,
  movePath,
  parentOf,
  tabLabel,
  toTree,
} from "./files";
import { exitLabel, groupLines, progressLabel, shortcutOf } from "./output";
import { type GoSession, OUTPUT_LIMIT, createGoSessionOpener } from "./session";

const openSession = createGoSessionOpener(createProjectLoader("go", goDefaultProject));

const TITLE = "Go の実行環境";

const LINE_CLASS = {
  pass: "text-code-ansi-green",
  fail: "text-code-ansi-red",
  error: "text-code-ansi-red",
  run: "text-code-comment",
  plain: undefined,
} as const;

function GoTool({ search, embedded }: { search: string; embedded: boolean }) {
  const load = use(openSession(search));
  if (load.kind === "failed") {
    return (
      <div className="p-4">
        <Notice title="プロジェクトを開けませんでした" tone="danger">
          {isEmbedId(load.embedId)
            ? `埋め込みの ID「${load.embedId}」のプロジェクトを読めませんでした。`
            : "プロジェクトを読めませんでした。"}{" "}
          <Link href={`${SITE_ORIGIN}/playground`}>プレイグラウンドの一覧</Link>
          から開き直してください。
        </Notice>
      </div>
    );
  }
  return <GoWorkbench embedded={embedded} session={load.session} />;
}

function OutputPane({ session }: { session: GoSession }) {
  const output = useSyncExternalStore(session.output.subscribe, session.output.getSnapshot);
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const phase = useSyncExternalStore(session.phase.subscribe, session.phase.getSnapshot);
  const progress = progressLabel(phase, running, output.kind);
  const exit = exitLabel(output.exit);
  const groups = groupLines(output.text);
  const succeeded = output.exit?.kind === "exited" && output.exit.exitCode === 0;
  const logRef = useRef<HTMLDivElement>(null);
  // 下端を見ているときだけ、新しい出力に合わせて下端へ送る
  const atBottom = useRef(true);

  useEffect(() => {
    const log = logRef.current;
    if (log && atBottom.current) log.scrollTop = log.scrollHeight;
  }, [output.text]);

  return (
    <TerminalFrame
      actions={
        exit !== undefined && (
          <div className="pr-3">
            <StatusBadge label={exit} tone={succeeded ? "success" : "danger"} />
          </div>
        )
      }
      title={output.kind === "test" ? "テストの結果" : "出力"}
    >
      {() => (
        <div
          aria-label="出力"
          className="min-h-0 flex-1 overflow-auto p-3 focus-visible:focus-ring-inset"
          onScroll={(event) => {
            const log = event.currentTarget;
            atBottom.current = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
          }}
          ref={logRef}
          role="log"
          // 長い出力をキーボードで送れるよう、スクロールする領域をフォーカスできるようにする
          tabIndex={0}
        >
          {progress !== undefined && <Loading density="compact" label={progress} />}
          {groups.length === 0 && progress === undefined && output.exit === undefined && (
            <p className="font-sans text-body-compact text-code-comment">
              実行するか、テストすると、標準出力と標準エラーがここに出ます。
            </p>
          )}
          <pre className="whitespace-pre-wrap break-words">
            {groups.map((group, index) => (
              // まとまりは出力の順で並び、並べ替えも途中の削除もしないので、位置を key にする
              // oxlint-disable-next-line react/no-array-index-key
              <span className={LINE_CLASS[group.kind]} key={index}>
                {group.text}
              </span>
            ))}
          </pre>
          {output.truncated && (
            <p className="font-sans text-caption text-code-comment">
              出力が {OUTPUT_LIMIT.toLocaleString("ja-JP")} 文字を超えたので、後ろを捨てました。
            </p>
          )}
        </div>
      )}
    </TerminalFrame>
  );
}

function GoWorkbench({ session, embedded }: { session: GoSession; embedded: boolean }) {
  const fileSet = useSyncExternalStore(session.fileSet.subscribe, session.fileSet.getSnapshot);
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const runningKind = useSyncExternalStore(
    session.output.subscribe,
    () => session.output.getSnapshot().kind,
  );
  const [tabs, setTabs] = useState<string[]>([session.openPath]);
  const [active, setActive] = useState<string | undefined>(session.openPath);
  const [selected, setSelected] = useState<string | undefined>(session.openPath);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [deleting, setDeleting] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [created, setCreated] = useState<string>();
  const mode = useLayoutMode();
  const [pane, setPane] = useState<"editor" | "output">("editor");
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const { rootRef, focusEditor, focusSelectedTab } = usePaneFocus();
  const saveFailed = useSyncExternalStore(
    session.saveFailed.subscribe,
    session.saveFailed.getSnapshot,
  );
  const states = useRef(new Map<string, EditorState>());

  const openTabs = tabs.filter((path) => Object.hasOwn(fileSet.files, path));
  const shown = active !== undefined && openTabs.includes(active) ? active : openTabs[0];

  const report = (change: Change): change is Extract<Change, { ok: true }> => {
    setProblem(change.ok ? undefined : change.reason);
    return change.ok;
  };

  const openFile = (path: string) => {
    setTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActive(path);
  };

  const select = (path: string) => {
    setSelected(path);
    if (kindOf(fileSet, path) === "file") {
      openFile(path);
      setDrawerOpen(false);
      setPane("editor");
      focusEditor();
    }
  };

  // 名前の欄の操作で断った理由は、FileTree が欄の下に出す
  const create = (name: string, parent: string | undefined): FileTreeResult => {
    const change = session.createFile(joinPath(parent, name));
    if (!change.ok) return { error: change.reason };
    setProblem(undefined);
    setCreated(change.path);
    setSelected(change.path);
    openFile(change.path);
    return { id: change.path };
  };

  const createDirectory = (name: string, parent: string | undefined): FileTreeResult => {
    const change = session.createDirectory(joinPath(parent, name));
    if (!change.ok) return { error: change.reason };
    setProblem(undefined);
    setSelected(change.path);
    return { id: change.path };
  };

  const renameEntry = (id: string, name: string): FileTreeResult => {
    const change = session.rename(id, joinPath(parentOf(id), name));
    if (!change.ok) return { error: change.reason };
    setProblem(undefined);
    const { from = id, path: to } = change;
    const move = (path: string) => movePath(path, from, to);
    for (const [path, state] of Array.from(states.current)) {
      if (!isSameOrUnder(path, from)) continue;
      states.current.delete(path);
      states.current.set(move(path), state);
    }
    setTabs((current) => current.map(move));
    setActive((current) => current && move(current));
    setSelected(to);
    return { id: to };
  };

  const confirmDelete = () => {
    if (deleting === undefined) return;
    if (report(session.remove(deleting))) {
      for (const path of states.current.keys()) {
        if (isSameOrUnder(path, deleting)) states.current.delete(path);
      }
      setTabs((current) => current.filter((path) => !isSameOrUnder(path, deleting)));
      setSelected(parentOf(deleting));
    }
    setDeleting(undefined);
  };

  const closeTab = (path: string) => {
    const index = openTabs.indexOf(path);
    const rest = openTabs.filter((p) => p !== path);
    setTabs(rest);
    if (path === shown) setActive(rest[Math.min(index, rest.length - 1)]);
  };

  const run = () => {
    setPane("output");
    focusSelectedTab();
    void session.run();
  };
  const test = () => {
    setPane("output");
    focusSelectedTab();
    void session.test();
  };
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    const shortcut = shortcutOf(event);
    if (shortcut === undefined) return;
    // エディタの中の Ctrl か ⌘ と Enter は、エディタが実行する。ここでも受けると 2 回実行する
    const inEditor = event.target instanceof Element && event.target.closest(".cm-editor") !== null;
    if (shortcut === "run" && inEditor) return;
    event.preventDefault();
    event.stopPropagation();
    if (shortcut === "run") run();
    else if (shortcut === "test") test();
    else session.stop();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    // ファイルの一覧などが Enter を先に受けて止めないよう、capture の段で受ける
    window.addEventListener("keydown", listener, { capture: true });
    return () => window.removeEventListener("keydown", listener, { capture: true });
  }, []);
  const deletingKind = deleting === undefined ? undefined : kindOf(fileSet, deleting);

  const filesPanel = (
    <div className="flex h-full min-h-0 flex-col gap-2 p-1">
      {problem !== undefined && (
        <Notice isAlert title="操作できませんでした" tone="danger">
          {problem}
        </Notice>
      )}
      <div className="grid min-h-0 flex-1 grid-rows-1">
        <FileTree
          defaultExpandedIds={[...new Set(Object.keys(fileSet.files).map(parentOf))].filter(
            (p): p is string => p !== undefined,
          )}
          items={toTree(fileSet)}
          onCreate={create}
          onCreateDirectory={createDirectory}
          onDelete={setDeleting}
          onRename={renameEntry}
          onSelect={select}
          selectedId={selected}
        />
      </div>
    </div>
  );
  const editorPanel = (
    <div
      className={
        mode === "wide" ? "grid h-full min-h-0 grid-rows-1 p-1" : "grid h-full min-h-0 grid-rows-1"
      }
    >
      <EditorFrame
        files={openTabs.map((path) => ({ id: path, label: tabLabel(path, openTabs) }))}
        onClose={closeTab}
        onSelect={setActive}
        selectedId={shown}
        status={
          <>
            <span>{shown}</span>
            <span className="flex gap-4">
              <span>
                行 {cursor.line}、列 {cursor.column}
              </span>
              <span>Go</span>
            </span>
          </>
        }
      >
        {(_, file) => (
          <GoEditor
            focusOnOpen={file.id === created}
            key={file.id}
            onChange={(path, value) => {
              if (session.read(path) !== value) session.write(path, value);
            }}
            onCursor={(line, column) => setCursor({ line, column })}
            onRun={run}
            path={file.id}
            states={states.current}
            value={fileSet.files[file.id] ?? ""}
          />
        )}
      </EditorFrame>
    </div>
  );
  const outputPanel = (
    <div
      className={
        mode === "wide"
          ? "flex h-full min-h-0 flex-col gap-2 p-1"
          : "flex h-full min-h-0 flex-col gap-2"
      }
    >
      <div className="grid min-h-0 flex-1 grid-rows-1">
        <OutputPane session={session} />
      </div>
      <p className="px-4 text-caption text-text-secondary">
        Yaegi のインタプリタで動かしています。<code>iter</code>{" "}
        のパッケージと、型の推論に失敗する一部のジェネリックな関数は使えません。
      </p>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <title>{`${session.embedId ?? TITLE} | fukuemon.dev プレイグラウンド`}</title>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1.5 py-1">
        <div className="flex min-w-0 items-baseline gap-3">
          {!embedded && (
            <h1 className="font-heading text-heading-sm font-semibold text-text short:sr-only">
              {TITLE}
            </h1>
          )}
          {session.embedId !== undefined && (
            <span className="truncate font-mono text-caption text-text-secondary">
              {session.embedId}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-caption text-text-secondary md:inline">
            Ctrl か ⌘ と Enter で実行、Shift を足すとテスト
          </span>
          <Button
            aria-keyshortcuts="Control+Enter Meta+Enter"
            disabled={running && runningKind !== "run"}
            isLoading={running && runningKind === "run"}
            onClick={run}
            size="S"
          >
            実行する
          </Button>
          <Button
            aria-keyshortcuts="Control+Shift+Enter Meta+Shift+Enter"
            disabled={running && runningKind !== "test"}
            isLoading={running && runningKind === "test"}
            onClick={test}
            size="S"
            variant="secondary"
          >
            テストする
          </Button>
          <Button
            aria-keyshortcuts="Control+. Meta+."
            disabled={!running}
            onClick={session.stop}
            size="S"
            variant="secondary"
          >
            止める
          </Button>
        </div>
      </header>
      {session.canSave && saveFailed && (
        <div className="px-4 pt-2">
          <Notice isAlert title="ファイルを保存できませんでした" tone="warning">
            ブラウザの保存の容量が足りないか、保存できない状態です。次にファイルを変えたときに、もう一度保存します。
          </Notice>
        </div>
      )}
      {!session.canSave && (
        <div className="px-4 pt-2">
          <Notice title="ファイルを保存できません" tone="warning">
            このブラウザでは IndexedDB を使えないので、ページを閉じると変えたファイルが消えます。
          </Notice>
        </div>
      )}
      {mode === "wide" ? (
        // ペインの包みの 4px の余白を外へ出し、画面の縁とペインの間を 6px にする（docs/adr/0073-layered-panes-and-radius-in-playground.md）
        <div className="-m-1 flex min-h-0 flex-1">
          <SplitPane
            defaultSize={22}
            label="ファイルの一覧とエディタの仕切り"
            primary={filesPanel}
            secondary={
              <SplitPane
                defaultSize={62}
                label="エディタと出力の仕切り"
                orientation="vertical"
                primary={editorPanel}
                secondary={outputPanel}
              />
            }
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1" ref={rootRef}>
          <PaneTabs
            items={[
              { id: "editor", label: "エディタ", icon: EDITOR_ICON, content: editorPanel },
              { id: "output", label: "出力", icon: OUTPUT_ICON, content: outputPanel },
            ]}
            label="ペイン"
            leading={
              <IconButton icon={FOLDER_ICON} label="ファイル" onClick={() => setDrawerOpen(true)} />
            }
            onSelect={(id) => setPane(id === "output" ? "output" : "editor")}
            flush={embedded}
            placement={mode === "short" ? "start" : embedded ? "top" : "bottom"}
            selectedId={pane}
          />
          <FileDrawer
            description="ファイルを選ぶと、エディタで開きます"
            initialFocus='[role="treeitem"][tabindex="0"]'
            isOpen={isDrawerOpen}
            onClose={() => setDrawerOpen(false)}
            title={TITLE}
          >
            {filesPanel}
          </FileDrawer>
        </div>
      )}
      <ConfirmDialog
        confirmLabel="削除する"
        isOpen={deleting !== undefined}
        onCancel={() => setDeleting(undefined)}
        onConfirm={confirmDelete}
        title={`「${deleting ?? ""}」を削除しますか`}
      >
        {deletingKind === "directory"
          ? "ディレクトリの中のファイルとディレクトリも削除します。削除したものは元に戻せません。"
          : "削除したファイルは元に戻せません。"}
      </ConfirmDialog>
    </div>
  );
}

/** Go を動かすツールのページ。埋め込みのときは、ページの題を出さない。 */
export function GoPage({ search, embedded }: { search: string; embedded: boolean }) {
  const mode = useLayoutMode();
  return (
    <main
      className={
        // 記事に埋め込んだ狭い配置では、地を出さず、ペインの面を枠いっぱいに置く（docs/adr/0073-layered-panes-and-radius-in-playground.md）
        embedded && mode !== "wide"
          ? "flex h-dvh min-w-0 flex-col bg-surface-pane"
          : "flex h-dvh min-w-0 flex-col gap-1.5 bg-surface-ground p-1.5"
      }
    >
      <Suspense
        fallback={
          <p className="p-4 text-body-dense text-text-secondary">プロジェクトを読み込んでいます</p>
        }
      >
        <GoTool embedded={embedded} search={search} />
      </Suspense>
    </main>
  );
}

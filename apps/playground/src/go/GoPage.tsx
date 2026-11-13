import type { EditorState } from "@codemirror/state";
import {
  Button,
  ConfirmDialog,
  EditorFrame,
  FileTree,
  Link,
  Loading,
  Notice,
  SplitPane,
  StatusBadge,
  TerminalFrame,
} from "@fukuemon/ui";
import { Suspense, use, useRef, useState, useSyncExternalStore } from "react";

import { goDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { GoEditor } from "./GoEditor";
import { type Change, kindOf, toTree } from "./files";
import { exitLabel, lineKind, progressLabel } from "./output";
import { type GoSession, createGoSessionOpener } from "./session";

const openSession = createGoSessionOpener(createProjectLoader("go", goDefaultProject));

const TITLE = "Go の実行環境";

const LINE_CLASS = {
  pass: "text-code-ansi-green",
  fail: "text-code-ansi-red",
  error: "text-code-ansi-red",
  run: "text-code-comment",
  plain: undefined,
} as const;

const join = (parent: string | undefined, name: string) => (parent ? `${parent}/${name}` : name);
const parentOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : undefined;
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const isSameOrUnder = (path: string, target: string) =>
  path === target || path.startsWith(`${target}/`);

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
  const lines = output.text === "" ? [] : output.text.replace(/\n$/, "").split("\n");
  const succeeded = output.exit?.kind === "exited" && output.exit.exitCode === 0;

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
        <div aria-live="polite" className="min-h-0 flex-1 overflow-auto p-3" role="log">
          {progress !== undefined && <Loading label={progress} />}
          {lines.length === 0 && progress === undefined && output.exit === undefined && (
            <p className="font-sans text-body-dense text-code-comment">
              実行するか、テストすると、標準出力と標準エラーがここに出ます。
            </p>
          )}
          <pre className="whitespace-pre-wrap break-words">
            {lines.map((line, index) => (
              // 行は出力の順で並び、並べ替えも途中の削除もしないので、位置を key にする
              // oxlint-disable-next-line react/no-array-index-key
              <span className={LINE_CLASS[lineKind(line)]} key={index}>
                {line}
                {"\n"}
              </span>
            ))}
          </pre>
          {output.truncated && (
            <p className="font-sans text-caption text-code-comment">
              出力が 1,000,000 文字を超えたので、後ろを捨てました。
            </p>
          )}
        </div>
      )}
    </TerminalFrame>
  );
}

function GoWorkbench({ session, embedded }: { session: GoSession; embedded: boolean }) {
  const workspace = useSyncExternalStore(
    session.workspace.subscribe,
    session.workspace.getSnapshot,
  );
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const [tabs, setTabs] = useState<string[]>([session.open]);
  const [active, setActive] = useState<string | undefined>(session.open);
  const [selected, setSelected] = useState<string | undefined>(session.open);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [deleting, setDeleting] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const states = useRef(new Map<string, EditorState>());

  const openTabs = tabs.filter((path) => Object.hasOwn(workspace.files, path));
  const shown = active !== undefined && openTabs.includes(active) ? active : openTabs[0];

  const report = (change: Change) => {
    setProblem(change.ok ? undefined : change.reason);
    return change.ok;
  };

  const openFile = (path: string) => {
    setTabs((current) => (current.includes(path) ? current : [...current, path]));
    setActive(path);
  };

  const select = (path: string) => {
    setSelected(path);
    if (kindOf(workspace, path) === "file") openFile(path);
  };

  const create = (name: string, parent: string | undefined) => {
    const path = join(parent, name);
    if (report(session.write(path, ""))) {
      setSelected(path);
      openFile(path);
    }
  };

  const createDirectory = (name: string, parent: string | undefined) => {
    const path = join(parent, name);
    if (report(session.createDirectory(path))) setSelected(path);
  };

  const renameEntry = (from: string, name: string) => {
    const to = join(parentOf(from), name);
    if (!report(session.rename(from, to))) return;
    const move = (path: string) =>
      isSameOrUnder(path, from) ? to + path.slice(from.length) : path;
    for (const [path, state] of Array.from(states.current)) {
      if (!isSameOrUnder(path, from)) continue;
      states.current.delete(path);
      states.current.set(move(path), state);
    }
    setTabs((current) => current.map(move));
    setActive((current) => current && move(current));
    setSelected(to);
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

  const run = () => void session.run();
  const test = () => void session.test();
  const deletingKind = deleting === undefined ? undefined : kindOf(workspace, deleting);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <title>{`${session.embedId ?? TITLE} | fukuemon.dev プレイグラウンド`}</title>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          {!embedded && <h1 className="font-heading text-heading-sm text-text">{TITLE}</h1>}
          {session.embedId !== undefined && (
            <span className="truncate font-mono text-caption text-text-secondary">
              {session.embedId}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-caption text-text-secondary sm:inline">
            Ctrl か ⌘ と Enter で実行
          </span>
          <Button
            aria-keyshortcuts="Control+Enter Meta+Enter"
            isLoading={running}
            onClick={run}
            size="S"
          >
            実行する
          </Button>
          <Button disabled={running} onClick={test} size="S" variant="secondary">
            テストする
          </Button>
          <Button disabled={!running} onClick={session.stop} size="S" variant="secondary">
            止める
          </Button>
        </div>
      </header>
      {!session.canSave && (
        <div className="px-4 pt-2">
          <Notice title="ファイルを保存できません" tone="warning">
            このブラウザでは IndexedDB を使えないので、ページを閉じると変えたファイルが消えます。
          </Notice>
        </div>
      )}
      <div className="flex min-h-0 flex-1 p-2">
        <SplitPane
          defaultSize={22}
          label="ファイルの一覧とエディタの仕切り"
          primary={
            <div className="flex h-full min-h-0 flex-col gap-2">
              {problem !== undefined && (
                <Notice isAlert title="操作できませんでした" tone="danger">
                  {problem}
                </Notice>
              )}
              <div className="grid min-h-0 flex-1 grid-rows-1">
                <FileTree
                  defaultExpandedIds={[
                    ...new Set(Object.keys(workspace.files).map(parentOf)),
                  ].filter((p): p is string => p !== undefined)}
                  items={toTree(workspace)}
                  onCreate={create}
                  onCreateDirectory={createDirectory}
                  onDelete={setDeleting}
                  onRename={renameEntry}
                  onSelect={select}
                  selectedId={selected}
                />
              </div>
            </div>
          }
          secondary={
            <SplitPane
              defaultSize={62}
              label="エディタと出力の仕切り"
              orientation="vertical"
              primary={
                <div className="grid h-full min-h-0 grid-rows-1">
                  <EditorFrame
                    files={openTabs.map((path) => ({ id: path, label: baseName(path) }))}
                    onClose={closeTab}
                    onSelect={setActive}
                    selectedId={shown}
                    status={
                      <>
                        <span>{shown}</span>
                        <span>
                          行 {cursor.line}、列 {cursor.column}　Go
                        </span>
                      </>
                    }
                  >
                    {(_, file) => (
                      <GoEditor
                        key={file.id}
                        onChange={(path, value) => {
                          if (session.read(path) !== value) session.write(path, value);
                        }}
                        onCursor={(line, column) => setCursor({ line, column })}
                        onRun={run}
                        path={file.id}
                        states={states.current}
                        value={workspace.files[file.id] ?? ""}
                      />
                    )}
                  </EditorFrame>
                </div>
              }
              secondary={
                <div className="flex h-full min-h-0 flex-col gap-2">
                  <div className="grid min-h-0 flex-1 grid-rows-1">
                    <OutputPane session={session} />
                  </div>
                  <p className="px-1 text-caption text-text-secondary">
                    Yaegi のインタプリタで動かしています。<code>iter</code>{" "}
                    のパッケージと、型の推論に失敗する一部のジェネリックな関数は使えません。
                  </p>
                </div>
              }
            />
          }
        />
      </div>
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
  return (
    <main className="flex h-dvh min-w-0 flex-col bg-surface-subtle">
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

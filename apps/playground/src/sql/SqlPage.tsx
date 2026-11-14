import { Link, Notice, PageLoading } from "@fukuemon/ui";
import { Suspense, use, useRef, useSyncExternalStore } from "react";

import { useLayoutMode } from "../layout/useLayoutMode";
import { sqlDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { SqlConsole } from "../sql-console/SqlConsole";
import { bootLabel, progressLabel } from "./progress";
import { SqlResetControl } from "./SqlResetControl";
import { type SqlSession, createSessionOpener } from "./session";

const openSession = createSessionOpener(createProjectLoader("sql", sqlDefaultProject));

function SqlTool({ search, embedded }: { search: string; embedded: boolean }) {
  const load = use(openSession(search));
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
  return <SqlSessionView embedded={embedded} session={load.session} />;
}

function SqlSessionView({ session, embedded }: { session: SqlSession; embedded: boolean }) {
  const runRef = useRef<HTMLButtonElement>(null);
  const query = useSyncExternalStore(session.query.subscribe, session.query.getSnapshot);
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const phase = useSyncExternalStore(session.phase.subscribe, session.phase.getSnapshot);
  const saveFailed = useSyncExternalStore(
    session.saveFailed.subscribe,
    session.saveFailed.getSnapshot,
  );
  const bootText = bootLabel(phase);
  return (
    <>
      {session.canSave && saveFailed && (
        <Notice isAlert title="SQL を保存できませんでした" tone="warning">
          ブラウザの保存の容量が足りないか、保存できない状態です。次に SQL
          を変えたときに、もう一度保存します。
        </Notice>
      )}
      {!session.canSave && (
        <Notice title="SQL を保存できません" tone="warning">
          このブラウザでは IndexedDB を使えないので、ページを閉じると変えた SQL が消えます。
        </Notice>
      )}
      {bootText !== undefined && <PageLoading label={bootText} />}
      <SqlConsole
        embedded={embedded}
        actions={
          <SqlResetControl
            disabled={running}
            onReset={() => runRef.current?.focus()}
            session={session}
          />
        }
        onChange={session.setQuery}
        onRun={session.execute}
        progress={progressLabel(phase, running)}
        running={running}
        runButtonRef={runRef}
        fileName={session.fileName}
        status={session.status}
        stoppedHint="次に実行すると、DB を初期の状態から作り直します。"
        value={query}
      />
    </>
  );
}

/** SQL だけを動かすツールのページ。埋め込みのときは、ページのヘッダを出さない。 */
export function SqlPage({ search, embedded }: { search: string; embedded: boolean }) {
  const mode = useLayoutMode();
  return (
    <main
      className={
        mode === "wide"
          ? "min-h-dvh min-w-0 bg-surface-ground p-1.5"
          : // 記事に埋め込んだ狭い配置では、地を出さず、ペインの面を枠いっぱいに置く（docs/adr/0073-layered-panes-and-radius-in-playground.md）
            embedded
            ? "flex h-dvh min-w-0 flex-col bg-surface-pane"
            : "flex h-dvh min-w-0 flex-col gap-1.5 bg-surface-ground p-1.5"
      }
    >
      {/* PC の配置では、地の上に、記事と同じ幅の列を置く */}
      <div
        className={mode === "wide" ? "mx-auto flex max-w-page min-w-0 flex-col gap-4" : "contents"}
      >
        {!embedded && (
          <h1 className="font-heading text-heading-sm font-semibold text-text short:sr-only">
            SQL の実行環境
          </h1>
        )}
        <Suspense fallback={<PageLoading label="プロジェクトを読み込んでいます" />}>
          <SqlTool embedded={embedded} search={search} />
        </Suspense>
      </div>
    </main>
  );
}

import { Link, Notice, PageLoading } from "@fukuemon/ui";
import { Suspense, use, useSyncExternalStore } from "react";

import { sqlDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader, isEmbedId } from "../project/project";
import { SqlConsole } from "../sql-console/SqlConsole";
import { bootLabel, progressLabel } from "./progress";
import { type SqlSession, createSessionOpener } from "./session";

const openSession = createSessionOpener(createProjectLoader("sql", sqlDefaultProject));

function SqlTool({ search }: { search: string }) {
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
  return <SqlSessionView session={load.session} />;
}

function SqlSessionView({ session }: { session: SqlSession }) {
  const query = useSyncExternalStore(session.query.subscribe, session.query.getSnapshot);
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const phase = useSyncExternalStore(session.phase.subscribe, session.phase.getSnapshot);
  const bootText = bootLabel(phase);
  return (
    <>
      {bootText !== undefined && <PageLoading label={bootText} />}
      <SqlConsole
        onChange={session.setQuery}
        onRun={session.execute}
        progress={progressLabel(phase, running)}
        running={running}
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
  return (
    <main className="mx-auto flex max-w-page min-w-0 flex-col gap-4 p-4">
      {!embedded && (
        <h1 className="font-heading text-heading-md font-semibold text-text">SQL の実行環境</h1>
      )}
      <Suspense fallback={<PageLoading label="プロジェクトを読み込んでいます" />}>
        <SqlTool search={search} />
      </Suspense>
    </main>
  );
}

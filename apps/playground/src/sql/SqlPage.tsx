import { Link, Notice } from "@fukuemon/ui";
import { Suspense, use, useSyncExternalStore } from "react";

import { sqlDefaultProject } from "../project/defaults";
import { SITE_ORIGIN, createProjectLoader } from "../project/project";
import { SqlConsole } from "../sql-console/SqlConsole";
import { progressLabel } from "./progress";
import { type SqlSession, createSessionRegistry, createSqlSession } from "./session";

const loadProject = createProjectLoader("sql", sqlDefaultProject);

const sessionFor = createSessionRegistry();

function SqlTool({ search }: { search: string }) {
  const load = use(loadProject(search));
  if (load.kind === "failed") {
    return (
      <Notice title="プロジェクトを開けませんでした" tone="danger">
        埋め込みの ID「{load.embedId}」のプロジェクトを読めませんでした。{" "}
        <Link href={`${SITE_ORIGIN}/playground`}>プレイグラウンドの一覧</Link>
        から開き直してください。
      </Notice>
    );
  }
  const { project } = load;
  const session = sessionFor(load.embedId ?? "", () =>
    createSqlSession(project.files[project.open] ?? "", project.initialSql),
  );
  return <SqlSessionView session={session} />;
}

function SqlSessionView({ session }: { session: SqlSession }) {
  const query = useSyncExternalStore(session.query.subscribe, session.query.getSnapshot);
  const running = useSyncExternalStore(session.running.subscribe, session.running.getSnapshot);
  const phase = useSyncExternalStore(
    session.database.phase.subscribe,
    session.database.phase.getSnapshot,
  );
  return (
    <SqlConsole
      onChange={session.setQuery}
      onRun={session.execute}
      progress={progressLabel(phase, running)}
      running={running}
      status={session.database.status}
      value={query}
    />
  );
}

/** SQL だけを動かすツールのページ。埋め込みのときは、ページのヘッダを出さない。 */
export function SqlPage({ search, embedded }: { search: string; embedded: boolean }) {
  return (
    <main className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 p-4">
      {!embedded && <h1 className="font-heading text-heading-md text-text">SQL の実行環境</h1>}
      <Suspense
        fallback={
          <p className="text-body-dense text-text-secondary">プロジェクトを読み込んでいます</p>
        }
      >
        <SqlTool search={search} />
      </Suspense>
    </main>
  );
}

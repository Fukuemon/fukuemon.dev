import {
  type PlaygroundProject,
  type PlaygroundTool,
  isEmbedId,
  playgroundProjectSchema,
} from "@fukuemon/playground-project";

export type { PlaygroundTool };

/** プロジェクトの JSON と一覧を置く fukuemon.dev の origin。手元の確認では、ビルドの環境変数 `VITE_SITE_ORIGIN` で替える */
export const SITE_ORIGIN: string = import.meta.env.VITE_SITE_ORIGIN ?? "https://fukuemon.dev";

/** 開いたプロジェクトと、保存のキーに使う埋め込みの ID。デフォルトのプロジェクトは、埋め込みの ID を持たない。 */
type OpenedProject<T extends PlaygroundTool> = {
  project: Extract<PlaygroundProject, { tool: T }>;
  embedId?: string;
};

/** プロジェクトを開けなかったときは、どの理由でも、エラーと一覧へのリンクを出す。 */
export type ProjectLoad<T extends PlaygroundTool> =
  | ({ kind: "opened" } & OpenedProject<T>)
  | { kind: "failed"; embedId: string };

/** 形に合う埋め込みの ID か。合わない ID は、取得せず、画面にも出さない。 */
export { isEmbedId };

export const projectUrl = (embedId: string) => `${SITE_ORIGIN}/playground-projects/${embedId}.json`;

/** 埋め込みの ID のプロジェクトの JSON を取得し、schema とツールの種類を確かめる。 */
export async function fetchProject<T extends PlaygroundTool>(
  embedId: string,
  tool: T,
  fetchJson: typeof fetch = fetch,
): Promise<ProjectLoad<T>> {
  const failed = { kind: "failed", embedId } as const;
  if (!isEmbedId(embedId)) return failed;
  try {
    const response = await fetchJson(projectUrl(embedId));
    if (!response.ok) return failed;
    const parsed = playgroundProjectSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.tool !== tool) return failed;
    return {
      kind: "opened",
      project: parsed.data as Extract<PlaygroundProject, { tool: T }>,
      embedId,
    };
  } catch {
    return failed;
  }
}

/**
 * ページの URL のクエリの `project` から、開くプロジェクトを決める。`project` が無いときは、デフォルトのプロジェクトを開く。
 * React の use に渡すので、同じ埋め込みの ID には、同じ Promise を返す。
 */
export function createProjectLoader<T extends PlaygroundTool>(
  tool: T,
  defaultProject: Extract<PlaygroundProject, { tool: T }>,
  fetchJson: typeof fetch = fetch,
) {
  const opened = Promise.resolve<ProjectLoad<T>>({ kind: "opened", project: defaultProject });
  const loads = new Map<string, Promise<ProjectLoad<T>>>();
  return (search: string): Promise<ProjectLoad<T>> => {
    const embedId = new URLSearchParams(search).get("project");
    if (embedId === null) return opened;
    const load = loads.get(embedId) ?? fetchProject(embedId, tool, fetchJson);
    loads.set(embedId, load);
    return load;
  };
}

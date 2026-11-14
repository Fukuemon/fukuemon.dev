import type { ConsoleRecord, ConsoleSource } from "@fukuemon/node-runtime";
import type { ConsoleEntry } from "@fukuemon/ui";

/** コンソールのペインが、起動できなかったときに出す題。 */
const CONSOLE_FAILURE_TITLE = "コンソールを記録できません";

/** 出力元の名前。プロセスは `start` の `name`、プレビューはページを返したサーバーのポートで呼ぶ。 */
export const sourceName = (source: ConsoleSource) =>
  source.kind === "process" ? source.name : `${source.port} 番のプレビュー`;

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** 記録の時刻を、DevTools のコンソールと同じく、端末の地域の時刻の `時:分:秒.ミリ秒` にする。 */
export function formatTime(time: number) {
  const date = new Date(time);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

// 記録は一度入れたら変わらないので、変換した行を記録ごとに覚え、届くたびに全ての行を作り直さない
const entries = new WeakMap<ConsoleRecord, ConsoleEntry>();

/** 記録を、ConsoleEntryList の 1 行にする。値の木は、同じ形のまま渡す。 */
export function toEntry(record: ConsoleRecord): ConsoleEntry {
  let entry = entries.get(record);
  if (entry === undefined) {
    entry = {
      id: record.id,
      level: record.level,
      source: sourceName(record.source),
      time: formatTime(record.time),
      args: record.args,
    };
    entries.set(record, entry);
  }
  return entry;
}

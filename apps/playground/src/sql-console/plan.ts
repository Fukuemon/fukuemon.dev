import type { SqlResult } from "@fukuemon/sql-runtime";

/** 実行計画の木の 1 つのノード。label に、ノードの種類、対象、見積もり、実測、バッファを 1 行で書く。 */
type PlanNode = { id: string; label: string; children?: PlanNode[] };

/** `FORMAT JSON` の実行計画。木のほかに、計画と実行にかかった時間を持つ。 */
export type JsonPlan = { root: PlanNode; planningMs?: number; executionMs?: number };

/** 実行計画の結果の表し方。text は `EXPLAIN` の既定のテキスト、json は `FORMAT JSON` である。 */
export type PlanView = { kind: "text"; text: string } | { kind: "json"; plan: JsonPlan };

type RawPlan = Record<string, unknown> & { Plans?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const num = (value: unknown) => (typeof value === "number" ? value : undefined);
const str = (value: unknown) => (typeof value === "string" ? value : undefined);

function buffers(plan: RawPlan): string | undefined {
  const parts = (["Shared", "Local", "Temp"] as const).flatMap((scope) => {
    const counts = (["Hit", "Read", "Dirtied", "Written"] as const).flatMap((kind) => {
      const value = num(plan[`${scope} ${kind} Blocks`]);
      return value ? [`${kind.toLowerCase()}=${value}`] : [];
    });
    return counts.length > 0 ? [`${scope.toLowerCase()} ${counts.join(" ")}`] : [];
  });
  return parts.length > 0 ? `Buffers: ${parts.join(", ")}` : undefined;
}

function label(plan: RawPlan): string {
  const type = str(plan["Node Type"]) ?? "?";
  // Postgres のテキストの形に合わせる。Bitmap Index Scan は対象を持たず、インデックスを on で書く
  const index = str(plan["Index Name"]);
  const head = [
    type,
    index && (type === "Bitmap Index Scan" ? `on ${index}` : `using ${index}`),
    str(plan["Relation Name"]) && `on ${str(plan["Relation Name"])}`,
    str(plan["Alias"]) && str(plan["Alias"]) !== str(plan["Relation Name"]) && str(plan["Alias"]),
  ]
    .filter(Boolean)
    .join(" ");
  const cost =
    num(plan["Total Cost"]) !== undefined
      ? `(cost=${num(plan["Startup Cost"])}..${num(plan["Total Cost"])} rows=${num(plan["Plan Rows"])} width=${num(plan["Plan Width"])})`
      : undefined;
  const actual =
    num(plan["Actual Total Time"]) !== undefined
      ? `(actual time=${num(plan["Actual Startup Time"])}..${num(plan["Actual Total Time"])} rows=${num(plan["Actual Rows"])} loops=${num(plan["Actual Loops"])})`
      : undefined;
  return [head, cost, actual, buffers(plan)].filter(Boolean).join(" ");
}

function toNode(plan: RawPlan, id: string): PlanNode {
  const children = Array.isArray(plan.Plans) ? plan.Plans.filter(isRecord) : [];
  return {
    id,
    label: label(plan),
    ...(children.length > 0 && {
      children: children.map((child, index) => toNode(child, `${id}.${index}`)),
    }),
  };
}

function parseJson(value: unknown): JsonPlan | undefined {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  const top = Array.isArray(parsed) ? parsed[0] : undefined;
  if (!isRecord(top) || !isRecord(top.Plan)) return undefined;
  return {
    root: toNode(top.Plan, "0"),
    planningMs: num(top["Planning Time"]),
    executionMs: num(top["Execution Time"]),
  };
}

/**
 * `EXPLAIN` の結果なら、表し方を返す。それ以外の結果は undefined を返し、表で出す。
 * 判定は、列が `QUERY PLAN` の 1 つだけであることで行う。画面は、訪問者が書いた文を書き換えて実行し直さない。
 */
export function toPlanView(result: SqlResult): PlanView | undefined {
  if (result.fields.length !== 1 || result.fields[0] !== "QUERY PLAN") return undefined;
  const cells = result.rows.map((row) => row[0]);
  if (cells.length === 1) {
    const plan = parseJson(cells[0]);
    if (plan) return { kind: "json", plan };
  }
  return { kind: "text", text: cells.map(String).join("\n") };
}

import type { Column, Relation } from "./catalog";

export type Entity = { name: string; columns: Column[] };

export const BOX_W = 210;
export const ROW_H = 19;
export const HEAD_H = 26;
const GAP_X = 90;
const GAP_Y = 34;
const PAD = 12;
/** 同じ列の箱どうしを結ぶ線は、箱の右へ出して縦に引く。線ごとに縦の位置をずらす */
const LANE_0 = 14;
const LANE_STEP = 10;

type Placed = Entity & { x: number; y: number };
type Edge = { key: string; d: string; dot: { x: number; y: number } };

/**
 * 線が短くなるよう、外部キーでつながるテーブルを続けて並べる。
 * 関係の多いテーブルから始め、つながる先を幅優先でたどる。
 */
export function orderEntities(entities: Entity[], relations: Relation[]): Entity[] {
  const near = new Map(entities.map((e) => [e.name, [] as string[]]));
  for (const r of relations) {
    near.get(r.src)?.push(r.tgt);
    near.get(r.tgt)?.push(r.src);
  }
  const byName = new Map(entities.map((e) => [e.name, e]));
  const start = [...entities].sort(
    (a, b) => (near.get(b.name)?.length ?? 0) - (near.get(a.name)?.length ?? 0),
  );
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const s of start) {
    const queue = [s.name];
    while (queue.length > 0) {
      const name = queue.shift() as string;
      if (seen.has(name)) continue;
      seen.add(name);
      const e = byName.get(name);
      if (e) out.push(e);
      queue.push(...(near.get(name) ?? []).filter((n) => !seen.has(n)).sort());
    }
  }
  return out;
}

export function layoutEr(entities: Entity[], relations: Relation[], cols: 1 | 2) {
  const n = entities.length === 1 ? 1 : cols;
  const ordered = orderEntities(entities, relations);
  const placed: Placed[] = ordered.map((e, i) => {
    const col = i % n;
    const row = Math.floor(i / n);
    const above = ordered.filter((_, j) => j % n === col && Math.floor(j / n) < row);
    return {
      ...e,
      x: PAD + col * (BOX_W + GAP_X),
      y: PAD + above.reduce((h, a) => h + HEAD_H + a.columns.length * ROW_H + GAP_Y, 0),
    };
  });
  const at = new Map(placed.map((e) => [e.name, e]));

  /** 列の行の中央。見つからなければ箱の見出しの中央 */
  const rowY = (e: Placed, column: string | undefined) => {
    const i = e.columns.findIndex((c) => c.name === column);
    return i < 0 ? e.y + HEAD_H / 2 : e.y + HEAD_H + i * ROW_H + ROW_H / 2;
  };

  const lanes = new Map<number, number>();
  const edges: Edge[] = [];
  for (const r of relations) {
    const a = at.get(r.src);
    const b = at.get(r.tgt);
    if (!a || !b) continue;
    const ay = rowY(a, r.cols[0]);
    const by = rowY(b, r.refs[0]);
    if (a.x !== b.x) {
      const right = a.x < b.x;
      const x1 = right ? a.x + BOX_W : a.x;
      const x2 = right ? b.x : b.x + BOX_W;
      const mid = (x1 + x2) / 2;
      edges.push({
        key: r.name,
        d: `M ${x1} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${x2} ${by}`,
        dot: { x: x2, y: by },
      });
      continue;
    }
    const lane = lanes.get(a.x) ?? 0;
    lanes.set(a.x, lane + 1);
    const edge = a.x + BOX_W;
    const lx = edge + LANE_0 + lane * LANE_STEP;
    edges.push({
      key: r.name,
      d: `M ${edge} ${ay} H ${lx} V ${by} H ${edge}`,
      dot: { x: edge, y: by },
    });
  }

  const lastX = PAD + (n - 1) * (BOX_W + GAP_X);
  const used = lanes.get(lastX) ?? 0;
  const width = lastX + BOX_W + (used > 0 ? LANE_0 + used * LANE_STEP : 0) + PAD;
  const height = PAD + Math.max(...placed.map((e) => e.y + HEAD_H + e.columns.length * ROW_H));
  const fk = new Set(relations.flatMap((r) => r.cols.map((c) => `${r.src}.${c}`)));
  return { placed, edges, width, height, fk };
}

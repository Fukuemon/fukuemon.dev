import type { Column, Relation } from "./schema";

export type Entity = { name: string; columns: Column[] };

type Props = { entities: Entity[]; relations: Relation[] };

const BOX_W = 210;
const ROW_H = 19;
const HEAD_H = 26;
const GAP_X = 90;
const GAP_Y = 34;
const PAD = 12;

/**
 * ER 図。SVG を自前で描く。
 * mermaid はクライアントで描くと約 300 KiB を配ることになる (ADR-0009)。
 * 実体と外部キーを出すだけなので、箱と線で足りる。
 */
export default function ErDiagram({ entities, relations }: Props) {
  if (entities.length === 0) return <p className="mono meta">まだテーブルがありません</p>;

  // 列の多い実体から順に、2 列で敷き詰める
  const cols = entities.length === 1 ? 1 : 2;
  const placed = entities.map((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const above = entities.filter((_, j) => j % cols === col && Math.floor(j / cols) < row);
    return {
      ...e,
      x: PAD + col * (BOX_W + GAP_X),
      y: PAD + above.reduce((n, a) => n + HEAD_H + a.columns.length * ROW_H + GAP_Y, 0),
    };
  });

  const at = new Map(placed.map((e) => [e.name, e]));
  const width = PAD * 2 + cols * BOX_W + (cols - 1) * GAP_X;
  const height =
    PAD * 2 + Math.max(...placed.map((e) => e.y + HEAD_H + e.columns.length * ROW_H)) - PAD;

  return (
    <svg
      className="er-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="テーブル構成"
    >
      {relations.map((r) => {
        const a = at.get(r.src);
        const b = at.get(r.tgt);
        if (!a || !b) return null;
        const ay = a.y + HEAD_H + (a.columns.length * ROW_H) / 2;
        const by = b.y + HEAD_H + (b.columns.length * ROW_H) / 2;
        const right = a.x < b.x;
        const x1 = right ? a.x + BOX_W : a.x;
        const x2 = right ? b.x : b.x + BOX_W;
        const mid = (x1 + x2) / 2;
        return (
          <g key={r.name}>
            <path
              d={`M ${x1} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${x2} ${by}`}
              fill="none"
              stroke="var(--rule-strong)"
            />
            <circle cx={x2} cy={by} r="3" fill="var(--now)" />
          </g>
        );
      })}

      {placed.map((e) => (
        <g key={e.name}>
          <rect
            x={e.x}
            y={e.y}
            width={BOX_W}
            height={HEAD_H + e.columns.length * ROW_H}
            fill="none"
            stroke="var(--rule-strong)"
          />
          <line
            x1={e.x}
            y1={e.y + HEAD_H}
            x2={e.x + BOX_W}
            y2={e.y + HEAD_H}
            stroke="var(--rule-strong)"
          />
          <text x={e.x + 10} y={e.y + 18} className="er-svg__name">
            {e.name}
          </text>
          {e.columns.map((c, i) => (
            <g key={c.name}>
              {c.pk && (
                <text x={e.x + 10} y={e.y + HEAD_H + i * ROW_H + 14} className="er-svg__pk">
                  PK
                </text>
              )}
              <text x={e.x + 34} y={e.y + HEAD_H + i * ROW_H + 14} className="er-svg__col">
                {c.name}
              </text>
              <text
                x={e.x + BOX_W - 10}
                y={e.y + HEAD_H + i * ROW_H + 14}
                className="er-svg__type"
                textAnchor="end"
              >
                {short(c.type)}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** 型名は長いと箱を割る。よく出るものだけ縮める */
function short(type: string): string {
  return type
    .replace("timestamp with time zone", "timestamptz")
    .replace("character varying", "varchar")
    .replace("double precision", "float8");
}

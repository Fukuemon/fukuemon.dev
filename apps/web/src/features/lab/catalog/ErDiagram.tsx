import type { Relation } from "./catalog";
import { BOX_W, HEAD_H, ROW_H, layoutEr, type Entity } from "./er-layout";

type Props = { entities: Entity[]; relations: Relation[]; cols: 1 | 2 };

/**
 * ER 図。SVG を自前で描く。
 * mermaid はクライアントで描くと約 300 KiB を配ることになる (ADR-0009)。
 * 実体と外部キーを出すだけなので、箱と線で足りる。
 * 狭い画面では 1 列に積む。2 列を縮めて収めると、文字が読めない大きさになる。
 */
export default function ErDiagram({ entities, relations, cols }: Props) {
  if (entities.length === 0) return <p className="meta">まだテーブルがありません</p>;

  const { placed, edges, width, height, fk } = layoutEr(entities, relations, cols);

  return (
    <svg
      className="er-svg h-auto w-max max-w-full min-w-full"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="テーブル構成"
    >
      {edges.map((e) => (
        <g key={e.key}>
          <path d={e.d} fill="none" stroke="var(--color-rule-strong)" />
          <circle cx={e.dot.x} cy={e.dot.y} r="3" fill="var(--color-now)" />
        </g>
      ))}

      {placed.map((e) => (
        <g key={e.name}>
          <rect
            x={e.x}
            y={e.y}
            width={BOX_W}
            height={HEAD_H + e.columns.length * ROW_H}
            fill="var(--color-paper)"
            stroke="var(--color-rule-strong)"
          />
          <line
            x1={e.x}
            y1={e.y + HEAD_H}
            x2={e.x + BOX_W}
            y2={e.y + HEAD_H}
            stroke="var(--color-rule-strong)"
          />
          <text x={e.x + 10} y={e.y + 18} className="fill-fg text-[13px] font-semibold">
            {e.name}
          </text>
          {e.columns.map((c, i) => {
            const mark = c.pk ? "PK" : fk.has(`${e.name}.${c.name}`) ? "FK" : "";
            return (
              <g key={c.name}>
                {mark && (
                  <text
                    x={e.x + 10}
                    y={e.y + HEAD_H + i * ROW_H + 14}
                    className={`text-[9px] font-semibold ${c.pk ? "fill-now" : "fill-fg-2"}`}
                  >
                    {mark}
                  </text>
                )}
                <text
                  x={e.x + 34}
                  y={e.y + HEAD_H + i * ROW_H + 14}
                  className="fill-fg text-[11px]"
                >
                  {c.name}
                </text>
                <text
                  x={e.x + BOX_W - 10}
                  y={e.y + HEAD_H + i * ROW_H + 14}
                  className="fill-fg-2 text-[10px]"
                  textAnchor="end"
                >
                  {short(c.type)}
                </text>
              </g>
            );
          })}
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

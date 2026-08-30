import type { Preset } from "@fukuemon/content-model";
import { emitPreset } from "./bus";

type Props = { contentId: string; presets: Preset[] };

/** 見出しは側柱の開閉ボタンが兼ねる。置くと同じ語が縦に 2 つ並ぶ */
export default function Presets({ contentId, presets }: Props) {
  if (presets.length === 0) return null;
  return (
    <section className="pg-presets" aria-label="試す">
      <ul className="pg-list">
        {presets.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              className="hit pg-preset"
              onClick={() => emitPreset(contentId, p.sql)}
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Preset } from "@fukuemon/content-model";
import { PRESET_EVENT } from "./schema";

type Props = { contentId: string; presets: Preset[] };

/** 側柱の「試す」。押すと実行パネルの入力欄へ入る */
export default function Presets({ contentId, presets }: Props) {
  if (presets.length === 0) return null;
  return (
    <section className="pg-presets" aria-label="試す">
      <p className="mono meta pg-presets__head">試す</p>
      <ul className="pg-list">
        {presets.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              className="hit pg-preset"
              onClick={() =>
                globalThis.dispatchEvent(
                  new CustomEvent(PRESET_EVENT, { detail: { contentId, sql: p.sql } }),
                )
              }
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

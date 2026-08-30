import type { Preset } from "@fukuemon/content-model";
import { emitPreset } from "../bus";

type Props = { contentId: string; presets: Preset[] };

/** 見出しは側柱の開閉ボタンが兼ねる。置くと同じ語が縦に 2 つ並ぶ */
export default function Presets({ contentId, presets }: Props) {
  if (presets.length === 0) return null;
  return (
    <section className="pt-intra-2" aria-label="試す">
      <ul className="list-none m-0 p-0">
        {presets.map((p) => (
          <li key={p.label}>
            <button
              type="button"
              className="block w-full min-h-[36px] py-intra-1 px-0 border-t border-rule bg-transparent text-start text-[0.875rem] text-fg hover:text-link font-[family-name:inherit] [font-weight:inherit] leading-[inherit] cursor-pointer"
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

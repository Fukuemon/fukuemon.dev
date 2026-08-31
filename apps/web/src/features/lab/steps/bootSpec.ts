/**
 * ハンズオンの起動材料。
 * 文書に 1 つだけ置き、実行パネルの島はここから読む。
 * 島の props に入れると、パネルの数だけ同じ配列が HTML へ焼かれる
 * (24 パネルの記事で計 136 KB。ADR-0010 の検証で実測)。
 */
export type BootSpec = {
  setup?: string;
  /** 全手順の SQL。再訪時に完了済みだけを順に流し直す */
  steps: { step: number; sql: string }[];
};

const EMPTY: BootSpec = { steps: [] };

export const bootSpecId = (contentId: string) => `lab-boot-${contentId}`;

/** `</script>` で JSON が切れないようにする。JSON としての意味は変わらない */
export const encodeBootSpec = (spec: BootSpec): string =>
  JSON.stringify(spec).replaceAll("<", "\\u003c");

export function readBootSpec(contentId: string): BootSpec {
  const el = globalThis.document?.getElementById(bootSpecId(contentId));
  if (!el?.textContent) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(el.textContent);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;
    const { setup, steps } = parsed as Partial<BootSpec>;
    if (!Array.isArray(steps)) return EMPTY;
    return { setup: typeof setup === "string" ? setup : undefined, steps };
  } catch {
    return EMPTY;
  }
}

import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * 動きのユーティリティを、見本で並べる。時間で進む動きは、画面を開いたときと hover のときに 1 回見える。
 * 動きを減らす設定にすると、全て止まって元の形で出る。
 */
function MotionTokens() {
  return (
    <div className="flex flex-col gap-8 bg-surface p-6 text-text">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">色と回転の切り替え</h2>
        <button
          type="button"
          className="w-fit border border-border px-4 py-2 text-label transition-colors hover:bg-primary-surface"
        >
          <code className="font-mono text-code-dense">transition-colors</code>
        </button>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">罫と筆の線を引く</h2>
        <span aria-hidden="true" className="h-1 w-64 animate-stroke bg-primary stroke-brush" />
        <code className="font-mono text-code-dense">animate-stroke stroke-brush</code>
        <a href="#motion" className="w-fit">
          <span className="link-rule">link-rule</span>
        </a>
        <a href="#motion" className="brush-hover w-fit pb-1">
          brush-hover
        </a>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">出る</h2>
        <div className="w-64 animate-fade-in border border-border-field bg-surface-raised p-4 shadow-raised">
          <code className="font-mono text-code-dense">animate-fade-in</code>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">処理中の印</h2>
        <span
          aria-hidden="true"
          className="relative h-0.5 w-24 overflow-hidden bg-border after:absolute after:inset-0 after:animate-loading after:bg-primary"
        />
        <code className="font-mono text-code-dense">animate-loading</code>
        <span aria-hidden="true" className="loading-dots text-text">
          <span />
          <span />
          <span />
        </span>
        <code className="font-mono text-code-dense">loading-dots</code>
      </section>
    </div>
  );
}

const meta = {
  title: "トークン/動き",
  component: MotionTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MotionTokens>;

export default meta;

export const Overview: StoryObj<typeof meta> = { name: "一覧" };

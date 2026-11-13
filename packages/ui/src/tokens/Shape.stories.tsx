import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * 区切りと重なりとフォーカスの表示を、見本で並べる。余白は Tailwind のデフォルトの段（1 段 4px）を使う。
 * 区切りは罫線と余白で示す。操作できる要素と重なる面の角は rounded-control で丸め、重なる面は 1px の枠と shadow-raised の影で示す。
 */
function ShapeTokens() {
  return (
    <div className="flex flex-col gap-8 bg-surface p-6 text-text">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">区切り</h2>
        <ul className="flex flex-col gap-6">
          <li className="flex flex-col gap-2">
            <span aria-hidden="true" className="h-0 w-64 border-t border-border" />
            <code className="font-mono text-code-dense">border-border</code>
          </li>
          <li className="flex flex-col gap-2">
            <span aria-hidden="true" className="h-0 w-64 border-t-2 border-text" />
            <code className="font-mono text-code-dense">border-t-2 border-text</code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">重なり</h2>
        <ul className="flex flex-wrap gap-8 bg-surface-subtle p-6">
          <li className="flex flex-col items-center gap-3">
            <span
              aria-hidden="true"
              className="size-16 rounded-control border border-border-field bg-surface-raised shadow-raised"
            />
            <code className="font-mono text-code-dense">
              rounded-control border-border-field bg-surface-raised shadow-raised
            </code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">角</h2>
        <ul className="flex flex-wrap gap-8">
          <li className="flex flex-col items-center gap-3">
            <span
              aria-hidden="true"
              className="h-12 w-32 rounded-control bg-surface ring-1 ring-border-field ring-inset"
            />
            <code className="font-mono text-code-dense">rounded-control</code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">フォーカス</h2>
        <button
          type="button"
          className="focus-ring w-fit rounded-control bg-primary px-4 py-3 text-label text-text-inverse"
        >
          フォーカスの表示
        </button>
      </section>
    </div>
  );
}

const meta = {
  title: "トークン/余白と区切りと重なり",
  component: ShapeTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShapeTokens>;

export default meta;

export const Overview: StoryObj<typeof meta> = { name: "一覧" };

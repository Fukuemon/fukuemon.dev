import type { Meta, StoryObj } from "@storybook/react-vite";

/** テーマ変数の角丸と影を、名前と見本で並べる。余白は Tailwind のデフォルトの段（1 段 4px）を使う。 */
function ShapeTokens() {
  return (
    <div className="flex flex-col gap-8 bg-surface p-6 text-text">
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">角丸</h2>
        <ul className="flex flex-wrap gap-6">
          <li className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="size-16 rounded-sm border border-border-field bg-surface-subtle"
            />
            <code className="font-mono text-code-dense">rounded-sm</code>
          </li>
          <li className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="size-16 rounded-md border border-border-field bg-surface-subtle"
            />
            <code className="font-mono text-code-dense">rounded-md</code>
          </li>
          <li className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="size-16 rounded-lg border border-border-field bg-surface-subtle"
            />
            <code className="font-mono text-code-dense">rounded-lg</code>
          </li>
          <li className="flex flex-col items-center gap-2">
            <span
              aria-hidden="true"
              className="size-16 rounded-full border border-border-field bg-surface-subtle"
            />
            <code className="font-mono text-code-dense">rounded-full</code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">影</h2>
        <ul className="flex flex-wrap gap-8">
          <li className="flex flex-col items-center gap-3">
            <span aria-hidden="true" className="size-16 rounded-md bg-surface shadow-1" />
            <code className="font-mono text-code-dense">shadow-1</code>
          </li>
          <li className="flex flex-col items-center gap-3">
            <span aria-hidden="true" className="size-16 rounded-md bg-surface shadow-2" />
            <code className="font-mono text-code-dense">shadow-2</code>
          </li>
          <li className="flex flex-col items-center gap-3">
            <span aria-hidden="true" className="size-16 rounded-md bg-surface shadow-3" />
            <code className="font-mono text-code-dense">shadow-3</code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">フォーカス</h2>
        <button
          type="button"
          className="focus-ring w-fit rounded-md bg-primary px-4 py-3 text-label text-text-inverse"
        >
          フォーカスの表示
        </button>
      </section>
    </div>
  );
}

const meta = {
  title: "トークン/余白と角丸と影",
  component: ShapeTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShapeTokens>;

export default meta;

export const Overview: StoryObj<typeof meta> = { name: "一覧" };

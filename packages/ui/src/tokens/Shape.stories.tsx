import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * 区切りと重なりとフォーカスの表示を、見本で並べる。余白は Tailwind のデフォルトの段（1 段 4px）を使う。
 * 区切りは罫線と余白で示す。操作できる要素と重なる面の角は rounded-control で丸め、重なる面は 1px の枠と shadow-raised の影で示す。
 * ボタン、枠のある入力欄、ボタングループのボタンは、枠線の内側に stitch でステッチ（破線）を引く。
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
          <li className="flex flex-col items-center gap-3">
            <span
              aria-hidden="true"
              className="h-12 w-32 rounded-control bg-surface stitch ring-1 ring-border-field ring-inset"
            />
            <code className="font-mono text-code-dense">rounded-control stitch</code>
          </li>
          <li className="flex flex-col items-center gap-3">
            <span
              aria-hidden="true"
              className="h-12 w-32 rounded-control bg-primary stitch stitch-current text-text-inverse"
            />
            <code className="font-mono text-code-dense">stitch stitch-current</code>
          </li>
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">ボタングループ</h2>
        <div className="flex flex-col gap-3">
          <div className="band">
            {["自動", "春", "夏", "秋", "冬"].map((label) => (
              <button
                aria-pressed={label === "秋"}
                className="min-h-11 min-w-11 cursor-pointer px-3 text-label focus-visible:focus-ring"
                key={label}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <code className="font-mono text-code-dense">
            band（親要素）。子要素の枠線、ステッチ、選択中の反転は band が描く
          </code>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-heading-md font-semibold">フォーカス</h2>
        <button
          type="button"
          className="focus-ring w-fit rounded-control bg-primary stitch stitch-current px-4 py-3 text-label text-text-inverse"
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

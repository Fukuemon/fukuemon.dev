import type { Meta, StoryObj } from "@storybook/react-vite";

const SAMPLE = "記事を読み、コードを動かす。Read the article.";

/** テーマ変数の文字のスタイルを、用途の名前と見本で並べる。 */
function TextTokens() {
  return (
    <div className="flex flex-col gap-6 bg-surface p-6 text-text">
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">heading-lg（明朝）</code>
        <p className="font-heading text-heading-lg font-semibold">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">heading-md（明朝）</code>
        <p className="font-heading text-heading-md font-semibold">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">heading-sm（明朝）</code>
        <p className="font-heading text-heading-sm font-semibold">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">body</code>
        <p className="font-sans text-body">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">body-dense</code>
        <p className="font-sans text-body-dense">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">label</code>
        <p className="font-sans text-label">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">caption</code>
        <p className="font-sans text-caption">{SAMPLE}</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">code（等幅）</code>
        <p className="font-mono text-code">const 値 = fetch("/api");</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">code-dense（等幅）</code>
        <p className="font-mono text-code-dense">content-type: application/json</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">
          compact（コードを動かす画面だけ）
        </code>
        <p className="font-mono text-compact">10:00:00.120 server.js</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">
          label-compact（コードを動かす画面だけ）
        </code>
        <p className="text-label-compact">error 1</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">
          body-compact（コードを動かす画面だけ）
        </code>
        <p className="font-sans text-body-compact">server.js</p>
      </section>
      <section className="flex flex-col gap-2">
        <code className="font-mono text-code-dense text-text-secondary">
          code-compact（等幅、コードを動かす画面だけ）
        </code>
        <p className="font-mono text-code-compact">const 値 = fetch("/api");</p>
      </section>
    </div>
  );
}

const meta = {
  title: "トークン/文字",
  component: TextTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TextTokens>;

export default meta;

export const Overview: StoryObj<typeof meta> = { name: "一覧" };

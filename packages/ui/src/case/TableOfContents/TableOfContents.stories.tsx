import type { Meta, StoryObj } from "@storybook/react-vite";

import { type TableOfContentsItem, TableOfContents } from "./TableOfContents";

const ITEMS: TableOfContentsItem[] = [
  { id: "overview", label: "認可コードフローの流れ", level: 2 },
  { id: "authorize", label: "認可のリクエストを送る", level: 2 },
  { id: "state", label: "state を確かめる", level: 3 },
  { id: "pkce", label: "PKCE の値を付ける", level: 3 },
  { id: "token", label: "トークンと引き換える", level: 2 },
  { id: "summary", label: "まとめ", level: 2 },
];

/** 目次と、目次が指す見出しを並べた記事の例。見出しの間を画面の高さだけ空け、読んでいる見出しが移るようにする。 */
function ArticleExample({ items }: { items: TableOfContentsItem[] }) {
  return (
    <div className="flex gap-8 p-4">
      <div className="sticky top-0 w-64 shrink-0 self-start">
        <TableOfContents headings={items} />
      </div>
      <article className="flex-1 pb-96">
        {items.map((item) => {
          const Heading = item.level === 2 ? "h2" : "h3";
          return (
            <section className="min-h-screen" key={item.id}>
              <Heading
                className={item.level === 2 ? "text-heading-md" : "text-heading-sm"}
                id={item.id}
              >
                {item.label}
              </Heading>
              <p className="text-body">ダミーの本文。</p>
            </section>
          );
        })}
      </article>
    </div>
  );
}

const meta = {
  title: "コンポーネント/Case/TableOfContents",
  component: TableOfContents,
  args: { headings: ITEMS },
} satisfies Meta<typeof TableOfContents>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "デフォルト" };
export const Reading: Story = {
  name: "読んでいる見出しあり",
  render: (args) => <ArticleExample items={[...args.headings]} />,
  play: async ({ canvasElement }) => {
    canvasElement.ownerDocument.getElementById("state")?.scrollIntoView();
  },
};

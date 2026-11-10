import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArtBand } from "../base/ArtBand/ArtBand";
import { Breadcrumb } from "../base/Breadcrumb/Breadcrumb";
import { Link } from "../base/Link/Link";
import { Notice } from "../base/Notice/Notice";
import { Table } from "../base/Table/Table";
import { SearchBox } from "../case/SearchBox/SearchBox";
import { SeriesPager } from "../case/SeriesPager/SeriesPager";
import { type TableOfContentsItem, TableOfContents } from "../case/TableOfContents/TableOfContents";

const meta = {
  title: "画面/記事",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const SUGGESTIONS = [
  { title: "認可コードフローを手で追う", url: "#article" },
  { title: "PKCE の値を作る", url: "#pkce" },
];

function SiteHeader() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-4">
      <p className="font-heading text-heading-md font-semibold text-text">fukuemon.dev</p>
      <div className="w-80">
        <SearchBox action="#search" label="記事を検索" suggestions={SUGGESTIONS} />
      </div>
    </header>
  );
}

const ARTICLES = [
  { title: "認可コードフローを手で追う", date: "2026-11-01" },
  { title: "PKCE の値を作る", date: "2026-10-20" },
  { title: "Cookie の属性を確かめる", date: "2026-10-02" },
];

// 挿絵は記事の一覧の冒頭にだけ置き、記事の本文には置かない
export const List: Story = {
  name: "記事の一覧",
  render: () => (
    <div className="min-h-screen bg-surface text-text">
      <SiteHeader />
      <main className="mx-auto flex max-w-prose flex-col gap-4 px-6 py-8">
        <h1 className="font-heading text-heading-lg font-semibold">記事</h1>
        <ArtBand layout="band" motif="seigaiha" />
        <ul className="flex flex-col gap-4">
          {ARTICLES.map((article) => (
            <li className="flex flex-col gap-1" key={article.title}>
              <Link href="#article">{article.title}</Link>
              <span className="text-caption text-text-secondary">{article.date}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  ),
};

const HEADINGS: TableOfContentsItem[] = [
  { id: "flow", label: "認可コードフローの流れ", level: 2 },
  { id: "authorize", label: "認可のリクエストを送る", level: 2 },
  { id: "state", label: "state を確かめる", level: 3 },
  { id: "token", label: "トークンと引き換える", level: 2 },
  { id: "summary", label: "まとめ", level: 2 },
];

function Section({ item }: { item: TableOfContentsItem }) {
  const Heading = item.level === 2 ? "h2" : "h3";
  return (
    <section className="flex min-h-96 flex-col gap-4">
      <Heading
        className={
          item.level === 2
            ? "font-heading text-heading-md font-semibold"
            : "font-heading text-heading-sm font-semibold"
        }
        id={item.id}
      >
        {item.label}
      </Heading>
      <p className="text-body">
        ダミーの本文。クライアントは、利用者をサーバーの認可のページへ送り、戻ってきた認可コードをトークンと引き換える。
      </p>
      {item.id === "authorize" && (
        <Table caption="認可のリクエストの引数">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>名前</Table.HeaderCell>
              <Table.HeaderCell>意味</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>response_type</Table.Cell>
              <Table.Cell>code を渡す</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>state</Table.Cell>
              <Table.Cell>戻ってきたときに照らす値</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      )}
      {item.id === "state" && (
        <Notice title="state を省かない" tone="warning">
          省くと、別の利用者の認可コードを受け取ってしまう。
        </Notice>
      )}
    </section>
  );
}

export const Article: Story = {
  name: "記事",
  render: () => (
    <div className="min-h-screen bg-surface text-text">
      <SiteHeader />
      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
        <article className="flex max-w-prose min-w-0 flex-1 flex-col gap-8">
          <Breadcrumb
            items={[
              { label: "記事", href: "#articles" },
              { label: "OAuth を手で追う", href: "#series" },
              { label: "認可コードフローを手で追う", href: "#article" },
            ]}
          />
          <h1 className="font-heading text-heading-lg font-semibold">認可コードフローを手で追う</h1>
          {HEADINGS.map((item) => (
            <Section item={item} key={item.id} />
          ))}
          <SeriesPager
            next={{ title: "PKCE の値を作る", href: "#next" }}
            position={2}
            prev={{ title: "OAuth の登場人物", href: "#prev" }}
            series="OAuth を手で追う"
            total={5}
          />
        </article>
        <aside className="sticky top-0 hidden w-64 shrink-0 self-start md:block">
          <TableOfContents headings={HEADINGS} />
        </aside>
      </div>
    </div>
  ),
};

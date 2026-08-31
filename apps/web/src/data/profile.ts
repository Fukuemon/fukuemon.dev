/** 書いている人の正本。本文へ直書きしない */

export const PROFILE = {
  name: "Fukuemon",
  reading: "ふくえもん",
  role: "エンジニア。",
  lead: "食と筋トレ駆動のうぇぶえんじにあ",
  note: "フロントエンド、バックエンド、インフラなど浅く広く....深みをつけたい",
} as const;

/** ここ以外に URL を書かない */
export const LINKS = [
  { label: "GitHub", href: "https://github.com/Fukuemon", icon: "github" },
  { label: "X", href: "https://x.com/fukuemony", icon: "x" },
  { label: "Zenn", href: "https://zenn.dev/fukuemon", icon: "zenn" },
  { label: "RSS", href: "/rss.xml", icon: "rss" },
] as const;

/** 直近 1 年で動かした公開リポジトリから採る。最終確認 2026-08-30 */
export const STACK: { label: string; items: string[] }[] = [
  { label: "言語", items: ["Go", "TypeScript", "Java", "Python"] },
  { label: "基盤", items: ["Terraform", "AWS", "Google Cloud"] },
];

export type Outside = { date: string; title: string; href: string; kind: "登壇" | "記事" };

export const OUTSIDE: Outside[] = [
  {
    date: "2025-12-25",
    title: "今日からはじめる知識管理：頑張らないObsidian活用術",
    href: "https://tech-blog.optim.co.jp/entry/2025/12/25/100000",
    kind: "記事",
  },
  {
    date: "2025-07-25",
    title: "メモ整理が苦手な者による頑張らないObsidian活用術",
    href: "https://speakerdeck.com/optim/20250725-obsidian-fukuura",
    kind: "登壇",
  },
  {
    date: "2024-09-30",
    title:
      "OpenAPIの仕様書から指定したPostmanのコレクションを自動更新するDockerイメージを作ったので紹介します",
    href: "https://zenn.dev/fukuemon/articles/1a918a5ade7cf7",
    kind: "記事",
  },
  {
    date: "2023-10-07",
    title: "Next.js(13.5)でTailwindCSS・Sassの導入。ESLint・Stylelint・Prettierのセットアップ",
    href: "https://zenn.dev/fukuemon/articles/e5f7e7f01bbc05",
    kind: "記事",
  },
  {
    date: "2023-10-05",
    title: "フロントエンドテスト入門 〜テストの種類と目的〜",
    href: "https://zenn.dev/fukuemon/articles/3f9739b179fb58",
    kind: "記事",
  },
  {
    date: "2023-08-20",
    title: "Viteで React✖︎TailwindCSS(TS) の環境構築した時の手順をメモ",
    href: "https://zenn.dev/fukuemon/articles/51c606246776d7",
    kind: "記事",
  },
];

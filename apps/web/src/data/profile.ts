/**
 * 書いている人の正本。about 節と外部リンクはここだけを読む。
 * 本文に直書きしない (`context/project.yml` の固有値の扱いに合わせる)。
 */

export const PROFILE = {
  /** 名乗り。ドメインと GitHub の handle に合わせる */
  name: "fukuemon",
  /** 読み。handle の綴りだけでは呼び方が決まらない */
  reading: "ふくえもん",
  /** 何をしている人か。**勤め先は書かない。** 変わるたびに書き直しが要る */
  role: "エンジニア。",
  /** このサイトで何を書いているか */
  lead: "Postgres と可観測性のあたりを調べて書いています。",
  /** どう書いているか。lead の補足 */
  note: "手を動かして確かめられるものは、ブラウザの中で動かせる形にしています。",
} as const;

/** 外部の置き場。ここ以外に URL を書かない */
export const LINKS = [
  { label: "GitHub", href: "https://github.com/Fukuemon" },
  { label: "X", href: "https://x.com/fukuemony" },
  { label: "Zenn", href: "https://zenn.dev/fukuemon" },
  { label: "RSS", href: "/rss.xml" },
] as const;

/**
 * 経歴の代わりに置く一覧。
 * **直近 1 年で実際に動かした公開リポジトリから採る。**
 * 触ったことがあるだけのものを並べない。名前を増やすほど 1 つあたりの意味が薄くなる。
 * 最終確認 2026-08-30。
 */
export const STACK: { label: string; items: string[] }[] = [
  // depwalk (Go の CLI + Java 解析器) / Garden-Lore / python_template
  { label: "言語", items: ["Go", "TypeScript", "Java", "Python"] },
  // kufu-infra / n8n-playground / announce-workflow
  { label: "基盤", items: ["Terraform", "AWS", "Google Cloud"] },
  { label: "このサイト", items: ["Astro", "React", "PGlite (PostgreSQL)"] },
  {
    label: "コミュニティ",
    items: ["GDG Greater Kwansai Organizer", "Go Workshop Conference 2025 IN KOBE 運営"],
  },
];

/**
 * そとで話したもの・書いたもの。
 * このサイトの記事とは別の棚にする。置き場が違えば消える条件も違う。
 */
export type Outside = { date: string; title: string; href: string; kind: "登壇" | "記事" };

export const OUTSIDE: Outside[] = [
  {
    date: "2025-07-25",
    title: "メモ整理が苦手な者による頑張らないObsidian活用術",
    href: "https://speakerdeck.com/optim/20250725-obsidian-fukuura",
    kind: "登壇",
  },
  {
    date: "2024-11-06",
    title: "GDGs Innovative Crosstalk at 東大 【関西 x 東京】イベントレポート",
    href: "https://zenn.dev/fukuemon/articles/47809f2eeeeff9",
    kind: "記事",
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

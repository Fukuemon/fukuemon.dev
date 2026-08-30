/**
 * 書いている人の正本。about 節と外部リンクはここだけを読む。
 * 本文に直書きしない (`context/project.yml` の固有値の扱いに合わせる)。
 */

export const PROFILE = {
  /** 名乗り。ドメインと GitHub の handle に合わせる */
  name: "fukuemon",
  /** 本名。handle だけだと、登壇や OSS の名前と結び付かない */
  realName: "福浦",
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

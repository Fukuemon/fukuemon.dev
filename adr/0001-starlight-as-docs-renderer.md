# ADR-0001: Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む

## 状態

承認

## 決定日

2026-08-29

## 背景

- 記事とハンズオンの画面案が確定している。
  版面は `design/features/design-system/DesignDoc_design-system.md` を正本とする。
- 画面の構造は次である。

  | 位置 | 記事                                    | ハンズオン                                  |
  | ---- | --------------------------------------- | ------------------------------------------- |
  | 左   | サイドバー 306px。目次 + 同じ種別の一覧 | サイドバー 306px。手順一覧 + いまのテーブル |
  | 中   | 本文                                    | 本文 (手順は通し。1 枚ずつ出す)             |
  | 右   | なし                                    | なし                                        |

  サイドバーは折りたためる。折りたたむと 46px になり、縦組みの見出しと開閉ボタンだけが残る。

  **サイドバーが並べるのは、開いている 1 文書の中身と、同じ種別の兄弟だけである。**
  サイト全体のページツリーは持たない。

- Starlight 0.41.10 の構造を実ソースで確認した (2026-08-29)。

  | 事実                                                                                                               | 出典                                          |
  | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
  | Component Override の対象は 28 個                                                                                  | `packages/starlight/schemas/components.ts`    |
  | `hasSidebar: entry.data.template !== 'splash'`                                                                     | `packages/starlight/utils/routing/data.ts:54` |
  | `template: 'splash'` は目次も同時に消す                                                                            | 同 `:64-65`                                   |
  | `components` は astro.config に 1 組だけ持つグローバル設定                                                         | `packages/starlight/schemas/components.ts`    |
  | ページの組み立ては `Page.astro` に固定。`PageFrame` → `TwoColumnContent` → `ContentPanel` の入れ子順は変えられない | `packages/starlight/components/Page.astro`    |

- Starlight は「サイドバー = ページ間ナビゲーション」「目次 = 右に 1 本」を前提に `--sl-content-inline-start` と `data-has-sidebar` を組む。
- Expressive Code は `astro-expressive-code` として Starlight なしで導入できる。
- Pagefind の Starlight 統合は、ビルド出力ディレクトリ全体に `index.addDirectory()` を掛けるだけである。
- Starlight のページは `<main>` に `data-pagefind-body` を付ける。
  Pagefind は、サイト内にこの属性が 1 つでもあれば、持たないページを索引しない。

## 決定

### 1. Starlight を採らない

Docs UI を Astro のページとして自前で組む。
`@astrojs/starlight` を依存に持たない。

**画面案が Starlight のレイアウト前提と 3 点すべてで逆向きだからである。**

|            | Starlight の前提         | 画面案                                      |
| ---------- | ------------------------ | ------------------------------------------- |
| サイドバー | サイト全体のページツリー | 1 文書の中身 (目次 / 手順) と同じ種別の兄弟 |
| 目次       | 右に 1 本                | 左のサイドバーの中                          |
| 右カラム   | 目次                     | 持たない                                    |

`template: splash` はサイドバーと目次を同時に消すため、**「サイドバーだけ外して目次を自前で置く」標準経路が存在しない。**

### 2. Markdown の描画とコードの見た目は既存の部品を使う

| 役割            | 採るもの                                   |
| --------------- | ------------------------------------------ |
| Markdown の描画 | Astro の content collections と `render()` |
| コードブロック  | `astro-expressive-code`                    |
| 全文検索の索引  | `pagefind` (ビルド後に `dist/` を索引)     |
| 見出しアンカー  | `rehype-autolink-headings`                 |

**Expressive Code は画面案のコードの見た目をそのまま出せる。**
ファイル名の frame、コピーボタン、行の強調が標準機能であり、強調の見た目は `styleOverrides.textMarkers` の `markBackground` / `markBorderColor` / `lineMarkerAccentWidth` で指定できる。
トークンの色は `themes` に VS Code 互換の JSON を渡す。

### 3. 検索の UI は条件つきバックログへ回す

索引 (Pagefind) は最初から作る。
**モーダルの UI は、コンテンツが 50 本を超えるまで作らない。**

22 本の段階では、一覧の表と分類の絞り込みのほうが目的の 1 本へ早く着く。

自前ページにも `data-pagefind-body` を付ける。

### 4. Design System を全面的に適用する

`--sl-*` への橋渡しが不要になる。
Design Tokens と `@layer fukuemon` のユーティリティが、記事・ハンズオン・一覧・表紙のすべてに同じ規約で効く。

## 代替案

### 1. Starlight を採り、Override 8 個で画面案へ集約する

#### Pros

- Pagefind の検索モーダル UI をそのまま得られる。
- `<Aside>` / `<Tabs>` / `<Steps>` / `<FileTree>` などの既製コンポーネントが使える。
- `<head>` の SEO / OG / canonical / sitemap が自動で付く。

#### Cons

- 要る Override は `Header` / `PageFrame` / `TwoColumnContent` / `TableOfContents` / `PageTitle` / `Pagination` / `Footer` / `Sidebar` の 8 個。
  レイアウトの連鎖が全部自前になり、**残るのは `MarkdownContent` と `Head` だけになる。**
- `components` がグローバル設定であるため、構造の異なる記事とハンズオンを 1 組の Override 群の中で `entry.data` により分岐させることになる。
  レイアウトを 2 つ書くより読みにくい。
- Override した箇所は Starlight のアップグレードごとに追従コストが発生する。
- 見た目は Starlight の既定を広範に打ち消す必要がある。
  画面案は見出しをほとんど大きくせず、罫線で階層を作る。

**この代替案は成立する。** 採らない理由は不可能性ではなく、置き換える量に対して受け取るものが釣り合わないことにある。

### 2. Starlight を採り、見た目を Starlight の既定へ集約する

#### Pros

- Docs UI の実装量が実際にゼロになる。
- アップグレードの追従コストが最も低い。

#### Cons

- 確定した画面案を捨てることになる。
  縦組みの柱、罫の長さで分量を示す目次、手順一覧、挿絵の帯がいずれも成立しない。
- Portal 側と Docs 側で 2 つの視覚方言が残る。

### 3. Starlight を Markdown レンダラとしてだけ使う

#### Pros

- 検索とコードの見た目を Starlight に任せられる。

#### Cons

- Markdown の描画は Astro の content collections の機能であり、Starlight は関与しない。
  Expressive Code も Pagefind も単体で入る。
  **Starlight から受け取るものが検索モーダル UI だけになる。**
- レイアウトを使わないのに `--sl-*` のカスケードとレイヤ順に追従し続けることになる。

## 外部依存の健全性

| 項目             | `astro-expressive-code`    | `pagefind`                  |
| ---------------- | -------------------------- | --------------------------- |
| 位置づけ         | Astro の integration       | ビルド後に走る CLI / JS API |
| Astro への依存   | integration として直接依存 | なし (`dist/` を読むだけ)   |
| 後継・代替の有無 | Shiki を直接使う           | Orama / 静的 embedding 索引 |

**版の確認は実装着手時に行う。** 本 ADR の判断は版に依存しない。

## 影響

### 良い影響

- **Design System が全画面へ同じ規約で効く。**
  `--sl-*` への橋渡しと、Starlight のカスケードレイヤとの競合が消える。
- 記事とハンズオンでレイアウトを 2 つ書ける。
  条件分岐したレイアウトを持たない。
- 依存が 1 つ減る。
  Starlight のアップグレードに追従する必要がなくなる。
- 画面案をそのまま実装できる。
  実装と画面案のあいだに翻訳が入らない。

### 悪い影響 / トレードオフ

- **Docs UI の実装量がゼロにならない。**
  レイアウト、目次、前後ナビ、見出しアンカー、a11y を自前で持つ。
  ただし画面案は Starlight の既定をどれも使わないため、Starlight を採っても同じ量を書くことになる。
- 検索モーダル UI を後から自作することになる。
  条件が成立するまで作らない。
- `<head>` の SEO / OG / canonical / sitemap を自前で組む。
  `@astrojs/sitemap` と `astro-seo` で代替する (版は実装時に確認)。

### 影響範囲

- 対象モジュール / package: `apps/web`
- `packages/content-model` と `packages/design-system` は無変更。
  Content Model が Astro に依存しないため、描画レイヤの差し替えが波及しない (ADR-0002)。

## 実装・運用への反映

- spec 更新要否: 要 (Docs レイアウトの自作を PoC の範囲に含める)
- context / AI 向け設定更新要否: 要。
  [context/architecture.md](../context/architecture.md) のディレクトリ構成と URL 規約、[context/toolchain.md](../context/toolchain.md) の依存一覧を更新する

## 関連ドキュメント / チケット

- [design/DesignDoc.md](../design/DesignDoc.md): 全体像と URL 構成
- [design/features/design-system/DesignDoc_design-system.md](../design/features/design-system/DesignDoc_design-system.md): 版面の正本
- [ADR-0002](0002-content-model-independence.md): Content Model の独立が本 ADR の変更範囲を限定する
- [ADR-0006](0006-interactive-content-levels.md): ハンズオンの実行環境と isolation の範囲
- [ADR-0008](0008-no-reader-identity.md): 検索を静的に閉じる判断
- [Expressive Code](https://expressive-code.com/)
- [Pagefind](https://pagefind.app/)

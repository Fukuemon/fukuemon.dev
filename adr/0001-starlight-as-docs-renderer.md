# ADR-0001: Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む

## Status

承認

## Context

記事とハンズオンの画面案が確定している。  
版面は `packages/design-system/DesignDoc.md` の定めに従う。

画面の構造は次のとおり。

| 位置 | 記事                                    | ハンズオン                                  |
| ---- | --------------------------------------- | ------------------------------------------- |
| 左   | サイドバー 306px。目次 + 同じ種別の一覧 | サイドバー 306px。手順一覧 + いまのテーブル |
| 中   | 本文                                    | 本文 (手順は通し。1 枚ずつ出す)             |
| 右   | なし                                    | なし                                        |

サイドバーは折りたためる。折りたたむと 46px になり、縦組みの見出しと開閉ボタンだけが残る。  
**サイドバーには、開いている 1 文書の中身と、同じ種別の兄弟だけを並べる。**  
サイト全体のページツリーは持たない。

Starlight 0.41.10 の構造を実ソースで確かめた結果は次のとおり。

| 事実                                                                                                               | 出典                                          |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Component Override の対象は 28 個                                                                                  | `packages/starlight/schemas/components.ts`    |
| `hasSidebar: entry.data.template !== 'splash'`                                                                     | `packages/starlight/utils/routing/data.ts:54` |
| `template: 'splash'` は目次も同時に消す                                                                            | 同 `:64-65`                                   |
| `components` は astro.config に 1 組だけ持つグローバル設定                                                         | `packages/starlight/schemas/components.ts`    |
| ページの組み立ては `Page.astro` に固定。`PageFrame` → `TwoColumnContent` → `ContentPanel` の入れ子順は変えられない | `packages/starlight/components/Page.astro`    |

- Starlight は「サイドバー = ページ間ナビゲーション」「目次 = 右に 1 本」を前提に `--sl-content-inline-start` と `data-has-sidebar` を組む。
- Expressive Code は `astro-expressive-code` として Starlight なしで導入できる。
  - `astro-expressive-code` は Astro の integration で、Astro に直接依存する。代替は Shiki を直接使うこと。
  - 出典: [Expressive Code](https://expressive-code.com/)
- Pagefind の Starlight 統合は、ビルド出力ディレクトリ全体に `index.addDirectory()` を掛けるだけで済ませている。
  - `pagefind` はビルド後に実行する CLI / JS API で、Astro に依存せず `dist/` を読むだけで動く。代替は Orama / 静的 embedding 索引。
  - 出典: [Pagefind](https://pagefind.app/)
- Starlight のページは `<main>` に `data-pagefind-body` を付ける。
  - Pagefind は、サイト内にこの属性が 1 つでもあれば、持たないページを索引しない。

この ADR の判断は、`astro-expressive-code` と `pagefind` の版に依存しない。版の確認は実装着手時に行う。

## Decision

### 1. Starlight を採らない

Docs UI を Astro のページとして自前で組む。  
`@astrojs/starlight` を依存に持たない。

**画面案は、Starlight のレイアウト前提と 3 点すべてで逆向きになっている。**

|            | Starlight の前提         | 画面案                                      |
| ---------- | ------------------------ | ------------------------------------------- |
| サイドバー | サイト全体のページツリー | 1 文書の中身 (目次 / 手順) と同じ種別の兄弟 |
| 目次       | 右に 1 本                | 左のサイドバーの中                          |
| 右カラム   | 目次                     | 持たない                                    |

`template: splash` はサイドバーと目次を同時に消す。  
このため、「サイドバーだけ外して目次を自前で置く」標準の方法が存在しない。

### 2. Markdown の描画とコードの見た目は既存のライブラリを使う

| 役割            | 採るもの                                   |
| --------------- | ------------------------------------------ |
| Markdown の描画 | Astro の content collections と `render()` |
| コードブロック  | `astro-expressive-code`                    |
| 全文検索の索引  | `pagefind` (ビルド後に `dist/` を索引)     |
| 見出しアンカー  | `rehype-autolink-headings`                 |

Expressive Code は、画面案のコードの見た目をそのまま出せる。  
ファイル名の frame、コピーボタン、行の強調は標準機能として備わっている。  
強調の見た目は `styleOverrides.textMarkers` の `markBackground` / `markBorderColor` / `lineMarkerAccentWidth` で指定できる。  
トークンの色は `themes` に VS Code 互換の JSON を渡す。  
出典: [Expressive Code](https://expressive-code.com/)

### 3. 検索の UI は条件つきバックログへ回す

索引 (Pagefind) は最初から作る。  
ADR-0008: [読者の identity を前提とする機能を作らない。バックエンドを持たない](0008-no-reader-identity.md)

**モーダルの UI は、コンテンツが 50 本を超えるまで作らない。**  
22 本の段階では、一覧の表と分類の絞り込みのほうが目的の 1 本へ早く着く。

自前ページにも `data-pagefind-body` を付ける。

### 4. Design System を全面的に適用する

`--sl-*` への橋渡しが不要になる。  
Design Tokens と `@layer fukuemon` のユーティリティが、記事・ハンズオン・一覧・表紙のすべてに同じ規約で適用される。

## Considered Options

| 選択肢                                                                       | 強み                                                                                                                                                                                     | 弱み                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む | 画面案をそのまま実装できる。Design System が全画面へ同じ規約で適用される。依存が 1 つ減る                                                                                                | Docs UI の実装量がゼロにならない。検索モーダル UI と `<head>` の SEO を自前で持つ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Starlight を採り、Override 8 個で画面案へ集約する                            | Pagefind の検索モーダル UI をそのまま得られる。`<Aside>` / `<Tabs>` / `<Steps>` / `<FileTree>` などの既製コンポーネントが使える。`<head>` の SEO / OG / canonical / sitemap が自動で付く | 要る Override は `Header` / `PageFrame` / `TwoColumnContent` / `TableOfContents` / `PageTitle` / `Pagination` / `Footer` / `Sidebar` の 8 個。レイアウトの連鎖が全部自前になり、残るのは `MarkdownContent` と `Head` だけになる。`components` がグローバル設定のため、構造の異なる記事とハンズオンを 1 組の Override 群の中で `entry.data` により分岐させることになり、レイアウトを 2 つ書くより読みにくい。Override した箇所は Starlight のアップグレードごとに追従コストが発生する。画面案は見出しをほとんど大きくせず罫線で階層を作るため、Starlight の既定のスタイルを広範に打ち消す必要がある |
| Starlight を採り、スタイリングを Starlight の既定へ集約する                  | Docs UI の実装量が実際にゼロになる。アップグレードの追従コストが最も低い                                                                                                                 | 確定した画面案を捨てることになる。縦組みの柱、罫の長さで分量を示す目次、手順一覧、挿絵の帯がいずれも成立しない。Portal 側と Docs 側で 2 つの視覚方言が残る                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Starlight を Markdown レンダラとしてだけ使う                                 | 検索とコードの見た目を Starlight に任せられる                                                                                                                                            | Markdown の描画は Astro の content collections の機能で、Starlight は関与しない。Expressive Code も Pagefind も単体で入るため、Starlight から受け取るものが検索モーダル UI だけになる。レイアウトを使わないのに `--sl-*` のカスケードとレイヤ順に追従し続けることになる                                                                                                                                                                                                                                                                                                                            |

Override 8 個で集約する案は成立する。  
採らない理由は不可能性ではなく、置き換える量に対して受け取るものが釣り合わないことにある。

## Consequences

### Positive

- **Design System が全画面へ同じ規約で適用される。**
  - `--sl-*` への橋渡しと、Starlight のカスケードレイヤとの競合が消える。
- 記事とハンズオンでレイアウトを 2 つ書ける。条件分岐したレイアウトを持たない。
- 依存が 1 つ減り、Starlight のアップグレードに追従する必要がなくなる。
- 画面案をそのまま実装でき、実装と画面案のあいだに翻訳が入らない。
- 描画レイヤの変更は `apps/web` に閉じ、`packages/content-model` と `packages/design-system` に波及しない。
  - Content Model が Astro に依存しないため。
  - ADR-0002: [関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ](0002-content-model-independence.md)

### Negative

- **Docs UI の実装量がゼロにならない。**
  - レイアウト、目次、前後ナビ、見出しアンカー、a11y を自前で持つ。
  - ただし画面案は Starlight の既定をどれも使わないため、Starlight を採っても同じ量を書くことになる。
- 検索モーダル UI を後から自作することになる。条件が成立するまで作らない。
- `<head>` の SEO / OG / canonical / sitemap を自前で組む。
  - `@astrojs/sitemap` と `astro-seo` で代替する。版は実装時に確かめる。

# ADR-0021: packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする

## Status

提案

## Context

コンポーネントの置き場と書き方、カタログの組み方を決める必要がある。

- サイトは Astro の静的なサイトに React を載せる。記事は静的に配信し、プレイグラウンドと埋め込んだ実行環境だけを React で動かす。
- 記事のページは、JavaScript を無効にしても読める。
- 運営者は、buddy の `packages/ui` と同じように、Storybook でトークンとコンポーネントを確認したい。
- 今のデザインシステムは、Astro と React で同じものを 2 度書かないよう、コンポーネントを持たない。

## Decision

`packages/ui`（`@fukuemon/ui`）に、ドメインを持たない Base と Case のコンポーネントを置く。  
Domain のコンポーネントは、`apps/web` の `features/<機能>/components` に置く。

- コンポーネントは BCD Design で分類し、名前はドメイン、場面、基本の語の順に並べる。
  - 出典: [BCD Design によるコンポーネントの分類](https://qiita.com/misuken/items/19f9f603ab165e228fe1)
- コンポーネントは React だけで書く。Astro のページは、`client:*` を付けずに置いて静的な HTML として描き、操作に JavaScript が要るものだけを island にする。同じものを Astro と React で 2 度書かずに済む。
- 記事の画面で使うコンポーネントは、JavaScript なしでも内容を読める HTML を出す。
- `apps/web` は `@fukuemon/ui` を `workspace:*` で読み、ビルドせずに TypeScript のまま使う。

カタログは、`packages/ui` の Storybook にする。

- 設定は buddy の `packages/ui/.storybook` と同じ形にする。a11y、docs、vitest のアドオンと、hover の見た目を出すアドオンを使う。
- story は、Vitest のブラウザのテストとして動かし、a11y のアドオンの違反をテストの失敗にする。
- ページは、はじめに、トークン、コンポーネント、パターン、画面の 5 つに分ける。
- カタログは、サイトとは別の Cloudflare の Worker に、静的なアセットとして公開する。
  - Worker のドメインは、`infra/cloudflare/` の Terraform で持つ。
  - develop で check の workflow が通ったときに出す。サイトの自動のデプロイを止めている間も、カタログは出せる。

## Considered Options

| 選択肢                                                                                               | 強み                                                                      | 弱み                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** `packages/ui` に React のコンポーネントを置き、`packages/ui` の Storybook をカタログにする | buddy と同じ形で確認できる。Astro は React のコンポーネントを静的に描ける | 静的に描くコンポーネントでも、React の書き方の制約（hook を使わない描画）を守る        |
| コンポーネントを Astro で書き、island だけ React で書く                                              | 静的な部分に React を使わない                                             | 同じ見た目を 2 つの書き方で持つ。Storybook で Astro のコンポーネントを開く仕組みが要る |
| `apps/web` の Storybook を 1 つのカタログにする（buddy の ADR-0018 の形）                            | 画面の story も同じカタログで読める                                       | `apps/web` を作り直す前は組めない。Astro のページは Storybook で開けない               |

## Consequences

### Positive

- トークンとコンポーネントを、`apps/web` を作り直す前から Storybook で確認できる。
- 記事の画面とコードを動かす画面が、同じコンポーネントを使う。

### Negative

- `packages/ui` が React に依存する。
- Astro のページそのものは、カタログの「画面」に載らない。画面の story は、React のコンポーネントを組んだものだけにする。

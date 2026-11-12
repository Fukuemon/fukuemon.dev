# ADR-0029: リポジトリの構成を buddy に合わせ、文書を `docs/` に、E2E を `packages/e2e` に置く

## Status

提案

## Context

運営者は、このリポジトリのほかに buddy を保守している。  
ディレクトリ、文書の配置先、検証の仕組みが 2 つのリポジトリで違うと、手順とスキルを共有できない。

buddy の構成は次のとおり。  
出典: [buddy](https://github.com/Fukuemon/buddy)

- 文書を `docs/` に集める。`docs/PRD.md`、`docs/design/DesignDoc.md`、`docs/adr/` が実体である。
- 機能ごとの Design Doc は、コードの隣に置く。`docs/design/` から、シンボリックリンクで指す。
- context は、ルートの `context/` に置く。
- E2E は、workspace の package の `packages/e2e/` に置く。`tests/` の下に、`specs`、`evidence`、`screens`、`selectors`、`fixtures`、`setup`、`widgets` を持つ。ESLint は、`packages/e2e` だけに入れている。
- lint と format は、Vite+ の `vp check` で実行する。

このリポジトリの今の構成は次のとおり。

- 文書は、ルートの `PRD.md`、`design/`、`adr/` にある。
- ルートの `e2e/` は、ページの見た目を改修の前後で比べるスクリプトである。E2E のテストは無い。
- `apps/web` は、記事、ハンズオン、playground を持つ Astro のサイトである。このサイトのコードと原稿は引き継がない。
- `packages/design-system` は、旧いトークン、レイアウトのユーティリティ、サイト全体の動きの規則の文書、挿絵の文書を持つ。トークンとコンポーネントは `packages/ui` に、挿絵の生成の出力は `packages/ui/src/art/` に移っている。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
  - ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色で、角丸と影を使わない版面にする](0024-tokens-of-fukuemon-dev.md)
- monorepo の構成の一覧は、`packages/design-system/` を含む。
  - ADR-0003: [pnpm workspace の monorepo とし、Vite+ を `vp run` / `vp env` / 同梱ツールに限定して採用する](0003-monorepo-and-vite-plus.md)
- 旧い Design System を、全てのページに適用すると決めている。
  - ADR-0001: [Starlight を採らず、Astro 単体 + Expressive Code + Pagefind で組む](0001-starlight-as-docs-renderer.md)
- Content Model は、Astro に依存しない package である。
  - ADR-0002: [関係を `contentId` の辺として持ち、Content Model を Astro 非依存に保つ](0002-content-model-independence.md)
- lint と format は Oxlint と Oxfmt を直接実行し、Vite+ は `apps/web` の build のキャッシュだけに使う。
  - ADR-0017: [Vite+ は `apps/web` の build を `vp run` でキャッシュすることだけに使う](0017-vp-run-cache-for-web-build.md)

## Decision

### 1. workspace の構成

monorepo の構成を次のとおりにする。

```text
apps/web/                  Astro の静的サイト。記事、シリーズ、トップ
apps/docs-site/            ドキュメントサイトの Worker
packages/ui/               トークン、コンポーネント、挿絵、カタログ
packages/content-model/    schema、ContentRef、関係グラフ（Astro に依存しない）
packages/config/           tsconfig の共有の設定
packages/e2e/              E2E のテスト
infra/                     Terraform。workspace の package ではない
docs/                      PRD、Design Doc、ADR
context/                   規約と事実
```

- 旧い `apps/web` と `packages/design-system` を消し、`apps/web` を新しく作る。旧いコードを直しながら移すより、引き継がないコードが残らないためである。
- `packages/content-model` と `packages/config` は残す。Astro なしでテストできる境界を保つためである。
- `packages/` にモジュールを増やす条件は、2 つ以上の消費者が実在することのままにする。`packages/e2e` は、テストだけを持つ package として、この条件の例外にする。
- TypeScript は 6.0.2 にする。buddy と同じバージョンである。

### 2. 文書の配置先

- `PRD.md`、`design/`、`adr/` を、`docs/PRD.md`、`docs/design/`、`docs/adr/` に移す。旧い `apps/web` を消す変更と同じ変更で移す。
- 機能ごとの Design Doc は、コードの隣に置いたままにする。`docs/design/apps/` と `docs/design/packages/` から、シンボリックリンクで指す。ドキュメントサイトが `docs/` だけを読めば済むためである。
- `context/` は、ルートに置いたままにする。
- 旧い Design System を全てのページに適用する決定をやめ、全てのページを `packages/ui` のトークンとコンポーネントで構築する。
- サイト全体の動きの規則は、全体の Design Doc の Cross-Cutting Concerns に移す。挿絵の Design Doc は、`packages/ui/src/art/` に移す。

### 3. E2E の配置先

- E2E を `packages/e2e/`（`@fukuemon/e2e`）に置く。ディレクトリの分け方は buddy と同じにする。
- E2E は、Playwright の録画と字幕でエビデンスを撮れる形で書く。
- ESLint は `packages/e2e` だけに入れ、E2E の書き方の規則だけを実行する。
- ルートの `e2e/` を消す。改修の前後の見た目は、E2E のエビデンスの静止画を並べて比べる。

### 4. buddy に合わせないもの

lint と format のコマンドは、buddy の `vp check` に合わせない。  
Oxlint と Oxfmt を直接実行する今の形を変える理由が、コマンドの名前がそろうことのほかに無いためである。

## Considered Options

| 選択肢                                                       | 強み                                                                              | 弱み                                                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **採用:** 文書を `docs/` に、E2E を `packages/e2e` に置く    | buddy と同じ配置先になり、手順とスキルを共有できる。E2E の依存を package に閉じる | 文書のパスが変わり、文書の間のリンクとスクリプトのパスを直す                                   |
| 文書をルートに置いたままにし、E2E をルートの `e2e/` に置く   | パスを変えない                                                                    | buddy と配置先が違う。E2E の依存をルートに足す。ドキュメントサイトが、ルートの複数の場所を読む |
| `packages/content-model` を消し、schema を `apps/web` に書く | package が 1 つ減り、buddy の `packages/` に近づく                                | Astro なしでテストできる境界が無くなる。`contentId` と関連を捨てるかを、別に決めることになる   |
| lint と format も buddy の `vp check` に寄せる               | 2 つのリポジトリで、コマンドと設定の形がそろう                                    | Oxlint の依存の規則と、Vite+ の使い方の決定を書き直す                                          |

## Consequences

### Positive

- 2 つのリポジトリで、文書の配置先と E2E の配置先がそろう。
- 引き継がないコードと原稿が、リポジトリに残らない。
- 旧いトークンと新しいトークンが並ぶ状態が終わる。

### Negative

- 文書を移す変更で、文書の間の相対リンク、`context/project.yml` の `docs`、文書のチェックのスクリプトが読むパスを直す。
- シンボリックリンクは、Windows の checkout で、設定によってはリンクにならない。
- lint と format のコマンドは、buddy と違うままである。

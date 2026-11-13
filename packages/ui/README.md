# @fukuemon/ui

fukuemon.dev のデザインシステム。
プリミティブトークン、セマンティックトークン、テーマ変数と、Base と Case の React のコンポーネントを持つ。
Storybook をカタログにして、https://design.fukuemon.dev で公開する。

## Running

Storybook は、リポジトリのルートで次を実行して、`http://localhost:6106` を開く。

```sh
pnpm --filter @fukuemon/ui storybook
```

## Tests and Checks

トークンとコンポーネントを直したら、リポジトリのルートで次を実行する。
どれも `pnpm run check` に入っており、CI も実行する。

```sh
pnpm run check:contrast
pnpm run check:raw-values
pnpm run check:utilities
pnpm run check:tokens
pnpm run lint
pnpm run test:ui
```

- `check:contrast` は、セマンティックトークンの組のコントラスト比を、ライト、OS の設定のダーク、Storybook のダークの 3 つの条件で確認する。
- `check:raw-values` は、`packages/ui/src` に色の値とプリミティブトークンの名前がないかを確認する。
- `check:utilities` は、`packages/ui/DESIGN.md` の原則に反するユーティリティ（14px より小さい文字、余白の任意値など）がないかを確認する。
- `check:tokens` は、2 つの生成物がトークンと一致するかを確認する。生成物は [Code Generation](#code-generation) にある。
- `lint` は、`packages/ui/src` のテーマ変数にないクラスと、任意の値のクラス（`bg-[#fff]` など）をエラーにする。

## Code Generation

トークンを直したら、リポジトリのルートで次を実行して生成物を作り直し、同じコミットに入れる。

```sh
pnpm run build:tokens
```

- `packages/ui/src/tokens/tokens.gen.css`: 静的なファイルが読むトークンの CSS。`context/project.yml` の `design_system.tokens_css`
- `packages/ui/src/tokens/code-theme.gen.json`: テーマごとに色の値まで解決したコードの色。Expressive Code、エディタ、端末のテーマの元

プリミティブトークンの値は fukuemon.dev が決める。
値を足すときは、`packages/ui/src/tokens/primitive.css` の冒頭の規則の名前で足し、`pnpm run check:contrast` で組み合わせを確認する。

- ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色で、角丸と影を使わない版面にする](../../adr/0024-tokens-of-fukuemon-dev.md)

## Deployment

カタログの Worker へ配信する条件は、[context/operations.md](../../context/operations.md#deployment-conditions) にある。
初めての配信と出し直しは、deploy-catalog workflow を `develop` から手で起動するか、リポジトリのルートで次を実行する。

```sh
pnpm run build:storybook
pnpm --filter @fukuemon/ui run deploy
```

custom domain は Terraform で作る。
基盤を初めて作るときは、[infra/README.md](../../infra/README.md#初めて基盤を作る) の順に、custom domain を作る前にカタログの Worker を作る。

## Documentation

- [DESIGN.md](DESIGN.md): 画面とコンポーネントのコードを書く前に読む規則。トークン、コンポーネント、カタログの規則は [design/](design/) の 3 つの文書にある
- [DesignDoc.md](DesignDoc.md): トークンの層とテーマ、コンポーネントの範囲、カタログの構成
- ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](../../adr/0021-ui-components-and-catalog.md)

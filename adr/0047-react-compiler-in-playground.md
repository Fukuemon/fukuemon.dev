# ADR-0047: React Compiler を、`apps/playground` にだけ入れる

## Status

提案

## Context

React Compiler を入れるかと、入れる範囲を決める必要がある。

- プレイグラウンドのアプリは、Vite の React のアプリである。
  - ADR-0046: [プレイグラウンドを Vite の React のアプリにし、ツールごとに HTML のエントリーポイントとパスを分ける](0046-playground-as-vite-react-app.md)
- プレイグラウンドの画面は、エディタ、端末、HTTP の一覧のように、更新の多いペインを持つ。
- React Compiler は、コンポーネントと hook を、ビルドのときに自動でメモ化する。react.dev は、stable と書いている。
  - 出典: [React Compiler: Introduction](https://react.dev/learn/react-compiler/introduction)
- Vite では、`@vitejs/plugin-react` と `@rolldown/plugin-babel` の `reactCompilerPreset` で入れる。
  - 出典: [React Compiler: Installation](https://react.dev/learn/react-compiler/installation)
- `apps/web` は Astro のアプリで、React の island は少ない。`@astrojs/react` の `compiler` のオプションは、試験的である。
  - 出典: [@astrojs/react（Astro Docs）](https://docs.astro.build/en/guides/integrations-guide/react/)
- `packages/ui` は、`memo`、`useMemo`、`useCallback` を使っていない。
- ツールを追加するときは、同梱のツールで足りるものを別に入れず、beta のツールを採るときは、撤退の手段を書く。
  - [context/tech-stack.md](../context/tech-stack.md)

## Decision

React Compiler を、`apps/playground` のビルドにだけ入れる。  
`apps/web` のビルドと、`packages/ui` の Storybook とテストには入れない。

- `apps/playground` の `vite.config.ts` に、`@rolldown/plugin-babel` と `reactCompilerPreset` を追加する。
- `apps/playground` のコードには、`memo`、`useMemo`、`useCallback` を書かない。書くのは、計測して遅いと分かったときだけにする。
- `apps/playground` のビルドは、import した `@fukuemon/ui` のソースも、React Compiler に通す。`@fukuemon/ui` のコードは、React Compiler が無くても動く形で書く。
- React Compiler を外すときは、`vite.config.ts` から plugin を外す。コードは変えない。

理由は、更新の多いペインで、手でメモ化を書かずに済むことである。

## Verification

使い捨てのアプリ（ADR-0046 の Verification と同じもの）に、`@rolldown/plugin-babel` 0.3.1 と `babel-plugin-react-compiler` 1.0.0 を追加してビルドした。

- ビルドが通った。エントリーポイントのチャンクに、React Compiler が出力するキャッシュのコード（`memo_cache_sentinel`）が入った。React Compiler を外すと、入らなかった。
- 共有のチャンクは、React Compiler を外すと 213.76 kB、入れると 222.55 kB だった。`@fukuemon/ui` のソースが、React Compiler を通っている。
- ビルドの時間は、外すと 0.52 秒、入れると 1.11 秒だった。
- 再描画の回数と、画面の動きは、測っていない。

## Considered Options

| 選択肢                                   | 強み                                                                   | 弱み                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **採用:** `apps/playground` にだけ入れる | 更新の多い画面で、手で `memo`、`useMemo`、`useCallback` を書かずに済む | Babel の plugin が増える。ビルドの時間が増える                                               |
| 入れない                                 | 依存が増えない                                                         | 再描画が遅いときに、手でメモ化を書く                                                         |
| `apps/web` と `packages/ui` にも入れる   | 全ての React のコードで、同じ前提になる                                | `apps/web` の island は少なく、効果が小さい。`@astrojs/react` の `compiler` は、試験的である |

## Consequences

### Positive

- `apps/playground` のコードに、メモ化のための hook を書かない。
- React Compiler を外すときに、コードを変えずに済む。

### Negative

- `apps/playground` のビルドに、Babel の変換が加わる。
- `@fukuemon/ui` のコンポーネントは、カタログ（React Compiler なし）と、プレイグラウンド（React Compiler あり）の 2 つの形でビルドされる。再描画の回数が、2 つで違う。
- React の規則（描画の中で値を書き換えない、など）に反するコードは、React Compiler がメモ化を外す。規則に反するコードを lint で止めるかは、決めていない。

# ADR-0083: 重なる面の上の hover の面に、セマンティックトークン `surface-raised-subtle` を足す

## Status

提案

## Context

重なる面（`surface-raised`）の上で、押せる項目とボタンの hover の面に使う色を決める必要がある。

- トークンを、プリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、テーマの組をコントラストのチェックで確認すると決めている。
  - ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色にする](0024-tokens-of-fukuemon-dev.md)
- 重なる面は、`surface-raised` の面、1px の枠、ずらした影を組にして示すと決めている。
  - ADR-0028: [操作できる要素と重なる面の角を 4px で丸め、ボタンと入力欄にステッチを引き、重なる面にずらした影を付け、罫を引く動きを筆の線にする](0028-radius-shadow-and-brush-motion.md)
- コードを動かす画面のペインの紙の面（`surface-pane`）の上の hover には、`surface-pane-subtle` を使うと決めている。
  - ADR-0073: [コードを動かす画面を、地の上に角の丸い紙の面を重ねる見た目にし、面の角を 6〜14px で丸める](0073-layered-panes-and-radius-in-playground.md)
  - `surface-pane-subtle` は、コードを動かす画面の外で使わない。
- 次の 3 つの要素は、面に `surface-raised` を、hover の面に `surface-subtle` を使っていた。
  - `ActionMenu` のメニューの項目（`density` が `default` と `compact` の両方）
  - `SearchBox` の候補
  - `Dialog` の閉じるボタン
- ダークでは、`surface-raised` と `surface-subtle` が、どちらも `sumi-800` である。
  そのため、3 つの要素の hover の面が、重なる面と同じ色になり、見えなかった。
  - コンポーネントのテスト（Vitest のブラウザのテスト）で、ダークの 3 つの要素の hover の面が、重なる面と同じ `sumi-800` の色になることを確認した。
- `ActionMenu` の `compact` は、コードを動かす画面のファイルの木が使う。
  メニューの面はペインの上に重なる `surface-raised` で、ADR-0073 が `surface-pane-subtle` を足した `surface-pane` の面ではない。
- 面と hover の面のコントラストの比を、プリミティブトークンの値から計算した値は、次のとおり。

| 組                                                           | ライト                        | ダーク                           |
| ------------------------------------------------------------ | ----------------------------- | -------------------------------- |
| `surface-raised` と替える前の hover の面（`surface-subtle`） | 1.08:1（`sumi-0`、`sumi-50`） | 1.00:1（どちらも `sumi-800`）    |
| `surface-raised` と `surface-pane-subtle` の値               | 1.08:1（`sumi-0`、`sumi-50`） | 1.16:1（`sumi-800`、`sumi-750`） |
| `surface` と `surface-subtle`                                | 1.08:1（`sumi-0`、`sumi-50`） | 1.10:1（`sumi-950`、`sumi-800`） |

## Decision

重なる面の上の hover の面として、セマンティックトークン `surface-raised-subtle` を足す。

- 値は、ライトを `sumi-50`、ダークを `sumi-750` にする。
  - `surface-pane-subtle` と同じ値である。
    ダークの重なる面は、ペインの紙の面と同じ `sumi-800` なので、その上の hover の面も `surface-pane-subtle` と同じ `sumi-750` にする。
  - ライトの値は、`surface-subtle` と同じなので、ライトの見た目は変わらない。
- `surface-subtle` の値は変えない。
  ページの面（`surface`）の上の hover に使っていて、ダークでも 1.10:1 の差で見分けられるためである。
- `surface-raised` の値は変えない。
  重なる面と、ページの面とペインの紙の面の見分けに影響するためである。
- `surface-raised-subtle` は、サイトの全体で使える。
  `PLAYGROUND-ONLY`（`check:utilities` が確認する）の対象には入れない。
- 次の 3 つの要素の hover の面を、`surface-subtle` から `surface-raised-subtle` に替える。
  - `ActionMenu` のメニューの項目。`density` によらず替える。
    開くボタンは重なる面の上に無いので替えない。
  - `SearchBox` の候補
  - `Dialog` の閉じるボタン
- コントラストのチェックの面の一覧に `surface-raised-subtle` を足し、ほかの面と同じ組で確認する。
  文字は 4.5:1 以上、枠と輪は 3:1 以上にする。
- ダークの `sumi-750` は、`surface-disabled` と同じ値である。
  メニューの項目、候補、閉じるボタンには無効の状態が無いので、hover の面と無効の面は並ばない。

## Considered Options

| 選択肢                                                                   | 強み                                                                                                                                     | 弱み                                                                                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **採用:** 重なる面の上の hover のトークン `surface-raised-subtle` を足す | `surface-subtle` と `surface-raised` の値を変えずに済む。ADR-0073 の `surface-pane-subtle` と同じく、面ごとに hover の面のトークンを持つ | 面のセマンティックトークンが 1 つ増える                                                                    |
| ダークの `surface-raised` の値を変える                                   | トークンが増えない                                                                                                                       | 重なる面と、ページの面とペインの紙の面の見分けが変わる。ダークの重なる面を全て撮り直して確認する必要がある |
| `ActionMenu` の `compact` だけ `surface-pane-subtle` にする              | トークンが増えない                                                                                                                       | ADR-0073 は `surface-pane` の上の面と決めているので、読み替えが要る。`SearchBox` と `Dialog` が直らない    |

## Consequences

### Positive

- ダークでも、メニューの項目、検索の候補、ダイアログの閉じるボタンに hover すると、背景が重なる面と見分けられる色に変わる。

### Negative

- 面のセマンティックトークンが 1 つ増え、重なる面の上と、ページの面の上で、hover の面の名前を使い分ける必要がある。
- 重なる面の中に置く、ほかのコンポーネントの hover の面は、この ADR では替えない。
  オフの `Switch` は、hover で面を `surface` から `surface-subtle` に替える。
  ダークの重なる面の上では、hover の面が周りの重なる面と同じ `sumi-800` になり、見分けられるのは枠の色の変化だけになる。
- ハイコントラストのとき（`forced-colors: active`）は、背景の色が消えるので、3 つの要素の hover の面は見えない。
  この ADR の前と同じで、扱いを変えない。

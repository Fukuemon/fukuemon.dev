# fukuemon.dev のデザインシステムのトークン

この文書は、[デザインシステムの文書](../DESIGN.md)の一部で、セマンティックトークン、テーマ、文字、レイアウトの使い方の規則を持つ。  
値は書かない。  
値は、DESIGN.md の「知りたいことごとの参照先」の表が指すコードから読む。  
DADS の指針から外れる規則は、その規則の隣に、DADS が求めることと外れる理由を書く。

## 色

画面のコードは、テーマ変数のユーティリティ（`bg-surface`、`text-primary`、`border-border-field` など）で色を書く。  
名前は、下の表の名前に、Tailwind の接頭辞（`bg-`、`text-`、`border-`）を付けたものになる。

| 種類       | 名前                 | 使う場面                                                                                                                                                                |
| ---------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 面         | `surface`            | ページの背景                                                                                                                                                            |
| 面         | `surface-subtle`     | 押せる行とボタンの hover の面、`Switch` と `Checkbox` の hover の面、`TextField` の `boxed` の入力欄の面、`neutral` の状態のラベルの面、HTTP の流れの一覧の選んだ行の面 |
| 面         | `surface-disabled`   | 無効の入力欄とボタン、`Switch`、`Checkbox` の面                                                                                                                         |
| 面         | `surface-raised`     | 面の上に重なる面（ダイアログ、メニュー、候補の一覧）。`border-field` の 1px の枠と組にする                                                                              |
| 面         | `overlay`            | ダイアログの後ろの幕                                                                                                                                                    |
| 文字       | `text`               | 本文、見出し、操作のラベル、オフの `Switch` の hover の枠                                                                                                               |
| 文字       | `text-secondary`     | 補足、日付、図の説明                                                                                                                                                    |
| 文字       | `text-disabled`      | 無効の操作のラベル。WCAG 1.4.3 の対象外なので、読ませたい文に使わない                                                                                                   |
| 文字       | `text-inverse`       | `primary` と `danger` の面の上の文字                                                                                                                                    |
| 枠         | `border`             | 飾りの区切りの罫と、無効の `boxed` の入力欄の下罫。押せるものと、有効の入力欄の境界には使わない                                                                         |
| 枠         | `border-field`       | 入力欄と押せるものの境界（`boxed` の入力欄では下罫）、重なる面の枠。面に対して 3:1 以上                                                                                 |
| 操作       | `primary`            | 主のボタンの面、選んだタブと選んだ行の罫、検索の欄のフォーカスの罫、読み込み中の印の罫                                                                                  |
| 操作       | `primary-hover`      | 主のボタンの hover の面                                                                                                                                                 |
| 操作       | `primary-surface`    | 木の選んだ項目と、検索の候補の選んだ項目の面                                                                                                                            |
| 操作       | `link`               | 内部のリンク                                                                                                                                                            |
| 操作       | `link-visited`       | 訪問済みのリンク。`link` と同じ色を指す                                                                                                                                 |
| 操作       | `link-external`      | 外部のリンク                                                                                                                                                            |
| 操作       | `current-page`       | 目次の現在地、サイトのヘッダーのナビの今いるページの筆の線                                                                                                              |
| フォーカス | `focus`              | フォーカスの表示の墨の輪。画面のコードは `focus-ring` か `focus-ring-inset` のユーティリティで書き、この名前を直に使わない                                              |
| 状態       | `danger`             | エラーの文と印、データを失う操作のボタンの面、コンソールの error の行の印と罫                                                                                           |
| 状態       | `danger-hover`       | `danger` のボタンの hover の面                                                                                                                                          |
| 状態       | `warning`            | 注意の文と印、コンソールの warn の行の印と罫                                                                                                                            |
| 状態       | `success`            | 成功の文と印                                                                                                                                                            |
| 状態       | `info`               | 情報の文と印、コードの系統のファイルの印、コンソールの info の行の印                                                                                                    |
| 状態       | `<状態>-surface`     | `danger`、`warning`、`success`、`info` の薄い面。注意書きと状態のラベルの地、コンソールの warn と error の行の面                                                        |
| 区別       | `categorical-1`〜`6` | 意味を持たない並びの色分け。HTTP の流れの通信する者に、流れの中で 1 色ずつ固定して当てる                                                                                |
| 庭         | `garden-mist-day`    | トップの立体の庭の、朝、昼、夕の場面の上端と下端に敷く霞と、庭の中のボタンの面                                                                                          |
| 庭         | `garden-ink-day`     | `garden-mist-day` の上の字とフォーカスの輪（ヘッダーのロゴとリンク、庭の中のボタン）                                                                                    |
| 庭         | `garden-edge-day`    | `garden-mist-day` の上の、庭の中のボタンの枠                                                                                                                            |
| 庭         | `garden-mist-night`  | 夜の場面の霞と、庭の中のボタンの面                                                                                                                                      |
| 庭         | `garden-ink-night`   | `garden-mist-night` の上の字とフォーカスの輪                                                                                                                            |
| 庭         | `garden-edge-night`  | `garden-mist-night` の上の、庭の中のボタンの枠                                                                                                                          |
| コード     | `code-surface` など  | 記事のコードブロック、エディタ、端末の字句。当てる字句の表は [Design Doc の「コードの色」](../DesignDoc.md#コードの色) にある                                           |

- `<状態>-surface` の上の文字は、同じ状態の色か `text` にする。どちらの組も、コントラストのチェックが確認する。
- 状態の色相は DADS のとおり、エラーは赤、成功は緑にする。
  - 注意は、DADS の黄か橙ではなく錆にする。錆は橙に近い色相で、旧サイトの差し色である（ADR-0024）。
  - 主の色の緑と成功の緑が並ぶ画面では、成功を文と印でも伝える（`STATE-NOT-COLOR-ONLY`）。
- 訪問済みのリンクは、色で分けない。DADS は訪問済みのリンクの色を分けるが、旧サイトと同じく内部のリンクの色を 1 つに保つ（ADR-0024）。
- `garden-` で始まる 6 つのトークンは、テーマに依らず同じ値を指す。場面の色は時間帯で決まり、テーマに依らないためである。
  霞の置き方と、テーマの色の名前への差し替えは [トップの水墨の門と立体の庭の Design Doc の「ヘッダーと霞」](../../../docs/design/features/top-garden/DesignDoc.md#ヘッダーと霞) にある。
- HTTP の状態コードに当てる状態の色は、[Design Doc の「HTTP の流れの色」](../DesignDoc.md#http-の流れの色)の表にある。新しい色のトークンを作らない。
- コンソールのログレベルに当てる状態の色は、[Design Doc の「コンソールのログレベルの色」](../DesignDoc.md#コンソールのログレベルの色)の表にある。新しい色のトークンを作らない。

セマンティックトークンがプリミティブトークンを参照しない例外は、次の 2 つ。

- 挿絵の層の濃さ（`--fd-art-*`）は、色ではなく不透明度の値を直に持つ。挿絵は `text` と `surface` の色だけで塗り、濃さをこの値で決めるためである。コントラストのチェックは読まない。
- 見出しの明朝のウェイト（テーマ変数の `--font-weight-semibold`）は、600 を直に持つ。明朝は 600 の 1 つだけを読み込むためである（ADR-0023）。

ADR-0024: [トークンを、fukuemon.dev の値のプリミティブトークン、セマンティックトークン、テーマ変数の 3 つの層にし、生成りの地と旧サイトの差し色で、角丸と影を使わない版面にする](../../../docs/adr/0024-tokens-of-fukuemon-dev.md)

## テーマ

DADS はダークのテーマを持たない。  
fukuemon.dev はダークを持つ。  
訪問者が、本文とコードを長く読み、暗い部屋で読むこともあるためである。  
ダークの値も fukuemon.dev が選ぶ。

| テーマ                     | 切り替える条件                                                         | コントラストのチェック                    |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- |
| ライト                     | OS の設定がライトのとき。Storybook では `[data-theme="light"]` のとき  | `pnpm run check:contrast` の 1 つ目の条件 |
| ダーク（OS の設定）        | `prefers-color-scheme: dark` で、`[data-theme="light"]` が無いとき     | `pnpm run check:contrast` の 2 つ目の条件 |
| ダーク（Storybook の指定） | Storybook のツールバーで「ダーク」を選び、`[data-theme="dark"]` のとき | `pnpm run check:contrast` の 3 つ目の条件 |

- 画面とコンポーネントのコードに、テーマの条件（`dark:` の変種、`prefers-color-scheme`）を書かない。テーマはセマンティックトークンの参照先だけで替える。
- サイトにテーマの切り替えを置かない。`data-theme` の属性は Storybook だけが使う。

## 文字

| ユーティリティ       | DADS のスタイル        | 使う場面                                                                                                                             |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `text-caption`       | Dns-14N-130            | 補足、図の説明、時刻                                                                                                                 |
| `text-body-dense`    | Dns-16N-130            | 表のセル、入力欄の値、木の行                                                                                                         |
| `text-body`          | Std-16N-170            | 記事の本文、トップのプロフィールの本文、サイトのヘッダーのナビ                                                                       |
| `text-label`         | Oln-16B-100            | ボタン、タブ                                                                                                                         |
| `text-heading-sm`    | Std-18B-160            | 記事の小見出し、ダイアログの題                                                                                                       |
| `text-heading-md`    | Std-20B-150            | 記事の見出し、トップのプロフィールのセクションの見出し                                                                               |
| `text-heading-lg`    | Std-28B-150            | 記事の題、トップのプロフィールの h1                                                                                                  |
| `text-code`          | 等幅の 16px のスタイル | コードブロック                                                                                                                       |
| `text-code-dense`    | 等幅の 14px のスタイル | プレイグラウンドの SQL の実行計画の文字                                                                                              |
| `text-compact`       | 12px のスタイル        | コードを動かす画面のコンソールの値、時刻、出力元、行の数、下の状態の帯、HTTP の流れの通信する者と状態コード、入力欄の補足と誤りの文  |
| `text-label-compact` | 太字の 13px のスタイル | コードを動かす画面の領域の題、タブ、ボタン、開閉の要約、入力欄の見出し、HTTP の本文の見出し                                          |
| `text-body-compact`  | 13px のスタイル        | コードを動かす画面のファイルの木の行、入力欄の値、表のセル、メニューの項目、開閉の中身、空の状態の文、注意の枠の本文、読み込み中の文 |
| `text-code-compact`  | 等幅の 13px のスタイル | コードを動かす画面のエディタ、端末、HTTP のメソッドと URL とヘッダと本文                                                             |

- 記事の題と見出しは、`font-heading` と `font-semibold` を `text-heading-*` に重ね、Zen Old Mincho の 600 で描く。DADS の見出しはゴシックの 700 だが、運営者が今のサイトの和の感じを残すと決めたためである。大きさと行高は DADS のスタイルのまま使う（ADR-0023）。
- 本文は Noto Sans JP、等幅は Noto Sans Mono で描き、等幅の和文は BIZ UDGothic で受ける。
- 14px の文字は、`text-caption` と `text-code-dense` だけにする。`text-code-dense` は本文でない 14px の文字である（`TEXT-MIN-SIZE`）。
- 名前に `dense` が付くスタイルは 14px 以上で行高を詰め、`compact` が付くスタイルは 14px より小さい例外にする。
- 12px と 13px の文字は、コードを動かす画面のコンポーネントだけに使う（`text-compact`、`text-label-compact`、`text-body-compact`、`text-code-compact`）。14px より小さい文字を使わない原則（`TEXT-MIN-SIZE`）の例外で、DevTools のコンソールに近い密度で行を並べ、隣の 13px の題とタブに文字の大きさをそろえるためである（ADR-0062、ADR-0067）。
  - ADR-0062: [コードを動かす画面だけ、文字を 12px と 13px まで、押せる領域を 24×24 CSS px まで小さくする](../../../docs/adr/0062-dense-text-and-targets-in-playground.md)
  - ADR-0067: [コードを動かす画面の詰めたペインの文字のトークンを 4 つにし、13px の等幅の行高に DADS に無い値を使う](../../../docs/adr/0067-compact-text-tokens-in-dense-panes.md)

ADR-0023: [個性として和の感じを残し、見出しを明朝にし、主の色を緑にする](../../../docs/adr/0023-keep-art-and-key-color.md)

## レイアウト、区切り、重なり、動き

| 種類             | ユーティリティ                                               | 使う場面                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 余白             | Tailwind のデフォルトの段（`p-2`、`gap-4` など。1 段 4px）   | 全ての余白。ブロックの間は 8px の倍数（偶数の段）にする                                                                                                                                                                                                                                                                                                                                                                                       |
| 本文の幅         | `max-w-prose`                                                | 記事の本文の列。1 行を全角 40 字前後に抑える                                                                                                                                                                                                                                                                                                                                                                                                  |
| 外枠の幅         | `max-w-page`                                                 | ヘッダーと本文の外枠、記事の一覧の列                                                                                                                                                                                                                                                                                                                                                                                                          |
| ブレークポイント | `md:`                                                        | 狭い画面と広い画面の切り替え。ブレークポイントはこの 1 つだけにする                                                                                                                                                                                                                                                                                                                                                                           |
| 区切り           | `border-b-2 border-text`、`border-t-2 border-text`           | ヘッダーの下と表の頭の上の墨の罫                                                                                                                                                                                                                                                                                                                                                                                                              |
| 区切り           | `border-b border-border`（向きは場所に合わせる）             | ほかの区切りの罫                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 角               | `rounded-control`                                            | 操作できる要素（`Button`、`IconButton`、`boxed` の入力欄、木の行、開閉の要約、`Switch`、`Checkbox`、タブの閉じるボタン）と、重なる面の角                                                                                                                                                                                                                                                                                                      |
| 重なり           | `bg-surface-raised border border-border-field shadow-raised` | ダイアログ、メニュー、候補の一覧                                                                                                                                                                                                                                                                                                                                                                                                              |
| フォーカス       | `focus-visible:focus-ring`                                   | 操作できる要素のフォーカスの表示。要素から 2px 離した墨の 2px の輪（`FOCUS-ONE`）。詰めたペインの行は次の行の `focus-ring-inset`、スクロールする領域は `focus-ring-frame` を使う                                                                                                                                                                                                                                                              |
| フォーカス       | `focus-visible:focus-ring-inset`                             | コードを動かす画面の詰めたペインの中の行。墨の 2px の輪を要素の内側に引く（`FOCUS-ONE` の例外、ADR-0066）                                                                                                                                                                                                                                                                                                                                     |
| フォーカス       | `focus-ring-frame`（外側の要素）                             | ペインの全体を占める、フォーカスできるスクロールする領域を 1 つ直下に置く外側の要素。領域自身の輪は中の背景に隠れて欠けるので、外側の `::after` に内側の輪を重ねて引く（`FOCUS-ONE` の例外、ADR-0066）                                                                                                                                                                                                                                        |
| 動き             | `transition-colors`                                          | 木の行、タブ、タブの閉じるボタンの色の切り替え（デフォルトの 150ms）                                                                                                                                                                                                                                                                                                                                                                          |
| 動き             | `transition-transform` と `rotate-90`                        | ファイルの木と `Disclosure` の山形の開閉、`Switch` のつまみの移動（デフォルトの 150ms）                                                                                                                                                                                                                                                                                                                                                       |
| 動き             | `animate-stroke`                                             | 選んだタブの下、検索の欄のフォーカス、ダイアログの上端の罫と、サイトのヘッダーのナビの今いるページの筆の線を、左から 1 回引く                                                                                                                                                                                                                                                                                                                 |
| 動き             | `stroke-brush`                                               | `animate-stroke` で引く罫を、筆の線の形にする                                                                                                                                                                                                                                                                                                                                                                                                 |
| 動き             | `link-rule`                                                  | `Link`、目次の見出し、前後の記事の題の hover で、2px の罫を左から 1 回引く。罫は文字のすぐ下に出る。インラインの要素に付けたときは折り返した全ての行に引き、ブロックの箱になった要素では最後の行の下にだけ引く。下線のある文字に `link-rule-below-underline` を付けずに使うと、罫は下線に重なる                                                                                                                                               |
| 動き             | `link-rule-below-underline`                                  | `Link` で、`link-rule` の罫を 4px 下げ、下線の下に置く                                                                                                                                                                                                                                                                                                                                                                                        |
| 動き             | `brush-hover`                                                | パンくずリストのリンクとサイトのヘッダーのナビの hover で、リンクの箱の下に筆の線を左から 1 回引く                                                                                                                                                                                                                                                                                                                                            |
| 動き             | `brush-current`                                              | サイトのヘッダーのナビで、今いるページとその下のページ（`aria-current` が `page` か `true`）のリンクの箱の下に錆の筆の線を出し、ページを開いたときに左から 1 回引く。`brush-hover` と重ねて使う                                                                                                                                                                                                                                               |
| 動き             | `ink-press`                                                  | `Button` を押して離すと、文字の色の墨がにじんで消える                                                                                                                                                                                                                                                                                                                                                                                         |
| 動き             | `animate-fade-in`                                            | ダイアログ、メニュー、候補の一覧が、濃度を上げて出る                                                                                                                                                                                                                                                                                                                                                                                          |
| 動き             | `loading-dots`                                               | `Button` の読み込み中の、3 つの点の印                                                                                                                                                                                                                                                                                                                                                                                                         |
| 動き             | `animate-loading`                                            | `Loading` の読み込み中の印の罫                                                                                                                                                                                                                                                                                                                                                                                                                |
| 動き             | `scroll-fade-end`                                            | `Table`、記事の本文の表と図とコードブロック、`HttpExchangeDetail` の本文、プレイグラウンドの SQL の実行計画を横に送る枠で、右に続きがある間だけ、右端を背景の色で薄くする。薄い色は、右端まで送る手前から消え始める。枠を grid にし、薄い色（`::after`）を中身と同じセルに重ねる。そのため、要素の子を 1 つだけ持つ枠に付け、余白は枠ではなく子に持たせる。薄い色は `surface` の色で、別の面の上では `--fd-scroll-fade-bg` にその面の色を渡す |
| 動き             | `scroll-fade-code`                                           | `scroll-fade-end` と並べて付け、薄い色を `code-surface` の色にする。`code-surface` の面の上にある枠で使う                                                                                                                                                                                                                                                                                                                                     |

- 余白の段は、DADS が値を決めず使う側に任せているので、Tailwind のデフォルトの段を使う。
  - 出典: [DADS の余白](https://design.digital.go.jp/dads/foundations/spacing/)
- ブレークポイントは、DADS の設定の例の 1 つ（48rem）だけを置く。
- 角丸と影のユーティリティは、`rounded-control` と `shadow-raised` の 1 つずつだけを書ける。DADS のコンポーネントは、コンポーネントごとに角丸と影の値を持つが、罫線で区切る版面と合わないためである（ADR-0028）。
  - `rounded-control` は、操作できる要素と重なる面だけに付ける。`Tabs` のタブ、下罫だけの検索の欄、メニューの項目、`Notice`、`StatusBadge`、`Table`、コードブロック、[トップの庭の中の文へ移るボタン](../../../docs/design/features/top-garden/DesignDoc.md#庭の中のボタンの並び)には付けない。
  - `shadow-raised` は、重なる面だけに付ける。ボタンと入力欄には付けない。
- 動きの時間と緩急は、表のユーティリティだけで書く。テーマ変数で止められない時間の値（`duration-[…]` の任意値）を書かない（`MOTION-TOKEN`）。
- 動きを付ける操作、長さ、付けない所は、[Design Doc の「動き」](../DesignDoc.md#動き) にある。フォーカスの表示、入力した文字、誤りの文には、動きを付けない。
- 筆の線の形は、テーマ変数のファイルの `--fd-mask-brush`（`:root` に置く SVG）にあり、`stroke-brush` と `brush-hover` だけが読む。
- 動きを減らす設定での止め方は、テーマ変数のファイル（`src/tokens/theme.css`）の末尾の 1 か所にある（`MOTION-REDUCE`）。罫と筆の線を引く動きは、止めると全長の線が最初から出る。`Button` の読み込み中の印は、濃い 3 つの点で止まる。`scroll-fade-end` の右端の薄い色は、途中の濃さを出さず、右端まで送ったときに一度に消える。

ADR-0028: [操作できる要素と重なる面の角を 2px で丸め、重なる面にずらした影を付け、罫を引く動きを筆の線にする](../../../docs/adr/0028-radius-shadow-and-brush-motion.md)

## ハイコントラスト

`forced-colors: active` で消える枠と塗りを、システムの色で引くユーティリティである。通常の表示には何も変わらない。
足す規則は DESIGN.md の「ハイコントラスト」にある。

| ユーティリティ                                                                                 | 描くもの                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `forced-frame`                                                                                 | `CanvasText` の 1px の枠。背景の色か `ring` で境界を表す要素（`Button`、`Switch`、`Checkbox`）に付ける                              |
| `forced-on`                                                                                    | 選択とオンの塗りと、その上の文字と印                                                                                                |
| `forced-on-row`                                                                                | 文字を持つ行（`TreeView`）の選択。文字は `CanvasText` のまま、塗りと枠を選択の色にする。Chromium が文字の下に Canvas の板を敷くため |
| `forced-off-disabled`、`forced-on-disabled`                                                    | 無効の要素の枠、文字、塗り（`GrayText`）                                                                                            |
| `forced-fill`（`CanvasText`）、`forced-fill-on`（選択の色。動く線に使う）                      | 背景の色だけで描いた線と帯（`SplitPane` の区切り、`Tabs` の選んだタブの下の帯、`TextField` の下罫、`Loading` の罫）の塗り           |
| `forced-solid`                                                                                 | 筆の形（`stroke-brush`）の罫を、全幅の帯にする。`Tabs` の選んだタブの下の帯に付ける（ADR-0068）                                     |
| `forced-mark`、`forced-mark-disabled`                                                          | `Checkbox` のチェックの印の色                                                                                                       |
| `forced-edge-hidden`                                                                           | 透明の枠（選んでいない項目の左の枠）を、背景の色にして隠す。ハイコントラストでは、透明の枠が見える色になる                          |
| `forced-thumb-off`、`forced-thumb-on`、`forced-thumb-off-disabled`、`forced-thumb-on-disabled` | `Switch` のつまみの塗りと、つまみの中の印                                                                                           |

- 選択とオンの色は、変数 `--fd-forced-on` と `--fd-forced-on-text` が持つ。この 2 つはセマンティックトークンではなく、`:root` に置く `forced-colors: active` 専用の変数である。値は `SelectedItem` と `SelectedItemText` で、使えないブラウザでは `Highlight` と `HighlightText` になる。
- ブラウザは、システムの色以外の値を置き換える。通常の色の指定（`bg-primary` など）に勝つよう、`forced-*` の宣言は `!important` にしている。
- `loading-dots` は、ユーティリティの中で点を `CanvasText` で塗る。`forced-*` を足す必要はない。
- `forced-frame` は 1px の枠を足す。`absolute` の子を持つ要素では、子の位置を 1px 戻す。`Switch` のつまみは `forced-colors:left-px` で戻している。

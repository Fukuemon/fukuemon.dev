# 署名

このディレクトリは、「Fukuemon」の署名の SVG と、それを HTML に置く `<svg>` にするコードを持つ。
トップの最初の訪問のイントロ（`features/top-garden/InkGate.astro`）と、全てのページのヘッダーのロゴ（`components/SiteHeader.astro`）の両方が、同じ `sign.svg` を読む。

## Structure

| ファイル   | 持つもの                                                  |
| ---------- | --------------------------------------------------------- |
| `sign.svg` | 署名の輪郭                                                |
| `sign.ts`  | 署名の SVG のファイルから、HTML に置く署名の `svg` を作る |
| `OFL.txt`  | 書体 Great Vibes のライセンスの全文                       |

## 署名を差し替える

署名の輪郭は `sign.svg` に置く。
`signSvg` は、ファイルの中身を変えずに通し、最初の `<svg>` に `class`、`aria-hidden`、`focusable` だけを足す。
`sign.svg` は、`viewBox` と、輪郭を塗った `path` を 1 本だけ持つ形にする。
運営者の自筆の署名に替えるときは、同じ形の SVG でこのファイルを置き換える。
イントロの署名とヘッダーのロゴは、両方とも替わる。
描画ツールで書き出した SVG は、作者名や書き出し先のパスのようなメタデータを落としてから置く。

イントロとヘッダーの CSS は、署名に塗りの色（`fill`）だけを付ける。
線（`stroke`）で描いた SVG は、線に色が付かないので、字の形に表示されない。

署名は読み上げから隠す。
読み上げの名前は、署名を置く側が持つ。
ヘッダーのロゴのリンクは、`aria-label` に「Fukuemon」を持つ。

`sign.svg` は、書体 Great Vibes の輪郭を、試作の `docs/design/prototypes/top/src/sign-path.py` で取り出したものである。
書体のファイルは、リポジトリにもサイトにも置かない。

## License

署名の輪郭は、書体 Great Vibes から取り出した。
Great Vibes のライセンスは SIL Open Font License 1.1 で、著作権の表示は「Copyright 2015 The Great Vibes Pro Project Authors」である。

- 出典: [Great Vibes の OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/OFL.txt)

ライセンスの全文は、同じディレクトリの `OFL.txt` にある。
自筆の署名に替えたら、この License のセクションと `OFL.txt` を消す。

## Testing

テストは、リポジトリの直下で次を実行する。

```sh
pnpm --filter @fukuemon/web exec vitest run src/components
```

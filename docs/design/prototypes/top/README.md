# トップの水墨の門と立体の庭の試作

トップの最初の訪問の水墨の門のイントロと、立体の庭のプロフィールを、1 枚の HTML で動かす試作。  
実装は、絵の配置と色をこの試作と見比べて合わせる。  
見た目の数値は [トップの水墨の門と立体の庭の Design Doc](../../features/top-garden/DesignDoc.md) にある。

- ADR-0026: [トップの最初の訪問で水墨の門を描き、門をくぐった立体の庭にプロフィールを置く](../../../adr/0026-sumi-gate-and-garden-on-top.md)
- ADR-0027: [トップの庭の絵を、訪問者の端末の日付と時刻で、季節と時間帯ごとに変える](../../../adr/0027-garden-by-season-and-time.md)

## Running

場面のバンドルは three を含み、Git で追跡しない。  
three は、バージョン 0.187.0 を使う。  
コマンドは、リポジトリの直下で流す。

1. 依存を入れる。ビルドは、リポジトリの依存の esbuild 0.28.2 を使う。

   ```sh
   pnpm install
   ```

2. three 0.187.0 を `vendor/three/` に展開する。

   ```sh
   mkdir -p docs/design/prototypes/top/vendor/three
   npm pack three@0.187.0 --pack-destination docs/design/prototypes/top/vendor
   tar -xzf docs/design/prototypes/top/vendor/three-0.187.0.tgz -C docs/design/prototypes/top/vendor/three --strip-components=1
   rm docs/design/prototypes/top/vendor/three-0.187.0.tgz
   ```

3. `i-mon.html` と、場面のバンドル `vendor/i-scene.bundle.js` を書く。

   ```sh
   node docs/design/prototypes/top/build-i.mjs
   ```

4. `docs/design/prototypes/top/i-mon.html` をブラウザで開く。`file://` のまま動く。

`build-i.mjs` は、墨の絵の SVG、CSS、`head` のスクリプトを `i-mon.html` に書き直す。  
ソースを変えずに流したときは、`i-mon.html` は変わらない。

## URL の引数

| 引数 | 値 | 意味 |
| --- | --- | --- |
| `visit` | `first` | 最初の訪問のイントロを出す |
| `visit` | `garden` | 2 回目以降の訪問として、門の内側の庭をイントロなしで出す |
| `visit` | `html` | 庭を出さず、ふつうのページを出す |
| `season` | `spring`、`summer`、`autumn`、`winter` | 季節を選ぶ |
| `time` | `morning`、`day`、`evening`、`night` | 時間帯を選ぶ |
| `sign` | `0` | 署名を出さない |

- `visit` を付けないときは、`localStorage` の `fd-top-seen` で、最初の訪問かを決める。
- `season` と `time` を付けないときは、端末の日付と時刻で決める。

## 録画と測定を作り直す

`record-i.mjs` は、Playwright の chromium で録画し、静止画の一覧を作り、LCP とコマの数を測る。  
ffmpeg と、Playwright の chromium が要る。  
GPU は ANGLE の Metal のレンダラーを使うので、macOS で流す。

```sh
pnpm --filter @fukuemon/ui exec playwright install chromium
mkdir -p docs/design/prototypes/top/checks docs/design/prototypes/top/frames
node docs/design/prototypes/top/record-i.mjs
```

- 引数に `video`、`still`、`measure` を付けると、その部分だけを流す。
- 録画の mp4 は `docs/design/prototypes/top/` に、静止画の一覧は `checks/` に、コマの一覧は `frames/` に置く。
- 測定の値は `checks/2026-11-12-i-mon-measure.json` に書く。どれも Git で追跡しない。

## 署名を差し替える

署名は `src/sign.svg` である。  
`build-i.mjs` は、このファイルを読んで `i-mon.html` に置く。

- 自筆の署名に替えるときは、`src/sign.svg` を、同じ形の SVG に差し替えて、バンドルを作り直す。
  - 同じ形は、`viewBox` と、輪郭を塗った `path` を 1 本持つ SVG である。
  - 線（`stroke`）で描いた SVG は、今の作りでは出ない。
- 書体から作り直すときは、書体のファイルを取得して、`src/sign-path.py` で輪郭を取り出す。

  ```sh
  mkdir -p docs/design/prototypes/top/vendor/fonts
  curl -fsSL -o docs/design/prototypes/top/vendor/fonts/GreatVibes-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf
  uv run --with fonttools python -I docs/design/prototypes/top/src/sign-path.py docs/design/prototypes/top/vendor/fonts/GreatVibes-Regular.ttf Fukuemon docs/design/prototypes/top/src/sign.svg
  ```

  - 字の送りは、書体の送り幅だけを使う。カーニングと合字は当てない。
  - 書体のファイルは、Git で追跡しない。

## 書体のライセンス

`src/sign.svg` は、書体 Great Vibes の字の輪郭を取り出したものである。  
Great Vibes は SIL Open Font License 1.1 で配られている。  
著作権の表示は「Copyright 2015 The Great Vibes Pro Project Authors」である。  
ライセンスの本文は [src/OFL.txt](src/OFL.txt) にある。

- 出典: [Great Vibes の OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/OFL.txt)

## 入れないもの

次のものは、この試作のディレクトリに置かない。

- three を含むバンドル（`vendor/`）。上の手順で作り直す。
- 試作を作るときに参考にした素材の画像と、ほかのサイトの画面。公開できないためである。

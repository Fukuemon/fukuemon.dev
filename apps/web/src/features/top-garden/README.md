# トップの水墨の門と立体の庭

このディレクトリは、トップの最初の訪問に出す墨の絵と署名の SVG を作るコードを持つ。
墨の絵と立体の庭の場面の両方が読む、庭の配置も持つ。
コードは React にも DOM にも依らない TypeScript で、ビルドのときに Node で動く。

見た目の数値は、[トップの水墨の門と立体の庭の Design Doc](../../../../../design/features/top-garden/DesignDoc.md) にある。
値の元は、[試作](../../../../../design/prototypes/top/README.md) である。

## Structure

| ファイル     | 持つもの                                                  |
| ------------ | --------------------------------------------------------- |
| `layout.ts`  | 門、塀、飛び石、山並みの配置と、最初のカメラの投影        |
| `brush.ts`   | 種から決まった順の値を返す乱数と、筆の線を溜める筆        |
| `ink-art.ts` | 墨の絵の線を、山並み、塀、門、飛び石、石、松の順に作る    |
| `ink-svg.ts` | 線を、線ごとの `path` を持つ 1 枚の SVG の文字列にする    |
| `sign.ts`    | 署名の SVG のファイルから、HTML に置く署名の `svg` を作る |
| `sign.svg`   | 署名の輪郭                                                |
| `OFL.txt`    | 書体 Great Vibes のライセンスの全文                       |

## 同じ種から同じ絵ができる

同じ種からは、同じ線のデータと、同じ SVG の文字列ができる。
乱数を使う順は、試作の `design/prototypes/top/src/h-strokes.mjs` と同じにしてある。
線を足すか、消すか、並べ替えると、それより後の線がすべて変わる。

今の出力は、線が 281 本、`path` が 415 本で、試作の `i-mon.html` の墨の絵と同じ文字列である。
SVG の大きさの上限は gzip で 40 KB で、ユニットテストが確認する。

## 署名を差し替える

署名の輪郭は `sign.svg` に置き、`signSvg` がファイルの中身から HTML に置く `svg` を作る。
`sign.svg` は、`viewBox` と、輪郭を塗った `path` を 1 本だけ持つ形にする。
運営者の自筆の署名に替えるときは、同じ形の SVG でこのファイルを置き換える。

線（`stroke`）で描いた SVG と、`path` が 2 本以上ある SVG を渡すと、`signSvg` は例外を投げる。
線で描いた形は、塗っても字にならないためである。

今の `sign.svg` は、書体 Great Vibes の輪郭を、試作の `design/prototypes/top/src/sign-path.py` で取り出したものである。
書体のファイルは、リポジトリにもサイトにも置かない。

## License

署名の輪郭は、書体 Great Vibes から取り出した。
Great Vibes のライセンスは SIL Open Font License 1.1 で、著作権の表示は「Copyright 2015 The Great Vibes Pro Project Authors」である。
ライセンスの全文は、同じディレクトリの `OFL.txt` にある。
自筆の署名に替えたら、この節と `OFL.txt` を消す。

- 出典: [Great Vibes の OFL.txt](https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/OFL.txt)

## Testing

リポジトリの直下で流す。

```sh
pnpm --filter @fukuemon/web exec vitest run src/features/top-garden
```

# ADR-0004: 和文に静的 2 ウェイトの Zen Old Mincho を採り、可変フォントを使わず self-host する

## 状態

承認

## 決定日

2026-08-26

## 背景

- Design System の方向は「日本庭園の設計思想を意匠ではなく構造規則へ翻訳する」であり、桜・鳥居・筆文字・竹・和柄・庭園写真といった直接的な和風意匠を使わない。**和のテイストは書体で担う。**
- 参考サイト (torus-engineering) の `styles.css` を 2026-08-25 に実測した。
  本文・見出し・UI がすべて Serif で Sans は 0 件、`border-radius` 0 件、`box-shadow` 0 件、色 6 値、h2 = 1.25rem / h3 = 1.05rem で本文 1.05rem とほぼ同寸だった。**階層はサイズ差ではなく small-caps + letter-spacing + 罫線で作られている。**
- この型スケールを採ると、**使うウェイトは 400 と 600 の 2 段だけになる。**
- Google Fonts は CJK を約 122 スライスに分割配信する。
  2026-08-25 に CSS API を実測した。

  | フォント                       | スライス数 | 1 スライス平均 | ファミリ総量 (推定) |
  | ------------------------------ | ---------- | -------------- | ------------------- |
  | Noto Serif JP (可変 400–700)   | 124        | 56 KB          | 約 7.0 MB           |
  | Zen Old Mincho (静的 400+700)  | 244        | 20 KB          | 約 4.9 MB           |
  | Shippori Mincho (静的 400+700) | 244        | 30 KB          | 約 7.3 MB           |
  | Hina Mincho (400 のみ)         | 123        | 19 KB          | 約 2.4 MB           |

- 本文には `PostgreSQL` `RDBMS` `Rolldown` のような Latin の技術用語が高頻度で混在する。
- 将来 `/playground/*` に `COEP: require-corp` を掛ける (ADR-0006)。
  COEP 下では CORP を返さないクロスオリジンのリソースがブロックされる。

## 決定

### 1. 書体

| 役割       | 書体                    | ウェイト         |
| ---------- | ----------------------- | ---------------- |
| 和文 Serif | **Zen Old Mincho**      | 400 / 600 (静的) |
| 欧文 Serif | **EB Garamond**         | 400 / 600 (可変) |
| Mono       | **Geist Mono Variable** | 400 / 600        |

```css
--font-serif: "EB Garamond", "Zen Old Mincho", "Yu Mincho", serif;
--font-mono: "Geist Mono Variable", ui-monospace, monospace;
```

EB Garamond を先に置く。
CSS は左から順にグリフを探すため、Latin は EB Garamond、和文は Zen Old Mincho が担当する。

**Zen Old Mincho を選ぶ理由**: 大平善道が 1997 年に発表した ZEN オールド明朝 R が原型のオールドスタイル明朝 (Positype 発行、SIL OFL)。
縦組み用に設計された手描き輪郭を持ち、仮名の重心が現代明朝より低い。
この重心が「和」として読める。
起筆・終筆に筆意は残るが活字であり、筆文字ではない。
「和のテイストを出すが直接的な和風表現は避ける」という制約に正確に当たる。
提供ウェイトは 400 / 500 / 600 / 700 / 900 (800 は無い)。

**EB Garamond を選ぶ理由**: オールドスタイル・ヒューマニストで Zen Old Mincho と骨格が揃う。
可変かつ Latin 中心のため軽量 (roman + italic の全 14 スライスで 489 KB)。

### 2. CJK に可変フォントを使わない

**可変フォントは全スライスにウェイト軸を抱えるため 1 スライスあたりが 2.8 倍重い** (Noto Serif JP 56 KB 対 Zen Old Mincho 20 KB)。
型スケールが 400 と 600 の 2 段しか使わない以上、可変軸の対価を払う理由がない。

### 3. Fontsource で self-host する。外部 CDN から読まない

`@fontsource/zen-old-mincho` / `@fontsource-variable/eb-garamond` / `@fontsource-variable/geist-mono` を使う。

理由は 2 つある。

1. **cross-origin isolation との独立**: Google Fonts は現在 `cross-origin-resource-policy: cross-origin` を返すため COEP 下でも読めることを 2026-08-26 に実測で確認したが、サードパーティのヘッダ方針に本サイトの実行可能性を依存させ続ける理由がない。
   self-host なら同一オリジンとなり論点自体が消える。
2. **必要なウェイトだけを配れる**: Zen Old Mincho の 5 ウェイトのうち使うのは 2 つである。

Geist Mono は Google Fonts に存在せずいずれにせよ Fontsource が要る。
3 書体の取得経路を揃える。

### 計測の再現方法

`https://fonts.googleapis.com/css2?family=<Family>:wght@<weights>` を Chrome の User-Agent で取得し、`src: url(...)` の woff2 サイズを実測する。
計測日 2026-08-25。

## 代替案

### 1. Noto Serif JP (当初案)

#### Pros

- 最も標準的である。
  可変で 200–900 を持つ。

#### Cons

- 和のテイストが出ない。
  Design System が書体に和を担わせる決定と噛み合わない。
- 可変フォントのため 1 スライスが 56 KB で、Zen Old Mincho の 2.8 倍になる。
  使うウェイトは 2 段だけなので対価に見合わない。

### 2. Shippori Mincho

#### Pros

- 和のテイストは Zen Old Mincho と同等に強い。
  静的 5 ウェイト。

#### Cons

- 装飾性が高く、技術文書に対して過剰になる。
- 1 スライス平均 30 KB で Zen Old Mincho の 1.5 倍。

### 3. Hina Mincho

#### Pros

- 和のテイストが最も強く、Hero に置くと印象が立つ。
  ファミリ総量が最小 (約 2.4 MB)。

#### Cons

- 1 ウェイトのみかつ極細で、本文 1.05rem に使えない。
  見出し専用になる。

### 4. Klee One / Kaisei 各種

#### Cons

- 筆意が強く、「筆文字を避ける」制約に抵触する。

### 5. BIZ UDMincho

#### Cons

- 判読性は高いが和のテイストが出ない。
  Noto Serif JP と同じ理由で退ける。

### 6. 欧文に STIX Two Text (参考サイトと同じ)

#### Pros

- 「論文」の記号性が最も強い。
  参考サイトの質感を忠実に再現できる。

#### Cons

- Times 系で和より学術に寄る。
  参考サイトとの差別化が弱まる。
  オールドスタイル明朝との骨格の一致でも EB Garamond に劣る。

### 7. 欧文専用書体を入れず、Zen Old Mincho 内蔵の Latin を使う

#### Pros

- 追加ダウンロードがゼロ。
  和欧の骨格が完全に一致する。

#### Cons

- 欧文単体の品質が専用書体に劣る。
  本文に技術用語が高頻度で混在するため、そこが常時露出する。

### 8. Google Fonts CDN を使う

#### Pros

- 導入が最も簡単。
  CDN のキャッシュに乗る可能性がある。

#### Cons

- サードパーティのヘッダ方針に依存する。
  現在 CORP を返すことは確認したが、変わらない保証がない。
- Geist Mono が無いため、いずれにせよ Fontsource と併用になる。
  取得経路が 2 系統になる。

## 外部依存の健全性

| 項目                                                | 採用候補 (Zen Old Mincho + EB Garamond)                                                                    | 代替案 (Noto Serif JP) |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| 最終公開日                                          | Fontsource `@fontsource/zen-old-mincho` 5.3.0 / `@fontsource-variable/eb-garamond` 5.3.0 (2026-08-25 時点) | 同 5.3.0               |
| 対象バージョンへの対応 (peer dependency / 動作要件) | peer 依存なし。CSS の `@import` のみ                                                                       | 同左                   |
| 後継・代替の有無                                    | SIL OFL のため fork 可能。Google Fonts / Fontsource の両方から入手できる                                   | 同左                   |

## 影響

### 良い影響

- 1 スライスあたりの転送量が Noto Serif JP 比で約 1/3 になる。
  成功条件 S5 (LCP 2.5 秒以内) に効く。
- 和のテイストを意匠ではなく書体で担えるため、桜や和柄を使わずに済む。
- self-host により、`/playground/*` に COEP を掛けるときフォントの載せ替えが不要になる。

### 悪い影響 / トレードオフ

- ウェイトが 400 と 600 に固定される。
  強調の手段がサイズ・small-caps・letter-spacing・罫線に限られる。
  これは Design System の意図でもある。
- self-host のため配信物にフォントが含まれ、ビルド成果物が増える。
- 和文のフォールバック先を明示するため、フォールバック列に `Yu Mincho` を必ず含める。

### 影響範囲

- 対象モジュール / package: `packages/design-system`、`apps/web`

## 実装・運用への反映

- spec 更新要否: 要 (Fontsource の導入と、使用ウェイトを 400 / 600 に絞る設定)
- context / AI 向け設定更新要否: 不要 (Design System の feature doc が正本)

## 関連ドキュメント / チケット

- [design/features/design-system/DesignDoc_design-system.md](../design/features/design-system/DesignDoc_design-system.md): Typography の現在の設計
- [ADR-0006](0006-interactive-content-levels.md): `/playground/*` の cross-origin isolation (self-host の動機の 1 つ)
- [googlefonts/zen-oldmincho](https://github.com/googlefonts/zen-oldmincho)

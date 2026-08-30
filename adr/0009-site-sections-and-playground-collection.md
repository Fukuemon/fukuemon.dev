# ADR-0009: サイトを about / blog / playground の 3 つのセクションに分け、playground を collection にする

## 状態

承認

## 決定日

2026-08-30

## 背景

- 当初はトップページを成果物の一覧として作った。
  hero、最近の更新、種別ごとの節が並び、**「誰が書いているか」がどこにも無い**。
- 一方で、実行環境は Postgres だけに留まらない。
  TypeScript と Go は WASM で完結し、WebContainer は cross-origin isolation を要求する。
  **遊び場は増える前提である。**
- 現状の `/playground` は Postgres 専用の 1 ページを手書きしている。
  2 つ目を足すとページを複製することになり、記事とハンズオンで守っている「著者が触るのは Markdown 1 枚」が遊び場だけ破れる。
- mermaid の配信量を 2026-08-30 に実測した。

  | 方式                                 | 配信量         | ビルドの要件                    |
  | ------------------------------------ | -------------- | ------------------------------- |
  | ビルド時に SVG 化 (`rehype-mermaid`) | **0 バイト**   | `playwright` が peer dependency |
  | クライアントで描画                   | **約 300 KiB** | 無し                            |

  クライアント側の内訳は、入口 11 KiB に対し必ず読み込む core chunk が 151 KiB + 147 KiB。
  図の種類ごとの chunk がさらに乗る (flowchart 37 KiB、sequence 30 KiB)。
  全 103 chunk で 0.95 MiB。

## 決定

### 1. サイトを 3 つのセクションに分ける

| セクション | URL           | 役割                                               |
| ---------- | ------------- | -------------------------------------------------- |
| about      | `/`           | 誰が書いているか。外部リンク。各セクションへの入口 |
| blog       | `/blog`       | 記事とハンズオン                                   |
| playground | `/playground` | 手順に縛られず動かす場所                           |

**about は独立したページを作らず、トップにまとめる。**
別ページに切ると、トップが「入口だけのページ」になって 1 セクションぶん無駄になる。

**トップに最近の更新を残す。**
自己紹介だけのトップは、更新が止まっているサイトと見分けが付かない。

### 2. `/posts` を `/blog` に変える

読み手にとって「投稿」より「ブログ」のほうが指すものが明確である。

```
/blog                記事 + ハンズオン
/blog/articles       記事だけ
/blog/labs           ハンズオンだけ
/articles/<path>     記事の本文
/labs/<path>         ハンズオンの本文
```

**本文の URL (`/articles` `/labs`) は変えない。**
一覧の名前と本文の置き場は別の関心である。
本文を `/blog/articles/<path>` にすると、一覧のパスと本文のパスが衝突する。

### 3. playground を content collection にする

`playgrounds` collection を足し、1 つの遊び場を 1 枚の Markdown で表す。

```yaml
contentId: postgres
title: Postgres
description: 手順に縛られず、好きな SQL を投げられます。
runtime: pglite
presets:
  - label: 版と実行環境
    sql: select version();
```

URL は `/playground/<contentId>`。
一覧は `/playground`。

**articles / labs / playgrounds の 3 つが同じ形になる。**
遊び場を足す手順が、記事を足す手順と同じになる。

`/playground/*` には ADR-0006 で cross-origin isolation を予約済みである。
**遊び場を増やすたびに URL とヘッダの判断をやり直さずに済む。**
WASM で完結する TypeScript と Go は isolation を要求しないが、同じ棚に置いても害はない。

### 4. mermaid はフェンスの `run` で 2 通りに分ける

````
```mermaid          ビルド時に SVG 化する。配信 0 バイト
```mermaid run      クライアントの島。書き換えて即座に描き直す
````

**SQL とまったく同じ規則である。** 著者が覚えることは増えない。

記事の図に 300 KiB を配らない。
図を 1 つ置いただけで、本文しか読まない人にも配ることになる。

playground は 300 KiB を払う場所である。
PGlite の 5.28 MiB を払っているのと同じ判断で、**押されるまで落とさない**。

### 5. デザインは既存の決定に従う

セクションを増やしても、デザインの正本は [design-system](../design/features/design-system/DesignDoc_design-system.md) のままである。
「角丸を使わず、影で奥行きを作らない」「紙に刷った版面の見えを保つ」を about と playground にも適用する。

動きは状態の変化を伝えるときだけに使う。
**about だけを例外にする。** トップの表紙を兼ねるセクションで、名乗りと一覧が順に現れる動きを持つ。

例外にする理由は、about が読み手に**判断してもらう場所ではない**ためである。
一覧や実行パネルの動きは、読む手を止めさせるとそのぶん判断が遅れる。
about に判断は無い。

例外の範囲も、他のセクションと同じ規則の中に収める。

- 位置は動かさない。変えるのは濃度と罫の長さに限る
- 配る JavaScript は 0 バイト。`@starting-style` と `animation-timeline: view()` で組む
- `animation-timeline` は Chrome 115 以降でだけ効く。
  対応しない環境では規則ごと無視され、**最初から見えている**
- `prefers-reduced-motion: reduce` では最初から見えている

## 代替案

### 1. トップを成果物の一覧のままにする

#### Pros

- 実装を変えなくてよい。
- 読み手が最短で本文へ届く。

#### Cons

- 書いている人が分からない。
  技術記事は誰が書いたかで読み方が変わる。
- 外部リンク (X / GitHub) の置き場が無い。

### 2. `/about` を独立したページにする

#### Pros

- トップを一覧に保ったまま自己紹介を持てる。
- 分量が増えてもまとめらずに済む。

#### Cons

- トップが入口だけのページになる。
  1 セクションぶん無駄になる。
- 自己紹介は分量が増えない。増えないものに 1 ページを与える理由が無い。

### 3. playground をページの手書きで増やす

#### Pros

- collection と schema を足さなくてよい。
- 遊び場ごとに自由な画面を作れる。

#### Cons

- 2 つ目からページの複製になる。
  presets の形も 1 つずつ違ってよいことになり、共通の見た目が崩れる。
- 「著者が触るのは Markdown 1 枚」という規約が遊び場だけ破れる。

### 4. mermaid をクライアント描画に一本化する

#### Pros

- ビルドに chromium が要らない。
- 実装が 1 系統で済む。

#### Cons

- 図を 1 つ置いた記事が 300 KiB を配る。
  実測で core chunk だけで 298 KiB。
- 本文しか読まない人にも配ることになる。

### 5. mermaid をビルド時描画に一本化する

#### Pros

- 配信が常に 0 バイト。

#### Cons

- **mermaid の playground が作れない。** 書き換えて描き直すには、クライアントに mermaid が要る。

## 外部依存の健全性

| 項目                      | `rehype-mermaid` (ビルド時)             | `mermaid` (クライアント) |
| ------------------------- | --------------------------------------- | ------------------------ |
| version (2026-08-30 時点) | 3.0.0                                   | 11.17.2                  |
| peer dependency           | `playwright` 1                          | 無し                     |
| 後継・代替の有無          | `@beoe/rehype-mermaid`、`astro-mermaid` | 無し (事実上の標準)      |

`rehype-mermaid` は `mermaid-isomorphic` を経由し、その peer dependency が `playwright` である。
**CI に chromium の取得が要る。** 静的サイトのビルドは push ごとに 1 回なので、2 分程度の増加は許容する。

## 影響

### 良い影響

- 遊び場を足す手順が、記事を足す手順と同じになる。
- 図を置いた記事の配信量が増えない。
- mermaid の playground を、SQL と同じ仕組みで足せる。
- URL の名前が読み手の語彙に近づく。

### 悪い影響 / トレードオフ

- `/posts` から `/blog` への変更で、既存の URL が変わる。
  公開前なので被リンクは無いが、公開後なら redirect が要る。
- CI に chromium の取得が加わる。
- mermaid の描画が 2 系統になる。
  **フェンスの `run` の有無という 1 つの規則で分かれるので、著者から見た複雑さは増えない。**

### 影響範囲

- 対象モジュール / package: `apps/web` (pages / content / astro.config)、`packages/content-model` (`playgrounds` の schema)

## 実装・運用への反映

- spec 更新要否: 要 (playground の collection 化を実装する時点で spec を起こす)
- context / AI 向け設定更新要否: 要。
  [context/architecture.md](../context/architecture.md) の URL 規約、[context/authoring.md](../context/authoring.md) の置き場と図の書き方

## 関連ドキュメント / チケット

- [design/DesignDoc.md](../design/DesignDoc.md): 全体像
- [ADR-0006](0006-interactive-content-levels.md): `/playground/*` の予約と cross-origin isolation
- [ADR-0001](0001-starlight-as-docs-renderer.md): 描画レイヤと URL 規約
- [design-system](../design/features/design-system/DesignDoc_design-system.md): デザインの正本
- [rehype-mermaid](https://github.com/remcohaszing/rehype-mermaid)

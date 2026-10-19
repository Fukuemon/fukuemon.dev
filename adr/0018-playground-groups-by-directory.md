# ADR-0018: playground を `playgrounds/` の直下のディレクトリで分類し、URL をファイルのパスにする

## Status

承認

## Context

ADR-0009 は、1 つの playground を Markdown 1 枚で表し、URL を `/playground/<contentId>` にすると決めた。  
ADR-0009: [サイトのセクションと playground](0009-site-sections-and-playground-collection.md)

playground は、Postgres と、Go、TypeScript、Kotlin のような言語の単位で増える。  
同じ単位の中には、データセットの違う playground が複数並ぶ。  
Postgres には、1 テーブルの `events` と、4 テーブルの通販の注文の 2 つがある。  
2 つは同じ `runtime: pglite` で動き、違いは `setup`、`presets`、本文だけである。

`contentId` だけでは、どの単位に属するかを表せない。  
一覧で単位ごとに束ねるには、単位を表す値が要る。

## Decision

### `playgrounds/` の直下のディレクトリを分類にする

```text
apps/web/src/content/playgrounds/
  postgres/
    events.md
    shop.md
```

分類の名前は、ディレクトリ名をそのまま使う。  
一覧のページは、分類ごとに見出しと表を出す。  
分類の順は、各分類の先頭の playground の `order` で決まる。

**分類を足す手順は、ディレクトリを作って Markdown を置くことで完結する。**  
コードにも frontmatter にも分類の一覧を書かない。

### URL をファイルのパスにする

URL は `/playground/<path>` にする。`<path>` は Astro の `id` で、`postgres/shop` のように分類を含む。  
記事とハンズオンの本文の URL が、ファイルのパスで決まるのと同じ規則になる。

`contentId` は変えない。  
URL から外れても、playground を指す安定した識別子として残す。

以前の URL `/playground/postgres/` と `/playground/shop/` は、`apps/web/public/_redirects` で新しい URL へ 301 で転送する。

## Considered Options

| 選択肢                                                       | 強み                                                                                     | 弱み                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **採用:** 直下のディレクトリを分類にし、URL をパスにする     | Markdown 1 枚で 1 つの playground を表す規則が残る。分類を足すときにコードを変えずに済む | 分類の表示名がディレクトリ名に限られる                                                                              |
| frontmatter に `group` を書く                                | 表示名を自由に付けられる                                                                 | 同じ分類の全ファイルに同じ値を書く。書き間違えると分類が分かれる                                                    |
| 1 枚の Markdown に `datasets` を並べ、ページの中で切り替える | 一覧が分類だけの短いものになる                                                           | 1 枚が長くなる。切り替えるたびに実行環境を作り直す処理が要る。ADR-0009 の「Markdown 1 枚で 1 つ」が成り立たなくなる |

## Consequences

### Positive

- 一覧が、Postgres と言語の単位で分かれる。
- 分類を足す手順が、ディレクトリを作ることだけで済む。

### Negative

- 公開済みの 2 つの URL が変わる。`_redirects` で転送する。
- 分類の表示名は、ディレクトリ名の小文字のままになる。

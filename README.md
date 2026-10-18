# fukuemon.dev

技術記事とハンズオンを 1 つのサイトで公開する個人サイト。
ハンズオンは手順に区切られ、進捗が残り、ブラウザの中で実際にコードが動く。

https://fukuemon.dev

**読んで分かった気になる段階と、動かして分かる段階のあいだを埋めることを狙う。** 読者アカウントを持たず、サーバー側の永続状態も持たない。
誰のどの課題を解くか（Why / What）は [PRD.md](PRD.md) に、どう作るか（How）は [design/DesignDoc.md](design/DesignDoc.md) にある。

## 構成と技術スタック

pnpm workspace の monorepo。  
ディレクトリの構成は [design/DesignDoc.md](design/DesignDoc.md#repository-layout) に、使うツールと役割とバージョンの所在は [context/tech-stack.md](context/tech-stack.md) に、採否の理由は [adr/](adr/) にある。

## 開発

mise と pnpm が要る。
Node.js は、`mise install` が `mise.toml` に書いたバージョンで入れる。
pnpm のバージョンは `package.json` の `packageManager` にある。
準備の手順の全体は [CONTRIBUTING.md](CONTRIBUTING.md) にある。

```sh
mise install
pnpm install
pnpm run dev
```

| コマンド               | 用途                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `pnpm run dev`         | 開発サーバー                                                |
| `pnpm run build`       | ビルド (Astro + Pagefind の索引。`vp run` でキャッシュする) |
| `pnpm run check`       | 品質のチェック一式                                          |
| `pnpm run infra:check` | Terraform の書式と構文 (要 Terraform)                       |

`check` が通すチェックと順序は、ルートの `package.json` の `check` にある。
`infra:check` は Terraform を必要とするため `pnpm run check` には含めない。
CI の Check workflow では別の step として先に回す。

## 配信

- 管轄の分担、deploy と apply の条件、credential の置き場: [context/operations.md](context/operations.md)
- 基盤の構成と、deploy と apply の流れ: [infra/DesignDoc.md](infra/DesignDoc.md)
- 基盤を作る手順と apply の手順: [infra/README.md](infra/README.md)
- 判断の理由: [ADR-0005](adr/0005-workers-terraform-wrangler-boundary.md)

## 文書

| 知りたいこと        | 読む場所                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| Why / What          | [PRD.md](PRD.md)                                                               |
| 全体像              | [design/DesignDoc.md](design/DesignDoc.md)                                     |
| 機能ごとの設計      | 対象のコードの隣の `DesignDoc.md`。一覧は [context/index.md](context/index.md) |
| 技術規約 / 運用契約 | [context/](context/)                                                           |
| 判断とその代替案    | [adr/](adr/)                                                                   |

迷ったら Design Doc から読む。
内容が食い違ったときは、取り決めは context を、構成と処理の流れは Design Doc を、判断とその理由は ADR を正とする。

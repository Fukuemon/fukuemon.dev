# ADR-0031: サブドメインに分ける規則を決め、1 つのアプリを 1 つの Worker とホスト名に割り当てる

## Status

提案

## Context

fukuemon.dev のドメインの下に、サイトのほかに、複数のアプリを置く。  
どれを fukuemon.dev に置き、どれをサブドメインに分けるかを決める必要がある。

- 配信は Cloudflare Workers Static Assets で行う。custom domain は Terraform が、deploy は Wrangler が管理する。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md)
- カタログは、`design.fukuemon.dev` に置いている。
  - ADR-0021: [packages/ui に Base と Case の React のコンポーネントを置き、packages/ui の Storybook をカタログにする](0021-ui-components-and-catalog.md)
- 訪問者のアカウントを持たないので、サイトが持つ訪問者の値は、訪問者のブラウザに保存した値だけである。
  - ADR-0008: [読者の identity を前提とする機能を作らず、バックエンドを持たない](0008-no-reader-identity.md)
- 実行環境の方式は、実行環境の要求の prototype で決める。候補の WebContainers は、cross-origin isolation（`COOP: same-origin` と `COEP: require-corp`）を求める。
  - 出典: [WebContainers: Configuring Headers](https://webcontainers.io/guides/configuring-headers)
- cross-origin isolation は、サイト全体に掛けず、`/playground/*` だけに掛けると決めている。
  - ADR-0006: [手を動かす場所を 4 つに分け、cross-origin isolation を `/playground/*` に限定する](0006-interactive-content-levels.md)
- `COEP: require-corp` のページでは、CORP を返さないクロスオリジンのリソースがブロックされる。
- isolation が要る実行環境を、別の origin の iframe で記事に埋め込むときに、記事のページの側に要るヘッダは、確認していない。
- サイトを作り直すあいだ、本番は切り替える前のサイトを配信し続ける。作りかけのサイトを、実機と E2E で確認する URL が要る。

## Decision

### 1. サブドメインに分ける規則

次のどれかに当たるものを、サブドメインに分ける。当たらないものは、fukuemon.dev に置く。

1. 訪問者が書いたコードを動かす。origin を分けて、サイトが保存した値に届かないようにする。
2. サイトと違うレスポンスヘッダか、アクセスの認証が要る。
3. サイトと別に作って別に出す、独立したアプリである。

1 つのアプリは、1 つの Worker と 1 つのホスト名に割り当てる。  
1 つの Worker に、パスで複数のアプリを載せない。アプリごとに、出す契機とヘッダを分けるためである。

### 2. 割り当て

| ホスト名              | 置くもの                                               | 当たる規則 |
| --------------------- | ------------------------------------------------------ | ---------- |
| `fukuemon.dev`        | トップ、記事、シリーズ、プレイグラウンドの一覧のページ | 無い       |
| `design.fukuemon.dev` | カタログ                                               | 3          |
| `docs.fukuemon.dev`   | 文書のサイト                                           | 2 と 3     |

- 実行環境を置く origin は、この ADR では決めない。実行環境の方式を決める ADR が、規則 1 と 2 に照らして決める。
- ゲームのような独立したアプリは、足すときに、規則 3 でサブドメインを 1 つ割り当てる。

### 3. cross-origin isolation

fukuemon.dev のページには、cross-origin isolation のヘッダを書かない。  
サイト全体に掛けると、CORP を返さない外部のリソースが、全てのページでブロックされるためである。  
実行環境が isolation を求めるときに、どの URL に掛けるかは、実行環境の方式を決める ADR が決める。

### 4. 切り替えまでのプレビュー

- 新しいサイトを、本番と別の名前の Worker（`fukuemon-dev-preview`）に出す。custom domain を付けず、workers.dev の URL で開く。
- develop への push で check が通ったときに出す。
- 誰でも開けるままにし、全てのレスポンスに `X-Robots-Tag: noindex` を返す。E2E と Lighthouse を、認証なしで流すためである。
- 本番の Worker（`fukuemon-dev`）への deploy は、運用者が手で起動したときだけ行う。
- 本番を新しいサイトに切り替えるときに、プレビューの Worker を消し、本番の Worker へ develop への push で出す設定に替える。

## Considered Options

| 選択肢                                                                                   | 強み                                                                                      | 弱み                                                                                     |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **採用:** 分ける規則と今決められる割り当てを決め、実行環境の origin は方式と一緒に決める | 方式が決まる前に、origin を固定しない。基盤の作業を、prototype の結果を待たずに進められる | 実行環境の置き場が、この時点では決まらない                                               |
| 実行環境をサブドメインに置き、記事から iframe で埋め込むところまで決める                 | 訪問者のコードが、サイトが保存した値に届かない。実行環境の Worker を先に用意できる        | 方式が決まる前に決めるので、prototype の結果で決め直す見込みがある                       |
| サイトの全てを fukuemon.dev の下のパスに置く                                             | Worker が少ない。同じ origin なので、埋め込みが単純になる                                 | 訪問者のコードが、サイトと同じ origin で動く。isolation のヘッダを、パスごとに書き分ける |
| プレビューを、本番の Worker のバージョンごとの URL で出す                                | Worker が増えない                                                                         | 上げるたびに URL が変わる。本番の Worker への操作なので、コマンドを誤ると本番が替わる    |
| プレビューを出さず、手元だけで確認する                                                   | 基盤が増えない                                                                            | 実機で確認できない。E2E と Lighthouse を、配信した状態で流せない                         |

## Consequences

### Positive

- 新しいアプリを足すときに、置き場を規則で決められる。
- 作りかけのサイトを、本番の Worker に触れずに、変わらない URL で確認できる。

### Negative

- Worker が、サイト、カタログ、文書のサイト、プレビューの 4 つになる。
- プレビューの Worker は custom domain を持たないので、Worker の名前を Terraform の変数と比べるチェックの対象の外になる。
- プレビューの URL を知っている人は、作りかけのサイトを開ける。

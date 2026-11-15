# ADR-0084: 本番の Worker を develop の check の成功で deploy し、プレビューの Worker を置かない

## Status

承認

## Context

本番を作り直したサイトに切り替えるときに、本番の Worker の deploy の契機と、開発中のサイトの確認先を決める必要がある。

- 通常の deploy workflow は、push を起点に自動で動き、deploy の範囲に絞った token だけを持つと決めている。
  - ADR-0005: [Cloudflare Workers Static Assets を採用し、基盤を Terraform、deploy を Wrangler が管理する](0005-workers-terraform-wrangler-boundary.md#5-credential-を-2-系統に分ける)
- カタログ、プレイグラウンド、ドキュメントサイトの Worker は、すでに develop の check の成功で deploy している。

## Decision

切り替えの後は、本番の Worker を、ほかの Worker と同じ契機で deploy する。プレビューの Worker は置かない。

- 本番の Worker（`fukuemon-dev`）は、develop への push で check workflow が成功したときに、deploy workflow が deploy する。
  - 出し直しは、運用者が deploy workflow を `workflow_dispatch` で `develop` から手で起動する。
  - ADR-0005 の 5 の通常の deploy workflow に、本番の Worker を戻す。例外は無くす。
- プレビューの Worker（`fukuemon-dev-preview`）と、deploy-preview workflow、noindex を足したアセットを作るスクリプトを、リポジトリから消す。
  - Cloudflare の Worker は、運用者が `wrangler delete` で消す。Terraform の管理下に無いので、apply は要らない。
- 開発中のサイトは、手元の `astro preview` と E2E で確認する。
- 本番の Worker の `workers_dev` と `preview_urls` を閉じ、custom domain の `fukuemon.dev` だけで公開する。
  - `apps/web/wrangler.jsonc` に `false` を書き、`pnpm run check:closed-workers-dev` で確認する。

## Considered Options

| 選択肢                                                                | 強み                                                  | 弱み                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| **採用:** 本番の Worker を check の成功で deploy し、プレビューを消す | Worker が減る。deploy の契機が 4 つの Worker でそろう | develop の check が成功すると、そのまま本番に出る                     |
| プレビューの Worker を残し、本番の deploy を手動だけにする            | 本番に出る前に、workers.dev の URL で確認できる       | 切り替えの後も、Worker と workflow を保つ。URL を知る人は誰でも開ける |
| プレビューを、本番の Worker のバージョンごとの URL で公開する         | Worker が増えない                                     | `preview_urls` を開けると、ほかの Worker と閉じ方がそろわない         |

## Consequences

### Positive

- Worker が、サイト、プレイグラウンド、カタログ、ドキュメントサイトの 4 つになる。
- 4 つの Worker が、同じ契機で deploy される。
- workers.dev で公開する Worker が無くなる。

### Negative

- develop の check が成功すると、確認を挟まずに本番へ出る。
- 開発中のサイトを、実機の別の端末から開く URL が無くなる。

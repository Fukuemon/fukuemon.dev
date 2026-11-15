#!/usr/bin/env bash
# workers_dev の既定は true で、書かないと *.workers.dev でも開ける (ADR-0084)
# ドキュメントサイトは、noindex の確認も持つ apps/docs-site/scripts/check-closed-urls.sh が見る
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
status=0

for wrangler in apps/web/wrangler.jsonc packages/ui/wrangler.jsonc apps/playground/wrangler.jsonc; do
  file="$ROOT/$wrangler"
  if [ ! -r "$file" ]; then
    echo "$wrangler を読めません。" >&2
    exit 1
  fi
  # ブロックコメントの中の行は、行ごとの確認では除けない
  if grep -qF '/*' "$file"; then
    echo "$wrangler にブロックコメントがあります。コメントは // で書く。" >&2
    status=1
  fi
  code="$(grep -vE '^[[:space:]]*//' "$file")"
  for key in workers_dev preview_urls; do
    if grep -qE "\"$key\"[[:space:]]*:[[:space:]]*true" <<<"$code"; then
      echo "$wrangler に $key が true の行があります（env の中も含む）。" >&2
      status=1
    elif ! grep -qE "^  \"$key\"[[:space:]]*:[[:space:]]*false" <<<"$code"; then
      echo "$wrangler のトップレベルに $key: false の行がありません。" >&2
      status=1
    fi
  done
done

if [ "$status" -eq 0 ]; then
  echo "サイト、カタログ、プレイグラウンドの Worker の workers.dev とバージョンごとの URL は閉じています"
fi
exit "$status"

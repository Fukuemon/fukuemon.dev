#!/usr/bin/env bash
# Worker 名は wrangler.jsonc と Terraform の双方が持つ。
# 食い違うと cloudflare_workers_custom_domain が存在しない Worker を指し、custom domain の紐付けが切れる。
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WRANGLER="$ROOT/apps/web/wrangler.jsonc"
VARS="$ROOT/infra/cloudflare/vars.tf"

w=$(grep -oE '"name"[[:space:]]*:[[:space:]]*"[^"]+"' "$WRANGLER" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
t=$(awk '/variable "worker_name"/,/^}/' "$VARS" | grep 'default' | sed 's/.*"\([^"]*\)".*/\1/')

if [ -z "$w" ] || [ -z "$t" ]; then
  echo "Worker 名を読み取れませんでした (wrangler.jsonc='$w' vars.tf='$t')" >&2
  exit 1
fi

if [ "$w" != "$t" ]; then
  echo "Worker 名が食い違っています。" >&2
  echo "  apps/web/wrangler.jsonc: $w" >&2
  echo "  infra/cloudflare/vars.tf: $t" >&2
  exit 1
fi

echo "Worker 名は一致しています ($w)"

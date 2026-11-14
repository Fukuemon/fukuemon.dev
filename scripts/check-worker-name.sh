#!/usr/bin/env bash
# Worker 名は wrangler.jsonc と Terraform の双方が持つ。
# 食い違うと cloudflare_workers_custom_domain が存在しない Worker を指し、custom domain の紐付けが切れる。
# プレビューの Worker（apps/web の env.preview）は custom domain を持たないので比べない (ADR-0031)
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
VARS="$ROOT/infra/cloudflare/vars.tf"

# 引数: wrangler.jsonc の repo root からのパス、vars.tf の変数名
check() {
  local wrangler="$ROOT/$1" var="$2" w t
  w=$(grep -oE '"name"[[:space:]]*:[[:space:]]*"[^"]+"' "$wrangler" | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
  t=$(awk "/variable \"$var\"/,/^}/" "$VARS" | grep 'default' | sed 's/.*"\([^"]*\)".*/\1/')

  if [ -z "$w" ] || [ -z "$t" ]; then
    echo "Worker 名を読み取れませんでした ($1='$w' vars.tf の $var='$t')" >&2
    return 1
  fi

  if [ "$w" != "$t" ]; then
    echo "Worker 名が食い違っています。" >&2
    echo "  $1: $w" >&2
    echo "  infra/cloudflare/vars.tf の $var: $t" >&2
    return 1
  fi

  echo "Worker 名は一致しています ($w)"
}

check apps/web/wrangler.jsonc worker_name
check packages/ui/wrangler.jsonc catalog_worker_name
check apps/playground/wrangler.jsonc playground_worker_name

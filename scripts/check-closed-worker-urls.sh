#!/usr/bin/env bash
# Access を custom domain にだけ掛ける Worker は、workers.dev とバージョンごとの URL を閉じておく (ADR-0032)。
# 値を true にした変更が develop に入ると、deploy の workflow が apply を通らずに Access の外の URL を開く
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
status=0

for wrangler in apps/docs-site/wrangler.jsonc; do
  for key in workers_dev preview_urls; do
    if ! grep -qE "^[[:space:]]*\"$key\"[[:space:]]*:[[:space:]]*false[[:space:]]*,?[[:space:]]*$" "$ROOT/$wrangler"; then
      echo "$wrangler の $key が false ではありません。" >&2
      status=1
    fi
  done
done

[ "$status" -eq 0 ] && echo "Access の外の URL は閉じています"
exit "$status"

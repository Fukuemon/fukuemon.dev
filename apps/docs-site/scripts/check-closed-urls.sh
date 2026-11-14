#!/usr/bin/env bash
# Access を custom domain にだけ掛ける Worker は、workers.dev とバージョンごとの URL を閉じておく (ADR-0032)。
# 値を true にした変更が develop に入ると、deploy の workflow が apply を通らずに Access の外の URL を開く。
# env の中に同じキーを書いても見逃さないよう、false の行があることに加えて、true の行が無いことを確かめる
set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER="wrangler.jsonc"
HEADERS="public/_headers"
status=0

for key in workers_dev preview_urls; do
  if ! grep -qE "\"$key\"[[:space:]]*:[[:space:]]*false" "$APP/$WRANGLER" ||
    grep -qE "\"$key\"[[:space:]]*:[[:space:]]*true" "$APP/$WRANGLER"; then
    echo "$WRANGLER の $key が false ではありません。" >&2
    status=1
  fi
done

# Access の外へ漏れたときに、検索の結果に載せない
if ! grep -qE '^[[:space:]]+X-Robots-Tag:[[:space:]]*noindex' "$APP/$HEADERS"; then
  echo "$HEADERS に X-Robots-Tag: noindex がありません。" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "Access の外の URL は閉じています"
fi
exit "$status"

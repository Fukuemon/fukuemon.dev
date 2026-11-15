#!/usr/bin/env bash
# ドキュメントサイトは custom domain の docs.<zone> だけで公開し、workers.dev とバージョンごとの URL を閉じておく (ADR-0032)。
# 値を true にした変更が develop に入ると、deploy の workflow が apply を通らずに custom domain 以外の URL を開く。
# JSONC を解釈せずに 1 行ずつ正規表現で比べるので、コメントの行を除き、トップレベル（半角スペース 2 つのインデント）に false の行があることを確認する。
# env の中に同じキーを書いても見逃さないよう、どの深さにも true の行が無いことも確認する
set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER="$APP/wrangler.jsonc"
# 引数で dist/_headers を渡すと、配信する出力を確認する
HEADERS="${1:-$APP/public/_headers}"
status=0

for file in "$WRANGLER" "$HEADERS"; do
  if [ ! -r "$file" ]; then
    echo "$file を読めません。" >&2
    exit 1
  fi
done

# wrangler は .wrangler/deploy/config.json で設定を差し替える。
# wrangler.json は親のディレクトリへ遡って探し、見つかれば wrangler.jsonc より先に読む
if [ -e "$APP/.wrangler/deploy/config.json" ]; then
  echo ".wrangler/deploy/config.json があります。wrangler.jsonc のほかに wrangler の設定ファイルを置かない。" >&2
  status=1
fi
dir="$APP"
while :; do
  if [ -e "$dir/wrangler.json" ]; then
    echo "$dir/wrangler.json があります。wrangler.jsonc のほかに wrangler の設定ファイルを置かない。" >&2
    status=1
  fi
  [ "$dir" = "/" ] && break
  dir="$(dirname "$dir")"
done

# wrangler deploy の --domain、--routes、--config などの引数も、apply を通らずに custom domain 以外の URL を作るおそれがある
deploy="$(jq -r '.scripts.deploy // ""' "$APP/package.json")"
if [ "$deploy" != "wrangler deploy" ]; then
  echo "package.json の deploy が wrangler deploy ではありません。引数を足さない。" >&2
  status=1
fi

# predeploy と postdeploy は、pnpm の設定によって pnpm run deploy の前後に、deploy の token を持った step の中で動く
for hook in predeploy postdeploy; do
  if [ "$(jq -r --arg k "$hook" '.scripts | has($k)' "$APP/package.json")" = "true" ]; then
    echo "package.json に $hook があります。deploy の前後にスクリプトを足さない。" >&2
    status=1
  fi
done

# ブロックコメントの中の行は、下の行ごとの確認では除けない
if grep -qF '/*' "$WRANGLER"; then
  echo "wrangler.jsonc にブロックコメントがあります。コメントは // で書く。" >&2
  status=1
fi

code="$(grep -vE '^[[:space:]]*//' "$WRANGLER")"

# route と routes は、apply を通らずにホスト名を作るおそれがある。custom domain は Terraform の管轄 (ADR-0005)
for key in route routes; do
  if grep -qE "\"$key\"[[:space:]]*:" <<<"$code"; then
    echo "wrangler.jsonc に $key があります（env の中も含む）。ホスト名は Terraform で作る。" >&2
    status=1
  fi
done

for key in workers_dev preview_urls; do
  if grep -qE "\"$key\"[[:space:]]*:[[:space:]]*true" <<<"$code"; then
    echo "wrangler.jsonc に $key が true の行があります（env の中も含む）。" >&2
    status=1
  elif ! grep -qE "^  \"$key\"[[:space:]]*:[[:space:]]*false" <<<"$code"; then
    echo "wrangler.jsonc のトップレベルに $key: false の行がありません。" >&2
    status=1
  fi
done

# 検索の結果に載せるかを決めるまで、noindex を返す。すべてのパスに掛かるよう、noindex がただ 1 つの /* のブロックの中にあることを確認する。
# /* が 2 つあると後のブロックのヘッダだけが返り、! X-Robots-Tag はそのパスの noindex を外す
if ! awk '
  /^[^[:space:]#]/ { in_all = ($0 == "/*"); if (in_all) blocks++ }
  in_all && /^[[:space:]]+X-Robots-Tag:[[:space:]]*noindex/ { found = 1 }
  /^[[:space:]]+![[:space:]]*X-Robots-Tag/ { removed = 1 }
  END { exit !(found && blocks == 1 && !removed) }
' "$HEADERS"; then
  echo "$HEADERS は、ただ 1 つの /* に X-Robots-Tag: noindex を持ち、! X-Robots-Tag を持たない形にする。" >&2
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "custom domain 以外の URL は閉じていて、すべてのパスに noindex があります"
fi
exit "$status"

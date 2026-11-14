#!/usr/bin/env bash
# infra/ の書式と構文を検査する。
# backend を無効にして init するため credential は要らない。
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

terraform fmt -check -recursive infra/

for d in infra/bootstrap infra/cloudflare; do
  terraform -chdir="$d" init -backend=false -input=false >/dev/null
  terraform -chdir="$d" validate
done

#!/usr/bin/env bash
# packages/ui のセマンティックトークンのコントラストを、ライト、OS の設定のダーク、Storybook のダークの 3 つの条件で確かめる。
# ダークの値は semantic-dark.css の 2 つのブロックにあり、check-contrast.mjs は --root で渡したブロックだけを画面に効く値として読む。
set -euo pipefail
tokens=./packages/ui/src/tokens
dark_sources=("$tokens/primitive.css" "$tokens/semantic.css" "$tokens/semantic-dark.css")

node scripts/check-contrast.mjs
node scripts/check-contrast.mjs --root '@media (prefers-color-scheme: dark) :root:not([data-theme="light"])' "${dark_sources[@]}"
node scripts/check-contrast.mjs --root '[data-theme="dark"]' "${dark_sources[@]}"

---
root: false
targets: ["*"]
description: 非対話で呼べる CLI エージェントのレジストリ。invocation / 上限判定 / 用途別ルーティングの正本
globs: []
---

# AI Agents

`agent-orchestrate` / `multi-agent-review` が読むレジストリ。
スキーマは `agent-orchestrate` skill の `references/agent-registry-schema.md`。

## 共通既定

| 項目               | 値         | 根拠                                                       |
| ------------------ | ---------- | ---------------------------------------------------------- |
| `timeout`          | 900 秒     | 差分全体を読ませるレビューで 15 分を超えたら結果を待たない |
| 出力先 dir 既定    | `.ai-out/` | `.gitignore` 済み。commit しない                           |
| `max_input_tokens` | 120000     | 超える差分はファイル単位で分割して投げる                   |

## 用途別ルーティング

| 用途        | 既定のエージェント集合 |
| ----------- | ---------------------- |
| `review`    | `codex`, `cursor`      |
| `implement` | `codex`                |

## エージェント

### codex

- `enabled`: yes
- `model`: (CLI 既定)
- `invocation`: `codex exec --skip-git-repo-check "$PROMPT"`
- `verified`: yes (2026-08-30 に `codex exec --help` で確認)
- `limit_patterns`: `rate limit`, `quota`, `context length`, `429`
- `auth_note`: `codex login` 済みであること
- `timeout`: 900

### cursor

- `enabled`: yes
- `model`: (CLI 既定)
- `invocation`: `cursor-agent --print --output-format text --mode ask --trust "$PROMPT"`
- `verified`: yes (2026-08-30 に実行して確認。`--trust` が無いと workspace trust の確認で止まる)
- `limit_patterns`: `rate limit`, `quota`, `Unauthorized`, `429`
- `auth_note`: `CURSOR_API_KEY` またはログイン済みであること
- `timeout`: 900

## 参照

- [context/toolchain.md](toolchain.md): CLI の導入方法

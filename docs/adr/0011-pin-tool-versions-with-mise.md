# ADR-0011: ツールのバージョンを mise で固定する

## Status

承認

## Context

agent-harness のスキルとフックは apm で配置し、Git で追跡しない。  
CI の docs のチェックも、apm が配置したスクリプトを呼ぶ。  
apm のバージョンが CI と手元で違うと、配置されるスキルとフックが食い違う。

Vite+ の `vp env` も、Node.js のバージョンを固定できる。  
`vp env` は global の CLI にだけあり、npm の `vite-plus` には含まれない。  
出典: vite-plus 1.3.0 の `docs/guide/env.md`（[Environment](https://viteplus.dev/guide/env)）

## Decision

`mise.toml` で apm（`pipx:apm-cli`）と Node.js のバージョンを固定する。  
CI と手元は、同じ `mise.toml` からツールを入れる。

理由は 2 つある。

- agent-harness の apm を、CI と手元で同じバージョンで入れる必要がある。
- ほかのリポジトリと、ツールを入れる手順をそろえる。

Node.js のバージョンは mise で固定し、`vp env` を使わない。  
`vp env` は global の CLI にだけあり、devDependency の `vite-plus` では使えない。  
mise は Node.js のほかに apm、uv、similarity-ts も固定しており、`vp env` に移すとバージョンを管理する手段が 2 つになる。

## Considered Options

| 選択肢                                                         | 強み                                                                                                                    | 弱み                                                                                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **採用:** `mise.toml` で apm と Node.js のバージョンを固定する | apm と Node.js のバージョンを 1 つのファイルで固定でき、CI と手元が同じバージョンになる。ほかのリポジトリと手順がそろう | Vite+ の `vp env` と役割が重なる                                                       |
| Node.js のバージョンを `vp env` で固定する                     | Vite+ に環境の管理を集める                                                                                              | global の CLI が要る。apm、uv、similarity-ts は mise に残り、管理する手段が 2 つになる |
| Node.js の下限を `package.json` の `engines` だけで示す        | 新しいツールが要らない                                                                                                  | バージョンを固定せず、apm のバージョンも固定できない                                   |

## Consequences

### Positive

- CI と手元で、同じバージョンの apm がスキルとフックを配置する。

### Negative

- Vite+ の `vp env` と役割が重なる。

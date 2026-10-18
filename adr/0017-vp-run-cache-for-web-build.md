# ADR-0017: Vite+ は `apps/web` の build を `vp run` でキャッシュすることだけに使う

## Status

承認

## Context

ADR-0003 は、Vite+ を採り、タスクのコマンドを package.json の scripts に置き、`vite.config.ts` の `run.tasks` には `dependsOn` だけを書くと決めた。  
Node.js のバージョン、package manager の実行、lint と format と test も、Vite+ に任せると決めた。  
ADR-0003: [monorepo と Vite+ の採否](0003-monorepo-and-vite-plus.md)

ADR-0011 は Node.js のバージョンを mise で固定し、Vite+ を入れるときに `vp env` と mise のどちらにするかを決め直すとした。  
ADR-0011: [ツールのバージョンを mise で固定する](0011-pin-tool-versions-with-mise.md)

vite-plus 1.3.0 の `vp run` には、次の制約がある。

- `run.tasks` のタスクは `command` を必ず持つ。同じ名前のタスクを `run.tasks` と package.json の scripts の両方には置けない。
  - 出典: vite-plus 1.3.0 の `docs/config/run.md`（[Run Config](https://viteplus.dev/config/run)）
- package.json の scripts は、`--cache` を付けるとキャッシュされるが、入力から外すファイルを指定できない。
  - `astro build && pagefind --site dist` を `vp run --cache` で 2 回実行すると、2 回目も「modified their inputs」で 0/2 のキャッシュヒットになる。
  - astro build が自分で書く `.astro/` と `dist/` を、入力として読むためである。
- 入力と出力は、実行中のファイルの読み書きから自動で記録する。
  - 出典: vite-plus 1.3.0 の `docs/guide/automatic-data-tracking.md`（[Automatic Data Tracking](https://viteplus.dev/guide/automatic-data-tracking)）

vite-plus 1.3.0 の同梱のツールと `vp env` には、次の事実がある。

- vite-plus 1.3.0 は vitest 5.0.5、oxfmt 0.73.0、oxlint 1.88.0 を同梱する。リポジトリは vitest ^4.1.11、oxfmt ^0.48.0、oxlint ^1.80.0 を宣言する。
- `vp test` は、vite-plus の依存の vitest を先に解決する。
  - 出典: vite-plus 1.3.0 の `docs/guide/test.md`（[Test](https://viteplus.dev/guide/test)）
- `vp env` は global の CLI にだけあり、npm の `vite-plus` には含まれない。
  - 出典: vite-plus 1.3.0 の `docs/guide/env.md`（[Environment](https://viteplus.dev/guide/env)）
- GitHub Actions で run をまたいでタスクのキャッシュを持ち越す手順は、experimental とされている。
  - 出典: vite-plus 1.3.0 の `docs/guide/github-actions-cache.md`（[GitHub Actions Cache](https://viteplus.dev/guide/github-actions-cache)）

## Decision

### 1. `apps/web` の build のコマンドを `apps/web/vite.config.ts` のタスクに置く

`astro build` を `build:site` に、`pagefind --site dist` を `build:search` に置き、`build:search` は `build:site` に依存させる。  
`apps/web/package.json` の `build` の script は、`vp run build:search` だけを実行する。

理由は 3 つある。

- package.json の scripts のままでは、入力から `.astro/` と `dist/` を外せず、キャッシュが当たらない。
- script の名前を `build` のまま残すので、`pnpm run build` と `pnpm --filter @fukuemon/web run build` を CI と deploy からそのまま使える。
- 2 つのタスクに分けると、原稿を変えたときに Pagefind も実行し直す。1 つのタスクにまとめると、原稿を変えても索引がキャッシュから戻り、古くなる。

`build:site` の出力は `dist/**` と明示する。  
自動の記録は `dist/_astro/` を拾わず、`dist/` を消した後のキャッシュヒットで、HTML だけが戻り資産が欠けた。原因は確かめていない。

`vite-plus` は、`vite.config.ts` を持ち `vp` を呼ぶ `apps/web` の devDependencies に宣言する。

この決定は、ADR-0003 の Decision 3 を置き換える。

### 2. build のほかのタスクは、キャッシュに載せない

lint、typecheck、test、knip、ほかのチェックは package.json の scripts に置いたまま、pnpm で実行する。  
`pnpm run check` は pnpm の script をつなぐ形のままにし、その中の build だけがキャッシュを使う。

キャッシュが誤って当たると、チェックは実行されないまま通ったことになる。  
lint、typecheck、test、knip は、手元でどれも 7 秒以内に終わり、キャッシュで縮める時間が小さい。

### 3. lint、format、test は、devDependencies に宣言したバージョンを直接実行する

`vp lint`、`vp fmt`、`vp test`、`vp check` を使わない。  
Oxlint、Oxfmt、Vitest は devDependencies に宣言したバージョンを、各 package の script から実行する。

理由は 2 つある。

- `@vitest/coverage-v8` 4.1.11 は、peer に vitest 4.1.11 を求める。vitest 5 へ上げるには、coverage-v8 も上げ、Vitest 5 への移行の手順に従う必要がある。
  - 出典: vite-plus 1.3.0 の `docs/guide/test.md`（[Test](https://viteplus.dev/guide/test)）
- `vp lint` と `vp fmt` は設定を `vite.config.ts` の `lint` と `fmt` に置くことを勧める。設定を `.oxlintrc.json` と `.oxfmtrc.jsonc` から移すと、lefthook の pre-commit と CI も変えることになる。

この決定は、ADR-0003 の Decision 2 のうち、lint、format、test、typecheck を Vite+ の同梱のツールに任せるとした判断を置き換える。

### 4. package manager は pnpm を直接実行する

`vp install` を使わない。  
pnpm のバージョンは `package.json` の `packageManager` で固定しており、`vp install` に任せて得るものがない。

この決定は、ADR-0003 の Decision 2 のうち、package manager の実行を `vp install` に任せるとした判断を置き換える。

### 5. Node.js のバージョンは mise で固定し、`vp env` を使わない

`vp env` は global の CLI にだけあり、devDependency の `vite-plus` では使えない。  
mise は Node.js のほかに apm、uv、similarity-ts も固定しており、`vp env` に移すとバージョンを管理する手段が 2 つになる。

この決定は、ADR-0011 の Negative に残した、`mise.toml` と `vp env` のどちらで Node.js のバージョンを持つかの判断を、mise に決める。

### 6. CI は pnpm の script を実行し、タスクのキャッシュを持ち越さない

CI は、`pnpm run check` と `pnpm --filter @fukuemon/web run build` を実行する。`vp` は devDependency のものを、`apps/web` の script が呼ぶ。  
`voidzero-dev/setup-vp` は使わない。Node.js を入れるので、mise と役割が重なる。  
`node_modules/.vite/task-cache` を run をまたいで持ち越さない。手順が experimental で、キャッシュが外れたときの build は 4 秒ほどで終わる。

### 7. Vite+ を外す手順

Vite+ を外すときは、次の 3 つを行う。

- `apps/web/package.json` の `build` を `astro build && pagefind --site dist` に戻す。
- `apps/web/vite.config.ts` を消す。
- `apps/web` の devDependencies から `vite-plus` を消す。

ADR-0003 の Decision 4 の撤退の条件と、Turborepo へ切り替える選択肢は変えない。

## Verification

`pnpm --filter @fukuemon/web run build` を、キャッシュを消してから続けて実行して確かめた。  
macOS の手元の結果で、CI の Linux では確かめていない。

- `apps/web/src/content/` の原稿を 1 つ変えると、`build:site` が原稿の変更でキャッシュを外し、`build:search` も実行し直す。
- `packages/design-system/styles/tokens.css` を変えると、`build:site` が `tokens.css` の変更でキャッシュを外し、`build:search` も実行し直す。
- 何も変えずに 2 回目を実行すると、2/2 のキャッシュヒットになる。
- `apps/web/dist/` を消してから実行すると、`build:site` がキャッシュから `dist/` を戻し、ファイルの一覧が build の直後と一致する。

ADR-0003 の Decision 4 の 3 つの条件は満たした。

環境変数も、キャッシュの指紋に入る。  
ルートの `pnpm run build` と `pnpm --filter @fukuemon/web run build` は、pnpm が渡す `INIT_CWD` と `PATH` が違うので、互いのキャッシュを使わない。  
`cache.untrackedEnv` に `INIT_CWD` を書いても、`INIT_CWD` の変化でキャッシュが外れた。

時間は、それぞれ 3 回測った。

- キャッシュが外れたとき: 4.60 秒、3.36 秒、3.37 秒
- キャッシュが当たったとき: 0.41 秒、0.41 秒、0.40 秒
- `vp` を通さずに `astro build && pagefind --site dist` を実行したとき: 4.20 秒、3.10 秒、3.44 秒

## Considered Options

| 選択肢                                                                                                      | 強み                                                                                              | 弱み                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **採用:** コマンドを `apps/web/vite.config.ts` のタスクに置き、package.json の `build` から `vp run` で呼ぶ | 入力から `.astro/` と `dist/` を外せ、キャッシュが当たる。`pnpm run build` のコマンドが変わらない | `vp` がない環境では `pnpm run build` が動かない。外すときは Decision 7 の 3 つを行う                            |
| コマンドを package.json の scripts に置き、`vp run --cache` で実行する（ADR-0003 の Decision 3）            | `vp` がない環境でも `pnpm run build` が同じことをする                                             | 入力から外すファイルを指定できず、2 回目もキャッシュが当たらない                                                |
| タスクを `vite.config.ts` だけに置き、ルートの `build` を `vp run -r build` にする                          | `vp run` を呼ぶだけの script が要らない                                                           | `pnpm --filter @fukuemon/web run build` が動かなくなり、deploy の workflow も変える。外すときに直す箇所が増える |
| タスクの `command` から package.json の script を `pnpm run` で呼ぶ                                         | コマンドが package.json に残り、knip がコマンドを読める                                           | script とタスクが互いを呼び、タスクごとに pnpm の起動を挟む                                                     |
| lint、format、test を Vite+ の同梱のツールに寄せる（ADR-0003 の Decision 2）                                | ツールのバージョンを vite-plus 1 つで上げられる                                                   | vitest 5 と coverage-v8 5 への移行が要る。Oxlint と Oxfmt の設定を `vite.config.ts` に移すことになる            |
| Node.js のバージョンを `vp env` で固定する                                                                  | Vite+ に環境の管理を集める                                                                        | global の CLI が要る。apm、uv、similarity-ts は mise に残り、管理する手段が 2 つになる                          |
| CI で `setup-vp` を使い、タスクのキャッシュを run をまたいで持ち越す                                        | CI の 2 回目から build を縮められる                                                               | `setup-vp` が Node.js を入れ、mise と重なる。持ち越しの手順は experimental で、縮む時間は 3 秒ほど              |

## Consequences

### Positive

- 入力を変えずに build をやり直すと、0.4 秒で終わる。
- `pnpm run build` と `pnpm run check` のコマンドは変わらず、CI と deploy の workflow を変えずに済む。

### Negative

- `vp` がない環境では `pnpm run build` が動かない。外すときは Decision 7 の手順で戻す。
- knip は `run.tasks` のコマンドのうち、knip が知るコマンドだけを読む。`apps/web` の `pagefind` を knip の `ignoreDependencies` に置かないと、使っていない依存として報告される。
- vite-plus が vitest 5 を依存に持つ。vitest を使う package が vitest を自分の devDependencies に宣言しないと、coverage-v8 が vitest 5 に解決されて `test:cov` が失敗する。
- devDependencies の Oxlint、Oxfmt、Vitest と、vite-plus の同梱のバージョンが、別々に上がる。
- 実行する場所や環境変数が変わると、入力が同じでもキャッシュが外れる。

# ADR-0017: Vite+ を、`apps/web` の build のキャッシュ、`apps/playground` の実行、`packages/ui` のテストに限って使う

## Status

提案

## Context

- Vite+ (`vp`) は 2026-07-02 に beta になった。
  - MIT で完全 OSS 化され、有償プラン構想は撤回済み。
  - 単一バイナリが Vite 8 / Vitest / Rolldown / tsdown / Oxlint / Oxfmt / Vite Task を統合し、Node.js runtime と package manager も管理する。
  - 公式の表現は "stable, but not yet complete" で、"complex projects may still need manual follow-up" と留保がつく。
  - 出典: [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta)
- Astro 7 は独自 CLI を持ち、`astro.config.ts` の内側で Vite を構成する meta-framework として動く。
  - Astro 7 は既に内部で Vite 8 + Rolldown を使う。

vite-plus 1.3.0 の `vp run` には、次の制約がある。

- `run.tasks` のタスクは `command` を必ず持つ。同じ名前のタスクを `run.tasks` と package.json の scripts の両方には置けない。
  - 出典: vite-plus 1.3.0 の `docs/config/run.md`（[Run Config](https://viteplus.dev/config/run)）
- package.json の scripts は、`--cache` を付けるとキャッシュされるが、入力から外すファイルを指定できない。
  - `astro build && pagefind --site dist` を `vp run --cache` で 2 回実行すると、2 回目も「modified their inputs」で 0/2 のキャッシュヒットになる。
  - astro build が自分で書く `.astro/` と `dist/` を、入力として読むためである。
- 入力と出力は、実行中のファイルの読み書きから自動で記録する。
  - 出典: vite-plus 1.3.0 の `docs/guide/automatic-data-tracking.md`（[Automatic Data Tracking](https://viteplus.dev/guide/automatic-data-tracking)）

vite-plus 1.3.0 の同梱のツールには、次の事実がある。

- vite-plus 1.3.0 は vitest 5.0.5、oxfmt 0.73.0、oxlint 1.88.0 を同梱する。リポジトリは vitest ^4.1.11、oxfmt ^0.48.0、oxlint ^1.80.0 を宣言する。
- `vp test` は、vite-plus の依存の vitest を先に解決する。
  - 出典: vite-plus 1.3.0 の `docs/guide/test.md`（[Test](https://viteplus.dev/guide/test)）
- GitHub Actions で run をまたいでタスクのキャッシュを持ち越す手順は、experimental とされている。
  - 出典: vite-plus 1.3.0 の `docs/guide/github-actions-cache.md`（[GitHub Actions Cache](https://viteplus.dev/guide/github-actions-cache)）

このリポジトリには、次の事実がある。

- `pnpm-workspace.yaml` の catalog の `vite` は `@voidzero-dev/vite-plus-core` で、`vite` のコマンドを持たない。
  - `vite build` と書くと、ほかの依存が持ち込んだ別のバージョンの vite のコマンドが、ルートの `node_modules/.bin` から動く。
- `packages/ui` のテストは、Vitest のブラウザのモードで動く。`packages/ui/vite.config.ts` は、`vite-plus` の `defineConfig` と `vite-plus/test/browser-playwright` を import する。
  - `packages/ui` は、`@vitest/browser-playwright` 5.0.5 を宣言し、vitest と `@vitest/coverage-v8` を宣言しない。

## Decision

### 1. Vite+ を採り、Astro の dev と build を置き換えない

**`vp dev` / `vp build` で Astro を置き換えない。**  
Vite+ の `dev` / `build` は素の Vite アプリを対象とし、Astro を外側から駆動する方法は存在しない。  
ビルド速度の改善も、Vite+ からは得られない。

`vite-plus` は、`vp` を呼ぶ `apps/web`、`apps/playground`、`packages/ui` の devDependencies に宣言する。

### 2. `apps/web` の build のコマンドを `apps/web/vite.config.ts` のタスクに置く

`astro build` を `build:site` に置く。  
`apps/web/package.json` の `build` の script は、`vp run build:site` だけを実行する。

理由は 2 つある。

- package.json の scripts のままでは、入力から `.astro/` と `dist/` を外せず、キャッシュが当たらない。
- script の名前を `build` のまま残すので、`pnpm run build` と `pnpm --filter @fukuemon/web run build` を CI と deploy からそのまま使える。

`build:site` の出力は `dist/**` と明示する。  
自動の記録は `dist/_astro/` を拾わず、`dist/` を消した後のキャッシュヒットで、HTML だけが戻り資産が欠けた。原因は確認していない。

### 3. build のほかのタスクは、キャッシュに載せない

lint、typecheck、test、knip、ほかのチェックは package.json の scripts に置いたまま、pnpm で実行する。  
`pnpm run check` は pnpm の script をつなぐ形のままにし、その中の build だけがキャッシュを使う。

キャッシュが誤って当たると、チェックは実行されないまま通ったことになる。  
lint、typecheck、test、knip は、手元でどれも 7 秒以内に終わり、キャッシュで縮める時間が小さい。

### 4. `apps/playground` の dev、build、preview は、`vp` で実行する

`apps/playground` は素の Vite のアプリで、dev、build、preview は `vp dev`、`vp build`、`vp preview` で実行する。  
`vite` のコマンドを使わないのは、catalog の `vite` が `vite` のコマンドを持たないためである。

### 5. lint と format は、devDependencies に宣言したバージョンを直接実行する

`vp lint`、`vp fmt`、`vp check` を使わない。  
Oxlint と Oxfmt は devDependencies に宣言したバージョンを、各 package の script から実行する。

`vp lint` と `vp fmt` は設定を `vite.config.ts` の `lint` と `fmt` に置くことを勧める。設定を `.oxlintrc.json` と `.oxfmtrc.jsonc` から移すと、lefthook の pre-commit と CI も変えることになる。

### 6. test は、`packages/ui` だけ `vp test` で実行する

`packages/ui` のテストは `vp test run` で実行し、vite-plus が依存に持つ vitest を使う。  
ほかの package は、`vp test` を使わず、devDependencies に宣言した Vitest を、各 package の script から実行する。

`@vitest/coverage-v8` 4.1.11 は、peer に vitest 4.1.11 を求める。vitest 5 へ上げるには、coverage-v8 も上げ、Vitest 5 への移行の手順に従う必要がある。  
出典: vite-plus 1.3.0 の `docs/guide/test.md`（[Test](https://viteplus.dev/guide/test)）

`vp test` を使わずに vitest を使う package は、vitest を自分の devDependencies に宣言する。  
宣言しないと、`@vitest/coverage-v8` が vite-plus の依存の vitest 5 に解決され、`test:cov` が失敗する。

### 7. package manager は pnpm を直接実行する

`vp install` を使わない。  
pnpm のバージョンは `package.json` の `packageManager` で固定しており、`vp install` に任せて得るものがない。

### 8. CI は pnpm の script を実行し、タスクのキャッシュを持ち越さない

CI は、`pnpm run check` と `pnpm --filter @fukuemon/web run build` を実行する。`vp` は devDependency のものを、package の script が呼ぶ。  
`voidzero-dev/setup-vp` は使わない。Node.js を入れるので、mise と役割が重なる。  
`node_modules/.vite/task-cache` を run をまたいで持ち越さない。手順が experimental で、キャッシュが外れたときの build は 4 秒ほどで終わる。

### 9. 撤退の手段を確保する

Astro の入力は `src/content/**` / `astro.config.ts` / `public/**` / 依存 package の成果物で、外から入力集合が自明でない。  
**キャッシュの誤ヒットは「更新したページが出ない」形で表面化し、検知が遅れる。**

`vite-plus` か Astro を上げるときと、タスクを変えるときに、次を確認する。

1. `apps/web/src/content/` のファイルを 1 つ変更して、build がキャッシュミスすること
2. `packages/ui` のトークンを変更して、`apps/web` の build がキャッシュミスすること
3. 何も変更せずに 2 回目がキャッシュヒットすること

満たさない場合、キャッシュを無効化するか Turborepo へ切り替える。  
Turborepo は `outputs` / `inputs` を明示宣言する方式のため、入力推論の不確かさを持たない。

`apps/web` から Vite+ を外すときは、次の 3 つを行う。

- `apps/web/package.json` の `build` を `astro build` に戻す。
- `apps/web/vite.config.ts` を消す。
- `apps/web` の devDependencies から `vite-plus` を消す。

## 承認の条件

次の変更は、承認した決定を、コードの今の使い方に合わせて変える。  
利用者が、この変更を承認する。

- Decision 4: Vite+ を使う範囲に、`apps/playground` の dev、build、preview を足す。
- Decision 6: `vp test` を使わない決定を、`packages/ui` だけ `vp test` で実行する形に変える。`packages/ui` が `vp test` を使う理由は、文書とコミットに無いので、Context には事実だけを書いた。
- Decision 1: `vite-plus` を宣言する package を、`apps/web` の 1 つから、`apps/web`、`apps/playground`、`packages/ui` の 3 つにする。
- Decision 2 と Decision 9: `pagefind --site dist` を実行するタスク `build:search` を外す。本文の検索と Pagefind の索引を最初は作らないことは、ADR-0030 が決めている。
- Decision 9: 3 つの条件を確認する時期を、実装のときから、`vite-plus` か Astro を上げるときと、タスクを変えるときに変える。2 つ目の条件の対象を、`packages/design-system/` から `packages/ui` に変える。

次の 4 つは、決定を変えないが、利用者が読んで判断する。

- Context と Verification の事実は、vite-plus 1.3.0 で確認したものである。`pnpm-workspace.yaml` の catalog は 1.4.0 で、1.4.0 では確認し直していない。
- Decision 4 と Decision 6 は、比べた案の記録が無い。
- Decision 9 の外す手順は、`apps/web` の分だけである。`apps/playground` と `packages/ui` から Vite+ を外す手順は、決めていない。
- Considered Options の Turborepo の行と「Vite+ を採用しない」の行は、比べたときの文のまま残した。
  - 弱みのうち、Node.js のバージョンの固定、package manager の管理、lint と format の同梱は、Decision 5、Decision 7、ADR-0011 で使わないと決めたものである。

## Verification

`pnpm --filter @fukuemon/web run build` を、キャッシュを消してから続けて実行して確認した。  
macOS の手元の結果で、CI の Linux では確認していない。  
確認したのは vite-plus 1.3.0 で、`pagefind --site dist` を実行するタスク `build:search` が `build:site` に依存していたときである。

- `apps/web/src/content/` の原稿を 1 つ変えると、`build:site` が原稿の変更でキャッシュを外し、`build:search` も実行し直す。
- `packages/design-system/styles/tokens.css` を変えると、`build:site` が `tokens.css` の変更でキャッシュを外し、`build:search` も実行し直す。
- 何も変えずに 2 回目を実行すると、2/2 のキャッシュヒットになる。
- `apps/web/dist/` を消してから実行すると、`build:site` がキャッシュから `dist/` を戻し、ファイルの一覧が build の直後と一致する。

Decision 9 の 3 つの条件は、このときの構成で満たした。  
2 つ目の条件で確認したのは `packages/design-system` のトークンで、`packages/ui` のトークンでは確認していない。

環境変数も、キャッシュの指紋に入る。  
ルートの `pnpm run build` と `pnpm --filter @fukuemon/web run build` は、pnpm が渡す `INIT_CWD` と `PATH` が違うので、互いのキャッシュを使わない。  
`cache.untrackedEnv` に `INIT_CWD` を書いても、`INIT_CWD` の変化でキャッシュが外れた。

時間は、それぞれ 3 回測った。

- キャッシュが外れたとき: 4.60 秒、3.36 秒、3.37 秒
- キャッシュが当たったとき: 0.41 秒、0.41 秒、0.40 秒
- `vp` を通さずに `astro build && pagefind --site dist` を実行したとき: 4.20 秒、3.10 秒、3.44 秒

## Considered Options

Vite+ の採否の選択肢は次のとおり。

| 選択肢                                   | 強み                                                                                                                                                                                                           | 弱み                                                                                                                                               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **採用:** Vite+ を、範囲を限って採用する | Vite+ は Vite 8 / Vitest / Oxlint を同梱し、package manager は pnpm / npm / Yarn / Bun を wrap する。代替は Turborepo / Nx / pnpm scripts                                                                      | Vite+ は 2026-07-02 に出た beta で、"stable, but not yet complete" という公式の留保がある。撤退の手段 (Decision 9) を確保した上で採用する          |
| Turborepo を採用する                     | `outputs` / `inputs` の明示宣言によりキャッシュの入力が自明になり、Astro の build でも誤ヒットの不確かさがない。実績が長い。2.9.x を別のプロジェクトで運用している。動作要件は Node.js のみ。代替は Vite+ / Nx | Node.js runtime と package manager の管理、lint / format / test の同梱が得られず、別途ツールを入れることになる。Vite+ を入れた場合と役割が重複する |
| Vite+ を採用しない (pnpm scripts のみ)   | beta のツールに依存しない                                                                                                                                                                                      | Node.js の固定に mise 等を別途入れることになる。タスクのキャッシュが得られない                                                                     |

タスクのコマンドを書く場所と、同梱のツールを使うかの選択肢は次のとおり。

| 選択肢                                                                                                      | 強み                                                                                              | 弱み                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **採用:** コマンドを `apps/web/vite.config.ts` のタスクに置き、package.json の `build` から `vp run` で呼ぶ | 入力から `.astro/` と `dist/` を外せ、キャッシュが当たる。`pnpm run build` のコマンドが変わらない | `vp` がない環境では `pnpm run build` が動かない。外すときは Decision 9 の 3 つを行う                            |
| コマンドを package.json の scripts に置き、`vp run --cache` で実行する                                      | `vp` がない環境でも `pnpm run build` が同じことをする                                             | 入力から外すファイルを指定できず、2 回目もキャッシュが当たらない                                                |
| タスクを `vite.config.ts` だけに置き、ルートの `build` を `vp run -r build` にする                          | `vp run` を呼ぶだけの script が要らない                                                           | `pnpm --filter @fukuemon/web run build` が動かなくなり、deploy の workflow も変える。外すときに直す箇所が増える |
| タスクの `command` から package.json の script を `pnpm run` で呼ぶ                                         | コマンドが package.json に残り、knip がコマンドを読める                                           | script とタスクが互いを呼び、タスクごとに pnpm の起動を挟む                                                     |
| lint、format、test を Vite+ の同梱のツールに寄せる                                                          | ツールのバージョンを vite-plus 1 つで上げられる                                                   | vitest 5 と coverage-v8 5 への移行が要る。Oxlint と Oxfmt の設定を `vite.config.ts` に移すことになる            |
| CI で `setup-vp` を使い、タスクのキャッシュを run をまたいで持ち越す                                        | CI の 2 回目から build を縮められる                                                               | `setup-vp` が Node.js を入れ、mise と重なる。持ち越しの手順は experimental で、縮む時間は 3 秒ほど              |

Turborepo は撤退の手段として残す。  
Decision 9 の条件を満たさなければ、Turborepo へ切り替える。

## Consequences

### Positive

- 入力を変えずに build をやり直すと、0.4 秒で終わる。
- `pnpm run build` と `pnpm run check` のコマンドは変わらず、CI と deploy の workflow を変えずに済む。

### Negative

- `vp` がない環境では `pnpm run build` が動かない。外すときは Decision 9 の手順で戻す。
- beta のツールを toolchain の中心に置く。
  - 撤退の手段で緩和するが、`vp` の破壊的変更に追従する手間は残る。
- vite-plus が vitest 5 を依存に持つ。`vp test` を使わずに vitest を使う package が vitest を自分の devDependencies に宣言しないと、coverage-v8 が vitest 5 に解決されて `test:cov` が失敗する。
- devDependencies の Oxlint、Oxfmt、Vitest と、vite-plus の同梱のバージョンが、別々に上がる。
- 実行する場所や環境変数が変わると、入力が同じでもキャッシュが外れる。

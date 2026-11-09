# 開発の準備

必要なツールは mise、pnpm、python3 である。
Node.js、uv、apm、similarity-ts は `mise.toml` にバージョンが書いてあり、`mise install` が入れる。
pnpm のバージョンは `package.json` の `packageManager` にある。
python3 は、lefthook の `protected-branch` のフックが使う。

```sh
mise install
pnpm install
```

`pnpm install` は、`prepare` で lefthook の Git のフックを入れる。

スキルとフックは apm で配置し、Git で追跡しない。clone した後の最初のセッションで、セッションの開始のフックが配置する。手で配置するときは次を実行する。

```sh
apm install --frozen
```

`apm install` の後に配置先を `.gitignore` に足す post-install は、マシンごとに 1 度信頼させる。

```sh
apm lifecycle trust
```

## 文書を直すとき

文章の規則は textlint で、経緯の混入とリンクは docs のスクリプトで確認する。指摘された語は言い換え、`--fix` は使わない。

```sh
pnpm exec textlint <直した Markdown>
pnpm exec textlint --config apps/web/src/content/.textlintrc.json <直した原稿>
node .claude/hooks/docs/hooks/check-history.mjs
node .claude/hooks/docs/hooks/check-links.mjs --exclude apps/web/src/content/
```

- サイトの原稿（`apps/web/src/content/` の `.md` と `.mdx`）には、原稿の設定を `--config` で渡す。原稿の設定は、`.mdx` を読むプラグインを持つためである。
- リンクのチェックは、原稿を対象にしない。原稿はサイト内の URL でリンクするためである。
- 既存の文書には textlint の指摘が残っている。直した文書だけに掛け、CI も pull request で変えた Markdown だけを見る。

`verified_commit` の後に実装が変わった文書は、`node .claude/hooks/docs/hooks/list-drift.mjs` で一覧する。実装と読み比べてから `verified_commit` を進める。

## コミットするとき

コミットと push の前に、lefthook が次を実行する。設定は `lefthook.yml` にある。

- 保護するブランチへの直接のコミットと push を止める。
- ステージしたファイルに Oxfmt を掛け、整形した結果をステージし直す。
  - Oxfmt の設定は `.oxfmtrc.jsonc` にある。
- ステージした Markdown に textlint を掛ける。原稿には原稿の設定を使う。
- commit-msg のフックで、`ticket-number` が issue 番号をメッセージに足す。
  - ブランチの名前が `feature/<issue 番号>` で、1 行目に `#<issue 番号>` がないときに、1 行目の末尾へ足す。
- commit-msg のフックで、commitlint がメッセージの形式を確認する。規則は `commitlint.config.mjs` にある。

- 変更の分け方とメッセージの書き方は、スキル write-commit に従う。

## ブランチとリリース

ブランチは、`develop` と作業用のブランチにする。

- `develop` は GitHub のデフォルトのブランチで、本番に配信している状態を指す。
- 作業用のブランチは `develop` から切る。名前は `<種別>/<内容>` にする。
  - 例: `fix/pnpm-run-args`、`docs/fix-doc-facts`、`chore/add-agent-playbooks`
- `develop` へは pull request を通してマージし、直接はコミットしない。
  - lefthook のフックが、`develop` への直接のコミットと push を止める。
- `develop` にマージすると、check workflow が `develop` で通った後に、deploy workflow が本番へ配信する。
- バージョンとタグは付けない。

作業用のブランチを `develop` にマージするたびに、本番へ配信する。

```mermaid
%%{init: {"gitGraph": {"mainBranchName": "develop"}}}%%
gitGraph
    commit id: "配信 1"
    branch "fix/pnpm-run-args"
    checkout "fix/pnpm-run-args"
    commit id: "fix-1"
    checkout develop
    branch "docs/fix-doc-facts"
    checkout "docs/fix-doc-facts"
    commit id: "docs-1"
    checkout develop
    merge "fix/pnpm-run-args" id: "PR をマージし、配信 2"
    merge "docs/fix-doc-facts" id: "PR をマージし、配信 3"
```

## issue と pull request

- 作業は issue から始める。pull request は 1 つの issue に対応させる。
  - issue は、issue テンプレートの要求、不具合と、設計、実装、検証、文書の 4 つのタスクから選ぶ。
  - 要求は、テンプレートの「種別」で、`context/project.yml` の `process.presets` の種別を 1 つ選ぶ。種別で、行うプロセスと、子のタスクの種類が決まる。
- 種類のラベルは、テンプレートが付ける。

  | 種類         | ラベル              |
  | ------------ | ------------------- |
  | 要求         | `type:requirements` |
  | 不具合       | `type:bug`          |
  | 設計のタスク | `type:design`       |
  | 実装のタスク | `type:impl`         |
  | 検証のタスク | `type:verify`       |
  | 文書のタスク | `type:docs`         |

- 題と本文の書き方は、スキル write-issue-pr に従う。

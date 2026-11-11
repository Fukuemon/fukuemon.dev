---
type: context
title: エビデンス
description: エビデンスを付ける変更、元のファイルの置き場と公開の範囲、撮影の手段、撮る環境、ログインとテストデータ、pull request への添付とスレッドと本文の更新の仕方、検証のシナリオの置き場
status: draft
---

# エビデンス

## Evidence Scope

<!-- エビデンスを付ける変更と付けない変更。例: 機能の追加と改修には付け、文書と設定だけの変更には付けない。issue に付けてよいもの -->

## Storage and Visibility

<!-- 撮った元のファイルを、入れ終えた後に消すか。置き場を既定の .ai-out/evidence から変えるときは、context/project.yml の verification.evidence_dir に書く。pull request の動作確認の下書きの根を、既定の <verification.evidence_dir>/prs から変えるときは、その根。上げた動画を見られる人の範囲と、写してよいデータ。ログインの値とトークンの扱い -->

## Capture Tools

<!-- 撮影の手段。ブラウザを操作するツール、録画と字幕を重ねる仕組み（写した撮影の config と字幕の関数の置き場）、見本の spec、spec の配置先と名前、撮るコマンドと project、viewport。pull request の動作確認の spec を下書きの根から流す方法（撮影の config のテストのディレクトリ、型のチェックと lint の対象）と、そこから字幕の関数とモックを import するパス。回帰の E2E が張るモックの関数 -->

カタログ（packages/ui の Storybook）は、Playwright の録画と字幕で撮る。
仕組みはスキル playwright-capture から写した。

| もの          | 置き場                                          |
| ------------- | ----------------------------------------------- |
| E2E の config | `packages/ui/e2e/playwright.config.ts`          |
| 撮影の config | `packages/ui/e2e/playwright.capture.config.ts`  |
| 字幕の関数    | `packages/ui/e2e/fixtures/caption.ts`           |
| 見本の spec   | `packages/ui/e2e/specs/catalog.spec.ts`         |
| 撮影の出力    | `packages/ui/e2e/evidence/`（Git で追跡しない） |

- 撮るコマンドは `pnpm --filter @fukuemon/ui capture` で、project は chromium の 1 つである。
- 録画と viewport は 1600x900 にそろえる。
  project の `use` は config の `use` より優先され、`devices["Desktop Chrome"]` の 1280x720 が適用される。
  撮影の config は、各 project の `use` に viewport を足す。
  足さないと、画面が動画の左上に 8 割の大きさで描かれ、右と下に余白が出る。
- spec は story の画面（`iframe.html?id=<story の id>&viewMode=story`）を開く。テーマは URL の `&globals=theme:dark` で選ぶ。
- pull request の動作確認の spec は、下書きの置き場のディレクトリを環境変数 `SPECS_DIR` に渡して流す。

## Capture Environment

<!-- 撮るときに起動するもの。起動と停止のコマンド、ポート、URL と環境変数、テストと分けるための設定、改修前と改修後を並べて起動する方法。pull request の head を配信した URL を E2E の config の baseURL に渡す方法と、base を配信した URL を渡す環境変数 BASE_URL。検証環境があれば、その URL と呼び名 -->

- E2E の config は、Storybook を静的にビルドし、`vite preview` でポート 6126 に配信してから流す。
- 環境変数 `BASE_URL` を渡すと、配信を立てずに、その URL のカタログを撮る。改修前のカタログは、別の worktree でビルドして別のポートで配信し、その URL を渡す。

## Login and Test Data

<!-- 撮るときのログインの仕方とアカウント、テストデータの作り方と片付け方。ログインの状態を保存する setup の project と、保存したファイルの置き場。認証コードを求められたときの扱い -->

## Attachment

ファイルは、gh の `--attach` で pull request の会話のコメントに上げる。
gh の振る舞いのうちリポジトリによらないものは、capture-pull-request の `references/attach-with-gh.md` にある。
参照の書き換え、同じファイルを 2 度渡したとき、一部のファイルが失敗したとき、`-F` での本文の置き換えが当たる。
ここには、fukuemon.dev の値と、スキルの手順と違う点を書く。

`--attach` は gh の 2.99 以降にある。
先に `gh pr comment --help` に `--attach` があるかを確認し、無ければ `mise which gh` のパスの gh を使う。

上げるには、gh でログインしたアカウントが、pull request にコメントを書け、本文を編集できる権限（リポジトリへの書き込みか、自分が作った pull request）を持つ。
リポジトリは public なので、上げた動画は誰でも見られる。録画に写してよいのは、story のダミーのデータだけである。

上げられるファイルの大きさの上限は、GitHub の文書の [Attaching files](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files) で確認する。
超えるときは、観点を分けて短く撮り直す。
コメントと本文の文字数の上限は、GitHub の文書の [Repository limits](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits) の Text limits で確認する。

### スキルの手順と違う点

- スレッドは、pull request の会話のコメントで作る。
  - 観点ごとの返信に分けず、観点の表、撮った条件、観点ごとの判定の値と `<details>` を、まとまりごとに 1 件のコメントにまとめる。
  - 上限を超えるときと、一部の観点だけを撮り直したときだけ、コメントを足す。足すコメントの先頭に、最初のコメントへのリンクを書く。
- 本文には、スキルの `pr-video-section.md` と `scripts/update-pr-body.mjs` を使わない。
  - pull request のテンプレートの `## 検証とエビデンス` に、条件、期待結果、確認の方法、結果、エビデンスの表を並べる。動画は、表の「エビデンス」の列のセルに書く。

### 載せる順

1. 観点のまとまりごとに、スレッドの下書きを `.ai-out/evidence/prs/<番号>/thread-<番号>-<話題>.md` に書く。
   - 先頭に、観点の表と撮った条件（撮ったコミット、viewport、データ）を置く。
   - 観点ごとに、判定の値と、spec と実行の出力の `<details>` を置く。
   - 動画は、表の「エビデンス」の列のセルに、1 本ずつ次の形で書く。`<details>` は閉じて出て、開くとその場で再生できる。

     ```html
     <details>
       <summary><観点名> 改修後の動画</summary>
       <video src="<URL>" controls muted></video>
     </details>
     ```

   - 下書きでは、動画の参照を、リポジトリのルートからの相対パスで `![<名前>](./.ai-out/evidence/prs/<番号>/videos/<フォルダ>/<ファイル>.mp4)` にし、`--attach` に渡す。投稿した後に、控えた動画の URL を `<video>` の `src` に書き、同じコメントを書き換える。
     - 動画を `<video src="./.ai-out/...">` のまま渡さない。`--attach` は `<video>` の `src` を書き換えず、動画は、名前の無い URL だけの行で、コメントの末尾に足される。

2. 利用者が下書きを確認してから、コメントを投稿する。
3. 投稿したスレッドを pull request の画面で確認する。直す点があれば、同じコメントを書き換える。
4. スレッドの動画の URL を、本文の「検証とエビデンス」の表に並べる。
   - 表の上に、スレッドのコメントへのリンクを置く。

### コメントを投稿する

- リポジトリのルートで、`gh pr comment <番号> -F <下書き> --attach <動画> --attach <動画>` を流す。
- `gh pr comment` は、投稿したコメントの URL（`https://github.com/Fukuemon/fukuemon.dev/pull/<番号>#issuecomment-<ID>`）を標準出力に出す。URL と、末尾の `<ID>` を控える。書き換えと本文のリンクに使う。
  - コメントの一覧の最後の 1 件から ID を取らない。投稿の間に別のコメントが入ると、別のコメントを書き換える。
- 投稿したコメントを書き換えるときは、取ったコメントの本文を直して、控えた ID で書き戻す。
  - `gh api -X PATCH repos/Fukuemon/fukuemon.dev/issues/comments/<ID> -F body=@<直した本文>`
  - 動画を差し替えるときは、「撮り直したとき」の手順に従う。
- 一部のファイルが上がらなかったときは、同じコメントを投稿し直さず、スレッドに足すコメントで上げる。
- 動画を `<video src="./.ai-out/...">` のまま投稿したときも、同じコメントを投稿し直さない。末尾の URL と動画を、ファイルの大きさで対応させてから、`<video>` の `src` を書き換える。
  - 各 URL から取得したファイルの大きさを `curl -sL <URL> | wc -c` で数え、元の動画の大きさを `wc -c < <ファイル>` で数えて比べる。

### 本文に並べる

- 今の本文を `gh pr view <番号> --json body -q .body` で `.ai-out/evidence/prs/<番号>/pr-body.orig.md` に取り、「検証とエビデンス」の表だけを直す。
  - スレッドの下書きから本文を作り直さない。画面で直した本文が消える。
- 「エビデンス」の列に、スレッドの動画を「載せる順」の `<details>` と `<video>` の形で書く。
  - 表のセルの中では、URL だけの行と `![<名前>](<URL>)` の動画は再生できない。`<video>` のタグなら再生の枠になる。
- 本文は `gh pr edit <番号> -F <本文>` で書き戻し、`--attach` は渡さない。
- 本文が上限を超えたら、表を本文に残し、`<details>` の中身はスレッドにだけ置く。

### 撮り直したとき

- 一部の観点だけを撮り直したときは、撮り直した観点の動画を、スレッドに足すコメントで投稿する。
  コメントに、撮り直した観点と理由を書く。
  - 利用者が確認してから、本文の表のその観点の `<video>` の `src` だけを、足したコメントの動画の URL に書き換える。
- 見た目や構造を大きく見直したときは、元のコメントを書き換える。
  足すコメントで済ませない。
  - 元のコメントの動画、判定の値、spec、実行の出力、撮った条件（撮ったコミット）を、撮り直したものに書き換える。
  - 動画は、一時のコメントに `--attach` で上げ、その URL を元のコメントの `<video>` の `src` に書く。
    元のコメントで動画が再生できることを確認してから、一時のコメントを 1 件ずつ削除する。
  - 削除した後に、元のコメントと本文の表の動画の URL を、ログインなしで取得できることを確認する。
    取得できなければ、動画を上げ直して URL を差し替える。
  - 本文の動画とリンクの表を、元のコメントに向ける。
    撮り直したことを知らせる短いコメントを 1 件だけ足し、元のコメントへのリンクを並べる。

### 入ったことを確認する

コメントと本文の、上げた先の URL の数と、書き換わらずに残った参照の数を数える。

```sh
gh api repos/Fukuemon/fukuemon.dev/issues/comments/<ID> --jq .body | grep -o 'github.com/user-attachments/assets/' | wc -l
gh api repos/Fukuemon/fukuemon.dev/issues/comments/<ID> --jq .body | grep -c '](\./\.ai-out/'
gh api repos/Fukuemon/fukuemon.dev/pulls/<番号> --jq .body | grep -o 'github.com/user-attachments/assets/' | wc -l
gh api repos/Fukuemon/fukuemon.dev/pulls/<番号> --jq .body | grep -c '](\./\.ai-out/'
```

- コメントの 1 つ目の数が、そのコメントに上げたファイルの数と合い、本文の 1 つ目の数が、スレッドから並べた URL の数と合う。
- 2 つ目がどちらも 0 になる。
- pull request の画面にログインして開き、閉じた `<details>` が出て、開くと再生できることを確認する。ログインしていない画面では、動画はリンクで出る。

### コメントの動画を本文に移す

過去の pull request のコメントに付けた動画は、上げ直さずに、URL を本文の表へ移す。

1. エビデンスのコメントを取る。

   ```sh
   gh api --paginate repos/Fukuemon/fukuemon.dev/issues/<番号>/comments --jq '.[] | select(.body | test("user-attachments")) | {id, html_url, body}'
   ```

2. コメントの本文から `https://github.com/user-attachments/assets/<ID>` の URL を取り、「本文に並べる」の手順で表の「エビデンス」の列に書く。
3. 「入ったことを確認する」の本文の数が、移した URL の数と合うことを確認する。

## Verification Scenarios

<!-- 検証のシナリオを使うときだけ書く。シナリオのファイルの置き場、spec の置き場の根、エビデンスの置き場の根、改修前と違ってよい差の文を置くファイル。エビデンスの格納先と、格納先のフォルダの名前の決まり（シナリオの識別子、要求の issue、アクター、番号、シナリオ名の並べ方）、エビデンスの一覧の置き場。撮る URL、改修前の URL、実施日、環境の名前を渡す環境変数。シナリオの実施の結果を記録する場所（シナリオごとの pull request など）と、そこに書く例の列と値の形。シナリオを直すときに直す場所（ブランチ）と、記録する場所へ転記した文の扱い -->

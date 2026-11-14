# ADR-0071: コードを動かす画面の文字を端末で分けず、iOS と iPadOS の入力時の拡大を viewport の指定で止める

## Status

承認

## Context

コードを動かす画面を、スマートフォンと記事の埋め込みで操作しやすくするために、エディタの文字の大きさと、入力時の拡大の扱いを決める必要がある。

- 13px にしてよい文字にコードを含め、等幅の 13px のトークンを `text-code-compact` にすると決めている。触る端末の押せる領域も、同じ ADR が決める。
  - ADR-0062: [コードを動かす画面だけ、文字を 12px と 13px まで小さくし、押せる領域をマウスで押す端末は 24×24 CSS px、触る端末は 44×44 CSS px にする](0062-dense-text-and-targets-in-playground.md)
- 今のエディタは、ADR-0062 の `text-code-compact` でなく、`text-code`（16px）で描いている。
- iOS の Safari は、16px 未満の文字の入力欄にフォーカスすると、ページを拡大する。iOS と iPadOS のほかのブラウザも WebKit で描くので、同じく拡大する見込みである（未確認）。
- iPadOS の Safari は、標準の設定でデスクトップの Safari と同じ UA を名乗る（Apple の文書は読んでいない。未確認）。
- viewport の指定に `maximum-scale=1` を足すと、iOS 10 からの Safari は、フォーカスしたときの自動の拡大だけを止め、ピンチズームは止めない。Android の Chrome は、ピンチズームも止める。
  - 出典: [Preventing iOS Textbox Auto Zooming and ViewPort Sizing（Rick Strahl's Weblog）](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing)
- iframe の中の viewport の指定は、外のページの拡大を変えない見込みである（未確認）。
- 記事は、ツールのページを iframe で埋め込み、cross-origin isolation のヘッダを、その記事の URL にも返す。
  - ADR-0034: [cross-origin isolation のヘッダを、プレイグラウンドの Node の実行環境のパスと、それを埋め込む記事の URL にだけ返す](0034-playground-origin-and-embedding.md)
- Node の実行環境が対応するブラウザは、デスクトップの Chrome と Edge である（`apps/playground/DesignDoc.md`）。iPhone で Node の端末を使えるかは未確認である。

## Decision

文字は端末で分けずに 13px と 12px にし、エディタも `text-code-compact`（13px）にする。  
iOS と iPadOS の入力時の拡大は、iOS と iPadOS のときだけ viewport の指定で止める。

- 文字の大きさは、触る端末とマウスで押す端末で分けない。
  - エディタは、`text-code`（16px）から `text-code-compact`（13px）にする。ADR-0062 が、13px の等幅をエディタに使うと決めているためである。
- iOS と iPadOS の WebKit のブラウザのときだけ、ページの読み込みの初めに、viewport の指定へ `maximum-scale=1` を足す。
  - iPadOS の Safari は、デスクトップの Safari と同じ UA を名乗る。UA の文字列だけでは見分けない。
  - Android では足さない。Android の Chrome はピンチズームも止め、拡大して読む利用者が読めなくなるためである。
- 実行環境を埋め込んだ記事のページにも、同じ指定を iOS と iPadOS のときだけ足す。iframe の中の指定は、記事のページの拡大を変えない見込みのためである。
- iOS と iPadOS を見分ける関数は、ツールのページと記事のページの両方が依存する `packages/ui` に 1 つ置く。見分け方を 1 か所で確認できるようにするためである。
  - 関数は、React に依存させず、`@fukuemon/ui/button-class-name` と同じくサブパスの export にする。読み込みの初めのスクリプトが、React のコンポーネントを import せずに済むようにするためである。
- 実機で拡大が止まらなければ、viewport の指定をやめる。代わりに、触る端末では、フォーカスを受ける入力の要素（エディタ、入力欄、端末の入力）の文字を 16px にする形に、この ADR を書き直す。

## 承認の条件

- 実機の iPhone の Safari で、SQL と Go のツールのエディタ（CodeMirror）と入力欄にフォーカスしても、ページが拡大しないこと。Node のツールが起動したときは、端末の入力でも拡大しないこと。
- 同じ端末で、実行環境を埋め込んだ記事のページを開き、iframe の中のエディタと入力欄にフォーカスしても、記事のページが拡大しないこと。
- 同じ端末で、ツールのページと記事のページの両方を、ピンチズームで拡大できること。
- 実機の iPad の Safari（デスクトップの UA を名乗る設定）を iPadOS と見分けて指定を足し、上の 3 つの条件を iPad でも満たすこと。Mac の Safari には指定を足さないこと。
- Safari のほかの WebKit のブラウザとして、iPhone の Chrome でも拡大しないこと。
- iPhone の Chrome と、アプリの中のブラウザ（WKWebView）の 1 つで、ツールのページと記事のページの両方を、ピンチズームで拡大できること。拡大できなければ、Decision の最後の項目のとおり、入力の要素を 16px にする形に書き直す。

## Considered Options

| 選択肢                                                           | 強み                                   | 弱み                                                                             |
| ---------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| **採用:** 文字は 13px にし、iOS の拡大を viewport の指定で止める | 文字の大きさを保てる。拡大の操作は残る | iOS と iPadOS を見分けるスクリプトを、ページの初めに置く。拡大が止まるかは未確認 |
| 触る端末だけ、エディタを 16px にする                             | 指定を足さずに iOS の拡大が起きない    | エディタだけ周りの文字より大きくなり、1 行に入る文字が減る                       |
| viewport の指定を、どの端末にも足す                              | スクリプトが要らない                   | Android でピンチズームが止まる                                                   |

## Consequences

### Positive

- iOS と iPadOS で、エディタと入力欄にフォーカスしても、ページが拡大しない見込みである。

### Negative

- iOS と iPadOS を見分けて指定を足す処理を、ツールのページと記事のページの読み込みの初めに置く。

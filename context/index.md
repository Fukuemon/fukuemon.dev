# context の目次

作業の中で参照する、このリポジトリの規約と事実。変更をマージするまでの手順は [CONTRIBUTING.md](../CONTRIBUTING.md) にある。

- [コードベースの構造](codebase.md) — package とディレクトリの境界、依存規約 1〜5 と island の規約、状態の置き場、新しいコードと package の置き場、URL の規約。コードから読み取れる構造は書かない
- [コードと文書の規約](conventions.md) — コンポーネントの命名、コメントに書くこと、文書と記事の書き方のうちこのリポジトリだけの規則、共有の設定とチェックの実行点、自動チェックの除外。lint で検出できる規則は書かない
- [業務の知識](domain.md) — コンテンツ、種別、contentId、関連、手順、実行パネルなどの用語と、コードの識別子との対応。状態と不変条件は概念ごとに domain/ に置く
- [コンテンツ](domain/content.md) — 記事とハンズオンに共通する、公開の状態の遷移、contentId と関連の不変条件、著者がしてはいけないこと
- [ハンズオン](domain/hands-on.md) — 手順と進捗の遷移、手を動かす場所ごとにページに出るもの、実行環境の不変条件、著者と開発者がしてはいけないこと
- [基盤と運用](operations.md) — 本番だけの環境、Terraform と Wrangler の管轄、deploy と apply の条件、レスポンスヘッダ、観測点、state を失ったときの戻し方、credential の 2 系統と置き場（draft）
- [技術スタック](tech-stack.md) — 採用しているツールの役割とバージョンの所在、使わないツール、Vite+ の取り決め、バージョンの更新の確認、新しい package の作り始め。バージョンそのものと選んだ理由は書かない（draft）
- [テスト](testing.md) — テストの種類ごとに保証すること、カバレッジを求める対象、E2E と見た目の回帰の範囲、実行に要る環境、テストの書き方と変更ごとに足すテスト（draft）
- [E2E のテスト](testing/e2e.md) — E2E のテストのツールでの書き方、testid の名前、lint の規則に渡す値、流すコマンドと環境、テストデータ、待つ時間の決め方（draft）
- [エビデンス](testing/evidence.md) — エビデンスを付ける変更、元のファイルの置き場と公開の範囲、撮影の手段、撮る環境、ログインとテストデータ、pull request への添付とスレッドと本文の更新の仕方、検証のシナリオの置き場（draft）

## Design Doc

- [fukuemon.dev PRD](../docs/PRD.md) — 訪問者がコードを書いて動かしながら、技術の仕組みを体系的に学べる個人の技術サイト。記事、シリーズ、記事に埋め込む図と実行環境、プレイグラウンドを提供する（draft）
- [fukuemon.dev Design Doc](../docs/design/DesignDoc.md) — 記事とシリーズの静的サイト、カタログ、ドキュメントサイトの全体像。C4 の L2、モジュールの責務と依存、ホスト名と URL の構成、設計不変量、サイト全体の動きの規則とトップの庭の例外、条件つきで足す機能の形（draft）
- [キャンバス](../docs/design/features/canvas/DesignDoc.md) — draw.io と Excalidraw のツールのパスとページの構成、IndexedDB に保存する図の形、図の一覧の画面、保存と書き出しの流れ、記事の図の置き場と書き方、記事の図をキャンバスで開く流れ（draft）
- [トップの水墨の門と立体の庭](../docs/design/features/top-garden/DesignDoc.md) — トップの最初の訪問のイントロの各段の時間、季節と時間帯の決め方、時間帯ごとと季節ごとの場面の色、和紙の文の幅と行間と余白、庭の中のボタンの並び、試作のファイル（draft）
- [プレイグラウンド](../docs/design/features/playground/DesignDoc.md) — apps/playground の構成とパス、ディレクトリ、実行環境のインターフェースの型、状態の置き場、プロジェクトと保存の形、起動の流れ、SQL を送る形式（draft）
- [基盤](../infra/DesignDoc.md) — Cloudflare の基盤を Terraform で持つ構成。bootstrap と本体の分け方、R2 の state backend の設定と理由、deploy と apply の流れ
- [Content Model](../packages/content-model/DesignDoc.md) — 記事とハンズオンに共通する schema、安定識別子 contentId、相互参照のグラフ、ContentRef への正規化、loader との結線
- [挿絵](../packages/ui/src/art/DesignDoc.md) — 挿絵を置く場所、版画風の挿絵の図柄と版の仕様、色と濃さのトークン、動きの層、生成器と ArtBand の使い方
- [デザインシステム（packages/ui）](../packages/ui/DesignDoc.md) — 自前の値のトークンの層とテーマ、コードと HTTP の流れの色、Base と Case のコンポーネントの範囲、Storybook のカタログ、DADS から外れる点

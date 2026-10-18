# context の目次

作業の中で参照する、このリポジトリの規約と事実。変更を取り込むまでの手順は [CONTRIBUTING.md](../CONTRIBUTING.md) にある。

- [コードベースの構造](codebase.md) — package とディレクトリの境界、依存規約 1〜5 と island の規約、状態の置き場、新しいコードと package の置き場、URL の規約。コードから読み取れる構造は書かない
- [コードと文書の規約](conventions.md) — コンポーネントの命名、コメントに書くこと、文書と記事の書き方のうちこのリポジトリだけの規則、共有の設定とチェックの実行点、自動チェックの除外。lint で検出できる規則は書かない
- [業務の知識](domain.md) — コンテンツ、種別、contentId、関連、手順、実行パネルなどの用語と、コードの識別子との対応。状態と不変条件は概念ごとに domain/ に置く
- [コンテンツ](domain/content.md) — 記事とハンズオンに共通する、公開の状態の遷移、contentId と関連の不変条件、著者がしてはいけないこと
- [ハンズオン](domain/hands-on.md) — 手順と進捗の遷移、手を動かす場所ごとにページに出るもの、実行環境の不変条件、著者と開発者がしてはいけないこと
- [基盤と運用](operations.md) — 本番だけの環境、Terraform と Wrangler の管轄、deploy と apply の条件、レスポンスヘッダ、観測点、state を失ったときの戻し方、credential の 2 系統と置き場（draft）
- [技術スタック](tech-stack.md) — 採用しているツールの役割とバージョンの所在、使わないツール、Vite+ を入れるときの取り決め、バージョンの更新の確認、新しい package の作り始め。バージョンそのものと選んだ理由は書かない（draft）
- [テスト](testing.md) — テストの種類ごとに保証すること、分岐カバレッジを求める対象、E2E と見た目の回帰の範囲、実行に要る環境、テストの書き方と変更ごとに足すテスト（draft）

## Design Doc

- [fukuemon.dev PRD](../PRD.md) — 技術記事とハンズオンを 1 つのサイトで公開し、読んで理解する段階と手を動かして確かめる段階を同じサイトの中でつなぐ（draft）
- [fukuemon.dev Design Doc](../design/DesignDoc.md) — 技術記事とハンズオンの静的サイトの全体像。C4 の L2、モジュールの責務と依存、設計不変量、URL の構成、条件つきで足す機能の形（draft）
- [Content Model](../packages/content-model/DesignDoc.md) — 記事とハンズオンに共通する schema、安定識別子 contentId、相互参照のグラフ、ContentRef への正規化、loader との結線
- [Design System](../packages/design-system/DesignDoc.md) — Design Tokens、Typography、縦組み、色、余白と測度、版面、挿絵、動き、アイコン、Tailwind の層と Expressive Code への橋渡し
- [ハンズオンと Interactive](../apps/web/src/features/lab/DesignDoc.md) — ハンズオンの形式（手順の分割、進捗、本文の中の実行）、手を動かす場所の 4 分類、cross-origin isolation の URL ごとの分離、実行環境の性質と足し方
- [基盤](../infra/DesignDoc.md) — Cloudflare の基盤を Terraform で持つ構成。bootstrap と本体の分け方、R2 の state backend の設定と理由、deploy と apply の流れ

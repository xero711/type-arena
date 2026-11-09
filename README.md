# TYPE ARENA

タイピングで戦うオンライン対戦型RPGです。開発はWindows 11を想定し、静的フロントエンドはGitHub Pages、自宅PC側のAPIとデータベースは別プロセスとして運用する構成を目指します。

## 現在の状態

- ブラウザー内で動く日本語ホーム画面とCPUタイピングバトル
- 入力速度・正確率・勝敗のローカル保存
- React、TypeScript、Vite、PixiJS、Zustandを含むWebワークスペース
- 共通の問題文・タイピング判定パッケージ
- Fastify APIのヘルスチェックとDrizzle ORMによるPostgreSQLスキーマ・初回マイグレーション
- Firebase Googleログイン用クライアントとAdmin IDトークン検証、認証必須プロフィールAPI
- 認証済みSocket.IO接続、オンライン待機・対戦画面、自動マッチング、サーバー側のキー入力検証・正確率/コンボ集計・攻撃計算・勝敗判定
- 対戦結果、Eloレート変動、条件付きコイン報酬、コイン台帳のトランザクション保存
- GitHub Pages向けのビルド設定

Googleログインとプロフィール同期コードは用意しましたが、実際の認証にはFirebaseプロジェクト設定が必要です。オンライン結果のDB保存コードは実装済みですが、PostgreSQLが開発環境にないため、実DBへのマイグレーションと対戦決済の統合確認は未実施です。対戦の再接続猶予、ランキング、ガチャ/装備などの経済機能も未実装です。CPU戦の戦績はこのブラウザーのlocalStorageに保存され、サーバーへは送信されません。

## 開発を始める

Node.js 20.19以降とpnpm 10以降を用意してください。

```powershell
pnpm install
pnpm dev
```

ブラウザーでViteが表示するURL（通常は http://localhost:5173 ）を開き、「CPUと対戦」からプレイできます。

APIは別のターミナルで `pnpm --filter @type-arena/server dev` を実行します。DBの準備は [DATABASE_SETUP.md](DATABASE_SETUP.md)、Googleログインは [FIREBASE_SETUP.md](FIREBASE_SETUP.md) を参照してください。

## 確認

```powershell
pnpm --filter @type-arena/web build
```

## ディレクトリ

```text
apps/web/                 Reactフロントエンド
packages/game-data/       問題文などの共有データ
packages/typing-engine/   タイピング判定ロジック
```

## 公開

GitHub Pages用のCI設定を `.github/workflows/pages.yml` に置いています。リポジトリ設定でPagesの公開元をGitHub Actionsにし、Actionsの書き込み権限を許可してください。秘密情報をコミットしないでください。

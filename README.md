# TYPE ARENA

タイピングで戦うオンライン対戦型RPGです。静的フロントエンドはGitHub Pages、自宅PCのAPIとPostgreSQLは別プロセスで運用します。

公開サイト: [https://xero-x.me/type-arena/](https://xero-x.me/type-arena/)

## 現在の状態

- 日本語ホーム画面とオフライン対応のCPUタイピングバトル
- 人間の勇者に5段階のレアリティ別の武器・防具を装備でき、キャラクターの見た目に反映
- 50種類の装備アイテムを個別のピクセルアートで表示
- 1回300コインのガチャ、55/28/12/4/1%の排出率、開封演出、再送時の二重消費防止
- Windows 11上のPostgreSQLとFirebase IDトークン検証対応API
- Googleログイン、プロフィール同期、インベントリ、装備保存、ランキング、戦績
- サーバー管理のランク・4桁数字のプライベート対戦、結果・レート・コイン台帳の保存
- GitHub Pagesの自動デプロイとTailscale Funnel経由のHTTPS API接続
- PCログオン時のAPI起動と日次のDBバックアップ

Googleログイン設定はFirebase AuthenticationのGoogleプロバイダーを使います。IDトークン検証にはAdmin秘密鍵を置かず、プロジェクトIDとGoogle公開署名鍵を使います。APIは`https://friday-server.tail3b93c8.ts.net`から利用でき、PostgreSQLは`127.0.0.1:5432`だけで待ち受けます。オンライン対戦を2つの独立したブラウザーセッションで最後まで行う統合確認は未完了です。CPU戦績はIndexedDBに保存し、装備設定はlocalStorageに保存します。

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
pnpm typecheck
pnpm test
```

## ディレクトリ

```text
apps/web/                 Reactフロントエンド
packages/game-data/       問題文などの共有データ
packages/typing-engine/   タイピング判定ロジック
```

## 公開

GitHub Pages用のCI設定を `.github/workflows/pages.yml` に置いています。`main`へのpushで型チェック、テスト、ビルド、デプロイを行います。サーバーのAdmin秘密鍵とDBパスワードはコミットしないでください。詳しくは[Windowsセットアップ](SETUP_WINDOWS.md)、[サーバー運用](docs/SERVER_OPERATION.md)、[Firebase設定](FIREBASE_SETUP.md)、[Tailscale Funnel](TAILSCALE_SETUP.md)を参照してください。

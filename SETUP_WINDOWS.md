# Windows 11 セットアップ

このプロジェクトはGitHub Pages上のWeb画面と、自宅PCで動かすAPI・PostgreSQLで構成されています。CPU対戦と練習はAPIなしで遊べます。

## このPCで起動する

このPCにはNode.jsとPostgreSQLのローカル実行環境を配置済みです。リポジトリのPowerShellから次を実行します。

```powershell
cd "C:\project in server\typing_arena"
pnpm install
pnpm --filter @type-arena/server db:migrate
pnpm --filter @type-arena/server db:seed:items
pnpm --filter @type-arena/server build
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-home-server.ps1
```

APIの状態確認:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

Web画面を開発モードで起動する場合は別のPowerShellで実行します。

```powershell
pnpm dev
```

## 別のWindows PCへ導入する

1. Node.js 20.19以降とpnpm 10以降をインストールします。
2. PostgreSQLをローカルへインストールし、`127.0.0.1:5432`で待ち受けるよう設定します。
3. `DATABASE_SETUP.md`に従って`type_arena`データベースを作成します。
4. `apps/server/.env.example`を`apps/server/.env`へコピーし、DB接続文字列を入力します。
5. `pnpm install`、マイグレーション、アイテム登録、APIビルドを行います。
6. Googleログインを有効にする場合は`FIREBASE_SETUP.md`を設定します。
7. APIをインターネットから使う場合は`TAILSCALE_SETUP.md`を設定します。

`.env`、サービスアカウントJSON、データベースのバックアップをGitHubへ追加しないでください。

## 配置済み環境の状態

- GitHub Pages: [https://xero-x.me/type-arena/](https://xero-x.me/type-arena/)
- API: `127.0.0.1:3001`
- PostgreSQL: `127.0.0.1:5432`
- Googleログイン用のWeb設定: 設定済み
- Firebase Admin SDK秘密鍵: IDトークン検証だけなら不要。プロジェクトIDは設定済み
- Tailscale Funnel: tailnetでの有効化待ち

運用方法は[`docs/SERVER_OPERATION.md`](docs/SERVER_OPERATION.md)を参照してください。

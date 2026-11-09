# このPCでTYPE ARENAサーバーを動かす

この環境ではPostgreSQL 18.6をWindowsユーザー領域に配置し、データを次へ保存しています。

```text
%LOCALAPPDATA%\TypeArena\PostgreSQL\data
```

PostgreSQLは`127.0.0.1:5432`だけで待ち受けます。インターネットへ公開するのは、認証済みAPIが稼働する場合でもAPIのHTTPS入口だけです。データフォルダーはリポジトリ外に置き、DBパスワードは`apps/server/.env`（Git除外）へ保存します。

実行環境は公式Node.js 22.23.4を`%LOCALAPPDATA%\TypeArena\NodeJS\22.23.4`へ展開しています。PostgreSQLとNode.jsはいずれも管理者権限を使わず、ユーザー単位で配置しています。

## 起動

```powershell
cd "C:\project in server\typing_arena"
pnpm --filter @type-arena/server build
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-home-server.ps1
```

`/health`の`database`が`online`、`/ready`の`status`が`ready`であることを確認します。

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

ログはPostgreSQLが`%LOCALAPPDATA%\TypeArena\PostgreSQL\postgresql.log`、APIが`apps/server/data/api.log`に保存されます。

## DBの状態確認・停止

```powershell
$pgCtl = Join-Path $env:LOCALAPPDATA "TypeArena\PostgreSQL\18.6\pgsql\bin\pg_ctl.exe"
$pgData = Join-Path $env:LOCALAPPDATA "TypeArena\PostgreSQL\data"
& $pgCtl -D $pgData status
& $pgCtl -D $pgData -m fast stop
```

APIは起動したPowerShellで`Ctrl+C`を押して停止します。DBを止める前にAPIを停止してください。

## Google認証

Googleログインをオンラインで使うにはFirebase設定が必要です。`apps/server/.env`にAdmin SDKの3変数、GitHub PagesリポジトリのVariablesにWeb SDKの4変数を登録します。名前と取得方法は[Firebase設定手順](../FIREBASE_SETUP.md)を参照してください。秘密鍵はGitHubへ登録せず、自宅PCの`.env`だけに置きます。

## 再起動後の起動

ログオン時にサーバーを自動起動する場合は、Windowsタスクスケジューラへ現在のWindowsユーザーでログオン時に`pwsh -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\project in server\typing_arena\scripts\start-home-server.ps1"`を実行するタスクを登録します。登録するとPCへのログオン後にAPIとDBが起動します。Windowsサービスや管理者権限のタスクではありません。

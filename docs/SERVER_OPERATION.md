# このPCでTYPE ARENAサーバーを動かす

この環境ではPostgreSQL 18.6とNode.js 22.23.4の実行ファイルを、Git除外されるローカル領域へ置いています。PostgreSQLデータは次へ保存しています。

```text
apps\server\data\runtime\postgres-data
```

PostgreSQLは`127.0.0.1:5432`だけで待ち受けます。インターネットへ公開するのは、認証済みAPIが稼働する場合でもAPIのHTTPS入口だけです。データフォルダーはリポジトリ外に置き、DBパスワードは`apps/server/.env`（Git除外）へ保存します。

PostgreSQLのバイナリは`apps/server/data/runtime/pgsql`、Node.jsは`apps/server/data/runtime/node/node.exe`にあります。このフォルダー全体は`.gitignore`で除外しています。PostgreSQLは公式WindowsバイナリZIP、Node.jsは公式22.23.4 ZIPをチェックサム検証後に展開しました。システムインストーラーや管理者権限は使っていません。

## 起動

```powershell
cd "C:\project in server\typing_arena"
pnpm --filter @type-arena/server build
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-home-server.ps1
```

`/api/health`または`/health`の`database`が`online`、`/ready`の`status`が`ready`であることを確認します。

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

ログはPostgreSQLが`%LOCALAPPDATA%\TypeArena\PostgreSQL\postgresql.log`、APIが`apps/server/data/api.log`に保存されます。

## DBの状態確認・停止

```powershell
$pgCtl = Join-Path (Get-Location) "apps\server\data\runtime\pgsql\bin\pg_ctl.exe"
$pgData = Join-Path (Get-Location) "apps\server\data\runtime\postgres-data"
& $pgCtl -D $pgData status
& $pgCtl -D $pgData -m fast stop
```

APIは起動したPowerShellで`Ctrl+C`を押して停止します。DBを止める前にAPIを停止してください。

## Google認証

Googleログインをオンラインで使うにはFirebase設定が必要です。GitHub PagesリポジトリのVariablesにWeb SDKの4変数を登録し、`apps/server/.env`の`FIREBASE_PROJECT_ID`を設定します。IDトークン検証だけならAdmin SDK秘密鍵は不要です。特権付きFirebase APIを追加する場合はサービスアカウント認証情報を自宅PCだけに設定してください。詳しくは[Firebase設定手順](../FIREBASE_SETUP.md)を参照してください。

## 再起動後の起動

ログオン時にサーバーを自動起動する場合は、Windowsタスクスケジューラへ現在のWindowsユーザーでログオン時に`pwsh -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\project in server\typing_arena\scripts\start-home-server.ps1"`を実行するタスクを登録します。登録するとPCへのログオン後にAPIとDBが起動します。Windowsサービスや管理者権限のタスクではありません。

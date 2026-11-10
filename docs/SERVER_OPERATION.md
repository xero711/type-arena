# このPCでTYPE ARENAサーバーを動かす

この環境ではPostgreSQL 18.6とNode.js 22.23.4の実行ファイルを、Git除外されるローカル領域へ置いています。PostgreSQLデータは次へ保存しています。

```text
apps\server\data\runtime\postgres-data
```

PostgreSQLは`127.0.0.1:5432`だけで待ち受けます。公開するのはFirebase IDトークンを検証するAPIのHTTPS入口だけです。データフォルダーはGit除外され、DBパスワードは`apps/server/.env`へ保存します。

PostgreSQLのバイナリは`apps/server/data/runtime/pgsql`、Node.jsは`apps/server/data/runtime/node/node.exe`にあります。このフォルダー全体は`.gitignore`で除外しています。PostgreSQLは公式WindowsバイナリZIP、Node.jsは公式22.23.4 ZIPをチェックサム検証後に展開しました。システムインストーラーや管理者権限は使っていません。

## 起動

```powershell
cd "C:\project in server\typing_arena"
pnpm --filter @type-arena/server build
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-home-server.ps1
```

`/api/health`または`/health`の`database`が`online`、`/ready`の`status`が`ready`であることを確認します。

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

ログはPostgreSQLが`apps/server/data/postgresql.log`、APIが`apps/server/data/api.log`、バックアップが`apps/server/data/backup.log`に保存されます。

## DBの状態確認・停止

```powershell
$pgCtl = Join-Path (Get-Location) "apps\server\data\runtime\pgsql\bin\pg_ctl.exe"
$pgData = Join-Path (Get-Location) "apps\server\data\runtime\postgres-data"
& $pgCtl -D $pgData status
& $pgCtl -D $pgData -m fast stop
```

開発中は起動したPowerShellで`Ctrl+C`を押すと、APIがSocket.IO接続とDB接続を閉じてから停止します。DBを止める前にAPIを停止してください。タスクスケジューラに登録したAPIはWindowsログオン時に起動し、異常終了時は再試行します。

## バックアップと復元

Windowsタスクスケジューラの`TYPE ARENA Database Backup`が毎日3時にバックアップを作成します。保存先は`apps/server/data/backups`、保持期間は14日です。バックアップはこのPC内にあるため、災害やPC故障に備えて必要に応じて外部ドライブにもコピーしてください。

バックアップを手動で作成し、形式を確認するには次を実行します。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-database.ps1
```

復元する場合は先にAPIを停止し、正しいバックアップファイルを指定します。スクリプトは既存DBのデータを置き換える前に確認を表示します。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-database.ps1 -BackupPath .\apps\server\data\backups\type-arena-YYYYMMDD-HHmmss.dump
```

## 公開API

Tailscale Funnelは`https://friday-server.tail3b93c8.ts.net`からAPIの`127.0.0.1:3001`へ転送します。外部から`/api/health`と`/ready`が応答することを確認済みです。PostgreSQLの5432番ポートは公開していません。

## Google認証

Googleログインをオンラインで使うにはFirebase設定が必要です。GitHub PagesリポジトリのVariablesにWeb SDKの4変数を登録し、`apps/server/.env`の`FIREBASE_PROJECT_ID`を設定します。IDトークン検証だけならAdmin SDK秘密鍵は不要です。特権付きFirebase APIを追加する場合はサービスアカウント認証情報を自宅PCだけに設定してください。詳しくは[Firebase設定手順](../FIREBASE_SETUP.md)を参照してください。

## 再起動後の起動

このPCでは`TYPE ARENA Local Server`タスクを登録済みです。現在のWindowsユーザーでログオンすると、APIとDBが起動します。`TYPE ARENA Database Backup`タスクも登録済みです。どちらもWindowsサービスや管理者権限のタスクではありません。

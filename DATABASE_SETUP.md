# PostgreSQLのセットアップ（Windows 11）

この手順は自宅PCにPostgreSQLを置く開発用セットアップです。PostgreSQLのインストールとWindowsサービスの変更はPCの管理者であるユーザーが行ってください。TYPE ARENAのDBを外部のクラウドへ作成する必要はありません。

## 1. PostgreSQLをインストール

1. [PostgreSQL公式Windowsダウンロードページ](https://www.postgresql.org/download/windows/)を開き、案内先のWindowsインストーラーを取得します。
2. インストーラーでPostgreSQL ServerとCommand Line Toolsを選びます。ポートは既定値の`5432`を使います。
3. `postgres`管理者のパスワードを設定して、安全な場所に保管します。DB用パスワードとは別の値にしてください。
4. インストール後、新しいPowerShellを開き、`psql --version`でコマンドが使えることを確認します。見つからない場合はPostgreSQLの`bin`フォルダー（例：`C:\Program Files\PostgreSQL\<version>\bin`）をPATHへ追加してください。

## 2. ゲーム用ロールとDBを作成

インストール時に設定したPostgreSQL管理者パスワードを入力して、psqlを起動します。

```powershell
psql -U postgres -h 127.0.0.1
```

psqlの入力欄で次を実行します。

```sql
CREATE ROLE type_arena LOGIN;
CREATE DATABASE type_arena OWNER type_arena ENCODING 'UTF8';
\password type_arena
```

`\password`で強いDB用パスワードを設定します。終了は `\q` です。ゲーム用ロールはこのデータベースの所有者であり、Windows管理者やPostgreSQL管理者の権限は持ちません。

## 3. APIの環境変数を設定

```powershell
Copy-Item apps/server/.env.example apps/server/.env
notepad apps/server/.env
```

`DATABASE_URL`を作成したロールとパスワードに合わせます。

```dotenv
DATABASE_URL=postgres://type_arena:YOUR_DATABASE_PASSWORD@127.0.0.1:5432/type_arena
```

パスワードに`@`, `:`, `/`, `#`, `%`などが含まれる場合はURLエンコードが必要です。`.env`はGitへ追加しないでください。

## 4. テーブルを作成して接続を確認

```powershell
pnpm --filter @type-arena/server db:migrate
pnpm --filter @type-arena/server dev
```

別のPowerShellで、両方の応答を確認します。

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

`/health`の`database`が`online`、`/ready`の`status`が`ready`ならAPIからDBへ接続できています。`/health`はAPIプロセスの状態、`/ready`はDBを含む準備状態を表します。

## バックアップ

このPCでは日次バックアップタスクが`apps/server/data/backups`に保存し、14日より古いバックアップを整理します。手動作成もできます。APIを停止せずに実行できます。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-database.ps1
```

復元する場合は、まずAPIを停止してからバックアップファイルを選びます。スクリプトが実行前に確認し、現在のDBのデータを置き換えます。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-database.ps1 -BackupPath .\apps\server\data\backups\type-arena-YYYYMMDD-HHmmss.dump
```

バックアップはこのPC内にあるため、必要に応じて外部ドライブへもコピーしてください。`.dump`ファイルや`.env`をGitHubへ追加しないでください。

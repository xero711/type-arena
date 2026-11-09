# トラブルシューティング

## Googleログイン後に「サーバー設定が必要」と表示される

ブラウザー側のGoogleログインとAPI側のFirebase Admin SDK設定は別です。`apps/server/.env`に正しい`FIREBASE_PROJECT_ID`があるか確認してください。IDトークン検証だけなら秘密鍵は不要です。特権付きFirebase APIを使う場合にだけサービスアカウント認証情報が必要です。[Firebase設定](FIREBASE_SETUP.md)を参照してください。

## APIに接続できない

まずローカルでAPIとDBの状態を確認します。

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
Invoke-RestMethod http://127.0.0.1:3001/ready
```

`database`が`offline`の場合は、PostgreSQLが起動しているか、`apps/server/.env`の`DATABASE_URL`が正しいか確認します。起動手順は[`docs/SERVER_OPERATION.md`](docs/SERVER_OPERATION.md)を確認してください。

## 公開APIが応答しない

`tailscale funnel status`で`https://friday-server.tail3b93c8.ts.net`が表示されるか確認します。公開ヘルスチェックは次のコマンドです。

```powershell
Invoke-RestMethod https://friday-server.tail3b93c8.ts.net/api/health
Invoke-RestMethod https://friday-server.tail3b93c8.ts.net/ready
```

`/api/health`が`database: offline`の場合は、PC上のPostgreSQLを確認してください。Funnelを有効にしても、CPU対戦と練習はAPI停止中に遊べます。PostgreSQLの5432番ポートをFunnelやルーターで公開しないでください。

## 新しい装備が表示されない

アイテムマスターを再登録します。

```powershell
pnpm --filter @type-arena/server db:seed:items
```

この処理は現在の50件を追加・更新し、旧武器カテゴリーを無効化します。既存アイテム行は削除しません。

## GitHub Pagesの画面が更新されない

GitHubリポジトリのActionsで最新のPagesワークフローを開き、完了状態とコミットを確認します。ブラウザーを再読み込みし、変化がない場合はキャッシュを消して再度開きます。公開手順は[`GITHUB_PAGES_DEPLOY.md`](GITHUB_PAGES_DEPLOY.md)を参照してください。

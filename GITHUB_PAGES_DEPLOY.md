# GitHub Pagesの公開

公開リポジトリ：[xero711/type-arena](https://github.com/xero711/type-arena)

GitHub Actionsが`main`へのpush時に型チェック、テスト、ビルド、Pagesへの配置を行います。現在の公開URLは[https://xero-x.me/type-arena/](https://xero-x.me/type-arena/)です。GitHub PagesのActions実行と配置が成功したことを確認しています。

## API・Googleログイン設定

リポジトリの **Settings → Secrets and variables → Actions → Variables** に次の公開Web設定を追加します。`VITE_`から始まる値は配信JavaScriptに含まれるため、Firebase Web SDKの公開設定だけを登録してください。

| Variable | 値 |
|---|---|
| `VITE_API_URL` | `https://friday-server.tail3b93c8.ts.net` |
| `VITE_FIREBASE_API_KEY` | Firebase Webアプリ設定 |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Webアプリ設定 |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Webアプリ設定 |
| `VITE_FIREBASE_APP_ID` | Firebase Webアプリ設定 |

APIの`WEB_ORIGIN`はPagesのホスト名（このサイトでは`https://xero-x.me`）に設定します。Firebase Admin秘密鍵と`DATABASE_URL`はGitHubへ登録せず、サーバーPCの`apps/server/.env`に設定します。

Firebase IDトークン検証はAdmin SDK秘密鍵なしで動作します。Tailscale Funnel経由の`/api/health`と`/ready`が応答し、DBはPC内の`127.0.0.1:5432`だけで待ち受けています。オンライン機能の利用には、ユーザーがGoogleログインしている必要があります。

変数を追加したら、Actionsタブから **Build and deploy GitHub Pages → Run workflow** を実行すると再ビルドされます。サイトはサーバーが停止していても起動し、CPU戦を遊べます。

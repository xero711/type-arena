# FirebaseとGoogleログインの設定

Firebase AuthenticationのGoogleログインを使います。プロジェクトは **`type-arena-e9428`**（Type Arena）で、無料のSparkプランです。Googleプロバイダー、`localhost` と `xero-x.me` の承認済みドメイン、Webアプリ `Type Arena Web` は設定済みです。Identity Platformへのアップグレードや電話番号認証は行いません。[Firebaseの料金案内](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)を参照してください。

## 1. Firebaseプロジェクトを用意

設定を再現する場合は、Firebase Consoleで既存の`type-arena-e9428`プロジェクトを開いてください。Authenticationの「Sign-in method」でGoogleを有効にし、「Settings」の承認済みドメインに`localhost`と`xero-x.me`を登録します。Webアプリ設定はプロジェクト設定から確認できます。Web APIキーはブラウザー用の公開設定であり、Admin秘密鍵とは別です。

## 2. ブラウザー用の設定

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
notepad apps/web/.env.local
```

`apps/web/.env.local` とGitHub Actions用のリポジトリ変数には、Webアプリ設定を登録済みです。新しい環境に設定する場合はFirebaseのWebアプリ設定から値を転記してください。

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:...:web:...
VITE_API_URL=http://localhost:3001
```

`VITE_API_URL`はオンラインAPIのHTTPSアドレスへ置き換えます。Viteの`VITE_`設定はビルド済みJavaScriptに含まれるため、ここへAdmin秘密鍵やDBパスワードを置かないでください。

## 3. IDトークン検証と任意のAdmin権限

このAPIはFirebase Admin SDKの`verifyIdToken()`でIDトークンを検証し、確認済みUIDだけでローカルDBのプロフィールを管理します。この用途では`FIREBASE_PROJECT_ID`だけで起動でき、Admin秘密鍵は不要です。SDKはGoogleが公開する署名鍵を使います。プロジェクトIDは`apps/server/.env`に設定済みです。

サーバーが後からFirebase Authのユーザー管理など、特権付きFirebase APIを呼び出す場合だけ、Firebase ConsoleのProject settings → Service accountsから認証情報を追加します。Firebase公式はGoogle環境ではADC、ローカルや自宅サーバーではサービスアカウントJSONを案内しています。秘密鍵を使う場合も、JSONはこのリポジトリやGitHubへ入れず、このPCだけに保管してください。

```powershell
Copy-Item apps/server/.env.example apps/server/.env
notepad apps/server/.env
```

特権付きAdmin APIを使う場合は、JSONの`project_id`, `client_email`, `private_key`をサーバー専用の変数へ転記します。`.env`の秘密鍵は1行で保存し、改行を文字列`\n`として表します。

```dotenv
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`FIREBASE_PROJECT_ID`があれば、APIはFirebase Admin SDKでIDトークンを検証できます。クライアントから受け取ったUIDは認可に使わず、署名検証済みのUIDだけをDBプロフィールの検索・更新キーにします。[Firebase公式のIDトークン検証手順](https://firebase.google.com/docs/auth/admin/verify-id-tokens)と[Admin SDKの初期化方法](https://firebase.google.com/docs/admin/setup)を参照してください。

## 4. 接続確認

PostgreSQLの設定とマイグレーションを済ませてから、APIとWebアプリを別々に起動します。

```powershell
pnpm --filter @type-arena/server dev
pnpm dev
```

Web画面の「Googleログイン」を押し、Googleアカウントで認証します。サーバー側では`POST /api/auth/session`がIDトークンを検証してプロフィールを作成または更新します。プロフィールAPIは`GET /api/me`、表示名変更は`PATCH /api/me`です。認証情報がない場合はCPU戦をゲストとして遊べます。

## 現在の状態

Googleログインはローカル画面と公開ビルドで確認済みです。IDトークン検証だけなら秘密鍵は必要ありません。Admin秘密鍵は発行しましたが、このPCへダウンロードできなかったためサーバー設定には保存していません。現在の機能はプロジェクトIDとGoogle公開署名鍵で検証します。特権付きFirebase APIを追加する場合は、利用していない鍵をConsoleで確認してから認証情報を設定してください。

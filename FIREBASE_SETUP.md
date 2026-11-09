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

## 3. サーバー用サービスアカウント

Firebase ConsoleのProject settings → Service accountsにあるAdmin SDKサービスアカウントを使い、秘密鍵JSONを発行します。JSONファイルはこのリポジトリやGitHubへ入れず、このPCのサーバー設定だけに保管してください。

```powershell
Copy-Item apps/server/.env.example apps/server/.env
notepad apps/server/.env
```

JSONの`project_id`, `client_email`, `private_key`をサーバー専用の変数へ転記します。`.env`の秘密鍵は1行で保存し、改行を文字列`\n`として表します。

```dotenv
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`apps/server/.env`にFirebaseサービスアカウントの値が揃うと、APIはFirebase Admin SDKでクライアントIDトークンを検証します。検証済みFirebase UIDだけをDBプロフィールの検索・更新キーに使い、クライアントから受け取ったUIDは認可に使いません。バックエンドはFirebase Adminの`verifyIdToken()`を使ってトークンを検証します。[Firebase公式のIDトークン検証手順](https://firebase.google.com/docs/auth/admin/verify-id-tokens)を参照してください。

## 4. 接続確認

PostgreSQLの設定とマイグレーションを済ませてから、APIとWebアプリを別々に起動します。

```powershell
pnpm --filter @type-arena/server dev
pnpm dev
```

Web画面の「Googleログイン」を押し、Googleアカウントで認証します。サーバー側では`POST /api/auth/session`がIDトークンを検証してプロフィールを作成または更新します。プロフィールAPIは`GET /api/me`、表示名変更は`PATCH /api/me`です。認証情報がない場合はCPU戦をゲストとして遊べます。

## 現在の状態

Googleログインはローカル画面と公開ビルドで確認済みです。サーバー側のIDトークン検証にはAdmin SDK用の秘密鍵が必要です。2026-11-09にFirebase Consoleで鍵を発行しましたが、ダウンロードファイルをこのPC上で確認できず、`apps/server/.env`にも設定できていません。使える鍵ファイルをPC上で確認できる形で取得し、サーバーへ設定する作業が残っています。秘密鍵はGitへコミットしないでください。利用できない鍵の整理が必要な場合は、Firebase Consoleで対象鍵を確認してから行ってください。

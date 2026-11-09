# FirebaseとGoogleログインの設定

Firebase Authenticationの通常のGoogle認証は無料のSparkプランで使える機能として案内されています。Identity Platformへのアップグレードは料金・利用上限が異なるため行わず、電話番号認証も使いません。[Firebaseの料金案内](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)を設定時に確認してください。Googleログインを有効にするFirebaseプロジェクトはユーザー自身が作成してください。Firebaseコンソールでの設定と秘密鍵の取得は外部アカウント操作を伴うため、このワークスペースからは実行していません。

## 1. Firebaseプロジェクトを用意

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成します。
2. Authenticationの「Sign-in method」でGoogleプロバイダーを有効にします。
3. Authenticationの「Settings」にある承認済みドメインへ、開発時の`localhost`とGitHub Pagesのホスト名を追加します。
4. プロジェクト設定からWebアプリを登録し、表示された`apiKey`, `authDomain`, `projectId`, `appId`を控えます。Web APIキーはブラウザー用の公開設定であり、Admin秘密鍵とは別です。

## 2. ブラウザー用の設定

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
notepad apps/web/.env.local
```

値をFirebaseのWebアプリ設定から転記します。

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_APP_ID=1:...:web:...
VITE_API_URL=http://localhost:3001
```

`VITE_API_URL`はオンラインAPIのHTTPSアドレスへ置き換えます。Viteの`VITE_`設定はビルド済みJavaScriptに含まれるため、ここへAdmin秘密鍵やDBパスワードを置かないでください。

## 3. サーバー用サービスアカウント

Firebase ConsoleのProject settings → Service accountsでAdmin SDK用サービスアカウントを作成し、秘密鍵JSONをダウンロードします。JSONファイルはこのリポジトリへ入れず、暗号化した保管場所に保管してください。

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

## 現在の制限

FirebaseクライアントとAdmin SDKのコードは実装済みですが、実際のGoogle認証確認にはFirebaseプロジェクト設定と秘密鍵が必要です。Googleログイン自体はFirebaseへ接続します。API同期にはPostgreSQLも必要です。サービスアカウント鍵をGitへコミットしないでください。

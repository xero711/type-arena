# TYPE ARENA

タイピングで戦うオンライン対戦型RPGです。静的フロントエンドはGitHub Pages、自宅PCのAPIとPostgreSQLは別プロセスで運用します。

公開サイト: [https://xero-x.me/type-arena/](https://xero-x.me/type-arena/)

## 現在の状態

- ブラウザー内で動く日本語ホーム画面とCPUタイピングバトル
- 入力速度・正確率・勝敗のローカル保存
- React、TypeScript、Vite、PixiJS、Zustandを含むWebワークスペース
- 共通の問題文・タイピング判定パッケージ
- Windows 11上のPostgreSQLとAPI。ローカルDBへマイグレーション適用済み
- Firebase Googleログイン用クライアントと、IDトークン検証・プロフィール同期のサーバーコード
- サーバー権威型オンライン対戦の基盤、90秒制限、ランクマッチ、6文字のプライベートコード、15秒の再接続猶予
- ランク戦の結果・レート・コイン台帳を保存する処理。プライベート戦は結果のみ保存し、レートとコインは変動しない
- 5レアリティ×5カテゴリーの武器、5種類の防具を各レアリティに用意し、勇者の装備表示へ反映
- GitHub Pages向けのビルド設定

Googleログイン画面と公開Web設定は動作確認済みです。サーバーはFirebase Admin SDKでIDトークンを検証し、プロフィールをローカルDBへ同期します。IDトークン検証にはAdmin秘密鍵を置かず、プロジェクトIDとGoogle公開署名鍵を使います。Tailscale Funnelはまだ有効化されていないため、公開サイトから自宅APIへは接続できません。ガチャ、オンライン所持品・装備の保存、ランキング、プロフィール統計、オンライン対戦の2ブラウザー統合確認は未完成です。CPU戦の装備と戦績はブラウザーのlocalStorageに保存されます。

## 開発を始める

Node.js 20.19以降とpnpm 10以降を用意してください。

```powershell
pnpm install
pnpm dev
```

ブラウザーでViteが表示するURL（通常は http://localhost:5173 ）を開き、「CPUと対戦」からプレイできます。

APIは別のターミナルで `pnpm --filter @type-arena/server dev` を実行します。DBの準備は [DATABASE_SETUP.md](DATABASE_SETUP.md)、Googleログインは [FIREBASE_SETUP.md](FIREBASE_SETUP.md) を参照してください。

## 確認

```powershell
pnpm --filter @type-arena/web build
pnpm typecheck
pnpm test
```

## ディレクトリ

```text
apps/web/                 Reactフロントエンド
packages/game-data/       問題文などの共有データ
packages/typing-engine/   タイピング判定ロジック
```

## 公開

GitHub Pages用のCI設定を `.github/workflows/pages.yml` に置いています。`main`へのpushで型チェック、テスト、ビルド、デプロイを行います。サーバーのAdmin秘密鍵とDBパスワードはコミットしないでください。詳しくは[Windowsセットアップ](SETUP_WINDOWS.md)、[サーバー運用](docs/SERVER_OPERATION.md)、[Firebase設定](FIREBASE_SETUP.md)、[Tailscale Funnel](TAILSCALE_SETUP.md)を参照してください。

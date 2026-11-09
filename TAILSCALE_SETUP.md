# Tailscale FunnelでAPIを公開する

Tailscale Funnelは、自宅PCのローカルAPIをHTTPSで公開するために使います。公開するのはAPIの3001番ポートだけです。PostgreSQLの5432番ポートは`127.0.0.1`だけで待ち受け、外部公開しません。

## このPCでの状態

Funnelの宛先として`https://friday-server.tail3b93c8.ts.net`をフロントエンドへ設定済みです。現在はtailnetでFunnelが未承認のため、公開APIへの接続はできません。

## 有効化と起動

1. Tailscaleへログインし、このPCをtailnetへ接続します。
2. Windowsの管理者PowerShellを開き、以下を実行します。

```powershell
tailscale funnel --bg 3001
tailscale funnel status
```

3. 初回に有効化の承認画面が開いたら、このPCのFunnelを許可します。
4. `tailscale funnel status`に公開URLと`http://127.0.0.1:3001`への転送が表示されることを確認します。
5. 公開先のヘルスチェックを確認します。

```powershell
Invoke-RestMethod https://friday-server.tail3b93c8.ts.net/api/health
```

Tailscale Funnelはインターネットから到達可能な公開入口です。ユーザー情報、試合結果、コイン等のAPIはFirebase IDトークンの検証が有効になってから利用してください。PostgreSQLのポートをFunnelへ指定しないでください。

Tailscaleクライアントのバージョンによってコマンド表示が異なる場合は、[公式の`tailscale funnel`コマンド説明](https://tailscale.com/docs/reference/tailscale-cli/funnel)と[公式Funnelガイド](https://tailscale.com/docs/features/tailscale-funnel)を確認してください。Funnelは`--bg`を使うとPC再起動後も設定を保持します。

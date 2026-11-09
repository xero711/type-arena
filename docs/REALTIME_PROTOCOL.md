# リアルタイム接続プロトコル

Socket.IOはAPIと同じHTTPサーバーへWebSocket/pollingで接続します。クライアントは接続時にFirebase IDトークンを`auth.token`へ渡します。サーバーはFirebase Admin SDKで検証し、クライアント指定のUIDやレートを認可情報として受け取りません。検証はプロジェクトIDとGoogle公開署名鍵を使うため、Admin秘密鍵は使いません。

## 実装済みイベント

| 方向 | イベント | 内容 |
|---|---|---|
| Client → Server | `matchmaking:join` | 認証ユーザーのDBプロフィールを取得して待機列へ追加 |
| Client → Server | `matchmaking:cancel` | 待機中の自分を取り消す |
| Client → Server | `private:create` | 6文字の招待コードを作成。10分後または発行者の切断で失効 |
| Client → Server | `private:join` | 6文字コードでプライベート戦へ参加 |
| Server → Client | `private:created` | 招待コードと有効期限を通知 |
| Server → Client | `private:error` | 無効コード、オフライン、対戦中、DBエラーなど |
| Server → Client | `matchmaking:queued` | 待機列への参加を通知 |
| Server → Client | `matchmaking:matched` | マッチID、相手の表示名・レートを通知 |
| Server → Client | `matchmaking:error` | DB未設定、プロフィール未作成、重複参加など |
| Server → All | `presence:count` | 接続中の認証済みソケット数 |
| Server → Client | `battle:starting` | モード、HP、現在の問題、サーバー開始時刻と終了時刻を通知。再接続時は入力途中の状態を含む |
| Client → Server | `battle:key` | 1打ごとの英字キーまたはBackspaceを送信 |
| Server → Client | `battle:input-state` | 検証済み入力、正確率、ミス数、最大コンボを通知 |
| Client → Server | `battle:submit` | 完成した問題IDを送信（回答文字列は送らない） |
| Server → Client | `battle:update` | 自分のHP、相手HP、次の問題を通知 |
| Server → Room | `battle:damage` | サーバーが計算した攻撃ダメージを通知 |
| Server → Client | `battle:error` | 不正ペイロード、誤答、早すぎる回答など |
| Server → Client | `battle:finished` | 勝敗、モード、戦績、保存結果、レート変動、報酬を通知 |
| Server → Room | `battle:persistence-error` | DBに結果を保存できなかったことを通知 |

待機列はプロセス内のメモリーにあり、同じFirebase UIDの二重待機を拒否します。初期レート幅は150、10秒待つごとに50ずつ最大600まで広げます。再起動時は待機列が空になります。

## サーバー戦闘処理の制約

サーバーはプレイヤー別の問題順、入力文字列、ミス数、コンボ、正確率、HPを保持します。各キーは問題のローマ字候補の接頭辞か照合し、キー間隔20ms未満の入力を制限します。完成回答は最低40ms/文字の経過を確認してから攻撃に使います。試合は90秒で終了し、時間切れは残HPで勝敗を決めます。同点は引き分けです。攻撃力、HP、勝敗はサーバーで確定し、クライアントは回答文字列、HPや勝者を指定できません。

切断後15秒以内に同じFirebase UIDで再接続すると、サーバーから現在の問題、HP、入力途中の状態を復元します。期限を過ぎた切断は敗北として確定します。プライベート戦は試合結果だけ保存し、レートとコインは変動しません。ランク戦の戦績、Elo変動、報酬と台帳は一つのDBトランザクションで保存します。

## 未完了

同じプロセス内での再接続を扱いますが、サーバー再起動後の対戦復帰はありません。結果保存の実DB統合テストと2ブラウザーでのオンライン対戦確認は未実施です。Tailscale Funnelが有効になるまで、公開サイトから自宅APIへ接続できません。DB保存に失敗した場合は、結果画面で報酬が未確定であることを表示します。

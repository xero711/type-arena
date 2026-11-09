# リアルタイム接続プロトコル（実装中）

Socket.IOはAPIと同じHTTPサーバーへWebSocket/pollingで接続します。クライアントは接続時にFirebase IDトークンを`auth.token`へ渡します。サーバーはFirebase Admin SDKで検証し、クライアント指定のUIDやレートを認可情報として受け取りません。

## 実装済みイベント

| 方向 | イベント | 内容 |
|---|---|---|
| Client → Server | `matchmaking:join` | 認証ユーザーのDBプロフィールを取得して待機列へ追加 |
| Client → Server | `matchmaking:cancel` | 待機中の自分を取り消す |
| Server → Client | `matchmaking:queued` | 待機列への参加を通知 |
| Server → Client | `matchmaking:matched` | マッチID、相手の表示名・レートを通知 |
| Server → Client | `matchmaking:error` | DB未設定、プロフィール未作成、重複参加など |
| Server → All | `presence:count` | 接続中の認証済みソケット数 |
| Server → Client | `battle:starting` | 対戦用プロンプトとサーバー開始時刻を通知 |
| Client → Server | `battle:key` | 1打ごとの英字キーまたはBackspaceを送信 |
| Server → Client | `battle:input-state` | 検証済み入力、正確率、ミス数、最大コンボを通知 |
| Client → Server | `battle:submit` | 完成した問題IDを送信（回答文字列は送らない） |
| Server → Client | `battle:update` | 自分のHP、相手HP、次の問題を通知 |
| Server → Room | `battle:damage` | サーバーが計算した攻撃ダメージを通知 |
| Server → Client | `battle:error` | 不正ペイロード、誤答、早すぎる回答など |
| Server → Client | `battle:finished` | 勝敗、戦績、保存結果、レート変動、報酬を通知 |
| Server → Room | `battle:persistence-error` | DBに結果を保存できなかったことを通知 |

待機列はプロセス内のメモリーにあり、同じFirebase UIDの二重待機を拒否します。初期レート幅は150、10秒待つごとに50ずつ最大600まで広げます。再起動時は待機列が空になります。

## サーバー戦闘処理の制約

サーバーはプレイヤー別の問題順、入力文字列、ミス数、コンボ、正確率、HPを保持します。各キーは問題のローマ字候補の接頭辞か照合し、キー間隔20ms未満の入力を制限します。完成回答は最低40ms/文字の経過を確認してから攻撃に使います。攻撃力、HP、ノックアウト勝敗はサーバーで確定し、クライアントは回答文字列、HPや勝者を指定できません。戦績、Elo変動、コイン報酬と台帳は一つのDBトランザクションで保存します。

## 未実装

切断時は現在即時フォーフェイト扱いで、再接続猶予はありません。結果保存の実DB統合テスト、2ブラウザーでのオンライン対戦確認、サーバー再起動後の復帰処理は未実施です。DBが停止している場合は対戦結果画面に保存失敗を表示し、報酬が確定していないことを伝えます。

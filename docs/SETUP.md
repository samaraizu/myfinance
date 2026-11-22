# myfinance セットアップ指示書

アプリ: https://myfinance.toneclown17.workers.dev
秘密の値（キー・Secret・合言葉）は、チャットやメモアプリに貼らない。

---

## 1. freee でアプリを登録する

1. https://app.secure.freee.co.jp/developers/applications を開く
2. 「新規作成」を押す
3. アプリ名: `myfinance`
4. コールバックURL: `https://myfinance.toneclown17.workers.dev/api/freee/callback`
5. 権限: 会計の「口座」「口座明細」を **参照のみ**（ほかは付けない）
6. 保存し、表示された **Client ID** と **Client Secret** を控える（次の手順で使う）

## 2. Cloudflare に Secret を登録する

1. https://dash.cloudflare.com → Workers & Pages → `myfinance`
2. Settings → Variables and Secrets → 「Add」
3. Type を **Secret** にして、次の3つを1つずつ追加して保存

| Name | Value |
|---|---|
| `FREEE_CLIENT_ID` | 手順1の Client ID |
| `FREEE_CLIENT_SECRET` | 手順1の Client Secret |
| `APP_KEY` | 自分で決めた合言葉（16文字くらいのランダムな英数字） |

- `FREEE_COMPANY_ID`（10178178 = samaraizu）は設定済み。触らない
- Secret は保存した時点で反映される。再デプロイは不要

## 3. スマホのアプリで freee をつなぐ

1. アプリを開き直す（古い画面のままなら閉じて再起動）
2. 上部タブ右端の「•••」を押す
3. 「freee card charges · App key」に、手順2の `APP_KEY` と同じ合言葉を入れて「Save key」
4. 「Connect freee」→ freee にログイン → 許可
5. アプリに戻り「freee connected」と出れば完了。今月のカード明細が入る

以後はアプリを開くたびに自動で取り込む（前回から10分以上たっている場合）。手動なら「•••」→「Sync card charges now」。

## 4. レシート読み取り（設定済みなら不要）

1. Google Cloud コンソール → APIとサービス → 認証情報（プロジェクト `smart-ledger-ea931`）
2. Vision API キーの「ウェブサイトの制限」に `https://myfinance.toneclown17.workers.dev/*` が入っていることを確認
3. アプリの「•••」→「Google Cloud Vision API key」にキーを入れて保存

## 5. サンプルデータを消す（まだなら）

「•••」→「Remove sample data」→ もう一度押す。自分で登録したレシート等は残る。

---

## うまくいかないとき

| 表示 | 原因と対処 |
|---|---|
| `freee is not set up yet. Add …` | 手順2の Secret が足りない。表示された名前を追加する |
| `App key does not match` | アプリに入れた合言葉と `APP_KEY` が違う。「•••」で入れ直す |
| `freee is not connected yet` / `connection expired` | 「•••」→「Connect freee」をもう一度 |
| freee の画面で「リダイレクトURIが一致しません」 | 手順1のコールバックURLを見直す（末尾まで完全一致） |
| 明細が少ない・古い | freee 側でカードの同期が止まっている。freee の「口座」画面で同期する |
| `Google refused the request` | 手順4のウェブサイトの制限を確認 |

## 管理メモ（開発用）

- デプロイ: `npm run deploy`（app/ を作って Worker に同梱）
- freee の認証情報: Cloudflare KV `MF_KV`（スマホには保存しない）
- 決定事項: `docs/DECISIONS.md`

# Decisions

- Phone-only web app. Opened from the home screen (PWA) at https://myfinance.toneclown17.workers.dev. No app store.
- Hosting: Cloudflare Worker `myfinance` (same account as the other projects). Vercel is not used. Deploy with `npm run deploy` (builds app/ and bundles it into worker/static.js).
- No login. Data stays on the phone (localStorage); nothing is sent to a server.
- Receipts are registered only in myfinance (＋ → Add a receipt). Smart Ledger (samaraizu/smart-ledger) is retired: its Firebase data was deleted. Keep the GCP project `smart-ledger-ea931`, because myfinance uses its Cloud Vision key.
- A receipt matched to a card charge splits that charge by item. A cash receipt, or one with no charge yet, is added as spending.
- Amazon and PayPay come in from screenshots only. No spreadsheets for them.
- Card statements (freee, Amex) are connected after release.
- Style: Night (navy cards, cyan for actions, lime for money, rounded). See design-system/.
- Receipt photos are read with Google Cloud Vision (TEXT detection), the same API and key as Smart Ledger. The key is saved only on the phone (••• settings) and the phone calls Vision directly. The text is turned into store, date, total, payment and items in the app.
- Card statements come straight from freee (company `samaraizu`, id 10178178): the Worker reads credit-card wallet_txns for the current month through `worker/freee.js`. freee tokens live only in Workers KV (`MF_KV`); the phone sends the `APP_KEY` secret as a passcode. Card expenses arrive as charges; a card receipt registered earlier with the same amount within 3 days is merged into the charge. Refunds and cashback (income) are not shown yet.

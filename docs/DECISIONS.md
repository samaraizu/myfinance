# Decisions

- Phone-only web app. Opened from the home screen (PWA) at https://myfinance.toneclown17.workers.dev. No app store.
- Hosting: Cloudflare Worker `myfinance` (same account as the other projects). Vercel is not used. Deploy with `npm run deploy` (builds app/ and bundles it into worker/static.js).
- No login. Data stays on the phone (localStorage); nothing is sent to a server.
- Receipts are registered only in myfinance (＋ → Add a receipt). Smart Ledger (samaraizu/smart-ledger) is not used.
- A receipt matched to a card charge splits that charge by item. A cash receipt, or one with no charge yet, is added as spending.
- Amazon and PayPay come in from screenshots only. No spreadsheets for them.
- Card statements (freee, Amex) are connected after release.
- Style: Night (navy cards, cyan for actions, lime for money, rounded). See design-system/.
- Receipt photos are read by Claude (claude-opus-5-5) through `worker/receipt.js`. The Claude API key lives only in the Worker secret `ANTHROPIC_API_KEY`. Optional secret `APP_KEY` limits who can use the reader; the phone stores the matching key under ••• settings.

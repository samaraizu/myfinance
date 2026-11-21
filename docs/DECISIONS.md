# Decisions

- Phone-only web app. Opened from the home screen (PWA) at https://myfinance-xi-teal.vercel.app. No app store.
- No login. Data stays on the phone (localStorage); nothing is sent to a server.
- Receipts are registered only in myfinance (＋ → Add a receipt). Smart Ledger (samaraizu/smart-ledger) is not used.
- A receipt matched to a card charge splits that charge by item. A cash receipt, or one with no charge yet, is added as spending.
- Amazon and PayPay come in from screenshots only. No spreadsheets for them.
- Card statements (freee, Amex) are connected after release.
- Style: Night (navy cards, cyan for actions, lime for money, rounded). See design-system/.
- Receipt photos are read by Claude (claude-opus-5-5) through `app/api/receipt.js` on Vercel. The Claude API key lives only in Vercel's environment variable `ANTHROPIC_API_KEY`. Optional `APP_KEY` limits who can use the reader; the phone stores the matching key under ••• settings.

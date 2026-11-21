# myfinance

A phone-only household budget app. One screen answers one question: how much can I still spend this month? Everything else (paybacks, the wishlist, categories, card charges) explains that number.

The look is **Night**: floating navy cards on a deeper navy ground, cyan for anything you can act on, lime for money. Dark only.

## Principles

- **Cyan acts, lime counts.** `accent` (cyan) marks what you can tap and what is in motion: buttons, the active tab, pending paybacks, planned spend. `money` (lime) is for yen amounts and nothing else. If a number is lime, it is money.
- **Cards float.** Content sits on `paper` cards with `radius-lg` and `shadow-card` over `bg`. No borders on cards. Inside a card, group things in `ink-soft` wells with `radius-md`.
- **Round where you touch.** Buttons, chips and the meter are pills (`radius-pill`). The + button is a circle. Tags keep a small `radius-sm`.
- **State is still shape.** Solid `ink` = spent, `accent` hatching = planned, dashed `accent` border = pending, `ink` fill with `paper` text = over pace or needs action, `accent` outline = itemized.
- **The money comes first.** `amount-hero` in `money` is the largest number on any screen, once per screen.

## Color

| Token | Role |
| --- | --- |
| `bg` | Page ground, bottom of the hero band |
| `paper` | Cards, sheets, menu |
| `ink` | Text, spent money |
| `accent` | Cyan: buttons, + button, active tab, pace line, planned, pending |
| `money` | Lime: yen amounts only |
| `muted` | Labels, dates, inactive tabs |
| `line` | Hairlines, input and chip borders (decorative) |
| `ink-soft` | Wells inside cards, input fields |
| `accent-soft` | Selected rows, dark stripe in hatching |

Planned-spend hatching: `repeating-linear-gradient(-45deg, var(--accent) 0 5px, var(--accent-soft) 5px 9px)`.

## The hero band

The top of the home screen is a full-width band, centered:

- `hero-title` month ("November"), then a `meta`-sized line in `muted`: "Budget ¥100,000 · 11 days left".
- An `accent` pill button "＋ Add" with `shadow-echo-pill`. It opens the same menu as the + button.
- A tab row: Overview, Paybacks, Wishlist, Charges, then "•••". Active tab in `accent` with a 2px underline; tapping scrolls to that card.
- Ground: `bg` at the bottom, rising into a lighter navy, with a soft cyan glow top-right, a faint lime glow bottom-left and fine diagonal lines in `ink` at 5%. No photographs.

The sticky top bar stays hidden until the hero scrolls away, then shows the month and the amount left.

## Type

- `sans`: Manrope for UI text, with Zen Kaku Gothic New for Japanese merchant and person names.
- `num`: Space Grotesk for yen amounts and dates, with tabular figures.
- Load: `https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@400;500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap`.

## Layout

- One column, max `column` (440px), side gutter `space-4`, `space-3` between cards.
- Home order: hero band → left to spend → paybacks → wishlist → by category → card charges.
- The round + button (`fab`, bottom right, `shadow-echo-fab`) opens a menu: Import Amex, Import Amazon, Import PayPay, Add a receipt, Log a payback. Each opens a bottom sheet with `radius-sheet` top corners.
- Minimum tap target `tap-min`. Inputs and sheet buttons `control`. Input text 16px so phones do not zoom.

## Voice

Plain English, short labels that say what happens: "Add 3 to sheet", "Split 1 charge", "Mark received". Toasts confirm the result: "Logged 2 PayPay paybacks · ¥4,425". Errors say how to fix: "Only ¥3,200 of this charge is left to split".

## Source

Tokens are taken from the Night style in `ui/prototype.html` in the myfinance repository. The earlier Ledger look (two colors, square corners, light and dark) is kept in the prototype's style switcher but is no longer the system.

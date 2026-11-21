# myfinance

A phone-only household budget app. One screen answers one question: how much can I still spend this month? Everything else (paybacks, the wishlist, categories, card charges) explains that number.

## Principles

- **Two colors, nothing more.** `ink` and `accent`. Every grey and tint is one of them mixed into `paper`. No red for errors, no yellow for warnings.
- **State is shape, not hue.** With two colors, meaning comes from the mark: solid `ink` = spent, `accent` diagonal hatching = planned, dashed `accent` border = pending, `ink` fill with `paper` text = over budget or needs action, `accent` outline = itemized.
- **Square.** `radius-0` everywhere. Cards, buttons, chips, sheets and the + button all have square corners. No shadows; borders in `line` or `ink` separate layers.
- **Numbers are monospaced.** Every yen amount and date uses the `num` family with tabular figures so columns line up.
- **The money comes first.** The amount left (`amount-hero`) is the largest thing on any screen. Only one `amount-hero` per screen.

## Color

| Token | Role |
| --- | --- |
| `ink` | Text, spent money, primary borders, over-budget and needs-receipt chips |
| `accent` | Planned spend, paybacks, pace line, primary buttons, focus |
| `paper` | Cards and sheets |
| `bg` | Page ground, inputs, meter track |
| `ink-soft` | Neutral chip fill |
| `line` | Hairlines (decorative only) |
| `muted` | Labels, dates, meta lines |
| `accent-soft` | Selected rows, the light stripe in hatching |

Hatching for planned spend: `repeating-linear-gradient(-45deg, var(--accent) 0 5px, var(--accent-soft) 5px 9px)`. Over-budget overflow: `ink` stripes at 45° on `paper`.

Both themes share the same two hues. In dark, `paper` is a deep green-black and `ink` becomes the light text color; the meanings stay identical.

## Type

- `sans`: IBM Plex Sans for UI text, with Zen Kaku Gothic New as the fallback for Japanese merchant and person names.
- `num`: IBM Plex Mono for yen amounts, dates and source tags.
- Both load from Google Fonts: `family=IBM+Plex+Sans:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700`.
- Card headings use `label`: 12px, bold, uppercase, letter-spaced, in `muted`.

## Layout

- One column, max `column` (440px), side gutter `space-4`.
- Order on the home screen: left to spend → paybacks → wishlist → by category → card charges.
- The + button (`fab`, bottom right) opens a menu: Import Amex, Add a receipt, Log a payback. Each opens a bottom sheet.
- Minimum tap target `tap-min`. Inputs and sheet buttons `control`. Input text is 16px so phones do not zoom.

## Voice

Plain English, short labels that say what happens: "Add 3 to sheet", "Mark received", "Save receipt". Toasts confirm the result: "Added 3 Amex charges · ¥6,480". Errors say how to fix: "Only ¥3,200 of this charge is left to split".

## Source

Tokens are taken from `ui/prototype.html` in the myfinance repository. `muted` was raised from 58% to 66% ink so secondary text passes 4.5:1 on `bg`.

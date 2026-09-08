# Style Guide — "Luke's Annual $10 Donation"

This document captures the visual design direction for the app, agreed on with Stephen. It's meant to be read alongside `PROJECT_SPEC.md` (which covers functionality/data) — this doc covers look and feel only. Follow it as a strong direction, not a rigid rulebook; use good judgment on details it doesn't explicitly cover, staying consistent with the principles below.

---

## The Concept

The app is styled as a **1970s–80s Vegas tout sheet / parlay card** — the kind of typewritten, carbon-copy betting sheet a bookie would hand out, not a slick modern sportsbook app and not a literal old newspaper broadsheet. The league's actual name, **"Luke's Annual $10 Donation"** (an inside joke — presumably Luke reliably nets out down about $10 a year), is the masthead. Lean into that self-deprecating, "we're all here to lose money to each other for fun" energy in the copy and chrome, without overdoing it — the joke should live in a few well-placed spots (the masthead, maybe an empty-state or two), not be plastered everywhere.

**The one hero moment:** the masthead/header treatment — a bold, textured, typewriter-styled banner with the league name, like the top of an actual tout sheet. Everything below it should be quiet, legible, and utilitarian by comparison. Don't spread the "boldness" out — spend it once.

---

## Color

Carbon-copy/duplicate-paper tones, not clean white newsprint. One accent color only (money green) — resist adding more.

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F0EAD8` | Light mode background — aged manila/carbon-paper cream |
| `--ink-dark` | `#1C1A16` | Dark mode background — warm near-black, not pure black |
| `--ink-body` | `#3A3529` | Body text on light mode — faded typewriter-ribbon brown-black |
| `--ink-body-dark` | `#E4DCC8` | Body text on dark mode — same carbon-cream tone, inverted role |
| `--money-green` | `#2F5233` | The one accent — wins, positive $ amounts, primary buttons/links. Deep, like old cash-register ink, not a bright modern green |
| `--loss-rust` | `#8B5A3C` | Losses, negative $ amounts. A rust/sienna rather than red — feels like a rubber date-stamp, avoids the generic red-for-negative default |
| `--hairline` | `#C9C2A8` | Dividers, borders — muted, not stark black rules |
| `--hairline-dark` | `#4A4436` | Dividers, borders in dark mode |

Dark mode is not an inverted light mode — it should feel like the "night game" version of the same sheet: same warm, aged tones, just on a near-black base rather than cream. Avoid cool blue-grays; keep everything warm.

---

## Type

Two families, clearly distinct roles — never mixed within the same piece of content:

- **Typewriter/monospace face** (e.g. **Special Elite** or **Courier Prime**) — used ONLY for: the masthead, section headers, slot labels ("1PM GAME", "WILD CARD"), button labels, and navigation chrome. This is where all the personality lives.
- **Humanist sans-serif** (e.g. **IBM Plex Sans** or **Inter**) — used for EVERYTHING else: team names, spreads, dollar amounts, stakes, dates, form inputs, body copy. This must stay clean and fast to scan — people are checking real numbers under time pressure on game day, so the vintage typewriter face should never touch an actual number.

Type scale: keep it restrained — roughly 4 sizes (masthead/display, section header, body, small/meta). Avoid all-caps body text (fine for the typewriter labels/chrome, per the vintage bookie-sheet feel, but don't apply it to sentences or descriptions). Avoid single-word accenting in headlines (no random bolded/italicized/colored words mid-sentence).

---

## Layout

Not literal newspaper columns — that reads as a generic AI-design cliché (hairline-heavy broadsheet grids). Instead:

**The "carbon-copy order form" concept:** each week's slate is a single vertical stack of line items, left-aligned (not centered — this should feel like filling out a form, not reading a poster). Each pick slot is one line item:
- Typewriter-style label on the left (e.g. `WILD CARD`)
- Clean sans-serif matchup/spread info in the middle
- Stake entry on the right
- A subtle perforated/tear-line divider between items (implemented as a dashed border or a repeating small-circle pattern — think of the perforation on an old paper form, not a literal image of scissors)
- A running "total" line at the bottom of the stack, styled like a paper ledger tally, showing $ committed against the $120 budget

```
LUKE'S ANNUAL $10 DONATION
─────────────────────────
WEEK 4                                    [Week selector]
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
1PM GAME     Eagles -3.5 vs Giants    [ $__ ] [pick]
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
4PM GAME     Chiefs -6 vs Broncos     [ $__ ] [pick]
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
   ...
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
                              TOTAL STAKED: $95 / $120
```

Leaderboard/standings can use a similar ledger-line treatment — one row per person, typewriter label for the name, clean sans-serif for the $ and record.

---

## Signature Detail: Rubber-Stamp Result Badges

Once a pick settles, show its result (WIN / LOSS / PUSH) as a **rubber-stamp-style badge** — slightly rotated a few degrees off-axis, a bit of ink-bleed texture, in the typewriter face, colored with money-green (WIN) or loss-rust (LOSS) or the ink/body tone (PUSH). This is the one decorative flourish worth keeping distinctive — it reads as "a bookie graded this" rather than a generic rounded status pill. Use sparingly — only on settled picks, not as a UI pattern applied everywhere.

---

## Motion

One deliberate moment only: when a pick settles and the stamp appears, animate it "stamping down" (a quick scale/rotate settle, like a real stamp hitting paper) — this is the single animated flourish in the app. Do NOT add fade-and-slide-up entrances on cards, hover-lift effects on every element, or other scattered micro-animations — keep everything else static and instant. Respect `prefers-reduced-motion`.

---

## Voice & Copy

Conversational, dry, a little wry — like a bookie's handwriting, not a corporate app. A few guidelines:

- Buttons say exactly what they do in plain terms: "Lock In Picks," not "Submit." "Add Game," not "Create Entry."
- Once an action completes, echo the same word back: if the button says "Lock In Picks," the confirmation says "Picks locked in," not "Success!"
- Errors are direct, no apologizing, explain what happened and what to do: "Line's already set for this game — edit it in the admin tab instead of re-fetching," not "Oops, something went wrong!"
- Empty states are an invitation, styled like a blank line on the form waiting to be filled in: "No picks yet this week" rather than a mascot/illustration.
- The masthead joke (Luke's $10 donation) can resurface subtly in a rare empty-state or milestone moment (e.g., if Luke is in last place at season's end) — but don't force it into every screen. One good joke well-placed beats the same joke repeated.

---

## Quality Floor (non-negotiable regardless of style)

- Fully responsive down to mobile — this is a 5-person group checking picks from their phones on Sunday morning
- Visible keyboard focus states
- Color contrast meets accessibility standards even with the muted/aged palette (test `--ink-body` on `--paper` and the dark-mode equivalents)
- `prefers-reduced-motion` respected — the stamp animation should have a static fallback

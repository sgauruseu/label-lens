# Live demo script — 5 minutes

**Event:** Enonic AI Hackathon, Friday quarterly meeting
**Hard limit:** 5 minutes. Rehearse with a timer until it lands at 4:30 with the laptop closed.

---

## Before you walk up

- [ ] Open the live GitHub Pages URL in a **fresh browser profile** — no saved profile, no
      history, so the demo starts from the state the audience will see.
- [ ] Grant camera permission **before** you present. Never do the permission dialog on stage.
- [ ] Have the physical products in your pocket: a jar of Nutella, a pack of almonds, and one
      product with no barcode entry (a local supermarket own-label works best).
- [ ] Paste your API key into Settings. Check the photo path works once, then clear the result.
- [ ] Open a second tab on the repository, scrolled to the green CI badge and the test count.
- [ ] **Decide the network question now.** If the meeting-room wifi is doubtful, switch Offline
      mode on in Settings before you start. Every product below is bundled; nothing changes on
      screen except one small "offline data" pill. Rehearse it this way at least once.
- [ ] Zoom the browser to 125 %. The contribution list has to be readable from the back.

---

## 0:00 — 0:30 · The problem

Hold up the Nutella jar. Read the panel out loud:

> "Sugars, 56.3 grams per 100. Emulsifier: E322. Now — is 56 a lot? What is E322? And does any
> of this break a rule I set for myself last January?
>
> The label has the data. It just refuses to answer the question."

Do not explain the app yet. Let the question sit.

## 0:30 — 1:30 · Scan it

Click **Scan with camera**, hold the jar up to the lens. The verdict appears.

> "Twenty-two out of a hundred. And here is every single point."

Scroll the **How this score was reached** card slowly. Read three lines aloud:

- `−15 Sugars are in the high band (56.3 g per 100 g).`
- `−15 About 38 % of this product's energy comes from added sugars (WHO guideline: under 10 %).`
- `−18 Ultra-processed food (NOVA 4).`

> "No black box, no model deciding for me. Published thresholds — the FSA traffic lights, the
> NOVA classification, the EU additive register — and arithmetic I can check."

## 1:30 — 2:10 · Make it personal

Go to **My rules**, tick **Avoid palm oil**, go back to **Scan**.

The flag is already there — the verdict recomputed without another lookup.

> "That is not part of the score. It is a flag. If I tell the app I avoid palm oil, that fact
> should never get averaged into a number and disappear — it should be the first thing I see."

## 2:10 — 3:00 · The contrast, and the honest failure

Scan the almonds: **92**. Say nothing for a beat, then:

> "Same rules, same arithmetic."

Now type `7622210449283` (Prince biscuits). Point at the amber warning:

> "Open Food Facts is crowd-sourced, and this entry claims 52 grams of fibre per 100 grams.
> That is not possible — and it would have bought this biscuit a bonus. So the app detects
> macronutrients that cannot add up, says so out loud, and withholds every bonus for this
> product while still applying its penalties."

**This is the slide that says the project is real.** Do not cut it.

## 3:00 — 3:50 · The one with no barcode

Hold up the own-label product.

> "About a third of what is in a Spanish supermarket is not in the database at all."

Click **Read the label from a photo**, take the picture, wait for the verdict.

> "The model's only job here is transcription — turn the printed panel into structured fields.
> It never scores anything. Scoring stays in the tested core, where I can see the rules and so
> can you."

## 3:50 — 4:30 · How it was built

Switch to the repository tab.

> "Two and a half days, built with Claude Code. Three layers: a pure domain core with no
> network, no DOM, no clock; adapters for everything impure; a thin UI.
>
> That boundary is enforced by a lint rule, not by good intentions — and it is what made **151
> unit tests at 99 % coverage** on the scoring engine possible in two days.
>
> Every push runs typecheck, lint, tests and build, then deploys to GitHub Pages. No backend,
> no account, no tracking, nothing leaves your device except the barcode lookup."

## 4:30 · Close

> "Label Lens. The label already has the data — this just answers the question."

Stop. Do not take questions inside your five minutes.

---

## If something breaks

| What fails | What you do — without pausing |
|---|---|
| Camera will not start | Type the barcode. It is one field above, already on screen. Say "typed entry is a first-class path, because camera permission is the thing that always fails on stage." |
| Network is dead | Settings → Offline mode. Every demo product is bundled. |
| Open Food Facts rate-limits you | Nothing to do — the app already falls back to the bundled copy and shows why. Point at the notice: "that is the fallback working." |
| The photo path fails | Skip it. Go straight to the architecture section; you gain 50 seconds. |
| A product scores oddly | Open the contribution list and read it. An explainable wrong answer is a better demo than a hidden right one. |

## Demo barcodes

| Barcode | Product | Score | Why it is in the script |
|---|---|---|---|
| `3017620425035` | Nutella | 22 | Palm oil, NOVA 4, three red nutrients |
| `20724696` | Almonds | 92 | The contrast; earns all three bonuses |
| `7622210449283` | Prince biscuits | 40 | The implausible-data warning |
| `5449000000996` | Coca-Cola | 55 | Drink thresholds, two medium-concern additives |
| `5000159461122` | Snickers | 16 | Backup for Nutella |
| `3229820129488` | Bjorg muesli | 85 | Backup for the almonds |

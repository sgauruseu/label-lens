# Label Lens — Product Requirements Document

**Status:** v1.0 (hackathon scope) · **Owner:** Siarhei · **Event:** Enonic AI Hackathon, Sep 2026
**Live demo:** Friday, Quarterly Meeting · **Hard limit:** 5 minutes

---

## 1. Problem

A food label answers the wrong question. It tells you there are `11 g` of sugar per 100 g and
that the product contains `E322`, but it does not tell you whether that is a lot, what `E322`
actually is, or whether it conflicts with something you personally decided to avoid.

Translating a label into a decision requires knowing reference thresholds, the EU additive
register, and food-processing classification — in a supermarket aisle, in under ten seconds.
Existing apps solve this by uploading your scanning history to a server behind an account wall.

## 2. Solution

**Label Lens** is a zero-backend web app. Point the camera at a barcode; the app looks the
product up in Open Food Facts and renders a transparent verdict: a 0–100 Label Score where
every single point gained or lost is shown with its reason, a traffic-light breakdown against
published reference thresholds, a plain-language explanation of each additive, and personal
flags for the things *you* said you avoid.

Three properties define the product:

- **Transparent.** No hidden model. Every deduction is traceable to a named, cited rule.
- **Private.** No backend, no account, no telemetry. The personal profile lives in
  `localStorage` and never leaves the device.
- **Informational, not medical.** The app reports what is on the label and how it compares to
  published reference values. It does not diagnose, prescribe, or give health advice.

## 3. Users

| User | Need | What they do in the app |
|---|---|---|
| Shopper in the aisle | "Is this as healthy as the packaging implies?" | Scans a barcode, reads the verdict in ~5 seconds |
| Person with a self-imposed rule | "Does this contain palm oil / added sugar / animal products?" | Sets a profile once, then gets a hard flag on every scan |
| Someone comparing two options | "Which of these two is the better pick?" | Scans both, opens the side-by-side compare view |

## 4. Scope — v1

### In scope

| # | Capability | Notes |
|---|---|---|
| F1 | Barcode scan via device camera | ZXing-based; `BarcodeDetector` used as a fast path when present |
| F2 | Manual barcode entry | Mandatory fallback — camera access is not guaranteed on a demo machine |
| F3 | Open Food Facts lookup | Public API v2, no key, no auth |
| F4 | Label Score 0–100 with full breakdown | Every contribution rendered as a signed, named line item |
| F5 | Traffic-light nutrient panel | Fat, saturates, sugars, salt vs. FSA per-100 g/ml thresholds |
| F6 | Additive explanations | Local E-number register with regulatory notes |
| F7 | Processing level (NOVA) + Nutri-Score | Passed through from Open Food Facts, explained in plain language |
| F8 | Personal profile with hard flags | Palm oil, added sugar, vegan, vegetarian, high salt, named E-numbers |
| F9 | Scan history | Last 50 scans, `localStorage`, clearable |
| F10 | Side-by-side compare of two products | Picked from history |
| F11 | Offline fixture mode | Bundled real product responses; app fully usable with no network |
| F12 | AI ingredient reading from a photo | Bring-your-own API key; parses an ingredient list into the same engine |
| F13 | Energy per 100 g **and per package** | Net quantity parsed from the label text; package total shown against the EU reference intake |
| F14 | Better alternatives in the same category | Legacy search endpoint (the only CORS-capable one), loaded on demand, cached, with a bundled fallback |
| F15 | Source and producer links | Open Food Facts page always; the producer's own site only when the database has one, never guessed, and validated before rendering |

### Explicitly out of scope

Accounts and sync · server-side anything · nutrition tracking or calorie diaries · meal
planning · recipes · product editing or contributions back to Open Food Facts · native mobile
apps · i18n beyond English UI strings (the product data is already multilingual).

## 5. Domain model

The scoring engine is pure: it takes a normalized `Product` and a `Profile`, and returns a
`Verdict`. It performs no I/O, reads no globals, and touches no clock — which is exactly why it
is the part that gets exhaustive unit tests.

```
OFF JSON ──normalize()──▶ Product ──┐
                                    ├──▶ evaluate() ──▶ Verdict
        Profile (localStorage) ─────┘
```

### 5.1 Label Score

Starts at 100. Every adjustment is a named `ScoreContribution` rendered in the UI.

| Rule | Adjustment | Cap |
|---|---|---|
| Nutrient at **amber** level | −6 each | — |
| Nutrient at **red** level | −15 each | −60 total across the four nutrients |
| NOVA 2 / 3 / 4 | −3 / −8 / −18 | — |
| Added sugars above 10 % / 20 % of energy | −8 / −15 | — |
| Additive, concern level low / medium / high | 0 / −3 / −7 | −20 total |
| Fibre ≥ 6 g per 100 g | +5 | — |
| Protein ≥ 12 g per 100 g | +3 | — |
| Fruit/veg/nut content ≥ 40 % | +5 | — |

Clamped to 0–100. Bands: **80–100** good · **60–79** fair · **40–59** poor · **0–39** bad.

The added-sugar rule uses the WHO free-sugars guideline of under 10 % of energy intake, with a
further conditional recommendation of under 5 %. Sugar contributes 4 kcal per gram, so the
share is computed from the label's own energy figure rather than from a fixed gram threshold —
which is what makes it work for a drink and a spread alike.

The score is a presentation of published reference values, not a scientific instrument, and the
UI says so.

### 5.1.1 Implausible source data

Open Food Facts is crowd-sourced and the figures are sometimes impossible — one of the bundled
fixtures lists 52 g of fibre per 100 g for a biscuit. Normalization rejects any single mass
above 100 g per 100 g, and flags a product whose macronutrients sum past 105 g, whose sugars
exceed its carbohydrates, or whose saturates exceed its total fat.

A flagged product keeps its penalties but **forfeits every bonus**. The asymmetry is
deliberate: bad data should not be able to buy points, but it should not buy an escape from the
penalties the plausible figures already earned either. The warning is shown to the user.

### 5.1.2 Energy

Energy is reported twice: per 100 g or 100 ml as the label states it, and for the whole
package. The second figure is the one people reason with — "539 kcal per 100 g" means little,
"the jar is 5390 kcal" means a great deal — and it is always labelled with the package size it
was derived from so it can never be mistaken for a serving.

The package total is also expressed as a share of the **2000 kcal** daily reference intake used
on EU front-of-pack labels (Regulation 1169/2011, Annex XIII). The UI states that this is a
labelling reference for an average adult, not a personal target.

Net quantity arrives as free text written by whoever entered the product, so parsing it is
conservative: it handles `1 kg`, `375 g`, `200g`, `50 G`, `330 ml`, `33 cl`, decimal commas
(`1,5 L`), the EU estimated sign (`300 g e`, `℮`) and multipacks (`6 x 33 cl`). Non-metric units
and unreadable text produce no package figure at all, because a wrong package size yields a
confidently wrong calorie count.

### 5.1.3 Alternatives

Scoring a product at 22 is half an answer; the other half is what to buy instead. The app
searches the same category and offers up to three products that are **strictly better**.

They are ranked by the **official Nutri-Score, not by the Label Score**. The search endpoint
returns a summary with gaps, and computing our own score from partial data would be a confident
number built on absences. The card says which scale it is using, and tapping a suggestion runs
the full lookup and the real verdict.

Two network facts, both established by testing, shaped the implementation:

- `/api/v2/search` and `search.openfoodfacts.org` send **no CORS headers** and are unusable from
  a static page. The legacy `/cgi/search.pl` works.
- Search is rate-limited far harder than product lookup — two in quick succession already fail.

Hence: on demand rather than on every scan, cached per session, at most two live attempts
walking from the most specific category upward (a leaf category such as
`confectionary-based-spreads` holds a handful of products where `hazelnut-spreads` holds
thousands), and a bundled fallback set so the feature survives the meeting-room wifi.

### 5.1.4 Links

Two links can sit under a product, and they differ in kind.

The **Open Food Facts page** is derived from the barcode, so it always exists. It is the source
of the data, the place to check the app against, and the honest attribution for ODbL data.

The **producer's page** comes from the crowd-sourced `link` field. Measured on six real
products: Nutella and Coca-Cola have one, and none of the four suggested alternatives do. It is
shown when present, omitted when absent, and **never constructed from a brand name** — a URL
nobody verified is worse than no URL at all.

Because that field is written by strangers, its value is validated before rendering: only
`http` and `https` survive, a hostname must contain a dot, and everything else is dropped. A
`javascript:` value in an `href` is a script-injection vector, and this is precisely the
boundary where untrusted data becomes a link someone clicks.

### 5.2 Nutrient thresholds

UK FSA front-of-pack traffic-light thresholds. Solids per 100 g, drinks per 100 ml.

| Nutrient | Green ≤ | Red > | Drinks green ≤ | Drinks red > |
|---|---|---|---|---|
| Fat | 3.0 g | 17.5 g | 1.5 g | 8.75 g |
| Saturates | 1.5 g | 5.0 g | 0.75 g | 2.5 g |
| Sugars | 5.0 g | 22.5 g | 2.5 g | 11.25 g |
| Salt | 0.3 g | 1.5 g | 0.3 g | 0.75 g |

Anything between green and red is amber.

### 5.3 Additive concern levels

Levels are assigned on **regulatory** grounds, never on health speculation:

- **high** — banned as a food additive in the EU, or carries a legally mandated warning
  (the six "Southampton" colours must be labelled *"may have an adverse effect on activity and
  attention in children"*), or is a declarable allergen at threshold (sulphites).
- **medium** — subject to restricted use, an ADI limit, or an open EFSA re-evaluation.
- **low** — no restriction beyond normal good manufacturing practice.

Every entry carries a one-line plain-language description and the reason for its level.

### 5.4 Personal flags

Profile rules produce **hard flags**, not score changes — a flag is a yes/no fact about the
product, and mixing it into a numeric score would hide it.

| Rule | Source of truth |
|---|---|
| Avoid palm oil | `ingredients_analysis_tags` |
| Avoid added sugar | `nutriments["added-sugars_100g"]` + ingredient scan |
| Vegan / vegetarian only | `ingredients_analysis_tags` |
| Low salt | salt above the amber threshold |
| Avoid specific E-numbers | user-entered list matched against `additives_tags` |

## 6. Architecture

```
src/
  core/        pure domain — no fetch, no DOM, no localStorage, no Date.now()
    types.ts           Product, Profile, Verdict, ScoreContribution
    thresholds.ts      FSA traffic-light reference values
    additives.ts       E-number register with concern levels + descriptions
    normalize.ts       Open Food Facts JSON -> Product
    score.ts           evaluate(product, profile) -> Verdict
    profile.ts         profile defaults, validation, rule evaluation
  adapters/    everything impure, each behind an interface so it can be faked in tests
    offClient.ts       Open Food Facts v2 + fixture fallback
    aiClient.ts        BYO-key vision call, ingredient text -> Product
    storage.ts         localStorage wrapper, quota- and privacy-mode-safe
    scanner.ts         ZXing camera scanner, BarcodeDetector fast path
  ui/          React components — thin, no business logic
  fixtures/    real captured OFF responses; the offline demo runs on these
```

**The rule that keeps this honest:** `src/core/` may not import from `src/adapters/` or
`src/ui/`. Enforced by an ESLint boundary rule and by the fact that core tests run with no DOM
and no network.

## 7. Milestones

Each milestone ends with a **working, deployed application**. There is never a broken `main`.

### M1 — Skeleton is live (Tuesday, half day)

- Repository, Vite + React + TypeScript + Vitest, ESLint boundary rule.
- `core/` complete: thresholds, additive register, normalize, scoring engine.
- Unit tests for the scoring engine covering each rule and each cap.
- GitHub Actions: typecheck → lint → test → build → deploy to Pages.
- **Acceptance:** the public URL is live and green, tests pass in CI, a hardcoded fixture
  product renders a full verdict on screen.

### M2 — Real products (Wednesday morning)

- Open Food Facts adapter, manual barcode entry, loading/error/not-found states.
- Verdict UI: score ring, contribution list, traffic-light panel, additive cards.
- Fixture fallback triggered by network failure, rate limit, or an explicit offline toggle.
- **Acceptance:** typing `3017620425035` returns the full Nutella verdict; pulling the network
  cable degrades to fixtures without a crash.

### M3 — Camera and profile (Wednesday afternoon)

- ZXing camera scanner with torch toggle and a clear permission-denied path.
- Profile editor, personal flags on the verdict, history, side-by-side compare.
- **Acceptance:** scanning a real product with a phone or laptop camera works end to end;
  enabling "avoid palm oil" makes a flag appear on Nutella.

### M4 — AI reading and polish (Thursday)

- BYO-key settings screen, vision call that turns a photo of an ingredient list into a
  `Product`, routed through the same scoring engine.
- Responsive pass, dark mode, empty/error states, accessibility pass.
- README, screenshots, demo script, fixture set for the demo products.
- **Acceptance:** a photo of a label with no barcode produces a verdict; the repository is
  complete by Thursday end-of-day.

### Cut list (dropped in this order if time runs short)

AI photo reading → compare view → torch toggle → dark mode. The core demo survives all four
cuts.

## 8. Risks

| Risk | Impact | Mitigation | Status |
|---|---|---|---|
| Open Food Facts blocks browser requests (CORS) | Fatal | Verified cross-origin on day 0 — `Access-Control-Allow-Origin` is open | ✅ closed |
| `BarcodeDetector` missing on the demo machine | Fatal for the live scan | Confirmed absent in Chrome on Windows; ZXing is the primary path, not the fallback | ✅ closed |
| OFF rate limit: 15 product requests/min/IP | Demo stalls | Cache every response in `localStorage`; bundled fixtures for all demo products | planned |
| No camera permission on the meeting-room machine | Live scan dies on stage | Manual barcode entry is a first-class feature, not a fallback; demo phone as backup | planned |
| No network in the meeting room | Total failure | Full offline mode on bundled fixtures, toggleable before going on stage | planned |
| AI key exposed in the browser | Reputational | BYO key, `localStorage` only, never committed, warning shown in settings | planned |
| Product missing from Open Food Facts | Dead end on stage | AI photo path, plus a demo product list verified in advance | planned |

## 9. Non-goals and disclaimers

Label Lens presents publicly available product data alongside published regulatory reference
values. It is not a medical device, gives no dietary or medical advice, and the Label Score is
a transparent arithmetic summary, not a scientific assessment. The UI states this on the verdict
screen, not buried in a footer.

## 10. Definition of done

- [ ] Public GitHub repository, permissive licence, clean history
- [ ] Green CI on `main`: typecheck, lint, unit tests, build
- [ ] Live GitHub Pages URL
- [ ] Scoring engine at ≥ 90 % line coverage
- [ ] README with screenshots, setup, and architecture
- [ ] Demo script rehearsed under 5 minutes, with the offline path rehearsed too

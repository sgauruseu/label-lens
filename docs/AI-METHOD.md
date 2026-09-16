# Building software with an AI agent: what actually worked

**A field report from the Enonic AI Hackathon — September 2026**
Siarhei · two projects, 2.5 days, built with Claude Code

---

## Why this document exists

The hackathon brief said "build something big and cool with Claude Code". The more useful
question underneath it is **how** — what you have to ask for, and what you have to check, to get
software you would actually put your name on.

This is an account of that, written from the real session. Every number is measured, every bug
listed was a bug that actually happened, and the prompts quoted are the ones that changed the
outcome.

---

## 1. What was built

| | **Label Lens** | **Meme Reply** |
|---|---|---|
| What it does | Scan a food barcode, get an explained verdict and better alternatives | Say anything in RU/EN, get an attributed comeback |
| Live | `sgauruseu.github.io/label-lens/` | `sgauruseu.github.io/meme-reply/` |
| Source lines | 3 470 | 2 052 |
| Test lines | 1 267 | 399 |
| Unit tests | **242** | **55** |
| Coverage of the domain core | 99 % lines | 99 % lines |
| Backend | none | none |

**297 tests in total.** Both deploy from CI to GitHub Pages on every push to `main`.

---

## 2. The shape of the process

Five phases emerged, and the order mattered more than anything else.

### Phase 1 — Choose by demo value, not by technical interest

Three ideas were on the table: a PDF toolkit, a general "helper" app, a food-label scanner. The
deciding question was not "which is most interesting to build" but **"which one survives five
minutes on a stage"**. The helper app had no scope to break into milestones. The PDF toolkit was
a commodity. The scanner let someone hold up a real jar of Nutella.

That question also killed a feature later: an idea is only worth building if you can say what
the audience sees.

### Phase 2 — Verify the fatal assumptions before designing around them

This is the phase that is easiest to skip and most expensive to skip. Before a line of product
code, four assumptions were tested against the live internet:

| Assumption | Result | What it changed |
|---|---|---|
| Open Food Facts allows browser requests | ✅ CORS open, verified cross-origin from a third-party page | The no-backend design is possible at all |
| `BarcodeDetector` exists in the demo browser | ❌ **absent in Chrome on Windows** | ZXing became the primary decoder, not the fallback. Would have killed the live demo |
| Quote APIs `quotable.io`, `zenquotes.io` work | ❌ **no CORS headers** | Unusable from a static site; had to find three others |
| Browser speech recognition is local | ❌ **Chrome sends audio to a remote service** | Product had to disclose it above the microphone |

Two of these four reversed a design decision. **Checking cost about twenty minutes; discovering
them on Friday would have cost the demo.**

> The prompt that produced this: *"Проверь, что реально работает сегодня, а не по документации."*
> Asking for verification against reality rather than against documentation is the single
> highest-leverage instruction in this whole report.

### Phase 3 — Write the rules down once, then enforce them mechanically

A `CLAUDE.md` in each repository states the working agreement. The rule that carried the most
weight:

> `src/core/` is pure. No `fetch`, no `window`, no `localStorage`, no `Date.now()`, **and no
> `Math.random()`**.

An ESLint boundary rule fails the build if `core/` imports an adapter, a component, or touches a
browser global. **A written rule that is not enforced is a suggestion**; the lint rule is why the
boundary held under time pressure rather than eroding.

That purity is not aesthetics — it is what made 297 tests possible in two days. A pure function
needs no mocks, no DOM, and no network, so a test costs three lines instead of thirty.

The `Math.random()` clause deserves its own note. Meme Reply's matcher exists to be
unpredictable. Making randomness a **parameter** rather than a call is what allows an
unpredictable function to have deterministic tests:

```ts
pickReply(input, { lang, randomValue: 0.42 })  // tests pass a fixed number
```

### Phase 4 — Build in vertical slices that stay deployable

Never a broken `main`. Each milestone ended with a working, deployed application. The first
deploy to a live URL happened before most features existed, which meant deployment was never an
unsolved problem waiting at the end.

### Phase 5 — Check the built artefact, not the intention

Covered in full in section 4. The short version: **unit tests and a running browser catch
completely different classes of mistake, and you need both.**

---

## 3. Prompts that changed the outcome

Not a prompt library — the specific instructions whose absence would have produced worse
software.

### "Verify it against reality first"

Produced the four findings in Phase 2. Without it the agent would have designed confidently
around `BarcodeDetector` and `quotable.io`, both of which do not work.

### "Ask me the questions that change what you build"

Before building, the agent asked about stack, languages, and where content comes from. Each
answer removed a whole branch of wasted work. The failure mode this avoids is an agent producing
something plausible and complete against assumptions nobody stated.

### "Show the arithmetic"

A product requirement — every point of the score is displayed with its reason — that turned out
to be a **testing requirement in disguise**. A scoring engine that must explain itself cannot
hide its logic in an opaque blob, so every rule became individually assertable.

### "Say the uncomfortable thing in the product itself"

Label Lens sells itself on privacy. Meme Reply cannot: Chrome sends your voice to Google. The
instruction to state that above the microphone button, rather than omit it, is what separates a
demo from a product. The same instinct produced the "random" label on unmatched replies and the
"bonuses withheld" line on products with impossible data.

### "Tell me what you could not verify"

Every report ended with the gap: the cloud environment could not reach the joke APIs, so the
live-fetch path was only ever observed falling back. Knowing *that* before Friday is worth more
than a confident claim that everything works.

### The anti-pattern: asking for a feature without asking what it costs

The one case where scope was pushed back on rather than delivered: the briefing itself says two
tight milestones with a flawless demo beat an ambitious project that breaks. With two apps
deployed and five minutes to fill, every additional feature competes with rehearsal — not with
idle time.

---

## 4. Verification: what was checked, and what it caught

Six independent layers. Each caught something the others could not.

### Layer 1 — Type checking

TypeScript strict, `noUncheckedIndexedAccess`, no `any`, no non-null assertions.

Design decision it enforced: nutrient values are `number | undefined`, never `0` standing in for
"unknown". The type system then made it impossible to silently score a missing value as a
perfect one.

### Layer 2 — Lint, including an architecture rule

Standard rules plus the `core/` boundary. Caught real leakage during development, and caught
scratch scripts accidentally left in the repository.

### Layer 3 — Unit tests on pure logic

297 tests. Not written afterwards — written in the same commit as the feature, per the working
agreement. Coverage threshold of 90 % on the domain core is enforced **in CI**, so it cannot
quietly decay.

What they are good at: boundary values, caps, missing data, "does this rule fire exactly when it
should".

Example of the style — the FSA threshold boundary is inclusive at the bottom and exclusive at
the top, so a value sitting exactly on the red line is amber:

```ts
it.each([
  ['sugars', 22.5, 'amber'],
  ['sugars', 22.51, 'red'],
])(...)
```

### Layer 4 — Running the built application in a headless browser

Playwright drove the real production build: clicked the demo product, read the rendered score,
toggled a personal rule, checked the flag appeared, opened the alternatives card, collected
console errors.

**This layer caught five bugs that no unit test would ever have caught**, because they were all
about what the assembled application actually shows.

### Layer 5 — Looking at the screenshot

Reading the rendered page as a human would. Caught the grammar bug and the broken-image bug.
Automated checks confirm what you thought to assert; looking at the output catches what you did
not think of.

### Layer 6 — CI on every push

Typecheck → lint → tests with coverage → build → deploy. Green badge in the README, and the
deploy only happens if everything passed.

---

## 5. Every bug the checks caught

This is the honest part. An AI agent writes plausible code quickly, and plausible is not the
same as correct.

| # | Bug | Caught by | Root cause |
|---|---|---|---|
| 1 | Russian stemmer put `работа` and `работаю` in different buckets, so half of all matches silently missed | Unit test asserting all forms of a word collapse to one stem | Russian stacks endings; one pass of suffix-trimming is not enough |
| 2 | "I need more coffee before this meeting" answered **"a friend in need is a friend indeed"** | Browser walkthrough | `need` was scored as a topic word. Function words hijack keyword matching |
| 3 | "Saturates **is** in the high band" | Reading the screenshot | Two of four nutrient names are plural; the sentence template had one verb |
| 4 | "100 % less salt" instead of "no salt" | Browser walkthrough | Zero needs its own wording; the percentage formula is arithmetically right and reads like a machine |
| 5 | Alternatives searched `confectionary-based-spreads` (a handful of products) instead of `hazelnut-spreads` (3 429) | Browser walkthrough | "Most specific category" is not reliably the best comparison set |
| 6 | A coffee question answered with a proverb about shopkeepers | Browser walkthrough | A tag applied to the wrong corpus entry — a data bug, not a code bug |
| 7 | Card said "offline mode is on" when only the product came from a fixture | Reading tool output | Two different meanings of "offline" conflated in one flag |
| 8 | Broken product image left an empty white square | Reading the screenshot | Hotlinked images 404 sometimes; no error handler |
| 9 | A biscuit listed with **52 g of fibre per 100 g** would have earned a "high fibre" bonus | Inspecting the real data before trusting it | Crowd-sourced data is sometimes impossible, and impossible data flatters |

**Six of nine were caught by running the thing and looking at it.** Three were caught by tests.
None were caught by reading the code.

Every one of them is now covered by a regression test, including the two that were data bugs
rather than code bugs.

### The one that became a feature

Bug 9 is the interesting one. Instead of correcting the single entry, the rule was generalised:
detect nutrition figures that cannot be true (macronutrients summing past 105 g, sugars above
carbohydrates, saturates above fat), **show the warning to the user, and withhold every bonus
while keeping every penalty.** Bad data should not be able to buy points, but it should not buy
an escape from the penalties the plausible figures already earned.

A defect handled honestly became the most convincing thirty seconds of the demo.

### Security got the same treatment

The producer link comes from a crowd-sourced field and lands in an `href`. `safeProducerUrl`
rejects anything that is not plain `http`/`https` — `javascript:`, `data:` and `file:` all have
explicit refusal tests. This is exactly the boundary where untrusted data becomes something a
person clicks, and an agent will not guard it unless asked.

---

## 6. What the agent could not do

Being precise about the limits is more useful than a success story.

- **It cannot know today's internet.** Every fact about a live API — CORS, rate limits, which
  fields are populated — had to be measured. Four of them contradicted the obvious assumption.
- **It cannot judge coverage of a data field.** The producer-link field exists in the schema;
  measuring six real products showed only the two big brands have one. Schema presence and data
  presence are different questions.
- **It does not feel a wrong answer.** "A friend in need" is defensible code and an absurd reply.
  That gap only closes by running it and reading the result.
- **It will not volunteer an uncomfortable limitation** unless the honesty is asked for as a
  requirement.
- **Environment beats intention.** The cloud sandbox had no route to the joke APIs; a Windows
  update broke the local shell. Neither is fixable by better prompting — both had to be worked
  around and stated.

---

## 7. The checklist

What to reuse on the next project.

**Before building**
- [ ] Name the fatal assumptions and test each against the live system
- [ ] Answer the questions that change what gets built — stack, language, data source
- [ ] Write the working agreement down, with one rule that matters most
- [ ] Decide what the audience will see

**While building**
- [ ] Keep the domain logic pure; put every impurity behind an interface
- [ ] Make randomness and time parameters, never calls
- [ ] Write the test in the same commit as the feature
- [ ] Keep `main` deployable at every step
- [ ] Enforce the architecture with a lint rule, not with discipline

**Before believing it works**
- [ ] Typecheck, lint, unit tests, coverage threshold — all in CI
- [ ] Drive the built application in a real browser
- [ ] **Look at the screenshot**
- [ ] Check the real data before trusting it
- [ ] Validate every piece of third-party data that reaches an `href`, a query or the DOM
- [ ] Write down what you could *not* verify

---

## The one-sentence version

An AI agent will produce a plausible, well-structured, confidently wrong program in minutes —
and the entire difference between that and working software is **what you verify before you
design, and what you check after it builds.**

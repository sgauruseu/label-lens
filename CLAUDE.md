# CLAUDE.md — working agreement for this repository

Read `PRD.md` before changing anything. It is the source of truth for scope, scoring rules and
milestones. If a request contradicts the PRD, say so instead of silently diverging.

## The one rule that matters

`src/core/` is pure. It must not import from `src/adapters/`, `src/ui/`, or any browser or Node
API. No `fetch`, no `window`, no `localStorage`, no `Date.now()`, no randomness. Everything
impure lives in `src/adapters/` behind a narrow interface so tests can replace it.

If you find yourself wanting to call an API from `core/`, the design is wrong: pass the data in
as an argument instead.

## Architecture

```
src/core/       pure domain logic          — exhaustively unit tested
src/adapters/   I/O: network, storage, camera, AI — thin, interface-first
src/ui/         React components           — presentation only, no business logic
src/fixtures/   captured real API responses — powers offline mode and tests
```

Dependencies point inward only: `ui → adapters → core`. Never the reverse.

## Testing

- Every rule in the scoring engine gets a test, including its boundary values and its cap.
- Tests are written **with** the feature, in the same commit — never "added later".
- Core tests use no DOM environment and no network. If a test needs either, it is not a core
  test.
- Fixtures are real captured responses, not invented JSON. Invented JSON hides schema drift.
- `npm test` must be green before any commit. Do not commit a red `main`.

## Code conventions

- TypeScript strict mode. No `any`. No non-null assertions (`!`) — narrow the type instead.
- Nutrient values are `number | undefined`, never `0` as a stand-in for "unknown". A missing
  value must render as "no data", not as a perfect score.
- Exported functions carry a short doc comment stating what they do and citing the rule from
  the PRD where relevant.
- No new runtime dependency without a reason written in the commit message. The bundle ships to
  GitHub Pages and stays small.

## Commits

- One logical change per commit; imperative present tense, e.g. `add salt threshold to scorer`.
- Reference the milestone when a commit completes one: `M2: fixture fallback on network error`.
- Never commit an API key, a `.env` with secrets, or a personal profile fixture.

## Things that are deliberately not here

No backend, no accounts, no analytics, no telemetry, no cookies, no service worker beyond
static caching. If a change would add any of these, stop and ask.

## Health claims

This app reports label data and compares it to published reference thresholds. Never write copy
that diagnoses, prescribes, or claims a health outcome. "High in sugars compared to the FSA
reference" is correct. "Bad for you" or "will raise your blood sugar" is not. Every additive
note states its regulatory status, not a health verdict.

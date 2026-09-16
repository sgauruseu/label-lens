# WebdriverIO vs Playwright — the same tests, twice

Label Lens carries two UI suites that overlap on purpose:

| | Playwright | WebdriverIO |
|---|---|---|
| Location | `tests/` | `testing/spec/` |
| Language | TypeScript | JavaScript |
| Runner | Playwright Test | Mocha |
| Structure | fixtures + helpers | Page Objects (`testing/pageobjects/`) |
| Command | `npm run test:ui` | `npm run test:wdio` (testrunner) · `npm run test:standalone` |

The WebdriverIO side runs **two ways from the same spec files** — see *Testrunner vs standalone*
below.

The WebdriverIO suite covers a **subset** — 15 of the 33 Playwright tests, chosen to hit every
interesting case: text assertions, arithmetic over a list of elements, `localStorage` seeding,
element counts that settle asynchronously, and elements that must *not* exist.

This is not a review written from documentation. Every claim below came out of making both
suites green against the same application.

---

## The numbers

Measured on the same machine, same application, cold each time.

| | Playwright | WebdriverIO |
|---|---|---|
| Tests | 33 | 15 |
| Lines of test code (specs + helpers + config) | 549 | 532 testrunner · 830 with standalone |
| Lines per test | 16.6 | 35.5 |
| Wall clock, build included | 15.8 s | 20.8 s |
| Wall clock per test | 0.48 s | 1.39 s |
| Direct dev dependencies | 1 | 9 |
| Installed size | 19 MB | 25 MB |
| Browser binary | managed by the tool | managed by the tool (WDIO 9) |

The per-test figures are the honest comparison, and the gap is roughly **3×** on both size and
speed. Neither number is a scandal — 15 WebdriverIO tests still run in twenty seconds — but at
300 tests the difference stops being academic.

---

## Where the extra lines came from

Line counts do not lie about *what* costs more. Four things did:

### 1. Starting the application

Playwright treats "the app under test" as part of the config:

```ts
webServer: {
  command: 'npm run build && npx vite preview --port 4800 --strictPort',
  env: { VITE_BASE: '/' },
  url: ORIGIN,
  reuseExistingServer: !process.env.CI,
}
```

Four meaningful lines. It builds, waits for the URL to answer, reuses a server that is already
up, and kills what it started.

WebdriverIO has no such concept. `testing/server.js` spawns the build, waits for it to exit,
spawns the preview server, polls the URL until it answers, reuses one that is already up, and
exposes a stop function — **76 lines written by hand**, including a `waitForServer` helper that
exists only because nothing above it will wait. It is its own module because both WebdriverIO
modes need exactly the same thing.

### 2. Seeding `localStorage` before the app boots

Both suites run against bundled fixtures with offline mode on, so no test depends on Open Food
Facts being up. Turning offline mode on means writing `localStorage` **before React reads it**.

Playwright has `addInitScript`, which runs before the page's own scripts on every navigation:

```ts
await page.addInitScript(([key]) => {
  window.localStorage.setItem(String(key), JSON.stringify({ offlineMode: true, … }));
}, [SETTINGS_KEY]);
await page.goto('/');
```

WebDriver has no equivalent — you cannot touch storage for an origin the browser has not visited
yet. So the WDIO version is **navigate → write storage → reload**:

```js
await browser.url('/');
await browser.execute((key) => window.localStorage.setItem(key, …), SETTINGS_KEY);
await browser.refresh();          // the app has already booted once with the old storage
```

Every test boots the application twice. That is most of the per-test time difference, and it is
not something a better-written page object can remove: it is the protocol showing through.

### 3. Selectors

Playwright's locators compose. WebdriverIO's do not, in two places that came up immediately.

**Scoping a text selector.** `$('nav.tabs button=Scan')` is rejected — `invalid selector` — because
the whole string is parsed as one selector and `=text` is not a CSS suffix. It has to be chained:

```js
$('nav.tabs').$('button=Scan')                          // WebdriverIO
page.locator('nav.tabs').getByRole('button', { name: 'Scan' })   // Playwright
```

**Finding a parent by its child.** "The `.card` whose `h3` says Energy" is a query CSS cannot
express at all. Playwright has a first-class filter:

```ts
page.locator('.card').filter({ has: page.locator('h3', { hasText: /^energy$/i }) })
```

WebdriverIO has XPath, and since headings are upper-cased by CSS while XPath reads the *DOM*
text, and XPath 1.0 has no `lower-case()`, the case-insensitive version is spelled out by hand:

```js
$(`//div[contains(@class,'card')][.//h3[translate(normalize-space(),` +
  `'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')='energy']]`)
```

Worth noting that the *rendered vs DOM text* trap bit both suites, just differently: WDIO's
`=text` selectors compare rendered text and need capitals, its XPath needs the original case, and
Playwright's `hasText` compares rendered text and needs a `/…/i` regex.

### 4. Assertions that wait for a set to settle

`expect(locator).toHaveCount(3)` polls until the page settles. WebdriverIO's
`expect(elements).toHaveLength(3)` takes a snapshot of an already-resolved array, so a list that
fills in asynchronously needs the wait spelled out:

```js
await browser.waitUntil(async () => (await scan.alternatives).length === 3, {
  timeout: 10_000,
  timeoutMsg: 'expected three alternatives to appear',
});
```

Three of the 15 tests needed this. It works, and it is more code that can be got subtly wrong.

---

## Testrunner vs standalone — WebdriverIO's two modes

The same 15 tests, the same Page Objects, two entirely different ways of getting a browser.

**Testrunner mode** (`npm run test:wdio`) is the `@wdio/cli` process. It reads `wdio.conf.js`,
spawns a worker per spec file, creates a session for each, and injects `browser`, `$`, `$$` and
`expect` as globals *before the spec file is loaded*. Parallelism, reporters, retries and hooks
are all config.

**Standalone mode** (`npm run test:standalone`) uses WebdriverIO as an ordinary library. Plain
Mocha runs the tests; `testing/pageobjects/WebDriverHelper.js` calls `remote()` itself, reads its
settings from `testing/browser.properties`, and assigns the globals by hand so the shared Page
Objects keep working. Nothing is injected, and nothing is magic.

| | Testrunner | Standalone |
|---|---|---|
| Command | `npm run test:wdio` | `npm run test:standalone` |
| Wall clock, 15 tests | 14.0 s | **8.3 s** |
| Browser sessions | one per spec file (2) | one for the whole run |
| Parallel workers | yes, by config | no (Mocha is serial) |
| Config | `wdio.conf.js` | `.mocharc.json` + `browser.properties` + 149-line helper |
| Reporters, retries, video | built in | whatever Mocha has |

Standalone is **40 % faster here purely because it opens one browser instead of two** — and that
is also its liability: fifteen tests share one session, so anything one test leaves behind
(a cookie, a scroll position, an open dialog) is visible to the next. This suite gets away with
it because every test calls `openApp()`, which resets `localStorage` and reloads. The moment
that discipline slips, the failures become order-dependent, and order-dependent failures are the
worst kind to debug.

### When standalone earns its keep

- The session has to be created by **code you control** — custom capabilities per test, a
  Selenium Grid or cloud provider with its own auth, a browser that must outlive one spec file.
- You are **adding browser tests to a Mocha/Jest suite that already exists**, and introducing a
  second test runner is not worth it.
- The thing you are writing **is not a test at all** — a scraper, a smoke check in a deploy
  script, a screenshot generator.

For a suite that is only ever run as a suite, the testrunner is the better default: it gives
parallelism, per-spec isolation and reporters for free, and the config is shorter than the
helper it replaces.

### Two traps worth recording

**`ReferenceError: before is not defined`.** A file loaded through Mocha's `--require` runs
*before* Mocha installs its BDD globals, so it cannot call `before()` — or a helper like
`setupBrowser()` that calls it. Root hooks have to be exported as a `mochaHooks` object instead,
which Mocha registers once the globals exist. The error message points at the symptom and says
nothing about the cause.

`setupBrowser()` is still the right shape for the classic pattern — called *inside* a spec file's
`describe`, where the globals do exist, so that the file owns its own browser. Both are supported
here; the suite-wide session uses `mochaHooks`.

**CommonJS/ESM interop.** The version of this helper that started the exercise opened with

```js
let propertiesReaderModule = require('properties-reader');
let propertiesReader = propertiesReaderModule.propertiesReader || propertiesReaderModule.default || …
```

That chain of `||` is what `require()` of a dual-published package looks like from inside a
project whose `package.json` says `"type": "module"` — the call either throws outright or returns
a namespace object whose shape depends on how the dependency was built. A plain
`import propertiesReader from 'properties-reader'` has one meaning and needs no fallbacks. It is
a small thing, but it is the sort of small thing that makes a standalone harness feel fragile.

---

---

## What WebdriverIO does better

This is not a one-sided comparison, and a fair report has to say so.

- **Real cross-browser reach.** WebDriver is a W3C standard, so the same suite runs against
  Safari on a real Mac, a real iPhone or Android device via Appium, and every commercial grid
  (BrowserStack, Sauce Labs) with a config change and no code change. Playwright bundles its own
  browser builds — excellent for Chromium, Firefox and WebKit, but WebKit is not Safari, and
  there is no real-device story.
- **One tool for web and mobile.** A team already running Appium gets the same API, the same
  Page Objects and the same reporters for both. That is a genuine organisational saving that no
  benchmark shows.
- **Page Objects are the house style.** Not a WebdriverIO feature as such, but the ecosystem,
  docs and examples all assume them, so a team inherits one obvious structure instead of
  arguing about fixtures.
- **Protocol transparency.** Every action is a documented WebDriver call. When something behaves
  oddly, you can read the wire log and see exactly what the browser was asked to do.
- **Maturity.** Ten years of plugins, services and CI integrations.

---

## What Playwright does better

- **Auto-waiting that covers the whole assertion.** `expect(…).toBeEnabled()` re-evaluates until
  it holds; actions wait for the element to be visible, stable, unobstructed and enabled, with no
  timeout of their own. The WebdriverIO suite needed three explicit `waitUntil` calls; the
  Playwright suite needed none.
- **Strict locators.** Two matches is an error, not a silent first-wins.
- **Accessibility-first locators.** `getByRole('button', { name: 'Look up' })` finds the element
  the way a screen reader would, so the test breaks when the accessible name breaks. CSS
  selectors survive that kind of regression without noticing.
- **Trace viewer.** A failed test leaves a `trace.zip` with a DOM snapshot at every step, plus
  network and console. Nothing in the WebdriverIO ecosystem is close.
- **Parallelism out of the box** — workers, sharding, per-test isolated browser contexts.
- **First-class TypeScript**, which caught real mistakes in the Playwright suite at compile time
  that the JavaScript suite could only find by running.

---

## The lint story, which is its own data point

The ESLint config needed a whole extra block for `testing/`, and the reason is instructive:

```js
globals: { ...globals.node, ...globals.mocha, ...globals.browser, browser: 'readonly', $: … }
```

A WebdriverIO spec mixes two runtimes in one file — most of it runs in Node, but the callback
passed to `browser.execute()` is serialised and runs inside the page. The linter cannot tell them
apart, so browser globals have to be allowed everywhere in that folder, which means a stray
`document` in Node-side code lints clean and fails at runtime.

In the Playwright suite the same boundary is enforced by the type system: the callback passed to
`page.evaluate()` is typed as browser code, and Node values only cross the boundary if they are
serialisable. Same hazard, caught at compile time instead of at 2 a.m.

---

## Conclusion

For **this** project — a static web app, Chromium-first, tested in CI — Playwright is the better
fit, and the measurements support what the code already suggested: a third of the lines and a
third of the runtime, with stronger failure modes (strict locators, trace viewer, types).

That conclusion does not generalise. Pick WebdriverIO when the suite must also drive real Safari
or real mobile devices, when a grid is already in place, or when a team is already fluent in it —
those constraints outweigh a 3× difference in lines of test code, and no benchmark here touches
them.

The honest summary is that the tools are not competing on the same axis. Playwright optimises for
*developer feedback speed on the browsers it ships*. WebdriverIO optimises for *reach across
every browser and device that speaks WebDriver*. This project needed the first.

---

## Running them

```bash
npm run test:ui          # Playwright — 33 tests
npm run test:wdio        # WebdriverIO, testrunner mode — 15 tests
npm run test:standalone  # WebdriverIO, standalone mode — the same 15 tests
```

All three build the app and serve it on port 4800 (`UI_TEST_PORT` overrides), and all three run
against the production build with offline mode seeded, so none of them touches the network.

Standalone mode reads `testing/browser.properties`; every value there can be overridden by an
environment variable, so pointing the suite at a grid needs no code change:

```bash
WDIO_HOSTNAME=selenium.example.com WDIO_PORT=4444 npm run test:standalone
WDIO_HEADLESS=false npm run test:standalone      # watch it happen
```

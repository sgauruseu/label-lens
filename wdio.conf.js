/**
 * WebdriverIO configuration for the comparison suite.
 *
 * This suite exists to answer one question honestly: what does the same set of UI tests cost in
 * WebdriverIO versus Playwright? It covers a deliberate subset of the Playwright suite in
 * `tests/`, written in the idiomatic WDIO style — plain JavaScript, Mocha, Page Objects.
 *
 * Two structural differences show up before a single test is written, and both are visible in
 * this file:
 *
 * 1. **There is no `webServer` option.** Playwright starts the application under test itself and
 *    waits for it. WebdriverIO has no such concept, so building and serving the app is written
 *    out by hand in `testing/server.js` — about 70 lines that Playwright replaces with four. It
 *    lives in its own module because standalone mode needs exactly the same thing.
 * 2. **The browser is driven over the WebDriver protocol**, through a separate `chromedriver`
 *    process, rather than over Chrome DevTools Protocol in-process. That is what makes WDIO
 *    work unchanged against Safari, a real iPhone, or a BrowserStack grid — and what makes every
 *    command a round trip over HTTP.
 */

import { startAppServer, stopAppServer } from './testing/server.js';

const PORT = Number(process.env.UI_TEST_PORT ?? 4800);
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export const config = {
  runner: 'local',
  specs: ['./testing/spec/**/*.spec.js'],
  maxInstances: 1,

  capabilities: [
    {
      browserName: 'chrome',
      'goog:chromeOptions': {
        args: [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--window-size=1280,900',
          '--disable-background-networking',
        ],
        // Set when the environment ships its own Chrome rather than letting WDIO fetch one.
        ...(process.env.CHROMIUM_PATH ? { binary: process.env.CHROMIUM_PATH } : {}),
      },
    },
  ],

  logLevel: 'error',
  baseUrl: BASE_URL,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 3,

  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 60_000 },

  /** Build the app and serve it — the job Playwright's `webServer` does declaratively. */
  onPrepare: async () => {
    await startAppServer(BASE_URL, PORT);
  },

  onComplete: () => {
    stopAppServer();
  },
};

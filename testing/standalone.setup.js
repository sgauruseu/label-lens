/**
 * Mocha root hook plugin for standalone mode.
 *
 * Loaded through `--require`, which runs **before** Mocha installs its BDD globals — so this
 * file cannot call `before()` or `helper.setupBrowser()` directly. Root hooks have to be
 * exported as `mochaHooks` instead, and Mocha registers them once the globals exist. Getting
 * this wrong fails with `ReferenceError: before is not defined`, which says nothing about the
 * real cause.
 *
 * It does the two jobs the WebdriverIO testrunner would otherwise do from `wdio.conf.js`: serve
 * the application, and open a browser session.
 */

import helper from './pageobjects/WebDriverHelper.js';
import { startAppServer, stopAppServer } from './server.js';

const PORT = Number(process.env.UI_TEST_PORT ?? 4800);
const URL = process.env.WDIO_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export const mochaHooks = {
  beforeAll: [
    async function startServer() {
      this.timeout(180_000);
      await startAppServer(URL, PORT);
    },
    async function openBrowser() {
      this.timeout(120_000);
      await helper.openSession();
    },
  ],

  afterAll: [
    async function closeBrowser() {
      this.timeout(60_000);
      await helper.closeSession();
    },
    function stopServer() {
      stopAppServer();
    },
  ],
};

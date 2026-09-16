/**
 * Standalone-mode helper.
 *
 * WebdriverIO can be used two ways:
 *
 * - **Testrunner mode** (`wdio.conf.js`, `npm run test:wdio`) — the `@wdio/cli` process reads a
 *   config, spawns workers, creates a session per spec file, and injects `browser`, `$`, `$$`
 *   and `expect` as globals before the test file is even loaded.
 * - **Standalone mode** (this file, `npm run test:standalone`) — WebdriverIO is an ordinary
 *   library. *You* create the session with `remote()`, *you* end it, and *you* run the tests
 *   with whatever runner you like. Nothing is injected, so nothing is magic.
 *
 * Standalone is what you want when the session has to be created by code you control: an
 * existing Mocha suite you are extending, a Selenium Grid with custom capabilities, a browser
 * that outlives a single spec file, or a script that is not a test at all.
 *
 * The price is that the globals have to be provided by hand — which this helper does, so the
 * exact same Page Objects and spec files run unchanged in both modes. That is the whole point:
 * it makes the two modes comparable rather than two separate suites.
 *
 * Settings come from `testing/browser.properties`, with environment variables taking precedence.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import propertiesReader from 'properties-reader';
import { expect as wdioExpect } from 'expect-webdriverio';
import { remote } from 'webdriverio';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROPERTIES_FILE = join(HERE, '..', 'browser.properties');

/** Reads a property, letting an environment variable win. Empty strings count as unset. */
function setting(properties, key, envVar, fallback) {
  const fromEnv = envVar ? process.env[envVar] : undefined;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const fromFile = properties.get(key);
  if (fromFile === null || fromFile === '') return fallback;
  return String(fromFile);
}

export class WebDriverHelper {
  constructor() {
    this.properties = propertiesReader(PROPERTIES_FILE);
    this.browser = undefined;
  }

  /** The base URL the tests navigate against. */
  get baseUrl() {
    return setting(this.properties, 'base.url', 'WDIO_BASE_URL', 'http://127.0.0.1:4800');
  }

  /**
   * The capabilities and connection options for `remote()`.
   *
   * @param {number} width
   * @param {number} height
   */
  options(width, height) {
    const headless = setting(this.properties, 'browser.headless', 'WDIO_HEADLESS', 'false');
    const version = setting(this.properties, 'browser.version', 'WDIO_BROWSER_VERSION', '');
    const hostname = setting(this.properties, 'driver.hostname', 'WDIO_HOSTNAME', '');
    const binary = process.env.CHROMIUM_PATH;

    const args = [`--window-size=${width},${height}`, '--disable-background-networking'];
    if (headless === 'true') args.unshift('--headless=new', '--disable-gpu', '--no-sandbox');

    return {
      logLevel: 'error',
      baseUrl: this.baseUrl,
      automationProtocol: 'webdriver',
      waitforTimeout: Number(setting(this.properties, 'timeout.waitfor', undefined, '10000')),
      capabilities: {
        browserName: setting(this.properties, 'browser.name', 'WDIO_BROWSER', 'chrome'),"wdio:enforceWebDriverClassic": true,
        ...(version ? { browserVersion: version } : {}),
        'goog:chromeOptions': { args, ...(binary ? { binary } : {}) },
      },
      // With no hostname, WebdriverIO starts and manages a driver itself. With one, it talks to
      // whatever is already listening there — a grid, a container, a hand-started chromedriver.
      ...(hostname
        ? {
            hostname,
            port: Number(setting(this.properties, 'driver.port', 'WDIO_PORT', '4444')),
            path: setting(this.properties, 'driver.path', 'WDIO_PATH', '/'),
          }
        : {}),
    };
  }

  /**
   * Opens the session and publishes the globals the shared Page Objects expect.
   *
   * In testrunner mode `@wdio/cli` injects `browser`, `$`, `$$` and `expect` before a spec file
   * is even loaded. Standalone mode injects nothing, so this is the one piece of glue that lets
   * the exact same Page Objects and specs run under both — which is what makes the two modes
   * comparable rather than two separate suites.
   *
   * @param {number} [width]
   * @param {number} [height]
   */
  async openSession(width, height) {
    const w = Number(width ?? setting(this.properties, 'browser.width', undefined, '1280'));
    const h = Number(height ?? setting(this.properties, 'browser.height', undefined, '900'));

    this.browser = await remote(this.options(w, h));

    globalThis.browser = this.browser;
    globalThis.$ = this.browser.$.bind(this.browser);
    globalThis.$$ = this.browser.$$.bind(this.browser);
    globalThis.expect = wdioExpect;

    await this.browser.setWindowSize(w, h);
    return this.browser;
  }

  /** Ends the session. Safe to call when there is none. */
  async closeSession() {
    await this.browser?.deleteSession();
    this.browser = undefined;
  }

  /**
   * Registers Mocha `before`/`after` hooks that open and close the session.
   *
   * This is the classic standalone pattern — called from inside a spec file's `describe`, so
   * that the file owns its own browser. It only works where Mocha's BDD globals already exist,
   * which means inside a spec, never inside a `--require` file: those are loaded before Mocha
   * installs `before`/`after`, and calling it there fails with `before is not defined`. For a
   * suite-wide session, use the root hook plugin in `testing/standalone.setup.js` instead.
   *
   * @param {number} [width]
   * @param {number} [height]
   */
  setupBrowser(width, height) {
    const open = () => this.openSession(width, height);
    const close = () => this.closeSession();

    before(async function openBrowser() {
      this.timeout(120_000);
      await open();
    });

    after(async function closeBrowser() {
      this.timeout(60_000);
      await close();
    });
  }
  closeBrowser(){
    const close = () => this.closeSession();
    after(async function closeBrowser() {
      this.timeout(60_000);
      await close();
    });
  }
}

export default new WebDriverHelper();

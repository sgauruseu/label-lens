/**
 * The base Page Object.
 *
 * Everything shared by the screens lives here: opening the app in a known state, and the
 * navigation bar, which is present on every screen.
 *
 * Note `openApp()`. Playwright has `addInitScript`, which runs code *before* the page's own
 * scripts on every navigation, so offline mode can simply be there when React boots. WebDriver
 * has no equivalent: you cannot touch `localStorage` for an origin the browser has not visited
 * yet. So the sequence is navigate → write storage → reload, and the app boots twice on every
 * test. That is not a flaw in WebdriverIO, it is the WebDriver protocol showing through — but it
 * is a real cost, and it is the single biggest structural difference between the two suites.
 */

const SETTINGS_KEY = 'label-lens:settings:v1';
const PROFILE_KEY = 'label-lens:profile:v1';
const HISTORY_KEY = 'label-lens:history:v1';

export class BasePage {
  /**
   * Opens the app with offline mode on, no profile and no scan history.
   *
   * @param {{ keepStorage?: boolean }} [options] `keepStorage` skips the reset, for the tests
   *   that check something survived a reload.
   */
  async openApp(options = {}) {
    await browser.url('/');

    if (!options.keepStorage) {
      await browser.execute(
        (settingsKey, profileKey, historyKey) => {
          window.localStorage.setItem(
            settingsKey,
            JSON.stringify({ offlineMode: true, apiKey: '', provider: 'anthropic' }),
          );
          window.localStorage.removeItem(profileKey);
          window.localStorage.removeItem(historyKey);
        },
        SETTINGS_KEY,
        PROFILE_KEY,
        HISTORY_KEY,
      );
      // The app has already booted with the old storage, so it has to boot again.
      await browser.refresh();
    }

    await this.scanTab.waitForDisplayed();
  }

  /**
   * A tab in the navigation bar.
   *
   * WebdriverIO's text selector (`button=Scan`) cannot be prefixed with a CSS scope — the whole
   * string is parsed as one selector and `nav.tabs button=Scan` is rejected as invalid. Scoping
   * has to be done by chaining instead. Playwright's `getByRole('button', { name: 'Scan' })`
   * composes freely with `.locator()`, which is why its page objects tend to be shorter.
   *
   * @param {'Scan' | 'History' | 'My rules' | 'Settings'} name
   */
  tab(name) {
    return $('nav.tabs').$(`button=${name}`);
  }

  get scanTab() {
    return this.tab('Scan');
  }

  /** @param {'Scan' | 'History' | 'My rules' | 'Settings'} name */
  async goTo(name) {
    await this.tab(name).click();
  }

  /**
   * The panel with this heading.
   *
   * "A card that *contains* this heading" is a parent-by-child query, which CSS cannot express
   * at all — Playwright has `.filter({ has: ... })` for it; WebDriver has XPath and nothing else.
   *
   * The `translate()` is the case fix. Headings are upper-cased by CSS, and the two matching
   * mechanisms disagree about which text they see: WebdriverIO's `=text` selectors compare the
   * *rendered* text (so they need capitals), while XPath reads the *DOM* text (so it needs the
   * original case). Since XPath 1.0 has no `lower-case()`, case-insensitivity is spelled out by
   * hand. Playwright solves the same problem with a `/…/i` regular expression.
   *
   * @param {string} heading
   */
  card(heading) {
    const lower = heading.toLowerCase();
    return $(
      `//div[contains(@class,'card')][.//h3[` +
        `translate(normalize-space(),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')` +
        `='${lower}']]`,
    );
  }

  /**
   * A notice banner containing this text.
   *
   * There can be several notices on screen, and `$('.notice')` silently takes the first one.
   * Playwright's `.filter({ hasText })` narrows a set; WebDriver needs the predicate in XPath.
   *
   * @param {string} text
   */
  notice(text) {
    return $(`//div[contains(@class,'notice')][contains(., '${text}')]`);
  }
}

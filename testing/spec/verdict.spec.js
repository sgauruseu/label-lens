/**
 * The verdict screen, in WebdriverIO.
 *
 * These mirror a subset of `tests/verdict.spec.ts` deliberately, so the two suites can be read
 * side by side. Where the WDIO version has to do something the Playwright version did not, the
 * comment says so — that difference is the point of this suite.
 */

import scan from '../pageobjects/scan.page.js';
import webDriverHelper from "../pageobjects/WebDriverHelper.js";

const NUTELLA = '3017620425035';
const ALMONDS = '20724696';
const COLA = '5449000000996';
const PRINCE = '7622210449283';

describe('scanning a product', () => {

  if (typeof browser === 'undefined') {
    webDriverHelper.setupBrowser();
  }

  beforeEach(async () => {
    await scan.openApp();
  });

  it('shows the score, the band and the product identity', async () => {
    await scan.lookUp(NUTELLA);

    await expect(scan.productName).toHaveText('Nutella');
    await expect(scan.score).toHaveText('22');
    await expect(scan.band).toHaveText(expect.stringContaining('BAD'));
  });

  it('explains every point of the score, and the arithmetic adds up', async () => {
    await scan.lookUp(NUTELLA);

    // WebdriverIO's element array has its own async `map()`, which returns a Promise rather than
    // an array — wrapping it in `Promise.all` fails with "object is not iterable". Playwright's
    // `allInnerTexts()` is a single call that returns the strings directly; here every
    // `getText()` is its own HTTP round trip to the driver.
    const texts = await scan.scoreRows.map((row) => row.getText());

    expect(texts[0]).toBe('100');
    expect(texts[texts.length - 1]).toBe('22');

    const adjustments = texts.slice(1, -1).map((raw) => Number(raw.replace('+', '')));
    expect(adjustments.length).toBeGreaterThanOrEqual(4);
    expect(100 + adjustments.reduce((total, points) => total + points, 0)).toBe(22);
  });

  it('agrees the verb with plural nutrient names', async () => {
    // Regression: the card once read "Saturates is in the high band".
    await scan.lookUp(NUTELLA);
    const card = scan.card('How this score was reached');

    await expect(card).toHaveText(expect.stringContaining('Saturates are in the high band'));
    await expect(card).toHaveText(expect.stringContaining('Fat is in the high band'));
    await expect(card).not.toHaveText(expect.stringContaining('Saturates is'));
  });

  it('scores an unprocessed product far above an ultra-processed one', async () => {
    await scan.lookUp(ALMONDS);

    await expect(scan.score).toHaveText('92');
    await expect(scan.band).toHaveText(expect.stringContaining('GOOD'));
  });

  it('uses millilitres for a drink', async () => {
    await scan.lookUp(COLA);

    await expect(scan.card('Energy')).toHaveText(expect.stringContaining('per 100 ml'));
  });

  it('warns about nutrition figures that cannot be true, and withholds the bonuses', async () => {
    // This fixture claims 52 g of fibre per 100 g, which would otherwise earn a fibre bonus.
    await scan.lookUp(PRINCE);

    await expect(scan.notice('not possible')).toBeDisplayed();
    await expect(scan.card('How this score was reached')).toHaveText(
      expect.stringContaining('Bonuses withheld'),
    );
    await expect(scan.score).toHaveText('40');
  });
});

describe('better alternatives', () => {
  beforeEach(async () => {
    await scan.openApp();
  });

  it.skip('is not fetched until it is asked for', async () => {
    await scan.lookUp(NUTELLA);

    await expect(scan.alternativesButton).toBeDisplayed();
    await expect(await scan.alternatives).toHaveLength(0);
  });

  it.skip('offers three strictly better products, each with its reasons', async () => {
    await scan.lookUp(NUTELLA);
    await scan.alternativesButton.click();

    // WDIO has no auto-retrying assertion for "this list has settled at three items", so the
    // wait is explicit. Playwright's `toHaveCount(3)` polls until it is true or times out.
    await browser.waitUntil(async () => (await scan.alternatives).length === 3, {
      timeout: 10_000,
      timeoutMsg: 'expected three alternatives to appear',
    });

    for (const alternative of await scan.alternatives) {
      await expect(alternative.$('.alt-grade')).toHaveText('A');
      await expect(alternative.$('.alt-reason')).toBeDisplayed();
    }
  });

  it.skip('says "no salt" rather than "100% less salt"', async () => {
    // Regression: the percentage formula is arithmetically right and reads like a machine.
    await scan.lookUp(NUTELLA);
    await scan.alternativesButton.click();

    const card = scan.card('Better in the same category');
    await expect(card).toHaveText(expect.stringContaining('no salt'));
    await expect(card).not.toHaveText(expect.stringContaining('100% less'));
  });

});

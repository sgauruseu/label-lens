
import history from '../pageobjects/history.page.js';
import scan from '../pageobjects/scan.page.js';
import webDriverHelper from '../pageobjects/WebDriverHelper.js';

const NUTELLA = '3017620425035';
const ALMONDS = '20724696';
const COCA_COLA = '5449000000996';
const SNICKERS = '5000159461122';

describe('sample barcodes', () => {

  if (typeof browser === 'undefined') {
    webDriverHelper.setupBrowser();
  }

  beforeEach(async () => {
    await scan.openApp();
  });

  it('folds the row away and brings it back', async () => {
    expect(await scan.sampleChips).not.toHaveLength(0);

    await scan.samplesToggle.click();
    await browser.waitUntil(async () => (await scan.sampleChips).length === 0, {
      timeoutMsg: 'expected the sample row to fold away',
    });

    await scan.samplesToggle.click();
    await browser.waitUntil(async () => (await scan.sampleChips).length > 0, {
      timeoutMsg: 'expected the sample row to come back',
    });
  });

  it('removes one example without touching the others', async () => {
    const before = (await scan.sampleChips).length;

    await scan.removeSampleButton(NUTELLA).click();

    await browser.waitUntil(async () => (await scan.sampleChips).length === before - 1, {
      timeoutMsg: 'expected one fewer example',
    });
    await expect($('.chips')).not.toHaveText(expect.stringContaining(NUTELLA));
    await expect($('.chips')).toHaveText(expect.stringContaining(ALMONDS));
  });

  it('offers no way to remove the two the demo depends on', async () => {
    // A stray tap on stage that deletes the Coca-Cola example is not a recoverable mistake.
    await expect(scan.removeSampleButton(COCA_COLA)).not.toBeExisting();
    await expect(scan.removeSampleButton(SNICKERS)).not.toBeExisting();

    await expect($('.chips')).toHaveText(expect.stringContaining(COCA_COLA));
    await expect($('.chips')).toHaveText(expect.stringContaining(SNICKERS));
  });
});

describe('history', () => {
  beforeEach(async () => {
    await scan.openApp();
  });

  it.skip('drops one scan and keeps the rest', async () => {
    await scan.lookUp(NUTELLA);
    await scan.lookUp(ALMONDS);
    await scan.goTo('History');
    expect(await history.items).toHaveLength(2);

    await history.removeButton('Nutella').click();

    await browser.waitUntil(async () => (await history.items).length === 1, {
      timeoutMsg: 'expected one row to be removed',
    });
    expect(await history.names()).not.toContain('Nutella');
  });

  it.skip('a removed scan does not come back on reload', async () => {
    await scan.lookUp(NUTELLA);
    await scan.goTo('History');
    await history.removeButton('Nutella').click();

    // `keepStorage` because the point of this test is that storage survived.
    await browser.refresh();
    await history.goTo('History');

    await expect(history.empty).toBeDisplayed();
  });

  it.skip('clears everything at once, and says how much that is', async () => {
    await scan.lookUp(NUTELLA);
    await scan.lookUp(ALMONDS);
    await scan.lookUp(COCA_COLA);
    await scan.goTo('History');

    await expect(history.clearAllButton).toHaveText('Clear all (3)');
    await history.clearAllButton.click();

    await expect(history.empty).toBeDisplayed();
  });
});

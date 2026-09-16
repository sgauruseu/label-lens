/**
 * The verdict screen.
 *
 * These assert on what the assembled application *shows*. The scoring rules themselves are
 * covered by 242 unit tests; what cannot be unit-tested is whether the number reached the
 * screen, whether the sentence around it reads correctly, and whether the panels render at all.
 *
 * Several of the assertions here exist because the bug happened. They are marked.
 */

import { FIXTURES, card, expect, lookUp, test } from './support.js';

test.describe('scanning a product', () => {
  test('shows the score, the band and the product identity', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);

    await expect(app.locator('.verdict-title h2')).toHaveText(FIXTURES.nutella.name);
    await expect(app.locator('.ring-value')).toHaveText(String(FIXTURES.nutella.score));
    await expect(app.locator('.ring-band')).toHaveText(/bad/i);
  });

  test('explains every point of the score, and the arithmetic adds up', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);

    const rows = await app.locator('.contrib-points').allInnerTexts();

    // The first row is the 100 every product starts from and the last is the final score; the
    // rows between them are the adjustments, and they must account for the whole difference.
    expect(rows.at(0)).toBe('100');
    expect(rows.at(-1)).toBe(String(FIXTURES.nutella.score));

    const adjustments = rows.slice(1, -1).map((raw) => Number(raw.replace('+', '')));
    expect(adjustments.length).toBeGreaterThanOrEqual(4);
    expect(100 + adjustments.reduce((total, points) => total + points, 0)).toBe(
      FIXTURES.nutella.score,
    );
  });

  test('names the rule behind each deduction', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    const panel = card(app, 'How this score was reached');

    await expect(panel).toContainText('Sugars are in the high band');
    await expect(panel).toContainText('Ultra-processed food (NOVA 4)');
    await expect(panel).toContainText('WHO guideline');
  });

  test('agrees the verb with plural nutrient names', async ({ app }) => {
    // Regression: the card once read "Saturates is in the high band".
    await lookUp(app, FIXTURES.nutella.barcode);
    const panel = card(app, 'How this score was reached');

    await expect(panel).toContainText('Saturates are in the high band');
    await expect(panel).toContainText('Fat is in the high band');
    await expect(panel).not.toContainText('Saturates is');
  });

  test('scores an unprocessed product far above an ultra-processed one', async ({ app }) => {
    await lookUp(app, FIXTURES.almonds.barcode);
    await expect(app.locator('.ring-value')).toHaveText(String(FIXTURES.almonds.score));
    await expect(app.locator('.ring-band')).toHaveText(/good/i);
  });
});

test.describe('energy', () => {
  test('shows energy per 100 g and for the whole package', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    const panel = card(app, 'Energy');

    await expect(panel).toContainText('539');
    await expect(panel).toContainText('per 100 g');
    // The figure people actually reason with: the whole 1 kg jar.
    await expect(panel).toContainText('5,390');
    await expect(panel).toContainText('whole pack · 1 kg');
    await expect(panel).toContainText('270% of the 2000 kcal daily reference intake');
  });

  test('uses millilitres and the drink thresholds for a drink', async ({ app }) => {
    await lookUp(app, FIXTURES.cola.barcode);

    await expect(card(app, 'Energy')).toContainText('per 100 ml');
    await expect(card(app, 'per 100 ml')).toBeVisible();
  });
});

test.describe('data the app refuses to trust', () => {
  test('warns about nutrition figures that cannot be true, and withholds the bonuses', async ({
    app,
  }) => {
    // This fixture claims 52 g of fibre per 100 g, which would otherwise earn a fibre bonus.
    await lookUp(app, FIXTURES.prince.barcode);

    await expect(app.locator('.notice').filter({ hasText: 'not possible' })).toBeVisible();
    await expect(card(app, 'How this score was reached')).toContainText(
      'Bonuses withheld',
    );
    await expect(app.locator('.ring-value')).toHaveText(String(FIXTURES.prince.score));
  });
});

test.describe('errors', () => {
  test('clears a stale error when the user goes to fix its cause', async ({ app }) => {
    // Regression: the "add your own API key" error stayed on screen while the user was in
    // Settings adding the key, so the app looked broken after it had been repaired.
    await app.getByLabel('Barcode').fill('12');
    await app.getByRole('button', { name: 'Look up' }).click();
    await expect(app.locator('.notice.error')).toBeVisible();

    await app.getByRole('button', { name: 'Settings' }).click();
    await expect(app.locator('.notice.error')).toHaveCount(0);
  });

  test('says the API key needs no saving, because there is no save button', async ({ app }) => {
    await app.getByRole('button', { name: 'Settings' }).click();
    await expect(app.getByText('There is no save button')).toBeVisible();

    await app.getByLabel('API key').fill('sk-ant-not-a-real-key');
    await expect(app.getByText('Key saved on this device')).toBeVisible();
  });
});

test.describe('personal rules', () => {
  test('flags a product the moment the rule is switched on, with no second lookup', async ({
    app,
  }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await expect(app.locator('.flag')).toHaveCount(0);

    await app.getByRole('button', { name: 'My rules' }).click();
    await app.getByRole('checkbox').first().check();
    await app.getByRole('button', { name: 'Scan', exact: true }).click();

    await expect(app.locator('.flag')).toContainText('palm oil');
  });

  test('keeps personal rules out of the score', async ({ app }) => {
    // A flag is a yes/no fact. Folding it into the number would hide it.
    await lookUp(app, FIXTURES.nutella.barcode);
    const before = await app.locator('.ring-value').innerText();

    await app.getByRole('button', { name: 'My rules' }).click();
    await app.getByRole('checkbox').first().check();
    await app.getByRole('button', { name: 'Scan', exact: true }).click();

    await expect(app.locator('.ring-value')).toHaveText(before);
  });
});

test.describe('the page itself', () => {
  test('renders without a single console error', async ({ app }) => {
    const errors: string[] = [];
    app.on('pageerror', (error) => errors.push(String(error)));
    app.on('console', (message) => {
      // Product photographs are served by Open Food Facts, so whether they load says something
      // about the network, not about the code. Everything else counts.
      const isRemoteImage = message.location().url.includes('images.openfoodfacts.org');
      if (message.type() === 'error' && !isRemoteImage) errors.push(message.text());
    });

    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();
    await app.locator('.alt').first().waitFor();

    expect(errors).toEqual([]);
  });

  test('works at phone width', async ({ app }) => {
    await app.setViewportSize({ width: 390, height: 844 });
    await lookUp(app, FIXTURES.nutella.barcode);

    await expect(app.locator('.ring-value')).toBeVisible();
    // Nothing may push the page wider than the screen.
    const overflow = await app.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

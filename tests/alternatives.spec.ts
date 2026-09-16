/**
 * Better alternatives, and the links under every product.
 *
 * Offline mode means these run against the bundled category set, so the suggestions are fixed
 * and the assertions can be exact. The live path is covered by the adapter's own fallback
 * logic; what is worth testing here is that a recommendation reaches the screen with its
 * reasons intact, and that the links point where they claim to.
 */

import { FIXTURES, card, expect, lookUp, test } from './support.js';

test.describe('better alternatives', () => {
  test('is not fetched until it is asked for', async ({ app }) => {
    // The category endpoint is rate-limited hard; firing it on every scan would guarantee
    // failure on the one scan that matters.
    await lookUp(app, FIXTURES.nutella.barcode);

    await expect(app.getByRole('button', { name: 'Find better alternatives' })).toBeVisible();
    await expect(app.locator('.alt')).toHaveCount(0);
  });

  test('offers three strictly better products, each with its reasons', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const alternatives = app.locator('.alt');
    await expect(alternatives).toHaveCount(3);

    for (const alternative of await alternatives.all()) {
      await expect(alternative.locator('.alt-reason').first()).toBeVisible();
      await expect(alternative.locator('.alt-grade')).toHaveText('A');
    }
  });

  test('leads with the comparison that persuades', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const first = app.locator('.alt').first();
    await expect(first).toContainText('Nutri-Score A instead of E');
    await expect(first).toContainText(/\d+× less sugar/);
  });

  test('says "no salt" rather than "100% less salt"', async ({ app }) => {
    // Regression: the percentage formula is arithmetically right and reads like a machine.
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const panel = card(app, 'Better in the same category');
    await expect(panel).toContainText('no salt');
    await expect(panel).not.toContainText('100% less');
  });

  test('names the category it compared within, and the scale it used', async ({ app }) => {
    // Regression: the picker once chose a leaf category holding a handful of products.
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const panel = card(app, 'Better in the same category');
    await expect(panel).toContainText('Hazelnut spreads');
    await expect(panel).toContainText('ranked by the official Nutri-Score');
  });

  test('never suggests the product that was just scanned', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const suggested = await app.locator('.alt strong').allInnerTexts();
    expect(suggested).not.toHaveLength(0);
    expect(suggested.filter((name) => /nutella/i.test(name))).toEqual([]);
  });

  test('hands a suggestion to the scanner in one click', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    const first = app.locator('.alt').first();
    const href = await first.locator('.link').first().getAttribute('href');
    const barcode = href?.split('/').pop();

    await first.getByRole('button', { name: 'Scan it' }).click();

    // The suggestion becomes the thing being looked at — no retyping, no second search.
    await expect(app.getByLabel('Barcode')).toHaveValue(String(barcode));
    await expect(app.getByLabel('Barcode')).not.toHaveValue(FIXTURES.nutella.barcode);
  });
});

test.describe('links', () => {
  test('every product links to the source the data came from', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);

    const source = app.locator('.verdict-title .link', { hasText: 'Open Food Facts' });
    await expect(source).toHaveAttribute(
      'href',
      `https://world.openfoodfacts.org/product/${FIXTURES.nutella.barcode}`,
    );
  });

  test('shows the producer site when the database has one', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await expect(app.locator('.verdict-title .link.producer')).toHaveText(/nutella\.com/);
  });

  test('omits the producer site rather than guessing it', async ({ app }) => {
    // None of the suggested spreads have a producer link in the database, and inventing one
    // from the brand name would point at a domain nobody verified.
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'Find better alternatives' }).click();

    await expect(app.locator('.alt .link.producer')).toHaveCount(0);
    await expect(app.locator('.alt .link')).toHaveCount(3);
  });

  test('opens outbound links safely', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);

    for (const link of await app.locator('.verdict-title .link').all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noreferrer/);
      await expect(link).toHaveAttribute('href', /^https?:\/\//);
    }
  });
});

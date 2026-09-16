/**
 * The furniture around the scanner: the sample barcodes and the scan history.
 *
 * Neither affects a verdict, which is exactly why they are worth testing here — a bug in either
 * one is invisible to the 252 unit tests and very visible on a projector.
 */

import { FIXTURES, expect, lookUp, test } from './support.js';

const COCA_COLA = FIXTURES.cola.barcode;
const SNICKERS = '5000159461122';

test.describe('sample barcodes', () => {
  test('folds the row away and brings it back', async ({ app }) => {
    const toggle = app.getByRole('button', { name: /^Try:/ });
    await expect(app.locator('.chip-group')).not.toHaveCount(0);

    await toggle.click();
    await expect(app.locator('.chip-group')).toHaveCount(0);

    await toggle.click();
    await expect(app.locator('.chip-group')).not.toHaveCount(0);
  });

  test('stays folded after a reload', async ({ app }) => {
    await app.getByRole('button', { name: /^Try:/ }).click();
    await app.reload();

    await expect(app.locator('.chip-group')).toHaveCount(0);
  });

  test('removes one example without touching the others', async ({ app }) => {
    const before = await app.locator('.chip-group').count();

    await app.getByRole('button', { name: `Remove ${FIXTURES.nutella.barcode}` }).click();

    await expect(app.locator('.chip-group')).toHaveCount(before - 1);
    await expect(app.locator('.chips')).not.toContainText(FIXTURES.nutella.barcode);
    await expect(app.locator('.chips')).toContainText(FIXTURES.almonds.barcode);
  });

  test('a removed example stays removed after a reload, and can be restored', async ({ app }) => {
    await app.getByRole('button', { name: `Remove ${FIXTURES.nutella.barcode}` }).click();
    await app.reload();
    await expect(app.locator('.chips')).not.toContainText(FIXTURES.nutella.barcode);

    await app.getByRole('button', { name: 'Restore removed' }).click();
    await expect(app.locator('.chips')).toContainText(FIXTURES.nutella.barcode);
  });

  test('offers no way to remove the two the demo depends on', async ({ app }) => {
    // A stray tap on stage that deletes the Coca-Cola example is not a recoverable mistake.
    await expect(app.getByRole('button', { name: `Remove ${COCA_COLA}` })).toHaveCount(0);
    await expect(app.getByRole('button', { name: `Remove ${SNICKERS}` })).toHaveCount(0);

    await expect(app.locator('.chips')).toContainText(COCA_COLA);
    await expect(app.locator('.chips')).toContainText(SNICKERS);
  });
});

test.describe('history', () => {
  test('drops one scan and keeps the rest', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await lookUp(app, FIXTURES.almonds.barcode);
    await app.getByRole('button', { name: 'History' }).click();
    await expect(app.locator('.history-item')).toHaveCount(2);

    await app.getByRole('button', { name: /Remove Nutella from history/ }).click();

    await expect(app.locator('.history-item')).toHaveCount(1);
    await expect(app.locator('.history-item')).not.toContainText('Nutella');
  });

  test('a removed scan does not come back on reload', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await app.getByRole('button', { name: 'History' }).click();
    await app.getByRole('button', { name: /Remove Nutella from history/ }).click();

    await app.reload();
    await app.getByRole('button', { name: 'History' }).click();
    await expect(app.locator('.history-item')).toHaveCount(0);
  });

  test('clears everything at once, and says how much that is', async ({ app }) => {
    await lookUp(app, FIXTURES.nutella.barcode);
    await lookUp(app, FIXTURES.almonds.barcode);
    await lookUp(app, FIXTURES.cola.barcode);
    await app.getByRole('button', { name: 'History' }).click();

    await app.getByRole('button', { name: 'Clear all (3)' }).click();

    await expect(app.locator('.history-item')).toHaveCount(0);
    await expect(app.getByText('Nothing scanned yet.')).toBeVisible();
  });
});

/**
 * Shared setup for the UI tests.
 *
 * Every test starts with **offline mode already on**, seeded into `localStorage` before the app
 * boots. That is the single decision that makes this suite worth having: the tests then run
 * entirely against the bundled fixtures, so they assert on fixed, known products and cannot go
 * red because Open Food Facts was slow, rate-limiting, or had a contributor edit a value.
 *
 * A UI test that depends on a third-party API is a test that will eventually fail for a reason
 * that has nothing to do with the code, and a suite people learn to ignore is worse than no
 * suite at all.
 */

import { test as base, type Locator, type Page } from '@playwright/test';

const SETTINGS_KEY = 'label-lens:settings:v1';
const PROFILE_KEY = 'label-lens:profile:v1';
const HISTORY_KEY = 'label-lens:history:v1';
/** Marks a context as already seeded, so a reload does not undo what the test just did. */
const SEEDED_KEY = 'label-lens:test-seeded';

/** Barcodes present in the bundled fixture set, with the score each one must produce. */
export const FIXTURES = {
  nutella: { barcode: '3017620425035', name: 'Nutella', score: 22, band: 'bad' },
  almonds: { barcode: '20724696', score: 92, band: 'good' },
  cola: { barcode: '5449000000996', name: 'Coca-Cola', score: 55, band: 'poor' },
  /** The entry whose nutrition data cannot be true — 52 g of fibre per 100 g. */
  prince: { barcode: '7622210449283', name: 'Prince', score: 40 },
} as const;

/**
 * A page that boots offline, with no profile and no history.
 *
 * Seeding storage before the first script runs is what keeps each test independent — otherwise
 * a rule left on by one test changes the verdict in the next.
 */
export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    await page.addInitScript(
      ([settingsKey, profileKey, historyKey, seededKey]) => {
        // This runs before *every* navigation, reloads included. Seeding unconditionally would
        // wipe whatever the test had just stored, so a test that reloads to check something
        // persisted would always pass — proving nothing. The marker makes it run once.
        if (window.localStorage.getItem(String(seededKey))) return;
        window.localStorage.setItem(String(seededKey), '1');
        window.localStorage.setItem(
          String(settingsKey),
          JSON.stringify({ offlineMode: true, apiKey: '', provider: 'anthropic' }),
        );
        window.localStorage.removeItem(String(profileKey));
        window.localStorage.removeItem(String(historyKey));
      },
      [SETTINGS_KEY, PROFILE_KEY, HISTORY_KEY, SEEDED_KEY],
    );
    await page.goto('/');
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * The panel with this heading.
 *
 * Headings are upper-cased by CSS, and `text-transform` is part of what a locator sees, so a
 * plain `hasText: 'Energy'` misses. Matching the heading itself — rather than the panel's whole
 * text — also keeps "Energy" from selecting the score card, which mentions energy in a rule.
 */
export function card(page: Page, heading: string): Locator {
  return page
    .locator('.card')
    .filter({ has: page.locator('h3', { hasText: new RegExp(`^${heading}$`, 'i') }) });
}

/** Looks a barcode up through the form, exactly as a person would. */
export async function lookUp(page: Page, barcode: string): Promise<void> {
  await page.getByLabel('Barcode').fill(barcode);
  await page.getByRole('button', { name: 'Look up' }).click();
  await page.locator('.verdict-title h2').waitFor({ state: 'visible' });
}

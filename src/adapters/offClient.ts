/**
 * Open Food Facts client.
 *
 * Read access to the v2 API needs no key and no authentication, and the service sends
 * permissive CORS headers, so the whole app runs from static hosting with no backend.
 *
 * The API rate-limits product lookups to roughly 15 requests per minute per IP, so every
 * successful response is cached in `sessionStorage`, and any failure falls back to the bundled
 * fixtures rather than showing the user an error they cannot act on.
 */

import { ProductNotFoundError, normalizeResponse, type OffResponse } from '../core/normalize.js';
import type { Product } from '../core/types.js';
import fixtures from '../fixtures/products.json' with { type: 'json' };

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

/** Only the fields the app actually reads, which keeps responses small and fast. */
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriscore_grade',
  'nova_group',
  'ingredients_text',
  'ingredients_text_en',
  'additives_tags',
  'allergens_tags',
  'categories_tags',
  'labels_tags',
  'ingredients_analysis_tags',
  'nutriments',
].join(',');

const CACHE_PREFIX = 'label-lens:off:v1:';
const TIMEOUT_MS = 8000;

const FIXTURES = fixtures as Record<string, OffResponse>;

/** Barcodes that work with no network at all, listed on the home screen as demo products. */
export const FIXTURE_BARCODES = Object.keys(FIXTURES);

export interface LookupResult {
  product: Product;
  /** True when the result came from cache or bundled fixtures rather than the live API. */
  offline: boolean;
  /** Set when the live lookup failed and the fixture was used instead. */
  fallbackReason?: string;
}

/** Barcodes are digits only; EAN-8 through GTIN-14 plus the shorter internal codes. */
export function isValidBarcode(value: string): boolean {
  return /^\d{6,14}$/.test(value.trim());
}

function readCache(barcode: string): OffResponse | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + barcode);
    return raw ? (JSON.parse(raw) as OffResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(barcode: string, response: OffResponse): void {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + barcode, JSON.stringify(response));
  } catch {
    /* a full or unavailable cache is not worth failing a lookup over */
  }
}

function fromFixture(barcode: string, reason?: string): LookupResult | null {
  const response = FIXTURES[barcode];
  if (!response) return null;
  const result: LookupResult = {
    product: normalizeResponse(response, 'fixture'),
    offline: true,
  };
  if (reason !== undefined) result.fallbackReason = reason;
  return result;
}

/**
 * Looks a barcode up.
 *
 * @param barcode digits only, already validated by the caller
 * @param options `offline` forces fixture-only mode, used for the offline demo
 * @throws {ProductNotFoundError} when the product is in neither the API nor the fixtures
 */
export async function lookup(
  barcode: string,
  options: { offline?: boolean } = {},
): Promise<LookupResult> {
  const code = barcode.trim();

  if (options.offline) {
    const fixture = fromFixture(code, 'Offline mode is on.');
    if (fixture) return fixture;
    throw new ProductNotFoundError(code);
  }

  const cached = readCache(code);
  if (cached) return { product: normalizeResponse(cached, 'openfoodfacts'), offline: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (response.status === 429) {
      const fixture = fromFixture(code, 'Open Food Facts rate limit reached.');
      if (fixture) return fixture;
      throw new Error('Open Food Facts is rate limiting requests. Try again in a minute.');
    }
    if (!response.ok) {
      throw new Error(`Open Food Facts returned ${response.status}.`);
    }

    const json = (await response.json()) as OffResponse;
    const product = normalizeResponse(json, 'openfoodfacts');
    writeCache(code, json);
    return { product, offline: false };
  } catch (error) {
    if (error instanceof ProductNotFoundError) throw error;
    const reason =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'The lookup timed out.'
        : 'Could not reach Open Food Facts.';
    const fixture = fromFixture(code, reason);
    if (fixture) return fixture;
    throw new Error(`${reason} This product is not in the offline set either.`);
  } finally {
    clearTimeout(timer);
  }
}

export { ProductNotFoundError };

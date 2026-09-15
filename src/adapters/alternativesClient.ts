/**
 * Category search, for finding something better than what was scanned.
 *
 * Two findings shaped this module, both established by testing rather than by reading docs:
 *
 * 1. **The modern `/api/v2/search` sends no CORS headers**, and neither does
 *    `search.openfoodfacts.org`. From a static page they are unusable. The legacy
 *    `/cgi/search.pl` does allow cross-origin requests, so that is what this uses — an old
 *    endpoint, but the only one that works from a browser.
 * 2. **Search is rate-limited far harder than product lookup** — roughly ten per minute per IP
 *    for products, and in practice a single search per client every several seconds. Two
 *    searches in quick succession already fail.
 *
 * So caching is not an optimisation here, it is the difference between a feature that works on
 * stage and one that does not. Every result is cached for the session, and a bundled fixture
 * sits behind the network for the demo products.
 */

import { searchCategories, type AlternativeCandidate } from '../core/alternatives.js';
import { safeProducerUrl } from '../core/links.js';
import type { Nutriments } from '../core/types.js';
import fixtures from '../fixtures/alternatives.json' with { type: 'json' };

const BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
const FIELDS = 'code,product_name,brands,quantity,link,nutriscore_grade,nova_group,nutriments';
const PAGE_SIZE = 12;
const TIMEOUT_MS = 6000;
const CACHE_PREFIX = 'label-lens:alts:v1:';
/** Fewer than this and the category is too thin to draw a recommendation from. */
const MIN_RESULTS = 4;
/** The endpoint refuses rapid repeats, so trying more than two categories is wasted. */
const MAX_LIVE_ATTEMPTS = 2;

interface RawProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  link?: string;
  nutriscore_grade?: string;
  nova_group?: number | string;
  nutriments?: Record<string, unknown>;
}

const FIXTURES = fixtures as Record<string, RawProduct[]>;

function num(raw: Record<string, unknown> | undefined, key: string, max = 100): number | undefined {
  if (!raw) return undefined;
  const value = typeof raw[key] === 'string' ? Number(raw[key]) : raw[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    return undefined;
  }
  return value;
}

function toCandidate(raw: RawProduct): AlternativeCandidate | undefined {
  const barcode = raw.code?.trim();
  const name = raw.product_name?.trim();
  if (!barcode || !name) return undefined;

  const nutriments: Nutriments = {
    energyKcal: num(raw.nutriments, 'energy-kcal_100g', 1000),
    fat: num(raw.nutriments, 'fat_100g'),
    saturates: num(raw.nutriments, 'saturated-fat_100g'),
    sugars: num(raw.nutriments, 'sugars_100g'),
    salt: num(raw.nutriments, 'salt_100g'),
  };

  const grade = raw.nutriscore_grade?.trim().toLowerCase();
  const nova = typeof raw.nova_group === 'string' ? Number(raw.nova_group) : raw.nova_group;

  const candidate: AlternativeCandidate = { barcode, name, nutriments };
  const brand = raw.brands?.split(',')[0]?.trim();
  if (brand) candidate.brand = brand;
  if (raw.quantity?.trim()) candidate.quantity = raw.quantity.trim();
  if (grade === 'a' || grade === 'b' || grade === 'c' || grade === 'd' || grade === 'e') {
    candidate.nutriScore = grade;
  }
  if (nova === 1 || nova === 2 || nova === 3 || nova === 4) candidate.novaGroup = nova;
  const producerUrl = safeProducerUrl(raw.link);
  if (producerUrl) candidate.producerUrl = producerUrl;
  return candidate;
}

function readCache(category: string): RawProduct[] | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_PREFIX + category);
    return raw ? (JSON.parse(raw) as RawProduct[]) : null;
  } catch {
    return null;
  }
}

function writeCache(category: string, products: RawProduct[]): void {
  try {
    window.sessionStorage.setItem(CACHE_PREFIX + category, JSON.stringify(products));
  } catch {
    /* a full cache is not worth failing over */
  }
}

export interface CandidateResult {
  category: string;
  candidates: AlternativeCandidate[];
  /** True when the list came from cache or the bundled fixtures. */
  offline: boolean;
  /** Set when the live search could not be used, explaining why. */
  note?: string;
}

/** One live search. Throws on any failure; the caller decides what that means. */
async function searchCategory(category: string): Promise<RawProduct[]> {
  const params = new URLSearchParams({
    action: 'process',
    tagtype_0: 'categories',
    tag_contains_0: 'contains',
    tag_0: category,
    sort_by: 'nutriscore_score',
    json: '1',
    page_size: String(PAGE_SIZE),
    fields: FIELDS,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`search returned ${response.status}`);
    const json = (await response.json()) as { products?: RawProduct[] };
    return json.products ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export class NoCategoryError extends Error {
  constructor() {
    super('This product has no category specific enough to compare within.');
    this.name = 'NoCategoryError';
  }
}

/**
 * Fetches candidate products from the same category.
 *
 * @throws {NoCategoryError} when the product carries no usable category
 */
export async function fetchCandidates(
  categories: readonly string[] | undefined,
  options: { offline?: boolean } = {},
): Promise<CandidateResult> {
  const slugs = searchCategories(categories);
  if (slugs.length === 0) throw new NoCategoryError();

  const parse = (raw: RawProduct[]): AlternativeCandidate[] =>
    raw.map(toCandidate).filter((c): c is AlternativeCandidate => c !== undefined);

  // Offline: take the first category that has a bundled set, however specific.
  if (options.offline) {
    for (const slug of slugs) {
      const raw = FIXTURES[slug];
      if (raw) {
        return { category: slug, candidates: parse(raw), offline: true, note: 'Offline mode is on.' };
      }
    }
    const first = slugs[0] ?? '';
    return { category: first, candidates: [], offline: true, note: 'No offline data for this category.' };
  }

  // Cache first — a hit costs nothing and the endpoint is rate limited hard.
  for (const slug of slugs) {
    const cached = readCache(slug);
    if (cached && cached.length >= MIN_RESULTS) {
      return { category: slug, candidates: parse(cached), offline: true };
    }
  }

  // Live: walk from specific to general, but only a couple of attempts. Nutella's most specific
  // category holds a handful of products; one step up holds thousands, and the rate limit means
  // a third request would be refused anyway.
  let lastError: string | undefined;
  for (const slug of slugs.slice(0, MAX_LIVE_ATTEMPTS)) {
    try {
      const products = await searchCategory(slug);
      writeCache(slug, products);
      if (products.length >= MIN_RESULTS) {
        return { category: slug, candidates: parse(products), offline: false };
      }
    } catch {
      lastError = 'Category search is rate limited by Open Food Facts right now.';
      break;
    }
  }

  // Everything live came up short or failed — fall back to whatever is bundled.
  for (const slug of slugs) {
    const raw = FIXTURES[slug];
    if (raw) {
      return {
        category: slug,
        candidates: parse(raw),
        offline: true,
        note: lastError ?? 'The live search returned too few products, so the bundled set is used.',
      };
    }
  }

  const first = slugs[0] ?? '';
  return {
    category: first,
    candidates: [],
    offline: true,
    note: lastError ?? 'Too few products in this category to compare against.',
  };
}

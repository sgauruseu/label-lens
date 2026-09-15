/**
 * Translates an Open Food Facts API v2 payload into the domain `Product`.
 *
 * Pure by design: it takes the already-parsed JSON as an argument so it can be tested against
 * captured fixtures without touching the network.
 *
 * Open Food Facts is crowd-sourced. Fields go missing, arrive as strings where numbers are
 * expected, or carry sentinel values. Everything here is defensive, and anything that cannot
 * be trusted becomes `undefined` rather than a plausible-looking default.
 */

import { lookupAdditives } from './additives.js';
import { parseQuantity } from './quantity.js';
import type { IngredientAnalysis, Nutriments, Product, ProductKind } from './types.js';

/** The shape of the fields we request from the API. Everything is optional on purpose. */
export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  nutriscore_grade?: string;
  nova_group?: number | string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  additives_tags?: string[];
  allergens_tags?: string[];
  categories_tags?: string[];
  labels_tags?: string[];
  ingredients_analysis_tags?: string[];
  nutriments?: Record<string, unknown>;
}

export interface OffResponse {
  status?: number;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
}

/**
 * Reads a numeric nutriment, rejecting strings, NaN, negatives and impossible magnitudes.
 *
 * `max` defaults to 100 because a mass in grams per 100 g cannot exceed 100. Energy is the
 * exception and passes its own ceiling.
 */
function num(
  nutriments: Record<string, unknown> | undefined,
  key: string,
  max = 100,
): number | undefined {
  if (!nutriments) return undefined;
  const raw = nutriments[key];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 0 || value > max) return undefined;
  return value;
}

/**
 * Macronutrients that cannot together exceed 100 g per 100 g.
 *
 * Crowd-sourced entries routinely break this — a biscuit listed with 52 g of fibre, for
 * instance. Detecting it matters because an inflated fibre or protein figure would otherwise
 * earn the product a bonus it has not remotely earned.
 */
export const MACRO_SUM_LIMIT = 105;

function detectDataWarnings(n: Nutriments): string[] {
  const warnings: string[] = [];
  const sum = (n.fat ?? 0) + (n.carbohydrates ?? 0) + (n.proteins ?? 0) + (n.fiber ?? 0);
  if (sum > MACRO_SUM_LIMIT) {
    warnings.push(
      `The nutrition values add up to ${Math.round(sum)} g per 100 g, which is not possible. ` +
        'Treat this product’s figures with caution.',
    );
  }
  if (n.sugars !== undefined && n.carbohydrates !== undefined && n.sugars > n.carbohydrates + 1) {
    warnings.push('Sugars are listed as higher than total carbohydrates.');
  }
  if (
    n.saturates !== undefined &&
    n.fat !== undefined &&
    n.saturates > n.fat + 1
  ) {
    warnings.push('Saturates are listed as higher than total fat.');
  }
  return warnings;
}

/** Category tags that mark a product as a drink, so the halved thresholds apply. */
const DRINK_TAGS = [
  'en:beverages',
  'en:drinks',
  'en:waters',
  'en:sodas',
  'en:juices',
  'en:plant-based-milk-alternatives',
  'en:iced-teas',
  'en:energy-drinks',
];

/** Decides whether the FSA drink thresholds apply. Defaults to solid when unsure. */
export function detectKind(categories: readonly string[] | undefined): ProductKind {
  if (!categories) return 'solid';
  const lower = categories.map((c) => c.toLowerCase());
  return lower.some((c) => DRINK_TAGS.includes(c)) ? 'drink' : 'solid';
}

/**
 * Reads the dietary analysis tags.
 *
 * Open Food Facts distinguishes "not vegan" from "vegan status unknown". Collapsing the two
 * would let the app claim a product is unsuitable when the data simply is not there, so
 * `maybe-*` and missing tags both stay `undefined`.
 */
export function parseAnalysis(tags: readonly string[] | undefined): IngredientAnalysis {
  if (!tags) return {};
  const set = new Set(tags.map((t) => t.toLowerCase()));
  const result: IngredientAnalysis = {};

  if (set.has('en:palm-oil')) result.palmOil = true;
  else if (set.has('en:palm-oil-free')) result.palmOil = false;

  if (set.has('en:vegan')) result.vegan = true;
  else if (set.has('en:non-vegan')) result.vegan = false;

  if (set.has('en:vegetarian')) result.vegetarian = true;
  else if (set.has('en:non-vegetarian')) result.vegetarian = false;

  return result;
}

function parseNova(raw: number | string | undefined): Product['novaGroup'] {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return undefined;
}

function parseNutriScore(raw: string | undefined): Product['nutriScore'] {
  const value = raw?.trim().toLowerCase();
  if (value === 'a' || value === 'b' || value === 'c' || value === 'd' || value === 'e') {
    return value;
  }
  return undefined;
}

/** Strips the `en:` prefix and turns a tag into something readable. */
export function humanizeTag(tag: string): string {
  const withoutLocale = tag.replace(/^[a-z]{2}:/, '');
  const spaced = withoutLocale.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function readNutriments(raw: Record<string, unknown> | undefined): Nutriments {
  return {
    energyKcal: num(raw, 'energy-kcal_100g', 1000),
    energyKj: num(raw, 'energy-kj_100g', 4000),
    fat: num(raw, 'fat_100g'),
    saturates: num(raw, 'saturated-fat_100g'),
    carbohydrates: num(raw, 'carbohydrates_100g'),
    sugars: num(raw, 'sugars_100g'),
    addedSugars: num(raw, 'added-sugars_100g'),
    fiber: num(raw, 'fiber_100g'),
    proteins: num(raw, 'proteins_100g'),
    salt: num(raw, 'salt_100g'),
    fruitsVegetablesNuts:
      num(raw, 'fruits-vegetables-nuts_100g') ??
      num(raw, 'fruits-vegetables-nuts-estimate-from-ingredients_100g') ??
      num(raw, 'fruits-vegetables-legumes-estimate-from-ingredients_100g'),
  };
}

export class ProductNotFoundError extends Error {
  constructor(public readonly barcode: string) {
    super(`Product ${barcode} is not in the Open Food Facts database.`);
    this.name = 'ProductNotFoundError';
  }
}

/**
 * Normalizes a full API response.
 *
 * @throws {ProductNotFoundError} when the API reports the barcode as unknown.
 */
export function normalizeResponse(
  response: OffResponse,
  source: Product['source'] = 'openfoodfacts',
): Product {
  const barcode = response.product?.code ?? response.code ?? '';
  if (response.status === 0 || !response.product) {
    throw new ProductNotFoundError(barcode);
  }
  return normalizeProduct(response.product, source);
}

/** Normalizes a bare product object. */
export function normalizeProduct(
  off: OffProduct,
  source: Product['source'] = 'openfoodfacts',
): Product {
  const name =
    [off.product_name_en, off.product_name, off.generic_name]
      .map((n) => n?.trim())
      .find((n) => n && n.length > 0) ?? 'Unnamed product';

  const nutriments = readNutriments(off.nutriments);
  const packageSize = parseQuantity(off.quantity);

  return {
    barcode: off.code ?? '',
    name,
    brand: off.brands?.split(',')[0]?.trim() || undefined,
    quantity: off.quantity?.trim() || undefined,
    ...(packageSize ? { packageSize } : {}),
    imageUrl: off.image_front_small_url ?? off.image_front_url,
    kind: detectKind(off.categories_tags),
    categoryTags: off.categories_tags ?? [],
    nutriments,
    dataWarnings: detectDataWarnings(nutriments),
    additives: lookupAdditives(off.additives_tags ?? []),
    ingredientsText: (off.ingredients_text_en ?? off.ingredients_text)?.trim() || undefined,
    analysis: parseAnalysis(off.ingredients_analysis_tags),
    novaGroup: parseNova(off.nova_group),
    nutriScore: parseNutriScore(off.nutriscore_grade),
    allergens: (off.allergens_tags ?? []).map(humanizeTag),
    source,
  };
}

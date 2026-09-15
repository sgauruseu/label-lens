/**
 * Test helpers for the core domain.
 *
 * Lives in `core/` because it is pure and has no test-framework dependency; it is simply a
 * builder that keeps the test files readable by letting each test state only the fields it
 * actually cares about.
 */

import { DEFAULT_PROFILE } from './profile.js';
import type { Product, Profile } from './types.js';

/** A minimal, entirely neutral product: no additives, no nutrition data, nothing to score. */
export const EMPTY_PRODUCT: Product = {
  barcode: '0000000000000',
  name: 'Test product',
  kind: 'solid',
  categoryTags: [],
  nutriments: {},
  additives: [],
  analysis: {},
  allergens: [],
  dataWarnings: [],
  source: 'fixture',
};

/** Builds a product from the empty baseline, overriding only what a test specifies. */
export function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    ...EMPTY_PRODUCT,
    ...overrides,
    nutriments: { ...EMPTY_PRODUCT.nutriments, ...overrides.nutriments },
    analysis: { ...EMPTY_PRODUCT.analysis, ...overrides.analysis },
  };
}

/** Builds a profile from the all-off defaults. */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...DEFAULT_PROFILE, ...overrides };
}

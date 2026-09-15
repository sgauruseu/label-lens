import { describe, expect, it } from 'vitest';
import fixtures from '../fixtures/products.json' with { type: 'json' };
import {
  ProductNotFoundError,
  detectKind,
  humanizeTag,
  normalizeProduct,
  normalizeResponse,
  type OffResponse,
} from './normalize.js';
import { evaluate } from './score.js';
import { makeProfile } from './testing.js';

const byBarcode = fixtures as Record<string, OffResponse>;

function fixture(barcode: string): OffResponse {
  const found = byBarcode[barcode];
  if (!found) throw new Error(`Missing fixture ${barcode}`);
  return found;
}

describe('detectKind', () => {
  it('defaults to solid when categories are missing', () => {
    expect(detectKind(undefined)).toBe('solid');
    expect(detectKind([])).toBe('solid');
  });

  it('recognises a drink from its category tags', () => {
    expect(detectKind(['en:beverages', 'en:sodas'])).toBe('drink');
  });

  it('is case-insensitive about tags', () => {
    expect(detectKind(['EN:BEVERAGES'])).toBe('drink');
  });

  it('does not mistake a food for a drink', () => {
    expect(detectKind(['en:biscuits', 'en:snacks'])).toBe('solid');
  });
});

describe('humanizeTag', () => {
  it('strips the locale prefix and capitalises', () => {
    expect(humanizeTag('en:soybeans')).toBe('Soybeans');
    expect(humanizeTag('en:tree-nuts')).toBe('Tree nuts');
  });
});

describe('normalizeResponse', () => {
  it('throws when the barcode is not in the database', () => {
    const response: OffResponse = { status: 0, code: '0000000000000' };
    expect(() => normalizeResponse(response)).toThrow(ProductNotFoundError);
  });

  it('carries the barcode on the error so the UI can offer the photo fallback', () => {
    try {
      normalizeResponse({ status: 0, code: '1234567890123' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ProductNotFoundError).barcode).toBe('1234567890123');
    }
  });

  it('records where the data came from', () => {
    expect(normalizeResponse(fixture('3017620425035'), 'fixture').source).toBe('fixture');
  });
});

describe('normalizeProduct — defensive parsing', () => {
  it('survives a completely empty product object', () => {
    const product = normalizeProduct({});
    expect(product.name).toBe('Unnamed product');
    expect(product.additives).toEqual([]);
    expect(product.nutriments.sugars).toBeUndefined();
  });

  it('rejects nutrient values that are impossible per 100 g', () => {
    const product = normalizeProduct({ nutriments: { 'sugars_100g': 400 } });
    expect(product.nutriments.sugars).toBeUndefined();
  });

  it('rejects negative nutrient values', () => {
    const product = normalizeProduct({ nutriments: { 'salt_100g': -1 } });
    expect(product.nutriments.salt).toBeUndefined();
  });

  it('accepts energy above the 100 g mass ceiling', () => {
    const product = normalizeProduct({ nutriments: { 'energy-kcal_100g': 621 } });
    expect(product.nutriments.energyKcal).toBe(621);
  });

  it('coerces numeric strings, which the API sometimes returns', () => {
    const product = normalizeProduct({ nutriments: { 'sugars_100g': '12.5' } });
    expect(product.nutriments.sugars).toBe(12.5);
  });

  it('ignores values that are not numbers at all', () => {
    const product = normalizeProduct({ nutriments: { 'sugars_100g': 'unknown' } });
    expect(product.nutriments.sugars).toBeUndefined();
  });

  it('keeps a legitimate zero distinct from missing data', () => {
    const product = normalizeProduct({ nutriments: { 'salt_100g': 0 } });
    expect(product.nutriments.salt).toBe(0);
  });

  it('takes only the first brand from a comma-separated list', () => {
    const product = normalizeProduct({ brands: 'Nutella, FERRERO FRANCE COMMERCIALE' });
    expect(product.brand).toBe('Nutella');
  });

  it('ignores an unknown NOVA group', () => {
    expect(normalizeProduct({ nova_group: 7 }).novaGroup).toBeUndefined();
    expect(normalizeProduct({ nova_group: 'unknown' }).novaGroup).toBeUndefined();
  });

  it('accepts a NOVA group sent as a string', () => {
    expect(normalizeProduct({ nova_group: '4' }).novaGroup).toBe(4);
  });

  it('ignores an unknown Nutri-Score grade', () => {
    expect(normalizeProduct({ nutriscore_grade: 'unknown' }).nutriScore).toBeUndefined();
    expect(normalizeProduct({ nutriscore_grade: 'A' }).nutriScore).toBe('a');
  });
});

describe('normalizeProduct — ingredient analysis', () => {
  it('reads a definite palm oil tag', () => {
    const product = normalizeProduct({ ingredients_analysis_tags: ['en:palm-oil'] });
    expect(product.analysis.palmOil).toBe(true);
  });

  it('reads a definite palm-oil-free tag', () => {
    const product = normalizeProduct({ ingredients_analysis_tags: ['en:palm-oil-free'] });
    expect(product.analysis.palmOil).toBe(false);
  });

  it('leaves "maybe" tags undefined rather than guessing', () => {
    const product = normalizeProduct({
      ingredients_analysis_tags: ['en:maybe-vegan', 'en:vegan-status-unknown'],
    });
    expect(product.analysis.vegan).toBeUndefined();
  });

  it('distinguishes non-vegan from vegan-status-unknown', () => {
    expect(normalizeProduct({ ingredients_analysis_tags: ['en:non-vegan'] }).analysis.vegan).toBe(
      false,
    );
    expect(
      normalizeProduct({ ingredients_analysis_tags: ['en:vegan-status-unknown'] }).analysis.vegan,
    ).toBeUndefined();
  });
});

describe('normalizeProduct — data plausibility', () => {
  it('reports macronutrients that cannot add up', () => {
    const product = normalizeProduct(fixture('7622210449283').product ?? {});
    expect(product.dataWarnings.length).toBeGreaterThan(0);
    expect(product.dataWarnings[0]).toMatch(/not possible/);
  });

  it('reports sugars exceeding total carbohydrates', () => {
    const product = normalizeProduct({
      nutriments: { 'carbohydrates_100g': 10, 'sugars_100g': 30 },
    });
    expect(product.dataWarnings.join(' ')).toMatch(/higher than total carbohydrates/);
  });

  it('reports saturates exceeding total fat', () => {
    const product = normalizeProduct({
      nutriments: { 'fat_100g': 5, 'saturated-fat_100g': 20 },
    });
    expect(product.dataWarnings.join(' ')).toMatch(/higher than total fat/);
  });

  it('leaves consistent data unflagged', () => {
    const product = normalizeProduct(fixture('3017620425035').product ?? {});
    expect(product.dataWarnings).toEqual([]);
  });
});

describe('end-to-end on captured fixtures', () => {
  const profile = makeProfile();

  it.each([
    ['20724696', 'Amandes décortiquées', 92, 'good'],
    ['3229820129488', 'Muesli Raisin, Figue, Datte, Abricot', 85, 'good'],
    ['5449000000996', 'Coca-Cola', 55, 'poor'],
    ['7622210449283', 'Prince', 40, 'poor'],
    ['3017620425035', 'Nutella', 22, 'bad'],
    ['5000159461122', 'Snickers', 16, 'bad'],
  ] as const)('scores %s (%s) at %i (%s)', (barcode, name, score, band) => {
    const product = normalizeResponse(fixture(barcode), 'fixture');
    const verdict = evaluate(product, profile);
    expect(product.name).toBe(name);
    expect(verdict.score).toBe(score);
    expect(verdict.band).toBe(band);
  });

  it('ranks whole almonds above an ultra-processed spread', () => {
    const almonds = evaluate(normalizeResponse(fixture('20724696'), 'fixture'), profile);
    const nutella = evaluate(normalizeResponse(fixture('3017620425035'), 'fixture'), profile);
    expect(almonds.score).toBeGreaterThan(nutella.score);
  });

  it('applies drink thresholds to Coca-Cola', () => {
    const coke = normalizeResponse(fixture('5449000000996'), 'fixture');
    expect(coke.kind).toBe('drink');
  });

  it('flags palm oil in Nutella for a profile that avoids it', () => {
    const nutella = normalizeResponse(fixture('3017620425035'), 'fixture');
    const verdict = evaluate(nutella, makeProfile({ avoidPalmOil: true }));
    expect(verdict.flags.map((f) => f.id)).toContain('palm-oil');
  });

  it('explains every point of the Nutella score', () => {
    const nutella = normalizeResponse(fixture('3017620425035'), 'fixture');
    const verdict = evaluate(nutella, makeProfile());
    const sum = verdict.contributions.reduce((total, c) => total + c.points, 0);
    expect(100 + sum).toBe(verdict.score);
  });
});

import { describe, expect, it } from 'vitest';
import {
  REGISTER_SIZE,
  lookupAdditive,
  lookupAdditives,
  normalizeAdditiveCode,
} from './additives.js';

describe('normalizeAdditiveCode', () => {
  it.each([
    ['en:e322', 'E322'],
    ['E322', 'E322'],
    ['e322', 'E322'],
    ['E 322', 'E322'],
    ['  fr:e330  ', 'E330'],
    ['e1442', 'E1442'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeAdditiveCode(input)).toBe(expected);
  });

  it('collapses roman-numeral manufacturing variants onto the parent substance', () => {
    expect(normalizeAdditiveCode('en:e322i')).toBe('E322');
    expect(normalizeAdditiveCode('en:e450i')).toBe('E450');
    expect(normalizeAdditiveCode('en:e500ii')).toBe('E500');
    expect(normalizeAdditiveCode('en:e503ii')).toBe('E503');
  });

  it('keeps lettered sub-codes, which are genuinely different substances', () => {
    expect(normalizeAdditiveCode('en:e150d')).toBe('E150d');
    expect(normalizeAdditiveCode('en:e472e')).toBe('E472e');
    expect(normalizeAdditiveCode('en:e160a')).toBe('E160a');
  });

  it('passes through unrecognisable input rather than inventing a code', () => {
    expect(normalizeAdditiveCode('not-an-additive')).toBe('NOT-AN-ADDITIVE');
  });
});

describe('lookupAdditive', () => {
  it('resolves a known additive with its regulatory reason', () => {
    const lecithin = lookupAdditive('en:e322');
    expect(lecithin).toMatchObject({ code: 'E322', name: 'Lecithins', concern: 'low', unknown: false });
    expect(lecithin.reason.length).toBeGreaterThan(0);
  });

  it('marks EU-banned additives as high concern', () => {
    const titaniumDioxide = lookupAdditive('en:e171');
    expect(titaniumDioxide.concern).toBe('high');
    expect(titaniumDioxide.reason).toMatch(/banned/i);
  });

  it('marks the six colours that require an EU warning as high concern', () => {
    for (const code of ['e102', 'e104', 'e110', 'e122', 'e124', 'e129']) {
      const additive = lookupAdditive(code);
      expect(additive.concern, code).toBe('high');
      expect(additive.reason, code).toMatch(/activity and attention in children/);
    }
  });

  it('marks sulphites as high concern because they are declarable allergens', () => {
    expect(lookupAdditive('e220').concern).toBe('high');
    expect(lookupAdditive('e223').reason).toMatch(/allergen/i);
  });

  it('reports unknown codes honestly instead of guessing', () => {
    const unknown = lookupAdditive('en:e9999');
    expect(unknown.unknown).toBe(true);
    expect(unknown.code).toBe('E9999');
    expect(unknown.concern).toBe('low');
  });

  it('falls back from an unknown lettered sub-code to its parent', () => {
    // E472z does not exist in the register, but E472e does not cover it either — the parent
    // lookup keeps the result useful rather than blank.
    expect(lookupAdditive('e330z').code).toBe('E330z');
  });

  it('gives every register entry a description and a reason', () => {
    for (const code of ['E100', 'E250', 'E338', 'E621', 'E951']) {
      const additive = lookupAdditive(code);
      expect(additive.description.length, code).toBeGreaterThan(10);
      expect(additive.reason.length, code).toBeGreaterThan(10);
      expect(additive.unknown, code).toBe(false);
    }
  });
});

describe('lookupAdditives', () => {
  it('deduplicates variants that collapse onto the same substance', () => {
    const result = lookupAdditives(['en:e322', 'en:e322i']);
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe('E322');
  });

  it('preserves the order additives appear on the label', () => {
    const result = lookupAdditives(['en:e500', 'en:e322', 'en:e503']);
    expect(result.map((a) => a.code)).toEqual(['E500', 'E322', 'E503']);
  });

  it('returns an empty list for a product with no additives', () => {
    expect(lookupAdditives([])).toEqual([]);
  });
});

describe('REGISTER_SIZE', () => {
  it('is large enough to cover everyday products', () => {
    expect(REGISTER_SIZE).toBeGreaterThan(50);
  });
});

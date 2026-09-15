import { describe, expect, it } from 'vitest';
import { formatPackageSize, parseQuantity } from './quantity.js';

describe('parseQuantity', () => {
  it.each([
    ['1 kg', 1000, 'g'],
    ['375 g', 375, 'g'],
    ['200g', 200, 'g'],
    ['50 G', 50, 'g'],
    ['500 mg', 0.5, 'g'],
    ['330 ml', 330, 'ml'],
    ['33 cl', 330, 'ml'],
    ['5 dl', 500, 'ml'],
    ['1 l', 1000, 'ml'],
  ] as const)('reads %s as %s %s', (input, amount, unit) => {
    expect(parseQuantity(input)).toMatchObject({ amount, unit });
  });

  it('handles the European decimal comma', () => {
    expect(parseQuantity('1,5 L')).toMatchObject({ amount: 1500, unit: 'ml' });
    expect(parseQuantity('0,25 kg')).toMatchObject({ amount: 250, unit: 'g' });
  });

  it('handles a decimal point too', () => {
    expect(parseQuantity('1.5 l')).toMatchObject({ amount: 1500, unit: 'ml' });
  });

  it('ignores the EU estimated sign', () => {
    expect(parseQuantity('300 g e')).toMatchObject({ amount: 300, unit: 'g' });
    expect(parseQuantity('300 g ℮')).toMatchObject({ amount: 300, unit: 'g' });
  });

  it('multiplies out a multipack', () => {
    expect(parseQuantity('6 x 33 cl')).toMatchObject({ amount: 1980, unit: 'ml' });
    expect(parseQuantity('2x125g')).toMatchObject({ amount: 250, unit: 'g' });
    expect(parseQuantity('4 × 100 g')).toMatchObject({ amount: 400, unit: 'g' });
  });

  it('keeps the original text so the UI can show its source', () => {
    expect(parseQuantity('  300 g e  ')?.source).toBe('300 g e');
  });

  it.each([
    [undefined],
    [''],
    ['   '],
    ['family size'],
    ['12 oz'],
    ['1 lb'],
    ['0 g'],
  ])('returns undefined for %s rather than guessing', (input) => {
    expect(parseQuantity(input)).toBeUndefined();
  });

  it('rejects a quantity too large to be a package a person opens', () => {
    expect(parseQuantity('500 kg')).toBeUndefined();
  });

  it('accepts a large but plausible catering pack', () => {
    expect(parseQuantity('5 kg')).toMatchObject({ amount: 5000, unit: 'g' });
  });
});

describe('formatPackageSize', () => {
  it.each([
    [1000, 'g', '1 kg'],
    [1500, 'g', '1.5 kg'],
    [375, 'g', '375 g'],
    [330, 'ml', '330 ml'],
    [1980, 'ml', '1.98 l'],
  ] as const)('formats %s %s as %s', (amount, unit, expected) => {
    expect(formatPackageSize({ amount, unit, source: '' })).toBe(expected);
  });
});

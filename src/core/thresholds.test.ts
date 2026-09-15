import { describe, expect, it } from 'vitest';
import { assessNutrients, classify, thresholdsFor } from './thresholds.js';

describe('classify', () => {
  it('returns undefined when the label did not state a value', () => {
    expect(classify('sugars', undefined, 'solid')).toBeUndefined();
  });

  it('returns undefined for values that are not finite', () => {
    expect(classify('sugars', Number.NaN, 'solid')).toBeUndefined();
    expect(classify('sugars', Number.POSITIVE_INFINITY, 'solid')).toBeUndefined();
  });

  it('treats zero as green rather than as missing data', () => {
    expect(classify('sugars', 0, 'solid')).toBe('green');
  });

  describe('solid thresholds', () => {
    it.each([
      ['fat', 3.0, 'green'],
      ['fat', 3.01, 'amber'],
      ['fat', 17.5, 'amber'],
      ['fat', 17.51, 'red'],
      ['saturates', 1.5, 'green'],
      ['saturates', 5.0, 'amber'],
      ['saturates', 5.01, 'red'],
      ['sugars', 5.0, 'green'],
      ['sugars', 22.5, 'amber'],
      ['sugars', 22.51, 'red'],
      ['salt', 0.3, 'green'],
      ['salt', 1.5, 'amber'],
      ['salt', 1.51, 'red'],
    ] as const)('%s at %s is %s', (key, value, expected) => {
      expect(classify(key, value, 'solid')).toBe(expected);
    });
  });

  describe('drink thresholds', () => {
    it.each([
      ['sugars', 2.5, 'green'],
      ['sugars', 2.51, 'amber'],
      ['sugars', 11.25, 'amber'],
      ['sugars', 11.26, 'red'],
      ['salt', 0.75, 'amber'],
      ['salt', 0.76, 'red'],
      ['fat', 1.5, 'green'],
      ['fat', 8.76, 'red'],
    ] as const)('%s at %s is %s', (key, value, expected) => {
      expect(classify(key, value, 'drink')).toBe(expected);
    });

    it('is stricter than the solid table for the same amount', () => {
      // 10 g of sugars is green-adjacent amber in a solid, and firmly amber in a drink.
      expect(classify('sugars', 10, 'solid')).toBe('amber');
      expect(classify('sugars', 12, 'solid')).toBe('amber');
      expect(classify('sugars', 12, 'drink')).toBe('red');
    });
  });

  it('exposes drink thresholds that are stricter than the solid ones', () => {
    const solid = thresholdsFor('solid');
    const drink = thresholdsFor('drink');
    for (const key of ['fat', 'saturates', 'sugars'] as const) {
      expect(drink[key].greenMax).toBeLessThan(solid[key].greenMax);
      expect(drink[key].redMin).toBeLessThan(solid[key].redMin);
    }
  });
});

describe('assessNutrients', () => {
  it('always returns the four front-of-pack nutrients in display order', () => {
    const result = assessNutrients({}, 'solid');
    expect(result.map((n) => n.key)).toEqual(['fat', 'saturates', 'sugars', 'salt']);
  });

  it('reports missing values without a level instead of defaulting to green', () => {
    const result = assessNutrients({ sugars: 3 }, 'solid');
    const fat = result.find((n) => n.key === 'fat');
    expect(fat?.value).toBeUndefined();
    expect(fat?.level).toBeUndefined();
  });

  it('carries the band edges so the UI can draw the scale', () => {
    const sugars = assessNutrients({ sugars: 3 }, 'solid').find((n) => n.key === 'sugars');
    expect(sugars).toMatchObject({ greenMax: 5, redMin: 22.5, level: 'green' });
  });
});

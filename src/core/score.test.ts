import { describe, expect, it } from 'vitest';
import { lookupAdditives } from './additives.js';
import {
  ADDITIVE_PENALTY_CAP,
  AMBER_PENALTY,
  NUTRIENT_PENALTY_CAP,
  RED_PENALTY,
  bandFor,
  evaluate,
  evaluateProfile,
} from './score.js';
import { makeProduct, makeProfile } from './testing.js';

const neutral = makeProfile();

/** Sum of a verdict's contributions, i.e. the amount subtracted from the starting 100. */
function delta(product = makeProduct(), profile = neutral): number {
  return evaluate(product, profile).contributions.reduce((sum, c) => sum + c.points, 0);
}

describe('bandFor', () => {
  it.each([
    [100, 'good'],
    [80, 'good'],
    [79, 'fair'],
    [60, 'fair'],
    [59, 'poor'],
    [40, 'poor'],
    [39, 'bad'],
    [0, 'bad'],
  ] as const)('maps %i to %s', (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe('evaluate — baseline', () => {
  it('starts a product with nothing against it at 100', () => {
    expect(evaluate(makeProduct(), neutral).score).toBe(100);
  });

  it('flags a product with no nutrition table as low data', () => {
    expect(evaluate(makeProduct(), neutral).lowData).toBe(true);
  });

  it('does not flag low data once any nutrient is known', () => {
    const product = makeProduct({ nutriments: { sugars: 1 } });
    expect(evaluate(product, neutral).lowData).toBe(false);
  });

  it('never returns a score outside 0-100', () => {
    const worst = makeProduct({
      nutriments: { fat: 99, saturates: 90, sugars: 99, salt: 40, addedSugars: 99, energyKcal: 500 },
      novaGroup: 4,
      additives: lookupAdditives(['e171', 'e102', 'e110', 'e122', 'e124', 'e129', 'e220']),
    });
    const verdict = evaluate(worst, neutral);
    expect(verdict.score).toBeGreaterThanOrEqual(0);
    expect(verdict.score).toBeLessThanOrEqual(100);
    expect(verdict.score).toBe(0);
  });
});

describe('evaluate — nutrient penalties', () => {
  it('applies the amber penalty once per amber nutrient', () => {
    const product = makeProduct({ nutriments: { sugars: 10 } });
    expect(delta(product)).toBe(AMBER_PENALTY);
  });

  it('applies the red penalty once per red nutrient', () => {
    const product = makeProduct({ nutriments: { sugars: 40 } });
    expect(delta(product)).toBe(RED_PENALTY);
  });

  it('ignores nutrients the label did not state', () => {
    expect(delta(makeProduct({ nutriments: { sugars: undefined } }))).toBe(0);
  });

  it('caps the four nutrient penalties in total', () => {
    // Four reds would be -60 exactly; the cap is what stops a fifth rule pushing past it.
    const product = makeProduct({
      nutriments: { fat: 40, saturates: 20, sugars: 40, salt: 5 },
    });
    const nutrientPoints = evaluate(product, neutral)
      .contributions.filter((c) => c.id.startsWith('nutrient:'))
      .reduce((sum, c) => sum + c.points, 0);
    expect(nutrientPoints).toBe(NUTRIENT_PENALTY_CAP);
  });

  it('explains each penalty with the measured amount', () => {
    const product = makeProduct({ nutriments: { sugars: 56.3 } });
    const contribution = evaluate(product, neutral).contributions.find(
      (c) => c.id === 'nutrient:sugars:red',
    );
    expect(contribution?.label).toContain('56.3');
    expect(contribution?.label).toContain('per 100 g');
  });

  it.each([
    ['fat', 'Fat is in the high band'],
    ['saturates', 'Saturates are in the high band'],
    ['sugars', 'Sugars are in the high band'],
    ['salt', 'Salt is in the high band'],
  ] as const)('agrees the verb with the %s label', (key, expected) => {
    const product = makeProduct({ nutriments: { [key]: 99 } });
    const contribution = evaluate(product, neutral).contributions.find((c) =>
      c.id.startsWith(`nutrient:${key}`),
    );
    expect(contribution?.label).toContain(expected);
  });

  it('labels drink amounts per 100 ml', () => {
    const product = makeProduct({ kind: 'drink', nutriments: { sugars: 12 } });
    const contribution = evaluate(product, neutral).contributions.find((c) =>
      c.id.startsWith('nutrient:sugars'),
    );
    expect(contribution?.label).toContain('per 100 ml');
  });
});

describe('evaluate — processing level', () => {
  it.each([
    [1, 0],
    [2, -3],
    [3, -8],
    [4, -18],
  ] as const)('penalises NOVA %i by %i', (nova, expected) => {
    expect(delta(makeProduct({ novaGroup: nova }))).toBe(expected);
  });

  it('adds no contribution at all for NOVA 1', () => {
    const contributions = evaluate(makeProduct({ novaGroup: 1 }), neutral).contributions;
    expect(contributions.filter((c) => c.id.startsWith('nova:'))).toHaveLength(0);
  });

  it('ignores an unknown processing level', () => {
    expect(delta(makeProduct({ novaGroup: undefined }))).toBe(0);
  });
});

describe('evaluate — additives', () => {
  it('does not penalise low-concern additives', () => {
    expect(delta(makeProduct({ additives: lookupAdditives(['e322', 'e330']) }))).toBe(0);
  });

  it('penalises medium-concern additives by 3 each', () => {
    expect(delta(makeProduct({ additives: lookupAdditives(['e150d', 'e338']) }))).toBe(-6);
  });

  it('penalises high-concern additives by 7 each', () => {
    expect(delta(makeProduct({ additives: lookupAdditives(['e171', 'e102']) }))).toBe(-14);
  });

  it('never penalises an additive it does not recognise', () => {
    expect(delta(makeProduct({ additives: lookupAdditives(['e9999']) }))).toBe(0);
  });

  it('caps the additive penalties in total', () => {
    const product = makeProduct({
      additives: lookupAdditives(['e171', 'e102', 'e104', 'e110', 'e122', 'e124']),
    });
    const additivePoints = evaluate(product, neutral)
      .contributions.filter((c) => c.id.startsWith('additive:'))
      .reduce((sum, c) => sum + c.points, 0);
    expect(additivePoints).toBe(ADDITIVE_PENALTY_CAP);
  });

  it('lists only medium and high concern additives as notable', () => {
    const product = makeProduct({ additives: lookupAdditives(['e322', 'e171', 'e338']) });
    expect(evaluate(product, neutral).notableAdditives.map((a) => a.code)).toEqual([
      'E171',
      'E338',
    ]);
  });
});

describe('evaluate — added sugars', () => {
  it('ignores added sugars below a tenth of the energy', () => {
    const product = makeProduct({ nutriments: { addedSugars: 2, energyKcal: 400 } });
    expect(delta(product)).toBe(0);
  });

  it('penalises a share above 10 % by 8', () => {
    // 10 g sugar = 40 kcal of 250 kcal = 16 %.
    const product = makeProduct({ nutriments: { addedSugars: 10, energyKcal: 250 } });
    expect(delta(product)).toBe(-8);
  });

  it('penalises a share above 20 % by 15', () => {
    // 30 g sugar = 120 kcal of 400 kcal = 30 %.
    const product = makeProduct({ nutriments: { addedSugars: 30, energyKcal: 400 } });
    expect(delta(product)).toBe(-15);
  });

  it('does nothing when the energy value is missing', () => {
    expect(delta(makeProduct({ nutriments: { addedSugars: 50 } }))).toBe(0);
  });

  it('does not divide by zero energy', () => {
    const product = makeProduct({ nutriments: { addedSugars: 50, energyKcal: 0 } });
    expect(() => evaluate(product, neutral)).not.toThrow();
    expect(delta(product)).toBe(0);
  });
});

describe('evaluate — bonuses', () => {
  it('rewards high fibre', () => {
    expect(delta(makeProduct({ nutriments: { fiber: 6 } }))).toBe(5);
  });

  it('rewards high protein', () => {
    expect(delta(makeProduct({ nutriments: { proteins: 12 } }))).toBe(3);
  });

  it('rewards a high fruit, vegetable and nut content', () => {
    expect(delta(makeProduct({ nutriments: { fruitsVegetablesNuts: 40 } }))).toBe(5);
  });

  it('does not award a bonus just below the threshold', () => {
    expect(delta(makeProduct({ nutriments: { fiber: 5.9, proteins: 11.9 } }))).toBe(0);
  });

  it('withholds every bonus when the source data is inconsistent', () => {
    const product = makeProduct({
      nutriments: { fiber: 52, proteins: 20, fruitsVegetablesNuts: 90 },
      dataWarnings: ['The nutrition values add up to 143 g per 100 g, which is not possible.'],
    });
    expect(delta(product)).toBe(0);
    expect(evaluate(product, neutral).contributions.map((c) => c.id)).toContain('bonus:withheld');
  });

  it('still applies penalties when the source data is inconsistent', () => {
    const product = makeProduct({
      nutriments: { sugars: 40, fiber: 52 },
      dataWarnings: ['inconsistent'],
    });
    expect(delta(product)).toBe(RED_PENALTY);
  });
});

describe('evaluateProfile', () => {
  it('produces no flags for an all-off profile', () => {
    const product = makeProduct({ analysis: { palmOil: true, vegan: false } });
    expect(evaluateProfile(product, neutral)).toEqual([]);
  });

  it('flags palm oil only when the user asked', () => {
    const product = makeProduct({ analysis: { palmOil: true } });
    const flags = evaluateProfile(product, makeProfile({ avoidPalmOil: true }));
    expect(flags.map((f) => f.id)).toEqual(['palm-oil']);
  });

  it('does not flag palm oil when the ingredient analysis is unknown', () => {
    const product = makeProduct({ analysis: {} });
    expect(evaluateProfile(product, makeProfile({ avoidPalmOil: true }))).toEqual([]);
  });

  it('does not claim a product is non-vegan when the data is simply missing', () => {
    const product = makeProduct({ analysis: {} });
    expect(evaluateProfile(product, makeProfile({ veganOnly: true }))).toEqual([]);
  });

  it('flags a non-vegan product for a vegan profile', () => {
    const product = makeProduct({ analysis: { vegan: false } });
    expect(evaluateProfile(product, makeProfile({ veganOnly: true })).map((f) => f.id)).toEqual([
      'not-vegan',
    ]);
  });

  it('flags added sugar with the amount', () => {
    const product = makeProduct({ nutriments: { addedSugars: 51 } });
    const flags = evaluateProfile(product, makeProfile({ avoidAddedSugar: true }));
    expect(flags[0]?.label).toContain('51');
  });

  it('does not flag added sugar when there is none', () => {
    const product = makeProduct({ nutriments: { addedSugars: 0 } });
    expect(evaluateProfile(product, makeProfile({ avoidAddedSugar: true }))).toEqual([]);
  });

  it('flags salt above the low-salt reference but not below it', () => {
    const salty = makeProduct({ nutriments: { salt: 1.2 } });
    const mild = makeProduct({ nutriments: { salt: 0.2 } });
    const profile = makeProfile({ lowSalt: true });
    expect(evaluateProfile(salty, profile).map((f) => f.id)).toEqual(['salt']);
    expect(evaluateProfile(mild, profile)).toEqual([]);
  });

  it('flags user-listed additives, matching regardless of case', () => {
    const product = makeProduct({ additives: lookupAdditives(['en:e621']) });
    const flags = evaluateProfile(product, makeProfile({ avoidAdditives: ['e621'] }));
    expect(flags[0]?.label).toContain('E621');
  });

  it('keeps personal flags out of the score entirely', () => {
    const product = makeProduct({ analysis: { palmOil: true } });
    const withProfile = evaluate(product, makeProfile({ avoidPalmOil: true }));
    const withoutProfile = evaluate(product, neutral);
    expect(withProfile.score).toBe(withoutProfile.score);
    expect(withProfile.flags).toHaveLength(1);
  });
});

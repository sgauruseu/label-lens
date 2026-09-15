import { describe, expect, it } from 'vitest';
import {
  pickSearchCategory,
  rankAlternatives,
  searchCategories,
  reasonsToSwitch,
  type AlternativeCandidate,
} from './alternatives.js';
import { makeProduct } from './testing.js';

function candidate(overrides: Partial<AlternativeCandidate> = {}): AlternativeCandidate {
  return {
    barcode: '1111111111111',
    name: 'Candidate spread',
    nutriments: {},
    ...overrides,
  };
}

describe('searchCategories', () => {
  it('lists usable categories most specific first', () => {
    expect(
      searchCategories([
        'en:breakfasts',
        'en:spreads',
        'en:chocolate-spreads',
        'en:hazelnut-spreads',
        'en:confectionary-based-spreads',
      ]),
    ).toEqual(['confectionary-based-spreads', 'hazelnut-spreads', 'chocolate-spreads', 'spreads']);
  });

  it('is what lets the caller step up when a leaf category is too thin', () => {
    // Nutella's most specific tag holds a handful of products; the next one up holds thousands.
    const slugs = searchCategories([
      'en:spreads',
      'en:hazelnut-spreads',
      'en:confectionary-based-spreads',
    ]);
    expect(slugs[0]).toBe('confectionary-based-spreads');
    expect(slugs[1]).toBe('hazelnut-spreads');
  });

  it('drops duplicates', () => {
    expect(searchCategories(['en:sodas', 'en:sodas'])).toEqual(['sodas']);
  });

  it('returns an empty list when nothing is usable', () => {
    expect(searchCategories(['en:plant-based-foods', 'fr:boissons'])).toEqual([]);
    expect(searchCategories(undefined)).toEqual([]);
  });
});

describe('pickSearchCategory', () => {
  it('takes the most specific English category', () => {
    expect(
      pickSearchCategory([
        'en:plant-based-foods',
        'en:spreads',
        'en:chocolate-spreads',
        'en:hazelnut-spreads',
      ]),
    ).toBe('hazelnut-spreads');
  });

  it('skips non-English tags, which the search endpoint cannot key on', () => {
    expect(pickSearchCategory(['en:spreads', 'fr:pates-a-tartiner'])).toBe('spreads');
  });

  it('refuses categories too broad to compare within', () => {
    // "plant-based foods" contains almonds and biscuits alike; a suggestion from it is noise.
    expect(pickSearchCategory(['en:plant-based-foods', 'en:beverages'])).toBeUndefined();
  });

  it('falls back to a broader tag when the specific ones are unusable', () => {
    expect(pickSearchCategory(['en:sodas', 'fr:boissons', 'en:beverages'])).toBe('sodas');
  });

  it('returns undefined when there is nothing to go on', () => {
    expect(pickSearchCategory(undefined)).toBeUndefined();
    expect(pickSearchCategory([])).toBeUndefined();
    expect(pickSearchCategory(['fr:pates-a-tartiner'])).toBeUndefined();
  });
});

describe('reasonsToSwitch', () => {
  const nutella = makeProduct({
    barcode: '3017620425035',
    nutriScore: 'e',
    novaGroup: 4,
    nutriments: { sugars: 56.3, salt: 0.107 },
  });

  it('leads with the Nutri-Score improvement', () => {
    const reasons = reasonsToSwitch(nutella, candidate({ nutriScore: 'a' }));
    expect(reasons[0]).toBe('Nutri-Score A instead of E');
  });

  it('expresses a large sugar difference as a multiple', () => {
    const reasons = reasonsToSwitch(nutella, candidate({ nutriments: { sugars: 3.7 } }));
    expect(reasons).toContain('15× less sugar');
  });

  it('expresses a small sugar difference as a percentage', () => {
    const reasons = reasonsToSwitch(nutella, candidate({ nutriments: { sugars: 40 } }));
    expect(reasons.some((r) => /% less sugar/.test(r))).toBe(true);
  });

  it('says "no salt" rather than "100% less salt"', () => {
    const salty = makeProduct({ nutriScore: 'e', nutriments: { salt: 1.2 } });
    const reasons = reasonsToSwitch(salty, candidate({ nutriments: { salt: 0 } }));
    expect(reasons).toContain('no salt');
    expect(reasons.some((r) => r.includes('100%'))).toBe(false);
  });

  it('ignores a difference too small to matter', () => {
    const reasons = reasonsToSwitch(nutella, candidate({ nutriments: { sugars: 52 } }));
    expect(reasons.some((r) => /less sugar/.test(r))).toBe(false);
  });

  it('mentions a lower processing level in plain words', () => {
    const reasons = reasonsToSwitch(nutella, candidate({ novaGroup: 1 }));
    expect(reasons).toContain('unprocessed rather than ultra-processed');
  });

  it('says nothing when the candidate is not actually better', () => {
    expect(reasonsToSwitch(nutella, candidate({ nutriScore: 'e', novaGroup: 4 }))).toEqual([]);
  });

  it('says nothing when the data needed to compare is missing', () => {
    expect(reasonsToSwitch(nutella, candidate())).toEqual([]);
  });

  it('never claims an improvement from missing data on the scanned product', () => {
    const unknown = makeProduct({ nutriments: {} });
    expect(reasonsToSwitch(unknown, candidate({ nutriments: { sugars: 1 } }))).toEqual([]);
  });
});

describe('rankAlternatives', () => {
  const nutella = makeProduct({
    barcode: '3017620425035',
    nutriScore: 'e',
    novaGroup: 4,
    nutriments: { sugars: 56.3, salt: 0.107 },
  });

  const better = [
    candidate({ barcode: 'b1', name: 'Nocciola', nutriScore: 'a', novaGroup: 1, nutriments: { sugars: 3.6 } }),
    candidate({ barcode: 'b2', name: 'Purée noisette', nutriScore: 'a', novaGroup: 3, nutriments: { sugars: 3.7 } }),
    candidate({ barcode: 'b3', name: 'Crema cacao', nutriScore: 'b', novaGroup: 4, nutriments: { sugars: 1.6 } }),
  ];

  it('returns only genuine improvements', () => {
    const worse = candidate({ barcode: 'w1', name: 'Worse', nutriScore: 'e', nutriments: { sugars: 60 } });
    const result = rankAlternatives(nutella, [...better, worse]);
    expect(result.map((a) => a.barcode)).not.toContain('w1');
  });

  it('orders by Nutri-Score first, then sugars', () => {
    expect(rankAlternatives(nutella, better).map((a) => a.barcode)).toEqual(['b1', 'b2', 'b3']);
  });

  it('caps the list', () => {
    expect(rankAlternatives(nutella, better, 2)).toHaveLength(2);
  });

  it('never suggests the product that was scanned', () => {
    const self = candidate({ barcode: nutella.barcode, name: 'Nutella', nutriScore: 'a' });
    expect(rankAlternatives(nutella, [self, ...better]).map((a) => a.barcode)).not.toContain(
      nutella.barcode,
    );
  });

  it('drops duplicates', () => {
    const twice = [better[0], better[0]].filter((c): c is AlternativeCandidate => c !== undefined);
    expect(rankAlternatives(nutella, twice)).toHaveLength(1);
  });

  it('drops entries with no name', () => {
    const nameless = candidate({ barcode: 'n1', name: '   ', nutriScore: 'a' });
    expect(rankAlternatives(nutella, [nameless])).toEqual([]);
  });

  it('gives every suggestion at least one reason', () => {
    for (const alternative of rankAlternatives(nutella, better)) {
      expect(alternative.reasons.length, alternative.name).toBeGreaterThan(0);
    }
  });

  it('returns nothing when no candidate improves on the product', () => {
    const equals = candidate({ barcode: 'e1', name: 'Same', nutriScore: 'e', novaGroup: 4 });
    expect(rankAlternatives(nutella, [equals])).toEqual([]);
  });

  it('returns nothing for an empty candidate list', () => {
    expect(rankAlternatives(nutella, [])).toEqual([]);
  });

  it('accepts a sugar improvement when neither side has a Nutri-Score', () => {
    const plain = makeProduct({ barcode: 'p', novaGroup: 4, nutriments: { sugars: 50 } });
    const result = rankAlternatives(plain, [
      candidate({ barcode: 'c', name: 'Less sweet', novaGroup: 2, nutriments: { sugars: 5 } }),
    ]);
    expect(result).toHaveLength(1);
  });

  it('rejects a sugar improvement that comes with worse processing', () => {
    const plain = makeProduct({ barcode: 'p', novaGroup: 1, nutriments: { sugars: 50 } });
    const result = rankAlternatives(plain, [
      candidate({ barcode: 'c', name: 'Less sweet but ultra-processed', novaGroup: 4, nutriments: { sugars: 5 } }),
    ]);
    expect(result).toEqual([]);
  });

  it('is stable — the same candidates always produce the same order', () => {
    const a = rankAlternatives(nutella, better).map((x) => x.barcode);
    const b = rankAlternatives(nutella, [...better].reverse()).map((x) => x.barcode);
    expect(a).toEqual(b);
  });
});

import { describe, expect, it } from 'vitest';
import { REFERENCE_INTAKE_KCAL, summarizeEnergy } from './energy.js';
import { makeProduct } from './testing.js';

describe('summarizeEnergy', () => {
  it('reports nothing but the unit when the label has no energy value', () => {
    expect(summarizeEnergy(makeProduct())).toEqual({ unit: 'g' });
  });

  it('uses millilitres for drinks', () => {
    expect(summarizeEnergy(makeProduct({ kind: 'drink' })).unit).toBe('ml');
  });

  it('passes the per-100 value straight through', () => {
    const product = makeProduct({ nutriments: { energyKcal: 539 } });
    expect(summarizeEnergy(product).per100).toBe(539);
  });

  it('omits the package figure when the net quantity could not be read', () => {
    const product = makeProduct({ nutriments: { energyKcal: 539 } });
    const energy = summarizeEnergy(product);
    expect(energy.perPackage).toBeUndefined();
    expect(energy.packageShareOfReference).toBeUndefined();
  });

  it('scales the per-100 figure to the whole package', () => {
    const product = makeProduct({
      nutriments: { energyKcal: 539 },
      packageSize: { amount: 1000, unit: 'g', source: '1 kg' },
    });
    expect(summarizeEnergy(product).perPackage).toBe(5390);
  });

  it('works for a package smaller than 100 g', () => {
    // A 50 g Snickers at 481 kcal per 100 g is 241 kcal, not 481.
    const product = makeProduct({
      nutriments: { energyKcal: 481 },
      packageSize: { amount: 50, unit: 'g', source: '50 G' },
    });
    expect(summarizeEnergy(product).perPackage).toBe(241);
  });

  it('expresses the package as a share of the EU reference intake', () => {
    const product = makeProduct({
      nutriments: { energyKcal: 42 },
      kind: 'drink',
      packageSize: { amount: 330, unit: 'ml', source: '330 ml' },
    });
    const energy = summarizeEnergy(product);
    expect(energy.perPackage).toBe(139);
    expect(energy.packageShareOfReference).toBe(7);
  });

  it('reports a share above 100 % rather than clamping it', () => {
    const product = makeProduct({
      nutriments: { energyKcal: 539 },
      packageSize: { amount: 1000, unit: 'g', source: '1 kg' },
    });
    expect(summarizeEnergy(product).packageShareOfReference).toBe(270);
  });

  it('uses the EU labelling reference intake', () => {
    expect(REFERENCE_INTAKE_KCAL).toBe(2000);
  });

  it('treats a zero-energy product as data, not as missing', () => {
    const product = makeProduct({
      nutriments: { energyKcal: 0 },
      packageSize: { amount: 500, unit: 'ml', source: '500 ml' },
    });
    const energy = summarizeEnergy(product);
    expect(energy.per100).toBe(0);
    expect(energy.perPackage).toBe(0);
  });
});

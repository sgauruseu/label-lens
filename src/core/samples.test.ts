import { describe, expect, it } from 'vitest';

import { PROTECTED_SAMPLES, canHideSample, hideSample, visibleSamples } from './samples.js';

const ALL = [
  '20724696',
  '3229820129488',
  '3017620425035',
  '5449000000996', // Coca-Cola — protected
  '5000159461122', // Snickers — protected
  '7622210449283',
];

describe('canHideSample', () => {
  it('allows removing an ordinary sample', () => {
    expect(canHideSample('3017620425035')).toBe(true);
  });

  it('refuses the two the demo depends on', () => {
    expect(canHideSample('5449000000996')).toBe(false);
    expect(canHideSample('5000159461122')).toBe(false);
    expect(PROTECTED_SAMPLES).toHaveLength(2);
  });
});

describe('visibleSamples', () => {
  it('returns everything when nothing is hidden', () => {
    expect(visibleSamples(ALL, [])).toEqual(ALL);
  });

  it('drops a hidden sample and keeps the order of the rest', () => {
    expect(visibleSamples(ALL, ['3229820129488'])).toEqual([
      '20724696',
      '3017620425035',
      '5449000000996',
      '5000159461122',
      '7622210449283',
    ]);
  });

  it('keeps a protected sample even if storage was edited to hide it', () => {
    // localStorage is the user's to edit; the protection cannot depend on it being honest.
    expect(visibleSamples(ALL, ['5449000000996', '5000159461122'])).toEqual(ALL);
  });

  it('ignores a hidden code that is not a sample at all', () => {
    expect(visibleSamples(ALL, ['0000000000000'])).toEqual(ALL);
  });
});

describe('hideSample', () => {
  it('adds an ordinary sample', () => {
    expect(hideSample([], '20724696')).toEqual(['20724696']);
  });

  it('never adds a protected one', () => {
    expect(hideSample([], '5000159461122')).toEqual([]);
  });

  it('does not add the same code twice', () => {
    expect(hideSample(['20724696'], '20724696')).toEqual(['20724696']);
  });

  it('leaves the input untouched', () => {
    const hidden = ['20724696'];
    hideSample(hidden, '3017620425035');
    expect(hidden).toEqual(['20724696']);
  });
});

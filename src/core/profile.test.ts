import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, isEmptyProfile, parseProfile } from './profile.js';

describe('DEFAULT_PROFILE', () => {
  it('assumes nothing about a new user', () => {
    expect(isEmptyProfile(DEFAULT_PROFILE)).toBe(true);
  });
});

describe('parseProfile', () => {
  it.each([[null], [undefined], ['string'], [42], [[]]])(
    'falls back to defaults for %s',
    (input) => {
      expect(parseProfile(input)).toEqual(DEFAULT_PROFILE);
    },
  );

  it('keeps valid fields', () => {
    const parsed = parseProfile({ avoidPalmOil: true, lowSalt: true });
    expect(parsed.avoidPalmOil).toBe(true);
    expect(parsed.lowSalt).toBe(true);
  });

  it('does not discard the whole profile because one field is corrupt', () => {
    const parsed = parseProfile({ avoidPalmOil: true, veganOnly: 'yes' });
    expect(parsed.avoidPalmOil).toBe(true);
    expect(parsed.veganOnly).toBe(false);
  });

  it('normalises stored additive codes', () => {
    const parsed = parseProfile({ avoidAdditives: ['en:e621', 'E 951', 'e322i'] });
    expect(parsed.avoidAdditives).toEqual(['E621', 'E951', 'E322']);
  });

  it('drops entries that are not additive codes', () => {
    const parsed = parseProfile({ avoidAdditives: ['sugar', 42, null, 'e330'] });
    expect(parsed.avoidAdditives).toEqual(['E330']);
  });

  it('deduplicates additive codes that normalise to the same substance', () => {
    const parsed = parseProfile({ avoidAdditives: ['e322', 'en:e322i', 'E322'] });
    expect(parsed.avoidAdditives).toEqual(['E322']);
  });

  it('handles a non-array avoidAdditives value', () => {
    expect(parseProfile({ avoidAdditives: 'E621' }).avoidAdditives).toEqual([]);
  });

  it('round-trips a full profile', () => {
    const profile = {
      avoidPalmOil: true,
      avoidAddedSugar: true,
      veganOnly: true,
      vegetarianOnly: false,
      lowSalt: true,
      avoidAdditives: ['E621'],
    };
    expect(parseProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });
});

describe('isEmptyProfile', () => {
  it('is false once any rule is set', () => {
    expect(isEmptyProfile({ ...DEFAULT_PROFILE, lowSalt: true })).toBe(false);
    expect(isEmptyProfile({ ...DEFAULT_PROFILE, avoidAdditives: ['E621'] })).toBe(false);
  });
});

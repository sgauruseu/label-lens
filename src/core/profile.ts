/**
 * Profile defaults and validation.
 *
 * The profile is the only personal data the app holds. It is written to `localStorage` by
 * `adapters/storage.ts` and never leaves the device — which is why parsing has to be
 * defensive: the stored value may be from an older version, hand-edited, or corrupt.
 */

import { normalizeAdditiveCode } from './additives.js';
import type { Profile } from './types.js';

/** Everything off. A new user is not assumed to avoid anything. */
export const DEFAULT_PROFILE: Profile = {
  avoidPalmOil: false,
  avoidAddedSugar: false,
  veganOnly: false,
  vegetarianOnly: false,
  lowSalt: false,
  avoidAdditives: [],
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerces unknown input into a valid `Profile`, falling back field by field.
 *
 * A single bad field never discards the rest of the profile.
 */
export function parseProfile(input: unknown): Profile {
  if (typeof input !== 'object' || input === null) return { ...DEFAULT_PROFILE };
  const raw = input as Record<string, unknown>;

  const additives = Array.isArray(raw.avoidAdditives)
    ? Array.from(
        new Set(
          raw.avoidAdditives
            .filter((v): v is string => typeof v === 'string')
            .map(normalizeAdditiveCode)
            .filter((code) => /^E\d{3,4}[a-z]?$/.test(code)),
        ),
      )
    : [];

  return {
    avoidPalmOil: bool(raw.avoidPalmOil, DEFAULT_PROFILE.avoidPalmOil),
    avoidAddedSugar: bool(raw.avoidAddedSugar, DEFAULT_PROFILE.avoidAddedSugar),
    veganOnly: bool(raw.veganOnly, DEFAULT_PROFILE.veganOnly),
    vegetarianOnly: bool(raw.vegetarianOnly, DEFAULT_PROFILE.vegetarianOnly),
    lowSalt: bool(raw.lowSalt, DEFAULT_PROFILE.lowSalt),
    avoidAdditives: additives,
  };
}

/** True when the user has not configured anything, so the UI can nudge them once. */
export function isEmptyProfile(profile: Profile): boolean {
  return (
    !profile.avoidPalmOil &&
    !profile.avoidAddedSugar &&
    !profile.veganOnly &&
    !profile.vegetarianOnly &&
    !profile.lowSalt &&
    profile.avoidAdditives.length === 0
  );
}

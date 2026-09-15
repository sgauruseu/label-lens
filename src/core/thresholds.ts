/**
 * Nutrient reference thresholds.
 *
 * Source: UK Food Standards Agency / Department of Health front-of-pack nutrition labelling
 * guidance — the "traffic light" bands. Solids are expressed per 100 g, drinks per 100 ml.
 *
 * These are published reference values for comparison, not dietary advice.
 */

import type { NutrientAssessment, Nutriments, ProductKind, TrafficLight } from './types.js';

interface ThresholdBand {
  /** Green band is `value <= greenMax`. */
  greenMax: number;
  /** Red band is `value > redMin`. Anything in between is amber. */
  redMin: number;
}

type NutrientKey = NutrientAssessment['key'];

const SOLID: Record<NutrientKey, ThresholdBand> = {
  fat: { greenMax: 3.0, redMin: 17.5 },
  saturates: { greenMax: 1.5, redMin: 5.0 },
  sugars: { greenMax: 5.0, redMin: 22.5 },
  salt: { greenMax: 0.3, redMin: 1.5 },
};

const DRINK: Record<NutrientKey, ThresholdBand> = {
  fat: { greenMax: 1.5, redMin: 8.75 },
  saturates: { greenMax: 0.75, redMin: 2.5 },
  sugars: { greenMax: 2.5, redMin: 11.25 },
  salt: { greenMax: 0.3, redMin: 0.75 },
};

const LABELS: Record<NutrientKey, string> = {
  fat: 'Fat',
  saturates: 'Saturates',
  sugars: 'Sugars',
  salt: 'Salt',
};

/** The four nutrients carried on a front-of-pack label, in display order. */
export const NUTRIENT_KEYS: readonly NutrientKey[] = ['fat', 'saturates', 'sugars', 'salt'];

/** Returns the threshold table that applies to a product kind. */
export function thresholdsFor(kind: ProductKind): Record<NutrientKey, ThresholdBand> {
  return kind === 'drink' ? DRINK : SOLID;
}

/**
 * Classifies an amount against its band.
 *
 * Boundaries follow the FSA definition exactly: the green band is inclusive of its upper
 * bound, and the red band is exclusive of its lower bound. A value sitting precisely on
 * `redMin` is therefore amber, not red.
 */
export function classify(
  key: NutrientKey,
  value: number | undefined,
  kind: ProductKind,
): TrafficLight | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const band = thresholdsFor(kind)[key];
  if (value <= band.greenMax) return 'green';
  if (value > band.redMin) return 'red';
  return 'amber';
}

/** Builds the full traffic-light panel for a product. */
export function assessNutrients(
  nutriments: Nutriments,
  kind: ProductKind,
): NutrientAssessment[] {
  const table = thresholdsFor(kind);
  return NUTRIENT_KEYS.map((key) => {
    const value = nutriments[key];
    return {
      key,
      label: LABELS[key],
      value,
      unit: 'g' as const,
      level: classify(key, value, kind),
      greenMax: table[key].greenMax,
      redMin: table[key].redMin,
    };
  });
}

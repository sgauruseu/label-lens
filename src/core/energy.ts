/**
 * Energy presentation.
 *
 * "539 kcal per 100 g" is a number nobody reasons with. "The whole jar is 5390 kcal" is. This
 * module does that arithmetic, and the share of a day it represents, from a clearly stated
 * reference intake.
 */

import type { Product } from './types.js';

/**
 * Reference daily intake used on EU front-of-pack labels (Regulation 1169/2011, Annex XIII):
 * 8400 kJ / 2000 kcal for an average adult. It is a labelling reference, not a personal target,
 * and the UI says so.
 */
export const REFERENCE_INTAKE_KCAL = 2000;

export interface EnergySummary {
  /** Energy per 100 g or 100 ml, straight from the label. */
  per100?: number;
  /** Energy in the whole package, when the net quantity could be read. */
  perPackage?: number;
  /** Percentage of the 2000 kcal reference intake the whole package represents. */
  packageShareOfReference?: number;
  /** `g` for solids, `ml` for drinks. */
  unit: 'g' | 'ml';
}

/** Computes everything the UI needs to show about energy. Missing inputs stay missing. */
export function summarizeEnergy(product: Product): EnergySummary {
  const unit: 'g' | 'ml' = product.kind === 'drink' ? 'ml' : 'g';
  const per100 = product.nutriments.energyKcal;
  const size = product.packageSize;

  if (per100 === undefined) return { unit };
  if (size === undefined) return { per100, unit };

  const perPackage = Math.round((per100 * size.amount) / 100);
  return {
    per100,
    perPackage,
    packageShareOfReference: Math.round((perPackage / REFERENCE_INTAKE_KCAL) * 100),
    unit,
  };
}

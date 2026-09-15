/**
 * The Label Score engine.
 *
 * Pure: `evaluate(product, profile)` is a total function of its arguments. No I/O, no clock,
 * no randomness. Every adjustment it makes is returned as a named `ScoreContribution` so the
 * UI can show the user exactly how the number was reached.
 *
 * The rules and their caps are specified in PRD.md §5.1.
 */

import { assessNutrients } from './thresholds.js';
import type {
  Product,
  Profile,
  ProfileFlag,
  ScoreBand,
  ScoreContribution,
  Verdict,
} from './types.js';

/** Penalty applied to a nutrient sitting in the amber band. */
export const AMBER_PENALTY = -6;
/** Penalty applied to a nutrient sitting in the red band. */
export const RED_PENALTY = -15;
/** The four nutrient penalties together may not exceed this. */
export const NUTRIENT_PENALTY_CAP = -60;
/** All additive penalties together may not exceed this. */
export const ADDITIVE_PENALTY_CAP = -20;

const NOVA_PENALTY: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: -3, 3: -8, 4: -18 };

const NOVA_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Unprocessed or minimally processed (NOVA 1)',
  2: 'Processed culinary ingredient (NOVA 2)',
  3: 'Processed food (NOVA 3)',
  4: 'Ultra-processed food (NOVA 4)',
};

const ADDITIVE_PENALTY: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: -3,
  high: -7,
};

/**
 * Added-sugar rule, expressed as the share of a product's energy that comes from added
 * sugars. The WHO guideline on free sugars is below 10 % of total energy intake, with a
 * further conditional recommendation of below 5 %. Sugar contributes 4 kcal per gram.
 */
const ADDED_SUGAR_SHARE_WARN = 0.1;
const ADDED_SUGAR_SHARE_HIGH = 0.2;
const KCAL_PER_GRAM_SUGAR = 4;

const FIBER_BONUS_THRESHOLD = 6;
const PROTEIN_BONUS_THRESHOLD = 12;
const FRUIT_BONUS_THRESHOLD = 40;

/** Formats an amount for display without trailing zeros: `5`, `5.3`, `22.5`. */
function fmt(value: number): string {
  return Number(value.toFixed(1)).toString();
}

/**
 * Applies a cap to a set of negative contributions, scaling nothing: the individual line items
 * are kept as they are and a single compensating "capped" line is appended when the cap bites.
 * Showing the cap explicitly is the point — a silently clamped total is not explainable.
 */
function applyCap(
  contributions: ScoreContribution[],
  cap: number,
  id: string,
  label: string,
): ScoreContribution[] {
  const total = contributions.reduce((sum, c) => sum + c.points, 0);
  if (total >= cap) return contributions;
  return [...contributions, { id, label, points: cap - total }];
}

/** Maps a final score onto its display band. */
export function bandFor(score: number): ScoreBand {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'poor';
  return 'bad';
}

/** Evaluates the user's personal rules. These produce flags, never score changes. */
export function evaluateProfile(product: Product, profile: Profile): ProfileFlag[] {
  const flags: ProfileFlag[] = [];

  if (profile.avoidPalmOil && product.analysis.palmOil === true) {
    flags.push({ id: 'palm-oil', label: 'Contains palm oil, which you chose to avoid.', severity: 'warn' });
  }

  if (profile.avoidAddedSugar) {
    const added = product.nutriments.addedSugars;
    if (added !== undefined && added > 0) {
      flags.push({
        id: 'added-sugar',
        label: `Contains ${fmt(added)} g of added sugars per 100 ${product.kind === 'drink' ? 'ml' : 'g'}.`,
        severity: 'warn',
      });
    }
  }

  if (profile.veganOnly && product.analysis.vegan === false) {
    flags.push({ id: 'not-vegan', label: 'Not vegan.', severity: 'warn' });
  }

  if (profile.vegetarianOnly && product.analysis.vegetarian === false) {
    flags.push({ id: 'not-vegetarian', label: 'Not vegetarian.', severity: 'warn' });
  }

  if (profile.lowSalt) {
    const salt = product.nutriments.salt;
    const assessment = assessNutrients(product.nutriments, product.kind).find((n) => n.key === 'salt');
    if (salt !== undefined && assessment?.level && assessment.level !== 'green') {
      flags.push({
        id: 'salt',
        label: `Salt is ${fmt(salt)} g per 100 ${product.kind === 'drink' ? 'ml' : 'g'}, above the low-salt reference.`,
        severity: 'warn',
      });
    }
  }

  const avoided = new Set(profile.avoidAdditives.map((c) => c.trim().toUpperCase()));
  for (const additive of product.additives) {
    if (avoided.has(additive.code)) {
      flags.push({
        id: `additive:${additive.code}`,
        label: `Contains ${additive.code} (${additive.name}), which you chose to avoid.`,
        severity: 'warn',
      });
    }
  }

  return flags;
}

/**
 * Scores a product and explains the result.
 *
 * Missing data is never treated as a good result: a product with no nutrition table is
 * reported as `lowData` so the UI can say "not enough data" instead of showing a flattering
 * score built out of absent values.
 */
export function evaluate(product: Product, profile: Profile): Verdict {
  const unit = product.kind === 'drink' ? 'ml' : 'g';
  const nutrients = assessNutrients(product.nutriments, product.kind);

  // --- Nutrient traffic lights ---------------------------------------------------------
  const nutrientContributions: ScoreContribution[] = [];
  for (const n of nutrients) {
    if (n.level === 'amber' && n.value !== undefined) {
      nutrientContributions.push({
        id: `nutrient:${n.key}:amber`,
        label: `${n.label} is in the medium band (${fmt(n.value)} g per 100 ${unit}).`,
        points: AMBER_PENALTY,
      });
    } else if (n.level === 'red' && n.value !== undefined) {
      nutrientContributions.push({
        id: `nutrient:${n.key}:red`,
        label: `${n.label} is in the high band (${fmt(n.value)} g per 100 ${unit}).`,
        points: RED_PENALTY,
      });
    }
  }
  const cappedNutrients = applyCap(
    nutrientContributions,
    NUTRIENT_PENALTY_CAP,
    'nutrient:cap',
    'Nutrient penalties capped.',
  );

  // --- Processing level ----------------------------------------------------------------
  const processing: ScoreContribution[] = [];
  if (product.novaGroup !== undefined) {
    const points = NOVA_PENALTY[product.novaGroup];
    if (points !== 0) {
      processing.push({
        id: `nova:${product.novaGroup}`,
        label: NOVA_LABEL[product.novaGroup] + '.',
        points,
      });
    }
  }

  // --- Added sugars --------------------------------------------------------------------
  const addedSugar: ScoreContribution[] = [];
  const { addedSugars, energyKcal } = product.nutriments;
  if (addedSugars !== undefined && energyKcal !== undefined && energyKcal > 0) {
    const share = (addedSugars * KCAL_PER_GRAM_SUGAR) / energyKcal;
    const pct = Math.round(share * 100);
    if (share > ADDED_SUGAR_SHARE_HIGH) {
      addedSugar.push({
        id: 'added-sugar:high',
        label: `About ${pct} % of this product’s energy comes from added sugars (WHO guideline: under 10 %).`,
        points: -15,
      });
    } else if (share > ADDED_SUGAR_SHARE_WARN) {
      addedSugar.push({
        id: 'added-sugar:warn',
        label: `About ${pct} % of this product’s energy comes from added sugars (WHO guideline: under 10 %).`,
        points: -8,
      });
    }
  }

  // --- Additives -----------------------------------------------------------------------
  const additiveContributions: ScoreContribution[] = [];
  for (const additive of product.additives) {
    if (additive.unknown) continue;
    const points = ADDITIVE_PENALTY[additive.concern];
    if (points === 0) continue;
    additiveContributions.push({
      id: `additive:${additive.code}`,
      label: `${additive.code} ${additive.name} — ${additive.reason}`,
      points,
    });
  }
  const cappedAdditives = applyCap(
    additiveContributions,
    ADDITIVE_PENALTY_CAP,
    'additive:cap',
    'Additive penalties capped.',
  );

  // --- Bonuses -------------------------------------------------------------------------
  // Bonuses are withheld when the source data is self-contradictory. Penalties are not: a
  // product with impossible figures should not be able to buy itself points, but it also
  // should not escape the penalties its plausible figures already earned.
  const bonuses: ScoreContribution[] = [];
  const { fiber, proteins, fruitsVegetablesNuts } = product.nutriments;
  const trustworthy = product.dataWarnings.length === 0;
  if (!trustworthy) {
    bonuses.push({
      id: 'bonus:withheld',
      label: 'Bonuses withheld: the source nutrition data is inconsistent.',
      points: 0,
    });
  }
  if (trustworthy && fiber !== undefined && fiber >= FIBER_BONUS_THRESHOLD) {
    bonuses.push({
      id: 'bonus:fiber',
      label: `High in fibre (${fmt(fiber)} g per 100 ${unit}).`,
      points: 5,
    });
  }
  if (trustworthy && proteins !== undefined && proteins >= PROTEIN_BONUS_THRESHOLD) {
    bonuses.push({
      id: 'bonus:protein',
      label: `High in protein (${fmt(proteins)} g per 100 ${unit}).`,
      points: 3,
    });
  }
  if (
    trustworthy &&
    fruitsVegetablesNuts !== undefined &&
    fruitsVegetablesNuts >= FRUIT_BONUS_THRESHOLD
  ) {
    bonuses.push({
      id: 'bonus:fruit',
      label: `Estimated ${fmt(fruitsVegetablesNuts)} % fruit, vegetable or nut content.`,
      points: 5,
    });
  }

  const contributions = [
    ...cappedNutrients,
    ...addedSugar,
    ...processing,
    ...cappedAdditives,
    ...bonuses,
  ];
  const raw = 100 + contributions.reduce((sum, c) => sum + c.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // A product is "low data" when the nutrition table is effectively absent. Without it the
  // score is built from too little to be worth showing as a number.
  const knownNutrients = nutrients.filter((n) => n.value !== undefined).length;
  const lowData = knownNutrients === 0;

  return {
    score,
    band: bandFor(score),
    contributions,
    nutrients,
    flags: evaluateProfile(product, profile),
    notableAdditives: product.additives.filter((a) => !a.unknown && a.concern !== 'low'),
    lowData,
  };
}

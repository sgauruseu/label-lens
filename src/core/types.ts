/**
 * Domain types for Label Lens.
 *
 * Everything in `src/core` is pure: these types describe data that has already been
 * fetched and normalized. Nothing here knows about Open Food Facts, React, or the browser.
 */

/** Which reference thresholds apply. Drinks use roughly half the solid thresholds. */
export type ProductKind = 'solid' | 'drink';

/**
 * Nutrient amounts per 100 g (solids) or per 100 ml (drinks).
 *
 * `undefined` means "the label did not state it" and must stay distinct from `0`.
 * A missing value is never scored — it is reported as "no data".
 */
export interface Nutriments {
  energyKcal?: number;
  fat?: number;
  saturates?: number;
  carbohydrates?: number;
  sugars?: number;
  addedSugars?: number;
  fiber?: number;
  proteins?: number;
  salt?: number;
  /** Estimated fruit/vegetable/nut content, 0-100 %. */
  fruitsVegetablesNuts?: number;
}

/** A food additive as it appears on a label, resolved against the local register. */
export interface Additive {
  /** Canonical E-number, uppercased and without spaces, e.g. `E322`. */
  code: string;
  /** Common name, e.g. `Lecithins`. Falls back to the code when unknown. */
  name: string;
  /** What it is used for, in one plain sentence. */
  description: string;
  /** Regulatory concern level. Never a health claim — see `additives.ts`. */
  concern: ConcernLevel;
  /** Why it carries that level, e.g. `Banned as a food additive in the EU since 2022.` */
  reason: string;
  /** True when the additive is absent from the local register. */
  unknown: boolean;
}

export type ConcernLevel = 'low' | 'medium' | 'high';

/** Dietary facts Open Food Facts derives from the ingredient list. */
export interface IngredientAnalysis {
  palmOil?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
}

/** A product, normalized and ready to score. */
export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  imageUrl?: string;
  kind: ProductKind;
  nutriments: Nutriments;
  additives: Additive[];
  ingredientsText?: string;
  analysis: IngredientAnalysis;
  /** NOVA food-processing group, 1 (unprocessed) to 4 (ultra-processed). */
  novaGroup?: 1 | 2 | 3 | 4;
  /** Nutri-Score letter as published by Open Food Facts. */
  nutriScore?: 'a' | 'b' | 'c' | 'd' | 'e';
  allergens: string[];
  /**
   * Problems detected in the source data, e.g. macronutrients summing to more than 100 g.
   * Open Food Facts is crowd-sourced, so this is common. Shown to the user, and used by the
   * scorer to withhold bonuses that implausible values would otherwise earn.
   */
  dataWarnings: string[];
  /** Where the data came from, shown in the UI so the user is never misled. */
  source: 'openfoodfacts' | 'fixture' | 'ai-photo';
}

/** The user's own rules. Stored locally, never transmitted. */
export interface Profile {
  avoidPalmOil: boolean;
  avoidAddedSugar: boolean;
  veganOnly: boolean;
  vegetarianOnly: boolean;
  lowSalt: boolean;
  /** Extra E-numbers the user wants flagged, e.g. `['E621']`. */
  avoidAdditives: string[];
}

export type TrafficLight = 'green' | 'amber' | 'red';

/** One nutrient measured against its reference thresholds. */
export interface NutrientAssessment {
  /** Stable key, e.g. `sugars`. */
  key: 'fat' | 'saturates' | 'sugars' | 'salt';
  label: string;
  /** Amount per 100 g/ml, or `undefined` when the label did not state it. */
  value?: number;
  unit: 'g';
  level?: TrafficLight;
  /** Upper bound of the green band, for rendering the scale. */
  greenMax: number;
  /** Lower bound of the red band, for rendering the scale. */
  redMin: number;
}

/** A single signed adjustment to the Label Score, always shown to the user. */
export interface ScoreContribution {
  /** Machine-readable rule id, e.g. `nutrient:sugars:red`. */
  id: string;
  /** Human-readable reason, e.g. `Sugars are in the high band (56.3 g per 100 g)`. */
  label: string;
  /** Signed points. Negative is a penalty. */
  points: number;
}

/** A personal rule that matched. Hard yes/no, deliberately kept out of the score. */
export interface ProfileFlag {
  id: string;
  label: string;
  severity: 'info' | 'warn';
}

export type ScoreBand = 'good' | 'fair' | 'poor' | 'bad';

/** The complete, explainable result of evaluating a product. */
export interface Verdict {
  score: number;
  band: ScoreBand;
  contributions: ScoreContribution[];
  nutrients: NutrientAssessment[];
  flags: ProfileFlag[];
  /** Additives at medium or high concern, for the summary line. */
  notableAdditives: Additive[];
  /** True when too little data was available to score meaningfully. */
  lowData: boolean;
}

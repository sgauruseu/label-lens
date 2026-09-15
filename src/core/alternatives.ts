/**
 * Finding something better in the same category.
 *
 * This is the part that turns the app from a judge into an advisor. Scoring a jar of spread at
 * 22 is only half an answer; the other half is "here are three spreads with a fifteenth of the
 * sugar".
 *
 * Pure: the candidates arrive already fetched. Two deliberate decisions are worth stating.
 *
 * **Candidates are ranked by the official Nutri-Score, not by our own Label Score.** The search
 * endpoint returns a summary — a handful of nutrients, often with gaps — and computing our
 * score from partial data would produce a confident number built on absences. The UI says which
 * scale it is using, and tapping a suggestion runs the full lookup and the real verdict.
 *
 * **Only strictly better candidates are offered.** A list that includes equals and near-misses
 * is a search result, not a recommendation.
 */

import type { Nutriments, Product } from './types.js';

/** A product as the category search returns it: a summary, with gaps. */
export interface AlternativeCandidate {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  nutriScore?: 'a' | 'b' | 'c' | 'd' | 'e';
  novaGroup?: 1 | 2 | 3 | 4;
  nutriments: Nutriments;
}

/** A candidate that beat the scanned product, with the reasons it did. */
export interface Alternative extends AlternativeCandidate {
  /** Plain-language reasons, most persuasive first. Never empty. */
  reasons: string[];
}

const GRADE_RANK: Record<'a' | 'b' | 'c' | 'd' | 'e', number> = { a: 1, b: 2, c: 3, d: 4, e: 5 };

/**
 * Categories that are too broad to make a useful comparison — everything is "plant-based foods".
 * A suggestion drawn from one of these is noise, so they are never used as the search key.
 */
const TOO_BROAD = new Set([
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:beverages',
  'en:beverages-and-beverages-preparations',
  'en:snacks',
  'en:sweet-snacks',
  'en:breakfasts',
  'en:groceries',
  'en:foods',
  'en:cereals-and-potatoes',
  'en:meats-and-their-products',
  'en:dairies',
  'en:non-alcoholic-beverages',
]);

/**
 * Orders the categories worth searching in, most specific first.
 *
 * Open Food Facts orders `categories_tags` roughly general to specific, but the last tag is not
 * reliably the best comparison set — Nutella's most specific tag is
 * `confectionary-based-spreads`, which holds a handful of products, while `hazelnut-spreads`
 * one step up holds three thousand. So this returns a *list* and the caller walks it until a
 * category yields enough products to compare against.
 *
 * Non-English tags are dropped because the search endpoint keys on the English slug, and
 * categories too broad to compare within are dropped because a suggestion drawn from
 * "plant-based foods" is noise.
 */
export function searchCategories(categories: readonly string[] | undefined): string[] {
  if (!categories) return [];
  const slugs: string[] = [];
  const seen = new Set<string>();
  for (let i = categories.length - 1; i >= 0; i -= 1) {
    const tag = categories[i]?.toLowerCase().trim();
    if (!tag || !tag.startsWith('en:') || TOO_BROAD.has(tag)) continue;
    const slug = tag.slice(3);
    if (slug.length === 0 || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

/** The single most specific usable category, or `undefined`. Convenience over the list. */
export function pickSearchCategory(categories: readonly string[] | undefined): string | undefined {
  return searchCategories(categories)[0];
}

/**
 * Formats a "how much less" comparison: `no salt`, `15× less sugar`, `30% less salt`.
 *
 * Zero gets its own wording. "100 % less salt" is arithmetically true and reads like a machine
 * wrote it; "no salt" is what a person would say.
 */
function lessBy(current: number, candidate: number, noun: string): string | undefined {
  if (candidate >= current || current <= 0) return undefined;
  if (candidate === 0) return `no ${noun}`;
  const ratio = current / candidate;
  if (ratio >= 2) return `${Math.round(ratio)}× less ${noun}`;
  const percent = Math.round((1 - candidate / current) * 100);
  return percent >= 15 ? `${percent}% less ${noun}` : undefined;
}

const NOVA_WORD: Record<1 | 2 | 3 | 4, string> = {
  1: 'unprocessed',
  2: 'a culinary ingredient',
  3: 'processed',
  4: 'ultra-processed',
};

/** Builds the reasons a candidate is an improvement. Returns `[]` when it is not one. */
export function reasonsToSwitch(current: Product, candidate: AlternativeCandidate): string[] {
  const reasons: string[] = [];

  if (current.nutriScore && candidate.nutriScore) {
    const currentRank = GRADE_RANK[current.nutriScore];
    const candidateRank = GRADE_RANK[candidate.nutriScore];
    if (candidateRank < currentRank) {
      reasons.push(
        `Nutri-Score ${candidate.nutriScore.toUpperCase()} instead of ${current.nutriScore.toUpperCase()}`,
      );
    }
  }

  const sugarReason =
    current.nutriments.sugars !== undefined && candidate.nutriments.sugars !== undefined
      ? lessBy(current.nutriments.sugars, candidate.nutriments.sugars, 'sugar')
      : undefined;
  if (sugarReason) reasons.push(sugarReason);

  const saltReason =
    current.nutriments.salt !== undefined && candidate.nutriments.salt !== undefined
      ? lessBy(current.nutriments.salt, candidate.nutriments.salt, 'salt')
      : undefined;
  if (saltReason) reasons.push(saltReason);

  if (
    current.novaGroup !== undefined &&
    candidate.novaGroup !== undefined &&
    candidate.novaGroup < current.novaGroup
  ) {
    reasons.push(`${NOVA_WORD[candidate.novaGroup]} rather than ${NOVA_WORD[current.novaGroup]}`);
  }

  return reasons;
}

/**
 * Ranks candidates and keeps only genuine improvements.
 *
 * A candidate qualifies when its Nutri-Score is strictly better, or — when one of the two has no
 * Nutri-Score — when it has strictly less sugar and no worse processing level. The scanned
 * product itself and anything with no name are dropped.
 *
 * Ordering: Nutri-Score, then sugars, then processing level, then barcode so the list is stable
 * across runs.
 */
export function rankAlternatives(
  current: Product,
  candidates: readonly AlternativeCandidate[],
  limit = 3,
): Alternative[] {
  const seen = new Set<string>([current.barcode]);
  const qualifying: Alternative[] = [];

  for (const candidate of candidates) {
    if (!candidate.name.trim() || seen.has(candidate.barcode)) continue;
    seen.add(candidate.barcode);

    const reasons = reasonsToSwitch(current, candidate);
    if (reasons.length === 0) continue;

    // A better letter grade is enough on its own. Without one on either side, the improvement
    // has to be nutritional rather than merely a difference.
    const gradeBetter =
      current.nutriScore !== undefined &&
      candidate.nutriScore !== undefined &&
      GRADE_RANK[candidate.nutriScore] < GRADE_RANK[current.nutriScore];

    if (!gradeBetter) {
      const lessSugar =
        current.nutriments.sugars !== undefined &&
        candidate.nutriments.sugars !== undefined &&
        candidate.nutriments.sugars < current.nutriments.sugars;
      const notWorseProcessing =
        current.novaGroup === undefined ||
        candidate.novaGroup === undefined ||
        candidate.novaGroup <= current.novaGroup;
      if (!lessSugar || !notWorseProcessing) continue;
    }

    qualifying.push({ ...candidate, reasons });
  }

  qualifying.sort((a, b) => {
    const grade =
      (a.nutriScore ? GRADE_RANK[a.nutriScore] : 9) - (b.nutriScore ? GRADE_RANK[b.nutriScore] : 9);
    if (grade !== 0) return grade;
    const sugars = (a.nutriments.sugars ?? 999) - (b.nutriments.sugars ?? 999);
    if (sugars !== 0) return sugars;
    const nova = (a.novaGroup ?? 9) - (b.novaGroup ?? 9);
    if (nova !== 0) return nova;
    return a.barcode.localeCompare(b.barcode);
  });

  return qualifying.slice(0, limit);
}

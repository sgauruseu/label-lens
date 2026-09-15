/**
 * Package-size parsing.
 *
 * Open Food Facts stores the net quantity as free text written by whoever entered the product:
 * `1 kg`, `375 g`, `300 g e`, `50 G`, `330 ml`, `1,5 L`, `6 x 33 cl`. Parsing it is what turns
 * "539 kcal per 100 g" into "the whole jar is 5390 kcal", which is the number people actually
 * reason with.
 *
 * Pure, and deliberately conservative: anything it cannot read confidently becomes `undefined`
 * rather than a plausible guess, because a wrong package size produces a confidently wrong
 * calorie count.
 */

/** A net quantity normalized to grams (solids) or millilitres (liquids). */
export interface PackageSize {
  amount: number;
  unit: 'g' | 'ml';
  /** The original label text, so the UI can show what it was read from. */
  source: string;
}

/** Factors to the base unit of each measure. */
const MASS_TO_GRAMS: Record<string, number> = { mg: 0.001, g: 1, gr: 1, kg: 1000 };
const VOLUME_TO_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000, cc: 1 };

/** Above this, the text is a case or a pallet rather than a package a person opens. */
const MAX_REASONABLE = 50_000;

/**
 * Reads a net quantity.
 *
 * Handles a leading multiplier (`6 x 33 cl`), decimal commas (`1,5 L`), missing spaces
 * (`200g`), any capitalisation, and the EU estimated-sign suffix (`300 g e`, `300 g ℮`).
 * Non-metric units return `undefined` — guessing at `12 oz` is worse than saying nothing.
 */
export function parseQuantity(text: string | undefined): PackageSize | undefined {
  if (!text) return undefined;
  const cleaned = text.trim().toLowerCase().replace(/℮/g, ' ');
  if (cleaned.length === 0) return undefined;

  const match =
    /(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(kg|mg|gr|g|cl|dl|ml|cc|l)\b/.exec(cleaned);
  if (!match) return undefined;

  const multiplier = match[1] === undefined ? 1 : Number(match[1]);
  const value = Number((match[2] ?? '').replace(',', '.'));
  const unit = match[3] ?? '';
  if (!Number.isFinite(multiplier) || !Number.isFinite(value) || multiplier <= 0 || value <= 0) {
    return undefined;
  }

  const massFactor = MASS_TO_GRAMS[unit];
  const volumeFactor = VOLUME_TO_ML[unit];

  const amount =
    massFactor !== undefined ? value * multiplier * massFactor : volumeFactor !== undefined
      ? value * multiplier * volumeFactor
      : Number.NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_REASONABLE) return undefined;

  return {
    amount: Math.round(amount * 100) / 100,
    unit: massFactor !== undefined ? 'g' : 'ml',
    source: text.trim(),
  };
}

/** Formats a package size the way a label would: `1 kg`, `375 g`, `1.5 l`, `330 ml`. */
export function formatPackageSize(size: PackageSize): string {
  const { amount, unit } = size;
  if (unit === 'g' && amount >= 1000) {
    return `${Number((amount / 1000).toFixed(2))} kg`;
  }
  if (unit === 'ml' && amount >= 1000) {
    return `${Number((amount / 1000).toFixed(2))} l`;
  }
  return `${Number(amount.toFixed(1))} ${unit}`;
}

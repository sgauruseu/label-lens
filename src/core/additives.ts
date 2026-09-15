/**
 * Local register of food additives.
 *
 * Concern levels are assigned on **regulatory** grounds only — never on health speculation:
 *
 *  - `high`   : banned as a food additive in the EU, OR carries a legally mandated warning
 *               on the label, OR is a declarable allergen at threshold.
 *  - `medium` : restricted use, an established ADI (acceptable daily intake) limit, or an
 *               open / recent EFSA re-evaluation.
 *  - `low`    : no restriction beyond normal good manufacturing practice.
 *
 * `reason` states the regulatory fact, so the UI never has to invent a health claim.
 */

import type { Additive, ConcernLevel } from './types.js';

interface RegisterEntry {
  name: string;
  description: string;
  concern: ConcernLevel;
  reason: string;
}

/**
 * The six azo/quinoline colours that must, under EU Regulation 1333/2008 Annex V, carry the
 * statement "may have an adverse effect on activity and attention in children".
 */
const SOUTHAMPTON_WARNING =
  'Must carry the EU label warning "may have an adverse effect on activity and attention in children".';

const REGISTER: Record<string, RegisterEntry> = {
  // --- Colours -------------------------------------------------------------------------
  E100: { name: 'Curcumin', description: 'Yellow colour extracted from turmeric.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E101: { name: 'Riboflavin', description: 'Yellow colour, also vitamin B2.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E102: { name: 'Tartrazine', description: 'Synthetic lemon-yellow azo dye.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E104: { name: 'Quinoline Yellow', description: 'Synthetic yellow colour.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E110: { name: 'Sunset Yellow FCF', description: 'Synthetic orange-yellow azo dye.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E120: { name: 'Cochineal / Carmine', description: 'Red colour made from cochineal insects.', concern: 'medium', reason: 'Animal-derived; an established ADI applies.' },
  E122: { name: 'Azorubine / Carmoisine', description: 'Synthetic red azo dye.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E124: { name: 'Ponceau 4R', description: 'Synthetic red azo dye.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E129: { name: 'Allura Red AC', description: 'Synthetic red azo dye.', concern: 'high', reason: SOUTHAMPTON_WARNING },
  E131: { name: 'Patent Blue V', description: 'Synthetic blue colour.', concern: 'medium', reason: 'Restricted use with an established ADI.' },
  E133: { name: 'Brilliant Blue FCF', description: 'Synthetic blue colour.', concern: 'medium', reason: 'Restricted use with an established ADI.' },
  E150a: { name: 'Plain Caramel', description: 'Brown colour made by heating sugar.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E150c: { name: 'Ammonia Caramel', description: 'Brown colour produced with ammonia compounds.', concern: 'medium', reason: 'Group ADI established by EFSA for caramel colours.' },
  E150d: { name: 'Sulphite Ammonia Caramel', description: 'Brown colour used in colas.', concern: 'medium', reason: 'Group ADI established by EFSA for caramel colours.' },
  E160a: { name: 'Carotenes', description: 'Orange colour, precursor of vitamin A.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E163: { name: 'Anthocyanins', description: 'Purple-red colour from fruit and vegetables.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E171: { name: 'Titanium Dioxide', description: 'White pigment used for opacity and gloss.', concern: 'high', reason: 'Banned as a food additive in the EU since August 2022.' },
  E172: { name: 'Iron Oxides', description: 'Black, red and yellow mineral pigments.', concern: 'low', reason: 'Restricted to surface treatment and coatings.' },

  // --- Preservatives -------------------------------------------------------------------
  E200: { name: 'Sorbic Acid', description: 'Preservative against moulds and yeasts.', concern: 'low', reason: 'Established ADI, widely used within limits.' },
  E202: { name: 'Potassium Sorbate', description: 'Preservative against moulds and yeasts.', concern: 'low', reason: 'Established ADI, widely used within limits.' },
  E210: { name: 'Benzoic Acid', description: 'Preservative for acidic foods and drinks.', concern: 'medium', reason: 'Restricted maximum levels; EFSA re-evaluation of the group ADI.' },
  E211: { name: 'Sodium Benzoate', description: 'Preservative for acidic foods and drinks.', concern: 'medium', reason: 'Restricted maximum levels; EFSA re-evaluation of the group ADI.' },
  E220: { name: 'Sulphur Dioxide', description: 'Preservative and antioxidant, common in wine and dried fruit.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E221: { name: 'Sodium Sulphite', description: 'Sulphite preservative.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E222: { name: 'Sodium Bisulphite', description: 'Sulphite preservative.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E223: { name: 'Sodium Metabisulphite', description: 'Sulphite preservative and antioxidant.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E224: { name: 'Potassium Metabisulphite', description: 'Sulphite preservative and antioxidant.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E228: { name: 'Potassium Bisulphite', description: 'Sulphite preservative.', concern: 'high', reason: 'Declarable allergen above 10 mg/kg under EU allergen labelling rules.' },
  E249: { name: 'Potassium Nitrite', description: 'Curing salt for meat; fixes colour and inhibits bacteria.', concern: 'medium', reason: 'Restricted maximum levels, lowered across the EU in 2023.' },
  E250: { name: 'Sodium Nitrite', description: 'Curing salt for meat; fixes colour and inhibits bacteria.', concern: 'medium', reason: 'Restricted maximum levels, lowered across the EU in 2023.' },
  E251: { name: 'Sodium Nitrate', description: 'Curing agent for cured meats and some cheeses.', concern: 'medium', reason: 'Restricted maximum levels, lowered across the EU in 2023.' },
  E252: { name: 'Potassium Nitrate', description: 'Curing agent for cured meats and some cheeses.', concern: 'medium', reason: 'Restricted maximum levels, lowered across the EU in 2023.' },
  E280: { name: 'Propionic Acid', description: 'Preservative against mould in bread.', concern: 'low', reason: 'Established ADI, restricted to specific bakery uses.' },
  E282: { name: 'Calcium Propionate', description: 'Preservative against mould in bread.', concern: 'low', reason: 'Established ADI, restricted to specific bakery uses.' },

  // --- Antioxidants and acidity regulators ---------------------------------------------
  E300: { name: 'Ascorbic Acid', description: 'Antioxidant, also vitamin C.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E306: { name: 'Tocopherol Extract', description: 'Natural antioxidant, also vitamin E.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E320: { name: 'BHA (Butylated Hydroxyanisole)', description: 'Synthetic antioxidant for fats and oils.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E321: { name: 'BHT (Butylated Hydroxytoluene)', description: 'Synthetic antioxidant for fats and oils.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E322: { name: 'Lecithins', description: 'Emulsifier, usually from soya or sunflower.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E325: { name: 'Sodium Lactate', description: 'Acidity regulator and humectant.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E330: { name: 'Citric Acid', description: 'Acidity regulator and antioxidant.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E331: { name: 'Sodium Citrates', description: 'Acidity regulator and emulsifying salt.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E338: { name: 'Phosphoric Acid', description: 'Acidity regulator, characteristic of colas.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E339: { name: 'Sodium Phosphates', description: 'Acidity regulator and stabiliser.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E340: { name: 'Potassium Phosphates', description: 'Acidity regulator and stabiliser.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E341: { name: 'Calcium Phosphates', description: 'Anti-caking agent and firming agent.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E450: { name: 'Diphosphates', description: 'Raising agent and stabiliser.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E451: { name: 'Triphosphates', description: 'Stabiliser and water-binding agent in meat and fish.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },
  E452: { name: 'Polyphosphates', description: 'Stabiliser and emulsifying salt.', concern: 'medium', reason: 'Covered by the EFSA group ADI for phosphates set in 2019.' },

  // --- Thickeners, stabilisers, emulsifiers ---------------------------------------------
  E407: { name: 'Carrageenan', description: 'Thickener and gelling agent from red seaweed.', concern: 'medium', reason: 'Established ADI; not permitted in infant formula in the EU.' },
  E410: { name: 'Locust Bean Gum', description: 'Thickener from carob seeds.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E412: { name: 'Guar Gum', description: 'Thickener from guar beans.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E414: { name: 'Acacia Gum', description: 'Thickener and stabiliser, also called gum arabic.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E415: { name: 'Xanthan Gum', description: 'Thickener produced by fermentation.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E420: { name: 'Sorbitol', description: 'Sugar alcohol used as sweetener and humectant.', concern: 'medium', reason: 'Above 10 % the label must warn of a possible laxative effect.' },
  E421: { name: 'Mannitol', description: 'Sugar alcohol used as sweetener and anti-caking agent.', concern: 'medium', reason: 'Above 10 % the label must warn of a possible laxative effect.' },
  E422: { name: 'Glycerol', description: 'Humectant and sweetener.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E440: { name: 'Pectins', description: 'Gelling agent from fruit.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E471: { name: 'Mono- and Diglycerides of Fatty Acids', description: 'Emulsifier keeping fat and water mixed.', concern: 'low', reason: 'No numerical ADI; used at quantum satis.' },
  E472e: { name: 'DATEM', description: 'Dough-strengthening emulsifier in bread.', concern: 'low', reason: 'Established ADI, used within limits.' },
  E476: { name: 'Polyglycerol Polyricinoleate', description: 'Emulsifier that thins chocolate during moulding.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E481: { name: 'Sodium Stearoyl Lactylate', description: 'Dough conditioner and emulsifier.', concern: 'low', reason: 'Established ADI, used within limits.' },
  E500: { name: 'Sodium Carbonates', description: 'Raising agent and acidity regulator.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E503: { name: 'Ammonium Carbonates', description: 'Raising agent in biscuits.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },
  E509: { name: 'Calcium Chloride', description: 'Firming agent and acidity regulator.', concern: 'low', reason: 'No restriction beyond good manufacturing practice.' },

  // --- Flavour enhancers and sweeteners -------------------------------------------------
  E621: { name: 'Monosodium Glutamate', description: 'Flavour enhancer giving a savoury (umami) taste.', concern: 'medium', reason: 'Group ADI for glutamates established by EFSA in 2017.' },
  E627: { name: 'Disodium Guanylate', description: 'Flavour enhancer, usually paired with E621.', concern: 'medium', reason: 'Restricted use; not permitted in foods for infants.' },
  E631: { name: 'Disodium Inosinate', description: 'Flavour enhancer, usually paired with E621.', concern: 'medium', reason: 'Restricted use; not permitted in foods for infants.' },
  E950: { name: 'Acesulfame K', description: 'Intense artificial sweetener.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E951: { name: 'Aspartame', description: 'Intense artificial sweetener.', concern: 'medium', reason: 'Established ADI; the label must declare it as a source of phenylalanine.' },
  E952: { name: 'Cyclamate', description: 'Intense artificial sweetener.', concern: 'medium', reason: 'Established ADI; not permitted in several countries outside the EU.' },
  E954: { name: 'Saccharin', description: 'Intense artificial sweetener.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E955: { name: 'Sucralose', description: 'Intense artificial sweetener.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E960: { name: 'Steviol Glycosides', description: 'Intense sweetener from the stevia plant.', concern: 'medium', reason: 'Established ADI with restricted maximum levels.' },
  E965: { name: 'Maltitol', description: 'Sugar alcohol used as a bulk sweetener.', concern: 'medium', reason: 'Above 10 % the label must warn of a possible laxative effect.' },
  E967: { name: 'Xylitol', description: 'Sugar alcohol used as a bulk sweetener.', concern: 'medium', reason: 'Above 10 % the label must warn of a possible laxative effect.' },
};

/**
 * Normalizes an additive identifier to its canonical register key.
 *
 * Accepts Open Food Facts tags (`en:e322i`), bare codes (`e322`), spaced codes (`E 322`) and
 * sub-codes. Sub-codes written in roman numerals (`E322i`) collapse onto their parent, because
 * the register describes the substance, not the manufacturing variant. Lettered sub-codes such
 * as `E150d` and `E472e` are kept, since those are genuinely different substances.
 */
export function normalizeAdditiveCode(raw: string): string {
  const stripped = raw.trim().toLowerCase().replace(/^[a-z]{2}:/, '').replace(/\s+/g, '');
  const match = /^e(\d{3,4})([a-z]*)$/.exec(stripped);
  if (!match) return raw.trim().toUpperCase();
  const digits = match[1] ?? '';
  const suffix = match[2] ?? '';
  // Roman-numeral suffixes (i, ii, iii, iv, v, vi) denote manufacturing variants.
  const isRoman = suffix.length > 0 && /^[iv]+$/.test(suffix);
  return `E${digits}${isRoman ? '' : suffix}`;
}

/** Looks up one additive. Unknown codes are returned honestly rather than guessed at. */
export function lookupAdditive(raw: string): Additive {
  const code = normalizeAdditiveCode(raw);
  const entry = REGISTER[code] ?? REGISTER[code.replace(/[a-z]$/, '')];
  if (!entry) {
    return {
      code,
      name: code,
      description: 'Not in the local register — no information available offline.',
      concern: 'low',
      reason: 'Unknown additive; not scored.',
      unknown: true,
    };
  }
  return { code, ...entry, unknown: false };
}

/** Resolves a list of raw tags, dropping duplicates while preserving label order. */
export function lookupAdditives(raws: readonly string[]): Additive[] {
  const seen = new Set<string>();
  const out: Additive[] = [];
  for (const raw of raws) {
    const additive = lookupAdditive(raw);
    if (seen.has(additive.code)) continue;
    seen.add(additive.code);
    out.push(additive);
  }
  return out;
}

/** Number of additives known to the register. Used by the About screen. */
export const REGISTER_SIZE = Object.keys(REGISTER).length;

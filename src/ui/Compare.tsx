/**
 * Side-by-side comparison of two scanned products.
 *
 * The comparison is intentionally shallow: score, the four front-of-pack nutrients, processing
 * level and additive count. Anything more becomes a spreadsheet, and the question this view
 * answers is only "which of these two do I put in the basket".
 */

import { summarizeEnergy } from '../core/energy.js';
import { evaluate } from '../core/score.js';
import type { Product, Profile } from '../core/types.js';
import type { HistoryEntry } from '../adapters/storage.js';

interface Row {
  label: string;
  left: string;
  right: string;
  /** -1 when the left side is preferable, 1 when the right is, 0 when neither. */
  winner: -1 | 0 | 1;
}

/** Formats a value that may be absent, so "no data" never masquerades as a good result. */
function amount(value: number | undefined, unit: string): string {
  return value === undefined ? '—' : `${value} ${unit}`;
}

/** Lower is better for every nutrient on a front-of-pack label. */
function lowerWins(a: number | undefined, b: number | undefined): -1 | 0 | 1 {
  if (a === undefined || b === undefined || a === b) return 0;
  return a < b ? -1 : 1;
}

function buildRows(left: Product, right: Product, profile: Profile): Row[] {
  const leftVerdict = evaluate(left, profile);
  const rightVerdict = evaluate(right, profile);
  const unit = left.kind === 'drink' && right.kind === 'drink' ? 'ml' : 'g';
  const leftEnergy = summarizeEnergy(left);
  const rightEnergy = summarizeEnergy(right);

  const rows: Row[] = [
    {
      label: 'Label Score',
      left: String(leftVerdict.score),
      right: String(rightVerdict.score),
      winner:
        leftVerdict.score === rightVerdict.score ? 0 : leftVerdict.score > rightVerdict.score ? -1 : 1,
    },
    {
      label: `Energy / 100 ${unit}`,
      left: leftEnergy.per100 === undefined ? '—' : `${Math.round(leftEnergy.per100)} kcal`,
      right: rightEnergy.per100 === undefined ? '—' : `${Math.round(rightEnergy.per100)} kcal`,
      winner: lowerWins(leftEnergy.per100, rightEnergy.per100),
    },
    {
      label: 'Energy / pack',
      left: leftEnergy.perPackage === undefined ? '—' : `${leftEnergy.perPackage} kcal`,
      right: rightEnergy.perPackage === undefined ? '—' : `${rightEnergy.perPackage} kcal`,
      // Packages differ in size, so a smaller total is not automatically the better buy.
      winner: 0,
    },
  ];

  for (const key of ['fat', 'saturates', 'sugars', 'salt'] as const) {
    const labels = { fat: 'Fat', saturates: 'Saturates', sugars: 'Sugars', salt: 'Salt' };
    rows.push({
      label: `${labels[key]} / 100 ${unit}`,
      left: amount(left.nutriments[key], 'g'),
      right: amount(right.nutriments[key], 'g'),
      winner: lowerWins(left.nutriments[key], right.nutriments[key]),
    });
  }

  rows.push({
    label: 'Processing (NOVA)',
    left: left.novaGroup ? String(left.novaGroup) : '—',
    right: right.novaGroup ? String(right.novaGroup) : '—',
    winner: lowerWins(left.novaGroup, right.novaGroup),
  });

  rows.push({
    label: 'Additives',
    left: String(left.additives.length),
    right: String(right.additives.length),
    winner: lowerWins(left.additives.length, right.additives.length),
  });

  return rows;
}

export function Compare({
  entries,
  profile,
  selection,
  onSelect,
}: {
  entries: HistoryEntry[];
  profile: Profile;
  selection: [string, string];
  onSelect: (side: 0 | 1, barcode: string) => void;
}) {
  if (entries.length < 2) {
    return (
      <div className="card">
        <h2>Compare</h2>
        <p className="muted">Scan at least two products and they can be compared here.</p>
      </div>
    );
  }

  const left = entries.find((e) => e.product.barcode === selection[0])?.product ?? entries[0]?.product;
  const right = entries.find((e) => e.product.barcode === selection[1])?.product ?? entries[1]?.product;
  if (!left || !right) return null;

  const rows = buildRows(left, right, profile);

  return (
    <div className="card">
      <h2>Compare</h2>
      <div className="compare-grid" style={{ marginBottom: 16 }}>
        {([0, 1] as const).map((side) => (
          <label key={side}>
            <span className="faint">{side === 0 ? 'Left' : 'Right'}</span>
            <select
              className="btn"
              style={{ width: '100%', marginTop: 4 }}
              value={side === 0 ? left.barcode : right.barcode}
              onChange={(event) => onSelect(side, event.target.value)}
            >
              {entries.map((entry) => (
                <option key={entry.product.barcode} value={entry.product.barcode}>
                  {entry.product.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {rows.map((row) => (
        <div className="compare-row" key={row.label}>
          <span className={`left${row.winner === -1 ? ' win' : ''}`}>{row.left}</span>
          <span className="label">{row.label}</span>
          <span className={`right${row.winner === 1 ? ' win' : ''}`}>{row.right}</span>
        </div>
      ))}

      <div className="faint" style={{ marginTop: 12 }}>
        Green marks the better of the two on each line. Lower is better for every nutrient here.
      </div>
    </div>
  );
}

/**
 * Verdict presentation.
 *
 * Presentation only: every number shown here was computed by `core/score.ts`. The component's
 * job is to make the reasoning visible, which is why the contribution list is not collapsible
 * and not summarised — the whole point of the product is that the user can audit the score.
 */

import { REFERENCE_INTAKE_KCAL, summarizeEnergy } from '../core/energy.js';
import { formatPackageSize } from '../core/quantity.js';
import type {
  Additive,
  NutrientAssessment,
  Product,
  ScoreBand,
  Verdict as VerdictType,
} from '../core/types.js';

const BAND_LABEL: Record<ScoreBand, string> = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  bad: 'Bad',
};

const BAND_COLOR: Record<ScoreBand, string> = {
  good: '#35c48a',
  fair: '#e8b13a',
  poor: '#f0883e',
  bad: '#ef5f5f',
};

const NOVA_TEXT: Record<1 | 2 | 3 | 4, string> = {
  1: 'Unprocessed or minimally processed',
  2: 'Processed culinary ingredient',
  3: 'Processed food',
  4: 'Ultra-processed food',
};

function ScoreRing({ score, band }: { score: number; band: ScoreBand }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  return (
    <div className="ring">
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <circle cx="46" cy="46" r={radius} fill="none" stroke="#22304a" strokeWidth="7" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          fill="none"
          stroke={BAND_COLOR[band]}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div className="ring-value" style={{ color: BAND_COLOR[band] }}>
          {score}
        </div>
        <div className="ring-band">{BAND_LABEL[band]}</div>
      </div>
    </div>
  );
}

/**
 * Draws one nutrient against its bands.
 *
 * The scale is capped at twice the red threshold so an outlier such as 53 g of fat still
 * produces a readable bar rather than a marker pinned to the far edge.
 */
function NutrientBar({ nutrient, unit }: { nutrient: NutrientAssessment; unit: string }) {
  const { value, level, greenMax, redMin, label } = nutrient;
  const max = redMin * 2;
  const position = value === undefined ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="nutrient">
      <div className="nutrient-row">
        <span>
          <span className={`dot dot-${level ?? 'none'}`} />
          {label}
        </span>
        <span className="nutrient-amount">
          {value === undefined ? <span className="faint">no data</span> : `${value} g`}
        </span>
      </div>
      <div className="scale">
        <span
          className={`s-green${level === 'green' ? ' on' : ''}`}
          style={{ width: `${(greenMax / max) * 100}%` }}
        />
        <span
          className={`s-amber${level === 'amber' ? ' on' : ''}`}
          style={{ width: `${((redMin - greenMax) / max) * 100}%` }}
        />
        <span className={`s-red${level === 'red' ? ' on' : ''}`} style={{ flex: 1 }} />
        {value !== undefined && <i className="marker" style={{ left: `${position}%` }} />}
      </div>
      <div className="faint" style={{ marginTop: 4 }}>
        low up to {greenMax} g · high above {redMin} g per 100 {unit}
      </div>
    </div>
  );
}

/**
 * Energy panel.
 *
 * Per 100 g is what the label states; the whole-package figure is what people actually decide
 * with. Both are shown, and the package figure is always labelled with the size it came from so
 * it can never be mistaken for a serving.
 */
function EnergyPanel({ product }: { product: Product }) {
  const energy = summarizeEnergy(product);
  if (energy.per100 === undefined) {
    return (
      <div className="card">
        <h3>Energy</h3>
        <p className="faint" style={{ margin: 0 }}>
          The database has no energy value for this product.
        </p>
      </div>
    );
  }

  const kj = product.nutriments.energyKj;

  return (
    <div className="card">
      <h3>Energy</h3>
      <div className="energy-grid">
        <div className="energy-cell">
          <div className="energy-value">
            {Math.round(energy.per100)}
            <span className="energy-unit">kcal</span>
          </div>
          <div className="faint">
            per 100 {energy.unit}
            {kj !== undefined && ` · ${Math.round(kj)} kJ`}
          </div>
        </div>

        {energy.perPackage !== undefined && product.packageSize && (
          <div className="energy-cell">
            <div className="energy-value">
              {energy.perPackage.toLocaleString('en-GB')}
              <span className="energy-unit">kcal</span>
            </div>
            <div className="faint">whole pack · {formatPackageSize(product.packageSize)}</div>
            {energy.packageShareOfReference !== undefined && (
              <div className="energy-share">
                {energy.packageShareOfReference}% of the {REFERENCE_INTAKE_KCAL} kcal daily
                reference intake
              </div>
            )}
          </div>
        )}
      </div>
      {energy.perPackage === undefined && product.quantity && (
        <div className="faint" style={{ marginTop: 10 }}>
          Net quantity "{product.quantity}" could not be read, so the whole-pack figure is not
          shown.
        </div>
      )}
      <div className="faint" style={{ marginTop: 10 }}>
        The reference intake is the EU labelling figure for an average adult, not a personal
        target.
      </div>
    </div>
  );
}

function AdditiveCard({ additive }: { additive: Additive }) {
  return (
    <div className="additive">
      <div className="additive-head">
        <span className="additive-code">{additive.code}</span>
        <span>{additive.unknown ? '' : additive.name}</span>
        {!additive.unknown && (
          <span className={`tag tag-${additive.concern}`}>{additive.concern}</span>
        )}
      </div>
      <div className="faint" style={{ marginTop: 3 }}>
        {additive.description}
      </div>
      {!additive.unknown && (
        <div className="faint" style={{ marginTop: 2 }}>
          {additive.reason}
        </div>
      )}
    </div>
  );
}

export function VerdictView({
  product,
  verdict,
  offline,
  fallbackReason,
}: {
  product: Product;
  verdict: VerdictType;
  offline?: boolean;
  fallbackReason?: string;
}) {
  const unit = product.kind === 'drink' ? 'ml' : 'g';

  return (
    <>
      {fallbackReason && (
        <div className="notice">
          {fallbackReason} Showing the bundled offline copy of this product.
        </div>
      )}

      {product.dataWarnings.map((warning) => (
        <div className="notice" key={warning}>
          {warning}
        </div>
      ))}

      <div className="card">
        <div className="verdict-head">
          {product.imageUrl && (
            <img
              className="thumb"
              src={product.imageUrl}
              alt=""
              // Open Food Facts images are hotlinked and occasionally 404. An empty white box
              // looks like a rendering bug, so a broken image removes itself instead.
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          <div className="verdict-title">
            <h2>{product.name}</h2>
            <div className="faint">
              {[product.brand, product.quantity].filter(Boolean).join(' · ') || product.barcode}
            </div>
            <div className="meta">
              {product.nutriments.energyKcal !== undefined && (
                <span className="pill">
                  {Math.round(product.nutriments.energyKcal)} kcal / 100{' '}
                  {product.kind === 'drink' ? 'ml' : 'g'}
                </span>
              )}
              {product.novaGroup && (
                <span className="pill">
                  NOVA {product.novaGroup} — {NOVA_TEXT[product.novaGroup]}
                </span>
              )}
              {product.nutriScore && (
                <span className="pill">Nutri-Score {product.nutriScore.toUpperCase()}</span>
              )}
              <span className="pill">{product.kind === 'drink' ? 'Drink' : 'Food'}</span>
              {(offline || product.source !== 'openfoodfacts') && (
                <span className="pill">
                  {product.source === 'ai-photo' ? 'Read from photo' : 'Offline data'}
                </span>
              )}
            </div>
          </div>
          {!verdict.lowData && <ScoreRing score={verdict.score} band={verdict.band} />}
        </div>
      </div>

      <EnergyPanel product={product} />

      {verdict.lowData && (
        <div className="notice">
          This product has no nutrition table in the database, so there is not enough data to
          score it. The additives and ingredients below are still accurate.
        </div>
      )}

      {verdict.flags.length > 0 && (
        <div className="card">
          <h3>Your rules</h3>
          {verdict.flags.map((flag) => (
            <div className="flag" key={flag.id}>
              <span aria-hidden="true">!</span>
              <span>{flag.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Per 100 {unit}</h3>
        {verdict.nutrients.map((nutrient) => (
          <NutrientBar key={nutrient.key} nutrient={nutrient} unit={unit} />
        ))}
        {product.nutriments.addedSugars !== undefined && (
          <div className="faint" style={{ marginTop: 12 }}>
            Added sugars {product.nutriments.addedSugars} g per 100 {unit}
          </div>
        )}
      </div>

      {!verdict.lowData && (
        <div className="card">
          <h3>How this score was reached</h3>
          <div className="start-line">
            <span className="contrib-points">100</span>
            <span>Every product starts here.</span>
          </div>
          {verdict.contributions.map((contribution) => (
            <div className="contrib" key={contribution.id}>
              <span
                className={`contrib-points ${
                  contribution.points < 0 ? 'neg' : contribution.points > 0 ? 'pos' : 'zero'
                }`}
              >
                {contribution.points > 0 ? `+${contribution.points}` : contribution.points}
              </span>
              <span className="contrib-label">{contribution.label}</span>
            </div>
          ))}
          <div className="start-line" style={{ borderBottom: 0, fontWeight: 700 }}>
            <span className="contrib-points">{verdict.score}</span>
            <span>Label Score</span>
          </div>
        </div>
      )}

      {product.additives.length > 0 && (
        <div className="card">
          <h3>Additives ({product.additives.length})</h3>
          {product.additives.map((additive) => (
            <AdditiveCard key={additive.code} additive={additive} />
          ))}
        </div>
      )}

      {product.allergens.length > 0 && (
        <div className="card">
          <h3>Allergens</h3>
          <div className="meta" style={{ marginTop: 0 }}>
            {product.allergens.map((allergen) => (
              <span className="pill" key={allergen}>
                {allergen}
              </span>
            ))}
          </div>
        </div>
      )}

      {product.ingredientsText && (
        <div className="card">
          <h3>Ingredients</h3>
          <div className="muted" style={{ fontSize: 14 }}>
            {product.ingredientsText}
          </div>
        </div>
      )}

      <div className="card">
        <div className="faint">
          The Label Score is a transparent arithmetic summary of published reference values —
          the FSA front-of-pack thresholds, the NOVA processing classification and the EU
          additive register. It is not medical or dietary advice, and it is not a substitute for
          reading the label yourself.
        </div>
      </div>
    </>
  );
}

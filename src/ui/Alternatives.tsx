/**
 * "Better in the same category".
 *
 * The card that turns a verdict into a decision. It loads lazily — the category search is
 * rate-limited hard enough that firing it on every scan would guarantee failure on the one scan
 * that matters, so the user asks for it and the result is cached for the session.
 *
 * Suggestions are ranked by the official Nutri-Score rather than by this app's own score, and
 * the card says so: the search returns a summary with gaps, and computing our score from partial
 * data would be a confident number built on absences. Tapping a suggestion runs the full lookup.
 */

import { useState } from 'react';
import {
  NoCategoryError,
  fetchCandidates,
} from '../adapters/alternativesClient.js';
import { rankAlternatives, type Alternative } from '../core/alternatives.js';
import { humanizeTag } from '../core/normalize.js';
import type { Product } from '../core/types.js';

interface State {
  status: 'idle' | 'loading' | 'done' | 'error';
  alternatives: Alternative[];
  category?: string;
  note?: string;
  error?: string;
}

export function Alternatives({
  product,
  offline,
  onOpen,
}: {
  product: Product;
  offline: boolean;
  onOpen: (barcode: string) => void;
}) {
  const [state, setState] = useState<State>({ status: 'idle', alternatives: [] });

  async function load() {
    setState({ status: 'loading', alternatives: [] });
    try {
      const result = await fetchCandidates(product.categoryTags, { offline });
      const alternatives = rankAlternatives(product, result.candidates);
      setState({
        status: 'done',
        alternatives,
        category: result.category,
        ...(result.note !== undefined ? { note: result.note } : {}),
      });
    } catch (error) {
      setState({
        status: 'error',
        alternatives: [],
        error:
          error instanceof NoCategoryError
            ? error.message
            : 'The category search could not be reached.',
      });
    }
  }

  return (
    <div className="card">
      <h3>Better in the same category</h3>

      {state.status === 'idle' && (
        <>
          <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
            Look for products of the same kind that score better than this one.
          </p>
          <button type="button" className="btn small" onClick={() => void load()}>
            Find better alternatives
          </button>
        </>
      )}

      {state.status === 'loading' && (
        <p className="muted" style={{ margin: 0 }}>
          <span className="spinner" />
          Searching the category…
        </p>
      )}

      {state.status === 'error' && <div className="notice">{state.error}</div>}

      {state.status === 'done' && (
        <>
          {state.category && (
            <div className="faint" style={{ marginBottom: 12 }}>
              Compared within <strong>{humanizeTag(state.category)}</strong>, ranked by the
              official Nutri-Score.
              {state.note ? ` ${state.note}` : ''}
            </div>
          )}

          {state.alternatives.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Nothing in this category scored better. That is a result too.
            </p>
          ) : (
            state.alternatives.map((alternative) => (
              <div className="alt" key={alternative.barcode}>
                <div className="alt-grade" aria-label={`Nutri-Score ${alternative.nutriScore}`}>
                  {alternative.nutriScore ? alternative.nutriScore.toUpperCase() : '—'}
                </div>
                <div className="alt-body">
                  <strong>{alternative.name}</strong>
                  <div className="faint">
                    {[alternative.brand, alternative.quantity].filter(Boolean).join(' · ')}
                  </div>
                  <div className="alt-reasons">
                    {alternative.reasons.map((reason) => (
                      <span className="alt-reason" key={reason}>
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => onOpen(alternative.barcode)}
                >
                  Scan it
                </button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

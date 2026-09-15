/**
 * Application shell and screen routing.
 *
 * Holds all mutable state and passes it down. There is no business logic here: scoring lives
 * in `core/`, and I/O lives in `adapters/`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiError, fileToDataUrl, readLabelPhoto } from '../adapters/aiClient.js';
import {
  FIXTURE_BARCODES,
  ProductNotFoundError,
  isValidBarcode,
  lookup,
} from '../adapters/offClient.js';
import {
  DEFAULT_SETTINGS,
  clearAll,
  clearHistory,
  loadHistory,
  loadProfile,
  loadSettings,
  pushHistory,
  saveProfile,
  saveSettings,
  type HistoryEntry,
  type Settings,
} from '../adapters/storage.js';
import { REGISTER_SIZE } from '../core/additives.js';
import { evaluate } from '../core/score.js';
import type { Product, Profile } from '../core/types.js';
import { Compare } from './Compare.js';
import { Scanner } from './Scanner.js';
import { VerdictView } from './Verdict.js';

type Screen = 'scan' | 'history' | 'profile' | 'settings';

interface Loaded {
  product: Product;
  offline: boolean;
  fallbackReason?: string;
}

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'scan', label: 'Scan' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'My rules' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [screen, setScreen] = useState<Screen>('scan');
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [barcode, setBarcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<[string, string]>(['', '']);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => saveSettings(settings), [settings]);

  const show = useCallback((product: Product, offline: boolean, fallbackReason?: string) => {
    const next: Loaded = { product, offline };
    if (fallbackReason !== undefined) next.fallbackReason = fallbackReason;
    setLoaded(next);
    setHistory(pushHistory(product));
    setScreen('scan');
  }, []);

  const search = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!isValidBarcode(trimmed)) {
        setError('A barcode is 6 to 14 digits. Check the number and try again.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await lookup(trimmed, { offline: settings.offlineMode });
        show(result.product, result.offline, result.fallbackReason);
      } catch (err) {
        setError(
          err instanceof ProductNotFoundError
            ? `Barcode ${trimmed} is not in Open Food Facts. Photograph the ingredient list instead.`
            : err instanceof Error
              ? err.message
              : 'Something went wrong.',
        );
      } finally {
        setBusy(false);
      }
    },
    [settings.offlineMode, show],
  );

  async function readPhoto(file: File) {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const product = await readLabelPhoto(dataUrl, settings);
      show(product, false);
    } catch (err) {
      setError(err instanceof AiError ? err.message : 'The photo could not be read.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const verdict = useMemo(
    () => (loaded ? evaluate(loaded.product, profile) : null),
    [loaded, profile],
  );

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <h1>Label Lens</h1>
          <span>no backend · no account · no tracking</span>
        </div>
        <nav className="tabs">
          {SCREENS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={screen === item.id}
              onClick={() => setScreen(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      {error && <div className="notice error">{error}</div>}

      {screen === 'scan' && (
        <>
          <div className="card">
            <h2>Scan a product</h2>
            <form
              className="search"
              onSubmit={(event) => {
                event.preventDefault();
                void search(barcode);
              }}
            >
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ''))}
                placeholder="Barcode, e.g. 3017620425035"
                inputMode="numeric"
                aria-label="Barcode"
              />
              <button className="btn primary" type="submit" disabled={busy}>
                {busy && <span className="spinner" />}
                {busy ? 'Looking up…' : 'Look up'}
              </button>
            </form>

            <div className="chips">
              <span className="faint" style={{ alignSelf: 'center', marginRight: 4 }}>
                Try:
              </span>
              {FIXTURE_BARCODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setBarcode(code);
                    void search(code);
                  }}
                >
                  {code}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <Scanner
                onScan={(code) => {
                  setBarcode(code);
                  void search(code);
                }}
              />
            </div>

            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readPhoto(file);
                }}
              />
              <button
                type="button"
                className="btn ghost"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                No barcode? Read the label from a photo
              </button>
              <div className="faint" style={{ marginTop: 6 }}>
                {settings.apiKey
                  ? 'Uses your own API key, from this browser only.'
                  : 'Needs your own API key — add one in Settings.'}
              </div>
            </div>
          </div>

          {loaded && verdict && (
            <VerdictView
              product={loaded.product}
              verdict={verdict}
              offline={loaded.offline}
              {...(loaded.fallbackReason !== undefined
                ? { fallbackReason: loaded.fallbackReason }
                : {})}
            />
          )}
        </>
      )}

      {screen === 'history' && (
        <>
          <div className="card">
            <h2>Recent scans</h2>
            {history.length === 0 ? (
              <p className="muted">Nothing scanned yet.</p>
            ) : (
              history.map((entry) => {
                const entryVerdict = evaluate(entry.product, profile);
                return (
                  <div className="history-item" key={entry.product.barcode}>
                    <div
                      className={`history-score band-${entryVerdict.band}`}
                      aria-label={`Score ${entryVerdict.score}`}
                    >
                      {entryVerdict.lowData ? '—' : entryVerdict.score}
                    </div>
                    <div className="history-name">
                      <strong>{entry.product.name}</strong>
                      <span className="faint">
                        {entry.product.brand ?? entry.product.barcode}
                        {entryVerdict.flags.length > 0 &&
                          ` · ${entryVerdict.flags.length} of your rules matched`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        setLoaded({ product: entry.product, offline: true });
                        setScreen('scan');
                      }}
                    >
                      Open
                    </button>
                  </div>
                );
              })
            )}
            {history.length > 0 && (
              <button
                type="button"
                className="btn small ghost"
                style={{ marginTop: 12 }}
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
              >
                Clear history
              </button>
            )}
          </div>

          <Compare
            entries={history}
            profile={profile}
            selection={compareSelection}
            onSelect={(side, value) =>
              setCompareSelection((current) => {
                const next: [string, string] = [...current];
                next[side] = value;
                return next;
              })
            }
          />
        </>
      )}

      {screen === 'profile' && (
        <div className="card">
          <h2>My rules</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            These never change the score. They add a flag when a product breaks one, so a rule
            you care about can never be averaged away into a number.
          </p>

          {(
            [
              ['avoidPalmOil', 'Avoid palm oil', 'Flags any product whose ingredients contain it.'],
              ['avoidAddedSugar', 'Avoid added sugar', 'Flags any product with added sugars above zero.'],
              ['veganOnly', 'Vegan only', 'Flags products confirmed to contain animal products.'],
              ['vegetarianOnly', 'Vegetarian only', 'Flags products confirmed not to be vegetarian.'],
              ['lowSalt', 'Low salt', 'Flags salt above the low-salt reference level.'],
            ] as const
          ).map(([key, title, description]) => (
            <label className="toggle" key={key}>
              <input
                type="checkbox"
                checked={profile[key]}
                onChange={(event) => setProfile({ ...profile, [key]: event.target.checked })}
              />
              <span className="toggle-text">
                <strong>{title}</strong>
                <span>{description}</span>
              </span>
            </label>
          ))}

          <div style={{ marginTop: 16 }}>
            <h3>Additives to avoid</h3>
            <input
              className="btn"
              style={{ width: '100%', textAlign: 'left' }}
              value={profile.avoidAdditives.join(', ')}
              placeholder="E621, E951"
              aria-label="Additives to avoid"
              onChange={(event) =>
                setProfile({
                  ...profile,
                  avoidAdditives: event.target.value
                    .split(',')
                    .map((code) => code.trim().toUpperCase())
                    .filter(Boolean),
                })
              }
            />
            <div className="faint" style={{ marginTop: 6 }}>
              Comma-separated E-numbers. {REGISTER_SIZE} additives are described offline.
            </div>
          </div>
        </div>
      )}

      {screen === 'settings' && (
        <div className="card">
          <h2>Settings</h2>

          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.offlineMode}
              onChange={(event) =>
                setSettings({ ...settings, offlineMode: event.target.checked })
              }
            />
            <span className="toggle-text">
              <strong>Offline mode</strong>
              <span>
                Use only the bundled product set. Nothing leaves this device, and the app works
                with no network at all.
              </span>
            </span>
          </label>

          <div style={{ marginTop: 16 }}>
            <h3>Reading labels from a photo</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
              This is a static site with no backend, so the key is yours and is stored in this
              browser only. It is sent to the model provider you pick and nowhere else. Use a key
              with a spending limit, and remove it when you are done.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="btn"
                value={settings.provider}
                aria-label="Model provider"
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    provider: event.target.value === 'openai' ? 'openai' : 'anthropic',
                  })
                }
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
              <input
                className="btn"
                style={{ flex: '1 1 220px', textAlign: 'left' }}
                type="password"
                value={settings.apiKey}
                placeholder="API key"
                aria-label="API key"
                onChange={(event) => setSettings({ ...settings, apiKey: event.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                clearAll();
                setProfile(loadProfile());
                setSettings(DEFAULT_SETTINGS);
                setHistory([]);
                setLoaded(null);
              }}
            >
              Erase everything stored on this device
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        Product data from{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
          Open Food Facts
        </a>{' '}
        (ODbL). Reference thresholds from the UK FSA front-of-pack guidance.
        <br />
        Informational only — not medical or dietary advice.
      </footer>
    </div>
  );
}

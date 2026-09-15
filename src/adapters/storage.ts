/**
 * `localStorage` wrapper.
 *
 * Every access is guarded: `localStorage` throws in private browsing on some browsers, is
 * absent in a server-side render, and throws `QuotaExceededError` when full. None of those are
 * reasons for the app to break, so every failure degrades to an in-memory fallback.
 */

import { parseProfile } from '../core/profile.js';
import type { Product, Profile } from '../core/types.js';

const PROFILE_KEY = 'label-lens:profile:v1';
const HISTORY_KEY = 'label-lens:history:v1';
const SETTINGS_KEY = 'label-lens:settings:v1';

export const HISTORY_LIMIT = 50;

/** Used when `localStorage` is unavailable, so the app still works for the session. */
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
}

function readJson<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProfile(): Profile {
  return parseProfile(readJson<unknown>(PROFILE_KEY, null));
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, JSON.stringify(profile));
}

/** A product plus when it was scanned. The timestamp lives here, never in `core`. */
export interface HistoryEntry {
  scannedAt: number;
  product: Product;
}

export function loadHistory(): HistoryEntry[] {
  const entries = readJson<HistoryEntry[]>(HISTORY_KEY, []);
  return Array.isArray(entries) ? entries.filter((e) => e?.product?.barcode) : [];
}

/**
 * Adds a scan to the front of the history, replacing any earlier scan of the same barcode so
 * the list stays a set of distinct products rather than a log of repeats.
 */
export function pushHistory(product: Product, now: number = Date.now()): HistoryEntry[] {
  const existing = loadHistory().filter((e) => e.product.barcode !== product.barcode);
  const next = [{ scannedAt: now, product }, ...existing].slice(0, HISTORY_LIMIT);
  write(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  remove(HISTORY_KEY);
}

export interface Settings {
  /** Forces fixture mode, for demonstrating the app with no network. */
  offlineMode: boolean;
  /** The user's own API key. Never transmitted anywhere except the model provider. */
  apiKey: string;
  provider: 'anthropic' | 'openai';
}

export const DEFAULT_SETTINGS: Settings = {
  offlineMode: false,
  apiKey: '',
  provider: 'anthropic',
};

export function loadSettings(): Settings {
  const raw = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    offlineMode: typeof raw.offlineMode === 'boolean' ? raw.offlineMode : false,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    provider: raw.provider === 'openai' ? 'openai' : 'anthropic',
  };
}

export function saveSettings(settings: Settings): void {
  write(SETTINGS_KEY, JSON.stringify(settings));
}

/** Wipes everything the app has stored. Offered in Settings as a one-click reset. */
export function clearAll(): void {
  for (const key of [PROFILE_KEY, HISTORY_KEY, SETTINGS_KEY]) remove(key);
}

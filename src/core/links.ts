/**
 * Outbound links.
 *
 * Two links can sit under a product, and they are very different in kind.
 *
 * **The Open Food Facts page** is derived from the barcode, so it always exists. It is where
 * the data came from, it carries the photos and the full record, and linking to it is how a
 * person checks that the app is not making things up. It is also the honest attribution for
 * ODbL data.
 *
 * **The producer's own page** comes from the crowd-sourced `link` field, and most products
 * simply do not have one — of the four hazelnut spreads the app suggests instead of Nutella,
 * none do. So it is shown when present and omitted when absent. It is never *constructed*: a
 * URL guessed from a brand name ("damiano.com") would send people to a domain nobody verified,
 * which at best is wrong and at worst is squatted. An absent link is a smaller failure than a
 * confidently wrong one.
 *
 * And because that field is filled in by strangers, the value is treated as untrusted input:
 * anything that is not a plain `http`/`https` URL is dropped rather than rendered.
 */

/** The Open Food Facts page for a barcode. Always available, always the source of the data. */
export function openFoodFactsUrl(barcode: string): string | undefined {
  const clean = barcode.trim();
  if (!/^\d{6,14}$/.test(clean)) return undefined;
  return `https://world.openfoodfacts.org/product/${clean}`;
}

/**
 * Validates a producer URL from the database before it is ever put in an `href`.
 *
 * The field is crowd-sourced, so `javascript:`, `data:` and other schemes have to be refused —
 * a `javascript:` href is a script-injection vector, and this is exactly the boundary where
 * untrusted data becomes a link a person will click.
 *
 * @returns the normalized absolute URL, or `undefined` when it cannot be trusted
 */
export function safeProducerUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  let parsed: URL;
  try {
    // A bare domain is a common entry; treat it as https rather than discarding it.
    parsed = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  // A hostname with no dot is not a public site — `localhost`, or a typo.
  if (!parsed.hostname.includes('.')) return undefined;

  return parsed.toString();
}

/** The hostname, for showing what a link actually points at before it is clicked. */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

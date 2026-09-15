import { describe, expect, it } from 'vitest';
import { linkHost, openFoodFactsUrl, safeProducerUrl } from './links.js';

describe('openFoodFactsUrl', () => {
  it('builds the product page from a barcode', () => {
    expect(openFoodFactsUrl('3017620425035')).toBe(
      'https://world.openfoodfacts.org/product/3017620425035',
    );
  });

  it('accepts the short barcodes real products carry', () => {
    expect(openFoodFactsUrl('20724696')).toContain('/product/20724696');
  });

  it('trims surrounding whitespace', () => {
    expect(openFoodFactsUrl('  20724696  ')).toContain('/product/20724696');
  });

  it('refuses anything that is not a barcode', () => {
    // A photo-sourced product has an id like `photo-1758000000000`; it has no page.
    expect(openFoodFactsUrl('photo-1758000000000')).toBeUndefined();
    expect(openFoodFactsUrl('')).toBeUndefined();
    expect(openFoodFactsUrl('12')).toBeUndefined();
    expect(openFoodFactsUrl('../../etc/passwd')).toBeUndefined();
  });
});

describe('safeProducerUrl', () => {
  it('passes a normal https URL through', () => {
    expect(safeProducerUrl('https://www.nutella.com/fr/fr/produits/nutella')).toBe(
      'https://www.nutella.com/fr/fr/produits/nutella',
    );
  });

  it('accepts plain http, which plenty of older entries still use', () => {
    expect(safeProducerUrl('http://example.com/product')).toBe('http://example.com/product');
  });

  it('assumes https for a bare domain', () => {
    expect(safeProducerUrl('coca-colacompany.com')).toBe('https://coca-colacompany.com/');
  });

  it('refuses a javascript: URL', () => {
    // The field is crowd-sourced. This is the boundary where untrusted data becomes an href.
    expect(safeProducerUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeProducerUrl('  JavaScript:alert(1)  ')).toBeUndefined();
  });

  it('refuses data: and file: URLs', () => {
    expect(safeProducerUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeProducerUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('refuses a hostname with no dot', () => {
    expect(safeProducerUrl('http://localhost:8080')).toBeUndefined();
    expect(safeProducerUrl('notadomain')).toBeUndefined();
  });

  it('refuses empty and missing values', () => {
    expect(safeProducerUrl(undefined)).toBeUndefined();
    expect(safeProducerUrl('')).toBeUndefined();
    expect(safeProducerUrl('   ')).toBeUndefined();
  });

  it('refuses unparseable junk', () => {
    expect(safeProducerUrl('http://')).toBeUndefined();
  });
});

describe('linkHost', () => {
  it('shows what a link points at, without the www', () => {
    expect(linkHost('https://www.nutella.com/fr/fr/produits/nutella')).toBe('nutella.com');
    expect(linkHost('https://coca-colacompany.com/')).toBe('coca-colacompany.com');
  });

  it('falls back to the raw value rather than throwing', () => {
    expect(linkHost('not a url')).toBe('not a url');
  });
});

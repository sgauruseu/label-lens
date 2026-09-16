/**
 * Which of the bundled sample barcodes the Scan screen offers, and which of them may be removed.
 *
 * The sample chips are a convenience, not data — a user who never scans a drink should be able
 * to clear that chip away. Two of them are load-bearing for the demo, so they are protected:
 * losing them mid-presentation is not a recoverable mistake with an audience watching.
 *
 * Pure: this decides membership of a list. Reading and writing the list is the adapter's job.
 */

/** Coca-Cola and Snickers. Both appear in the demo script; neither can be removed. */
export const PROTECTED_SAMPLES: readonly string[] = ['5449000000996', '5000159461122'];

/** True when the user is allowed to remove this sample from the Scan screen. */
export function canHideSample(barcode: string): boolean {
  return !PROTECTED_SAMPLES.includes(barcode);
}

/**
 * The samples still on offer, in their original order.
 *
 * A protected sample is returned even if it somehow appears in `hidden` — storage is editable
 * by hand, and the protection has to hold whatever is in it.
 */
export function visibleSamples(all: readonly string[], hidden: readonly string[]): string[] {
  return all.filter((code) => !hidden.includes(code) || !canHideSample(code));
}

/** `hidden` with `barcode` added, ignoring protected samples and repeats. */
export function hideSample(hidden: readonly string[], barcode: string): string[] {
  if (!canHideSample(barcode) || hidden.includes(barcode)) return [...hidden];
  return [...hidden, barcode];
}

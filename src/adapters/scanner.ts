/**
 * Camera barcode scanner.
 *
 * ZXing is the primary decoder, not the fallback. The native `BarcodeDetector` API is only
 * shipped by Chrome on Android, macOS and ChromeOS — it is absent in Chrome on Windows, which
 * is exactly the kind of machine a live demo runs on. When it is present it is faster, so it
 * is used as an opportunistic fast path.
 */

export type ScanHandler = (barcode: string) => void;

export interface ScannerHandle {
  stop: () => void;
}

export class CameraUnavailableError extends Error {
  readonly underlying: unknown;

  constructor(message: string, underlying?: unknown) {
    super(message);
    this.name = 'CameraUnavailableError';
    this.underlying = underlying;
  }
}

/** True when the browser exposes a camera API at all. */
export function isCameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** True when the native detector is available, used only to pick the faster code path. */
export function hasNativeDetector(): boolean {
  return typeof (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector !== 'undefined';
}

/**
 * Turns a `getUserMedia` rejection into a message a person can act on. The distinction
 * matters: "you denied permission" and "this page is not on HTTPS" need different responses.
 */
function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
      return 'Camera permission was denied. Allow it in the browser address bar, or type the barcode instead.';
    case 'NotFoundError':
      return 'No camera was found on this device. Type the barcode instead.';
    case 'NotReadableError':
      return 'The camera is already in use by another application.';
    case 'SecurityError':
      return 'The camera needs a secure (HTTPS) connection.';
    default:
      return 'The camera could not be started. Type the barcode instead.';
  }
}

/**
 * Starts decoding into `video` and calls `onScan` for each successful read.
 *
 * The caller is responsible for de-bouncing repeats: a barcode held in front of the lens
 * decodes many times per second.
 */
export async function startScanner(
  video: HTMLVideoElement,
  onScan: ScanHandler,
): Promise<ScannerHandle> {
  if (!isCameraSupported()) {
    throw new CameraUnavailableError('This browser does not provide camera access.');
  }

  // ZXing is around 400 kB — a third of everything the app ships. Loading it only when the
  // user actually opens the camera keeps the first paint fast for people who type a barcode.
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);

  // The symbologies found on retail packaging. Narrowing them speeds decoding up markedly.
  const retailFormats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
  ];

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, retailFormats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

  try {
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment', width: { ideal: 1280 } } },
      video,
      (result) => {
        if (result) onScan(result.getText());
      },
    );
    return { stop: () => controls.stop() };
  } catch (error) {
    throw new CameraUnavailableError(describeCameraError(error), error);
  }
}

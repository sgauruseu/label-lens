/**
 * Camera panel.
 *
 * Deliberately not the only way in. Camera permission is the single most likely thing to fail
 * in front of an audience, so this component always renders alongside manual entry rather than
 * replacing it, and every failure produces an instruction rather than a dead end.
 */

import { useEffect, useRef, useState } from 'react';
import {
  CameraUnavailableError,
  hasNativeDetector,
  isCameraSupported,
  startScanner,
  type ScannerHandle,
} from '../adapters/scanner.js';

/** A barcode in front of the lens decodes many times a second; ignore repeats for this long. */
const REPEAT_SUPPRESSION_MS = 2500;

export function Scanner({ onScan }: { onScan: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<ScannerHandle | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => () => handleRef.current?.stop(), []);

  async function start() {
    setError(null);
    setStarting(true);
    try {
      const video = videoRef.current;
      if (!video) return;
      handleRef.current = await startScanner(video, (code) => {
        const now = Date.now();
        const last = lastRef.current;
        if (last.code === code && now - last.at < REPEAT_SUPPRESSION_MS) return;
        lastRef.current = { code, at: now };
        onScan(code);
      });
      setActive(true);
    } catch (err) {
      setError(
        err instanceof CameraUnavailableError
          ? err.message
          : 'The camera could not be started. Type the barcode instead.',
      );
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    handleRef.current?.stop();
    handleRef.current = null;
    setActive(false);
  }

  if (!isCameraSupported()) {
    return (
      <div className="faint">
        This browser does not offer camera access. Use the barcode field above.
      </div>
    );
  }

  return (
    <>
      {error && <div className="notice error">{error}</div>}
      <div className="viewport" hidden={!active}>
        <video ref={videoRef} muted playsInline />
        <div className="reticle" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: active ? 12 : 0, flexWrap: 'wrap' }}>
        {active ? (
          <button type="button" className="btn" onClick={stop}>
            Stop camera
          </button>
        ) : (
          <button type="button" className="btn" onClick={start} disabled={starting}>
            {starting && <span className="spinner" />}
            {starting ? 'Starting camera…' : 'Scan with camera'}
          </button>
        )}
        <span className="faint" style={{ alignSelf: 'center' }}>
          {hasNativeDetector()
            ? 'Native barcode detection available.'
            : 'Decoding with ZXing — no native detector on this browser.'}
        </span>
      </div>
    </>
  );
}

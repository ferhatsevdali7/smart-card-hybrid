import React, { useEffect, useRef, useState } from 'react';
import { Camera, Keyboard, X, Loader2 } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Okunan ham QR içeriği veya elle yazılan kod */
  onResult: (raw: string) => void;
  title?: string;
  isDark?: boolean;
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Kamerayla QR okutma penceresi.
 * - Destekleyen tarayıcılarda yerleşik BarcodeDetector kullanılır (hızlı).
 * - Diğerlerinde (iPhone Safari gibi) jsQR ile kare kare çözülür.
 * - Kamera izni yoksa kod elle yazılabilir.
 */
export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onResult, title, isDark = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const finish = (raw: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    stop();
    try { navigator.vibrate?.(60); } catch { /* yok say */ }
    onResult(raw);
  };

  useEffect(() => {
    if (!isOpen || mode !== 'camera') {
      stop();
      return;
    }
    doneRef.current = false;
    let cancelled = false;

    const start = async () => {
      setCameraError(null);
      setStarting(true);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        let detector: Detector | null = null;
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (BD) {
          try { detector = new BD({ formats: ['qr_code'] }); } catch { detector = null; }
        }
        const jsQR = detector ? null : (await import('jsqr')).default;

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let busy = false;

        const tick = async () => {
          if (cancelled || doneRef.current) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              if (detector) {
                const codes = await detector.detect(video);
                if (codes[0]?.rawValue) { finish(codes[0].rawValue); return; }
              } else if (jsQR) {
                const w = Math.min(640, video.videoWidth);
                const h = Math.round((video.videoHeight / video.videoWidth) * w) || w;
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const res = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
                if (res?.data) { finish(res.data); return; }
              }
            } catch { /* bir sonraki karede tekrar dene */ }
            busy = false;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setCameraError(
          name === 'NotAllowedError'
            ? 'Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya kodu elle yazın.'
            : 'Kamera açılamadı. Kodu elle yazabilirsiniz.',
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) {
      setManual('');
      setMode('camera');
      setCameraError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const panel = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const input = isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { stop(); onClose(); }} />
      <div className={`relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-5 space-y-4 ${panel}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{title || 'QR Kodu Okutun'}</h3>
          <button onClick={() => { stop(); onClose(); }} className="p-1.5 rounded-full hover:bg-slate-500/20" aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <button
            onClick={() => setMode('camera')}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${mode === 'camera' ? 'bg-amber-500 text-slate-950' : 'opacity-70'}`}
          >
            <Camera className="w-3.5 h-3.5" /> Kamera
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${mode === 'manual' ? 'bg-amber-500 text-slate-950' : 'opacity-70'}`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Kodu Yaz
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="space-y-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-[18%] border-2 border-amber-400/90 rounded-2xl pointer-events-none" />
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Kamera açılıyor...
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-xs text-white/90">
                  {cameraError}
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-[11px] text-center opacity-60">Etiketteki QR kodu çerçevenin içine getirin.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (manual.trim()) finish(manual.trim()); }}
            className="space-y-3"
          >
            <p className="text-[11px] opacity-70">
              Etiketin QR kodunun altında yazan 12 karakterlik kodu girin (örn: K7M2-QX9P-4RTA).
            </p>
            <input
              autoFocus
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              maxLength={20}
              placeholder="XXXX-XXXX-XXXX"
              className={`w-full px-4 py-3 rounded-xl border font-mono text-center tracking-widest text-sm outline-none focus:border-amber-500 ${input}`}
            />
            <button type="submit" className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">
              Devam Et
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

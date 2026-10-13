// Sayfanın içinde çalışan kamera ile QR okuyucu (açılır pencere yok).
// Destekleyen tarayıcılarda yerleşik BarcodeDetector, diğerlerinde (iPhone Safari gibi) jsQR kullanılır.

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useL } from './ui';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

export const QrScanner: React.FC<{ onResult: (raw: string) => void; height?: number; paused?: boolean }> = ({ onResult, height = 260, paused }) => {
  const L = useL();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;
  const [state, setState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (paused || run === 0) return;
    let cancelled = false;
    let done = false;
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    (async () => {
      setState('starting'); setError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setState('on');
        let detector: Detector | null = null;
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (BD) { try { detector = new BD({ formats: ['qr_code'] }); } catch { detector = null; } }
        const jsQR = detector ? null : (await import('jsqr')).default;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        let busy = false;
        const tick = async () => {
          if (cancelled || done) return;
          if (!busy && video.readyState >= 2) {
            busy = true;
            try {
              let value: string | null = null;
              if (detector) { const codes = await detector.detect(video); value = codes[0]?.rawValue || null; }
              else if (jsQR) {
                const w = Math.min(640, video.videoWidth); const h = Math.round((video.videoHeight / video.videoWidth) * w) || w;
                canvas.width = w; canvas.height = h; ctx.drawImage(video, 0, 0, w, h);
                value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
              }
              if (value) { done = true; stop(); setState('idle'); try { navigator.vibrate?.(60); } catch { /* yok */ } cbRef.current(value); return; }
            } catch { /* bir sonraki kare */ }
            busy = false;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string })?.name;
        setState('error');
        setError(name === 'NotAllowedError'
          ? L('Kamera izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da etiketin altındaki kodu yazabilirsiniz.', 'Camera permission was denied. You can type the code instead.')
          : L('Kamera açılamadı. Etiketin altındaki kodu yazabilirsiniz.', 'Camera could not be opened. You can type the code instead.'));
      }
    })();
    return () => { cancelled = true; stop(); };
  }, [run, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const corner = (pos: React.CSSProperties) => <span className="absolute w-7 h-7" style={{ ...pos, borderColor: '#fff', borderStyle: 'solid' }} />;
  return (
    <div className="relative w-full overflow-hidden rounded-[16px]" style={{ height, background: '#0B0D10' }}>
      <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ opacity: state === 'on' ? 1 : 0 }} />
      <canvas ref={canvasRef} className="hidden" />
      {state === 'on' && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[18px]" style={{ width: Math.min(190, height - 70), height: Math.min(190, height - 70), boxShadow: '0 0 0 2000px rgba(0,0,0,.35)' }}>
          {corner({ left: 0, top: 0, borderWidth: '3px 0 0 3px', borderRadius: '16px 0 0 0' })}
          {corner({ right: 0, top: 0, borderWidth: '3px 3px 0 0', borderRadius: '0 16px 0 0' })}
          {corner({ left: 0, bottom: 0, borderWidth: '0 0 3px 3px', borderRadius: '0 0 0 16px' })}
          {corner({ right: 0, bottom: 0, borderWidth: '0 3px 3px 0', borderRadius: '0 0 16px 0' })}
        </span>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ pointerEvents: state === 'on' ? 'none' : 'auto' }}>
        {state === 'idle' && (
          <button type="button" onClick={() => setRun((r) => r + 1)} className="inline-flex items-center gap-2 h-11 px-5 rounded-[12px] text-[15px] font-semibold text-white" style={{ background: 'var(--c-p)' }}>
            <Camera className="w-[18px] h-[18px]" />{L('Kamerayı aç', 'Open camera')}
          </button>
        )}
        {state === 'starting' && <span className="inline-flex items-center gap-2 text-[13.5px]" style={{ color: '#E5E7EB' }}><Loader2 className="w-4 h-4 animate-spin" />{L('Kamera açılıyor…', 'Opening camera…')}</span>}
        {state === 'error' && (
          <>
            <span className="text-[13.5px] leading-relaxed" style={{ color: '#E5E7EB' }}>{error}</span>
            <button type="button" onClick={() => setRun((r) => r + 1)} className="text-[13.5px] font-semibold underline" style={{ color: '#fff' }}>{L('Yeniden dene', 'Try again')}</button>
          </>
        )}
      </div>
      {state === 'on' && <span className="absolute bottom-[14px] left-0 right-0 text-center text-[13px]" style={{ color: '#E5E7EB' }}>{L('QR’ı çerçevenin içine getirin', 'Fit the QR inside the frame')}</span>}
    </div>
  );
};

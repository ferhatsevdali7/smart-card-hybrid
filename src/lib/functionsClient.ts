// Cloud Functions çağrıları (bölge: europe-west1)

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseApp';
import { ClaimResult, NoticeType, ScanResponse } from '../types/vehicle';

const functions = getFunctions(app, 'europe-west1');

function call<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req): Promise<Res> => (await fn(data)).data;
}

export const scanTagFn = call<{ code: string }, ScanResponse>('scanTag');
export const sendNoticeFn = call<{ code: string; type: NoticeType; note?: string }, { ok: boolean }>('sendNotice');
export const claimTagFn = call<{ code: string; vehicleId: string }, { result: ClaimResult; serial?: string | null }>('claimTag');
export const unlinkTagFn = call<{ vehicleId: string }, { result: 'OK' | 'NO_TAG' }>('unlinkTag');
export const reportTagLostFn = call<{ code: string }, { result: 'OK' }>('reportTagLost');

export const adminCreateBatchFn = call<
  { productType: 'OQ' | 'MQ' | 'KQ'; count: number; notes?: string },
  { batchId: string; count: number }
>('adminCreateBatch');

export type AdminTagAction = 'disable' | 'enable' | 'expire' | 'reset';
export const adminSetTagStatusFn = call<
  { code: string; action: AdminTagAction; note?: string },
  { result: 'OK'; status: string }
>('adminSetTagStatus');

/** Firebase hata nesnesinden kullanıcıya gösterilecek mesajı çıkarır. */
export function functionErrorMessage(err: unknown, fallback = 'Bir hata oluştu. Lütfen tekrar deneyin.'): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === 'functions/unavailable' || e?.code === 'functions/internal') {
    return navigator.onLine ? fallback : 'İnternet bağlantısı yok.';
  }
  if (e?.code?.startsWith('functions/') && e.message) return e.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// QR kodu ayrıştırma (istemci tarafı ön kontrol)
// ---------------------------------------------------------------------------

const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/;

/** Bu sistemin ürettiği QR kodlarının açıldığı alan adları */
const OUR_HOSTS = ['smart-card-hybrid.web.app', 'smart-card-hybrid.firebaseapp.com', 'localhost', '127.0.0.1'];

export function isOurHost(host: string): boolean {
  return OUR_HOSTS.includes(host) || host === window.location.hostname;
}

/**
 * Okutulan QR içeriğinden etiket kodunu çıkarır.
 * - Bizim alan adımızdaki /t/KOD bağlantısı -> KOD
 * - Elle yazılmış 12 karakterlik kod (tire/boşluk olabilir) -> KOD
 * - Diğer her şey -> null (bizim QR'ımız değil)
 */
export function extractTagCode(raw: string): string | null {
  const text = (raw || '').trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (!isOurHost(url.hostname)) return null;
      const m = url.pathname.match(/^\/t\/([A-Za-z0-9-]+)\/?$/);
      if (!m) return null;
      const code = m[1].toUpperCase().replace(/-/g, '');
      return CODE_RE.test(code) ? code : null;
    } catch {
      return null;
    }
  }
  const code = text.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(code) ? code : null;
}

/** QR'a basılacak bağlantı */
export function tagUrl(code: string, origin = 'https://smart-card-hybrid.web.app'): string {
  return `${origin}/t/${code}`;
}

/** Ekranda okunaklı gösterim: K7M2-QX9P-4RTA */
export function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

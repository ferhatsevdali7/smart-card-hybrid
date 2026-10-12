// Müşterinin cihaz bilgisini (ana ekrana eklendi mi, bildirim izni var mı) sunucuya bildirir ve
// yönetici panelindeki özetinin güncellenmesini ister. Sunucu özeti kendi kayıtlarından kurar;
// buradan yalnızca bu cihaza ait bilgiler gider (telefon, plaka vb. gönderilmez).

import { syncMyAccountFn } from './functionsClient';
import { pushRegisteredHere } from './pushService';

const DEVICE_KEY = 'hf_device_id';
const MIN_GAP_MS = 10 * 60 * 1000;

let memoryId: string | null = null;
let lastSyncAt = 0;
let inFlight: Promise<void> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Bu tarayıcıya özgü rastgele kimlik (kişisel bilgi içermez). */
export function deviceId(): string {
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && /^[a-z0-9]{16,40}$/.test(saved)) return saved;
    const id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    memoryId = memoryId || randomId();
    return memoryId;
  }
}

export function isStandaloneDisplay(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

/** "iPhone · Safari", "Android · Chrome", "Windows · Edge" gibi kısa cihaz adı */
export function describeDevice(ua = navigator.userAgent, touch = navigator.maxTouchPoints || 0): { platform: 'ios' | 'android' | 'desktop' | 'web'; label: string } {
  const isIpad = /iPad/.test(ua) || (ua.includes('Macintosh') && touch > 1);
  const isIphone = /iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  let os = 'Tarayıcı';
  let platform: 'ios' | 'android' | 'desktop' | 'web' = 'web';
  if (isIphone) { os = 'iPhone'; platform = 'ios'; }
  else if (isIpad) { os = 'iPad'; platform = 'ios'; }
  else if (isAndroid) { os = /Samsung|SM-/.test(ua) ? 'Samsung' : 'Android'; platform = 'android'; }
  else if (/Windows/.test(ua)) { os = 'Windows'; platform = 'desktop'; }
  else if (/Macintosh|Mac OS X/.test(ua)) { os = 'Mac'; platform = 'desktop'; }
  else if (/Linux/.test(ua)) { os = 'Linux'; platform = 'desktop'; }
  let browser = '';
  if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return { platform, label: browser ? `${os} · ${browser}` : os };
}

/** Bu cihaz bildirim alıyor mu: izin verilmiş ve jeton bu hesaba kayıtlı. */
function pushGranted(): boolean {
  try {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && pushRegisteredHere();
  } catch {
    return false;
  }
}

/**
 * Sunucuya bu cihazın durumunu bildirir. Sık çağrılsa bile 10 dakikada bir gider;
 * force: true (ör. araç kaydedildi, bildirim açıldı) beklemeden gönderir.
 * Hata olursa sessizce geçer (müşterinin işini etkilemez).
 */
export async function syncAccountNow(force = false): Promise<void> {
  if (!force && Date.now() - lastSyncAt < MIN_GAP_MS) return;
  if (inFlight) return inFlight;
  const { platform, label } = describeDevice();
  inFlight = syncMyAccountFn({
    device: { id: deviceId(), platform, label, standalone: isStandaloneDisplay(), push: pushGranted() },
  })
    .then(() => { lastSyncAt = Date.now(); })
    .catch((e) => { console.warn('[account-sync]', e?.code || e); })
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** Arka arkaya birkaç değişiklikte tek istek gitsin diye kısa bir bekleme ile gönderir. */
export function requestAccountSync(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; void syncAccountNow(true); }, 1500);
}

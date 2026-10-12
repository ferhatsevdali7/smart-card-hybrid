// Panelde oturum açan yöneticinin yetkileri (Ekip ve Yetkiler > pozisyon).
// Bu bilgi yalnızca ekranda menü ve düğmeleri göstermek/gizlemek içindir; asıl denetim her istekte
// sunucuda (Cloud Functions) ve veritabanı kurallarında yapılır.

import { useSyncExternalStore } from 'react';

export interface Access {
  loaded: boolean;
  superAdmin: boolean;
  perms: ReadonlySet<string>;
  positionName: string | null;
}

const EMPTY: Access = { loaded: false, superAdmin: false, perms: new Set(), positionName: null };
let state: Access = EMPTY;
const listeners = new Set<() => void>();

export function setAccess(next: { superAdmin: boolean; perms: string[]; positionName?: string | null }): void {
  state = { loaded: true, superAdmin: next.superAdmin, perms: new Set(next.perms), positionName: next.positionName ?? null };
  listeners.forEach((l) => l());
}

export function clearAccess(): void {
  state = EMPTY;
  listeners.forEach((l) => l());
}

export function getAccess(): Access {
  return state;
}

export function useAccess(): Access {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

/** Yetki var mı (süper yönetici her şeyi yapar) */
export function has(perm: string): boolean {
  return state.superAdmin || state.perms.has(perm);
}

export function hasAny(perms: string[]): boolean {
  return state.superAdmin || perms.some((p) => state.perms.has(p));
}

/** Menüdeki her sayfanın görme yetkisi ('super': yalnızca süper yönetici) */
export const SECTION_PERM: Record<string, string> = {
  overview: 'view.overview',
  compare: 'view.overview',
  depot: 'view.depot',
  batch: 'view.depot',
  stand: 'view.stand',
  bank: 'view.bank',
  disabled: 'view.disabled',
  trash: 'view.trash',
  vehicles: 'view.vehicles',
  users: 'view.users',
  audit: 'view.audit',
  team: 'super',
};

export function canSee(section: string): boolean {
  if (section === 'settings') return true;
  const p = SECTION_PERM[section];
  if (!p) return true;
  if (p === 'super') return state.superAdmin;
  return has(p);
}

/** QR kayıtlarını gören sayfalardan biri (parti sayaçları bunlarla birlikte okunur) */
export function seesTags(): boolean {
  return hasAny(['view.depot', 'view.stand', 'view.bank', 'view.disabled', 'view.trash']);
}

// ------------------------------------------------------------------ Ekip ve Yetkiler tablosu

export interface PermItem { key: string; tr: string; en: string; critical?: boolean; note?: { tr: string; en: string } }
export interface PermGroup { page: string; tr: string; en: string; view: string; actions: PermItem[] }

/** Sunucudaki permissions.ts ile aynı liste ve sıra */
export const PERM_GROUPS: PermGroup[] = [
  { page: 'overview', tr: 'Genel Bakış', en: 'Overview', view: 'view.overview', actions: [
    { key: 'act.campaigns', tr: 'Kampanya işaretleyebilir', en: 'Can mark campaigns' },
  ] },
  { page: 'depot', tr: 'QR Deposu', en: 'QR Stock', view: 'view.depot', actions: [
    { key: 'act.batch_create', tr: 'Yeni parti üretebilir', en: 'Can create batches' },
    { key: 'act.release', tr: 'Satışa çıkarabilir', en: 'Can release for sale' },
    { key: 'act.unrelease', tr: 'Depoya geri alabilir', en: 'Can return to stock' },
    { key: 'act.print', tr: 'Basıldı işaretleyebilir / kaldırabilir', en: 'Can mark printed' },
    { key: 'act.zip', tr: 'ZIP indirebilir', en: 'Can download ZIP' },
    { key: 'act.trash', tr: "Partiyi ya da QR'ı çöpe atabilir", en: 'Can move to trash' },
  ] },
  { page: 'stand', tr: 'Satış Standı', en: 'On Sale', view: 'view.stand', actions: [
    { key: 'act.unrelease', tr: 'Depoya geri alabilir', en: 'Can return to stock', note: { tr: "QR Deposu'ndaki yetkiyle aynı", en: 'Same as in QR Stock' } },
  ] },
  { page: 'bank', tr: 'QR Bankası', en: 'QR Bank', view: 'view.bank', actions: [
    { key: 'act.disable', tr: 'QR kapatabilir', en: 'Can disable QR' },
    { key: 'act.expire', tr: 'Süresini bitirebilir', en: 'Can expire QR' },
  ] },
  { page: 'disabled', tr: 'Devre Dışı', en: 'Disabled', view: 'view.disabled', actions: [
    { key: 'act.enable', tr: 'Yeniden açabilir', en: 'Can re-enable' },
    { key: 'act.reset', tr: 'Eşleşmeyi sıfırlayıp depoya döndürebilir', en: 'Can reset to stock', note: { tr: 'QR Bankası\'ndaki "sıfırla" da bu yetkiyle', en: 'Also covers reset in QR Bank' } },
  ] },
  { page: 'trash', tr: 'Çöp Kutusu', en: 'Trash', view: 'view.trash', actions: [
    { key: 'act.restore', tr: 'Geri yükleyebilir', en: 'Can restore' },
    { key: 'act.purge', tr: 'Kalıcı olarak silebilir', en: 'Can delete permanently', critical: true },
  ] },
  { page: 'vehicles', tr: 'Bağlı Araçlar', en: 'Linked Vehicles', view: 'view.vehicles', actions: [] },
  { page: 'users', tr: 'Kullanıcılar', en: 'Users', view: 'view.users', actions: [
    { key: 'act.user_delete', tr: 'Müşteri hesabını silebilir', en: 'Can delete customer accounts', critical: true },
  ] },
  { page: 'audit', tr: 'Denetim Kayıtları', en: 'Audit Logs', view: 'view.audit', actions: [] },
];

/** İşlemin hangi sayfa(lar)ın görme yetkisine bağlı olduğu */
export const ACTION_PAGES: Record<string, string[]> = {
  'act.campaigns': ['view.overview'],
  'act.batch_create': ['view.depot'],
  'act.release': ['view.depot'],
  'act.unrelease': ['view.depot', 'view.stand'],
  'act.print': ['view.depot'],
  'act.zip': ['view.depot'],
  'act.trash': ['view.depot'],
  'act.disable': ['view.bank'],
  'act.expire': ['view.bank'],
  'act.enable': ['view.disabled'],
  'act.reset': ['view.disabled', 'view.bank'],
  'act.restore': ['view.trash'],
  'act.purge': ['view.trash'],
  'act.user_delete': ['view.users'],
};

export const CRITICAL_PERMS = new Set(['act.purge', 'act.user_delete']);

/** Tablodaki seçim: görme kaldırılınca o sayfaya bağlı (başka görünen sayfası olmayan) işlemler de kalkar */
export function togglePerm(current: string[], key: string, on: boolean, cardView?: string): string[] {
  const set = new Set(current);
  if (on) {
    set.add(key);
    const pages = ACTION_PAGES[key];
    if (pages && !pages.some((p) => set.has(p))) set.add(cardView && pages.includes(cardView) ? cardView : pages[0]);
  } else {
    set.delete(key);
  }
  for (const [a, pages] of Object.entries(ACTION_PAGES)) {
    if (set.has(a) && !pages.some((p) => set.has(p))) set.delete(a);
  }
  return [...set];
}

export function permSummary(perms: string[]): { pages: number; actions: number; critical: number } {
  const set = new Set(perms);
  return {
    pages: PERM_GROUPS.filter((g) => set.has(g.view)).length,
    actions: Object.keys(ACTION_PAGES).filter((a) => set.has(a)).length,
    critical: [...CRITICAL_PERMS].filter((a) => set.has(a)).length,
  };
}

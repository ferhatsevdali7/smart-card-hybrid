// Yönetici paneli: Kullanıcılar ve Bağlı Araçlar sayfalarının veri tipleri ve yardımcıları.
// Veriler yalnızca Cloud Functions üzerinden gelir; telefon numarası her zaman maskelidir.

import {
  adminEnsureDirectoryFn, adminGetUserFn, adminGetVehicleFn, adminListDeletedAccountsFn,
  adminListUsersFn, adminListVehiclesFn, adminUserStatsFn, adminVehicleStatsFn,
} from './functionsClient';
import type { StaffRole } from '../types/card';

export type UserFilter = 'all' | 'no_qr' | 'push_off' | 'recent';
export type VehicleFilter = 'all' | 'linked' | 'none' | 'disabled';
export type TagState = 'linked' | 'disabled' | 'none';
export type TagStage = 'in_stock' | 'on_sale' | 'active' | 'disabled' | 'expired' | 'trashed';

export interface UserRow {
  uid: string; name: string; email: string; phoneMasked: string | null; provider: string;
  vehicleCount: number; tagCount: number; pushEnabled: boolean; homeScreen: boolean | null;
  isStaff: boolean; disabled: boolean; createdAt: number | null; lastSeenAt: number | null;
}
export interface UserListResult { rows: UserRow[]; next: string | null; searched: boolean; truncated: boolean }
export interface UserStats {
  total: number; withQr: number; pushOn: number; home: number; homeUnknown: number; newMonth: number;
  chips: Record<UserFilter, number>;
  deleted: { total: number; month: number; prevMonth: number; self: number };
  ready: boolean;
}
export interface DeletedRow {
  id: string; emailMasked: string; deletedAt: number | null; by: 'self' | 'admin' | 'system';
  byEmail: string | null; reason: string | null; vehicleCount: number; tagCount: number;
}
export interface DeletedListResult { rows: DeletedRow[]; next: string | null }

export interface TagSummary {
  code: string; serial: string; batchId: string | null; stage: TagStage | null; reason: string | null;
  permanent: boolean; activatedAt: number | null; scanCount: number; lastScanAt: number | null; scans30: number;
  printed: boolean; lastAction: string | null; stageChangedAt: number | null;
}
export interface ActivityItem { at: number | null; kind: string; detail: string }
export interface UserDetail {
  uid: string; name: string; email: string; provider: string; emailVerified: boolean; disabled: boolean; isStaff: boolean;
  createdAt: number | null; lastSignInAt: number | null; phoneMasked: string | null; pushEnabled: boolean; homeScreen: boolean | null;
  summary: { vehicles: number; tags: number; scans30: number; notices30: number };
  vehicles: { id: string; plate: string; brandModel: string; createdAt: number | null; tag: TagSummary | null; notices30: number }[];
  looseTags: (TagSummary | null)[];
  devices: { id: string; platform: string; label: string; standalone: boolean; push: boolean; lastSeenAt: number | null }[];
  activity: ActivityItem[];
}

export interface VehicleRow {
  id: string; plate: string; brandModel: string; ownerUid: string; ownerName: string; ownerEmail: string;
  province: string; tagState: TagState; tagSerial: string | null; tagReason: string | null; createdAt: number | null;
}
export interface VehicleListResult { rows: VehicleRow[]; next: string | null; searched: boolean; truncated: boolean; normalized: string; byTag: boolean }
export interface VehicleStats { total: number; linked: number; none: number; disabled: number; newMonth: number; provinces: Record<string, number>; ready: boolean }
export interface VehicleDetail {
  id: string; plate: string; plateMasked: string; province: string; brandModel: string; createdAt: number | null;
  allowMessages: boolean; parkingNote: string; phoneMasked: string | null;
  owner: { uid: string; name: string; email: string; pushEnabled: boolean; otherPlates: string[] } | null;
  tag: TagSummary | null;
  scans: { days: number[]; total: number };
  notices30: number;
  notices: { at: number | null; type: string; read: boolean }[];
  history: ActivityItem[];
}

// ------------------------------------------------------------------ çağrılar

let ensured = false;
/** Dizin ilk kez kurulur (sunucu bir kez yapar; sonraki çağrılar hemen döner). */
export async function ensureDirectory(): Promise<void> {
  if (ensured) return;
  ensured = true;
  try { await adminEnsureDirectoryFn({}); } catch (e) { ensured = false; throw e; }
}

export const listUsers = (q: string, filter: UserFilter, after: string | null) => adminListUsersFn({ q: q.trim() || undefined, filter, after });
export const userStats = () => adminUserStatsFn({});
export const getUser = (uid: string) => adminGetUserFn({ uid });
export const listDeleted = (after: string | null) => adminListDeletedAccountsFn({ after });
export const listVehicles = (q: string, filter: VehicleFilter, province: string | null, after: string | null) =>
  adminListVehiclesFn({ q: q.trim() || undefined, filter, province, after });
export const vehicleStats = () => adminVehicleStatsFn({});
export const getVehicle = (vehicleId: string) => adminGetVehicleFn({ vehicleId });

/** Müşteri kayıtlarını görebilen roller (sunucudaki kuralla aynı). */
export function canViewCustomers(role: StaffRole | string): boolean {
  return role === 'super_admin' || role === 'support';
}

// ------------------------------------------------------------------ görüntüleme

/** Arama kutusunda yazılanın sunucuda nasıl arandığını göstermek için: "34 abc 1" -> "34ABC1" */
export function normPlate(input: string): string {
  return input
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/İ/g, 'I').replace(/[^A-Z0-9]/g, '');
}

export const PROVINCES: Record<string, string> = {
  '01': 'Adana', '02': 'Adıyaman', '03': 'Afyonkarahisar', '04': 'Ağrı', '05': 'Amasya', '06': 'Ankara', '07': 'Antalya', '08': 'Artvin',
  '09': 'Aydın', '10': 'Balıkesir', '11': 'Bilecik', '12': 'Bingöl', '13': 'Bitlis', '14': 'Bolu', '15': 'Burdur', '16': 'Bursa',
  '17': 'Çanakkale', '18': 'Çankırı', '19': 'Çorum', '20': 'Denizli', '21': 'Diyarbakır', '22': 'Edirne', '23': 'Elazığ', '24': 'Erzincan',
  '25': 'Erzurum', '26': 'Eskişehir', '27': 'Gaziantep', '28': 'Giresun', '29': 'Gümüşhane', '30': 'Hakkâri', '31': 'Hatay', '32': 'Isparta',
  '33': 'Mersin', '34': 'İstanbul', '35': 'İzmir', '36': 'Kars', '37': 'Kastamonu', '38': 'Kayseri', '39': 'Kırklareli', '40': 'Kırşehir',
  '41': 'Kocaeli', '42': 'Konya', '43': 'Kütahya', '44': 'Malatya', '45': 'Manisa', '46': 'Kahramanmaraş', '47': 'Mardin', '48': 'Muğla',
  '49': 'Muş', '50': 'Nevşehir', '51': 'Niğde', '52': 'Ordu', '53': 'Rize', '54': 'Sakarya', '55': 'Samsun', '56': 'Siirt',
  '57': 'Sinop', '58': 'Sivas', '59': 'Tekirdağ', '60': 'Tokat', '61': 'Trabzon', '62': 'Tunceli', '63': 'Şanlıurfa', '64': 'Uşak',
  '65': 'Van', '66': 'Yozgat', '67': 'Zonguldak', '68': 'Aksaray', '69': 'Bayburt', '70': 'Karaman', '71': 'Kırıkkale', '72': 'Batman',
  '73': 'Şırnak', '74': 'Bartın', '75': 'Ardahan', '76': 'Iğdır', '77': 'Yalova', '78': 'Karabük', '79': 'Kilis', '80': 'Osmaniye', '81': 'Düzce',
};

export function provinceName(code: string): string {
  return PROVINCES[code] || (code ? code : '');
}

export function providerLabel(p: string, tr: boolean): string {
  if (p === 'google') return 'Google';
  if (p === 'apple') return 'Apple';
  if (p === 'email') return tr ? 'E-posta' : 'Email';
  return tr ? 'Bilinmiyor' : 'Unknown';
}

export function initials(name: string, email: string): string {
  const src = (name || '').trim() || (email || '').split('@')[0];
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const s = parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || '?').slice(0, 2);
  return s.toLocaleUpperCase('tr-TR');
}

export const NOTICE_TEXT: Record<string, { tr: string; en: string }> = {
  blocking: { tr: 'Aracınız yolu / çıkışı kapatıyor', en: 'Blocking the way' },
  lights: { tr: 'Farlarınız açık kalmış', en: 'Lights are on' },
  window: { tr: 'Camınız veya kapınız açık', en: 'Window or door open' },
  alarm: { tr: 'Alarm çalıyor / araca temas oldu', en: 'Alarm / impact' },
  other: { tr: 'Diğer mesaj', en: 'Other message' },
};

const ACTIVITY: Record<string, { tr: string; en: string }> = {
  account_created: { tr: 'Hesap oluşturdu', en: 'Created account' },
  vehicle_added: { tr: 'Araç ekledi', en: 'Added a vehicle' },
  notice_received: { tr: 'Ziyaretçi bildirimi aldı', en: 'Received a visitor notice' },
  device_added: { tr: 'Yeni cihazdan girdi', en: 'Signed in on a new device' },
  claimed: { tr: 'QR bağladı', en: 'Linked a QR' },
  moved: { tr: "QR'ı başka araca taşıdı", en: 'Moved a QR' },
  unlinked: { tr: "QR'ı araçtan ayırdı", en: 'Unlinked a QR' },
  reported_lost: { tr: 'QR için kayıp bildirdi', en: 'Reported a QR lost' },
  admin_disable: { tr: 'QR yönetici tarafından kapatıldı', en: 'QR disabled by admin' },
  admin_enable: { tr: 'QR yeniden açıldı', en: 'QR re-enabled' },
  admin_expire: { tr: 'QR süresi bitirildi', en: 'QR expired' },
  admin_reset: { tr: 'QR eşleşmesi sıfırlandı', en: 'QR reset' },
  tags_released: { tr: 'QR satışa çıktı', en: 'QR released for sale' },
  tag_created: { tr: 'QR üretildi', en: 'QR produced' },
  batch_created: { tr: 'QR üretildi', en: 'QR produced' },
  account_deleted: { tr: 'Hesap silindi, QR kapatıldı', en: 'Account deleted, QR closed' },
};

export function activityText(kind: string, tr: boolean): string {
  const a = ACTIVITY[kind];
  return a ? (tr ? a.tr : a.en) : kind;
}

export const DISABLE_REASON: Record<string, { tr: string; en: string }> = {
  lost: { tr: 'Kayıp bildirimi', en: 'Reported lost' },
  admin: { tr: 'Yönetici kapattı', en: 'Closed by admin' },
  expired: { tr: 'Süre doldu', en: 'Expired' },
  account_deleted: { tr: 'Hesap silindi', en: 'Account deleted' },
};

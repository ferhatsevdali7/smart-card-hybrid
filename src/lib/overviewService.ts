// Yönetici paneli › Genel Bakış: sunucudan gelen veri tipleri ve kampanya işaretleri.

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { adminOverviewFn } from './functionsClient';

export type OverviewRange = '7d' | '30d' | '90d' | '12m' | 'all' | 'custom';
export type OverviewMetric = 'scans' | 'notices' | 'newUsers' | 'claims' | 'newVehicles';

export interface Kpi { value: number; prev: number | null }

export type AttentionItem =
  | { kind: 'stock'; idle: number; daysLeft: number | null }
  | { kind: 'pending_batch'; batchId: string; count: number; waitingDays: number }
  | { kind: 'lost'; count: number }
  | { kind: 'scan_spike'; code: string; serial: string | null; count: number };

export interface RecentEvent {
  at: number | null;
  action: string;
  actor: 'staff' | 'customer' | 'visitor' | 'system';
  actorName: string;
  target: string;
}

export interface OverviewData {
  range: { key: OverviewRange; start: string; end: string; days: number; prevStart: string | null; prevEnd: string | null };
  kpis: Record<
    'tagsTotal' | 'tagsActive' | 'tagsIdle' | 'tagsClosed' | 'users' | 'usersWithTag' | 'vehicles' | 'vehiclesWithTag',
    Kpi
  >;
  series: Record<OverviewMetric, { cur: number[]; prev: number[] | null }>;
  /** Okutma sayacının başladığı gün (bundan önceki okutmalar bilinmiyor) */
  scansSince: string | null;
  funnel: { registered: number; withVehicle: number; withTag: number; withPush: number };
  provinces: { code: string; count: number }[];
  attention: AttentionItem[];
  recent: RecentEvent[];
  generatedAt: number;
}

export function fetchOverview(range: OverviewRange, from?: string, to?: string, fresh = false): Promise<OverviewData> {
  return adminOverviewFn({ range, from, to, fresh });
}

// ------------------------------------------------------------- kampanya işaretleri

export interface Campaign {
  id: string;
  title: string;
  /** YYYY-MM-DD (dahil) */
  start: string;
  /** YYYY-MM-DD (dahil) */
  end: string;
}

export function listenCampaigns(onData: (list: Campaign[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(db, 'campaigns'), orderBy('start', 'desc')),
    (snap) => onData(snap.docs.map((d) => ({
      id: d.id,
      title: String(d.get('title') || ''),
      start: String(d.get('start') || ''),
      end: String(d.get('end') || ''),
    }))),
    (e) => onError?.(e),
  );
}

export async function addCampaign(uid: string, c: Omit<Campaign, 'id'>): Promise<void> {
  await addDoc(collection(db, 'campaigns'), {
    title: c.title.trim().slice(0, 60),
    start: c.start,
    end: c.end,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(db, 'campaigns', id));
}

// ------------------------------------------------------------- iller (plaka kodu)

export const PROVINCES: Record<string, string> = {
  '01': 'Adana', '02': 'Adıyaman', '03': 'Afyonkarahisar', '04': 'Ağrı', '05': 'Amasya', '06': 'Ankara',
  '07': 'Antalya', '08': 'Artvin', '09': 'Aydın', '10': 'Balıkesir', '11': 'Bilecik', '12': 'Bingöl',
  '13': 'Bitlis', '14': 'Bolu', '15': 'Burdur', '16': 'Bursa', '17': 'Çanakkale', '18': 'Çankırı',
  '19': 'Çorum', '20': 'Denizli', '21': 'Diyarbakır', '22': 'Edirne', '23': 'Elazığ', '24': 'Erzincan',
  '25': 'Erzurum', '26': 'Eskişehir', '27': 'Gaziantep', '28': 'Giresun', '29': 'Gümüşhane', '30': 'Hakkari',
  '31': 'Hatay', '32': 'Isparta', '33': 'Mersin', '34': 'İstanbul', '35': 'İzmir', '36': 'Kars',
  '37': 'Kastamonu', '38': 'Kayseri', '39': 'Kırklareli', '40': 'Kırşehir', '41': 'Kocaeli', '42': 'Konya',
  '43': 'Kütahya', '44': 'Malatya', '45': 'Manisa', '46': 'Kahramanmaraş', '47': 'Mardin', '48': 'Muğla',
  '49': 'Muş', '50': 'Nevşehir', '51': 'Niğde', '52': 'Ordu', '53': 'Rize', '54': 'Sakarya',
  '55': 'Samsun', '56': 'Siirt', '57': 'Sinop', '58': 'Sivas', '59': 'Tekirdağ', '60': 'Tokat',
  '61': 'Trabzon', '62': 'Tunceli', '63': 'Şanlıurfa', '64': 'Uşak', '65': 'Van', '66': 'Yozgat',
  '67': 'Zonguldak', '68': 'Aksaray', '69': 'Bayburt', '70': 'Karaman', '71': 'Kırıkkale', '72': 'Batman',
  '73': 'Şırnak', '74': 'Bartın', '75': 'Ardahan', '76': 'Iğdır', '77': 'Yalova', '78': 'Karabük',
  '79': 'Kilis', '80': 'Osmaniye', '81': 'Düzce',
};

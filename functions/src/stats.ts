/**
 * Günlük istatistik sayaçları (Genel Bakış grafiği için).
 *
 * Her okutma / bildirim / bağlama için ayrı kayıt TUTULMAZ. Bunun yerine gün başına
 * sayaç artırılır:
 *   stats_shards/{YYYY-MM-DD}_{0..9}  O günün parçalı sayaçları (yoğun trafikte tek
 *                                     belgeye saniyede 1 yazma sınırına takılmamak için)
 *   stats_daily/{YYYY-MM-DD}          Gece toplanmış kesin değerler (gün başına tek belge)
 *   stats_meta/counters               Sayaçların başladığı an
 *   stats_meta/backfill_v1            Geçmiş verinin bir kez doldurulduğu kaydı
 *
 * Gün sınırı İstanbul saatine göredir.
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from './helpers';

export const STAT_FIELDS = ['scans', 'notices', 'claims'] as const;
export type StatField = (typeof STAT_FIELDS)[number];
export type DayStats = Record<StatField, number>;

const SHARDS = 10;
const ISTANBUL_OFFSET = '+03:00'; // Türkiye 2016'dan beri yaz/kış saati uygulamıyor.

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** İstanbul saatine göre gün anahtarı: 2026-10-09 */
export function dayKey(date = new Date()): string {
  return dayFormat.format(date);
}

/** Gün anahtarına n gün ekler. */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** İki gün anahtarı arasındaki gün farkı (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** Gün anahtarının İstanbul'daki gece yarısı (ms). */
export function dayStartMs(key: string): number {
  return Date.parse(`${key}T00:00:00${ISTANBUL_OFFSET}`);
}

export function emptyDay(): DayStats {
  return { scans: 0, notices: 0, claims: 0 };
}

let countersMarked = false;

/** Sayaçların ilk kez çalıştığı anı bir kez kaydeder (geçmiş doldurma bu ana kadar sayar). */
async function markCountersStarted(): Promise<void> {
  if (countersMarked) return;
  countersMarked = true;
  await db().collection('stats_meta').doc('counters')
    .create({ startedAt: FieldValue.serverTimestamp() })
    .catch(() => undefined); // zaten varsa sorun değil
}

/** Bugünün sayacını artırır. Hata olursa asıl işlemi etkilemez. */
export async function bumpStat(field: StatField, n = 1): Promise<void> {
  try {
    await markCountersStarted();
    const date = dayKey();
    const shard = Math.floor(Math.random() * SHARDS);
    await db().collection('stats_shards').doc(`${date}_${shard}`)
      .set({ date, [field]: FieldValue.increment(n) }, { merge: true });
  } catch (e) {
    console.error('[stats] sayaç artırılamadı:', field, e);
  }
}

/** Belirtilen günden ÖNCEKİ günlerin parçalı sayaçlarını tek belgede toplar. */
export async function rollupShards(beforeDay: string): Promise<number> {
  const snap = await db().collection('stats_shards').where('date', '<', beforeDay).get();
  const byDate = new Map<string, FirebaseFirestore.DocumentReference[]>();
  snap.docs.forEach((d) => {
    const date = d.get('date') as string;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(d.ref);
  });

  for (const [date, refs] of byDate) {
    await db().runTransaction(async (tx) => {
      const docs = await Promise.all(refs.map((r) => tx.get(r)));
      const sum = emptyDay();
      docs.forEach((d) => {
        if (!d.exists) return;
        STAT_FIELDS.forEach((f) => { sum[f] += Number(d.get(f)) || 0; });
      });
      const update: Record<string, unknown> = { date };
      STAT_FIELDS.forEach((f) => { if (sum[f]) update[f] = FieldValue.increment(sum[f]); });
      tx.set(db().collection('stats_daily').doc(date), update, { merge: true });
      docs.forEach((d) => { if (d.exists) tx.delete(d.ref); });
    });
  }
  return byDate.size;
}

/** [from, to] aralığındaki günlük değerler (toplanmış + henüz toplanmamış parçalar). */
export async function readDailyStats(from: string, to: string): Promise<Map<string, DayStats>> {
  const [daily, shards] = await Promise.all([
    db().collection('stats_daily').where('date', '>=', from).where('date', '<=', to).get(),
    db().collection('stats_shards').where('date', '>=', from).where('date', '<=', to).get(),
  ]);
  const out = new Map<string, DayStats>();
  for (const d of [...daily.docs, ...shards.docs]) {
    const date = d.get('date') as string;
    if (!out.has(date)) out.set(date, emptyDay());
    const row = out.get(date)!;
    STAT_FIELDS.forEach((f) => { row[f] += (Number(d.get(f)) || 0) + (Number(d.get(`backfill.${f}`)) || 0); });
  }
  return out;
}

/** Sayaçların başladığı gün (okutma sayısı bu günden önce bilinmiyor). */
export async function countersStartDay(): Promise<string | null> {
  const snap = await db().collection('stats_meta').doc('counters').get();
  const t = snap.get('startedAt');
  return t instanceof Timestamp ? dayKey(t.toDate()) : null;
}

/**
 * Geçmiş veriyi bir kez doldurur: sayaçlar çalışmaya başlamadan önceki bildirimler
 * ve etiket bağlamaları mevcut kayıtlardan günlere dağıtılır.
 * Geçmiş okutmalar kurtarılamaz (her okutma için kayıt tutulmuyordu).
 */
export async function ensureBackfill(): Promise<void> {
  const meta = db().collection('stats_meta').doc('backfill_v1');
  try {
    await meta.create({ startedAt: FieldValue.serverTimestamp() });
  } catch {
    return; // daha önce yapılmış ya da şu an başka bir çağrıda yapılıyor
  }

  try {
    const countersSnap = await db().collection('stats_meta').doc('counters').get();
    const started = countersSnap.get('startedAt');
    const cutoffMs = started instanceof Timestamp ? started.toMillis() : Date.now();

    const totals = new Map<string, DayStats>();
    const add = (ms: number, field: StatField) => {
      if (ms >= cutoffMs) return; // bu andan sonrasını sayaçlar zaten saydı
      const key = dayKey(new Date(ms));
      if (!totals.has(key)) totals.set(key, emptyDay());
      totals.get(key)![field] += 1;
    };

    const [notices, claims] = await Promise.all([
      db().collectionGroup('notices').select('createdAt').get(),
      db().collection('tag_events').where('action', '==', 'claimed').select('at').get(),
    ]);
    notices.forEach((d) => {
      const t = d.get('createdAt');
      if (t instanceof Timestamp) add(t.toMillis(), 'notices');
    });
    claims.forEach((d) => {
      const t = d.get('at');
      if (t instanceof Timestamp) add(t.toMillis(), 'claims');
    });

    const entries = [...totals.entries()];
    for (let i = 0; i < entries.length; i += 400) {
      const wb = db().batch();
      entries.slice(i, i + 400).forEach(([date, s]) => {
        // Ayrı alana ve artırma yerine doğrudan yazılır: tekrar çalışırsa çift sayım olmaz.
        wb.set(db().collection('stats_daily').doc(date), { date, backfill: s }, { merge: true });
      });
      await wb.commit();
    }
    await meta.set({ doneAt: FieldValue.serverTimestamp(), days: entries.length }, { merge: true });
  } catch (e) {
    console.error('[stats] geçmiş doldurma başarısız:', e);
    await meta.delete().catch(() => undefined); // bir sonraki açılışta tekrar denensin
  }
}

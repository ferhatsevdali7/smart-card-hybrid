/**
 * Yönetici paneli › Genel Bakış verisi.
 *
 * Tek çağrıda sayfanın tüm verisini hesaplar. Toplamlar mümkün olduğunca
 * count() sorgularıyla (1.000 belge = 1 okuma) alınır; boştaki etiketler gibi
 * büyüyecek listeler hiç okunmaz. Sonuç her sunucu örneğinde 60 sn önbellekte tutulur.
 */

import { getAuth, UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { SUPER_ADMIN_EMAILS, VEHICLE_PRODUCT } from './config';
import { db, requireStaff } from './helpers';
import {
  addDays, countersStartDay, dayKey, daysBetween, dayStartMs, ensureBackfill, readDailyStats,
} from './stats';

type RangeKey = '7d' | '30d' | '90d' | '12m' | 'all' | 'custom';
const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CUSTOM_DAYS = 1100;

interface Kpi { value: number; prev: number | null }

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 60 * 1000;

function toMs(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

async function countOf(q: FirebaseFirestore.Query): Promise<number> {
  return (await q.count().get()).data().count;
}

async function listAllUsers(): Promise<UserRecord[]> {
  const out: UserRecord[] = [];
  let token: string | undefined;
  do {
    const page = await getAuth().listUsers(1000, token);
    out.push(...page.users);
    token = page.pageToken;
  } while (token);
  return out;
}

export const adminOverview = onCall({ timeoutSeconds: 60, memory: '512MiB' }, async (req) => {
  await requireStaff(req, ['production', 'support', 'warehouse']);

  // ------------------------------------------------------------- dönem
  const range = (req.data?.range || '30d') as RangeKey;
  if (!['7d', '30d', '90d', '12m', 'all', 'custom'].includes(range)) {
    throw new HttpsError('invalid-argument', 'Geçersiz dönem.');
  }
  const today = dayKey();
  let start: string;
  let end = today;
  if (range === 'custom') {
    const from = String(req.data?.from || '');
    const to = String(req.data?.to || '');
    if (!DAY_RE.test(from) || !DAY_RE.test(to) || from > to) {
      throw new HttpsError('invalid-argument', 'Geçersiz tarih aralığı.');
    }
    end = to > today ? today : to;
    start = from > end ? end : from;
    if (daysBetween(start, end) > MAX_CUSTOM_DAYS) {
      throw new HttpsError('invalid-argument', 'En fazla 3 yıllık aralık seçilebilir.');
    }
  } else if (range === 'all') {
    start = today; // aşağıda en eski kayda çekilir
  } else {
    start = addDays(today, -(RANGE_DAYS[range] - 1));
  }

  const cacheKey = `${range}|${start}|${end}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS && req.data?.fresh !== true) return hit.data;

  // Geçmiş bildirim/bağlama sayılarını ilk açılışta bir kez doldur.
  await ensureBackfill();

  // ------------------------------------------------------------- veriler
  const tags = db().collection('tags').where('productType', '==', VEHICLE_PRODUCT);
  const [
    users, vehiclesSnap, activeSnap, closedSnap, tokensSnap, staffSnap,
    tagsTotal, tagsIdle, firstTagSnap, pendingSnap, alertsSnap, eventsSnap, scansSince,
  ] = await Promise.all([
    listAllUsers(),
    db().collection('vehicles').select('ownerUid', 'plateNumber', 'tagCode', 'createdAt').get(),
    db().collection('tags').where('status', '==', 'active')
      .select('productType', 'assignedUserId', 'assignedVehicleId', 'activatedAt').get(),
    db().collection('tags').where('status', 'in', ['disabled', 'expired'])
      .select('productType', 'status', 'disabledReason', 'updatedAtTs').get(),
    db().collectionGroup('push_tokens').select().get(),
    db().collection('staff_members').select().get(),
    countOf(tags),
    countOf(tags.where('status', '==', 'unclaimed')),
    db().collection('tags').orderBy('createdAt').limit(1).select('createdAt').get(),
    db().collection('production_batches').where('status', '==', 'STATUS_CREATED').select('createdAt', 'totalCount').get(),
    db().collection('scan_alerts').where('at', '>=', Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)).get(),
    db().collection('tag_events').orderBy('at', 'desc').limit(8).get(),
    countersStartDay(),
  ]);

  if (range === 'all') {
    let earliest = Date.now();
    users.forEach((u) => { earliest = Math.min(earliest, Date.parse(u.metadata.creationTime)); });
    vehiclesSnap.forEach((d) => { const ms = toMs(d.get('createdAt')); if (ms) earliest = Math.min(earliest, ms); });
    const firstTag = toMs(firstTagSnap.docs[0]?.get('createdAt'));
    if (firstTag) earliest = Math.min(earliest, firstTag);
    start = dayKey(new Date(earliest));
  }

  const days = daysBetween(start, end) + 1;
  const hasPrev = range !== 'all';
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(start, -days);
  const startMs = dayStartMs(start);
  const startIso = new Date(startMs).toISOString();

  // ------------------------------------------------------------- etiketler
  const isVehicleTag = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.get('productType') === VEHICLE_PRODUCT;
  const active = activeSnap.docs.filter(isVehicleTag).map((d) => ({
    userId: d.get('assignedUserId') as string | null,
    vehicleId: d.get('assignedVehicleId') as string | null,
    activatedMs: toMs(d.get('activatedAt')),
  }));
  const activeBefore = active.filter((t) => t.activatedMs !== null && t.activatedMs < startMs);

  const closed = closedSnap.docs.filter(isVehicleTag).map((d) => ({
    lost: d.get('disabledReason') === 'lost',
    changedMs: toMs(d.get('updatedAtTs')),
  }));
  // Kapanma zamanı bilinmeyenler dönem başında da kapalı sayılır.
  const closedBefore = closed.filter((t) => t.changedMs === null || t.changedMs < startMs).length;

  let tagsTotalPrev: number | null = null;
  if (hasPrev) {
    // Bileşik indeks (productType + createdAt) hazır değilse karşılaştırma boş döner.
    tagsTotalPrev = await countOf(tags.where('createdAt', '<', startIso)).catch((e) => {
      console.warn('[overview] önceki toplam hesaplanamadı (indeks hazır olmayabilir):', e?.message);
      return null;
    });
  }
  const tagsIdlePrev = tagsTotalPrev === null ? null : Math.max(0, tagsTotalPrev - activeBefore.length - closedBefore);

  // ------------------------------------------------------------- müşteriler
  const usersWithTag = new Set(active.map((t) => t.userId).filter(Boolean) as string[]);
  const usersWithTagBefore = new Set(activeBefore.map((t) => t.userId).filter(Boolean) as string[]);

  const vehicles = vehiclesSnap.docs.map((d) => ({
    owner: d.get('ownerUid') as string,
    plate: String(d.get('plateNumber') || ''),
    hasTag: !!d.get('tagCode'),
    createdMs: toMs(d.get('createdAt')),
  }));
  const vehiclesWithTagBefore = new Set(activeBefore.map((t) => t.vehicleId).filter(Boolean) as string[]).size;

  const kpis: Record<string, Kpi> = {
    tagsTotal: { value: tagsTotal, prev: tagsTotalPrev },
    tagsActive: { value: active.length, prev: hasPrev ? activeBefore.length : null },
    tagsIdle: { value: tagsIdle, prev: hasPrev ? tagsIdlePrev : null },
    tagsClosed: { value: closed.length, prev: hasPrev ? closedBefore : null },
    users: { value: users.length, prev: hasPrev ? users.filter((u) => Date.parse(u.metadata.creationTime) < startMs).length : null },
    usersWithTag: { value: usersWithTag.size, prev: hasPrev ? usersWithTagBefore.size : null },
    vehicles: { value: vehicles.length, prev: hasPrev ? vehicles.filter((v) => v.createdMs !== null && v.createdMs < startMs).length : null },
    vehiclesWithTag: { value: vehicles.filter((v) => v.hasTag).length, prev: hasPrev ? vehiclesWithTagBefore : null },
  };

  // ------------------------------------------------------------- günlük seriler
  const firstDay = hasPrev ? prevStart : start;
  const stats = await readDailyStats(firstDay, end);
  const indexOf = (ms: number | null): number => (ms === null ? -1 : daysBetween(firstDay, dayKey(new Date(ms))));
  const total = daysBetween(firstDay, end) + 1;
  const mk = () => new Array<number>(total).fill(0);
  const series = { scans: mk(), notices: mk(), claims: mk(), newUsers: mk(), newVehicles: mk() };
  for (let i = 0; i < total; i++) {
    const s = stats.get(addDays(firstDay, i));
    if (s) { series.scans[i] = s.scans; series.notices[i] = s.notices; series.claims[i] = s.claims; }
  }
  users.forEach((u) => {
    const i = indexOf(Date.parse(u.metadata.creationTime));
    if (i >= 0 && i < total) series.newUsers[i] += 1;
  });
  vehicles.forEach((v) => {
    const i = indexOf(v.createdMs);
    if (i >= 0 && i < total) series.newVehicles[i] += 1;
  });
  const split = (arr: number[]) => (hasPrev ? { cur: arr.slice(days), prev: arr.slice(0, days) } : { cur: arr, prev: null });

  // ------------------------------------------------------------- müşteri hunisi
  const vehicleOwners = new Set(vehicles.map((v) => v.owner));
  const tagOwners = new Set([...usersWithTag, ...vehicles.filter((v) => v.hasTag).map((v) => v.owner)]);
  const pushOwners = new Set(tokensSnap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[]);
  const endMs = dayStartMs(addDays(end, 1));
  const cohort = users.filter((u) => {
    const ms = Date.parse(u.metadata.creationTime);
    return ms >= startMs && ms < endMs;
  });
  const funnel = {
    registered: cohort.length,
    withVehicle: cohort.filter((u) => vehicleOwners.has(u.uid)).length,
    withTag: cohort.filter((u) => tagOwners.has(u.uid)).length,
    withPush: cohort.filter((u) => pushOwners.has(u.uid)).length,
  };

  // ------------------------------------------------------------- iller (QR bağlı araçlar)
  const provinceCounts = new Map<string, number>();
  vehicles.filter((v) => v.hasTag).forEach((v) => {
    const m = v.plate.replace(/\s+/g, '').match(/^(\d{2})/);
    const code = m && Number(m[1]) >= 1 && Number(m[1]) <= 81 ? m[1] : '??';
    provinceCounts.set(code, (provinceCounts.get(code) || 0) + 1);
  });
  const provinces = [...provinceCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  // ------------------------------------------------------------- dikkat gerektirenler
  const attention: Record<string, unknown>[] = [];
  const now = Date.now();
  const claims30 = active.filter((t) => t.activatedMs !== null && t.activatedMs >= now - 30 * 86400000).length;
  const perDay = claims30 / 30;
  const daysLeft = perDay > 0 ? Math.floor(tagsIdle / perDay) : null;
  if (tagsIdle < 50 || (daysLeft !== null && daysLeft < 45)) {
    attention.push({ kind: 'stock', idle: tagsIdle, daysLeft });
  }
  pendingSnap.docs
    .map((d) => ({ id: d.id, createdMs: toMs(d.get('createdAt')), count: Number(d.get('totalCount')) || 0 }))
    .filter((b) => b.createdMs !== null && now - b.createdMs > 24 * 3600 * 1000)
    .sort((a, b) => (a.createdMs || 0) - (b.createdMs || 0))
    .slice(0, 3)
    .forEach((b) => attention.push({ kind: 'pending_batch', batchId: b.id, count: b.count, waitingDays: Math.floor((now - (b.createdMs || now)) / 86400000) }));
  const lost30 = closed.filter((t) => t.lost && t.changedMs !== null && t.changedMs >= now - 30 * 86400000).length;
  if (lost30 > 0) attention.push({ kind: 'lost', count: lost30 });
  alertsSnap.docs
    .sort((a, b) => (toMs(b.get('at')) || 0) - (toMs(a.get('at')) || 0))
    .slice(0, 3)
    .forEach((d) => attention.push({ kind: 'scan_spike', code: d.get('code'), serial: d.get('serial') || null, count: Number(d.get('count')) || 0 }));

  // ------------------------------------------------------------- son işlemler
  const staffEmails = new Set([...SUPER_ADMIN_EMAILS, ...staffSnap.docs.map((d) => d.id.toLowerCase())]);
  const userById = new Map(users.map((u) => [u.uid, u]));
  const events = eventsSnap.docs.map((d) => d.data());
  const codes = [...new Set(events.map((e) => e.code).filter((c) => typeof c === 'string'))] as string[];
  const staffUids = [...new Set(events.map((e) => e.by).filter((uid) => {
    const email = typeof uid === 'string' ? userById.get(uid)?.email?.toLowerCase() : undefined;
    return !!email && staffEmails.has(email);
  }))] as string[];
  const [tagDocs, profileDocs] = await Promise.all([
    codes.length ? db().getAll(...codes.map((c) => db().collection('tags').doc(c))) : Promise.resolve([]),
    staffUids.length ? db().getAll(...staffUids.map((u) => db().collection('admin_profiles').doc(u))) : Promise.resolve([]),
  ]);
  const serialOf = new Map(tagDocs.map((d) => [d.id, (d.get('tagId') as string) || d.id]));
  const nameOf = new Map(profileDocs.map((d) => [d.id, (d.get('displayName') as string) || '']));

  const recent = events.map((e) => {
    const action = String(e.action || '');
    const by = typeof e.by === 'string' ? e.by : null;
    const u = by ? userById.get(by) : undefined;
    const email = u?.email?.toLowerCase() || '';
    let actor: 'staff' | 'customer' | 'visitor' | 'system' = 'customer';
    let actorName = '';
    if (action === 'notice_sent') actor = 'visitor';
    else if (action === 'scan_alert' || !by) actor = 'system';
    else if (staffEmails.has(email)) {
      actor = 'staff';
      actorName = (by && nameOf.get(by)) || u?.displayName || email.split('@')[0];
    }
    let target = '';
    if (action === 'batch_created') target = String(e.batchId || '');
    else if (action === 'notice_sent') target = String(e.plateMasked || '');
    else if (typeof e.code === 'string') target = serialOf.get(e.code) || e.code;
    return { at: toMs(e.at), action, actor, actorName, target };
  });

  const data = {
    range: { key: range, start, end, days, prevStart: hasPrev ? prevStart : null, prevEnd: hasPrev ? prevEnd : null },
    kpis,
    series: {
      scans: split(series.scans),
      notices: split(series.notices),
      claims: split(series.claims),
      newUsers: split(series.newUsers),
      newVehicles: split(series.newVehicles),
    },
    scansSince,
    funnel,
    provinces,
    attention,
    recent,
    generatedAt: Date.now(),
  };
  cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > 30) cache.delete(cache.keys().next().value as string);
  return data;
});

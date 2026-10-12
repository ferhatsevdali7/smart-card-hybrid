/**
 * QR yaşam döngüsü
 *
 *   in_stock (Depoda) ──satışa çıkar──▶ on_sale (Satış standında) ──müşteri bağlar──▶ active (QR bankası)
 *        ▲      │                         │                                            │
 *        │      └────────── çöpe at ──────┴──▶ trashed (Çöp kutusu) ──kalıcı sil──▶ (silinir, kod kaydı kalır)
 *        │                                                                             │
 *        └──────────── eşleşmeyi sıfırla ◀── disabled / expired (Devre dışı) ◀── kapat / kayıp / süre doldu
 *
 * Kurallar:
 *  - Durumu yalnızca bu dosyadaki fonksiyonlar değiştirir (istemci etiketlere yazamaz).
 *  - Her değişiklikte partinin sayaçları (production_batches/{id}.counts) AYNI işlemde güncellenir.
 *  - Müşteriye bağlı (active) ya da devre dışı QR doğrudan çöpe atılamaz.
 *  - Kalıcı silinen QR'ın kodu tag_tombstones'a yazılır: bir daha üretilmez, okutulursa "kapatılmış" görünür.
 *  - Eski kayıtlardaki 'unclaimed' durumu 'in_stock' sayılır.
 */

import { FieldValue, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { db, requireStaff, parseCode, StaffRole } from './helpers';
import { ACCOUNT_DELETED } from './config';

export type Stage = 'in_stock' | 'on_sale' | 'active' | 'disabled' | 'expired' | 'trashed';
export const STAGES: Stage[] = ['in_stock', 'on_sale', 'active', 'disabled', 'expired', 'trashed'];

export type TagAction =
  | 'release' | 'unrelease' | 'mark_printed' | 'unmark_printed'
  | 'trash' | 'restore' | 'disable' | 'enable' | 'expire' | 'reset' | 'purge';

export const TAG_ACTIONS: TagAction[] = [
  'release', 'unrelease', 'mark_printed', 'unmark_printed', 'trash', 'restore', 'disable', 'enable', 'expire', 'reset', 'purge',
];

/** Hangi işlemi hangi rol yapabilir (super_admin her şeyi yapar). */
const ACTION_ROLES: Record<TagAction, StaffRole[]> = {
  release: ['production', 'warehouse'],
  unrelease: ['production', 'warehouse'],
  mark_printed: ['production', 'warehouse'],
  unmark_printed: ['production', 'warehouse'],
  trash: ['production'],
  restore: ['production'],
  disable: ['support'],
  enable: ['support'],
  expire: ['support'],
  reset: ['support'],
  purge: [], // yalnızca süper yönetici
};

/** Denetim kaydında kullanılan işlem adları */
const EVENT_NAMES: Record<TagAction, string> = {
  release: 'tags_released',
  unrelease: 'tags_unreleased',
  mark_printed: 'tags_printed',
  unmark_printed: 'tags_unprinted',
  trash: 'tags_trashed',
  restore: 'tags_restored',
  disable: 'admin_disable',
  enable: 'admin_enable',
  expire: 'admin_expire',
  reset: 'admin_reset',
  purge: 'tags_purged',
};

export const TOMBSTONES = 'tag_tombstones';
const MAX_CODES_PER_CALL = 500;
const CHUNK = 100;
const REAUTH_SECONDS = 5 * 60;

export function stageOf(status: unknown): Stage | null {
  if (status === 'unclaimed') return 'in_stock';
  return STAGES.includes(status as Stage) ? (status as Stage) : null;
}

// ---------------------------------------------------------------------------
// Parti sayaçları
// ---------------------------------------------------------------------------

type Snapshot = { stage: Stage | null; printed: boolean } | null;
type Delta = Record<string, number>;

/** Bir etiketin önceki ve sonraki hali arasındaki sayaç farkı. after = null: kalıcı silindi. */
export function countDelta(before: Snapshot, after: Snapshot): Delta {
  const d: Delta = {};
  const add = (k: string, n: number) => { d[k] = (d[k] || 0) + n; };
  if (before?.stage) add(before.stage, -1);
  if (before?.printed) add('printed', -1);
  if (after?.stage) add(after.stage, 1);
  if (after?.printed) add('printed', 1);
  if (before && !after) add('deleted', 1);
  Object.keys(d).forEach((k) => { if (d[k] === 0) delete d[k]; });
  return d;
}

function mergeDelta(target: Map<string, Delta>, batchId: string | undefined, delta: Delta): void {
  if (!batchId || !Object.keys(delta).length) return;
  const cur = target.get(batchId) || {};
  Object.entries(delta).forEach(([k, v]) => { cur[k] = (cur[k] || 0) + v; });
  target.set(batchId, cur);
}

/** Toplanmış farkları parti belgelerine yazar (aynı işlem/toplu yazma içinde). */
export function writeCounts(
  writer: Transaction | FirebaseFirestore.WriteBatch,
  deltas: Map<string, Delta>,
): void {
  for (const [batchId, delta] of deltas) {
    const counts: Record<string, FirebaseFirestore.FieldValue> = {};
    Object.entries(delta).forEach(([k, v]) => { if (v) counts[k] = FieldValue.increment(v); });
    if (!Object.keys(counts).length) continue;
    const ref = db().collection('production_batches').doc(batchId);
    (writer as Transaction).set(ref, { counts, countsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

/** Tek etiket değişikliği için kısayol (scan/claim/kayıp gibi tekil işlemler). */
export function applyTagCounts(tx: Transaction, batchId: string | undefined, before: Snapshot, after: Snapshot): void {
  const m = new Map<string, Delta>();
  mergeDelta(m, batchId, countDelta(before, after));
  writeCounts(tx, m);
}

export function snap(data: FirebaseFirestore.DocumentData | undefined): Snapshot {
  return data ? { stage: stageOf(data.status), printed: data.printed === true } : null;
}

// ---------------------------------------------------------------------------
// Tek bir etikete işlem uygulama kuralları
// ---------------------------------------------------------------------------

interface Plan {
  update?: Record<string, unknown>;
  purge?: boolean;
  /** Eşleşme sıfırlanırken aracın etiket bağı da silinir */
  clearVehicleId?: string | null;
  after: Snapshot;
}

type Skip = { skip: string };

const SKIP_TEXT = {
  notFound: 'Etiket bulunamadı',
  wrongStage: 'Bu aşamadaki QR için uygun değil',
  customer: "Müşteriye bağlı QR'lar doğrudan çöpe atılamaz; önce devre dışı bırakın",
  ownerDeleted: "Hesabı silinen müşterinin QR'ı kalıcı olarak kapalıdır",
} as const;

/** Hesabı silinen müşterinin QR'ı: etiket müşteride kaldığı için yeniden açılamaz, depoya da dönemez. */
export function isPermanentlyClosed(tag: FirebaseFirestore.DocumentData): boolean {
  return tag.permanentlyDisabled === true || tag.disabledReason === ACCOUNT_DELETED;
}

function planFor(action: TagAction, tag: FirebaseFirestore.DocumentData, staff: { uid: string; email: string }, note?: string): Plan | Skip {
  const stage = stageOf(tag.status);
  const printed = tag.printed === true;
  const now = FieldValue.serverTimestamp();
  const base = { stageChangedAt: now, lastAction: action, lastActionBy: staff.email, updatedAtTs: now };
  const to = (s: Stage, extra: Record<string, unknown> = {}, p = printed): Plan => ({
    update: { status: s, ...base, ...extra }, after: { stage: s, printed: p },
  });

  switch (action) {
    case 'release':
      return stage === 'in_stock' ? to('on_sale', { releasedAt: now, releasedBy: staff.email }) : { skip: SKIP_TEXT.wrongStage };
    case 'unrelease':
      return stage === 'on_sale' ? to('in_stock', { releasedAt: null, releasedBy: null }) : { skip: SKIP_TEXT.wrongStage };
    case 'mark_printed':
    case 'unmark_printed': {
      if (stage !== 'in_stock' && stage !== 'on_sale') return { skip: SKIP_TEXT.wrongStage };
      const want = action === 'mark_printed';
      if (printed === want) return { skip: want ? 'Zaten basıldı olarak işaretli' : 'Zaten basılmadı olarak işaretli' };
      return {
        update: { printed: want, printedAt: want ? now : null, printedBy: want ? staff.email : null, lastAction: action, lastActionBy: staff.email, updatedAtTs: now },
        after: { stage, printed: want },
      };
    }
    case 'trash':
      if (stage === 'active' || stage === 'disabled' || stage === 'expired') return { skip: SKIP_TEXT.customer };
      if (stage !== 'in_stock' && stage !== 'on_sale') return { skip: SKIP_TEXT.wrongStage };
      return to('trashed', { trashedFrom: stage, trashedAt: now, trashedBy: staff.email });
    case 'restore': {
      if (stage !== 'trashed') return { skip: SKIP_TEXT.wrongStage };
      const back: Stage = tag.trashedFrom === 'on_sale' ? 'on_sale' : 'in_stock';
      return to(back, { trashedFrom: null, trashedAt: null, trashedBy: null });
    }
    case 'disable':
      if (stage !== 'active') return { skip: SKIP_TEXT.wrongStage };
      return to('disabled', { disabledFrom: 'active', disabledReason: 'admin', disabledAt: now, disabledBy: staff.email, ...(note ? { notes: note } : {}) });
    case 'expire':
      if (stage !== 'active') return { skip: SKIP_TEXT.wrongStage };
      return to('expired', { disabledFrom: 'active', disabledReason: 'expired', disabledAt: now, disabledBy: staff.email });
    case 'enable': {
      if (stage !== 'disabled' && stage !== 'expired') return { skip: SKIP_TEXT.wrongStage };
      if (isPermanentlyClosed(tag)) return { skip: SKIP_TEXT.ownerDeleted };
      const back: Stage = tag.assignedUserId ? 'active' : (stageOf(tag.disabledFrom) === 'on_sale' ? 'on_sale' : 'in_stock');
      return to(back, { disabledFrom: null, disabledReason: null, disabledAt: null, disabledBy: null });
    }
    case 'reset':
      if (stage !== 'active' && stage !== 'disabled' && stage !== 'expired') return { skip: SKIP_TEXT.wrongStage };
      if (isPermanentlyClosed(tag)) return { skip: SKIP_TEXT.ownerDeleted };
      return {
        ...to('in_stock', {
          assignedUserId: null, assignedUserEmail: null, assignedVehicleId: null, assignedPlate: null,
          activatedAt: null, disabledFrom: null, disabledReason: null, disabledAt: null, disabledBy: null,
          releasedAt: null, releasedBy: null,
        }),
        clearVehicleId: tag.assignedVehicleId || null,
      };
    case 'purge':
      if (stage !== 'trashed') return { skip: SKIP_TEXT.wrongStage };
      return { purge: true, after: null };
    default:
      return { skip: SKIP_TEXT.wrongStage };
  }
}

export interface ActionResult {
  done: number;
  skipped: { code: string; reason: string }[];
}

/** İşlem gören QR'ların müşterileri (yönetici paneli özetleri yenilensin diye; istemciye gönderilmez). */
const lastOwners = new WeakMap<ActionResult, Set<string>>();
export function ownersOf(r: ActionResult): string[] {
  return [...(lastOwners.get(r) || [])];
}

/** Birden çok etikete aynı işlemi uygular (100'lük işlem parçalarıyla). */
export async function runTagAction(
  staff: { uid: string; email: string },
  codes: string[],
  action: TagAction,
  note?: string,
): Promise<ActionResult> {
  const result: ActionResult = { done: 0, skipped: [] };
  const batchIds = new Set<string>();
  const owners = new Set<string>();
  lastOwners.set(result, owners);

  for (let i = 0; i < codes.length; i += CHUNK) {
    const part = codes.slice(i, i + CHUNK);
    const partResult = await db().runTransaction(async (tx) => {
      const local: ActionResult = { done: 0, skipped: [] };
      const refs = part.map((c) => db().collection('tags').doc(c));
      const snaps = await Promise.all(refs.map((r) => tx.get(r)));

      const plans: { ref: DocumentReference; tag: FirebaseFirestore.DocumentData; plan: Plan }[] = [];
      snaps.forEach((s, idx) => {
        if (!s.exists) { local.skipped.push({ code: part[idx], reason: SKIP_TEXT.notFound }); return; }
        const tag = s.data()!;
        const p = planFor(action, tag, staff, note);
        if ('skip' in p) local.skipped.push({ code: part[idx], reason: p.skip });
        else plans.push({ ref: refs[idx], tag, plan: p });
      });

      // Sıfırlamada araç belgeleri de okunmalı (Firestore: önce tüm okumalar, sonra yazmalar).
      const vehicleRefs = plans
        .map((p) => p.plan.clearVehicleId)
        .filter((v): v is string => !!v)
        .map((id) => db().collection('vehicles').doc(id));
      const vehicleSnaps = await Promise.all(vehicleRefs.map((r) => tx.get(r)));
      const vehicleTag = new Map(vehicleSnaps.map((v) => [v.id, v.exists ? v.get('tagCode') : undefined]));

      const deltas = new Map<string, Delta>();
      for (const { ref, tag, plan } of plans) {
        mergeDelta(deltas, tag.batchId, countDelta(snap(tag), plan.after));
        if (tag.batchId) batchIds.add(tag.batchId);
        if (typeof tag.assignedUserId === 'string' && tag.assignedUserId) owners.add(tag.assignedUserId);
        if (plan.purge) {
          tx.delete(ref);
          tx.set(db().collection(TOMBSTONES).doc(ref.id), {
            code: ref.id,
            tagId: tag.tagId || null,
            batchId: tag.batchId || null,
            deletedAt: FieldValue.serverTimestamp(),
            deletedBy: staff.email,
          });
        } else {
          tx.update(ref, plan.update!);
        }
        if (plan.clearVehicleId && vehicleTag.get(plan.clearVehicleId) === ref.id) {
          tx.update(db().collection('vehicles').doc(plan.clearVehicleId), { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
        }
        local.done += 1;
      }
      writeCounts(tx, deltas);

      if (local.done > 0) {
        const doneCodes = plans.map((p) => p.ref.id);
        tx.set(db().collection('tag_events').doc(), {
          action: EVENT_NAMES[action],
          by: staff.uid,
          byEmail: staff.email,
          count: local.done,
          code: local.done === 1 ? doneCodes[0] : null,
          codes: doneCodes.slice(0, 50),
          batchIds: [...new Set(plans.map((p) => p.tag.batchId).filter(Boolean))],
          note: note || null,
          at: FieldValue.serverTimestamp(),
        });
      }
      return local;
    });
    result.done += partResult.done;
    result.skipped.push(...partResult.skipped);
  }
  return result;
}

function parseCodes(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) throw new HttpsError('invalid-argument', 'En az bir QR seçilmelidir.');
  if (input.length > MAX_CODES_PER_CALL) throw new HttpsError('invalid-argument', `Tek seferde en fazla ${MAX_CODES_PER_CALL} QR işlenebilir.`);
  const out = new Set<string>();
  input.forEach((c) => {
    const code = parseCode(c);
    if (!code) throw new HttpsError('invalid-argument', 'Geçersiz QR kodu.');
    out.add(code);
  });
  return [...out];
}

/** Kalıcı silme: yalnızca süper yönetici ve son 5 dakikada şifresini doğrulamış olmalı. */
function requireRecentAuth(req: CallableRequest): void {
  const authTime = Number(req.auth?.token?.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > REAUTH_SECONDS) {
    throw new HttpsError('unauthenticated', 'REAUTH_REQUIRED');
  }
}

async function staffFor(req: CallableRequest, action: TagAction) {
  const staff = await requireStaff(req, ACTION_ROLES[action]);
  if (action === 'purge') {
    if (staff.role !== 'super_admin') throw new HttpsError('permission-denied', 'Kalıcı silme yalnızca süper yöneticiye açıktır.');
    requireRecentAuth(req);
  }
  return staff;
}

// ---------------------------------------------------------------------------
// Çağrılabilir fonksiyonlar
// ---------------------------------------------------------------------------

/** Seçili QR'lara toplu işlem: satışa çıkar, depoya al, basıldı, çöpe at, geri yükle, kapat, aç, sıfırla, kalıcı sil. */
export const adminTagAction = onCall({ timeoutSeconds: 120 }, async (req) => {
  const action = req.data?.action as TagAction;
  if (!TAG_ACTIONS.includes(action)) throw new HttpsError('invalid-argument', 'Geçersiz işlem.');
  const codes = parseCodes(req.data?.codes);
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 300) : undefined;
  const staff = await staffFor(req, action);
  const result = await runTagAction(staff, codes, action, note);
  // Müşteriye bağlı QR'larda (kapat/aç/süre/sıfırla) Kullanıcılar ve Bağlı Araçlar özetleri güncellenir.
  const owners = ownersOf(result);
  if (owners.length) {
    const { refreshQuietly } = await import('./directory');
    await refreshQuietly(owners);
  }
  return { done: result.done, skipped: result.skipped };
});

type BatchAction = 'release_all' | 'print_all' | 'trash';

/** Bir partinin tamamına işlem. Çöpe atma yalnızca müşteride QR'ı olmayan partilerde yapılabilir. */
export const adminBatchAction = onCall({ timeoutSeconds: 300 }, async (req) => {
  const action = req.data?.action as BatchAction;
  if (!['release_all', 'print_all', 'trash'].includes(action)) throw new HttpsError('invalid-argument', 'Geçersiz işlem.');
  const batchId = typeof req.data?.batchId === 'string' ? req.data.batchId : '';
  if (!/^BATCH-[A-Z0-9-]{3,40}$/.test(batchId)) throw new HttpsError('invalid-argument', 'Geçersiz parti.');
  const tagAction: TagAction = action === 'release_all' ? 'release' : action === 'print_all' ? 'mark_printed' : 'trash';
  const staff = await staffFor(req, tagAction);

  const tagsSnap = await db().collection('tags').where('batchId', '==', batchId).select('status', 'printed').get();
  if (tagsSnap.empty) throw new HttpsError('not-found', 'Partide QR bulunamadı.');
  const tags = tagsSnap.docs.map((d) => ({ code: d.id, stage: stageOf(d.get('status')), printed: d.get('printed') === true }));

  if (action === 'trash' && tags.some((t) => t.stage === 'active' || t.stage === 'disabled' || t.stage === 'expired')) {
    throw new HttpsError('failed-precondition', "Bu partide müşteriye bağlı ya da devre dışı QR'lar var; parti silinemez.");
  }
  const codes = tags.filter((t) => {
    if (action === 'release_all') return t.stage === 'in_stock';
    if (action === 'print_all') return (t.stage === 'in_stock' || t.stage === 'on_sale') && !t.printed;
    return t.stage === 'in_stock' || t.stage === 'on_sale';
  }).map((t) => t.code);
  if (!codes.length) return { done: 0, skipped: [] };
  return runTagAction(staff, codes, tagAction);
});

// ---------------------------------------------------------------------------
// Eski kayıtları yeni yapıya taşıma ve sayaçları yeniden hesaplama
// ---------------------------------------------------------------------------

/** Bir partinin sayaçlarını etiketlerinden yeniden hesaplar (işlem içinde: eşzamanlı değişiklikler kaybolmaz). */
export async function recountBatch(batchId: string): Promise<Record<string, number>> {
  return db().runTransaction(async (tx) => {
    const [tagsSnap, tombSnap] = await Promise.all([
      tx.get(db().collection('tags').where('batchId', '==', batchId)),
      tx.get(db().collection(TOMBSTONES).where('batchId', '==', batchId)),
    ]);
    const c: Record<string, number> = { in_stock: 0, on_sale: 0, active: 0, disabled: 0, expired: 0, trashed: 0, printed: 0, deleted: tombSnap.size };
    tagsSnap.docs.forEach((d) => {
      const stage = stageOf(d.get('status'));
      if (stage) c[stage] += 1;
      if (d.get('printed') === true) c.printed += 1;
    });
    tx.set(db().collection('production_batches').doc(batchId), { counts: c, countsUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return c;
  });
}

/**
 * Eski 'unclaimed' durumunu 'in_stock' yapar ve tüm partilerin sayaçlarını yeniden hesaplar.
 * Her eski kayıt "okunduğundan beri değişmediyse" koşuluyla güncellenir; arada biri işlem gördüyse
 * dokunulmaz (o kayıt zaten yeni yapıya geçmiş demektir).
 */
export async function recountAll(): Promise<{ batches: number; migrated: number }> {
  const legacySnap = await db().collection('tags').where('status', '==', 'unclaimed').select('printed').get();
  let migrated = 0;
  for (const d of legacySnap.docs) {
    const update: Record<string, unknown> = { status: 'in_stock', lastAction: 'migrated', updatedAtTs: FieldValue.serverTimestamp() };
    if (d.get('printed') === undefined) update.printed = false;
    try {
      await d.ref.update(update, { lastUpdateTime: d.updateTime });
      migrated += 1;
    } catch (e) {
      console.warn('[lifecycle] eski kayıt atlandı (arada değişmiş):', d.id, (e as Error)?.message);
    }
  }
  const [batchesSnap, tagsSnap] = await Promise.all([
    db().collection('production_batches').select().get(),
    db().collection('tags').select('batchId').get(),
  ]);
  const ids = new Set<string>(batchesSnap.docs.map((d) => d.id));
  tagsSnap.docs.forEach((d) => { const b = d.get('batchId'); if (typeof b === 'string' && b) ids.add(b); });
  for (const id of ids) await recountBatch(id);
  return { batches: ids.size, migrated };
}

/** Yeni yapıya ilk geçiş (bir kez). Panel açılınca çağrılır; yarıda kalmışsa 10 dakika sonra yeniden denenebilir. */
export const adminEnsureLifecycle = onCall({ timeoutSeconds: 540 }, async (req) => {
  await requireStaff(req, ['production', 'support', 'warehouse']);
  const meta = db().collection('stats_meta').doc('lifecycle_v1');
  const claimed = await db().runTransaction(async (tx) => {
    const m = await tx.get(meta);
    if (m.exists && m.get('doneAt')) return false;
    const started = m.get('startedAt');
    const startedMs = started && typeof started.toMillis === 'function' ? started.toMillis() : 0;
    if (m.exists && Date.now() - startedMs < 10 * 60 * 1000) return false; // başka bir çağrı şu an yapıyor
    tx.set(meta, { startedAt: FieldValue.serverTimestamp(), doneAt: null });
    return true;
  });
  if (!claimed) return { migrated: false };
  try {
    const r = await recountAll();
    await meta.set({ doneAt: FieldValue.serverTimestamp(), batches: r.batches, legacyTags: r.migrated }, { merge: true });
    return { migrated: true, batches: r.batches, legacyTags: r.migrated };
  } catch (e) {
    await meta.delete().catch(() => undefined);
    throw e;
  }
});

/** Sayaçlar bir şekilde kayarsa süper yönetici yeniden hesaplatabilir. */
export const adminRecountBatches = onCall({ timeoutSeconds: 300 }, async (req) => {
  const staff = await requireStaff(req, []);
  if (staff.role !== 'super_admin') throw new HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
  return recountAll();
});


/**
 * Akıllı Araç Kartı - Sunucu Fonksiyonları
 *
 * Temel kural: istemciye güvenilmez. QR etiketlerinin durumunu değiştiren,
 * etiketi araca bağlayan ve ziyaretçiye veri gösteren her işlem burada yapılır.
 * Araç sahibinin telefon numarası bu dosyadaki hiçbir yanıtta yer almaz.
 *
 * Koleksiyonlar:
 *   tags/{code}                      QR etiketi (code = QR'daki rastgele 12 karakter)
 *   vehicles/{vehicleId}             Araç (sahibine özel)
 *   vehicles/{vehicleId}/notices/*   Ziyaretçi bildirimleri
 *   production_batches/{batchId}     Üretim partileri
 *   tag_events/*                     Denetim kaydı (istemciye kapalı)
 *   rate_limits/*                    Hız sınırı sayaçları (istemciye kapalı)
 *   counters/*                       Parti numarası sayaçları (istemciye kapalı)
 */

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  LIMITS, MAX_BATCH_SIZE, NOTICE_NOTE_MAX, NOTICE_TYPES, NoticeType,
  PRODUCT_NAMES, PRODUCT_TYPES, ProductType, VEHICLE_PRODUCT,
} from './config';
import {
  clientIp, db, generateCode, maskPlate, parseCode, rateLimit, requireAuth,
  requireStaff, requireString, sanitizeNote, sha256, yearMonthIstanbul,
} from './helpers';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

type TagStatus = 'unclaimed' | 'active' | 'disabled' | 'expired';

const tagsCol = () => db().collection('tags');
const vehiclesCol = () => db().collection('vehicles');

function logEvent(tx: Transaction, data: Record<string, unknown>): void {
  const ref = db().collection('tag_events').doc();
  tx.set(ref, { ...data, at: FieldValue.serverTimestamp() });
}

// ===========================================================================
// 1) ZİYARETÇİ: QR okutulduğunda gösterilecek güvenli bilgi
// ===========================================================================

export const scanTag = onCall(async (req) => {
  const code = parseCode(req.data?.code);
  if (!code) return { status: 'not_found' };

  await rateLimit(`scan:ip:${clientIp(req)}`, LIMITS.scanPerIp[0], LIMITS.scanPerIp[1]);
  // IP başlığı istemci tarafından taklit edilebilir; etiket başına sınır taklit edilemez.
  await rateLimit(`scan:tag:${code}`, LIMITS.scanPerTag[0], LIMITS.scanPerTag[1]);

  const tagRef = tagsCol().doc(code);
  const snap = await tagRef.get();
  if (!snap.exists) return { status: 'not_found' };
  const tag = snap.data()!;
  if (tag.productType !== VEHICLE_PRODUCT) return { status: 'not_found' };

  // Okutma sayacı; hata olursa ziyaretçiyi etkilemesin.
  tagRef.update({ scanCount: FieldValue.increment(1), lastScanAt: FieldValue.serverTimestamp() })
    .catch(() => undefined);

  const status = tag.status as TagStatus;
  const isOwner = !!req.auth && req.auth.uid === tag.assignedUserId;

  if (status === 'disabled') return { status: 'disabled' };
  if (status === 'expired') return { status: 'expired', isOwner };
  if (status === 'unclaimed') return { status: 'unclaimed', serial: tag.tagId };

  if (!tag.assignedVehicleId) return { status: 'unassigned', isOwner };
  const vSnap = await vehiclesCol().doc(tag.assignedVehicleId).get();
  const v = vSnap.data();
  if (!vSnap.exists || !v || v.ownerUid !== tag.assignedUserId || v.tagCode !== code) {
    return { status: 'unassigned', isOwner };
  }

  return {
    status: 'active',
    isOwner,
    vehicle: {
      plateMasked: maskPlate(v.plateNumber),
      brandModel: typeof v.brandModel === 'string' ? v.brandModel : '',
      parkingNote: typeof v.parkingNote === 'string' ? v.parkingNote : '',
      allowMessages: v.allowMessages !== false,
    },
  };
});

// ===========================================================================
// 2) ZİYARETÇİ: Araç sahibine anonim hazır bildirim
// ===========================================================================

export const sendNotice = onCall(async (req) => {
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('not-found', 'Etiket bulunamadı.');
  const type = req.data?.type as NoticeType;
  if (!NOTICE_TYPES.includes(type)) throw new HttpsError('invalid-argument', 'Geçersiz bildirim tipi.');
  const note = sanitizeNote(req.data?.note, NOTICE_NOTE_MAX);
  if (type === 'other' && !note) throw new HttpsError('invalid-argument', 'Lütfen kısa bir not yazın.');

  const ip = clientIp(req);
  const busy = 'Kısa sürede çok fazla bildirim gönderildi. Lütfen biraz sonra tekrar deneyin.';
  await rateLimit(`notice:ip:${ip}`, LIMITS.noticePerIp[0], LIMITS.noticePerIp[1], busy);
  await rateLimit(`notice:tag:${code}`, LIMITS.noticePerTag[0], LIMITS.noticePerTag[1], busy);
  await rateLimit(`notice:iptag:${ip}:${code}`, LIMITS.noticePerIpTag[0], LIMITS.noticePerIpTag[1], busy);

  const tagSnap = await tagsCol().doc(code).get();
  const tag = tagSnap.data();
  if (!tagSnap.exists || !tag || tag.status !== 'active' || !tag.assignedVehicleId) {
    throw new HttpsError('failed-precondition', 'Bu etiket şu anda bildirim almıyor.');
  }
  const vRef = vehiclesCol().doc(tag.assignedVehicleId);
  const vSnap = await vRef.get();
  const v = vSnap.data();
  if (!vSnap.exists || !v || v.tagCode !== code || v.allowMessages === false) {
    throw new HttpsError('failed-precondition', 'Araç sahibi şu anda bildirim almıyor.');
  }

  await vRef.collection('notices').add({
    type,
    note,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    // Kötüye kullanımı engellemek için: IP açık saklanmaz, etikete özel özet tutulur.
    senderHash: sha256(`${ip}:${code}`).slice(0, 16),
  });
  await vRef.update({ unreadNotices: FieldValue.increment(1), lastNoticeAt: FieldValue.serverTimestamp() });

  return { ok: true };
});

// ===========================================================================
// 3) ARAÇ SAHİBİ: QR etiketini araca bağla
// ===========================================================================

export const claimTag = onCall(async (req) => {
  const { uid, email } = requireAuth(req);
  const code = parseCode(req.data?.code);
  if (!code) return { result: 'NOT_OURS' };
  const vehicleId = requireString(req.data?.vehicleId, 'vehicleId', 128);

  await rateLimit(`claim:uid:${uid}`, LIMITS.claimPerUser[0], LIMITS.claimPerUser[1]);

  return db().runTransaction(async (tx) => {
    const tagRef = tagsCol().doc(code);
    const vRef = vehiclesCol().doc(vehicleId);
    const [tagSnap, vSnap] = await Promise.all([tx.get(tagRef), tx.get(vRef)]);

    const v = vSnap.data();
    if (!vSnap.exists || !v || v.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Araç bulunamadı.');
    }
    if (!tagSnap.exists) return { result: 'NOT_OURS' };
    const tag = tagSnap.data()!;

    if (tag.productType !== VEHICLE_PRODUCT) return { result: 'WRONG_PRODUCT' };
    if (tag.status === 'disabled') return { result: 'DISABLED' };
    if (tag.status === 'expired') return { result: 'EXPIRED' };
    if (tag.assignedUserId && tag.assignedUserId !== uid) return { result: 'OWNED_BY_OTHER' };
    if (tag.assignedUserId === uid && tag.assignedVehicleId === vehicleId) return { result: 'ALREADY_LINKED' };
    if (v.tagCode && v.tagCode !== code) return { result: 'VEHICLE_HAS_TAG' };

    // Etiket bu kullanıcının başka bir aracındaysa oradan alınır (taşıma).
    let oldVehicleRef: DocumentReference | null = null;
    if (tag.assignedUserId === uid && tag.assignedVehicleId && tag.assignedVehicleId !== vehicleId) {
      const ref = vehiclesCol().doc(tag.assignedVehicleId);
      const oldSnap = await tx.get(ref);
      if (oldSnap.exists && oldSnap.data()?.tagCode === code) oldVehicleRef = ref;
    }

    const now = new Date().toISOString();
    tx.update(tagRef, {
      status: 'active',
      assignedUserId: uid,
      assignedUserEmail: email,
      assignedVehicleId: vehicleId,
      assignedPlate: v.plateNumber || null,
      activatedAt: tag.activatedAt || now,
      updatedAtTs: FieldValue.serverTimestamp(),
    });
    tx.update(vRef, { tagCode: code, tagSerial: tag.tagId || null, updatedAt: FieldValue.serverTimestamp() });
    if (oldVehicleRef) {
      tx.update(oldVehicleRef, { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
    }
    logEvent(tx, { code, action: oldVehicleRef ? 'moved' : 'claimed', by: uid, vehicleId });
    return { result: 'OK', serial: tag.tagId || null };
  });
});

// ===========================================================================
// 4) ARAÇ SAHİBİ: Etiketi araçtan ayır (etiket kullanıcıda kalır)
// ===========================================================================

export const unlinkTag = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const vehicleId = requireString(req.data?.vehicleId, 'vehicleId', 128);

  return db().runTransaction(async (tx) => {
    const vRef = vehiclesCol().doc(vehicleId);
    const vSnap = await tx.get(vRef);
    const v = vSnap.data();
    if (!vSnap.exists || !v || v.ownerUid !== uid) throw new HttpsError('permission-denied', 'Araç bulunamadı.');
    if (!v.tagCode) return { result: 'NO_TAG' };

    const tagRef = tagsCol().doc(v.tagCode);
    const tagSnap = await tx.get(tagRef);
    if (tagSnap.exists && tagSnap.data()?.assignedVehicleId === vehicleId) {
      tx.update(tagRef, { assignedVehicleId: null, assignedPlate: null, updatedAtTs: FieldValue.serverTimestamp() });
    }
    tx.update(vRef, { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
    logEvent(tx, { code: v.tagCode, action: 'unlinked', by: uid, vehicleId });
    return { result: 'OK' };
  });
});

// ===========================================================================
// 5) ARAÇ SAHİBİ: Kayıp / çalıntı bildirimi (etiket kalıcı olarak kapanır)
// ===========================================================================

export const reportTagLost = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('invalid-argument', 'Geçersiz etiket.');

  return db().runTransaction(async (tx) => {
    const tagRef = tagsCol().doc(code);
    const tagSnap = await tx.get(tagRef);
    const tag = tagSnap.data();
    if (!tagSnap.exists || !tag || tag.assignedUserId !== uid) {
      throw new HttpsError('permission-denied', 'Bu etiket size ait değil.');
    }
    let vRef: DocumentReference | null = null;
    if (tag.assignedVehicleId) {
      const ref = vehiclesCol().doc(tag.assignedVehicleId);
      const vSnap = await tx.get(ref);
      if (vSnap.exists && vSnap.data()?.tagCode === code) vRef = ref;
    }
    tx.update(tagRef, {
      status: 'disabled',
      disabledReason: 'lost',
      assignedVehicleId: null,
      updatedAtTs: FieldValue.serverTimestamp(),
    });
    if (vRef) tx.update(vRef, { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
    logEvent(tx, { code, action: 'reported_lost', by: uid });
    return { result: 'OK' };
  });
});

// ===========================================================================
// 6) YÖNETİCİ: Üretim partisi ve etiketleri oluştur
// ===========================================================================

export const adminCreateBatch = onCall({ timeoutSeconds: 120 }, async (req) => {
  const staff = await requireStaff(req, ['production']);
  await rateLimit(`admin:batch:${staff.uid}`, LIMITS.adminBatchPerUser[0], LIMITS.adminBatchPerUser[1]);

  const productType = req.data?.productType as ProductType;
  if (!PRODUCT_TYPES.includes(productType)) throw new HttpsError('invalid-argument', 'Geçersiz ürün tipi.');
  const count = Number(req.data?.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_SIZE) {
    throw new HttpsError('invalid-argument', `Adet 1 ile ${MAX_BATCH_SIZE} arasında olmalıdır.`);
  }
  const notes = typeof req.data?.notes === 'string' && req.data.notes.trim()
    ? req.data.notes.trim().slice(0, 200)
    : 'Standart Matbaa Üretimi';

  const prefix = 'HF';
  const yearMonth = yearMonthIstanbul();
  const nowIso = new Date().toISOString();

  // Parti numarasını çakışmasız ayır.
  const counterRef = db().collection('counters').doc(`batch_${yearMonth}_${productType}`);
  const batchIndex = await db().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? Number(snap.data()?.value) || 0 : 0) + 1;
    tx.set(counterRef, { value: next });
    return next;
  });
  const batchNumber = `B${String(batchIndex).padStart(2, '0')}`;
  const batchId = `BATCH-${yearMonth}-${productType}-${batchNumber}`;

  await db().collection('production_batches').doc(batchId).create({
    id: batchId,
    batchNumber,
    productType,
    productName: PRODUCT_NAMES[productType],
    prefix,
    yearMonth,
    totalCount: count,
    status: 'STATUS_CREATED',
    notes,
    createdBy: staff.email,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdAtFirestore: FieldValue.serverTimestamp(),
  });

  // Etiketler 400'lük gruplar halinde yazılır (Firestore toplu yazma sınırı 500).
  const CHUNK = 400;
  for (let start = 1; start <= count; start += CHUNK) {
    const wb = db().batch();
    const end = Math.min(count, start + CHUNK - 1);
    for (let i = start; i <= end; i++) {
      const code = generateCode();
      wb.create(tagsCol().doc(code), {
        code,
        tagId: `${prefix}-${productType}-${yearMonth}-${batchNumber}-${String(i).padStart(4, '0')}`,
        batchId,
        batchNumber: `${batchId} (${notes})`,
        productType,
        sequenceNumber: i,
        status: 'unclaimed',
        assignedUserId: null,
        assignedUserEmail: null,
        assignedVehicleId: null,
        assignedPlate: null,
        activatedAt: null,
        disabledReason: null,
        notes: '',
        scanCount: 0,
        lastScanAt: null,
        createdAt: nowIso,
        updatedAtTs: FieldValue.serverTimestamp(),
      });
    }
    await wb.commit();
  }

  await db().collection('tag_events').add({
    action: 'batch_created', batchId, count, by: staff.uid, at: FieldValue.serverTimestamp(),
  });
  return { batchId, count };
});

// ===========================================================================
// 7) YÖNETİCİ: Etiket durumunu değiştir
//    disable  -> kullanıma kapat (sahibi kayıtlı kalır, geri açılabilir)
//    enable   -> yeniden aç
//    expire   -> hizmet süresi doldu
//    reset    -> sahiplik ve araç bağı silinir, etiket tekrar stoğa döner
// ===========================================================================

export const adminSetTagStatus = onCall(async (req) => {
  const staff = await requireStaff(req, ['support']);
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('invalid-argument', 'Geçersiz etiket.');
  const action = req.data?.action as 'disable' | 'enable' | 'expire' | 'reset';
  if (!['disable', 'enable', 'expire', 'reset'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Geçersiz işlem.');
  }
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 300) : undefined;

  return db().runTransaction(async (tx) => {
    const tagRef = tagsCol().doc(code);
    const tagSnap = await tx.get(tagRef);
    const tag = tagSnap.data();
    if (!tagSnap.exists || !tag) throw new HttpsError('not-found', 'Etiket bulunamadı.');

    let vRef: DocumentReference | null = null;
    if (action === 'reset' && tag.assignedVehicleId) {
      const ref = vehiclesCol().doc(tag.assignedVehicleId);
      const vSnap = await tx.get(ref);
      if (vSnap.exists && vSnap.data()?.tagCode === code) vRef = ref;
    }

    const update: Record<string, unknown> = { updatedAtTs: FieldValue.serverTimestamp() };
    if (note !== undefined) update.notes = note;

    if (action === 'disable') {
      update.status = 'disabled';
      update.disabledReason = 'admin';
    } else if (action === 'enable') {
      update.status = tag.assignedUserId ? 'active' : 'unclaimed';
      update.disabledReason = null;
    } else if (action === 'expire') {
      update.status = 'expired';
    } else {
      Object.assign(update, {
        status: 'unclaimed',
        assignedUserId: null,
        assignedUserEmail: null,
        assignedVehicleId: null,
        assignedPlate: null,
        activatedAt: null,
        disabledReason: null,
      });
      if (vRef) tx.update(vRef, { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
    }

    tx.update(tagRef, update);
    logEvent(tx, { code, action: `admin_${action}`, by: staff.uid, byEmail: staff.email, note: note || null });
    return { result: 'OK', status: update.status };
  });
});

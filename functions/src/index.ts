/**
 * Akıllı Araç Kartı - Sunucu Fonksiyonları
 *
 * Temel kural: istemciye güvenilmez. QR etiketlerinin durumunu değiştiren,
 * etiketi araca bağlayan ve ziyaretçiye veri gösteren her işlem burada yapılır.
 * Araç sahibinin telefon numarası bu dosyadaki hiçbir yanıtta yer almaz.
 *
 * QR yaşam döngüsü kuralları için lifecycle.ts dosyasına bakın.
 *
 * Koleksiyonlar:
 *   tags/{code}                      QR etiketi (code = QR'daki rastgele 12 karakter)
 *   vehicles/{vehicleId}             Araç (sahibine özel)
 *   vehicles/{vehicleId}/notices/*   Ziyaretçi bildirimleri
 *   production_batches/{batchId}     Üretim partileri
 *   tag_events/*                     Denetim kaydı (istemciye kapalı)
 *   rate_limits/*                    Hız sınırı sayaçları (istemciye kapalı)
 *   counters/*                       Parti numarası sayaçları (istemciye kapalı)
 *   stats_daily/*, stats_shards/*    Günlük istatistik sayaçları (bkz. stats.ts)
 *   scan_alerts/*                    Şüpheli okutma uyarıları (istemciye kapalı)
 */

import './setup'; // bölge ayarı: her şeyden önce yüklenmeli
import { FieldValue, DocumentReference, Transaction } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import {
  LIMITS, MAX_BATCH_SIZE, NOTICE_NOTE_MAX, NOTICE_TEXT, NOTICE_TYPES, NoticeType,
  PRODUCT_NAMES, PRODUCT_TYPES, ProductType, VEHICLE_PRODUCT,
} from './config';
import {
  clientIp, db, generateCode, maskPlate, parseCode, rateLimit, requireAuth,
  requireString, sanitizeNote, sha256, yearMonthIstanbul,
} from './helpers';
import { sendPushToUser } from './push';
import { addDays, bumpStat, dayKey, rollupShards } from './stats';

import { ACTION_PERM, TOMBSTONES, applyTagCounts, runTagAction, snap, stageOf } from './lifecycle';

export { adminOverview, adminPeriodSeries } from './overview';
export { adminTagAction, adminBatchAction, adminEnsureLifecycle, adminRecountBatches } from './lifecycle';
export {
  syncMyAccount, deleteMyAccount, adminEnsureDirectory, nightlyDirectory,
  adminListUsers, adminUserStats, adminGetUser, adminListDeletedAccounts,
  adminListVehicles, adminVehicleStats, adminGetVehicle, adminDeleteUser,
} from './directory';
export {
  staffSignIn, adminTeamOverview, adminTeamMember, adminTeamAddMember, adminTeamUpdateMember, adminTeamRemoveMember,
  adminTeamRevokeSessions, adminTeamSavePosition, adminTeamDeletePosition, adminLiftLimit, adminMyQuota,
} from './team';
import { refreshQuietly } from './directory';
import { requirePerm } from './permissions';


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
  const tagSnap = await tagRef.get();
  if (!tagSnap.exists) {
    // Kalıcı silinmiş QR: "bizim değil" yerine "kapatılmış" denir (basılmış eski etiket yanıltmasın).
    const tomb = await db().collection(TOMBSTONES).doc(code).get();
    return { status: tomb.exists ? 'disabled' : 'not_found' };
  }
  const tag = tagSnap.data()!;
  if (tag.productType !== VEHICLE_PRODUCT) return { status: 'not_found' };

  // Okutma sayacı ve saatlik yoğunluk takibi; hata olursa ziyaretçiyi etkilemesin.
  const hourKey = new Date().toISOString().slice(0, 13);
  const hourCount = tag.scanHourKey === hourKey ? (Number(tag.scanHourCount) || 0) + 1 : 1;
  // Günlük okutma sayısı (yönetici panelindeki son 30 gün grafiği); 40 günden eski günler silinir.
  const today = dayKey();
  const oldest = addDays(today, -40);
  const scanUpdate: Record<string, unknown> = {
    scanCount: FieldValue.increment(1),
    lastScanAt: FieldValue.serverTimestamp(),
    scanHourKey: hourKey,
    scanHourCount: hourCount,
    [`scanDays.${today}`]: FieldValue.increment(1),
  };
  Object.keys((tag.scanDays || {}) as Record<string, number>).forEach((k) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k < oldest) scanUpdate[`scanDays.${k}`] = FieldValue.delete();
  });
  tagRef.update(scanUpdate).catch(() => undefined);
  if (hourCount === LIMITS.scanAlertPerHour) {
    // Kopyalanmış ya da kötüye kullanılan etiket şüphesi: Genel Bakış'ta uyarı olarak görünür.
    const alert = { code, serial: tag.tagId || null, count: hourCount, at: FieldValue.serverTimestamp() };
    db().collection('scan_alerts').add(alert).catch(() => undefined);
    db().collection('tag_events').add({ action: 'scan_alert', code, by: null, count: hourCount, at: FieldValue.serverTimestamp() })
      .catch(() => undefined);
  }
  await bumpStat('scans');

  const stage = stageOf(tag.status);
  const isOwner = !!req.auth && req.auth.uid === tag.assignedUserId;

  if (stage === 'disabled' || stage === 'trashed' || !stage) return { status: 'disabled' };
  if (stage === 'expired') return { status: 'expired', isOwner };
  // Depodaki (satışa çıkmamış) QR çalışmaz.
  if (stage === 'in_stock') return { status: 'not_activated' };
  // Satış standındaki QR: sahibi henüz bağlamamış.
  if (stage === 'on_sale') return { status: 'unclaimed', serial: tag.tagId };

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

  // Araç sahibinin telefonuna anlık bildirim (ücretsiz web push).
  const plate = maskPlate(v.plateNumber);
  await Promise.all([
    bumpStat('notices'),
    db().collection('tag_events').add({
      action: 'notice_sent', code, vehicleId: tag.assignedVehicleId, plateMasked: plate, noticeType: type,
      by: req.auth?.uid || null, at: FieldValue.serverTimestamp(),
    }).catch(() => undefined),
  ]);
  await sendPushToUser(v.ownerUid, {
    title: `🚗 ${plate || 'Aracınız'}`,
    body: note ? `${NOTICE_TEXT[type]}: "${note.slice(0, 100)}"` : NOTICE_TEXT[type],
    url: '/?view=vehicle',
    tag: `arac-${tag.assignedVehicleId}`,
  });

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

  let firstLink = false;
  const result = await db().runTransaction(async (tx) => {
    firstLink = false;
    const tagRef = tagsCol().doc(code);
    const vRef = vehiclesCol().doc(vehicleId);
    const [tagSnap, vSnap] = await Promise.all([tx.get(tagRef), tx.get(vRef)]);

    const v = vSnap.data();
    if (!vSnap.exists || !v || v.ownerUid !== uid) {
      throw new HttpsError('permission-denied', 'Araç bulunamadı.');
    }
    if (!tagSnap.exists) {
      const tomb = await tx.get(db().collection(TOMBSTONES).doc(code));
      return { result: tomb.exists ? 'DISABLED' : 'NOT_OURS' };
    }
    const tag = tagSnap.data()!;
    const stage = stageOf(tag.status);

    if (tag.productType !== VEHICLE_PRODUCT) return { result: 'WRONG_PRODUCT' };
    if (stage === 'disabled' || stage === 'trashed' || !stage) return { result: 'DISABLED' };
    if (stage === 'expired') return { result: 'EXPIRED' };
    if (stage === 'in_stock') return { result: 'NOT_ACTIVATED' };
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
    applyTagCounts(tx, tag.batchId, snap(tag), { stage: 'active', printed: tag.printed === true });
    tx.update(tagRef, {
      status: 'active',
      stageChangedAt: FieldValue.serverTimestamp(),
      lastAction: oldVehicleRef ? 'moved' : 'claimed',
      lastActionBy: email,
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
    // Yalnızca satış standından ilk bağlama sayılır (ayırıp yeniden bağlamak sayılmaz).
    firstLink = stage === 'on_sale';
    return { result: 'OK', serial: tag.tagId || null };
  });
  if (result.result === 'OK' && firstLink) await bumpStat('claims');
  if (result.result === 'OK') await refreshQuietly([uid]);
  return result;
});

// ===========================================================================
// 4) ARAÇ SAHİBİ: Etiketi araçtan ayır (etiket kullanıcıda kalır)
// ===========================================================================

export const unlinkTag = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const vehicleId = requireString(req.data?.vehicleId, 'vehicleId', 128);

  const out = await db().runTransaction(async (tx) => {
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
  if (out.result === 'OK') await refreshQuietly([uid]);
  return out;
});

// ===========================================================================
// 5) ARAÇ SAHİBİ: Kayıp / çalıntı bildirimi (etiket kalıcı olarak kapanır)
// ===========================================================================

export const reportTagLost = onCall(async (req) => {
  const { uid } = requireAuth(req);
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('invalid-argument', 'Geçersiz etiket.');

  const out = await db().runTransaction(async (tx) => {
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
    const lostStage = stageOf(tag.status);
    // Zaten kullanım dışıysa (devre dışı / süresi dolmuş / çöpte) yapılacak bir şey yok.
    if (lostStage !== 'active') return { result: 'OK' };
    applyTagCounts(tx, tag.batchId, snap(tag), { stage: 'disabled', printed: tag.printed === true });
    tx.update(tagRef, {
      status: 'disabled',
      disabledReason: 'lost',
      disabledFrom: 'active',
      disabledAt: FieldValue.serverTimestamp(),
      disabledBy: null,
      assignedVehicleId: null,
      stageChangedAt: FieldValue.serverTimestamp(),
      lastAction: 'reported_lost',
      updatedAtTs: FieldValue.serverTimestamp(),
    });
    if (vRef) tx.update(vRef, { tagCode: null, tagSerial: null, updatedAt: FieldValue.serverTimestamp() });
    logEvent(tx, { code, action: 'reported_lost', by: uid });
    return { result: 'OK' };
  });
  await refreshQuietly([uid]);
  return out;
});

// ===========================================================================
// 6) YÖNETİCİ: Üretim partisi ve etiketleri oluştur
// ===========================================================================

export const adminCreateBatch = onCall({ timeoutSeconds: 120 }, async (req) => {
  const staff = await requirePerm(req, 'act.batch_create');
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

  // Parti numarasını çakışmasız ayır ve parti kaydını aynı işlemde oluştur.
  // Eski sistemden kalan aynı adlı partiler (örn. BATCH-2610-OQ-B01) atlanır.
  const counterRef = db().collection('counters').doc(`batch_${yearMonth}_${productType}`);
  const batchesCol = db().collection('production_batches');
  const { batchId, batchNumber } = await db().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    let index = (snap.exists ? Number(snap.data()?.value) || 0 : 0) + 1;
    for (let attempt = 0; attempt < 99; attempt++, index++) {
      const number = `B${String(index).padStart(2, '0')}`;
      const id = `BATCH-${yearMonth}-${productType}-${number}`;
      const existing = await tx.get(batchesCol.doc(id));
      if (existing.exists) continue;
      tx.set(counterRef, { value: index });
      tx.create(batchesCol.doc(id), {
        id,
        batchNumber: number,
        productType,
        productName: PRODUCT_NAMES[productType],
        prefix,
        yearMonth,
        totalCount: count,
        status: 'STATUS_CREATED',
        // Sayaçlar 0 başlar; etiketler yazıldıkça aynı toplu yazmada artırılır (yarıda kalırsa tutarlı kalır).
        counts: { in_stock: 0, on_sale: 0, active: 0, disabled: 0, expired: 0, trashed: 0, printed: 0, deleted: 0 },
        notes,
        createdBy: staff.email,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdAtFirestore: FieldValue.serverTimestamp(),
      });
      return { batchId: id, batchNumber: number };
    }
    throw new HttpsError('resource-exhausted', 'Bu ay için boş parti numarası bulunamadı.');
  });

  // Kodları üret: mevcut etiketlerle ve kalıcı silinmiş kodlarla çakışanlar yeniden üretilir.
  const codes: string[] = [];
  const seen = new Set<string>();
  while (codes.length < count) {
    const need = count - codes.length;
    const candidates: string[] = [];
    while (candidates.length < need) {
      const c = generateCode();
      if (!seen.has(c)) { seen.add(c); candidates.push(c); }
    }
    for (let i = 0; i < candidates.length; i += 300) {
      const part = candidates.slice(i, i + 300);
      const [existing, tombs] = await Promise.all([
        db().getAll(...part.map((c) => tagsCol().doc(c))),
        db().getAll(...part.map((c) => db().collection(TOMBSTONES).doc(c))),
      ]);
      part.forEach((c, idx) => { if (!existing[idx].exists && !tombs[idx].exists) codes.push(c); });
    }
  }

  // Etiketler 400'lük gruplar halinde yazılır (Firestore toplu yazma sınırı 500).
  // Yeni QR'lar DEPODA başlar: satışa çıkarılana kadar müşteri bağlayamaz.
  const CHUNK = 400;
  for (let start = 1; start <= count; start += CHUNK) {
    const wb = db().batch();
    const end = Math.min(count, start + CHUNK - 1);
    wb.set(batchesCol.doc(batchId), { counts: { in_stock: FieldValue.increment(end - start + 1) } }, { merge: true });
    for (let i = start; i <= end; i++) {
      const code = codes[i - 1];
      wb.create(tagsCol().doc(code), {
        code,
        tagId: `${prefix}-${productType}-${yearMonth}-${batchNumber}-${String(i).padStart(4, '0')}`,
        batchId,
        batchNumber: `${batchId} (${notes})`,
        productType,
        sequenceNumber: i,
        status: 'in_stock',
        printed: false,
        assignedUserId: null,
        assignedUserEmail: null,
        assignedVehicleId: null,
        assignedPlate: null,
        activatedAt: null,
        disabledReason: null,
        notes: '',
        scanCount: 0,
        lastScanAt: null,
        lastAction: 'created',
        lastActionBy: staff.email,
        stageChangedAt: FieldValue.serverTimestamp(),
        createdAt: nowIso,
        updatedAtTs: FieldValue.serverTimestamp(),
      });
    }
    await wb.commit();
  }

  await db().collection('tag_events').add({
    action: 'batch_created', batchId, count, by: staff.uid, byEmail: staff.email, at: FieldValue.serverTimestamp(),
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
  // Eski panel sürümleriyle uyum için korunur; yeni panel adminTagAction kullanır.
  const code = parseCode(req.data?.code);
  if (!code) throw new HttpsError('invalid-argument', 'Geçersiz etiket.');
  const action = req.data?.action as 'disable' | 'enable' | 'expire' | 'reset';
  if (!['disable', 'enable', 'expire', 'reset'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Geçersiz işlem.');
  }
  const staff = await requirePerm(req, ACTION_PERM[action]);
  const note = typeof req.data?.note === 'string' ? req.data.note.trim().slice(0, 300) : undefined;
  const r = await runTagAction(staff, [code], action, note);
  if (!r.done) throw new HttpsError('failed-precondition', r.skipped[0]?.reason || 'İşlem uygulanamadı.');
  const after = await tagsCol().doc(code).get();
  return { result: 'OK', status: after.get('status') };
});

// ===========================================================================
// 8) ARAÇ SAHİBİ: Bu hesabın cihazlarına deneme bildirimi
// ===========================================================================

export const sendTestPush = onCall(async (req) => {
  const { uid } = requireAuth(req);
  await rateLimit(`push:test:${uid}`, LIMITS.testPushPerUser[0], LIMITS.testPushPerUser[1],
    'Çok fazla deneme bildirimi gönderildi. Lütfen biraz sonra tekrar deneyin.');
  const sent = await sendPushToUser(uid, {
    title: '🔔 Bildirimler açık',
    body: 'Aracınızın QR kodu okutulup bildirim gönderildiğinde bu şekilde haber vereceğiz.',
    url: '/?view=vehicle',
    tag: 'test',
  });
  return { sent };
});

// ===========================================================================
// 9) ZAMANLANMIŞ: Günlük sayaç parçalarını her gece tek belgede topla
// ===========================================================================

export const rollupDailyStats = onSchedule(
  { schedule: '15 0 * * *', timeZone: 'Europe/Istanbul', retryCount: 3 },
  async () => {
    const days = await rollupShards(dayKey());
    console.log(`[stats] ${days} gün toplandı`);
  },
);

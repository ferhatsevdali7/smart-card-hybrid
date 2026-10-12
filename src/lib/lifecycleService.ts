// QR yaşam döngüsü: Depo → Satış standı → QR bankası · Devre dışı · Çöp kutusu
// Okuma doğrudan Firestore'dan (kurallar yalnızca yöneticilere izin verir),
// her değişiklik Cloud Functions üzerinden yapılır (bkz. functions/src/lifecycle.ts).

import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { auth, db } from './firebase';
import {
  adminBatchActionFn, adminCreateBatchFn, adminEnsureLifecycleFn, adminTagActionFn, formatCode, tagUrl,
} from './functionsClient';
import { generateLogodQrSvg } from './qrVectorEngine';
import { buildZip, downloadBlob, ZipEntry } from './zip';
import { has } from './access';

export type Stage = 'in_stock' | 'on_sale' | 'active' | 'disabled' | 'expired' | 'trashed';
export const STAGES: Stage[] = ['in_stock', 'on_sale', 'active', 'disabled', 'expired', 'trashed'];

export type TagAction =
  | 'release' | 'unrelease' | 'mark_printed' | 'unmark_printed'
  | 'trash' | 'restore' | 'disable' | 'enable' | 'expire' | 'reset' | 'purge';

export interface LTag {
  code: string;
  tagId: string;
  batchId: string;
  sequenceNumber: number;
  stage: Stage;
  printed: boolean;
  assignedPlate: string | null;
  assignedUserEmail: string | null;
  scanCount: number;
  lastAction: string | null;
  lastActionBy: string | null;
  stageChangedAt: Date | null;
  createdAt: Date | null;
  releasedAt: Date | null;
  activatedAt: Date | null;
  trashedFrom: Stage | null;
  trashedAt: Date | null;
  trashedBy: string | null;
  disabledReason: 'lost' | 'admin' | 'expired' | 'account_deleted' | null;
  disabledAt: Date | null;
  disabledBy: string | null;
  /** Hesabı silinen müşterinin QR'ı: yeniden açılamaz, depoya dönemez */
  permanent: boolean;
}

export interface BatchCounts {
  in_stock: number; on_sale: number; active: number; disabled: number; expired: number; trashed: number; printed: number; deleted: number;
}

export interface LBatch {
  id: string;
  productType: string;
  totalCount: number;
  notes: string;
  createdAt: Date | null;
  createdBy: string;
  counts: BatchCounts | null;
}

export const EMPTY_COUNTS: BatchCounts = { in_stock: 0, on_sale: 0, active: 0, disabled: 0, expired: 0, trashed: 0, printed: 0, deleted: 0 };

/** Partide hâlâ duran (kalıcı silinmemiş) QR sayısı */
export function liveCount(c: BatchCounts | null): number {
  if (!c) return 0;
  return c.in_stock + c.on_sale + c.active + c.disabled + c.expired + c.trashed;
}

/** Parti çöpe atılabilir mi: müşteride (bankada / devre dışında) QR yoksa */
export function batchDeletable(b: LBatch): boolean {
  const c = b.counts;
  return !!c && c.active + c.disabled + c.expired === 0 && c.in_stock + c.on_sale > 0;
}

// ------------------------------------------------------------------ dönüştürme

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  const t = v as { toDate?: () => Date };
  return typeof t.toDate === 'function' ? t.toDate() : null;
}

export function normalizeStage(status: unknown): Stage {
  if (status === 'unclaimed') return 'in_stock';
  return STAGES.includes(status as Stage) ? (status as Stage) : 'in_stock';
}

function toTag(id: string, d: Record<string, unknown>): LTag {
  const reason = d.disabledReason;
  return {
    code: id,
    tagId: String(d.tagId || id),
    batchId: String(d.batchId || ''),
    sequenceNumber: Number(d.sequenceNumber) || 0,
    stage: normalizeStage(d.status),
    printed: d.printed === true,
    assignedPlate: (d.assignedPlate as string) || null,
    assignedUserEmail: (d.assignedUserEmail as string) || null,
    scanCount: Number(d.scanCount) || 0,
    lastAction: (d.lastAction as string) || null,
    lastActionBy: (d.lastActionBy as string) || null,
    stageChangedAt: toDate(d.stageChangedAt) || toDate(d.updatedAtTs) || toDate(d.createdAt),
    createdAt: toDate(d.createdAt),
    releasedAt: toDate(d.releasedAt),
    activatedAt: toDate(d.activatedAt),
    trashedFrom: d.trashedFrom ? normalizeStage(d.trashedFrom) : null,
    trashedAt: toDate(d.trashedAt),
    trashedBy: (d.trashedBy as string) || null,
    disabledReason: reason === 'lost' || reason === 'admin' || reason === 'expired' || reason === 'account_deleted' ? reason : (d.status === 'expired' ? 'expired' : null),
    disabledAt: toDate(d.disabledAt) || toDate(d.updatedAtTs),
    disabledBy: (d.disabledBy as string) || null,
    permanent: d.permanentlyDisabled === true || reason === 'account_deleted',
  };
}

function toBatch(id: string, d: Record<string, unknown>): LBatch {
  const c = d.counts as Partial<BatchCounts> | undefined;
  return {
    id,
    productType: String(d.productType || 'OQ'),
    totalCount: Number(d.totalCount) || 0,
    notes: String(d.notes || ''),
    createdAt: toDate(d.createdAtFirestore) || toDate(d.createdAt),
    createdBy: String(d.createdBy || ''),
    counts: c ? { ...EMPTY_COUNTS, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])) } as BatchCounts : null,
  };
}

// ------------------------------------------------------------------ canlı dinleme

type Unsub = () => void;

export function listenBatches(onData: (list: LBatch[]) => void, onError?: (e: Error) => void): Unsub {
  return onSnapshot(
    collection(db, 'production_batches'),
    (snap) => {
      const list = snap.docs.map((d) => toBatch(d.id, d.data()));
      list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0) || b.id.localeCompare(a.id));
      onData(list);
    },
    (e) => onError?.(e),
  );
}

function sortTags(list: LTag[]): LTag[] {
  return list.sort((a, b) => a.batchId.localeCompare(b.batchId) || a.sequenceNumber - b.sequenceNumber || a.tagId.localeCompare(b.tagId));
}

export function listenBatchTags(batchId: string, onData: (list: LTag[]) => void, onError?: (e: Error) => void): Unsub {
  return onSnapshot(
    query(collection(db, 'tags'), where('batchId', '==', batchId)),
    (snap) => onData(sortTags(snap.docs.map((d) => toTag(d.id, d.data())))),
    (e) => onError?.(e),
  );
}

/** Belirli aşamalardaki QR'lar (Satış standı, QR bankası, Devre dışı, Çöp kutusu sayfaları) */
export function listenTagsByStage(stages: Stage[], onData: (list: LTag[]) => void, onError?: (e: Error) => void): Unsub {
  return onSnapshot(
    query(collection(db, 'tags'), where('status', 'in', stages)),
    (snap) => onData(sortTags(snap.docs.map((d) => toTag(d.id, d.data())))),
    (e) => onError?.(e),
  );
}

/** Partilerin QR'larını bir kez okur (liste sayfasından ZIP indirirken). */
export async function fetchBatchTags(batchIds: string[]): Promise<LTag[]> {
  const out: LTag[] = [];
  for (let i = 0; i < batchIds.length; i += 10) {
    const snap = await getDocs(query(collection(db, 'tags'), where('batchId', 'in', batchIds.slice(i, i + 10))));
    snap.docs.forEach((d) => out.push(toTag(d.id, d.data())));
  }
  return sortTags(out);
}

// ------------------------------------------------------------------ işlemler

export interface ActionResult { done: number; skipped: { code: string; reason: string }[] }

/** Seçili QR'lara işlem uygular (500'lük parçalar halinde). */
export async function tagAction(codes: string[], action: TagAction, note?: string, reason?: string): Promise<ActionResult> {
  const out: ActionResult = { done: 0, skipped: [] };
  for (let i = 0; i < codes.length; i += 500) {
    const r = await adminTagActionFn({ codes: codes.slice(i, i + 500), action, note, reason });
    out.done += r.done;
    out.skipped.push(...r.skipped);
  }
  return out;
}

export function batchAction(batchId: string, action: 'release_all' | 'print_all' | 'trash'): Promise<ActionResult> {
  return adminBatchActionFn({ batchId, action });
}

export function createBatch(count: number, notes: string): Promise<{ batchId: string; count: number }> {
  return adminCreateBatchFn({ productType: 'OQ', count, notes });
}

let ensured = false;
/** Eski kayıtları yeni yapıya bir kez taşır (sunucu tarafında korumalıdır, tekrar çağrılması zararsızdır). */
export async function ensureLifecycle(): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    await adminEnsureLifecycleFn({});
  } catch (e) {
    ensured = false;
    console.warn('[lifecycle] geçiş kontrolü yapılamadı:', e);
  }
}

// ------------------------------------------------------------------ yetkiler (sunucudaki kuralların aynısı)

/** Her işlemin gerektirdiği yetki (sunucudaki ACTION_PERM ile aynı) */
export const ACTION_PERM: Record<TagAction, string> = {
  release: 'act.release',
  unrelease: 'act.unrelease',
  mark_printed: 'act.print',
  unmark_printed: 'act.print',
  trash: 'act.trash',
  restore: 'act.restore',
  disable: 'act.disable',
  enable: 'act.enable',
  expire: 'act.expire',
  reset: 'act.reset',
  purge: 'act.purge',
};

/**
 * Bu işlem düğmesi gösterilsin mi. Yetkiler oturum açan kişinin pozisyonundan gelir (lib/access).
 * İlk parametre eski kullanım için korunur; asıl denetim her istekte sunucudadır.
 */
export function canDo(_role: unknown, action: TagAction | 'batch_create' | 'zip'): boolean {
  if (action === 'batch_create') return has('act.batch_create');
  if (action === 'zip') return has('act.zip');
  return has(ACTION_PERM[action]);
}

// ------------------------------------------------------------------ kalıcı silme için yeniden doğrulama

export function hasPasswordProvider(): boolean {
  return !!auth.currentUser?.providerData.some((p) => p.providerId === 'password');
}

/** Şifre (ya da Google) ile kimliği yeniden doğrular ve yeni oturum jetonu alır. */
export async function reauthenticate(password?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) throw Object.assign(new Error('no-user'), { code: 'auth/no-user' });
  if (password !== undefined) {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  await user.getIdToken(true);
}

// ------------------------------------------------------------------ baskı dosyası (ZIP)

/** Seçili QR'ları matbaa için ZIP olarak indirir: her QR bir SVG + liste.csv */
export async function downloadTagsZip(tags: LTag[], filename: string, onProgress?: (done: number, total: number) => void): Promise<void> {
  const entries: ZipEntry[] = [];
  const sorted = [...tags].sort((a, b) => a.tagId.localeCompare(b.tagId));
  const rows = ['Seri no;QR altı kod;Bağlantı;Parti'];
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const svg = await generateLogodQrSvg(t.code, 1000);
    entries.push({ name: `${t.tagId}.svg`, data: svg });
    rows.push([t.tagId, formatCode(t.code), tagUrl(t.code), t.batchId].map((c) => `"${c.replace(/"/g, '""')}"`).join(';'));
    if (onProgress && (i % 20 === 0 || i === sorted.length - 1)) {
      onProgress(i + 1, sorted.length);
      await new Promise((r) => setTimeout(r, 0)); // arayüz donmasın
    }
  }
  entries.push({ name: 'liste.csv', data: '﻿' + rows.join('\r\n') });
  downloadBlob(buildZip(entries), filename);
}

/** "34 HPJ 465" -> "34 HPJ ••65" */
export function maskPlate(plate: string | null): string {
  if (!plate) return '';
  const parts = plate.trim().toUpperCase().split(/\s+/);
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    return [...parts.slice(0, -1), last.length > 2 ? '••' + last.slice(-2) : last].join(' ');
  }
  return plate;
}

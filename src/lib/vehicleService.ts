// Garaj (vehicles koleksiyonu) istemci servisi.
// Etiket bağlama/ayırma işlemleri burada DEĞİL, Cloud Functions'tadır.

import {
  addDoc, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { TagRecord, Vehicle, VehicleInput, VehicleNotice } from '../types/vehicle';

const VEHICLES = 'vehicles';

function clean(input: VehicleInput): VehicleInput {
  return {
    plateNumber: (input.plateNumber || '').trim().toUpperCase().slice(0, 16),
    brandModel: (input.brandModel || '').trim().slice(0, 60),
    ownerName: (input.ownerName || '').trim().slice(0, 60),
    contactPhone: (input.contactPhone || '').replace(/[^\d+]/g, '').slice(0, 20),
    parkingNote: (input.parkingNote || '').trim().slice(0, 200),
    allowMessages: input.allowMessages !== false,
  };
}

export function listenMyVehicles(uid: string, onData: (list: Vehicle[]) => void, onError?: (e: Error) => void): () => void {
  const q = query(collection(db, VEHICLES), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Vehicle, 'id'>) }));
      list.sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, 'tr'));
      onData(list);
    },
    (err) => onError?.(err),
  );
}

export async function createVehicle(uid: string, input: VehicleInput): Promise<string> {
  const ref = await addDoc(collection(db, VEHICLES), {
    ...clean(input),
    ownerUid: uid,
    tagCode: null,
    tagSerial: null,
    unreadNotices: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVehicle(vehicleId: string, input: VehicleInput): Promise<void> {
  await updateDoc(doc(db, VEHICLES, vehicleId), { ...clean(input), updatedAt: serverTimestamp() });
}

/** Araç silinebilmesi için önce QR etiketi ayrılmış olmalı (kural bunu zorunlu kılar). */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  await deleteDoc(doc(db, VEHICLES, vehicleId));
}

export async function fetchMyTag(code: string): Promise<TagRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'tags', code));
    return snap.exists() ? (snap.data() as TagRecord) : null;
  } catch {
    return null;
  }
}

export function listenTag(code: string, onData: (tag: TagRecord | null) => void): () => void {
  return onSnapshot(
    doc(db, 'tags', code),
    (snap) => onData(snap.exists() ? (snap.data() as TagRecord) : null),
    () => onData(null),
  );
}

export function listenNotices(vehicleId: string, onData: (list: VehicleNotice[]) => void): () => void {
  const q = query(collection(db, VEHICLES, vehicleId, 'notices'), orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type,
            note: data.note || '',
            read: !!data.read,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          } as VehicleNotice;
        }),
      );
    },
    () => onData([]),
  );
}

/** Okunmamış bildirimleri okundu yapar ve araç üzerindeki sayacı sıfırlar. */
export async function markNoticesRead(vehicleId: string, notices: VehicleNotice[]): Promise<void> {
  const unread = notices.filter((n) => !n.read);
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, VEHICLES, vehicleId, 'notices', n.id), { read: true }));
  batch.update(doc(db, VEHICLES, vehicleId), { unreadNotices: 0 });
  await batch.commit();
}

export async function deleteNotice(vehicleId: string, noticeId: string): Promise<void> {
  await deleteDoc(doc(db, VEHICLES, vehicleId, 'notices', noticeId));
}

/** "34abc1234" -> "34 ABC 1234" */
export function formatTurkishPlate(input: string): string {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length <= 2) return clean;
  const province = clean.slice(0, 2);
  const rest = clean.slice(2);
  const letters = (rest.match(/^[A-Z]+/)?.[0] || '').slice(0, 3);
  if (!letters) return `${province} ${rest}`.slice(0, 16);
  const digits = rest.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 5);
  return [province, letters, digits].filter(Boolean).join(' ');
}

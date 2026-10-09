import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, where, orderBy, limit, serverTimestamp, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { QrTagItem, QrTagStatus } from '../types/card';
import { assertSuperAdmin } from './staffAuthService';

const QR_REGISTRY_COLLECTION = 'qr_registry';

/**
 * Generate a random secure alphanumeric token
 */
function generateSecretKey(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Batch generate sequential QR tags for print manufacturing (Super Admin Only)
 */
export async function createBatchQrTags(
  batchName: string, 
  count: number, 
  prefix = 'AK-2026'
): Promise<QrTagItem[]> {
  await assertSuperAdmin();

  const createdTags: QrTagItem[] = [];
  const now = new Date().toISOString();

  // Find the highest existing tag index to prevent collisions
  const existingTags = await fetchAllQrTags();
  const existingIndexes = existingTags
    .map(t => {
      const parts = t.tagId.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      return isNaN(num) ? 0 : num;
    });
  let startIndex = existingIndexes.length > 0 ? Math.max(...existingIndexes) + 1 : 1;

  for (let i = 0; i < count; i++) {
    const currentIndex = startIndex + i;
    const tagId = `${prefix}-${String(currentIndex).padStart(4, '0')}`;
    const secretKey = generateSecretKey(8);

    const tagItem: QrTagItem = {
      tagId,
      secretKey,
      status: 'unclaimed',
      batchNumber: batchName.trim() || 'BATCH-DEFAULT',
      assignedUserId: null,
      assignedUserEmail: null,
      assignedPlate: null,
      assignedCardId: null,
      createdAt: now,
      activatedAt: null,
      notes: ''
    };

    try {
      const docRef = doc(db, QR_REGISTRY_COLLECTION, tagId);
      await setDoc(docRef, {
        ...tagItem,
        createdAtFirestore: serverTimestamp()
      });
    } catch (e) {
      console.warn(`Firestore tag write warning for ${tagId}:`, e);
    }

    createdTags.push(tagItem);
  }

  return createdTags;
}

/**
 * Fetch all registered QR tags from Firestore (Super Admin Only)
 */
export async function fetchAllQrTags(): Promise<QrTagItem[]> {
  await assertSuperAdmin();
  try {
    const colRef = collection(db, QR_REGISTRY_COLLECTION);
    const snap = await getDocs(colRef);
    const items: QrTagItem[] = [];
    snap.forEach((docSnap) => {
      items.push(docSnap.data() as QrTagItem);
    });
    return items.sort((a, b) => b.tagId.localeCompare(a.tagId));
  } catch (error) {
    console.warn('Error fetching QR tags:', error);
    return [];
  }
}

/**
 * Real-time listener for the QR registry (Super Admin Only)
 */
export function listenToQrTags(onUpdate: (tags: QrTagItem[]) => void): () => void {
  try {
    const colRef = collection(db, QR_REGISTRY_COLLECTION);
    return onSnapshot(colRef, (snap) => {
      const items: QrTagItem[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as QrTagItem);
      });
      items.sort((a, b) => b.tagId.localeCompare(a.tagId));
      onUpdate(items);
    }, (err) => {
      console.warn('Real-time QR tag sync warning:', err);
    });
  } catch (error) {
    console.warn('Could not listen to QR tags:', error);
    return () => {};
  }
}

/**
 * Update an individual QR tag status or note (Kill switch / Reactivation) (Super Admin Only)
 */
export async function updateQrTagStatus(
  tagId: string, 
  status: QrTagStatus, 
  notes?: string
): Promise<void> {
  await assertSuperAdmin();

  try {
    const docRef = doc(db, QR_REGISTRY_COLLECTION, tagId);
    const payload: any = {
      status,
      updatedAtFirestore: serverTimestamp()
    };
    if (notes !== undefined) {
      payload.notes = notes;
    }
    await updateDoc(docRef, payload);
  } catch (error) {
    console.error('Failed to update QR tag status:', error);
    throw error;
  }
}

/**
 * Reset / Unlink a QR tag back to 'unclaimed' (Super Admin Only)
 */
export async function resetQrTag(tagId: string): Promise<void> {
  await assertSuperAdmin();

  try {
    const docRef = doc(db, QR_REGISTRY_COLLECTION, tagId);
    await updateDoc(docRef, {
      status: 'unclaimed',
      assignedUserId: null,
      assignedUserEmail: null,
      assignedPlate: null,
      assignedCardId: null,
      activatedAt: null,
      updatedAtFirestore: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to reset QR tag:', error);
    throw error;
  }
}

/**
 * Export tag list to print shop CSV
 */
export function exportToPrintCsv(tags: QrTagItem[]): void {
  if (tags.length === 0) return;
  const baseUrl = window.location.origin;
  const headers = ['Tag ID', 'Aktivasyon PIN', 'QR Kod URL', 'Parti No', 'Durum', 'Oluşturulma Tarihi'];
  
  const rows = tags.map(t => [
    t.tagId,
    t.secretKey,
    `${baseUrl}/activate?tag=${t.tagId}&key=${t.secretKey}`,
    t.batchNumber || '',
    t.status,
    new Date(t.createdAt).toLocaleString('tr-TR')
  ]);

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `matbaa_qr_uretim_listesi_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Claim / Link a QR tag to a user's vehicle (Customer & System Flow)
 */
export async function claimQrTag(
  tagId: string,
  secretKey: string,
  userUid: string,
  userEmail: string,
  cardId: string,
  plateNumber: string
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, QR_REGISTRY_COLLECTION, tagId.trim().toUpperCase());
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        success: false,
        message: 'Bu etiket sistemimizde kayıtlı değildir veya geçersiz bir koddur.'
      };
    }

    const tagData = snap.data() as QrTagItem;

    if (tagData.secretKey.toUpperCase() !== secretKey.trim().toUpperCase()) {
      return {
        success: false,
        message: 'Aktivasyon güvenlik anahtarı (PIN) hatalıdır.'
      };
    }

    if (tagData.status === 'disabled') {
      return {
        success: false,
        message: 'Bu etiket yönetici tarafından iptal edilmiş veya devre dışı bırakılmıştır.'
      };
    }

    if (tagData.status === 'active' && tagData.assignedUserId && tagData.assignedUserId !== userUid) {
      return {
        success: false,
        message: `Bu etiket zaten ${tagData.assignedPlate || 'başka bir araca'} tanımlıdır.`
      };
    }

    // Link successfully
    await updateDoc(docRef, {
      status: 'active',
      assignedUserId: userUid,
      assignedUserEmail: userEmail,
      assignedCardId: cardId,
      assignedPlate: plateNumber.toUpperCase(),
      activatedAt: new Date().toISOString(),
      updatedAtFirestore: serverTimestamp()
    });

    return {
      success: true,
      message: `${tagId} seri numaralı etiket ${plateNumber} plakalı aracınıza başarıyla mühürlendi!`
    };
  } catch (error: any) {
    console.error('Claim error:', error);
    return {
      success: false,
      message: error.message || 'Etiket eşleştirilirken bir hata oluştu.'
    };
  }
}

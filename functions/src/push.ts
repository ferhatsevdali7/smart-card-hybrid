import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';
import { db } from './helpers';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Kullanıcının kayıtlı tüm cihazlarına web push gönderir (ücretsiz, FCM).
 * Geçersizleşmiş jetonları temizler. Hata olsa bile çağıranı düşürmez.
 * @returns başarıyla gönderilen cihaz sayısı
 */
export async function sendPushToUser(uid: string, payload: PushPayload): Promise<number> {
  try {
    const snap = await db().collection('users').doc(uid).collection('push_tokens').limit(20).get();
    if (snap.empty) return 0;
    const docs = snap.docs.filter((d) => typeof d.data().token === 'string');
    const tokens = docs.map((d) => d.data().token as string);
    if (tokens.length === 0) return 0;

    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        title: payload.title,
        body: payload.body,
        url: payload.url || '/?view=vehicle',
        tag: payload.tag || 'arac-bildirim',
      },
      webpush: {
        headers: { Urgency: 'high', TTL: '3600' },
      },
    });

    const stale: Promise<unknown>[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
        stale.push(docs[i].ref.delete());
      } else if (r.error) {
        logger.warn('Push gönderilemedi', { code, message: r.error.message });
      }
    });
    await Promise.all(stale);
    return res.successCount;
  } catch (e) {
    logger.error('Push hatası', e);
    return 0;
  }
}

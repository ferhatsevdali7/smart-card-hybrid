// Bildirimler: QR etiketleri okutulduğunda gelen mesajlar (bütün araçlar) + bu cihazın bildirim ayarları.

import React, { useEffect, useMemo, useState } from 'react';
import { BellOff, Phone, Send, Share, X } from 'lucide-react';
import { NOTICE_LABELS, VehicleNotice } from '../../types/vehicle';
import { deleteNotice, listenNotices, markNoticesRead } from '../../lib/vehicleService';
import { disablePushOnThisDevice } from '../../lib/pushService';
import { requestAccountSync } from '../../lib/accountSyncService';
import { functionErrorMessage, sendTestPushFn } from '../../lib/functionsClient';
import { useCustomer } from '../context';
import { Card, H1, IconBox, Loading, Notice, Page, Row, SectionTitle, Switch, useL, useLang } from '../ui';

type Item = VehicleNotice & { vehicleId: string; plate: string };

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

export const NoticesPage: React.FC = () => {
  const L = useL();
  const lang = useLang();
  const { vehicles, vehiclesLoading } = useCustomer();
  const [byVehicle, setByVehicle] = useState<Record<string, VehicleNotice[]>>({});
  const ids = vehicles.map((v) => v.id).join(',');

  useEffect(() => {
    const offs = vehicles.map((v) => listenNotices(v.id, (list) => setByVehicle((m) => ({ ...m, [v.id]: list }))));
    return () => offs.forEach((o) => o());
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayfa açıkken gelen her okunmamış bildirim okundu sayılır.
  useEffect(() => {
    for (const v of vehicles) {
      const list = byVehicle[v.id] || [];
      if ((v.unreadNotices || 0) > 0 && list.some((n) => !n.read)) markNoticesRead(v.id, list).catch(() => undefined);
    }
  }, [byVehicle, vehicles]);

  const items: Item[] = useMemo(() => vehicles.flatMap((v) => (byVehicle[v.id] || []).map((n) => ({ ...n, vehicleId: v.id, plate: v.plateNumber })))
    .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)), [byVehicle, vehicles]);
  const loaded = vehicles.every((v) => byVehicle[v.id] !== undefined);
  const today = dayStart(new Date());
  const groups = [
    { t: L('Bugün', 'Today'), list: items.filter((n) => n.createdAt && n.createdAt.getTime() >= today) },
    { t: L('Daha önce', 'Earlier'), list: items.filter((n) => !n.createdAt || n.createdAt.getTime() < today) },
  ].filter((g) => g.list.length);

  const time = (d: Date | null) => {
    if (!d) return '';
    const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
    if (d.getTime() >= today) return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    if (d.getTime() >= today - 86400000) return `${L('Dün', 'Yesterday')} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
  };

  const list = vehiclesLoading || !loaded ? <Loading /> : items.length === 0 ? (
    <Card className="px-6 py-10 text-center">
      <span className="mx-auto w-12 h-12 rounded-[14px] flex items-center justify-center" style={{ background: 'var(--c-sub)', color: 'var(--c-fn)' }}><BellOff className="w-6 h-6" /></span>
      <div className="text-[15px] font-semibold mt-4" style={{ color: 'var(--c-tx)' }}>{L('Henüz bildirim yok', 'No notices yet')}</div>
      <p className="text-[14px] mt-1.5 m-0 leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L('QR etiketiniz okutulup bir mesaj gönderildiğinde burada görünür.', 'Messages sent from your QR tags appear here.')}</p>
    </Card>
  ) : groups.map((g, gi) => (
    <div key={g.t}>
      <SectionTitle first={gi === 0}>{g.t}</SectionTitle>
      <Card>
        {g.list.map((n, i) => (
          <div key={n.vehicleId + n.id} className="flex items-start gap-3 px-4 py-[14px]" style={{ borderTop: i ? '1px solid var(--c-ln)' : undefined }}>
            <span className="w-2 h-2 rounded-full shrink-0 mt-[7px]" style={{ background: n.read ? 'transparent' : 'var(--c-p)' }} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px]" style={{ color: 'var(--c-tx)', fontWeight: n.read ? 500 : 700 }}>{NOTICE_LABELS[n.type]?.[lang] || n.type}</div>
              {n.note && <div className="text-[14px] mt-[3px] break-words" style={{ color: 'var(--c-mu)' }}>“{n.note}”</div>}
              <div className="text-[12.5px] mt-[5px]" style={{ color: 'var(--c-fn)' }}>{n.plate} · {time(n.createdAt)}</div>
            </div>
            <button type="button" onClick={() => deleteNotice(n.vehicleId, n.id).catch(() => undefined)} aria-label={L('Bildirimi sil', 'Delete notice')} className="p-1" style={{ color: 'var(--c-fn)' }}><X className="w-4 h-4" /></button>
          </div>
        ))}
      </Card>
    </div>
  ));

  return (
    <Page wide={960}>
      <H1 sub={L('QR etiketleriniz okutulduğunda gelen mesajlar', 'Messages sent when your QR tags are scanned')}>{L('Bildirimler', 'Notifications')}</H1>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-0 lg:gap-7 items-start">
        <div>{list}</div>
        <div className="mt-[26px] lg:mt-0"><PushSettings /></div>
      </div>
    </Page>
  );
};

export const PushSettings: React.FC = () => {
  const L = useL();
  const { user, push, refreshPush, enablePushNow, go } = useCustomer();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const on = push === 'on';
  const desc = push === 'loading' ? '…'
    : on ? L('Açık · QR okutulunca bu cihaza bildirim gelir', 'On · this device gets notified')
      : push === 'off' ? L('Kapalı', 'Off')
        : push === 'denied' ? L('Bu tarayıcıda bildirim izni kapalı', 'Notification permission is blocked')
          : push === 'ios-install' ? L('iPhone’da önce ana ekrana eklenmeli', 'On iPhone, add to Home Screen first')
            : push === 'not-configured' ? L('Bildirim servisi henüz hazır değil', 'Not configured yet')
              : L('Bu tarayıcı bildirimleri desteklemiyor', 'Not supported by this browser');
  const toggle = async (v: boolean) => {
    setBusy(true); setMsg(null);
    try {
      if (v) { await enablePushNow(); }
      else { await disablePushOnThisDevice(user.uid); requestAccountSync(); await refreshPush(); setMsg({ text: L('Bu cihaza artık bildirim gönderilmeyecek.', 'This device will no longer be notified.'), ok: true }); }
    } catch { setMsg({ text: L('İşlem tamamlanamadı. Lütfen tekrar deneyiniz.', 'Could not complete.'), ok: false }); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await sendTestPushFn({});
      setMsg(r.sent > 0 ? { text: L('Deneme bildirimi gönderildi. Birkaç saniye içinde gelmesi gerekir.', 'Test notification sent.'), ok: true } : { text: L('Kayıtlı cihaz bulunamadı. Bildirimleri kapatıp yeniden açınız.', 'No registered device found.'), ok: false });
    } catch (e) { setMsg({ text: functionErrorMessage(e), ok: false }); } finally { setBusy(false); }
  };
  return (
    <div>
      <SectionTitle first>{L('Bildirim ayarları', 'Notification settings')}</SectionTitle>
      <Card>
        <Row first icon={<Phone className="w-[17px] h-[17px]" />} title={L('Bu cihaza bildirim gönder', 'Notify this device')} desc={desc}
          right={<Switch on={on} disabled={busy || push === 'loading' || !(push === 'on' || push === 'off')} onChange={toggle} label={L('Bu cihaza bildirim gönder', 'Notify this device')} />} />
        {on && <Row icon={<Send className="w-[17px] h-[17px]" />} title={L('Deneme bildirimi gönder', 'Send test notification')} onClick={busy ? undefined : test} />}
      </Card>
      {push === 'denied' && <div className="mt-3"><Notice tone="warn">{L('Tarayıcı ayarlarından bu site için bildirimlere izin verip sayfayı yenileyiniz.', 'Allow notifications for this site in browser settings, then reload.')}</Notice></div>}
      {push === 'ios-install' && (
        <Card className="mt-3 px-4 py-[14px]">
          <div className="flex items-center gap-3"><IconBox tone="accent"><Share className="w-[17px] h-[17px]" /></IconBox><div className="text-[14px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('iPhone’da bildirimleri açmak için', 'To enable on iPhone')}</div></div>
          <ol className="m-0 mt-3 pl-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>
            <li>{L('Safari’de alttaki Paylaş düğmesine dokunun.', 'Tap Share in Safari.')}</li>
            <li>{L('“Ana Ekrana Ekle”yi seçin.', 'Choose “Add to Home Screen”.')}</li>
            <li>{L('Ana ekrandaki simgeden açıp bu ayarı açın.', 'Open from the icon and turn this on.')}</li>
          </ol>
          <button type="button" onClick={() => go('setup')} className="mt-2 text-[13.5px] font-semibold" style={{ color: 'var(--c-pt)' }}>{L('Kurulumu aç', 'Open setup')}</button>
        </Card>
      )}
      {msg && <div className="mt-3"><Notice tone={msg.ok ? 'ok' : 'danger'} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}
      <p className="m-0 mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-fn)' }}>{L('Bildirimler her cihazda ayrı açılır. Telefonunuzda da açmayı unutmayınız.', 'Notifications are enabled per device.')}</p>
    </div>
  );
};

// Araçlarım: araç listesi (açılır kart: QR etiketi, gelen bildirimler, araç bilgileri) ve araç ekleme sayfası.

import React, { useEffect, useState } from 'react';
import { Bell, CarFront, ChevronDown, Plus, QrCode, ShieldAlert, ShieldCheck, Trash2, Unlink, X } from 'lucide-react';
import { NOTICE_LABELS, TagRecord, Vehicle, VehicleInput, VehicleNotice } from '../../types/vehicle';
import { createVehicle, deleteNotice, deleteVehicle, formatTurkishPlate, listenNotices, listenTag, markNoticesRead, updateVehicle } from '../../lib/vehicleService';
import { formatCode, functionErrorMessage, reportTagLostFn, unlinkTagFn } from '../../lib/functionsClient';
import { useCustomer } from '../context';
import { BackLink, Btn, Card, Field, H1, Loading, Notice, Page, Pill, Plate, SectionTitle, Switch, inputCls, inputStyle, useL, useLang } from '../ui';

export const VehiclesPage: React.FC<{ openId?: string | null }> = ({ openId }) => {
  const L = useL();
  const { vehicles, vehiclesLoading, vehiclesError, go } = useCustomer();
  const [expanded, setExpanded] = useState<string | null>(openId || null);
  useEffect(() => { if (openId) setExpanded(openId); }, [openId]);
  const linked = vehicles.filter((v) => v.tagCode).length;
  return (
    <Page>
      <H1
        sub={vehicles.length ? L(`${vehicles.length} araç · ${linked} QR etiketi bağlı`, `${vehicles.length} vehicles · ${linked} QR linked`) : L('Araçlarınız ve QR etiketleriniz', 'Your vehicles and QR tags')}
        right={<Btn small onClick={() => go('vehicleAdd')}><Plus className="w-4 h-4" />{L('Araç ekle', 'Add vehicle')}</Btn>}
      >{L('Araçlarım', 'My vehicles')}</H1>
      {vehiclesError && <div className="mt-4"><Notice tone="danger">{L('Araçlarınız şu anda yüklenemedi. Lütfen sayfayı yenileyiniz.', 'Your vehicles could not be loaded.')}</Notice></div>}
      {vehiclesLoading ? <Loading /> : vehicles.length === 0 ? (
        <Card className="mt-4 px-6 py-10 text-center">
          <span className="mx-auto w-12 h-12 rounded-[14px] flex items-center justify-center" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}><CarFront className="w-6 h-6" /></span>
          <div className="text-[16px] font-semibold mt-4" style={{ color: 'var(--c-tx)' }}>{L('Henüz araç eklemediniz', 'No vehicles yet')}</div>
          <p className="text-[14px] mt-1.5 mb-5 leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L('Önce aracınızı ekleyin, ardından QR etiketinizi bağlayın.', 'Add your vehicle first, then link your QR tag.')}</p>
          <Btn onClick={() => go('vehicleAdd')}><Plus className="w-4 h-4" />{L('Araç ekle', 'Add vehicle')}</Btn>
        </Card>
      ) : (
        <div className="mt-1">
          {vehicles.map((v) => <VehicleItem key={v.id} vehicle={v} expanded={expanded === v.id} onToggle={() => setExpanded(expanded === v.id ? null : v.id)} />)}
        </div>
      )}
    </Page>
  );
};

// ---------------------------------------------------------------- tek araç

const VehicleItem: React.FC<{ vehicle: Vehicle; expanded: boolean; onToggle: () => void }> = ({ vehicle, expanded, onToggle }) => {
  const L = useL();
  const lang = useLang();
  const { go, toast } = useCustomer();
  const [tag, setTag] = useState<TagRecord | null>(null);
  const [notices, setNotices] = useState<VehicleNotice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'unlink' | 'lost' | 'delete' | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { if (!vehicle.tagCode) { setTag(null); return; } return listenTag(vehicle.tagCode, setTag); }, [vehicle.tagCode]);
  useEffect(() => { if (!expanded) return; return listenNotices(vehicle.id, setNotices); }, [expanded, vehicle.id]);
  useEffect(() => {
    if (expanded && (vehicle.unreadNotices || 0) > 0 && notices.some((n) => !n.read)) markNoticesRead(vehicle.id, notices).catch(() => undefined);
  }, [expanded, notices, vehicle.unreadNotices, vehicle.id]);

  const state: 'none' | 'active' | 'disabled' | 'expired' = !vehicle.tagCode ? 'none' : tag?.status === 'disabled' ? 'disabled' : tag?.status === 'expired' ? 'expired' : 'active';
  const pill = { none: <Pill tone="muted">{L('QR bağlı değil', 'No QR')}</Pill>, active: <Pill tone="ok">{L('QR etkin', 'QR active')}</Pill>, disabled: <Pill tone="danger">{L('QR kapalı', 'QR disabled')}</Pill>, expired: <Pill tone="warn">{L('Süresi doldu', 'Expired')}</Pill> }[state];

  const run = async (key: string, fn: () => Promise<unknown>, okText: string, after?: () => void) => {
    setBusy(key); setMsg(null);
    try { await fn(); setConfirm(null); if (after) after(); else setMsg({ text: okText, ok: true }); if (after) toast(okText); }
    catch (e) { setMsg({ text: functionErrorMessage(e, L('İşlem tamamlanamadı. Lütfen tekrar deneyiniz.', 'Could not complete.')), ok: false }); }
    finally { setBusy(null); }
  };

  return (
    <Card className="mt-3 overflow-hidden">
      <div className="flex items-center gap-[14px] p-4">
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex items-center gap-[14px] flex-1 min-w-0 text-left">
          <Plate plate={vehicle.plateNumber} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--c-tx)' }}>{vehicle.brandModel || L('Araç', 'Vehicle')}</div>
            <div className="mt-[5px]">{pill}</div>
          </div>
        </button>
        {(vehicle.unreadNotices || 0) > 0 && <Pill tone="danger" icon={<Bell className="w-3 h-3" />}>{vehicle.unreadNotices}</Pill>}
        {state === 'none' && !expanded && (
          <button type="button" onClick={() => go('linkQr', { id: vehicle.id })} className="hidden lg:inline-flex items-center gap-[6px] text-[14px] font-semibold mr-1" style={{ color: 'var(--c-pt)' }}>
            <QrCode className="w-4 h-4" />{L('QR etiketi bağla', 'Link QR tag')}
          </button>
        )}
        <button type="button" onClick={onToggle} aria-label={expanded ? L('Kapat', 'Collapse') : L('Aç', 'Expand')} className="p-1 -m-1">
          <ChevronDown className="w-[18px] h-[18px] transition-transform" style={{ color: 'var(--c-fn)', transform: expanded ? 'rotate(180deg)' : undefined }} />
        </button>
      </div>

      {state === 'none' && !expanded && (
        <button type="button" onClick={() => go('linkQr', { id: vehicle.id })} className="lg:hidden w-full flex items-center gap-3 px-4 py-[14px] text-left" style={{ borderTop: '1px solid var(--c-ln)' }}>
          <span className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}><QrCode className="w-[18px] h-[18px]" /></span>
          <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('QR etiketi bağlayın', 'Link a QR tag')}</span><span className="block text-[12.5px] mt-[2px]" style={{ color: 'var(--c-fn)' }}>{L('Etiketi okutun, bu araca bağlansın.', 'Scan the tag to link it to this vehicle.')}</span></span>
          <span className="text-[14px] font-semibold" style={{ color: 'var(--c-pt)' }}>{L('Bağla', 'Link')}</span>
        </button>
      )}

      {expanded && (
        <div className="px-4 pb-5 pt-1" style={{ borderTop: '1px solid var(--c-ln)' }}>
          {msg && <div className="mt-4"><Notice tone={msg.ok ? 'ok' : 'danger'} onClose={() => setMsg(null)}>{msg.text}</Notice></div>}

          <SectionTitle>{L('QR etiketi', 'QR tag')}</SectionTitle>
          {state === 'none' ? (
            <Btn full onClick={() => go('linkQr', { id: vehicle.id })}><QrCode className="w-4 h-4" />{L('Bu araca QR etiketi bağla', 'Link a QR tag to this vehicle')}</Btn>
          ) : (
            <div className="rounded-[12px] p-[14px]" style={{ background: 'var(--c-sub)' }}>
              <div className="flex items-center gap-2 text-[14px]" style={{ color: 'var(--c-tx)' }}>
                {state === 'active' ? <ShieldCheck className="w-4 h-4" style={{ color: 'var(--c-ok)' }} /> : <ShieldAlert className="w-4 h-4" style={{ color: 'var(--c-dg)' }} />}
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{vehicle.tagSerial || formatCode(vehicle.tagCode!)}</span>
              </div>
              {state === 'disabled' && <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--c-dg)' }}>{tag?.disabledReason === 'lost' ? L('Bu etiket kayıp bildirildiği için kapatıldı.', 'This tag was reported lost.') : L('Bu etiket kullanıma kapatıldı. Destek talebi oluşturabilirsiniz.', 'This tag has been disabled.')}</p>}
              {state === 'expired' && <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--c-wr)' }}>{L('Bu etiketin hizmet süresi doldu.', 'This tag service period has ended.')}</p>}
              {typeof tag?.scanCount === 'number' && <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--c-fn)' }}>{L(`Toplam ${tag.scanCount} kez okutuldu.`, `Scanned ${tag.scanCount} times.`)}</p>}
              {confirm === null && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <Btn small kind="secondary" onClick={() => setConfirm('unlink')} className={`w-full ${state === 'active' ? '' : 'sm:col-span-2'}`}><Unlink className="w-4 h-4" />{L('Araçtan ayır', 'Unlink')}</Btn>
                  {state === 'active' && <Btn small kind="secondary" onClick={() => setConfirm('lost')} className="w-full !text-[var(--c-dg)]"><ShieldAlert className="w-4 h-4" />{L('Kayıp / çalıntı bildir', 'Report lost')}</Btn>}
                </div>
              )}
              {confirm === 'unlink' && <Confirm text={L('QR bu araçtan ayrılacak ama hesabınızda kalacak; başka bir aracınıza bağlayabilirsiniz. Ayrı kaldığı sürece okutan kişi bildirim gönderemez.', 'The QR will be unlinked but stays on your account.')} label={L('Ayır', 'Unlink')} busy={busy === 'unlink'} onCancel={() => setConfirm(null)} onOk={() => run('unlink', () => unlinkTagFn({ vehicleId: vehicle.id }), L('QR araçtan ayrıldı.', 'QR unlinked.'))} />}
              {confirm === 'lost' && <Confirm danger text={L('Etiket kalıcı olarak kapatılacak ve bir daha kullanılamayacak. Bu işlem geri alınamaz.', 'The tag will be permanently disabled. This cannot be undone.')} label={L('Kalıcı olarak kapat', 'Disable permanently')} busy={busy === 'lost'} onCancel={() => setConfirm(null)} onOk={() => run('lost', () => reportTagLostFn({ code: vehicle.tagCode! }), L('Etiket kapatıldı. Yeni bir etiket bağlayabilirsiniz.', 'Tag disabled.'))} />}
            </div>
          )}

          <SectionTitle>{L('Gelen bildirimler', 'Notices')}</SectionTitle>
          {notices.length === 0 ? <p className="m-0 text-[14px]" style={{ color: 'var(--c-fn)' }}>{L('Henüz bildirim yok.', 'No notices yet.')}</p> : (
            <div className="rounded-[12px] overflow-hidden" style={{ border: '1px solid var(--c-ln)' }}>
              {notices.map((n, i) => (
                <div key={n.id} className="flex items-start gap-3 px-[14px] py-3" style={{ borderTop: i ? '1px solid var(--c-ln)' : undefined }}>
                  <Bell className="w-4 h-4 mt-[2px] shrink-0" style={{ color: n.read ? 'var(--c-fn)' : 'var(--c-p)' }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--c-tx)' }}>{NOTICE_LABELS[n.type]?.[lang] || n.type}</div>
                    {n.note && <div className="text-[14px] mt-[2px] break-words" style={{ color: 'var(--c-mu)' }}>“{n.note}”</div>}
                    <div className="text-[12.5px] mt-1" style={{ color: 'var(--c-fn)' }}>{n.createdAt ? n.createdAt.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                  <button type="button" onClick={() => deleteNotice(vehicle.id, n.id).catch(() => undefined)} aria-label={L('Bildirimi sil', 'Delete notice')} className="p-1" style={{ color: 'var(--c-fn)' }}><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          <SectionTitle>{L('Araç bilgileri', 'Vehicle details')}</SectionTitle>
          <VehicleForm initial={vehicle} submitLabel={L('Değişiklikleri kaydet', 'Save changes')} onSubmit={(d) => updateVehicle(vehicle.id, d)} savedText={L('Kaydedildi', 'Saved')} />

          <div className="mt-5">
            {confirm === 'delete'
              ? <Confirm danger text={L('Araç ve bildirimleri silinecek.', 'The vehicle and its notices will be deleted.')} label={L('Aracı sil', 'Delete vehicle')} busy={busy === 'delete'} onCancel={() => setConfirm(null)} onOk={() => run('delete', () => deleteVehicle(vehicle.id), L('Araç silindi.', 'Vehicle deleted.'), () => undefined)} />
              : <button type="button" onClick={() => (vehicle.tagCode ? setMsg({ text: L('Aracı silmeden önce QR etiketini araçtan ayırınız.', 'Unlink the QR before deleting.'), ok: false }) : setConfirm('delete'))} className="inline-flex items-center gap-[6px] text-[13.5px]" style={{ color: 'var(--c-fn)' }}><Trash2 className="w-4 h-4" />{L('Aracı sil', 'Delete vehicle')}</button>}
          </div>
        </div>
      )}
    </Card>
  );
};

const Confirm: React.FC<{ text: string; label: string; busy: boolean; danger?: boolean; onCancel: () => void; onOk: () => void }> = ({ text, label, busy, danger, onCancel, onOk }) => {
  const L = useL();
  return (
    <div className="mt-3">
      <p className="m-0 text-[13.5px] leading-relaxed" style={{ color: danger ? 'var(--c-dg)' : 'var(--c-mu)' }}>{text}</p>
      <div className="flex gap-2 mt-3">
        <Btn small kind="secondary" onClick={onCancel} disabled={busy} className="flex-1">{L('Vazgeç', 'Cancel')}</Btn>
        <Btn small kind={danger ? 'danger' : 'primary'} onClick={onOk} busy={busy} className="flex-1">{label}</Btn>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- form

const EMPTY: VehicleInput = { plateNumber: '', brandModel: '', parkingNote: '', allowMessages: true };
const pick = (v: Partial<VehicleInput>): VehicleInput => ({ plateNumber: v.plateNumber || '', brandModel: v.brandModel || '', parkingNote: v.parkingNote || '', allowMessages: v.allowMessages !== false });

export const VehicleForm: React.FC<{ initial: Partial<VehicleInput>; submitLabel: string; savedText?: string; onSubmit: (d: VehicleInput) => Promise<unknown>; onCancel?: () => void }> = ({ initial, submitLabel, savedText, onSubmit, onCancel }) => {
  const L = useL();
  const [form, setForm] = useState<VehicleInput>({ ...EMPTY, ...pick(initial) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const plateBad = form.plateNumber.replace(/\s/g, '').length < 4;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (plateBad) return;
    setSaving(true); setError(null);
    try { await onSubmit(form); if (savedText) { setSaved(true); setTimeout(() => setSaved(false), 2500); } }
    catch { setError(L('Kaydedilemedi. Lütfen tekrar deneyiniz.', 'Could not save. Please try again.')); }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.3fr] gap-x-[14px]">
        <Field label={L('Plaka', 'Plate')} htmlFor="vf-plate" error={tried && plateBad ? L('Geçerli bir plaka giriniz.', 'Enter a valid plate.') : null}>
          <input id="vf-plate" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: formatTurkishPlate(e.target.value) })} placeholder="34 ABC 123" maxLength={13} autoCapitalize="characters"
            className={`${inputCls} uppercase font-bold tracking-[1.5px]`} style={{ ...inputStyle(tried && plateBad), fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 17 }} />
        </Field>
        <Field label={L('Marka ve model', 'Brand and model')} htmlFor="vf-model">
          <input id="vf-model" value={form.brandModel} maxLength={60} onChange={(e) => setForm({ ...form, brandModel: e.target.value })} placeholder={L('Örn. Renault Clio', 'e.g. Renault Clio')} className={inputCls} style={inputStyle()} />
        </Field>
      </div>
      <Field label={L('Park notu', 'Parking note')} hint={L('İsteğe bağlı · QR’ı okutan kişiye gösterilir', 'Optional · shown to whoever scans the QR')} htmlFor="vf-note" right={`${form.parkingNote.length} / 200`}>
        <textarea id="vf-note" value={form.parkingNote} maxLength={200} rows={2} onChange={(e) => setForm({ ...form, parkingNote: e.target.value })} placeholder={L('Örn. 5 dakika içinde gelirim.', 'e.g. I will be there in 5 minutes.')} className={`${inputCls} resize-none leading-relaxed`} style={inputStyle()} />
      </Field>
      <Card className="mt-4">
        <div className="flex items-center gap-3 px-4 py-[13px]">
          <div className="flex-1 min-w-0"><div className="text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Hazır mesajlara izin ver', 'Allow quick messages')}</div><div className="text-[12.5px] mt-[2px]" style={{ color: 'var(--c-fn)' }}>{L('“Farlarınız açık”, “Yolu kapatıyor” gibi', '“Your lights are on”, “Blocking the way”…')}</div></div>
          <Switch on={form.allowMessages !== false} onChange={(v) => setForm({ ...form, allowMessages: v })} label={L('Hazır mesajlara izin ver', 'Allow quick messages')} />
        </div>
      </Card>
      {error && <div className="mt-4"><Notice tone="danger">{error}</Notice></div>}
      <div className="flex gap-[10px] mt-5">
        {onCancel && <Btn kind="secondary" onClick={onCancel} className="flex-1 lg:flex-none">{L('Vazgeç', 'Cancel')}</Btn>}
        <Btn type="submit" busy={saving} className="flex-1 lg:flex-none">{saved ? savedText : submitLabel}</Btn>
      </div>
    </form>
  );
};

export const VehicleAddPage: React.FC<{ claimCode?: string | null }> = ({ claimCode }) => {
  const L = useL();
  const { user, go, back, toast } = useCustomer();
  return (
    <Page wide={560}>
      <BackLink label={L('Araçlarım', 'My vehicles')} onClick={back} />
      <H1 sub={claimCode ? L('Aracı kaydettikten sonra okuttuğunuz etiket bu araca bağlanacak.', 'After saving, the scanned tag will be linked to this vehicle.') : L('QR etiketini aracı ekledikten sonra bağlayabilirsiniz.', 'You can link a QR tag after adding the vehicle.')}>{L('Araç ekle', 'Add vehicle')}</H1>
      <VehicleForm initial={{}} submitLabel={L('Aracı kaydet', 'Save vehicle')} onCancel={back}
        onSubmit={async (d) => {
          const id = await createVehicle(user.uid, d);
          if (claimCode) go('claim', { code: claimCode, id });
          else { toast(L('Araç eklendi. Şimdi QR etiketini bağlayabilirsiniz.', 'Vehicle added.')); go('vehicles', { id }); }
        }} />
      <Card className="mt-5 px-4 py-[14px]">
        <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L('Adınız ve telefon numaranız araçta değil, profilinizde tutulur ve QR’ı okutan kişiye hiçbir zaman gösterilmez.', 'Your name and phone are kept in your profile and are never shown to the scanner.')}</p>
      </Card>
    </Page>
  );
};

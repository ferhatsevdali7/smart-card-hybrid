import React, { useEffect, useMemo, useState } from 'react';
import {
  CarFront, Plus, QrCode, Bell, ChevronDown, Save, Trash2, Link2, Unlink,
  ShieldAlert, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, LogIn, X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Language, ThemeMode } from '../lib/i18n';
import { ClaimResult, NOTICE_LABELS, TagRecord, Vehicle, VehicleInput, VehicleNotice } from '../types/vehicle';
import {
  createVehicle, deleteNotice, deleteVehicle, formatTurkishPlate, listenMyVehicles,
  listenNotices, listenTag, markNoticesRead, updateVehicle,
} from '../lib/vehicleService';
import {
  claimTagFn, extractTagCode, formatCode, functionErrorMessage, reportTagLostFn, unlinkTagFn,
} from '../lib/functionsClient';
import { QrScannerModal } from './QrScannerModal';
import { PushSettingsCard } from './PushSettingsCard';

export type SubTab = 'details' | 'qr';

interface VehicleCardViewProps {
  user: User | null;
  lang?: Language;
  theme?: ThemeMode;
  subTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
  onOpenAuth?: () => void;
  /** /t/KOD sayfasından "Hesabıma bağla" ile gelindiyse okutulmuş kod */
  pendingClaimCode?: string | null;
  onPendingClaimHandled?: () => void;
}

const CLAIM_MESSAGES: Record<ClaimResult, { tr: string; en: string; ok: boolean }> = {
  OK: { tr: 'QR başarıyla aracınıza bağlandı.', en: 'QR linked to your vehicle.', ok: true },
  ALREADY_LINKED: { tr: 'Bu QR zaten bu araca bağlı.', en: 'This QR is already linked to this vehicle.', ok: true },
  NOT_OURS: { tr: 'Bu QR bizim sistemimize ait değil. Sayfaya bağlanamaz.', en: 'This QR is not registered in our system.', ok: false },
  OWNED_BY_OTHER: { tr: 'Bu QR başka bir kullanıcı tarafından kullanılıyor.', en: 'This QR is used by another account.', ok: false },
  DISABLED: { tr: 'Bu QR kapatılmış, kullanıma kapalı.', en: 'This QR has been disabled.', ok: false },
  EXPIRED: { tr: "Bu QR'ın hizmet süresi dolmuş.", en: 'This QR service period has ended.', ok: false },
  WRONG_PRODUCT: { tr: 'Bu QR bir araç kartı etiketi değil.', en: 'This QR is not a vehicle tag.', ok: false },
  VEHICLE_HAS_TAG: { tr: "Bu araçta zaten bir QR var. Önce mevcut QR'ı araçtan ayırın.", en: 'This vehicle already has a QR. Unlink it first.', ok: false },
};

const EMPTY_FORM: VehicleInput = {
  plateNumber: '', brandModel: '', ownerName: '', contactPhone: '', parkingNote: '', allowMessages: true,
};

export const VehicleCardView: React.FC<VehicleCardViewProps> = ({
  user, lang = 'tr', theme = 'dark', subTab = 'details', onSubTabChange, onOpenAuth,
  pendingClaimCode, onPendingClaimHandled,
}) => {
  const isDark = theme === 'dark';
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // QR bağlama akışı
  const [claimVehicleId, setClaimVehicleId] = useState<string>('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!user) { setVehicles([]); setLoading(false); return; }
    setLoading(true);
    return listenMyVehicles(
      user.uid,
      (list) => { setVehicles(list); setLoading(false); setLoadError(null); },
      () => { setLoading(false); setLoadError(L('Araçlar yüklenemedi.', 'Could not load vehicles.')); },
    );
  }, [user?.uid]);

  // /t/KOD sayfasından gelen bağlama isteği
  useEffect(() => {
    if (pendingClaimCode && user) {
      setClaimCode(pendingClaimCode);
      setClaimMsg(null);
      onSubTabChange?.('qr');
      onPendingClaimHandled?.();
    }
  }, [pendingClaimCode, user?.uid]);

  const freeVehicles = useMemo(() => vehicles.filter((v) => !v.tagCode), [vehicles]);

  useEffect(() => {
    if (!claimVehicleId && freeVehicles.length > 0) setClaimVehicleId(freeVehicles[0].id);
    if (claimVehicleId && !vehicles.some((v) => v.id === claimVehicleId)) setClaimVehicleId(freeVehicles[0]?.id || '');
  }, [freeVehicles, vehicles, claimVehicleId]);

  const card = isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 pt-10 pb-24 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <CarFront className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold">{L('Araç Kartı', 'Vehicle Card')}</h2>
        <p className={`text-sm ${muted}`}>
          {L('Araçlarınızı eklemek ve satın aldığınız QR etiketlerini bağlamak için giriş yapın.',
             'Sign in to add your vehicles and link the QR tags you purchased.')}
        </p>
        <button onClick={onOpenAuth} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold">
          <LogIn className="w-4 h-4" /> {L('Giriş Yap', 'Sign In')}
        </button>
      </div>
    );
  }

  const handleScanned = (raw: string) => {
    setScannerOpen(false);
    const code = extractTagCode(raw);
    if (!code) {
      setClaimCode(null);
      setClaimMsg({ text: CLAIM_MESSAGES.NOT_OURS[lang], ok: false });
      return;
    }
    setClaimMsg(null);
    setClaimCode(code);
  };

  const handleClaim = async () => {
    if (!claimCode || !claimVehicleId) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      const res = await claimTagFn({ code: claimCode, vehicleId: claimVehicleId });
      const m = CLAIM_MESSAGES[res.result] || CLAIM_MESSAGES.NOT_OURS;
      setClaimMsg({ text: m[lang], ok: m.ok });
      if (m.ok) {
        setClaimCode(null);
        setExpandedId(claimVehicleId);
      }
    } catch (e) {
      setClaimMsg({ text: functionErrorMessage(e), ok: false });
    } finally {
      setClaiming(false);
    }
  };

  // --------------------------------------------------------------- Sekmeler
  const tabs = (
    <div className="flex justify-center">
      <div className={`inline-flex p-1 rounded-full border ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        {([['details', L('Araçlarım', 'My Vehicles'), CarFront], ['qr', L('QR Bağla', 'Link QR'), QrCode]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => onSubTabChange?.(id)}
            className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
              subTab === id
                ? (isDark ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-white')
                : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-950')
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 space-y-6 pb-28 pt-1">
      {tabs}

      {loadError && <Banner ok={false} text={loadError} />}

      {/* =========================== ARAÇLARIM =========================== */}
      {subTab === 'details' && (
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{L('Araçlarım', 'My Vehicles')}</h2>
              <p className={`text-xs ${muted}`}>
                {L('Her araca ayrı bir QR etiketi bağlayabilirsiniz.', 'You can link a separate QR tag to each vehicle.')}
              </p>
            </div>
            {!showAdd && (
              <button onClick={() => setShowAdd(true)} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold">
                <Plus className="w-4 h-4" /> {L('Araç Ekle', 'Add Vehicle')}
              </button>
            )}
          </div>

          <PushSettingsCard uid={user.uid} isDark={isDark} />

          {showAdd && (
            <div className={`rounded-2xl border p-4 ${card}`}>
              <VehicleForm
                isDark={isDark}
                lang={lang}
                initial={EMPTY_FORM}
                submitLabel={L('Aracı Kaydet', 'Save Vehicle')}
                onCancel={() => setShowAdd(false)}
                onSubmit={async (data) => {
                  const id = await createVehicle(user.uid, data);
                  setShowAdd(false);
                  setExpandedId(id);
                }}
              />
            </div>
          )}

          {loading ? (
            <div className={`flex items-center justify-center gap-2 py-10 text-xs ${muted}`}>
              <Loader2 className="w-4 h-4 animate-spin" /> {L('Yükleniyor...', 'Loading...')}
            </div>
          ) : vehicles.length === 0 && !showAdd ? (
            <div className={`rounded-2xl border border-dashed p-8 text-center space-y-2 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
              <CarFront className={`w-8 h-8 mx-auto ${muted}`} />
              <p className="text-sm font-semibold">{L('Henüz araç eklemediniz', 'No vehicles yet')}</p>
              <p className={`text-xs ${muted}`}>{L('Önce aracınızı ekleyin, sonra QR etiketinizi bağlayın.', 'Add your vehicle first, then link your QR tag.')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((v) => (
                <VehicleItem
                  key={v.id}
                  vehicle={v}
                  isDark={isDark}
                  lang={lang}
                  expanded={expandedId === v.id}
                  onToggle={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  onLinkQr={() => { setClaimVehicleId(v.id); setClaimCode(null); setClaimMsg(null); onSubTabChange?.('qr'); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================== QR BAĞLA =========================== */}
      {subTab === 'qr' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold">{L('QR Etiketi Bağla', 'Link a QR Tag')}</h2>
            <p className={`text-xs ${muted}`}>
              {L('Satın aldığınız etiketin QR kodunu okutun ve hangi araca bağlanacağını seçin.',
                 'Scan the QR on the tag you purchased and choose the vehicle.')}
            </p>
          </div>

          {claimMsg && <Banner ok={claimMsg.ok} text={claimMsg.text} onClose={() => setClaimMsg(null)} />}

          {vehicles.length === 0 ? (
            <div className={`rounded-2xl border p-5 text-center space-y-3 ${card}`}>
              <p className="text-sm">{L('QR bağlamak için önce bir araç eklemelisiniz.', 'Add a vehicle before linking a QR.')}</p>
              <button onClick={() => { onSubTabChange?.('details'); setShowAdd(true); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold">
                <Plus className="w-4 h-4" /> {L('Araç Ekle', 'Add Vehicle')}
              </button>
            </div>
          ) : (
            <div className={`rounded-2xl border p-4 space-y-4 ${card}`}>
              {/* 1. Araç seçimi */}
              <div className="space-y-1.5">
                <label className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{L('1. Araç', '1. Vehicle')}</label>
                {freeVehicles.length === 0 ? (
                  <p className="text-xs text-amber-500">
                    {L("Tüm araçlarınızda QR bağlı. Yeni QR için yeni araç ekleyin veya bir araçtaki QR'ı ayırın.",
                       'All vehicles already have a QR. Add a vehicle or unlink one first.')}
                  </p>
                ) : (
                  <select
                    value={claimVehicleId}
                    onChange={(e) => setClaimVehicleId(e.target.value)}
                    className={`w-full px-3.5 py-3 rounded-xl border text-sm font-mono font-bold outline-none ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'}`}
                  >
                    {freeVehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.plateNumber}{v.brandModel ? ` — ${v.brandModel}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 2. QR okut */}
              <div className="space-y-1.5">
                <label className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{L('2. QR Etiketi', '2. QR Tag')}</label>
                {claimCode ? (
                  <div className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-300'}`}>
                    <span className="font-mono text-sm tracking-widest">{formatCode(claimCode)}</span>
                    <button onClick={() => setClaimCode(null)} className={`text-[11px] ${muted} hover:text-amber-500`}>{L('Değiştir', 'Change')}</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setClaimMsg(null); setScannerOpen(true); }}
                    disabled={freeVehicles.length === 0}
                    className={`w-full py-4 rounded-xl border-2 border-dashed text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 ${isDark ? 'border-slate-700 hover:border-amber-500/60' : 'border-slate-300 hover:border-slate-500'}`}
                  >
                    <QrCode className="w-5 h-5 text-amber-500" /> {L("QR'ı Okut", 'Scan QR')}
                  </button>
                )}
              </div>

              <button
                onClick={handleClaim}
                disabled={!claimCode || !claimVehicleId || claiming || freeVehicles.length === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {L("QR'ı Araca Bağla", 'Link QR to Vehicle')}
              </button>
            </div>
          )}

          <p className={`text-[11px] leading-relaxed ${muted}`}>
            {L("Bağlanan QR yalnızca sizin hesabınıza ait olur; başka biri aynı QR'ı kendi hesabına bağlayamaz. Etiketinizi kaybederseniz Araçlarım bölümünden \"Kayıp bildir\" ile hemen kapatabilirsiniz.",
               'A linked QR belongs only to your account. If you lose it, report it from My Vehicles to disable it immediately.')}
          </p>
        </div>
      )}

      <QrScannerModal
        isOpen={scannerOpen}
        isDark={isDark}
        title={L('Etiketin QR Kodunu Okutun', 'Scan the Tag QR')}
        onClose={() => setScannerOpen(false)}
        onResult={handleScanned}
      />
    </div>
  );
};

// ===========================================================================
// Tek araç kartı (açılır)
// ===========================================================================

const VehicleItem: React.FC<{
  vehicle: Vehicle;
  isDark: boolean;
  lang: Language;
  expanded: boolean;
  onToggle: () => void;
  onLinkQr: () => void;
}> = ({ vehicle, isDark, lang, expanded, onToggle, onLinkQr }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const [tag, setTag] = useState<TagRecord | null>(null);
  const [notices, setNotices] = useState<VehicleNotice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'unlink' | 'lost' | 'delete' | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!vehicle.tagCode) { setTag(null); return; }
    return listenTag(vehicle.tagCode, setTag);
  }, [vehicle.tagCode]);

  useEffect(() => {
    if (!expanded) return;
    return listenNotices(vehicle.id, setNotices);
  }, [expanded, vehicle.id]);

  useEffect(() => {
    if (expanded && (vehicle.unreadNotices || 0) > 0 && notices.some((n) => !n.read)) {
      markNoticesRead(vehicle.id, notices).catch(() => undefined);
    }
  }, [expanded, notices, vehicle.unreadNotices]);

  const tagState: 'none' | 'active' | 'disabled' | 'expired' =
    !vehicle.tagCode ? 'none' : tag?.status === 'disabled' ? 'disabled' : tag?.status === 'expired' ? 'expired' : 'active';

  const run = async (key: string, fn: () => Promise<unknown>, okText: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg({ text: okText, ok: true }); setConfirm(null); }
    catch (e) { setMsg({ text: functionErrorMessage(e), ok: false }); }
    finally { setBusy(null); }
  };

  const chip = {
    none: { text: L('QR bağlı değil', 'No QR'), cls: isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500' },
    active: { text: L('QR aktif', 'QR active'), cls: 'bg-emerald-500/15 text-emerald-500' },
    disabled: { text: L('QR kapalı', 'QR disabled'), cls: 'bg-rose-500/15 text-rose-500' },
    expired: { text: L('Süresi doldu', 'Expired'), cls: 'bg-amber-500/15 text-amber-500' },
  }[tagState];

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <div className="inline-flex items-center bg-white text-slate-950 rounded-lg pl-1 pr-3 py-1 border-2 border-slate-900 shrink-0">
          <span className="bg-[#003399] text-white text-[8px] font-bold px-1 py-1 rounded mr-2 leading-none">TR</span>
          <span className="font-mono font-black text-sm tracking-wider">{vehicle.plateNumber}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{vehicle.brandModel || L('Araç', 'Vehicle')}</div>
          <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${chip.cls}`}>{chip.text}</span>
        </div>
        {(vehicle.unreadNotices || 0) > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-rose-500 text-white">
            <Bell className="w-3 h-3" /> {vehicle.unreadNotices}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''} ${muted}`} />
      </button>

      {expanded && (
        <div className={`border-t p-4 space-y-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          {msg && <Banner ok={msg.ok} text={msg.text} onClose={() => setMsg(null)} />}

          {/* ---- QR durumu ---- */}
          <section className="space-y-2">
            <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{L('QR Etiketi', 'QR Tag')}</h4>
            {tagState === 'none' ? (
              <button onClick={onLinkQr} className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2">
                <QrCode className="w-4 h-4" /> {L('Bu araca QR bağla', 'Link a QR to this vehicle')}
              </button>
            ) : (
              <div className={`rounded-xl border p-3 space-y-3 ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center gap-2 text-xs">
                  {tagState === 'active' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4 text-rose-500" />}
                  <span className="font-mono">{vehicle.tagSerial || formatCode(vehicle.tagCode!)}</span>
                </div>
                {tagState === 'disabled' && (
                  <p className="text-[11px] text-rose-500">
                    {tag?.disabledReason === 'lost'
                      ? L('Bu etiket kayıp bildirildiği için kapatıldı.', 'This tag was reported lost.')
                      : L('Bu etiket kullanıma kapatıldı. Destek ekibimizle iletişime geçin.', 'This tag has been disabled. Please contact support.')}
                  </p>
                )}
                {tagState === 'expired' && (
                  <p className="text-[11px] text-amber-500">{L('Bu etiketin hizmet süresi doldu.', 'This tag service period has ended.')}</p>
                )}
                {typeof tag?.scanCount === 'number' && (
                  <p className={`text-[11px] ${muted}`}>{L(`Toplam ${tag.scanCount} kez okutuldu.`, `Scanned ${tag.scanCount} times.`)}</p>
                )}

                {confirm === null && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setConfirm('unlink')} className={`flex-1 min-w-[140px] py-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1.5 ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-white'}`}>
                      <Unlink className="w-3.5 h-3.5" /> {L('Araçtan ayır', 'Unlink')}
                    </button>
                    {tagState === 'active' && (
                      <button onClick={() => setConfirm('lost')} className="flex-1 min-w-[140px] py-2 rounded-lg border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 text-[11px] font-semibold flex items-center justify-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" /> {L('Kayıp / çalıntı bildir', 'Report lost')}
                      </button>
                    )}
                  </div>
                )}
                {confirm === 'unlink' && (
                  <ConfirmRow
                    isDark={isDark}
                    text={L("QR bu araçtan ayrılacak ama hesabınızda kalacak; başka bir aracınıza bağlayabilirsiniz. Ayrıldığı sürece okutan kişi bildirim gönderemez.",
                            'The QR will be unlinked but stays on your account.')}
                    confirmLabel={L('Ayır', 'Unlink')}
                    busy={busy === 'unlink'}
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => run('unlink', () => unlinkTagFn({ vehicleId: vehicle.id }), L('QR araçtan ayrıldı.', 'QR unlinked.'))}
                  />
                )}
                {confirm === 'lost' && (
                  <ConfirmRow
                    isDark={isDark}
                    danger
                    text={L('Etiket KALICI olarak kapatılacak ve bir daha kullanılamayacak. Bu işlemi siz geri alamazsınız.',
                            'The tag will be permanently disabled. You cannot undo this.')}
                    confirmLabel={L('Kalıcı olarak kapat', 'Disable permanently')}
                    busy={busy === 'lost'}
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => run('lost', () => reportTagLostFn({ code: vehicle.tagCode! }), L('Etiket kapatıldı. Yeni bir etiket bağlayabilirsiniz.', 'Tag disabled.'))}
                  />
                )}
              </div>
            )}
          </section>

          {/* ---- Bildirimler ---- */}
          <section className="space-y-2">
            <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{L('Gelen Bildirimler', 'Notices')}</h4>
            {notices.length === 0 ? (
              <p className={`text-xs ${muted}`}>{L('Henüz bildirim yok.', 'No notices yet.')}</p>
            ) : (
              <ul className="space-y-2">
                {notices.map((n) => (
                  <li key={n.id} className={`flex items-start gap-3 rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.read ? muted : 'text-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold">{NOTICE_LABELS[n.type]?.[lang] || n.type}</div>
                      {n.note && <div className="text-xs mt-0.5 break-words">"{n.note}"</div>}
                      <div className={`text-[10px] mt-1 ${muted}`}>{n.createdAt ? n.createdAt.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB') : ''}</div>
                    </div>
                    <button onClick={() => deleteNotice(vehicle.id, n.id).catch(() => undefined)} className={`p-1 rounded hover:bg-slate-500/20 ${muted}`} aria-label="Sil">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- Araç bilgileri ---- */}
          <section className="space-y-2">
            <h4 className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{L('Araç Bilgileri', 'Vehicle Details')}</h4>
            <VehicleForm
              isDark={isDark}
              lang={lang}
              initial={vehicle}
              submitLabel={L('Değişiklikleri Kaydet', 'Save Changes')}
              onSubmit={(data) => updateVehicle(vehicle.id, data)}
            />
          </section>

          {/* ---- Sil ---- */}
          <section className="pt-1">
            {confirm === 'delete' ? (
              <ConfirmRow
                isDark={isDark}
                danger
                text={L('Araç ve bildirimleri silinecek.', 'The vehicle will be deleted.')}
                confirmLabel={L('Aracı sil', 'Delete')}
                busy={busy === 'delete'}
                onCancel={() => setConfirm(null)}
                onConfirm={() => run('delete', () => deleteVehicle(vehicle.id), L('Araç silindi.', 'Vehicle deleted.'))}
              />
            ) : (
              <button
                onClick={() => (vehicle.tagCode ? setMsg({ text: L("Aracı silmeden önce QR'ı araçtan ayırın.", 'Unlink the QR before deleting.'), ok: false }) : setConfirm('delete'))}
                className={`text-[11px] flex items-center gap-1.5 hover:text-rose-500 ${muted}`}
              >
                <Trash2 className="w-3.5 h-3.5" /> {L('Aracı sil', 'Delete vehicle')}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// Araç formu
// ===========================================================================

const VehicleForm: React.FC<{
  isDark: boolean;
  lang: Language;
  initial: VehicleInput;
  submitLabel: string;
  onSubmit: (data: VehicleInput) => Promise<unknown>;
  onCancel?: () => void;
}> = ({ isDark, lang, initial, submitLabel, onSubmit, onCancel }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [form, setForm] = useState<VehicleInput>({ ...EMPTY_FORM, ...pick(initial) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field = `w-full px-3.5 py-3 rounded-xl border text-xs outline-none transition-all ${
    isDark ? 'bg-slate-950/60 border-slate-800 text-white focus:border-amber-500/60' : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
  }`;
  const label = `text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((form.plateNumber || '').replace(/\s/g, '').length < 4) {
      setError(L('Geçerli bir plaka girin.', 'Enter a valid plate.'));
      return;
    }
    setSaving(true); setError(null);
    try {
      await onSubmit(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError(L('Kaydedilemedi. Lütfen tekrar deneyin.', 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={label}>{L('Plaka', 'Plate')}</label>
          <input
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: formatTurkishPlate(e.target.value) })}
            placeholder="34 ABC 789"
            maxLength={13}
            required
            className={`${field} font-mono font-bold uppercase text-sm`}
          />
        </div>
        <div className="space-y-1.5">
          <label className={label}>{L('Marka / Model', 'Brand / Model')}</label>
          <input value={form.brandModel} maxLength={60} onChange={(e) => setForm({ ...form, brandModel: e.target.value })} placeholder="Renault Clio" className={field} />
        </div>
        <div className="space-y-1.5">
          <label className={label}>{L('Sürücü adı (gizli)', 'Driver name (private)')}</label>
          <input value={form.ownerName} maxLength={60} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className={field} />
        </div>
        <div className="space-y-1.5">
          <label className={label}>{L('Telefon (gizli)', 'Phone (private)')}</label>
          <input
            value={form.contactPhone}
            inputMode="tel"
            maxLength={20}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="+90 5xx xxx xx xx"
            className={`${field} font-mono`}
          />
        </div>
      </div>
      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
        {L('Adınız ve telefonunuz QR okutan kişiye hiçbir zaman gösterilmez. Telefon, ileride eklenecek gizli arama hattı için saklanır.',
           'Your name and phone are never shown to people who scan the QR.')}
      </p>
      <div className="space-y-1.5">
        <label className={label}>{L('QR okutana gösterilecek not', 'Note shown to scanner')}</label>
        <textarea
          value={form.parkingNote}
          maxLength={200}
          rows={2}
          onChange={(e) => setForm({ ...form, parkingNote: e.target.value })}
          placeholder={L('Örn: Hatalı park ettiysem bildirin, hemen geliyorum.', 'e.g. Notify me if I parked badly.')}
          className={field}
        />
      </div>
      <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
        <span className="text-xs">{L('Okutanlar bana hazır bildirim gönderebilsin', 'Allow scanners to send me notices')}</span>
        <input type="checkbox" checked={form.allowMessages !== false} onChange={(e) => setForm({ ...form, allowMessages: e.target.checked })} className="w-4 h-4 accent-amber-500" />
      </label>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className={`flex-1 py-3 rounded-xl border text-xs font-semibold ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}>
            {L('Vazgeç', 'Cancel')}
          </button>
        )}
        <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? L('Kaydedildi', 'Saved') : submitLabel}
        </button>
      </div>
    </form>
  );
};

function pick(v: VehicleInput): VehicleInput {
  return {
    plateNumber: v.plateNumber || '',
    brandModel: v.brandModel || '',
    ownerName: v.ownerName || '',
    contactPhone: v.contactPhone || '',
    parkingNote: v.parkingNote || '',
    allowMessages: v.allowMessages !== false,
  };
}

// ===========================================================================
// Küçük parçalar
// ===========================================================================

const Banner: React.FC<{ ok: boolean; text: string; onClose?: () => void }> = ({ ok, text, onClose }) => (
  <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-rose-500/30 bg-rose-500/10 text-rose-500'}`}>
    {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
    <span className="flex-1">{text}</span>
    {onClose && <button onClick={onClose} aria-label="Kapat"><X className="w-3.5 h-3.5" /></button>}
  </div>
);

const ConfirmRow: React.FC<{
  isDark: boolean; text: string; confirmLabel: string; busy: boolean; danger?: boolean;
  onCancel: () => void; onConfirm: () => void;
}> = ({ isDark, text, confirmLabel, busy, danger, onCancel, onConfirm }) => (
  <div className="space-y-2">
    <p className={`text-[11px] leading-relaxed ${danger ? 'text-rose-500' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>{text}</p>
    <div className="flex gap-2">
      <button onClick={onCancel} disabled={busy} className={`flex-1 py-2 rounded-lg border text-[11px] font-semibold ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>Vazgeç</button>
      <button onClick={onConfirm} disabled={busy} className={`flex-1 py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 ${danger ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {confirmLabel}
      </button>
    </div>
  </div>
);

// QR etiketi bağlama: aracın içinden (kamera ya da kod) ve QR sayfasından "Etiketin sahibiyim" ile gelince araç seçimi.

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, QrCode } from 'lucide-react';
import { ClaimResult } from '../../types/vehicle';
import { claimTagFn, extractTagCode, formatCode, functionErrorMessage } from '../../lib/functionsClient';
import { useCustomer } from '../context';
import { QrScanner } from '../QrScanner';
import { BackLink, Btn, Card, H1, Loading, Notice, Page, Plate, inputCls, inputStyle, useL, useLang } from '../ui';

const CLAIM: Record<ClaimResult, { tr: string; en: string; ok: boolean }> = {
  OK: { tr: 'QR etiketi aracınıza bağlandı.', en: 'The QR tag is linked to your vehicle.', ok: true },
  ALREADY_LINKED: { tr: 'Bu QR etiketi zaten bu araca bağlı.', en: 'This QR is already linked to this vehicle.', ok: true },
  NOT_OURS: { tr: 'Bu QR etiketi sistemimize ait değil.', en: 'This QR is not registered in our system.', ok: false },
  OWNED_BY_OTHER: { tr: 'Bu QR etiketi başka bir hesapta kullanılıyor.', en: 'This QR is used by another account.', ok: false },
  DISABLED: { tr: 'Bu QR etiketi kapatılmış, kullanılamaz.', en: 'This QR has been disabled.', ok: false },
  EXPIRED: { tr: 'Bu QR etiketinin hizmet süresi dolmuş.', en: 'This QR service period has ended.', ok: false },
  WRONG_PRODUCT: { tr: 'Bu QR bir araç kartı etiketi değil.', en: 'This QR is not a vehicle tag.', ok: false },
  NOT_ACTIVATED: { tr: 'Bu QR etiketi henüz etkinleştirilmedi. Satın aldığınız yerle iletişime geçiniz.', en: 'This QR has not been activated yet.', ok: false },
  VEHICLE_HAS_TAG: { tr: 'Bu araçta zaten bir QR etiketi var. Önce mevcut etiketi araçtan ayırınız.', en: 'This vehicle already has a QR tag.', ok: false },
};

/** Elle yazılan kodu 4'erli gruplar: ABCD-EFGH-JKMN */
function prettyCode(v: string): string {
  const c = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return c.replace(/(.{4})(?=.)/g, '$1-');
}

function useClaim() {
  const L = useL();
  const lang = useLang();
  const { go, toast } = useCustomer();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claim = async (code: string, vehicleId: string) => {
    setBusy(true); setError(null);
    try {
      const r = await claimTagFn({ code, vehicleId });
      const m = CLAIM[r.result] || CLAIM.NOT_OURS;
      if (m.ok) { toast(m[lang]); go('vehicles', { id: vehicleId }); }
      else setError(m[lang]);
    } catch (e) { setError(functionErrorMessage(e, L('Etiket bağlanamadı. Lütfen tekrar deneyiniz.', 'Could not link the tag.'))); }
    finally { setBusy(false); }
  };
  return { busy, error, setError, claim };
}

export const LinkQrPage: React.FC<{ vehicleId: string }> = ({ vehicleId }) => {
  const L = useL();
  const { vehicles, vehiclesLoading, back } = useCustomer();
  const v = vehicles.find((x) => x.id === vehicleId);
  const [code, setCode] = useState('');
  const [scanned, setScanned] = useState<string | null>(null);
  const { busy, error, setError, claim } = useClaim();
  const clean = code.replace(/-/g, '');
  const valid = !!extractTagCode(clean) || !!scanned;

  if (vehiclesLoading) return <Loading />;
  if (!v) return <Page wide={560}><Notice tone="danger">{L('Araç bulunamadı.', 'Vehicle not found.')}</Notice></Page>;
  if (v.tagCode) return <Page wide={560}><BackLink label={L('Araçlarım', 'My vehicles')} onClick={back} /><Notice tone="info">{L('Bu araçta zaten bir QR etiketi var. Yeni etiket bağlamak için önce mevcut etiketi araçtan ayırınız.', 'This vehicle already has a QR tag.')}</Notice></Page>;

  const onScan = (raw: string) => {
    const c = extractTagCode(raw);
    if (!c) { setError(L('Okutulan QR bir araç kartı etiketi değil.', 'The scanned QR is not a vehicle tag.')); return; }
    setScanned(c); setCode(prettyCode(c)); setError(null);
  };
  const submit = () => { const c = scanned || extractTagCode(clean); if (c) claim(c, v.id); };

  const scanner = (
    <div>
      <div className="text-[15px] font-semibold mb-[10px] hidden lg:block" style={{ color: 'var(--c-tx)' }}>{L('Kamerayla okutun', 'Scan with camera')}</div>
      {scanned
        ? <div className="rounded-[16px] flex flex-col items-center justify-center gap-2 text-center px-6" style={{ height: 260, background: 'var(--c-okb)', color: 'var(--c-ok)' }}><QrCode className="w-8 h-8" /><span className="text-[15px] font-semibold">{L('Etiket okundu', 'Tag scanned')}</span><span style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 2 }}>{formatCode(scanned)}</span><button type="button" onClick={() => { setScanned(null); setCode(''); }} className="text-[13px] underline mt-1">{L('Yeniden okut', 'Scan again')}</button></div>
        : <QrScanner onResult={onScan} />}
    </div>
  );
  const manual = (
    <div>
      <div className="flex items-center gap-3 my-5 lg:mt-0 lg:mb-3" style={{ color: 'var(--c-fn)' }}>
        <span className="flex-1 h-px lg:hidden" style={{ background: 'var(--c-ln)' }} />
        <span className="text-[12.5px] lg:text-[15px] lg:font-semibold lg:text-[var(--c-tx)]">{L('ya da etiketin altındaki kodu yazın', 'or type the code under the tag')}</span>
        <span className="flex-1 h-px lg:hidden" style={{ background: 'var(--c-ln)' }} />
      </div>
      <input value={code} onChange={(e) => { setScanned(null); setCode(prettyCode(e.target.value)); setError(null); }} placeholder="ABCD-EFGH-JKMN" aria-label={L('Etiket kodu', 'Tag code')} autoCapitalize="characters" autoComplete="off" spellCheck={false}
        className={`${inputCls} uppercase`} style={{ ...inputStyle(!!error), fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 17, letterSpacing: 2 }} />
      {error && <div className="mt-3"><Notice tone="danger">{error}</Notice></div>}
      <div className="mt-4"><Btn full busy={busy} disabled={!valid} onClick={submit}>{L('Bu araca bağla', 'Link to this vehicle')}</Btn></div>
      <p className="m-0 mt-4 text-[12.5px] leading-relaxed" style={{ color: 'var(--c-fn)' }}>{L('Bağlanan etiket yalnızca sizin hesabınızda kullanılabilir. Etiket kaybolursa aracın sayfasından kapatabilirsiniz.', 'A linked tag can only be used on your account.')}</p>
    </div>
  );
  return (
    <Page wide={900}>
      <BackLink label={L('Araçlarım', 'My vehicles')} onClick={back} />
      <div className="flex items-center gap-3"><Plate plate={v.plateNumber} /><span className="text-[14px]" style={{ color: 'var(--c-mu)' }}>{v.brandModel}</span></div>
      <div className="mt-4"><H1 sub={<span className="lg:hidden">{L('Etiketteki QR’ı okutun. Etiket bu araca ve hesabınıza bağlanır.', 'Scan the QR on the tag.')}</span>}>{L('QR etiketi bağla', 'Link QR tag')}</H1></div>
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-7 items-start">{scanner}{manual}</div>
    </Page>
  );
};

export const ClaimPage: React.FC<{ code: string; preselect?: string | null }> = ({ code, preselect }) => {
  const L = useL();
  const { vehicles, vehiclesLoading, go, back } = useCustomer();
  const free = useMemo(() => vehicles.filter((v) => !v.tagCode), [vehicles]);
  const [sel, setSel] = useState<string | null>(preselect || null);
  const { busy, error, claim } = useClaim();
  useEffect(() => { if (!sel && free.length) setSel(free[0].id); }, [free, sel]);
  useEffect(() => { if (preselect && free.some((v) => v.id === preselect)) setSel(preselect); }, [preselect, free]);
  if (vehiclesLoading) return <Loading />;
  const radio = (on: boolean) => <span className="w-5 h-5 rounded-full box-border shrink-0" style={{ border: on ? '6px solid var(--c-p)' : '2px solid var(--c-ln2)' }} />;
  return (
    <Page wide={560}>
      <BackLink label={L('Araçlarım', 'My vehicles')} onClick={back} />
      <Card className="p-[18px] flex items-center gap-[14px]">
        <span className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: 'var(--c-okb)', color: 'var(--c-ok)' }}><QrCode className="w-[22px] h-[22px]" /></span>
        <div><div className="text-[12.5px]" style={{ color: 'var(--c-fn)' }}>{L('Okutulan etiket', 'Scanned tag')}</div><div className="text-[15px] font-semibold mt-[2px]" style={{ color: 'var(--c-tx)', fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 1.5 }}>{formatCode(code)}</div></div>
      </Card>
      <div className="mt-6"><H1 sub={L('QR etiketi olmayan araçlarınız listelenir.', 'Vehicles without a QR tag are listed.')}>{L('Hangi araca bağlansın?', 'Which vehicle?')}</H1></div>
      <Card className="mt-4">
        {free.map((v, i) => (
          <button key={v.id} type="button" role="radio" aria-checked={sel === v.id} onClick={() => setSel(v.id)} className="w-full flex items-center gap-[13px] px-4 py-4 text-left" style={{ borderTop: i ? '1px solid var(--c-ln)' : undefined }}>
            {radio(sel === v.id)}<Plate plate={v.plateNumber} small /><span className="text-[14px] truncate" style={{ color: 'var(--c-mu)' }}>{v.brandModel}</span>
          </button>
        ))}
        <button type="button" onClick={() => go('vehicleAdd', { code })} className="w-full flex items-center gap-[13px] px-4 py-4 text-left" style={{ borderTop: free.length ? '1px solid var(--c-ln)' : undefined }}>
          {radio(false)}<span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center" style={{ background: 'var(--c-sub)', color: 'var(--c-mu)' }}><Plus className="w-4 h-4" /></span><span className="text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Yeni araç ekle', 'Add a new vehicle')}</span>
        </button>
      </Card>
      {free.length === 0 && vehicles.length > 0 && <div className="mt-4"><Notice tone="info">{L('Bütün araçlarınızda QR etiketi bağlı. Bu etiket için yeni araç ekleyebilir ya da bir araçtaki etiketi ayırabilirsiniz.', 'All your vehicles already have a QR tag.')}</Notice></div>}
      {error && <div className="mt-4"><Notice tone="danger">{error}</Notice></div>}
      <div className="mt-[22px]"><Btn full busy={busy} disabled={!sel || !free.some((v) => v.id === sel)} onClick={() => sel && claim(code, sel)}>{L('Bu araca bağla', 'Link to this vehicle')}</Btn></div>
    </Page>
  );
};

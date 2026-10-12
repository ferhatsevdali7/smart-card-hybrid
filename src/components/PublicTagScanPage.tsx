import React, { useEffect, useState } from 'react';
import { ArrowLeft, Ban, CheckCircle2, ChevronRight, Clock, Flag, Info, Link2, Loader2, Send, ShieldCheck, XCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseApp';
import { functionErrorMessage, reportAbuseFn, scanTagFn, sendNoticeFn } from '../lib/functionsClient';
import { ABUSE_REASONS, LIMITS } from '../lib/ticketConstants';
import { NOTICE_LABELS, NoticeType, ScanResponse } from '../types/vehicle';

/**
 * QR okutulduğunda açılan herkese açık sayfa: /t/{KOD}
 * Uygulamanın geri kalanından bağımsızdır; yalnızca sunucunun döndürdüğü
 * güvenli bilgileri gösterir. Araç sahibinin numarası bu sayfaya hiç gelmez.
 * Açık tema (gün ışığında okunaklı), müşteri mavisi; kötüye kullanım bildirimi ayrı sayfadır.
 */

const P = '#14798D';
const PD = '#0E6476';
const TINT = '#E8F3F5';
const LINE = '#E2E8F0';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const NOTICE_ORDER: NoticeType[] = ['blocking', 'lights', 'window', 'alarm', 'other'];
const ABUSE_HASH = '#kotuye-kullanim';

const Logo: React.FC = () => (
  <span className="w-[30px] h-[30px] rounded-full bg-black flex items-center justify-center shrink-0" aria-hidden="true">
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[6px] font-extrabold tracking-[.2px] box-border" style={{ border: '1.5px solid #fff' }}>H***F</span>
  </span>
);
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`bg-white rounded-2xl ${className}`} style={{ border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(15,23,42,.04)', ...style }}>{children}</div>
);
const PrimaryBtn: React.FC<{ children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean }> = ({ children, onClick, disabled, busy }) => (
  <button type="button" onClick={onClick} disabled={disabled || busy} className="w-full h-12 rounded-[14px] text-white text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-45" style={{ background: P }}>
    {busy && <Loader2 className="w-4 h-4 animate-spin" />}{children}
  </button>
);

export const PublicTagScanPage: React.FC<{ code: string }> = ({ code }) => {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoticeType | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [abuseOpen, setAbuseOpen] = useState(() => window.location.hash === ABUSE_HASH);

  useEffect(() => {
    document.title = 'Akıllı Araç Kartı';
    let done = false;
    // Giriş durumu hazır olunca bir kez sorgula (sahibi okuttuysa tanınsın).
    const unsub = onAuthStateChanged(auth, async () => {
      if (done) return;
      done = true;
      try {
        setData(await scanTagFn({ code }));
      } catch (e) {
        setError(functionErrorMessage(e, 'Bilgiler alınamadı. Lütfen tekrar deneyiniz.'));
      }
    });
    return () => unsub();
  }, [code]);

  // Kötüye kullanım bildirimi ayrı bir sayfa gibi açılır; telefonun geri tuşu QR sayfasına döner.
  useEffect(() => {
    const onPop = () => setAbuseOpen(window.location.hash === ABUSE_HASH);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openAbuse = () => { window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${ABUSE_HASH}`); setAbuseOpen(true); window.scrollTo(0, 0); };
  const closeAbuse = () => {
    if (window.location.hash === ABUSE_HASH) window.history.back();
    setAbuseOpen(false);
  };

  const send = async () => {
    if (!selected) return;
    if (selected === 'other' && !note.trim()) {
      setSendError('Lütfen kısa bir not yazınız.');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await sendNoticeFn({ code, type: selected, note: note.trim() || undefined });
      setSent(true);
    } catch (e) {
      setSendError(functionErrorMessage(e, 'Bildirim gönderilemedi. Lütfen tekrar deneyiniz.'));
    } finally {
      setSending(false);
    }
  };

  // Kötüye kullanım bildirimi yalnızca bir hesaba bağlı etiketler için ve sahibi dışındakilere gösterilir.
  const canReport = !!data && !data.isOwner && (data.status === 'active' || data.status === 'unassigned');
  const showAbuse = abuseOpen && canReport;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F6F8', color: '#0F172A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      <header className="h-14 px-4 flex items-center bg-white shrink-0" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="w-full max-w-md mx-auto flex items-center">
          {showAbuse ? (
            <button type="button" onClick={closeAbuse} className="inline-flex items-center gap-2 text-[14px] font-semibold"><ArrowLeft className="w-[18px] h-[18px]" />Araç Kartı</button>
          ) : (
            <span className="flex items-center gap-2.5"><Logo /><span className="font-bold text-[14px]">Araç Kartı</span></span>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-5 pb-10">
        {showAbuse && data ? (
          <AbusePage code={code} plate={data.vehicle?.plateMasked || null} onClose={closeAbuse} />
        ) : (
          <>
            {!data && !error && (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm" style={{ color: '#64748B' }}>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: P }} /> Yükleniyor...
              </div>
            )}

            {error && <StatusCard icon={<XCircle className="w-10 h-10 text-rose-600" />} title="Bir sorun oluştu" text={error} />}

            {data?.status === 'not_found' && (
              <StatusCard icon={<XCircle className="w-10 h-10 text-rose-600" />} title="Bu QR sistemimizde kayıtlı değil"
                text="Okuttuğunuz kod tarafımızca üretilmiş bir etiket değil veya hatalı yazılmış." />
            )}

            {data?.status === 'not_activated' && (
              <StatusCard icon={<Clock className="w-10 h-10 text-amber-600" />} title="Bu QR henüz etkinleştirilmedi"
                text="Bu etiket henüz satışa sunulmamıştır. Satın aldıysanız lütfen satıcınızla iletişime geçiniz." />
            )}

            {data?.status === 'disabled' && (
              <StatusCard icon={<Ban className="w-10 h-10 text-rose-600" />} title="Bu etiket kullanıma kapalı"
                text="Bu QR etiketi kapatılmıştır ve artık bildirim almamaktadır." />
            )}

            {data?.status === 'expired' && (
              <StatusCard icon={<Clock className="w-10 h-10 text-amber-600" />} title="Hizmet süresi dolmuş"
                text={data.isOwner ? 'Bu etiketin hizmet süresi dolmuştur. Yenilemek için hesabınızdan bizimle iletişime geçiniz.' : 'Bu etiketin hizmet süresi dolmuştur.'} />
            )}

            {data?.status === 'unclaimed' && (
              <StatusCard icon={<Info className="w-10 h-10" style={{ color: P }} />} title="Bu etiket henüz kullanılmıyor" text="Bu QR etiketi henüz bir araca bağlanmamıştır.">
                <a href={`/?view=vehicle&claim=${encodeURIComponent(code)}`} className="mt-5 inline-flex items-center justify-center gap-2 w-full h-12 rounded-[14px] text-white text-sm font-bold" style={{ background: P }}>
                  <Link2 className="w-4 h-4" /> Etiketin sahibiyim, hesabıma bağla
                </a>
              </StatusCard>
            )}

            {data?.status === 'unassigned' && (
              <StatusCard icon={<Info className="w-10 h-10" style={{ color: P }} />} title="Bu etiket şu anda bir araca bağlı değil"
                text={data.isOwner ? 'Bu etiket size aittir. Garajınızdan bir araca bağlayabilirsiniz.' : 'Araç sahibi bu etiketi şu anda kullanmamaktadır.'}>
                {data.isOwner && (
                  <a href="/?view=vehicle" className="mt-5 inline-flex items-center justify-center gap-2 w-full h-12 rounded-[14px] text-white text-sm font-bold" style={{ background: P }}>Garajıma git</a>
                )}
              </StatusCard>
            )}

            {data?.status === 'active' && data.vehicle && (
              <div>
                {data.isOwner && (
                  <div className="mb-3 flex gap-2.5 p-3.5 rounded-[14px] text-[12.5px] leading-[1.55]" style={{ background: TINT, border: '1px solid #CFE6EA', color: PD }}>
                    <Info className="w-4 h-4 shrink-0 mt-[2px]" />
                    <span>Bu etiket size aittir. QR'ı okutan kişiler bu sayfayı görür.</span>
                  </div>
                )}

                <Card className="text-center px-4 py-[22px]">
                  <div className="text-[12.5px]" style={{ color: '#64748B' }}>Bu araç Hibrit Akıllı Kart ile korunmaktadır.</div>
                  <div className="mt-3.5">
                    <span className="inline-flex items-stretch h-[50px] rounded-[7px] overflow-hidden bg-white" style={{ border: '2px solid #0F172A' }}>
                      <span className="w-5 bg-[#003399] text-white text-[8px] font-bold flex items-end justify-center pb-[5px]">TR</span>
                      <span className="px-4 flex items-center text-[24px] font-bold tracking-[2px]" style={{ fontFamily: MONO }}>{data.vehicle.plateMasked}</span>
                    </span>
                  </div>
                  {data.vehicle.brandModel && <div className="text-[13px] mt-2" style={{ color: '#475569' }}>{data.vehicle.brandModel}</div>}
                  <p className="text-[11.5px] mt-3 mb-0 leading-[1.5]" style={{ color: '#64748B' }}>
                    Plaka ve model, QR'ın yapıştırıldığı araçla uyuşmuyorsa bu etiket kopyalanmış olabilir.
                  </p>
                  {data.vehicle.parkingNote && (
                    <div className="text-left rounded-xl p-3 mt-3 text-[13px] leading-[1.5]" style={{ background: '#F8FAFC', border: `1px solid ${LINE}`, color: '#334155' }}>
                      <div className="text-[11px] font-semibold mb-1" style={{ color: PD }}>Araç sahibinin notu</div>
                      {data.vehicle.parkingNote}
                    </div>
                  )}
                </Card>

                {!data.vehicle.allowMessages ? (
                  <StatusCard icon={<Info className="w-8 h-8" style={{ color: '#94A3B8' }} />} title="Araç sahibi şu an bildirim almıyor" text="Bu araç için bildirim gönderme kapalıdır." />
                ) : sent ? (
                  <StatusCard icon={<CheckCircle2 className="w-10 h-10 text-emerald-600" />} title="Bildiriminiz iletildi" text="Araç sahibine bildiriminiz iletilmiştir. Bilgileriniz paylaşılmamıştır." />
                ) : (
                  <div className="mt-[22px]">
                    <h2 className="m-0 text-[15px] font-bold">Araç Sahibine Bildirim Gönder</h2>
                    <p className="text-[12.5px] mt-1 mb-3 leading-[1.5]" style={{ color: '#475569' }}>Bildiriminiz araç sahibine anında iletilir. Telefon numarası paylaşılmaz.</p>
                    <div role="radiogroup" aria-label="Bildirim konusu">
                      {NOTICE_ORDER.map((id) => {
                        const on = selected === id;
                        return (
                          <button key={id} type="button" role="radio" aria-checked={on} onClick={() => { setSelected(id); setSendError(null); }}
                            className="w-full mt-2 px-4 py-3.5 rounded-2xl flex justify-between items-center text-left text-[14px] bg-white transition-colors"
                            style={on ? { border: `1px solid ${P}`, background: TINT, color: PD, fontWeight: 600 } : { border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
                            {NOTICE_LABELS[id].tr}
                            {on ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: P }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: '#94A3B8' }} />}
                          </button>
                        );
                      })}
                    </div>
                    {selected && (
                      <div className="mt-4">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value.slice(0, 200))}
                          rows={2}
                          aria-label="Not"
                          placeholder={selected === 'other' ? 'Kısaca yazınız (zorunlu)' : 'Eklemek istediğiniz not (isteğe bağlı)'}
                          className="w-full px-3.5 py-3 rounded-xl text-[14px] outline-none bg-white box-border resize-none focus:border-[#14798D]"
                          style={{ border: '1px solid #CBD5E1' }}
                        />
                        {sendError && <p role="alert" className="m-0 mt-2 text-[12.5px]" style={{ color: '#B42318' }}>{sendError}</p>}
                        <div className="mt-3"><PrimaryBtn onClick={send} busy={sending}><Send className="w-4 h-4" />Bildirimi Gönder</PrimaryBtn></div>
                        <p className="text-[11.5px] text-center mt-2.5 mb-0" style={{ color: '#64748B' }}>Telefon numaranız veya adınız istenmez, araç sahibine gösterilmez.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {canReport && (
              <div className="text-center mt-[26px]">
                <button type="button" onClick={openAbuse} className="inline-flex gap-[7px] items-center text-[13px]" style={{ color: '#64748B' }}>
                  <Flag className="w-3.5 h-3.5" /><span className="underline">Kötüye kullanım bildir</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-[10.5px] pb-6 flex items-center justify-center gap-1.5" style={{ color: '#94A3B8' }}>
        <ShieldCheck className="w-3 h-3" />Etiket kodu: <span style={{ fontFamily: MONO }}>{code.replace(/(.{4})(?=.)/g, '$1-')}</span>
      </footer>
    </div>
  );
};

const AbusePage: React.FC<{ code: string; plate: string | null; onClose: () => void }> = ({ code, plate, onClose }) => {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submit = async () => {
    if (!reason) { setErr('Lütfen bildirim nedenini seçiniz.'); return; }
    if (reason === 'other' && !note.trim()) { setErr('Lütfen kısa bir açıklama yazınız.'); return; }
    setBusy(true); setErr(null);
    try { await reportAbuseFn({ code, reason, note: note.trim() }); setDone(true); } catch (e) { setErr(functionErrorMessage(e, 'Bildiriminiz iletilemedi. Lütfen tekrar deneyiniz.')); } finally { setBusy(false); }
  };
  if (done) {
    return (
      <StatusCard icon={<CheckCircle2 className="w-10 h-10 text-emerald-600" />} title="Bildiriminiz alınmıştır" text="Bildiriminiz ekibimiz tarafından incelenecektir. Katkınız için teşekkür ederiz.">
        <button type="button" onClick={onClose} className="mt-5 w-full h-12 rounded-[14px] text-sm font-bold" style={{ border: '1px solid #CBD5E1', color: '#0F172A' }}>Araç Kartı'na dön</button>
      </StatusCard>
    );
  }
  return (
    <>
      <h1 className="m-0 text-[19px] font-bold flex gap-[9px] items-center"><Flag className="w-[19px] h-[19px]" style={{ color: '#B42318' }} />Kötüye Kullanım Bildirimi</h1>
      <p className="text-[13px] mt-1.5 mb-3.5 leading-[1.55]" style={{ color: '#475569' }}>
        {plate ? `${plate} plakalı araca ait QR etiketiyle` : 'Bu QR etiketiyle'} ilgili bildiriminiz ekibimiz tarafından incelenecektir. Bildirim için kimlik bilgisi talep edilmemektedir.
      </p>
      <Card className="px-4 pt-1.5 pb-[18px]">
        <div className="text-[12.5px] font-semibold mt-4 mb-[7px]" style={{ color: '#334155' }}>Bildirim nedeni</div>
        <div role="radiogroup" aria-label="Bildirim nedeni">
          {ABUSE_REASONS.map((r) => {
            const on = reason === r.id;
            return (
              <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => { setReason(r.id); setErr(null); }}
                className="w-full flex gap-3 items-center px-3.5 py-[13px] rounded-xl mt-2 text-left text-[13.5px]"
                style={{ border: `1px solid ${on ? P : LINE}`, background: on ? TINT : '#fff' }}>
                <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center box-border shrink-0" style={{ border: `2px solid ${on ? P : '#94A3B8'}` }}>
                  {on && <i className="w-2 h-2 rounded-full" style={{ background: P }} />}
                </span>
                {r.tr}
              </button>
            );
          })}
        </div>
        <label htmlFor="ab-note" className="block text-[12.5px] font-semibold mt-4 mb-[7px]" style={{ color: '#334155' }}>
          Açıklama <span className="font-normal" style={{ color: '#64748B' }}>{reason === 'other' ? '(zorunlu)' : '(isteğe bağlı)'}</span>
        </label>
        <textarea id="ab-note" value={note} maxLength={LIMITS.noteMax} rows={3} onChange={(e) => setNote(e.target.value)}
          className="w-full px-3.5 py-3 rounded-xl text-[14px] leading-[1.5] outline-none bg-white box-border resize-none focus:border-[#14798D]" style={{ border: '1px solid #CBD5E1' }} />
        <div className="text-[11.5px] mt-1.5 text-right" style={{ color: '#64748B' }}>{note.length} / {LIMITS.noteMax}</div>
      </Card>
      {err && <p role="alert" className="m-0 mt-3 text-[13px] text-center" style={{ color: '#B42318' }}>{err}</p>}
      <div className="mt-[18px]"><PrimaryBtn onClick={submit} busy={busy}>Bildirimi Gönder</PrimaryBtn></div>
      <div className="text-center mt-3.5"><button type="button" onClick={onClose} className="text-[13px]" style={{ color: '#475569' }}>Vazgeç</button></div>
    </>
  );
};

const StatusCard: React.FC<{ icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }> = ({ icon, title, text, children }) => (
  <Card className="mt-4 p-6 text-center">
    <div className="flex justify-center mb-3">{icon}</div>
    <h1 className="m-0 text-base font-bold">{title}</h1>
    <p className="text-[13.5px] mt-1.5 mb-0 leading-[1.55]" style={{ color: '#475569' }}>{text}</p>
    {children}
  </Card>
);

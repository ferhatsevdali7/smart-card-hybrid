import React, { useEffect, useState } from 'react';
import {
  CarFront, Lightbulb, DoorOpen, AlertOctagon, MessageSquare, Send, ShieldCheck,
  Loader2, CheckCircle2, XCircle, Ban, Clock, Link2, Info,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseApp';
import { functionErrorMessage, scanTagFn, sendNoticeFn } from '../lib/functionsClient';
import { NoticeType, ScanResponse } from '../types/vehicle';

/**
 * QR okutulduğunda açılan herkese açık sayfa: /t/{KOD}
 * Uygulamanın geri kalanından bağımsızdır; yalnızca sunucunun döndürdüğü
 * güvenli bilgileri gösterir. Araç sahibinin numarası bu sayfaya hiç gelmez.
 */

const NOTICES: { id: NoticeType; label: string; icon: React.ReactNode }[] = [
  { id: 'blocking', label: 'Yolu / çıkışı kapatıyor', icon: <CarFront className="w-5 h-5" /> },
  { id: 'lights', label: 'Farlar açık kalmış', icon: <Lightbulb className="w-5 h-5" /> },
  { id: 'window', label: 'Cam / kapı açık', icon: <DoorOpen className="w-5 h-5" /> },
  { id: 'alarm', label: 'Alarm / temas', icon: <AlertOctagon className="w-5 h-5" /> },
  { id: 'other', label: 'Başka bir konu', icon: <MessageSquare className="w-5 h-5" /> },
];

export const PublicTagScanPage: React.FC<{ code: string }> = ({ code }) => {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NoticeType | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
        setError(functionErrorMessage(e, 'Bilgiler alınamadı. Lütfen tekrar deneyin.'));
      }
    });
    return () => unsub();
  }, [code]);

  const send = async () => {
    if (!selected) return;
    if (selected === 'other' && !note.trim()) {
      setSendError('Lütfen kısa bir not yazın.');
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await sendNoticeFn({ code, type: selected, note: note.trim() || undefined });
      setSent(true);
    } catch (e) {
      setSendError(functionErrorMessage(e, 'Bildirim gönderilemedi. Lütfen tekrar deneyin.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <header className="px-4 py-3 flex items-center justify-center gap-2 text-xs font-bold tracking-wider text-slate-700">
        <ShieldCheck className="w-4 h-4 text-emerald-600" /> AKILLI ARAÇ KARTI
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-10">
        {!data && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500 text-sm">
            <Loader2 className="w-6 h-6 animate-spin" /> Yükleniyor...
          </div>
        )}

        {error && <StatusCard icon={<XCircle className="w-10 h-10 text-rose-500" />} title="Bir sorun oluştu" text={error} />}

        {data?.status === 'not_found' && (
          <StatusCard
            icon={<XCircle className="w-10 h-10 text-rose-500" />}
            title="Bu QR sistemimizde kayıtlı değil"
            text="Okuttuğunuz kod bizim ürettiğimiz bir etiket değil veya hatalı yazılmış."
          />
        )}

        {data?.status === 'disabled' && (
          <StatusCard
            icon={<Ban className="w-10 h-10 text-rose-500" />}
            title="Bu etiket kullanıma kapalı"
            text="Bu QR etiketi kapatılmıştır ve artık bildirim almamaktadır."
          />
        )}

        {data?.status === 'expired' && (
          <StatusCard
            icon={<Clock className="w-10 h-10 text-amber-500" />}
            title="Hizmet süresi dolmuş"
            text={data.isOwner
              ? 'Bu etiketin hizmet süresi doldu. Yenilemek için hesabınızdan bize ulaşın.'
              : 'Bu etiketin hizmet süresi dolmuştur.'}
          />
        )}

        {data?.status === 'unclaimed' && (
          <StatusCard
            icon={<Info className="w-10 h-10 text-sky-500" />}
            title="Bu etiket henüz kullanılmıyor"
            text="Bu QR etiketi henüz bir araca bağlanmamış."
          >
            <a
              href={`/?view=vehicle&claim=${encodeURIComponent(code)}`}
              className="mt-5 inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold"
            >
              <Link2 className="w-4 h-4" /> Etiketin sahibiyim, hesabıma bağla
            </a>
          </StatusCard>
        )}

        {data?.status === 'unassigned' && (
          <StatusCard
            icon={<Info className="w-10 h-10 text-sky-500" />}
            title="Bu etiket şu anda bir araca bağlı değil"
            text={data.isOwner
              ? 'Bu etiket sizin. Garajınızdan bir araca bağlayabilirsiniz.'
              : 'Araç sahibi bu etiketi şu anda kullanmıyor.'}
          >
            {data.isOwner && (
              <a href="/?view=vehicle" className="mt-5 inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-slate-900 text-white text-sm font-bold">
                Garajıma git
              </a>
            )}
          </StatusCard>
        )}

        {data?.status === 'active' && data.vehicle && (
          <div className="space-y-4 pt-2">
            {data.isOwner && (
              <div className="rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs p-3 text-center">
                Bu sizin etiketiniz. QR'ı okutan kişiler bu sayfayı görür.
              </div>
            )}

            <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5" /> Numaralar gizli tutulur
              </div>
              <div>
                <div className="inline-flex items-center bg-white rounded-xl pl-1.5 pr-4 py-1.5 border-2 border-slate-900 shadow">
                  <span className="bg-[#003399] text-white text-[9px] font-bold px-1.5 py-1.5 rounded mr-2.5 leading-none">TR</span>
                  <span className="font-mono font-black text-2xl tracking-wider">{data.vehicle.plateMasked}</span>
                </div>
                {data.vehicle.brandModel && <div className="text-sm text-slate-600 font-medium mt-2">{data.vehicle.brandModel}</div>}
              </div>
              <p className="text-[11px] text-slate-500">
                Plaka ve model, QR'ın yapıştırıldığı araçla uyuşmuyorsa bu etiket kopyalanmış olabilir.
              </p>
              {data.vehicle.parkingNote && (
                <div className="text-left rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Araç sahibinin notu</div>
                  {data.vehicle.parkingNote}
                </div>
              )}
            </div>

            {!data.vehicle.allowMessages ? (
              <StatusCard
                icon={<Info className="w-8 h-8 text-slate-400" />}
                title="Araç sahibi şu an bildirim almıyor"
                text="Bu araç için bildirim gönderme kapalı."
              />
            ) : sent ? (
              <StatusCard
                icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />}
                title="Bildiriminiz iletildi"
                text="Araç sahibine haber verdik. Sizin bilgileriniz paylaşılmadı."
              />
            ) : (
              <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="text-sm font-bold">Araç sahibine ne iletmek istersiniz?</div>
                <div className="grid grid-cols-2 gap-2">
                  {NOTICES.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { setSelected(n.id); setSendError(null); }}
                      className={`p-3 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                        n.id === 'other' ? 'col-span-2 flex-row items-center' : ''
                      } ${selected === n.id ? 'border-amber-500 bg-amber-50 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      <span className={selected === n.id ? 'text-amber-600' : 'text-slate-400'}>{n.icon}</span>
                      <span className="text-xs font-semibold">{n.label}</span>
                    </button>
                  ))}
                </div>
                {selected && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 200))}
                    rows={2}
                    placeholder={selected === 'other' ? 'Kısaca yazın (zorunlu)' : 'Eklemek istediğiniz not (isteğe bağlı)'}
                    className="w-full px-3.5 py-3 rounded-2xl border border-slate-200 text-sm outline-none focus:border-amber-500"
                  />
                )}
                {sendError && <p className="text-xs text-rose-600">{sendError}</p>}
                <button
                  onClick={send}
                  disabled={!selected || sending}
                  className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Bildirimi Gönder
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Telefon numaranız veya adınız istenmez, araç sahibine gösterilmez.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-[10px] text-slate-400 pb-6">
        Etiket kodu: <span className="font-mono">{code.replace(/(.{4})(?=.)/g, '$1-')}</span>
      </footer>
    </div>
  );
};

const StatusCard: React.FC<{ icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }> = ({ icon, title, text, children }) => (
  <div className="mt-6 rounded-3xl bg-white border border-slate-200 shadow-sm p-6 text-center">
    <div className="flex justify-center mb-3">{icon}</div>
    <h1 className="text-base font-bold">{title}</h1>
    <p className="text-sm text-slate-600 mt-1.5">{text}</p>
    {children}
  </div>
);

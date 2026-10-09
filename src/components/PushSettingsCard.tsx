import React, { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2, CheckCircle2, Share, Send } from 'lucide-react';
import { PushState, disablePushOnThisDevice, enablePush, getPushState } from '../lib/pushService';
import { functionErrorMessage, sendTestPushFn } from '../lib/functionsClient';

/**
 * Garaj ekranındaki "Telefonuma bildirim gönder" kartı.
 * Bildirim tercihi cihaz bazındadır: her telefon kendi iznini verir.
 */
export const PushSettingsCard: React.FC<{ uid: string; isDark: boolean }> = ({ uid, isDark }) => {
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    getPushState(uid).then((s) => alive && setState(s)).catch(() => alive && setState('unsupported'));
    return () => { alive = false; };
  }, [uid]);

  const turnOn = async () => {
    setBusy(true); setMsg(null);
    try {
      const s = await enablePush(uid);
      setState(s);
      if (s === 'on') setMsg({ text: 'Bildirimler bu cihazda açıldı.', ok: true });
      if (s === 'denied') setMsg({ text: 'Bildirim izni verilmedi.', ok: false });
    } catch {
      setMsg({ text: 'Bildirimler açılamadı. Lütfen tekrar deneyin.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true); setMsg(null);
    try {
      await disablePushOnThisDevice(uid);
      setState('off');
      setMsg({ text: 'Bu cihaza artık bildirim gönderilmeyecek.', ok: true });
    } catch {
      setMsg({ text: 'İşlem tamamlanamadı.', ok: false });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await sendTestPushFn({});
      setMsg(res.sent > 0
        ? { text: 'Deneme bildirimi gönderildi. Birkaç saniye içinde gelmeli.', ok: true }
        : { text: 'Kayıtlı cihaz bulunamadı. Bildirimleri kapatıp yeniden açın.', ok: false });
    } catch (e) {
      setMsg({ text: functionErrorMessage(e), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const box = `rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const btn = 'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50';

  if (state === 'loading') return null;

  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${state === 'on' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
          {state === 'on' ? <BellRing className="w-4.5 h-4.5" /> : <BellOff className="w-4.5 h-4.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Telefonuma bildirim gönder</div>
          <p className={`text-xs mt-0.5 ${muted}`}>
            {state === 'on' && 'Bu cihazda açık. QR\'ınız okutulup bildirim gönderildiğinde anında haber alırsınız.'}
            {state === 'off' && 'Biri QR\'ınızı okutup bildirim gönderdiğinde telefonunuza anında haber verelim.'}
            {state === 'denied' && 'Bu tarayıcıda bildirim izni kapalı. Tarayıcı ayarlarından bu site için bildirimlere izin verin, sonra sayfayı yenileyin.'}
            {state === 'unsupported' && 'Bu tarayıcı bildirimleri desteklemiyor. Android\'de Chrome kullanmanızı öneririz.'}
            {state === 'not-configured' && 'Bildirim servisi henüz yapılandırılmadı.'}
            {state === 'ios-install' && 'iPhone\'da bildirim alabilmek için siteyi ana ekrana eklemeniz gerekir.'}
          </p>
        </div>
      </div>

      {state === 'ios-install' && (
        <ol className={`text-xs space-y-1 pl-4 list-decimal ${muted}`}>
          <li>Safari'de alttaki <Share className="inline w-3.5 h-3.5 -mt-0.5" /> Paylaş düğmesine dokunun.</li>
          <li>"Ana Ekrana Ekle"yi seçin.</li>
          <li>Ana ekrandaki simgeden açıp giriş yapın, bu kartta "Aç"a dokunun.</li>
        </ol>
      )}

      {msg && <p className={`text-xs flex items-center gap-1.5 ${msg.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{msg.ok && <CheckCircle2 className="w-3.5 h-3.5" />}{msg.text}</p>}

      {(state === 'off' || state === 'on') && (
        <div className="flex gap-2">
          {state === 'off' ? (
            <button onClick={turnOn} disabled={busy} className={`${btn} flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Bildirimleri Aç
            </button>
          ) : (
            <>
              <button onClick={test} disabled={busy} className={`${btn} flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Deneme Bildirimi
              </button>
              <button onClick={turnOff} disabled={busy} className={`${btn} border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-50'}`}>
                Kapat
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

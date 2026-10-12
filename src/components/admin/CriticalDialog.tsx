// Kritik işlem onayı: sebep (zorunlu) + şifre ya da Google ile yeniden giriş + bugünkü kalan hak.
// Kullanım: müşteri hesabı silme, Çöp Kutusu'ndan kalıcı silme. Kurallar sunucuda da zorlanır.

import React, { useEffect, useState } from 'react';
import { AdminLang } from './adminUi';
import { Btn, Dialog, errorText } from './lifecycleUi';
import { hasPasswordProvider, reauthenticate } from '../../lib/lifecycleService';
import { myQuota } from '../../lib/teamService';

type Quota = { used: number; limit: number | null; remaining: number | null; lifted: boolean };

export const CriticalDialog: React.FC<{
  lang: AdminLang;
  title: string;
  kind: 'user_delete' | 'purge';
  /** Bu işlemin harcayacağı hak (kalıcı silmede seçili QR sayısı) */
  units: number;
  confirmLabel: string;
  children: React.ReactNode;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}> = ({ lang, title, kind, units, confirmLabel, children, onConfirm, onClose }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const usePassword = hasPasswordProvider();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    let alive = true;
    myQuota(kind).then((q) => { if (alive) setQuota(q); }).catch(() => undefined);
    return () => { alive = false; };
  }, [kind]);

  const reasonOk = reason.trim().length >= 5;
  const overQuota = !!quota && quota.remaining !== null && units > quota.remaining;
  const canSubmit = !busy && reasonOk && (!usePassword || !!password) && !overQuota;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await reauthenticate(usePassword ? password : undefined);
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      setErr(code.includes('wrong-password') || code.includes('invalid-credential') ? L('Şifre hatalı.', 'Wrong password.')
        : code.includes('too-many-requests') ? L('Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.', 'Too many attempts. Try again later.')
          : code.includes('popup-closed') ? L('Doğrulama penceresi kapatıldı.', 'The sign-in window was closed.')
            : L('Kimlik doğrulanamadı.', 'Could not verify your identity.'));
      setBusy(false);
      return;
    }
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      const msg = (e as { message?: string }).message || '';
      setErr(msg.includes('REAUTH_REQUIRED') ? L('Doğrulama süresi doldu, tekrar deneyin.', 'Verification expired, try again.') : errorText(e, lang));
      myQuota(kind).then(setQuota).catch(() => undefined);
      setBusy(false);
    }
  };

  const unitText = kind === 'purge' ? 'QR' : L('hesap', 'accounts');
  return (
    <Dialog
      title={title}
      icon={kind === 'purge' ? 'trash' : 'userX'}
      danger
      width={500}
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-[12px] sm:mr-auto" style={{ color: 'var(--a-faint)' }}>
            {quota && quota.limit !== null && (
              <>{L('Bugün kalan hakkınız', 'Remaining today')}: <span style={{ color: overQuota || (quota.remaining ?? 0) <= Math.ceil((quota.limit || 1) * 0.3) ? '#E3A857' : 'var(--a-text2)' }}>{quota.remaining} / {quota.limit} {unitText}</span></>
            )}
            {quota?.lifted && L('Bugünkü sınırınız süper yönetici tarafından kaldırıldı', 'Your daily limit was lifted today')}
          </span>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
            <Btn variant="dangerSolid" disabled={!canSubmit} onClick={submit}>
              {busy ? L('İşleniyor…', 'Working…') : usePassword ? confirmLabel : L('Google ile doğrula ve onayla', 'Verify with Google')}
            </Btn>
          </div>
        </div>
      )}
    >
      {children}
      <label className="flex flex-col gap-1.5 mt-5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
        <span>{L('Sebep', 'Reason')} <span style={{ color: 'var(--a-faint)' }}>{L('(zorunlu, denetim kaydına yazılır)', '(required, logged)')}</span></span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 160))}
          rows={2}
          maxLength={160}
          className="px-3 py-2.5 rounded-lg text-[13.5px] outline-none resize-none"
          style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
          placeholder={kind === 'purge' ? L('Örn. Basım hatalı, etiketler imha edildi', 'e.g. misprint, labels destroyed') : L('Örn. Müşteri e-postayla hesabının silinmesini istedi', 'e.g. customer asked by email')}
          autoFocus
        />
      </label>
      {usePassword ? (
        <label className="flex flex-col gap-1.5 mt-4 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
          {L('Şifreniz', 'Your password')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="h-10 px-3 rounded-lg text-[14px] outline-none"
            style={{ background: 'var(--a-field)', border: `1px solid ${err ? 'var(--a-danger-line)' : 'var(--a-line3)'}`, color: 'var(--a-text)' }}
          />
        </label>
      ) : (
        <p className="m-0 mt-4 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Hesabınızda şifre tanımlı değil; onay için Google hesabınızla yeniden giriş yapmanız istenecek.', 'You will be asked to sign in with Google again.')}</p>
      )}
      {overQuota && quota && (
        <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: '#E3A857' }}>
          {L(`Bugün en fazla ${quota.remaining} ${unitText} daha işleyebilirsiniz; seçimi azaltın ya da süper yöneticiden kısıtı kaldırmasını isteyin.`, `You can only process ${quota.remaining} more today.`)}
        </p>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
    </Dialog>
  );
};

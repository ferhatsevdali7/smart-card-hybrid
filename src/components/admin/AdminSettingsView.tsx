import React, { useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../../lib/firebase';
import {
  ActivityItem, AdminProfile, AdminSessionRecord, changeAdminPassword, checkPassword, fetchMyActivity,
  hasPasswordLogin, imageFileToAvatar, revokeAdminSession, revokeOtherAdminSessions, saveAdminProfile, setAdminPassword,
} from '../../lib/adminAccountService';
import { formatCode } from '../../lib/functionsClient';
import { APP_VERSION } from '../../lib/appInfo';
import { AdminLang, Avatar, Icon, IconName, MONO, formatAgo, formatClock, formatRemaining, useNow } from './adminUi';
import type { SettingsTab } from './ProfileMenu';

interface Props {
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onBack: () => void;
  lang: AdminLang;
  uid: string;
  email: string;
  role: string;
  profile: AdminProfile | null;
  displayName: string;
  sessions: AdminSessionRecord[];
  sessionsState?: 'loading' | 'ok' | 'error';
  currentSessionId: string;
}

const TABS: { id: SettingsTab; icon: IconName; tr: string; en: string }[] = [
  { id: 'profile', icon: 'user', tr: 'Profil', en: 'Profile' },
  { id: 'security', icon: 'key', tr: 'Güvenlik', en: 'Security' },
  { id: 'sessions', icon: 'devices', tr: 'Aktif oturumlar', en: 'Active sessions' },
  { id: 'activity', icon: 'activity', tr: 'Hesap etkinliğim', en: 'My activity' },
  { id: 'help', icon: 'help', tr: 'Yardım ve kılavuz', en: 'Help & guide' },
];

// ---------------------------------------------------------------- ortak parçalar
const card = { background: 'var(--a-surface)', border: '1px solid var(--a-line)' } as React.CSSProperties;
const fieldStyle = { background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' } as React.CSSProperties;
const fieldCls = 'h-10 px-3 rounded-lg text-sm outline-none w-full focus:border-[var(--a-accent)]';
const labelCls = 'text-[12.5px] font-medium';
const btnPrimary = 'h-[38px] px-[18px] rounded-lg text-[13.5px] font-semibold text-white disabled:opacity-50 transition-colors bg-[var(--a-primary)] hover:bg-[var(--a-primary-hover)]';
const btnGhost = 'h-[38px] px-4 rounded-lg text-[13.5px] transition-colors hover:bg-[var(--a-hover)] disabled:opacity-50';
const btnOutline = 'h-9 px-3.5 rounded-lg text-[13px] transition-colors hover:bg-[var(--a-hover)] disabled:opacity-50';

const Soon: React.FC<{ lang: AdminLang }> = ({ lang }) => (
  <span className="text-[10.5px] rounded-full px-[7px] py-px" style={{ border: '1px solid var(--a-line2)', color: 'var(--a-faint)' }}>{lang === 'tr' ? 'Yakında' : 'Soon'}</span>
);

const Notice: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
  <p role="status" className="text-[12.5px] flex items-center gap-1.5" style={{ color: ok ? 'var(--a-success)' : 'var(--a-danger)' }}>
    {ok && <Icon name="check" size={14} />}{text}
  </p>
);

const SectionHead: React.FC<{ title: string; desc: string; action?: React.ReactNode }> = ({ title, desc, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-0 text-[13px]" style={{ color: 'var(--a-muted)' }}>{desc}</p>
    </div>
    {action}
  </div>
);

// ================================================================= ANA GÖRÜNÜM
export const AdminSettingsView: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);

  return (
    <div className="flex flex-wrap gap-6 md:gap-10 px-4 py-5 md:px-10 md:py-7">
      {/* Ayarlar menüsü */}
      <aside className="w-full md:w-[232px] md:shrink-0 flex flex-col gap-0.5">
        <button type="button" onClick={p.onBack} className="self-start flex items-center gap-1.5 text-[13px] mb-3.5 hover:underline" style={{ color: 'var(--a-muted)' }}>
          <Icon name="chevronLeft" size={16} /> {L('Panele dön', 'Back to console')}
        </button>
        <h1 className="m-0 mb-3.5 text-xl font-semibold">{L('Profil ve Ayarlar', 'Profile & Settings')}</h1>
        <div className="flex md:flex-col gap-1 md:gap-0.5 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0">
          {TABS.map((t) => {
            const on = p.tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => p.onTab(t.id)}
                className="shrink-0 flex items-center gap-2.5 h-10 md:h-[38px] px-3 md:px-2.5 rounded-lg text-[13.5px] whitespace-nowrap transition-colors hover:bg-[var(--a-hover)]"
                style={{ background: on ? 'var(--a-active)' : undefined, color: on ? 'var(--a-text)' : 'var(--a-text2)', fontWeight: on ? 600 : 400 }}
              >
                <span style={{ color: on ? 'var(--a-accent)' : 'currentColor' }}><Icon name={t.icon} /></span>
                {L(t.tr, t.en)}
              </button>
            );
          })}
        </div>
        <div className="hidden md:block">
          <div className="px-2.5 pt-[18px] pb-2 text-[11px] font-medium uppercase tracking-[0.6px]" style={{ color: 'var(--a-faint)' }}>{L('Sonraki turlarda', 'Coming next')}</div>
          {[L('Bildirim tercihleri', 'Notifications'), L('Ekip yönetimi', 'Team'), L('Sistem ayarları', 'System settings')].map((t) => (
            <div key={t} className="flex items-center justify-between h-[34px] px-2.5 text-[13px]" style={{ color: 'var(--a-faint)' }}>
              <span>{t}</span><Soon lang={p.lang} />
            </div>
          ))}
        </div>
      </aside>

      {/* İçerik */}
      <section className="flex-[999_1_560px] min-w-0 max-w-[760px] flex flex-col gap-5 md:pt-[38px]">
        {p.tab === 'profile' && <ProfileTab {...p} />}
        {p.tab === 'security' && <SecurityTab {...p} />}
        {p.tab === 'sessions' && <SessionsTab {...p} />}
        {p.tab === 'activity' && <ActivityTab {...p} />}
        {p.tab === 'help' && <HelpTab {...p} />}
      </section>
    </div>
  );
};

// ================================================================= PROFİL
const ProfileTab: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const initial = useMemo(() => ({
    displayName: p.profile?.displayName || p.displayName,
    phone: p.profile?.phone || '',
    photoDataUrl: p.profile?.photoDataUrl || null,
  }), [p.profile, p.displayName]);
  const [form, setForm] = useState<AdminProfile>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(initial); }, [initial]);
  const dirty = form.displayName !== initial.displayName || form.phone !== initial.phone || form.photoDataUrl !== initial.photoDataUrl;

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setMsg(null);
    try {
      const data = await imageFileToAvatar(file);
      setForm((f) => ({ ...f, photoDataUrl: data }));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message === 'type' ? L('Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.', 'Only JPG, PNG or WEBP.') : L('Fotoğraf çok büyük.', 'Photo is too large.') });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (!form.displayName.trim()) { setMsg({ ok: false, text: L('Ad soyad boş bırakılamaz.', 'Name is required.') }); return; }
    setSaving(true); setMsg(null);
    try {
      await saveAdminProfile(p.uid, form);
      setMsg({ ok: true, text: L('Profiliniz kaydedildi.', 'Profile saved.') });
    } catch {
      setMsg({ ok: false, text: L('Kaydedilemedi. Lütfen tekrar deneyin.', 'Could not save. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHead title={L('Profil', 'Profile')} desc={L('Panelde ve denetim kayıtlarında görünen bilgileriniz.', 'How you appear across the console and audit logs.')} />
      <div className="rounded-[14px]" style={card}>
        <div className="flex flex-wrap items-center gap-[18px] px-6 py-5" style={{ borderBottom: '1px solid var(--a-line)' }}>
          <Avatar name={form.displayName || p.email} photo={form.photoDataUrl} size={64} />
          <div className="flex flex-col gap-2">
            <span className="text-[13px]" style={{ color: 'var(--a-muted)' }}>{L('Profil fotoğrafı · JPG veya PNG', 'Profile photo · JPG or PNG')}</span>
            <div className="flex gap-2">
              <input ref={fileRef} id="admin-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
              <label htmlFor="admin-photo" className={`${btnOutline} inline-flex items-center cursor-pointer`} style={{ border: '1px solid var(--a-line3)', background: 'var(--a-hover)' }}>
                {L('Fotoğraf yükle', 'Upload photo')}
              </label>
              {form.photoDataUrl && (
                <button type="button" onClick={() => setForm((f) => ({ ...f, photoDataUrl: null }))} className={btnOutline} style={{ color: 'var(--a-muted)' }}>
                  {L('Kaldır', 'Remove')}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-[18px] px-6 py-[22px]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adm-name" className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('Ad soyad', 'Full name')}</label>
            <input id="adm-name" value={form.displayName} maxLength={60} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={fieldCls} style={fieldStyle} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adm-phone" className={labelCls} style={{ color: 'var(--a-text2)' }}>
              {L('Telefon', 'Phone')} <span className="font-normal" style={{ color: 'var(--a-faint)' }}>{L('(ekip içi iletişim)', '(team contact)')}</span>
            </label>
            <input id="adm-phone" value={form.phone} inputMode="tel" maxLength={20} placeholder="+90 5__ ___ __ __" onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldCls} style={{ ...fieldStyle, fontFamily: MONO, fontSize: 13.5 }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="adm-email" className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('E-posta', 'Email')}</label>
            <div className="flex items-center gap-2 h-10 px-3 rounded-lg" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)', color: 'var(--a-muted)' }}>
              <Icon name="lock" size={15} />
              <input id="adm-email" value={p.email} readOnly className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm" style={{ color: 'var(--a-muted)' }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--a-faint)' }}>{L('Giriş adresinizdir; değiştirmek için başka bir süper yöneticiye başvurun.', 'Your sign-in address; ask another super admin to change it.')}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('Rol', 'Role')}</span>
            <div className="flex items-center h-10">
              <span className="text-[12.5px] font-medium px-2.5 py-1 rounded-full" style={{ color: 'var(--a-accent)', background: 'var(--a-accent-tint)' }}>{p.role}</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--a-faint)' }}>{L('Roller Ekip yönetimi bölümünden verilir.', 'Roles are assigned under Team.')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 py-3.5" style={{ borderTop: '1px solid var(--a-line)' }}>
          {msg && <div className="mr-auto"><Notice {...msg} /></div>}
          <button type="button" disabled={!dirty || saving} onClick={() => { setForm(initial); setMsg(null); }} className={btnGhost} style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <button type="button" disabled={!dirty || saving} onClick={save} className={btnPrimary}>{saving ? L('Kaydediliyor…', 'Saving…') : L('Değişiklikleri kaydet', 'Save changes')}</button>
        </div>
      </div>
    </>
  );
};

// ================================================================= GÜVENLİK
const SecurityTab: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  // Google ile giriş yapan hesaplarda henüz şifre yoktur: önce "Şifre belirle" gösterilir.
  const [hasPw, setHasPw] = useState<boolean>(() => hasPasswordLogin(auth.currentUser));
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const checks = checkPassword(next, hasPw ? current : '');
  if (!hasPw) checks.different = next.length > 0;
  const score = [checks.length, checks.cases, checks.digit, checks.different].filter(Boolean).length;
  const allOk = score === 4 && (!hasPw || current.length > 0) && next === repeat;
  const strength = next ? [L('Zayıf', 'Weak'), L('Zayıf', 'Weak'), L('Orta', 'Fair'), L('İyi', 'Good'), L('Güçlü', 'Strong')][score] : '';
  const barColor = score >= 4 ? 'var(--a-success)' : score >= 3 ? 'var(--a-accent)' : 'var(--a-danger)';

  const errorText = (code: string) =>
    code === 'wrong-password' ? L('Mevcut şifre hatalı.', 'Current password is incorrect.')
    : code === 'too-many-requests' ? L('Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.', 'Too many attempts. Try again in a few minutes.')
    : code === 'weak-password' ? L('Yeni şifre yeterince güçlü değil.', 'New password is too weak.')
    : code === 'popup-blocked' ? L('Doğrulama penceresi engellendi. Tarayıcıda açılır pencerelere izin verip tekrar deneyin.', 'The verification popup was blocked. Allow popups and try again.')
    : code === 'cancelled' ? L('Google doğrulaması tamamlanmadı.', 'Google verification was cancelled.')
    : code === 'in-use' ? L('Bu e-posta için başka bir şifreli hesap zaten var.', 'A password account already exists for this email.')
    : code === 'not-allowed' ? L('E-posta/şifre ile giriş Firebase\'de kapalı.', 'Email/password sign-in is disabled in Firebase.')
    : L('İşlem tamamlanamadı. Lütfen tekrar deneyin.', 'Could not complete. Please try again.');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allOk) return;
    setBusy(true); setMsg(null);
    try {
      if (hasPw) {
        await changeAdminPassword(current, next);
        await revokeOtherAdminSessions(p.currentSessionId, p.sessions).catch(() => 0);
        setMsg({ ok: true, text: L('Şifreniz güncellendi. Diğer cihazlardaki oturumlar kapatıldı.', 'Password updated. Other sessions were signed out.') });
      } else {
        await setAdminPassword(next);
        setHasPw(true);
        setMsg({ ok: true, text: L('Şifreniz belirlendi. Artık Google\'a ek olarak e-posta ve şifrenizle de giriş yapabilirsiniz.', 'Password set. You can now also sign in with email and password.') });
      }
      setCurrent(''); setNext(''); setRepeat('');
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'already') { setHasPw(true); setMsg({ ok: false, text: L('Bu hesapta zaten şifre var; aşağıdan değiştirebilirsiniz.', 'This account already has a password.') }); }
      else setMsg({ ok: false, text: errorText(code) });
    } finally {
      setBusy(false);
    }
  };

  const rule = (ok: boolean, text: string) => (
    <li className="flex items-center gap-2" style={{ color: ok ? 'var(--a-text2)' : 'var(--a-muted)' }}>
      {ok ? <span style={{ color: 'var(--a-success)' }}><Icon name="check" size={14} /></span>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="7" /></svg>}
      {text}
    </li>
  );

  return (
    <>
      <SectionHead title={L('Güvenlik', 'Security')} desc={L('Şifreniz ve hesabınızı koruyan ayarlar.', 'Your password and account protection.')} />

      <form onSubmit={submit} className="rounded-[14px]" style={card}>
        <div className="px-6 pt-[18px] pb-1">
          <h3 className="m-0 text-[15px] font-semibold">{hasPw ? L('Şifre değiştir', 'Change password') : L('Şifre belirle', 'Set a password')}</h3>
          <p className="mt-1 mb-0 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
            {hasPw
              ? L('Değişiklikten sonra diğer cihazlardaki oturumlarınız kapatılır.', 'Other sessions are signed out after the change.')
              : L('Bu hesap şu an yalnızca Google ile giriş yapıyor. Şifre belirlerseniz e-posta ve şifrenizle de giriş yapabilirsiniz. Google bir kez daha kimliğinizi doğrulamak isteyebilir.', 'This account currently signs in only with Google. Set a password to also sign in with email and password. Google may ask you to verify once more.')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 px-6 pt-4 pb-5">
          {hasPw && (
            <div className="sm:col-span-2 flex flex-col gap-1.5 sm:max-w-[352px]">
              <label htmlFor="pw-current" className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('Mevcut şifre', 'Current password')}</label>
              <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={fieldCls} style={fieldStyle} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pw-new" className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('Yeni şifre', 'New password')}</label>
            <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={fieldCls} style={fieldStyle} />
            <div className="flex gap-1 mt-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <span key={i} className="flex-1 h-1 rounded-sm" style={{ background: next && i < score ? barColor : 'var(--a-line2)' }} />)}
            </div>
            {strength && <span className="text-xs" style={{ color: barColor }}>{strength}</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pw-repeat" className={labelCls} style={{ color: 'var(--a-text2)' }}>{L('Yeni şifre (tekrar)', 'Repeat new password')}</label>
            <input id="pw-repeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={fieldCls} style={{ ...fieldStyle, borderColor: repeat && repeat !== next ? 'var(--a-danger)' : 'var(--a-line3)' }} />
            {repeat && repeat !== next && <span className="text-xs" style={{ color: 'var(--a-danger)' }}>{L('Şifreler eşleşmiyor.', 'Passwords do not match.')}</span>}
          </div>
          <ul className="sm:col-span-2 m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-[12.5px]">
            {rule(checks.length, L('En az 10 karakter', 'At least 10 characters'))}
            {rule(checks.cases, L('Büyük ve küçük harf', 'Upper and lower case'))}
            {rule(checks.digit, L('En az bir rakam', 'At least one number'))}
            {hasPw && rule(checks.different, L('Eski şifreden farklı', 'Different from current'))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 py-3.5" style={{ borderTop: '1px solid var(--a-line)' }}>
          {msg && <div className="mr-auto"><Notice {...msg} /></div>}
          <button type="submit" disabled={!allOk || busy} className={btnPrimary}>
            {busy ? L('Kaydediliyor…', 'Saving…') : hasPw ? L('Şifreyi güncelle', 'Update password') : L('Şifreyi belirle', 'Set password')}
          </button>
        </div>
      </form>

      <FutureCard lang={p.lang} icon="phone" title={L('İki adımlı doğrulama', 'Two-step verification')} desc={L('Girişte şifrenize ek olarak telefonunuza gelen kod istenir.', 'A code sent to your phone is required at sign-in.')} />
      <FutureCard lang={p.lang} icon="clock" title={L('Hareketsizlikte otomatik çıkış', 'Auto sign-out when idle')} desc={L('Şu an oturum 8 saat sonra kapanıyor. İşlem yapılmadığında daha erken kapatılabilecek.', 'Sessions currently end after 8 hours. Idle sessions will end sooner.')} />
    </>
  );
};

const FutureCard: React.FC<{ lang: AdminLang; icon: IconName; title: string; desc: string }> = ({ lang, icon, title, desc }) => (
  <div className="rounded-[14px] px-6 py-[18px] flex items-center gap-[18px]" style={card}>
    <div className="w-10 h-10 shrink-0 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--a-hover)', color: 'var(--a-muted)' }}><Icon name={icon} size={19} /></div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2"><h3 className="m-0 text-[15px] font-semibold">{title}</h3><Soon lang={lang} /></div>
      <p className="mt-1 mb-0 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{desc}</p>
    </div>
  </div>
);

// ================================================================= OTURUMLAR
const SessionsTab: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const now = useNow();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const others = p.sessions.filter((s) => s.id !== p.currentSessionId);
  const ordered = [...p.sessions].sort((a, b) => (a.id === p.currentSessionId ? -1 : b.id === p.currentSessionId ? 1 : 0));

  const closeOne = async (id: string) => {
    setBusy(id); setMsg(null);
    try { await revokeAdminSession(id); setMsg({ ok: true, text: L('Oturum kapatıldı.', 'Session signed out.') }); }
    catch { setMsg({ ok: false, text: L('Oturum kapatılamadı.', 'Could not sign out session.') }); }
    finally { setBusy(null); }
  };
  const closeAll = async () => {
    setBusy('all'); setMsg(null);
    try {
      const n = await revokeOtherAdminSessions(p.currentSessionId, p.sessions);
      setMsg({ ok: true, text: L(`${n} cihazdaki oturum kapatıldı.`, `Signed out of ${n} device(s).`) });
      setConfirmAll(false);
    } catch { setMsg({ ok: false, text: L('İşlem tamamlanamadı.', 'Could not complete.') }); }
    finally { setBusy(null); }
  };

  return (
    <>
      <SectionHead
        title={L('Aktif oturumlar', 'Active sessions')}
        desc={L('Hesabınızın şu an açık olduğu cihazlar. Tanımadığınız bir cihaz görürseniz kapatın ve şifrenizi değiştirin.', 'Devices where your account is signed in. If you see one you do not recognise, sign it out and change your password.')}
        action={others.length > 0 && !confirmAll ? (
          <button type="button" onClick={() => setConfirmAll(true)} className="h-[38px] px-3.5 rounded-lg text-[13px] font-medium transition-colors hover:bg-[var(--a-danger-tint)]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
            {L('Diğer tüm cihazlardan çıkış yap', 'Sign out all other devices')}
          </button>
        ) : undefined}
      />

      {confirmAll && (
        <div className="rounded-[12px] p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--a-danger-tint)', border: '1px solid var(--a-danger-line)' }}>
          <span className="flex-1 min-w-[220px] text-[13px]" style={{ color: 'var(--a-text)' }}>{L(`Bu cihaz dışındaki ${others.length} oturum kapatılacak.`, `${others.length} other session(s) will be signed out.`)}</span>
          <button type="button" onClick={() => setConfirmAll(false)} className={btnGhost} style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <button type="button" disabled={busy === 'all'} onClick={closeAll} className="h-[38px] px-4 rounded-lg text-[13.5px] font-semibold text-white disabled:opacity-50" style={{ background: '#B42318' }}>{L('Evet, kapat', 'Yes, sign out')}</button>
        </div>
      )}
      {msg && <Notice {...msg} />}

      <div className="rounded-[14px] overflow-hidden" style={card}>
        {p.sessionsState === 'error' && (
          <p className="m-0 px-6 py-5 text-[13px]" style={{ color: 'var(--a-danger)' }}>{L('Oturum listesi okunamadı. Sayfayı yenileyin; sorun sürerse bize bildirin.', 'Could not load sessions. Refresh the page.')}</p>
        )}
        {p.sessionsState !== 'error' && ordered.length === 0 && (
          <p className="m-0 px-6 py-5 text-[13px]" style={{ color: 'var(--a-muted)' }}>
            {p.sessionsState === 'ok' ? L('Bu cihazın oturum kaydı henüz oluşmadı. Birkaç saniye sonra tekrar bakın.', 'No session record yet. Check again in a few seconds.') : L('Oturum bilgisi yükleniyor…', 'Loading sessions…')}
          </p>
        )}
        {ordered.map((s, i) => {
          const isMe = s.id === p.currentSessionId;
          const isPhone = /Android|iPhone|iPad/.test(s.device);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-4 px-6 py-[18px]" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
              <div className="w-11 h-11 shrink-0 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--a-hover)', color: 'var(--a-text2)' }}>
                <Icon name={isPhone ? 'phone' : 'laptop'} size={20} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{s.device}</span>
                  {isMe && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: 'var(--a-success)', background: 'var(--a-success-tint)' }}>{L('Bu cihaz', 'This device')}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-[18px] gap-y-0.5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
                  <span>{L('Giriş', 'Signed in')}: {formatClock(s.createdAt, p.lang)}</span>
                  <span>{L('Son etkinlik', 'Last active')}: {isMe ? L('şimdi', 'now') : formatAgo(s.lastActiveAt, p.lang)}</span>
                  {s.expiresAt && <span>{L('Kalan süre', 'Time left')}: <span style={{ fontFamily: MONO, color: 'var(--a-text2)' }}>{formatRemaining(s.expiresAt.getTime() - now, p.lang)}</span></span>}
                </div>
              </div>
              {!isMe && (
                <button type="button" disabled={busy === s.id} onClick={() => closeOne(s.id)} className={btnOutline} style={{ border: '1px solid var(--a-line3)', background: 'var(--a-hover)', color: 'var(--a-text)' }}>
                  {L('Oturumu kapat', 'Sign out')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="m-0 flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
        <span className="mt-px"><Icon name="info" size={15} /></span>
        {L('Her oturum en geç 8 saat sonra kendiliğinden kapanır. Hesabınızın ele geçirildiğinden şüpheleniyorsanız şifrenizi değiştirin; bu, tüm cihazlardaki girişleri geçersiz kılar.',
           'Sessions end automatically after 8 hours. If you suspect your account is compromised, change your password; this invalidates sign-ins on all devices.')}
      </p>
    </>
  );
};

// ================================================================= ETKİNLİK
type Filter = 'all' | 'batch' | 'tag' | 'session';

const ActivityTab: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(50);

  useEffect(() => {
    let alive = true;
    fetchMyActivity(p.uid).then((list) => alive && setItems(list)).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [p.uid]);

  const filtered = (items || []).filter((i) => filter === 'all' || i.kind === filter);
  const visible = filtered.slice(0, shown);

  const groups: { day: string; list: ActivityItem[] }[] = [];
  visible.forEach((i) => {
    const day = dayLabel(i.at, p.lang);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.list.push(i); else groups.push({ day, list: [i] });
  });

  const chip = (id: Filter, label: string) => {
    const on = filter === id;
    return (
      <button key={id} type="button" role="radio" aria-checked={on} onClick={() => { setFilter(id); setShown(50); }}
        className="h-8 px-3 rounded-full text-[12.5px] whitespace-nowrap transition-colors"
        style={{ border: `1px solid ${on ? 'var(--a-accent)' : 'var(--a-line2)'}`, background: on ? 'var(--a-accent-tint)' : 'transparent', color: on ? 'var(--a-accent)' : 'var(--a-text2)', fontWeight: on ? 500 : 400 }}>
        {label}
      </button>
    );
  };

  return (
    <>
      <SectionHead title={L('Hesap etkinliğim', 'My activity')} desc={L('Bu hesapla yapılan işlemler. Kayıtlar değiştirilemez ve silinemez.', 'Actions taken with this account. Records cannot be changed or deleted.')} />
      <div role="radiogroup" aria-label={L('Filtre', 'Filter')} className="flex gap-1.5 overflow-x-auto pb-0.5">
        {chip('all', L('Tümü', 'All'))}
        {chip('batch', L('Üretim', 'Production'))}
        {chip('tag', L('Etiket işlemleri', 'Tag actions'))}
        {chip('session', L('Oturum', 'Sessions'))}
      </div>

      <div className="rounded-[14px] overflow-hidden" style={card}>
        {error && <p className="m-0 px-6 py-5 text-[13px]" style={{ color: 'var(--a-danger)' }}>{L('Kayıtlar yüklenemedi.', 'Could not load activity.')}</p>}
        {!error && items === null && <p className="m-0 px-6 py-5 text-[13px]" style={{ color: 'var(--a-muted)' }}>{L('Yükleniyor…', 'Loading…')}</p>}
        {!error && items !== null && filtered.length === 0 && <p className="m-0 px-6 py-5 text-[13px]" style={{ color: 'var(--a-muted)' }}>{L('Bu filtrede kayıt yok.', 'No records for this filter.')}</p>}
        {groups.map((g) => (
          <div key={g.day}>
            <div className="px-6 py-2.5 text-[11.5px] font-medium uppercase tracking-[0.4px]" style={{ background: 'var(--a-surface2)', color: 'var(--a-faint)' }}>{g.day}</div>
            {g.list.map((i) => {
              const d = describe(i, p.lang);
              return (
                <div key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3.5" style={{ borderTop: '1px solid var(--a-line)' }}>
                  <span className="w-11 text-[12.5px]" style={{ fontFamily: MONO, color: 'var(--a-muted)' }}>
                    {i.at.toLocaleTimeString(p.lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{ background: d.tint, color: d.color }}><Icon name={d.icon} size={15} /></span>
                  <span className="flex-1 min-w-[160px] text-sm">{d.text}{d.extra && <span style={{ color: 'var(--a-muted)' }}> · {d.extra}</span>}</span>
                  <span className="text-[12.5px] truncate max-w-full" style={{ fontFamily: i.kind === 'session' ? undefined : MONO, color: i.kind === 'session' ? 'var(--a-muted)' : 'var(--a-text2)' }}>{d.target}</span>
                </div>
              );
            })}
          </div>
        ))}
        {filtered.length > shown && (
          <div className="flex justify-center px-6 py-3" style={{ borderTop: '1px solid var(--a-line)' }}>
            <button type="button" onClick={() => setShown((n) => n + 50)} className={btnGhost} style={{ color: 'var(--a-text2)' }}>{L('Daha eski kayıtları göster', 'Show older')}</button>
          </div>
        )}
      </div>
    </>
  );
};

function dayLabel(d: Date, lang: AdminLang): string {
  const today = new Date();
  const y = new Date(today.getTime() - 86400000);
  const full = d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  if (d.toDateString() === today.toDateString()) return `${lang === 'tr' ? 'Bugün' : 'Today'} · ${full}`;
  if (d.toDateString() === y.toDateString()) return `${lang === 'tr' ? 'Dün' : 'Yesterday'} · ${full}`;
  return full;
}

function describe(i: ActivityItem, lang: AdminLang): { text: string; extra?: string; target: string; icon: IconName; color: string; tint: string } {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const neutral = { color: 'var(--a-muted)', tint: 'var(--a-hover)' };
  const good = { color: 'var(--a-success)', tint: 'var(--a-success-tint)' };
  const bad = { color: 'var(--a-danger)', tint: 'var(--a-danger-tint)' };
  const accent = { color: 'var(--a-accent)', tint: 'var(--a-accent-tint)' };
  const code = i.target && /^[A-Z0-9]{12}$/.test(i.target) ? formatCode(i.target) : i.target;
  switch (i.action) {
    case 'login': return { text: L('Oturum açtı', 'Signed in'), target: i.target, icon: 'login', ...neutral };
    case 'batch_created': return { text: L('Üretim partisi oluşturdu', 'Created production batch'), extra: i.count ? L(`${i.count} etiket`, `${i.count} tags`) : undefined, target: i.target, icon: 'layers', ...accent };
    case 'admin_disable': return { text: L('Etiketi kullanıma kapattı', 'Disabled tag'), target: code, icon: 'ban', ...bad };
    case 'admin_enable': return { text: L('Etiketi yeniden açtı', 'Re-enabled tag'), target: code, icon: 'check', ...good };
    case 'admin_expire': return { text: L('Etiketin süresini bitirdi', 'Expired tag'), target: code, icon: 'clock', ...neutral };
    case 'admin_reset': return { text: L('Etiketi stoğa döndürdü', 'Returned tag to stock'), target: code, icon: 'qr', ...neutral };
    case 'claimed': return { text: L('Etiketi bir araca bağladı', 'Linked tag to a vehicle'), target: code, icon: 'car', ...good };
    case 'moved': return { text: L('Etiketi başka araca taşıdı', 'Moved tag to another vehicle'), target: code, icon: 'car', ...neutral };
    case 'unlinked': return { text: L('Etiketi araçtan ayırdı', 'Unlinked tag'), target: code, icon: 'car', ...neutral };
    case 'reported_lost': return { text: L('Etiketi kayıp bildirdi', 'Reported tag lost'), target: code, icon: 'ban', ...bad };
    default: return { text: i.action, target: code, icon: 'activity', ...neutral };
  }
}

// ================================================================= YARDIM
const HelpTab: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const items: { q: string; a: string }[] = p.lang === 'tr' ? [
    { q: 'Yeni QR etiketi nasıl üretilir?', a: 'Üretim Partileri bölümünden ürün tipini (araç için OQ) ve adedi seçip parti oluşturun. Her etiket için tahmin edilemez, rastgele bir kod üretilir.' },
    { q: 'Matbaaya ne gönderilir?', a: 'Partiyi açıp "Tüm Partiyi İndir (CSV)" ile aldığınız dosyayı gönderin. Dosyada her etiketin seri numarası, QR içeriği (bağlantı) ve QR\'ın altına küçük yazıyla basılacak kod bulunur. Tek tek QR görselleri PNG veya SVG olarak da indirilebilir.' },
    { q: 'Müşteri etiketini kaybettiğinde ne yapılır?', a: 'Müşteri Araçlarım ekranından "Kayıp bildir" ile etiketi kendisi kapatabilir. Size ulaşırsa QR Bankası\'nda etiketi bulup kullanıma kapatın.' },
    { q: 'Kapatma, yeniden açma ve stoğa döndürme farkı nedir?', a: 'Kapatma etiketi durdurur; sahibi kayıtlı kalır ve geri açılabilir. QR Bankası\'ndaki "Eşleşmeyi Sıfırla" ise sahipliği ve araç bağını tamamen siler; etiket yeni bir müşteriye satılabilir hale gelir.' },
    { q: 'Hesabımın ele geçirildiğinden şüpheleniyorum.', a: 'Güvenlik sekmesinden şifrenizi hemen değiştirin. Ardından Aktif oturumlar sekmesinde tanımadığınız cihaz kalmadığını kontrol edin.' },
  ] : [
    { q: 'How do I produce new QR tags?', a: 'Go to Production Batches, pick the product type (OQ for vehicles) and quantity. Each tag gets an unguessable random code.' },
    { q: 'What goes to the print shop?', a: 'Open the batch and download it as CSV. It lists each tag\'s serial, QR content (link) and the short code printed under the QR. Single QR images can be downloaded as PNG or SVG.' },
    { q: 'A customer lost their tag.', a: 'Customers can disable it themselves from My Vehicles. Otherwise find it in the QR Bank and disable it.' },
    { q: 'Disable vs re-enable vs return to stock?', a: 'Disable pauses the tag and keeps its owner. Reset Pairing removes ownership and the vehicle link so the tag can be sold again.' },
    { q: 'I think my account is compromised.', a: 'Change your password under Security right away, then check Active sessions for unknown devices.' },
  ];
  return (
    <>
      <SectionHead title={L('Yardım ve kılavuz', 'Help & guide')} desc={L('Yönetim panelinde sık yapılan işler.', 'Common tasks in the admin console.')} />
      <div className="rounded-[14px] overflow-hidden" style={card}>
        {items.map((it, i) => (
          <details key={it.q} className="group px-6 py-4" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-medium">
              {it.q}
              <span className="transition-transform group-open:rotate-180" style={{ color: 'var(--a-muted)' }}><Icon name="chevronDown" size={16} /></span>
            </summary>
            <p className="mt-2.5 mb-0 text-[13px] leading-relaxed" style={{ color: 'var(--a-text2)' }}>{it.a}</p>
          </details>
        ))}
      </div>
      <p className="m-0 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Sürüm', 'Version')} <span style={{ fontFamily: MONO }}>v{APP_VERSION}</span></p>
    </>
  );
};

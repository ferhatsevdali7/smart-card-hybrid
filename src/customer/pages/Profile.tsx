// Profil ve ayarlar: hesap bilgileri, telefon (şifreli), şifre, tema, dil, uygulama, yardım/gizlilik, çıkış, hesabı silme.

import React, { useEffect, useState } from 'react';
import { Download, FileText, Globe, HelpCircle, KeyRound, LogOut, Mail, MessageSquare, Moon, Phone, Sparkles, Trash2, User as UserIcon, X } from 'lucide-react';
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, updatePassword, updateProfile } from 'firebase/auth';
import { deleteMyAccountFn, functionErrorMessage, getMyProfileFn, setMyPhoneFn } from '../../lib/functionsClient';
import { getAuthErrorMessage, resetPassword } from '../../lib/authService';
import { requestAccountSync } from '../../lib/accountSyncService';
import { APP_VERSION } from '../../lib/appInfo';
import { useCustomer } from '../context';
import { BackLink, Btn, Card, Field, H1, Notice, Page, Pill, Row, SectionTitle, Seg, inputCls, inputStyle, initialsOf, useL, useLang } from '../ui';

const isPasswordUser = (u: { providerData: { providerId: string }[] }) => u.providerData.some((p) => p.providerId === 'password');

/** Telefon numarasının profil satırında gösterilen maskeli hali (yalnızca sahibine). */
function usePhone() {
  const [state, setState] = useState<{ phone: string | null; masked: string | null; loading: boolean; error: boolean }>({ phone: null, masked: null, loading: true, error: false });
  const load = () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    getMyProfileFn({}).then((r) => setState({ phone: r.phone, masked: r.phoneMasked, loading: false, error: false })).catch(() => setState({ phone: null, masked: null, loading: false, error: true }));
  };
  useEffect(load, []);
  return { ...state, reload: load };
}

export const ProfilePage: React.FC = () => {
  const L = useL();
  const lang = useLang();
  const { user, displayName, theme, setTheme, setLang, go, logout, setup, standalone } = useCustomer();
  const phone = usePhone();
  const [busy, setBusy] = useState(false);
  const created = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
  const ic = (I: React.ElementType) => <I className="w-[17px] h-[17px]" />;

  const account = (
    <div>
      <SectionTitle first>{L('Hesap', 'Account')}</SectionTitle>
      <Card>
        <Row first icon={ic(UserIcon)} title={L('Ad soyad', 'Full name')} value={displayName || L('Eklenmedi', 'Not set')} onClick={() => go('profileName')} />
        <Row icon={ic(Phone)} title={L('Telefon', 'Phone')} value={phone.loading ? '…' : phone.masked || L('Eklenmedi', 'Not set')} onClick={() => go('profilePhone')} />
        <Row icon={ic(Mail)} title={L('E-posta', 'Email')} value={user.email || ''} chevron={false} />
        <Row icon={ic(KeyRound)} title={L('Şifre', 'Password')} value={isPasswordUser(user) ? L('Değiştir', 'Change') : 'Google'} onClick={() => go('profilePassword')} />
      </Card>
      <SectionTitle>{L('Görünüm', 'Appearance')}</SectionTitle>
      <Card>
        <Row first icon={ic(Moon)} title={L('Tema', 'Theme')} right={<div className="w-[160px] shrink-0"><Seg label={L('Tema', 'Theme')} value={theme} onChange={setTheme} options={[{ v: 'light', t: L('Açık', 'Light') }, { v: 'dark', t: L('Koyu', 'Dark') }]} /></div>} />
        <Row icon={ic(Globe)} title={L('Dil', 'Language')} right={<div className="w-[160px] shrink-0"><Seg label={L('Dil', 'Language')} value={lang} onChange={setLang} options={[{ v: 'tr', t: 'Türkçe' }, { v: 'en', t: 'English' }]} /></div>} />
      </Card>
    </div>
  );
  const rest = (
    <div>
      <SectionTitle first>{L('Uygulama', 'App')}</SectionTitle>
      <Card>
        <Row first icon={ic(Download)} title={L('Ana ekrana ekle', 'Add to Home Screen')} right={standalone ? <Pill tone="ok">{L('Eklendi', 'Added')}</Pill> : <Pill tone="warn">{L('Eklenmedi', 'Not added')}</Pill>} onClick={() => go('setup')} />
        <Row icon={ic(Sparkles)} title={L('Kurulum', 'Setup')} value={`%${setup.pct}`} onClick={() => go('setup')} />
      </Card>
      <SectionTitle>{L('Yardım ve yasal', 'Help and legal')}</SectionTitle>
      <Card>
        <Row first icon={ic(HelpCircle)} title={L('Yardım ve sık sorulanlar', 'Help and FAQ')} onClick={() => go('help')} />
        <Row icon={ic(MessageSquare)} title={L('Destek talepleri', 'Support requests')} onClick={() => go('support')} />
        <Row icon={ic(FileText)} title={L('Gizlilik ve KVKK', 'Privacy')} onClick={() => go('privacy')} />
      </Card>
      <Card className="mt-[26px]"><Row first icon={ic(LogOut)} title={L('Çıkış yap', 'Sign out')} chevron={false} onClick={busy ? undefined : async () => { setBusy(true); await logout(); }} /></Card>
    </div>
  );
  return (
    <Page wide={900}>
      <div className="flex items-center gap-[14px] lg:gap-[18px]">
        <span className="rounded-full flex items-center justify-center font-bold shrink-0 w-14 h-14 lg:w-16 lg:h-16 text-[19px] lg:text-[22px]" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}>{initialsOf(displayName, user.email || '')}</span>
        <div className="min-w-0">
          <div className="text-[19px] lg:text-[28px] font-bold tracking-[-0.3px] truncate" style={{ color: 'var(--c-tx)' }}>{displayName || user.email}</div>
          <div className="text-[13.5px] lg:text-[14px] mt-[2px] truncate" style={{ color: 'var(--c-fn)' }}>{user.email}{created ? <span className="hidden lg:inline"> · {L(`${created.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}’dan beri üye`, `Member since ${created.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`)}</span> : null}</div>
        </div>
      </div>
      {phone.error && <div className="mt-4"><Notice tone="warn">{L('Telefon bilgisi şu anda alınamadı.', 'Phone could not be loaded.')}</Notice></div>}
      <div className="mt-[26px] grid grid-cols-1 lg:grid-cols-2 gap-[26px] lg:gap-6 items-start">{account}{rest}</div>
      <div className="mt-[34px] pt-[22px] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-center lg:text-left" style={{ borderTop: '1px solid var(--c-ln)' }}>
        <div className="hidden lg:block"><div className="text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Hesabımı kalıcı olarak sil', 'Delete my account permanently')}</div><div className="text-[13.5px] mt-[3px]" style={{ color: 'var(--c-fn)' }}>{L('Araçlarınız, bildirimleriniz ve destek talepleriniz silinir; bağlı QR etiketiniz kapatılır.', 'Your vehicles, notices and support requests are deleted; linked QR tags are disabled.')}</div></div>
        <button type="button" onClick={() => go('deleteAccount')} className="text-[14px] font-semibold lg:h-10 lg:px-4 lg:rounded-[12px] lg:border" style={{ color: 'var(--c-dg)', borderColor: 'var(--c-dg)' }}><span className="lg:hidden">{L('Hesabımı kalıcı olarak sil', 'Delete my account permanently')}</span><span className="hidden lg:inline">{L('Hesabı sil', 'Delete account')}</span></button>
      </div>
      <div className="lg:hidden text-center text-[12px] mt-[14px]" style={{ color: 'var(--c-fn)' }}>H***F {L('Araç Kartı', 'Vehicle Card')} · {L('sürüm', 'version')} {APP_VERSION}</div>
    </Page>
  );
};

// ---------------------------------------------------------------- ad soyad
export const ProfileNamePage: React.FC = () => {
  const L = useL();
  const { user, displayName, back, toast, refreshUser } = useCustomer();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = name.replace(/\s+/g, ' ').trim();
  const save = async () => {
    if (clean.length < 2) { setErr(L('Adınızı ve soyadınızı giriniz.', 'Please enter your full name.')); return; }
    setBusy(true); setErr(null);
    try { await updateProfile(user, { displayName: clean.slice(0, 60) }); requestAccountSync(); refreshUser(); toast(L('Adınız kaydedildi.', 'Name saved.')); back(); }
    catch { setErr(L('Kaydedilemedi. Lütfen tekrar deneyiniz.', 'Could not save.')); } finally { setBusy(false); }
  };
  return (
    <Page wide={480}>
      <BackLink label={L('Profil', 'Profile')} onClick={back} />
      <H1 sub={L('Destek ekibimiz size bu adla hitap eder. QR’ı okutan kişiye gösterilmez.', 'Our support team will address you by this name.')}>{L('Ad soyad', 'Full name')}</H1>
      <Field label={L('Ad soyad', 'Full name')} htmlFor="pn" error={err}><input id="pn" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle(!!err)} /></Field>
      <div className="flex gap-[10px] mt-6"><Btn busy={busy} onClick={save} className="flex-1 lg:flex-none">{L('Kaydet', 'Save')}</Btn><Btn kind="secondary" onClick={back} className="flex-1 lg:flex-none">{L('Vazgeç', 'Cancel')}</Btn></div>
    </Page>
  );
};

// ---------------------------------------------------------------- telefon
const fmtLocal = (digits: string) => {
  const d = digits.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ');
};
const toLocalDigits = (v: string) => {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
};

export const ProfilePhonePage: React.FC = () => {
  const L = useL();
  const { back, toast } = useCustomer();
  const phone = usePhone();
  const [digits, setDigits] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!touched && phone.phone) setDigits(toLocalDigits(phone.phone)); }, [phone.phone, touched]);
  const valid = /^5\d{9}$/.test(digits);
  const save = async (remove = false) => {
    if (!remove && !valid) { setErr(L('Geçerli bir cep telefonu numarası giriniz (5XX XXX XX XX).', 'Enter a valid mobile number (5XX XXX XX XX).')); return; }
    setBusy(remove ? 'remove' : 'save'); setErr(null);
    try { await setMyPhoneFn({ phone: remove ? '' : `+90${digits}` }); toast(remove ? L('Telefon numaranız kaldırıldı.', 'Phone removed.') : L('Telefon numaranız kaydedildi.', 'Phone saved.')); back(); }
    catch (e) { setErr(functionErrorMessage(e, L('Kaydedilemedi. Lütfen tekrar deneyiniz.', 'Could not save.'))); } finally { setBusy(null); }
  };
  return (
    <Page wide={480}>
      <BackLink label={L('Profil', 'Profile')} onClick={back} />
      <H1 sub={L('Numaranız şifrelenerek saklanır. QR’ı okutan kişiye ve yöneticilere gösterilmez.', 'Your number is stored encrypted and never shown to scanners or staff.')}>{L('Telefon numarası', 'Phone number')}</H1>
      {phone.error && <div className="mt-4"><Notice tone="warn">{L('Kayıtlı numaranız şu anda alınamadı.', 'Your saved number could not be loaded.')}</Notice></div>}
      <Field label={L('Cep telefonu', 'Mobile phone')} htmlFor="pp" error={err} hint={L('Biçim: 5XX XXX XX XX', 'Format: 5XX XXX XX XX')}>
        <div className="flex gap-2">
          <span className="rounded-[10px] px-[14px] flex items-center font-semibold text-[15px] shrink-0" style={{ border: '1px solid var(--c-ln2)', background: 'var(--c-sub)', color: 'var(--c-tx)' }}>+90</span>
          <input id="pp" value={fmtLocal(digits)} inputMode="tel" autoComplete="tel-national" placeholder="5XX XXX XX XX" disabled={phone.loading}
            onChange={(e) => { setTouched(true); setDigits(toLocalDigits(e.target.value)); setErr(null); }}
            className={inputCls} style={{ ...inputStyle(!!err), fontSize: 17, letterSpacing: 0.5 }} />
        </div>
      </Field>
      <div className="flex gap-[10px] mt-6"><Btn busy={busy === 'save'} disabled={phone.loading || !!busy} onClick={() => save(false)} className="flex-1 lg:flex-none">{L('Kaydet', 'Save')}</Btn><Btn kind="secondary" onClick={back} className="flex-1 lg:flex-none">{L('Vazgeç', 'Cancel')}</Btn></div>
      {phone.phone && <button type="button" onClick={() => save(true)} disabled={!!busy} className="mt-5 inline-flex items-center gap-[6px] text-[13.5px] font-semibold disabled:opacity-50" style={{ color: 'var(--c-dg)' }}><X className="w-4 h-4" />{L('Numarayı kaldır', 'Remove number')}</button>}
    </Page>
  );
};

// ---------------------------------------------------------------- şifre
export const ProfilePasswordPage: React.FC = () => {
  const L = useL();
  const lang = useLang();
  const { user, back, toast } = useCustomer();
  const [cur, setCur] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false);
  if (!isPasswordUser(user)) {
    return (
      <Page wide={480}>
        <BackLink label={L('Profil', 'Profile')} onClick={back} />
        <H1>{L('Şifre', 'Password')}</H1>
        <div className="mt-5"><Notice tone="info">{L('Google hesabınızla giriş yapıyorsunuz. Şifrenizi Google hesabınızın ayarlarından yönetebilirsiniz.', 'You sign in with Google. Manage your password in your Google account.')}</Notice></div>
      </Page>
    );
  }
  const save = async () => {
    setErr(null);
    if (!cur) { setErr(L('Mevcut şifrenizi giriniz.', 'Enter your current password.')); return; }
    if (p1.length < 8) { setErr(L('Yeni şifre en az 8 karakter olmalıdır.', 'The new password must be at least 8 characters.')); return; }
    if (p1 !== p2) { setErr(L('Yeni şifreler birbiriyle uyuşmuyor.', 'Passwords do not match.')); return; }
    setBusy(true);
    try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || '', cur)); await updatePassword(user, p1); toast(L('Şifreniz değiştirildi.', 'Password changed.')); back(); }
    catch (e) { setErr(getAuthErrorMessage(e, lang)); } finally { setBusy(false); }
  };
  const pw = (id: string, v: string, set: (s: string) => void, ac: string) => <input id={id} type="password" value={v} autoComplete={ac} onChange={(e) => set(e.target.value)} className={inputCls} style={inputStyle()} />;
  return (
    <Page wide={480}>
      <BackLink label={L('Profil', 'Profile')} onClick={back} />
      <H1>{L('Şifre değiştir', 'Change password')}</H1>
      <Field label={L('Mevcut şifre', 'Current password')} htmlFor="pw0">{pw('pw0', cur, setCur, 'current-password')}</Field>
      <Field label={L('Yeni şifre', 'New password')} htmlFor="pw1" hint={L('En az 8 karakter', 'At least 8 characters')}>{pw('pw1', p1, setP1, 'new-password')}</Field>
      <Field label={L('Yeni şifre (tekrar)', 'Repeat new password')} htmlFor="pw2">{pw('pw2', p2, setP2, 'new-password')}</Field>
      {err && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}
      <div className="flex gap-[10px] mt-6"><Btn busy={busy} onClick={save} className="flex-1 lg:flex-none">{L('Şifreyi değiştir', 'Change password')}</Btn><Btn kind="secondary" onClick={back} className="flex-1 lg:flex-none">{L('Vazgeç', 'Cancel')}</Btn></div>
      <div className="mt-6 text-[13.5px]" style={{ color: 'var(--c-fn)' }}>
        {sent ? L('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.', 'A reset link was sent to your email.')
          : <>{L('Mevcut şifrenizi hatırlamıyor musunuz?', 'Forgot your current password?')} <button type="button" className="font-semibold" style={{ color: 'var(--c-pt)' }} onClick={() => resetPassword(user.email || '').then(() => setSent(true)).catch((e) => setErr(getAuthErrorMessage(e, lang)))}>{L('Sıfırlama bağlantısı gönder', 'Send reset link')}</button></>}
      </div>
    </Page>
  );
};

// ---------------------------------------------------------------- hesabı sil
export const DeleteAccountPage: React.FC = () => {
  const L = useL();
  const lang = useLang();
  const { user, vehicles, back, logout, toast } = useCustomer();
  const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const password = isPasswordUser(user);
  const linked = vehicles.filter((v) => v.tagCode).length;
  const run = async () => {
    setErr(null);
    if (password && !pw) { setErr(L('Onaylamak için şifrenizi giriniz.', 'Enter your password to confirm.')); return; }
    setBusy(true);
    try {
      if (password) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email || '', pw));
      else await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } catch (e) { setErr(getAuthErrorMessage(e, lang)); setBusy(false); return; }
    try {
      await deleteMyAccountFn({ reason: 'Kullanıcı hesabını kendisi sildi' });
      toast(L('Hesabınız kalıcı olarak silindi.', 'Your account has been deleted.'));
      await logout();
    } catch (e) { setErr(functionErrorMessage(e, L('Hesap silinemedi. Lütfen tekrar deneyiniz.', 'Could not delete the account.'))); setBusy(false); }
  };
  const items = [
    vehicles.length ? L(`${vehicles.length} aracınız ve bütün bildirimleri silinir.`, `${vehicles.length} vehicles and all their notices are deleted.`) : L('Araçlarınız ve bildirimleriniz silinir.', 'Your vehicles and notices are deleted.'),
    linked ? L(`Bağlı ${linked} QR etiketiniz kalıcı olarak kapatılır, yeniden kullanılamaz.`, `${linked} linked QR tags are permanently disabled.`) : L('Hesabınıza bağlı QR etiketleri kalıcı olarak kapatılır.', 'Linked QR tags are permanently disabled.'),
    L('Destek talepleriniz silinir.', 'Your support requests are deleted.'),
    L('Ad, telefon ve e-posta bilgileriniz silinir.', 'Your name, phone and email are deleted.'),
  ];
  return (
    <Page wide={520}>
      <BackLink label={L('Profil', 'Profile')} onClick={back} />
      <span className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center" style={{ background: 'var(--c-dgb)', color: 'var(--c-dg)' }}><Trash2 className="w-6 h-6" /></span>
      <div className="mt-[18px]"><H1>{L('Hesabınız kalıcı olarak silinecek', 'Your account will be deleted permanently')}</H1></div>
      <p className="m-0 mt-[10px] text-[14.5px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L('Bu işlem geri alınamaz. Silindiğinde:', 'This cannot be undone. When deleted:')}</p>
      <Card className="mt-[14px] px-4 pt-1 pb-[14px]">
        {items.map((t) => <div key={t} className="flex gap-[10px] mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--c-tx)' }}><X className="w-[15px] h-[15px] shrink-0 mt-[3px]" style={{ color: 'var(--c-dg)' }} /><span>{t}</span></div>)}
      </Card>
      {password
        ? <Field label={L('Onaylamak için şifrenizi giriniz', 'Enter your password to confirm')} htmlFor="dpw"><input id="dpw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} style={inputStyle(!!err)} /></Field>
        : <p className="m-0 mt-[18px] text-[13.5px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>{L('Onay için Google hesabınızla yeniden giriş yapmanız istenecek.', 'You will be asked to sign in with Google again to confirm.')}</p>}
      {err && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}
      <div className="mt-[22px] flex flex-col gap-[10px]"><Btn kind="danger" full busy={busy} onClick={run}>{L('Hesabımı kalıcı olarak sil', 'Delete my account permanently')}</Btn><Btn kind="secondary" full onClick={back} disabled={busy}>{L('Vazgeç', 'Cancel')}</Btn></div>
    </Page>
  );
};

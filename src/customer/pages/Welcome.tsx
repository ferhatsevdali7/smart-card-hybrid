// Giriş yapmamış ziyaretçi: karşılama ve giriş / kayıt sayfaları.

import React, { useState } from 'react';
import { Check, ChevronRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getAuthErrorMessage, loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword } from '../../lib/authService';
import { markCustomerLoggedIn } from '../../lib/customerSessionService';
import { BackLink, Btn, Card, Field, Notice, Plate, Seg, inputCls, inputStyle, useL, useLang } from '../ui';

export const WelcomePage: React.FC<{ onSignIn: () => void; onRegister: () => void; onPrivacy: () => void; onHelp: () => void }> = ({ onSignIn, onRegister, onPrivacy, onHelp }) => {
  const L = useL();
  const steps = [
    [L('Etiketi aracınıza yapıştırın', 'Stick the tag on your vehicle'), L('Ön camın iç yüzüne, dışarıdan okunacak şekilde.', 'Inside the windscreen, readable from outside.')],
    [L('QR’ı hesabınıza bağlayın', 'Link the QR to your account'), L('Telefonunuzla okutun, aracınızı seçin. Bir dakika sürer.', 'Scan it with your phone and pick your vehicle.')],
    [L('Size ulaşılsın', 'Get reached'), L('Okutan kişi hazır bir mesaj seçer; bildirim telefonunuza gelir.', 'The scanner picks a message; you get notified.')],
  ];
  const preview = (
    <Card className="w-full max-w-[330px] p-[22px]" style={{ boxShadow: '0 24px 50px rgba(17,24,39,.10)' }}>
      <div className="text-[12.5px] text-center" style={{ color: 'var(--c-fn)' }}>{L('QR’ı okutan kişinin gördüğü', 'What the scanner sees')}</div>
      <div className="text-center mt-[14px]"><Plate plate="34 HPJ ••5" /></div>
      <div className="text-[13px] text-center mt-2" style={{ color: 'var(--c-mu)' }}>Renault Clio</div>
      {[L('Aracınız yolu kapatıyor', 'Your vehicle is blocking the way'), L('Farlarınız açık kalmış', 'Your lights are on'), L('Camınız veya kapınız açık', 'A window or door is open')].map((t) => (
        <div key={t} className="rounded-[12px] px-[14px] py-3 mt-2 text-[14px] flex justify-between items-center" style={{ border: '1px solid var(--c-ln)', color: 'var(--c-tx)' }}>{t}<ChevronRight className="w-4 h-4" style={{ color: 'var(--c-fn)' }} /></div>
      ))}
    </Card>
  );
  return (
    <div className="w-full max-w-[1080px] mx-auto lg:px-10 lg:pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-14 items-center">
        <div className="pt-3">
          <span className="inline-flex items-center gap-[6px] h-6 px-[9px] rounded-full text-[12px] font-semibold" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}><ShieldCheck className="w-[13px] h-[13px]" />{L('Numaranız gizli kalır', 'Your number stays private')}</span>
          <h1 className="m-0 mt-4 text-[31px] lg:text-[46px] leading-[1.12] tracking-[-0.8px] lg:tracking-[-1.2px] font-[750]" style={{ color: 'var(--c-tx)' }}>{L('Aracınıza ulaşılsın,', 'Be reachable at your car,')}<br />{L('numaranız gizli kalsın.', 'keep your number private.')}</h1>
          <p className="m-0 mt-[14px] lg:mt-[18px] text-[15.5px] lg:text-[17px] leading-relaxed max-w-[500px]" style={{ color: 'var(--c-mu)' }}>{L('Aracınıza yapıştırdığınız QR etiketi okutulduğunda size anında bildirim gelir. Kimse telefon numaranızı görmez.', 'When the QR tag on your car is scanned you get notified instantly. Nobody sees your number.')}</p>
          <div className="mt-6 lg:mt-7 flex flex-col lg:flex-row gap-[10px]"><Btn onClick={onRegister} full className="lg:!w-auto lg:px-6">{L('Kayıt ol', 'Sign up')}</Btn><Btn kind="secondary" onClick={onSignIn} full className="lg:!w-auto lg:px-6">{L('Giriş yap', 'Sign in')}</Btn></div>
        </div>
        <div className="hidden lg:flex justify-center">{preview}</div>
      </div>
      <div className="text-[12.5px] font-semibold tracking-[.4px] uppercase mt-[34px] lg:mt-16 mb-2" style={{ color: 'var(--c-fn)' }}>{L('Nasıl çalışır', 'How it works')}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-4 rounded-[14px] lg:rounded-none overflow-hidden lg:overflow-visible" style={{ border: '1px solid var(--c-ln)', background: 'var(--c-sf)' }}>
        {steps.map(([t, d], i) => (
          <div key={t} className="flex lg:block gap-[14px] p-4 lg:p-[22px] lg:rounded-[14px]" style={{ borderTop: i ? '1px solid var(--c-ln)' : undefined, background: 'var(--c-sf)' }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-[14px]" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}>{i + 1}</span>
            <div className="lg:mt-[14px]"><div className="text-[15.5px] lg:text-[16px] font-semibold" style={{ color: 'var(--c-tx)' }}>{t}</div><div className="text-[14px] mt-[3px] lg:mt-[6px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>{d}</div></div>
          </div>
        ))}
      </div>
      <div className="lg:hidden text-[12.5px] font-semibold tracking-[.4px] uppercase mt-[26px] mb-2" style={{ color: 'var(--c-fn)' }}>{L('Gizlilik', 'Privacy')}</div>
      <Card className="lg:hidden px-4 pt-[6px] pb-4">
        {[L('Telefon numaranız ve adınız QR’ı okutan kişiye gösterilmez.', 'Your phone and name are never shown to the scanner.'), L('Plakanız maskeli görünür: 34 HPJ ••5', 'Your plate is masked: 34 HPJ ••5'), L('Etiket kaybolursa tek dokunuşla kapatırsınız.', 'Disable a lost tag with one tap.')].map((t) => (
          <div key={t} className="flex gap-[10px] mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--c-tx)' }}><Check className="w-4 h-4 shrink-0 mt-[3px]" style={{ color: 'var(--c-ok)' }} /><span>{t}</span></div>
        ))}
      </Card>
      <div className="text-center text-[12.5px] mt-7 lg:mt-12 pb-4" style={{ color: 'var(--c-fn)' }}>
        <button type="button" onClick={onPrivacy}>{L('Gizlilik ve KVKK', 'Privacy')}</button> · <button type="button" onClick={onHelp}>{L('Yardım', 'Help')}</button>
      </div>
    </div>
  );
};

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);

export const SignInPage: React.FC<{ initialMode?: 'login' | 'register'; onDone: () => void; onBack: () => void; onPrivacy: () => void; hint?: string | null }> = ({ initialMode = 'login', onDone, onBack, onPrivacy, hint }) => {
  const L = useL();
  const lang = useLang();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const google = async () => {
    setBusy('google'); setErr(null);
    try { await loginWithGoogle(); markCustomerLoggedIn(); onDone(); } catch (e) { setErr(getAuthErrorMessage(e, lang)); } finally { setBusy(null); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr(L('Geçerli bir e-posta adresi giriniz.', 'Enter a valid email address.')); return; }
    if (mode === 'forgot') {
      setBusy('email');
      try { await resetPassword(email); setSent(true); } catch (e2) { setErr(getAuthErrorMessage(e2, lang)); } finally { setBusy(null); }
      return;
    }
    if (!pw) { setErr(L('Şifrenizi giriniz.', 'Enter your password.')); return; }
    if (mode === 'register') {
      if (pw.length < 8) { setErr(L('Şifre en az 8 karakter olmalıdır.', 'Password must be at least 8 characters.')); return; }
      if (pw !== pw2) { setErr(L('Şifreler birbiriyle uyuşmuyor.', 'Passwords do not match.')); return; }
    }
    setBusy('email');
    try {
      if (mode === 'login') await loginWithEmail(email, pw); else await registerWithEmail(email, pw);
      markCustomerLoggedIn(); onDone();
    } catch (e2) { setErr(getAuthErrorMessage(e2, lang)); } finally { setBusy(null); }
  };
  const title = mode === 'forgot' ? L('Şifremi unuttum', 'Forgot password') : mode === 'register' ? L('Kayıt ol', 'Sign up') : L('Giriş yap', 'Sign in');
  return (
    <div className="w-full flex justify-center lg:pt-6">
      <div className="w-full max-w-[440px]">
        <div className="lg:rounded-[14px] lg:p-8 lg:border lg:bg-[var(--c-sf)]" style={{ borderColor: 'var(--c-ln)' }}>
          <BackLink label={L('Geri', 'Back')} onClick={mode === 'forgot' ? () => { setMode('login'); setErr(null); setSent(false); } : onBack} />
          <h1 className="m-0 text-[24px] font-bold tracking-[-0.4px]" style={{ color: 'var(--c-tx)' }}>{title}</h1>
          <p className="m-0 mt-[6px] mb-[22px] text-[14.5px] leading-relaxed" style={{ color: 'var(--c-mu)' }}>
            {mode === 'forgot' ? L('E-posta adresinizi yazın; şifrenizi yenilemeniz için bir bağlantı gönderelim.', 'Enter your email and we will send a reset link.') : L('Araçlarınızı ve QR etiketlerinizi yönetmek için hesabınıza giriş yapın.', 'Sign in to manage your vehicles and QR tags.')}
          </p>
          {hint && mode !== 'forgot' && <div className="mb-4"><Notice tone="info">{hint}</Notice></div>}
          {mode !== 'forgot' && (
            <>
              <div className="mb-5"><Seg label={L('Giriş ya da kayıt', 'Sign in or sign up')} value={mode} onChange={(m) => { setMode(m); setErr(null); }} options={[{ v: 'login', t: L('Giriş yap', 'Sign in') }, { v: 'register', t: L('Kayıt ol', 'Sign up') }]} /></div>
              <Btn kind="secondary" full busy={busy === 'google'} disabled={!!busy} onClick={google}><GoogleG />{L('Google ile devam et', 'Continue with Google')}</Btn>
              <div className="flex items-center gap-3 mt-5 mb-[2px]" style={{ color: 'var(--c-fn)' }}><span className="flex-1 h-px" style={{ background: 'var(--c-ln)' }} /><span className="text-[12.5px]">{L('veya e-posta ile', 'or with email')}</span><span className="flex-1 h-px" style={{ background: 'var(--c-ln)' }} /></div>
            </>
          )}
          {sent ? <div className="mt-4"><Notice tone="ok">{L('Şifre yenileme bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu (ve istenmeyen klasörünü) kontrol ediniz.', 'A reset link has been sent to your email.')}</Notice></div> : (
            <form onSubmit={submit} noValidate>
              <Field label={L('E-posta', 'Email')} htmlFor="si-email"><input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@eposta.com" className={inputCls} style={inputStyle()} /></Field>
              {mode !== 'forgot' && (
                <Field label={L('Şifre', 'Password')} htmlFor="si-pw" right={mode === 'login' ? <button type="button" onClick={() => { setMode('forgot'); setErr(null); }} className="font-semibold" style={{ color: 'var(--c-pt)' }}>{L('Şifremi unuttum', 'Forgot password')}</button> : undefined}>
                  <div className="relative">
                    <input id="si-pw" type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputCls} pr-12`} style={inputStyle()} />
                    <button type="button" onClick={() => setShow(!show)} aria-label={show ? L('Şifreyi gizle', 'Hide password') : L('Şifreyi göster', 'Show password')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: 'var(--c-fn)' }}>{show ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}</button>
                  </div>
                </Field>
              )}
              {mode === 'register' && <Field label={L('Şifre (tekrar)', 'Repeat password')} htmlFor="si-pw2" hint={L('En az 8 karakter', 'At least 8 characters')}><input id="si-pw2" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} style={inputStyle()} /></Field>}
              {err && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}
              <div className="mt-[22px]"><Btn type="submit" full busy={busy === 'email'} disabled={!!busy}>{mode === 'forgot' ? L('Bağlantı gönder', 'Send link') : title}</Btn></div>
            </form>
          )}
          {err && sent && <div className="mt-4"><Notice tone="danger">{err}</Notice></div>}
          {mode !== 'forgot' && <p className="m-0 mt-[18px] text-[12px] text-center leading-relaxed" style={{ color: 'var(--c-fn)' }}>{L('Devam ederek ', 'By continuing you accept the ')}<button type="button" onClick={onPrivacy} className="font-semibold" style={{ color: 'var(--c-pt)' }}>{L('KVKK Aydınlatma Metni', 'privacy notice')}</button>{L('’ni kabul etmiş olursunuz.', '.')}</p>}
        </div>
      </div>
    </div>
  );
};

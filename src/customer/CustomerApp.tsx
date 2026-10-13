// Müşteri sitesi kabuğu: üst çubuk, telefonda alt sekmeler, bilgisayarda sol menü, profil menüsü,
// kurulum kartı, bildirim uyarısı, adres çubuğu ile gezinme, tema ve dil.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowLeft, Bell, BellOff, CarFront, ChevronDown, ChevronRight, FileText, Globe, HelpCircle, LogOut, MessageSquare, Moon, User as UserIcon, WifiOff, X } from 'lucide-react';
import { subscribeToAuth, logoutUser } from '../lib/authService';
import { clearCustomerSession, isCustomerLoggedIn } from '../lib/customerSessionService';
import { requestAccountSync, syncAccountNow, isStandaloneDisplay } from '../lib/accountSyncService';
import { disablePushOnThisDevice, enablePush, getPushState, PushState } from '../lib/pushService';
import { listenMyVehicles } from '../lib/vehicleService';
import { listenMyTickets } from '../lib/ticketService';
import { extractTagCode } from '../lib/functionsClient';
import { APP_VERSION } from '../lib/appInfo';
import type { Vehicle } from '../types/vehicle';
import { SupportView } from '../components/SupportView';
import { CustomerCtx, CustomerCtxValue, PARENT, PUBLIC_ROUTES, Route, RouteState, SetupInfo, TAB_ROUTES } from './context';
import { LangCtx, Lang, Logo, Ring, Switch, THEME_BG, ThemeName, initialsOf, themeVars, Loading } from './ui';
import { VehicleAddPage, VehiclesPage } from './pages/Vehicles';
import { ClaimPage, LinkQrPage } from './pages/LinkQr';
import { NoticesPage } from './pages/Notices';
import { DeleteAccountPage, ProfileNamePage, ProfilePage, ProfilePasswordPage, ProfilePhonePage } from './pages/Profile';
import { HelpPage, PrivacyPage, SetupPage } from './pages/Info';
import { SignInPage, WelcomePage } from './pages/Welcome';

// ---------------------------------------------------------------- tercihler
const THEME_KEY = 'hf_theme';
const LANG_KEY = 'hf_lang';
const CLAIM_KEY = 'hf_pending_claim';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* gizli sekme */ } };
const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* yok */ } },
};

// ---------------------------------------------------------------- adres çubuğu
const ROUTES: Route[] = ['welcome', 'signin', 'vehicles', 'vehicleAdd', 'linkQr', 'claim', 'notices', 'support', 'profile', 'profileName', 'profilePhone', 'profilePassword', 'deleteAccount', 'setup', 'help', 'privacy'];

const LEGACY_VIEWS = ['vehicle', 'sos', 'personal', 'dashboard'];

export function parseUrl(search: string): RouteState | null {
  const q = new URLSearchParams(search);
  const view = q.get('view');
  if (!view) return null;
  if (view === 'vehicle') {
    const claim = q.get('claim');
    const code = claim ? extractTagCode(claim) : null;
    return code ? { route: 'claim', code } : { route: 'vehicles' };
  }
  if (view === 'sos' || view === 'personal' || view === 'dashboard') return { route: 'vehicles' };
  if (!ROUTES.includes(view as Route)) return null;
  const st: RouteState = { route: view as Route };
  if (q.get('id')) st.id = q.get('id');
  if (q.get('code')) st.code = extractTagCode(q.get('code')!) || null;
  if (q.get('ticket')) st.ticket = q.get('ticket');
  if (q.get('mode')) st.next = q.get('mode');
  return st;
}
function buildUrl(s: RouteState): string {
  const q = new URLSearchParams();
  q.set('view', s.route);
  if (s.id) q.set('id', s.id);
  if (s.code) q.set('code', s.code);
  if (s.ticket && s.route === 'support') q.set('ticket', s.ticket);
  if (s.next && s.route === 'signin') q.set('mode', s.next);
  return `${window.location.pathname}?${q.toString()}`;
}

const TITLES: Record<Route, [string, string]> = {
  welcome: ['Araç Kartı', 'Vehicle Card'], signin: ['Giriş yap', 'Sign in'], vehicles: ['Araçlarım', 'My vehicles'], vehicleAdd: ['Araç ekle', 'Add vehicle'],
  linkQr: ['QR etiketi bağla', 'Link QR tag'], claim: ['Etiketi bağla', 'Link tag'], notices: ['Bildirimler', 'Notifications'], support: ['Destek talepleri', 'Support'],
  profile: ['Profil', 'Profile'], profileName: ['Ad soyad', 'Name'], profilePhone: ['Telefon', 'Phone'], profilePassword: ['Şifre', 'Password'], deleteAccount: ['Hesabı sil', 'Delete account'],
  setup: ['Kurulum', 'Setup'], help: ['Yardım', 'Help'], privacy: ['Gizlilik ve KVKK', 'Privacy'],
};

// ---------------------------------------------------------------- kabuk
export const CustomerApp: React.FC = () => {
  const [theme, setThemeState] = useState<ThemeName>(() => (read(THEME_KEY) === 'dark' ? 'dark' : 'light'));
  const [lang, setLangState] = useState<Lang>(() => { const v = read(LANG_KEY) || read('smart_card_lang'); return v === 'en' ? 'en' : 'tr'; });
  const L = useCallback((tr: string, en: string) => (lang === 'tr' ? tr : en), [lang]);
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [flag, setFlag] = useState(isCustomerLoggedIn());
  const [, setTick] = useState(0);
  const user = authUser && flag ? authUser : null;
  const [rs, setRs] = useState<RouteState>(() => parseUrl(window.location.search) || { route: 'vehicles' });
  const [nav, setNav] = useState(0);
  const [toasts, setToasts] = useState<{ id: number; text: string; tone: 'ok' | 'danger' | 'info' }[]>([]);
  const [offline, setOffline] = useState(!navigator.onLine);

  // tema / dil
  const setTheme = (t: ThemeName) => { setThemeState(t); write(THEME_KEY, t); };
  const setLang = (l: Lang) => { setLangState(l); write(LANG_KEY, l); };
  useEffect(() => {
    document.documentElement.style.background = THEME_BG[theme];
    document.body.style.background = THEME_BG[theme];
    document.body.style.color = theme === 'dark' ? '#F3F4F6' : '#111827';
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B0D10' : '#FFFFFF');
  }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // oturum
  useEffect(() => subscribeToAuth((u) => { setAuthUser(u); setFlag(isCustomerLoggedIn()); }), []);
  useEffect(() => { if (user) void syncAccountNow(true); }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // çevrim dışı
  useEffect(() => {
    const on = () => setOffline(false); const off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // gezinme
  const go = useCallback((to: Route, params: Omit<RouteState, 'route'> = {}) => {
    const next: RouteState = { route: to, ...params };
    const url = buildUrl(next);
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.pushState({ hf: 1, p: 1 }, '', url);
    setRs(next); setNav((n) => n + 1);
    window.scrollTo(0, 0);
  }, []);
  const replace = useCallback((next: RouteState) => {
    window.history.replaceState({ ...(window.history.state || {}), hf: 1 }, '', buildUrl(next));
    setRs(next); setNav((n) => n + 1);
  }, []);
  const back = useCallback(() => {
    const parent = PARENT[rs.route];
    // Yalnızca site içinde ileri gidilmiş bir kayıt varsa tarayıcı geçmişine dönülür; yoksa üst sayfaya gidilir
    // (doğrudan açılan bir bağlantıda "geri" siteden çıkarmaz).
    if (window.history.state?.p) window.history.back();
    else go(parent?.to || 'vehicles');
  }, [rs.route, go]);
  useEffect(() => {
    const onPop = () => {
      const p = parseUrl(window.location.search);
      setRs((cur) => {
        const next = p || { route: 'vehicles' as Route };
        if (cur.route === 'support' && next.route === 'support') return cur; // talep içi gezinmeyi SupportView yönetir
        return next;
      });
      setNav((n) => n + 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // İlk açılışta adres yoksa ya da eski biçimdeyse (view=vehicle&claim=…, sos, personal, dashboard) adres yeni biçime çevrilir.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    if (!parseUrl(window.location.search) || (v && LEGACY_VIEWS.includes(v))) window.history.replaceState({ hf: 1 }, '', buildUrl(rs));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // giriş gerektiren sayfalar
  useEffect(() => {
    if (authUser === undefined) return;
    if (!user) {
      if (rs.route === 'claim' && rs.code) { ss.set(CLAIM_KEY, rs.code); replace({ route: 'signin', next: 'claim' }); return; }
      if (!PUBLIC_ROUTES.includes(rs.route)) replace({ route: rs.route === 'vehicles' ? 'welcome' : 'signin' });
      return;
    }
    if (rs.route === 'welcome' || rs.route === 'signin') {
      const pending = ss.get(CLAIM_KEY);
      if (pending) { ss.set(CLAIM_KEY, null); replace({ route: 'claim', code: pending }); }
      else replace({ route: 'vehicles' });
    }
  }, [authUser, user?.uid, rs.route]); // eslint-disable-line react-hooks/exhaustive-deps

  // başlık
  useEffect(() => { document.title = `${L(TITLES[rs.route][0], TITLES[rs.route][1])} · H***F ${L('Araç Kartı', 'Vehicle Card')}`; }, [rs.route, L]);

  const toast = useCallback((text: string, tone: 'ok' | 'danger' | 'info' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 4200);
  }, []);

  if (authUser === undefined) {
    return <div style={{ ...themeVars(theme), background: 'var(--c-bg)', minHeight: '100vh' }}><Loading /></div>;
  }

  const signedOut = (
    <SignedOut rs={rs} go={go} back={back} onSignedIn={() => { setFlag(true); setTick((t) => t + 1); }} />
  );

  return (
    <LangCtx.Provider value={lang}>
      <div className="min-h-screen w-full" style={{ ...themeVars(theme), background: 'var(--c-bg)', color: 'var(--c-tx)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
        {user
          ? <SignedIn key={user.uid} user={user} rs={rs} nav={nav} go={go} back={back} toast={toast} theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} offline={offline}
              onLoggedOut={() => { setFlag(false); replace({ route: 'welcome' }); }} refreshUser={() => setTick((t) => t + 1)} />
          : <><TopBarOut rs={rs} go={go} back={back} />{offline && <OfflineBar />}<main className="px-4 pt-5 pb-10 lg:px-10 lg:pt-10">{signedOut}</main></>}
        <Toasts list={toasts} onClose={(id) => setToasts((l) => l.filter((x) => x.id !== id))} />
      </div>
    </LangCtx.Provider>
  );
};

// ---------------------------------------------------------------- giriş yapmamış
const SignedOut: React.FC<{ rs: RouteState; go: CustomerCtxValue['go']; back: () => void; onSignedIn: () => void }> = ({ rs, go, back, onSignedIn }) => {
  const lang = React.useContext(LangCtx);
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (rs.route === 'signin') {
    const pending = ss.get(CLAIM_KEY);
    return <SignInPage key={rs.next || 'login'} initialMode={rs.next === 'register' ? 'register' : 'login'} onDone={onSignedIn} onBack={back} onPrivacy={() => go('privacy')}
      hint={rs.next === 'claim' || pending ? L('QR etiketini hesabınıza bağlamak için giriş yapınız ya da kayıt olunuz.', 'Sign in or sign up to link the QR tag to your account.') : null} />;
  }
  if (rs.route === 'help') return <HelpPage signedIn={false} go={() => go('signin')} back={back} />;
  if (rs.route === 'privacy') return <PrivacyPage back={back} />;
  return <WelcomePage onSignIn={() => go('signin')} onRegister={() => go('signin', { next: 'register' })} onPrivacy={() => go('privacy')} onHelp={() => go('help')} />;
};

const TopBarOut: React.FC<{ rs: RouteState; go: CustomerCtxValue['go']; back: () => void }> = ({ rs, go, back }) => {
  const lang = React.useContext(LangCtx);
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const sub = rs.route !== 'welcome';
  return (
    <header className="sticky top-0 z-40 h-[calc(56px+env(safe-area-inset-top))] lg:h-[calc(60px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] box-border flex items-center justify-between px-4 lg:px-8" style={{ background: 'var(--c-sf)', borderBottom: '1px solid var(--c-ln)' }}>
      {sub ? <button type="button" onClick={back} className="lg:hidden inline-flex items-center gap-2 text-[15px] font-semibold" style={{ color: 'var(--c-tx)' }}><ArrowLeft className="w-[19px] h-[19px]" />{L('Geri', 'Back')}</button> : null}
      <button type="button" onClick={() => go('welcome')} className={`${sub ? 'hidden lg:flex' : 'flex'} items-center gap-[10px]`}><Brand /></button>
      <div className="flex items-center gap-[10px]">
        {rs.route !== 'signin' && <button type="button" onClick={() => go('signin')} className="lg:hidden text-[14px] font-semibold" style={{ color: 'var(--c-pt)' }}>{L('Giriş yap', 'Sign in')}</button>}
        <button type="button" onClick={() => go('signin')} className="hidden lg:inline-flex h-[38px] px-4 rounded-[12px] items-center text-[14px] font-semibold" style={{ border: '1px solid var(--c-ln2)', color: 'var(--c-tx)', background: 'var(--c-sf)' }}>{L('Giriş yap', 'Sign in')}</button>
        <button type="button" onClick={() => go('signin', { next: 'register' })} className="hidden lg:inline-flex h-[38px] px-4 rounded-[12px] items-center text-[14px] font-semibold text-white" style={{ background: 'var(--c-p)' }}>{L('Kayıt ol', 'Sign up')}</button>
      </div>
    </header>
  );
};

const Brand: React.FC = () => {
  const lang = React.useContext(LangCtx);
  return <span className="flex items-center gap-[10px]"><Logo /><b className="text-[14px] font-extrabold tracking-[.4px]" style={{ color: 'var(--c-tx)' }}>H***F</b><span className="text-[11.5px] font-semibold tracking-[1.6px] whitespace-nowrap" style={{ color: 'var(--c-fn)' }}>{lang === 'tr' ? 'ARAÇ KARTI' : 'VEHICLE CARD'}</span></span>;
};

const OfflineBar: React.FC = () => {
  const tr = React.useContext(LangCtx) === 'tr';
  return <div role="status" className="flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-medium" style={{ background: 'var(--c-wrb)', color: 'var(--c-wr)' }}><WifiOff className="w-4 h-4" />{tr ? 'İnternet bağlantısı yok. Değişiklikler bağlantı gelince kaydedilir.' : 'You are offline.'}</div>;
};

const Toasts: React.FC<{ list: { id: number; text: string; tone: 'ok' | 'danger' | 'info' }[]; onClose: (id: number) => void }> = ({ list, onClose }) => (
  <div className="fixed left-0 right-0 top-[calc(64px+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
    {list.map((t) => (
      <div key={t.id} className="pointer-events-auto max-w-[460px] w-full flex items-start gap-3 rounded-[12px] px-4 py-3 text-[14px] shadow-lg" style={{ background: t.tone === 'danger' ? '#B42318' : '#111827', color: '#fff' }}>
        <span className="flex-1">{t.text}</span>
        <button type="button" onClick={() => onClose(t.id)} aria-label="Kapat" className="opacity-80"><X className="w-4 h-4" /></button>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------- giriş yapmış
interface SignedInProps {
  user: User; rs: RouteState; nav: number; go: CustomerCtxValue['go']; back: () => void; toast: CustomerCtxValue['toast'];
  theme: ThemeName; setTheme: (t: ThemeName) => void; lang: Lang; setLang: (l: Lang) => void; offline: boolean;
  onLoggedOut: () => void; refreshUser: () => void;
}

const SignedIn: React.FC<SignedInProps> = ({ user, rs, nav, go, back, toast, theme, setTheme, lang, setLang, offline, onLoggedOut, refreshUser }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vLoading, setVLoading] = useState(true);
  const [vError, setVError] = useState(false);
  const [ticketUnread, setTicketUnread] = useState(0);
  const [push, setPush] = useState<PushState | 'loading'>('loading');
  const [installEvt, setInstallEvt] = useState<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [standalone] = useState(isStandaloneDisplay());
  const [setupClosedAt, setSetupClosedAt] = useState(-1);

  useEffect(() => listenMyVehicles(user.uid, (l) => { setVehicles(l); setVLoading(false); setVError(false); }, () => { setVLoading(false); setVError(true); }), [user.uid]);
  useEffect(() => listenMyTickets(user.uid, (l) => setTicketUnread(l.filter((x) => x.unreadForCustomer).length), () => setTicketUnread(0)), [user.uid]);
  const refreshPush = useCallback(async () => { try { setPush(await getPushState(user.uid)); } catch { setPush('unsupported'); } }, [user.uid]);
  useEffect(() => { void refreshPush(); const v = () => { if (document.visibilityState === 'visible') void refreshPush(); }; document.addEventListener('visibilitychange', v); return () => document.removeEventListener('visibilitychange', v); }, [refreshPush]);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as unknown as typeof installEvt); };
    const done = () => { setInstallEvt(null); requestAccountSync(); };
    window.addEventListener('beforeinstallprompt', h); window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', done); };
  }, []);

  const enablePushNow = useCallback(async () => {
    try {
      const s = await enablePush(user.uid);
      setPush(s); requestAccountSync();
      if (s === 'on') toast(L('Bildirimler bu cihazda açıldı.', 'Notifications are on for this device.'));
      else if (s === 'denied') toast(L('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verebilirsiniz.', 'Permission was denied.'), 'danger');
      else if (s === 'ios-install') go('setup');
    } catch { toast(L('Bildirimler açılamadı. Lütfen tekrar deneyiniz.', 'Could not enable notifications.'), 'danger'); }
  }, [user.uid, toast, go]); // eslint-disable-line react-hooks/exhaustive-deps

  const setup: SetupInfo = useMemo(() => {
    const pushAvailable = push === 'on' || push === 'off' || push === 'denied' || push === 'ios-install';
    const steps: SetupInfo['steps'] = [
      { key: 'account', done: true, available: true },
      { key: 'vehicle', done: vehicles.length > 0, available: true },
      { key: 'qr', done: vehicles.some((v) => !!v.tagCode), available: true },
      { key: 'push', done: push === 'on', available: pushAvailable },
    ];
    const counted = steps.filter((s) => s.available);
    const done = counted.filter((s) => s.done).length;
    const pct = Math.round((done / counted.length) * 100);
    const next = (steps.find((s) => s.available && !s.done && s.key !== 'account')?.key || null) as SetupInfo['next'];
    return { steps, done, total: counted.length, pct, complete: done === counted.length, homeScreen: standalone, next };
  }, [push, vehicles, standalone]);

  const logout = useCallback(async () => {
    await disablePushOnThisDevice(user.uid).catch(() => undefined);
    clearCustomerSession();
    await logoutUser().catch(() => undefined);
    onLoggedOut();
  }, [user.uid, onLoggedOut]);

  const ctx: CustomerCtxValue = {
    user, displayName: (user.displayName || '').trim(), vehicles, vehiclesLoading: vLoading, vehiclesError: vError,
    push, refreshPush, enablePushNow, setup, standalone, canInstall: !!installEvt,
    install: async () => { if (!installEvt) return false; await installEvt.prompt(); const c = await installEvt.userChoice; setInstallEvt(null); return c.outcome === 'accepted'; },
    go, back, toast, theme, setTheme, lang, setLang, logout, refreshUser,
  };

  const unreadNotices = vehicles.reduce((n, v) => n + (v.unreadNotices || 0), 0);
  const isTab = TAB_ROUTES.includes(rs.route);
  const showSetup = isTab && !vLoading && push !== 'loading' && !setup.complete && setupClosedAt !== nav;
  const showPushBar = (rs.route === 'vehicles' || rs.route === 'notices') && (push === 'off' || push === 'denied' || push === 'ios-install');
  const badges: Partial<Record<Route, number>> = { notices: unreadNotices, support: ticketUnread };

  const page = (() => {
    switch (rs.route) {
      case 'vehicles': return <VehiclesPage openId={rs.id} />;
      case 'vehicleAdd': return <VehicleAddPage claimCode={rs.code} />;
      case 'linkQr': return rs.id ? <LinkQrPage vehicleId={rs.id} /> : <VehiclesPage />;
      case 'claim': return rs.code ? <ClaimPage code={rs.code} preselect={rs.id} /> : <VehiclesPage />;
      case 'notices': return <NoticesPage />;
      case 'support': return <SupportView key="support" user={user} lang={lang} initialTicketId={rs.ticket || null} onOpenPrivacy={() => go('privacy')} embedded />;
      case 'profile': return <ProfilePage />;
      case 'profileName': return <ProfileNamePage />;
      case 'profilePhone': return <ProfilePhonePage />;
      case 'profilePassword': return <ProfilePasswordPage />;
      case 'deleteAccount': return <DeleteAccountPage />;
      case 'setup': return <SetupPage />;
      case 'help': return <HelpPage signedIn go={(r) => go(r)} back={back} />;
      case 'privacy': return <PrivacyPage back={back} />;
      default: return <Loading />;
    }
  })();

  const tabbarOnMobile = isTab;
  return (
    <CustomerCtx.Provider value={ctx}>
      <div className={tabbarOnMobile ? '[--c-tabh:calc(64px+env(safe-area-inset-bottom))] lg:[--c-tabh:0px]' : '[--c-tabh:0px]'}>
        <TopBar rs={rs} back={back} />
        {offline && <OfflineBar />}
        <div className="flex">
          <Sidebar route={rs.route} badges={badges} setup={setup} />
          <main className={`flex-1 min-w-0 px-4 pt-5 lg:px-14 lg:pt-10 lg:pb-12 ${tabbarOnMobile ? 'pb-[calc(88px+env(safe-area-inset-bottom))]' : 'pb-10'}`}>
            {(showSetup || showPushBar) && (
              <div className="w-full mx-auto" style={{ maxWidth: rs.route === 'notices' || rs.route === 'profile' ? 960 : rs.route === 'support' ? 560 : 760 }}>
                {showSetup && <SetupCard setup={setup} onOpen={() => go('setup')} onClose={() => setSetupClosedAt(nav)} />}
                {showPushBar && <PushBar push={push} onAct={() => (push === 'off' ? void enablePushNow() : go(push === 'ios-install' ? 'setup' : 'notices'))} />}
              </div>
            )}
            {page}
          </main>
        </div>
        {tabbarOnMobile && <BottomTabs route={rs.route} badges={badges} />}
      </div>
    </CustomerCtx.Provider>
  );
};

// ---------------------------------------------------------------- parçalar
const TopBar: React.FC<{ rs: RouteState; back: () => void }> = ({ rs, back }) => {
  const { user, displayName, go, lang } = useCustomerSafe();
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const parent = PARENT[rs.route];
  const [menu, setMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 h-[calc(56px+env(safe-area-inset-top))] lg:h-[calc(60px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] box-border flex items-center justify-between px-4 lg:px-8" style={{ background: 'var(--c-sf)', borderBottom: '1px solid var(--c-ln)' }}>
      {parent ? <button type="button" onClick={back} className="lg:hidden inline-flex items-center gap-2 text-[15px] font-semibold min-w-0" style={{ color: 'var(--c-tx)' }}><ArrowLeft className="w-[19px] h-[19px] shrink-0" /><span className="truncate">{L(parent.tr, parent.en)}</span></button> : null}
      <button type="button" onClick={() => go('vehicles')} className={`${parent ? 'hidden lg:flex' : 'flex'} items-center`} aria-label={L('Araçlarım', 'My vehicles')}><Brand /></button>
      <button type="button" onClick={() => go('profile')} aria-label={L('Profil', 'Profile')} className="lg:hidden w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12.5px] font-bold shrink-0" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}>{initialsOf(displayName, user.email || '')}</button>
      <div className="hidden lg:block relative">
        <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu" className="flex items-center gap-[10px] text-[14px] font-semibold h-10 pl-1 pr-2 rounded-full" style={{ color: 'var(--c-tx)' }}>
          <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12.5px] font-bold" style={{ background: 'var(--c-tint)', color: 'var(--c-pt)' }}>{initialsOf(displayName, user.email || '')}</span>
          <span className="max-w-[200px] truncate">{displayName || user.email}</span><ChevronDown className="w-[15px] h-[15px]" style={{ color: 'var(--c-fn)' }} />
        </button>
        {menu && <ProfileMenu onClose={() => setMenu(false)} />}
      </div>
    </header>
  );
};

function useCustomerSafe() {
  const v = React.useContext(CustomerCtx);
  if (!v) throw new Error('CustomerCtx yok');
  return v;
}

const ProfileMenu: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, displayName, go, theme, setTheme, lang, setLang, logout } = useCustomerSafe();
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('[aria-haspopup="menu"]')) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);
  const item = 'w-full flex items-center gap-3 h-[42px] px-3 rounded-[9px] text-[14.5px] text-left hover:bg-[var(--c-sub)]';
  return (
    <div ref={ref} role="menu" className="absolute right-0 top-[52px] w-[280px] rounded-[14px] p-[6px] z-50" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-ln)', boxShadow: '0 18px 40px rgba(17,24,39,.16)' }}>
      <div className="px-3 pt-3 pb-[14px] mb-[6px]" style={{ borderBottom: '1px solid var(--c-ln)' }}>
        <div className="text-[14.5px] font-bold truncate" style={{ color: 'var(--c-tx)' }}>{displayName || L('Hesabım', 'My account')}</div>
        <div className="text-[13px] mt-[2px] truncate" style={{ color: 'var(--c-fn)' }}>{user.email}</div>
      </div>
      <button type="button" role="menuitem" className={item} style={{ color: 'var(--c-tx)' }} onClick={() => { onClose(); go('profile'); }}><UserIcon className="w-[17px] h-[17px]" style={{ color: 'var(--c-fn)' }} />{L('Profil ve ayarlar', 'Profile and settings')}</button>
      <div className={item} style={{ color: 'var(--c-tx)' }}><Moon className="w-[17px] h-[17px]" style={{ color: 'var(--c-fn)' }} /><span className="flex-1">{L('Koyu tema', 'Dark theme')}</span><Switch on={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label={L('Koyu tema', 'Dark theme')} /></div>
      <button type="button" role="menuitem" className={item} style={{ color: 'var(--c-tx)' }} onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}><Globe className="w-[17px] h-[17px]" style={{ color: 'var(--c-fn)' }} /><span className="flex-1">{L('Dil', 'Language')}</span><span className="text-[13.5px]" style={{ color: 'var(--c-fn)' }}>{lang === 'tr' ? 'Türkçe' : 'English'}</span></button>
      <div className="h-px my-[6px]" style={{ background: 'var(--c-ln)' }} />
      <button type="button" role="menuitem" className={item} style={{ color: 'var(--c-tx)' }} onClick={() => { onClose(); void logout(); }}><LogOut className="w-[17px] h-[17px]" style={{ color: 'var(--c-fn)' }} />{L('Çıkış yap', 'Sign out')}</button>
    </div>
  );
};

const NAV: { r: Route; icon: React.ElementType; tr: string; en: string; short: [string, string] }[] = [
  { r: 'vehicles', icon: CarFront, tr: 'Araçlarım', en: 'My vehicles', short: ['Araçlarım', 'Vehicles'] },
  { r: 'notices', icon: Bell, tr: 'Bildirimler', en: 'Notifications', short: ['Bildirimler', 'Alerts'] },
  { r: 'support', icon: MessageSquare, tr: 'Destek talepleri', en: 'Support', short: ['Destek', 'Support'] },
  { r: 'profile', icon: UserIcon, tr: 'Profil', en: 'Profile', short: ['Profil', 'Profile'] },
];
const SUBS: Partial<Record<Route, Route>> = { vehicleAdd: 'vehicles', linkQr: 'vehicles', claim: 'vehicles', profileName: 'profile', profilePhone: 'profile', profilePassword: 'profile', deleteAccount: 'profile' };
const badgeText = (n: number) => (n > 99 ? '99+' : String(n));

const Sidebar: React.FC<{ route: Route; badges: Partial<Record<Route, number>>; setup: SetupInfo }> = ({ route, badges, setup }) => {
  const { go, lang } = useCustomerSafe();
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const active = SUBS[route] || route;
  const link = (r: Route, Icon: React.ElementType, label: string, badge?: number, weight = 600) => {
    const on = active === r;
    return (
      <button key={r} type="button" onClick={() => go(r)} aria-current={on ? 'page' : undefined} className="w-full flex items-center gap-3 h-[42px] px-3 rounded-[10px] text-[14.5px] text-left transition-colors hover:bg-[var(--c-sub)]"
        style={on ? { background: 'var(--c-tint)', color: 'var(--c-pt)', fontWeight: weight } : { color: 'var(--c-mu)', fontWeight: weight }}>
        <Icon className="w-[19px] h-[19px]" style={{ color: on ? 'var(--c-pt)' : 'var(--c-fn)' }} /><span className="flex-1 truncate">{label}</span>
        {!!badge && <span className="min-w-[20px] h-5 px-[6px] rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: '#B42318' }}>{badgeText(badge)}</span>}
      </button>
    );
  };
  return (
    <aside className="hidden lg:flex flex-col w-[248px] shrink-0 sticky top-[calc(60px+env(safe-area-inset-top))] self-start px-[14px] py-5 box-border" style={{ height: 'calc(100vh - 60px - env(safe-area-inset-top))', background: 'var(--c-sf)', borderRight: '1px solid var(--c-ln)' }}>
      <nav aria-label={L('Ana menü', 'Main menu')}>{NAV.map((n) => link(n.r, n.icon, L(n.tr, n.en), badges[n.r]))}</nav>
      <div className="text-[11.5px] font-bold tracking-[1px] px-3 pt-[22px] pb-2" style={{ color: 'var(--c-fn)' }}>{L('DESTEK', 'HELP')}</div>
      {link('help', HelpCircle, L('Yardım', 'Help'), undefined, 500)}
      {link('privacy', FileText, L('Gizlilik ve KVKK', 'Privacy'), undefined, 500)}
      <div className="mt-auto">
        {!setup.complete && (
          <button type="button" onClick={() => go('setup')} className="w-full flex items-center gap-[10px] p-3 rounded-[14px] text-left" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-ln)' }}>
            <Ring pct={setup.pct} size={36} /><span className="min-w-0"><span className="block text-[13px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Kurulum', 'Setup')}</span><span className="block text-[12px]" style={{ color: 'var(--c-fn)' }}>{L(`${setup.done} / ${setup.total} adım`, `${setup.done} / ${setup.total} steps`)}</span></span>
          </button>
        )}
        <div className="text-[11.5px] px-3 pt-[14px]" style={{ color: 'var(--c-fn)' }}>H***F {L('Araç Kartı', 'Vehicle Card')} · {APP_VERSION}</div>
      </div>
    </aside>
  );
};

const BottomTabs: React.FC<{ route: Route; badges: Partial<Record<Route, number>> }> = ({ route, badges }) => {
  const { go, lang } = useCustomerSafe();
  return (
    <nav aria-label={lang === 'tr' ? 'Ana menü' : 'Main menu'} className="lg:hidden fixed left-0 right-0 bottom-0 z-40 flex px-[6px] pt-2" style={{ background: 'var(--c-sf)', borderTop: '1px solid var(--c-ln)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
      {NAV.map((n) => {
        const on = route === n.r;
        const b = badges[n.r] || 0;
        return (
          <button key={n.r} type="button" onClick={() => go(n.r)} aria-current={on ? 'page' : undefined} className="flex-1 flex flex-col items-center gap-1 text-[11px] font-semibold relative" style={{ color: on ? 'var(--c-p)' : 'var(--c-fn)' }}>
            <n.icon className="w-[22px] h-[22px]" />{lang === 'tr' ? n.short[0] : n.short[1]}
            {b > 0 && <span className="absolute -top-[2px] left-[calc(50%+6px)] min-w-4 h-4 px-1 rounded-full text-[10px] text-white flex items-center justify-center" style={{ background: '#B42318' }}>{badgeText(b)}</span>}
          </button>
        );
      })}
    </nav>
  );
};

const SetupCard: React.FC<{ setup: SetupInfo; onOpen: () => void; onClose: () => void }> = ({ setup, onOpen, onClose }) => {
  const { lang } = useCustomerSafe();
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const next = setup.next === 'vehicle' ? L('Aracınızı ekleyin', 'Add your vehicle') : setup.next === 'qr' ? L('QR etiketini bağlayın', 'Link the QR tag') : L('Telefon bildirimlerini açın', 'Turn on notifications');
  return (
    <div className="flex items-center gap-3 p-[10px] pl-3 rounded-[14px] mb-[14px]" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-ln)' }}>
      <button type="button" onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <Ring pct={setup.pct} />
        <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold" style={{ color: 'var(--c-tx)' }}>{L('Kurulumu tamamlayın', 'Finish setup')}</span><span className="block text-[12.5px] mt-[1px] truncate" style={{ color: 'var(--c-fn)' }}>{L(`${setup.done} / ${setup.total} adım · Sıradaki: `, `${setup.done} / ${setup.total} steps · Next: `)}{next}</span></span>
        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--c-fn)' }} />
      </button>
      <button type="button" onClick={onClose} aria-label={L('Kurulum kartını kapat', 'Close setup card')} className="p-1 shrink-0" style={{ color: 'var(--c-fn)' }}><X className="w-4 h-4" /></button>
    </div>
  );
};

const PushBar: React.FC<{ push: PushState | 'loading'; onAct: () => void }> = ({ push, onAct }) => {
  const { lang } = useCustomerSafe();
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const text = push === 'denied' ? L('Bu tarayıcıda bildirim izni kapalı. QR okutulduğunda haberiniz olmaz.', 'Notifications are blocked in this browser.')
    : push === 'ios-install' ? L('iPhone’da bildirim için uygulamayı ana ekrana ekleyin.', 'Add the app to your Home Screen to get notifications on iPhone.')
      : L('Telefon bildirimleri kapalı. QR okutulduğunda haberiniz olmaz.', 'Notifications are off. You won’t know when your QR is scanned.');
  return (
    <div className="flex items-center gap-[10px] px-3 py-[10px] rounded-[12px] mb-[14px] text-[13px] leading-snug" style={{ background: 'var(--c-wrb)', color: 'var(--c-wr)' }}>
      <BellOff className="w-[17px] h-[17px] shrink-0" /><span className="flex-1">{text}</span>
      <button type="button" onClick={onAct} className="font-bold whitespace-nowrap">{push === 'off' ? L('Aç', 'Turn on') : L('Nasıl?', 'How?')}</button>
    </div>
  );
};

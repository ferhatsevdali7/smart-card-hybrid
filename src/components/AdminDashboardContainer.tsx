import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AdminLayout } from './AdminLayout';
import { BatchProductionView } from './BatchProductionView';
import { QrBankAdminView } from './QrBankAdminView';
import { AdminPortalView } from './AdminPortalView';
import { AdminSettingsView } from './admin/AdminSettingsView';
import { AdminOverviewView } from './admin/AdminOverviewView';
import { AdminCompareView } from './admin/AdminCompareView';
import type { SettingsTab } from './admin/ProfileMenu';
import { AdminLang, Icon, IconName, roleLabel, useResolvedDark } from './admin/adminUi';
import {
  getAdminSession, AdminSession, AdminThemePref, clearAdminSession,
  getAdminLang, setAdminLang, getAdminTheme, setAdminTheme,
} from '../lib/adminSessionService';
import {
  ADMIN_SESSION_HOURS, AdminProfile, AdminSessionRecord, listenAdminProfile, listenMyActiveSessions,
  registerAdminSession, revokeAdminSession, touchAdminSession, watchSessionRevoked,
} from '../lib/adminAccountService';
import { auth } from '../lib/firebase';

export const AdminDashboardContainer: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(() => getAdminSession());
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [lang, setLangState] = useState<AdminLang>(getAdminLang());
  const [themePref, setThemeState] = useState<AdminThemePref>(getAdminTheme());
  const isDark = useResolvedDark(themePref);

  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [sessions, setSessions] = useState<AdminSessionRecord[]>([]);
  // null: yükleniyor, 'ok': yüklendi, 'error': okunamadı
  const [sessionsState, setSessionsState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  // Sekmeler arası senkron (başka sekmede çıkış yapılırsa)
  useEffect(() => {
    const check = () => setSession(getAdminSession());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const uid = authUser && session && authUser.email?.toLowerCase() === session.email ? authUser.uid : null;

  // Oturum kaydı, profil, aktif oturumlar ve uzaktan kapatma takibi
  useEffect(() => {
    if (!uid || !session) return;
    setSessionsState('loading');
    registerAdminSession(uid, session.email, session.token, session.loginTime).catch((e) => console.error('[admin_sessions] kayıt oluşturulamadı:', e));
    const stopProfile = listenAdminProfile(uid, setProfile);
    const stopSessions = listenMyActiveSessions(
      uid,
      (list) => { setSessions(list); setSessionsState('ok'); },
      () => setSessionsState('error'),
    );
    const stopWatch = watchSessionRevoked(session.token, () => forceLogout());
    const beat = setInterval(() => touchAdminSession(session.token).catch(() => undefined), 5 * 60 * 1000);
    return () => { stopProfile(); stopSessions(); stopWatch(); clearInterval(beat); };
  }, [uid, session?.token]);

  // Süre dolunca otomatik çıkış
  useEffect(() => {
    if (!session) return;
    const left = session.loginTime + ADMIN_SESSION_HOURS * 3600 * 1000 - Date.now();
    const t = setTimeout(() => forceLogout(), Math.max(0, left));
    return () => clearTimeout(t);
  }, [session?.token]);

  const forceLogout = () => {
    clearAdminSession();
    setSession(null);
    signOut(auth).catch(() => undefined);
  };

  const handleLogout = async () => {
    if (session) await revokeAdminSession(session.token).catch(() => undefined);
    forceLogout();
  };

  const changeLang = (l: AdminLang) => { setLangState(l); setAdminLang(l); };
  const changeTheme = (t: AdminThemePref) => { setThemeState(t); setAdminTheme(t); };

  const displayName = useMemo(() => {
    const n = profile?.displayName || authUser?.displayName || '';
    if (n.trim()) return n.trim();
    return session ? session.email.split('@')[0] : '';
  }, [profile, authUser, session]);

  if (!session) {
    return <AdminPortalView onLoginSuccess={() => { setSession(getAdminSession()); setActiveSection('overview'); }} />;
  }

  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setActiveSection('settings'); };
  const inSettings = activeSection === 'settings';

  return (
    <AdminLayout
      session={session}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onOpenSettings={openSettings}
      onLogout={handleLogout}
      lang={lang}
      onLang={changeLang}
      themePref={themePref}
      onTheme={changeTheme}
      isDark={isDark}
      displayName={displayName}
      photo={profile?.photoDataUrl || null}
      sessionCount={sessions.length}
      expiresAt={session.loginTime + ADMIN_SESSION_HOURS * 3600 * 1000}
      hideSidebar={inSettings}
    >
      {inSettings && (
        uid ? (
          <AdminSettingsView
            tab={settingsTab}
            onTab={setSettingsTab}
            onBack={() => setActiveSection('overview')}
            lang={lang}
            uid={uid}
            email={session.email}
            role={roleLabel(session.role, lang)}
            profile={profile}
            displayName={displayName}
            sessions={sessions}
            sessionsState={sessionsState}
            currentSessionId={session.token}
          />
        ) : (
          <p className="p-8 text-sm" style={{ color: 'var(--a-muted)' }}>{L('Hesap bilgileri yükleniyor…', 'Loading account…')}</p>
        )
      )}

      {activeSection === 'overview' && (
        <AdminOverviewView lang={lang} isDark={isDark} uid={uid} onNavigate={setActiveSection} />
      )}
      {activeSection === 'compare' && (
        <AdminCompareView lang={lang} isDark={isDark} onNavigate={setActiveSection} />
      )}
      {activeSection === 'batches' && <BatchProductionView adminEmail={session.email} />}
      {activeSection === 'qr_bank' && <QrBankAdminView adminEmail={session.email} />}

      {activeSection === 'vehicles' && (
        <Placeholder icon="car" title={L('Bağlı Araçlar', 'Linked Vehicles')} text={L('Araç ve etiket eşleşmeleri bu bölümde listelenecek.', 'Vehicle and tag links will be listed here.')} />
      )}
      {activeSection === 'users' && (
        <Placeholder icon="users" title={L('Kullanıcılar', 'Users')} text={L('Kayıtlı müşteri hesapları bu bölümde listelenecek.', 'Customer accounts will be listed here.')} />
      )}
      {activeSection === 'audit' && (
        <Placeholder icon="shield" title={L('Denetim Kayıtları', 'Audit Logs')} text={L('Tüm yöneticilerin işlem kayıtları bu bölümde listelenecek. Kendi işlemleriniz için Profil ve Ayarlar › Hesap etkinliğim bölümüne bakın.', 'All admins\' actions will be listed here. For your own, see Profile & Settings › My activity.')} />
      )}
    </AdminLayout>
  );
};

const Placeholder: React.FC<{ icon: IconName; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="flex flex-col gap-5">
    <h1 className="m-0 text-[22px] font-semibold">{title}</h1>
    <div className="rounded-[14px] p-10 text-center flex flex-col items-center gap-2" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
      <span style={{ color: 'var(--a-faint)' }}><Icon name={icon} size={28} /></span>
      <p className="m-0 text-[13px] max-w-md" style={{ color: 'var(--a-muted)' }}>{text}</p>
    </div>
  </div>
);

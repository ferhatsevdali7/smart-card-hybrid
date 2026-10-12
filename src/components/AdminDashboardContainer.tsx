import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { AdminLayout } from './AdminLayout';
import { AdminPortalView } from './AdminPortalView';
import { AdminSettingsView } from './admin/AdminSettingsView';
import { AdminOverviewView } from './admin/AdminOverviewView';
import { AdminCompareView } from './admin/AdminCompareView';
import { AdminDepotView, sumCounts } from './admin/AdminDepotView';
import { AdminBatchView } from './admin/AdminBatchView';
import { AdminBankView, AdminDisabledView, AdminStandView, AdminTrashView } from './admin/AdminStageViews';
import { AdminUsersView } from './admin/AdminUsersView';
import { AdminVehiclesView } from './admin/AdminVehiclesView';
import { AdminTeamView } from './admin/AdminTeamView';
import { AdminTicketsView } from './admin/AdminTicketsView';
import { AdminNotificationsView } from './admin/AdminNotificationsView';
import type { NoteLink } from '../lib/notificationService';
import { NoAccess } from './admin/customerUi';
import { canSee, clearAccess, getAccess, seesTags, setAccess, useAccess } from '../lib/access';
import { fetchStaffAccess } from '../lib/staffAuthService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LBatch, ensureLifecycle, listenBatches } from '../lib/lifecycleService';
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batches, setBatches] = useState<LBatch[] | null>(null);
  const [batchesError, setBatchesError] = useState(false);
  // Kullanıcı / araç detayı (üst çubukta adı ya da plakası görünür)
  const [userId, setUserId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [detailCrumb, setDetailCrumb] = useState<string>('');
  // Bildirimden gelinen hedef (ekip üyesi / kullanıcılar sekmesi); her geçişte sayfa baştan açılır
  const [deepLink, setDeepLink] = useState<{ team?: string | null; usersTab?: 'accounts' | 'deleted'; ticket?: string | null; ticketTab?: 'tickets' | 'abuse'; n: number }>({ n: 0 });

  useEffect(() => onAuthStateChanged(auth, setAuthUser), []);

  // Sekmeler arası senkron (başka sekmede çıkış yapılırsa)
  useEffect(() => {
    const check = () => setSession(getAdminSession());
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const uid = authUser && session && authUser.email?.toLowerCase() === session.email ? authUser.uid : null;

  const access = useAccess();

  // Yetkiler sunucudan alınır; ekip dışı/askıda ise çıkış yapılır. Ekip üyesinin kendi kaydı dinlenir:
  // pozisyonu değişince menü ve düğmeler anında güncellenir, askıya alınınca ya da çıkarılınca oturum kapanır.
  useEffect(() => {
    if (!uid || !session) return;
    let alive = true;
    let stop: (() => void) | null = null;
    fetchStaffAccess()
      .then((a) => {
        if (!alive) return;
        setAccess({ superAdmin: a.superAdmin, perms: a.perms, positionName: a.positionName });
        if (a.superAdmin) return;
        stop = onSnapshot(
          doc(db, 'staff_members', session.email),
          (snap) => {
            const d = snap.data();
            if (!snap.exists() || !d || d.status === 'suspended' || d.isActive === false) { forceLogout(); return; }
            setAccess({ superAdmin: false, perms: Array.isArray(d.perms) ? d.perms : [], positionName: getAccess().positionName });
          },
          () => undefined,
        );
      })
      .catch((e) => { console.warn('[staff]', e?.message || e); if (alive) forceLogout(); });
    return () => { alive = false; stop?.(); };
  }, [uid, session?.token]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // QR partileri (QR Deposu ve menüdeki sayılar için). İlk açılışta eski kayıtlar yeni yapıya taşınır.
  useEffect(() => {
    if (!uid || !access.loaded) return;
    if (!seesTags()) { setBatches([]); return; }
    ensureLifecycle();
    setBatchesError(false);
    return listenBatches(
      (list) => { setBatches(list); setBatchesError(false); },
      (e) => { console.error('[batches]', e); setBatchesError(true); },
    );
  }, [uid, access.loaded, access.superAdmin, [...access.perms].sort().join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Açık sayfa yetkisi yoksa (ör. Genel Bakış verilmemiş) görebildiği ilk sayfaya geçilir.
  useEffect(() => {
    if (!access.loaded || canSee(activeSection)) return;
    const first = ['overview', 'depot', 'stand', 'bank', 'vehicles', 'users', 'tickets', 'disabled', 'trash', 'team', 'audit'].find(canSee);
    if (first) setActiveSection(first);
  }, [access, activeSection]);

  // Süre dolunca otomatik çıkış
  useEffect(() => {
    if (!session) return;
    const left = session.loginTime + ADMIN_SESSION_HOURS * 3600 * 1000 - Date.now();
    const t = setTimeout(() => forceLogout(), Math.max(0, left));
    return () => clearTimeout(t);
  }, [session?.token]);

  const forceLogout = () => {
    clearAccess();
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
  // Eski bölüm adları (Genel Bakış bağlantıları vb.) yeni sayfalara yönlenir.
  const ALIASES: Record<string, string> = { batches: 'depot', qr_bank: 'bank' };
  const go = (section: string) => {
    setActiveSection(ALIASES[section] || section);
    if (section !== 'batch') setBatchId(null);
    setUserId(null);
    setVehicleId(null);
    setDeepLink((d) => ({ n: d.n + 1 }));
  };
  // Bildirimdeki "İlgili sayfaya git" düğmesi
  const openLink = (l: NoteLink) => {
    if (l.section === 'batch' && l.id) { go('batch'); setBatchId(l.id); return; }
    go(l.section);
    if (l.section === 'team' && l.id) { setDetailCrumb(l.id); setDeepLink((d) => ({ team: l.id, n: d.n + 1 })); }
    if (l.section === 'users' && l.tab === 'deleted') setDeepLink((d) => ({ usersTab: 'deleted', n: d.n + 1 }));
    if (l.section === 'tickets' && (l.id || l.tab === 'abuse')) setDeepLink((d) => ({ ticket: l.id || null, ticketTab: l.tab === 'abuse' ? 'abuse' : 'tickets', n: d.n + 1 }));
  };
  const openUser = (uid: string, name: string) => { setActiveSection('users'); setVehicleId(null); setUserId(uid); setDetailCrumb(name); };
  const openVehicle = (id: string, plate: string) => { setActiveSection('vehicles'); setUserId(null); setVehicleId(id); setDetailCrumb(plate); };
  const openBatch = (id: string) => { setBatchId(id); setActiveSection('batch'); };
  const totals = batches ? sumCounts(batches) : null;
  const navCounts: Record<string, number> = totals ? {
    depot: totals.in_stock + totals.on_sale + totals.active + totals.disabled + totals.expired + totals.trashed,
    stand: totals.on_sale,
    bank: totals.active,
    disabled: totals.disabled + totals.expired,
    trash: totals.trashed,
  } : {};
  const role = session.role;
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setActiveSection('settings'); };
  const inSettings = activeSection === 'settings';
  const allowed = access.loaded && canSee(activeSection);

  return (
    <AdminLayout
      session={session}
      activeSection={activeSection}
      onSelectSection={go}
      navCounts={navCounts}
      crumbExtra={activeSection === 'batch' && batchId ? batchId
        : (activeSection === 'users' && userId) || (activeSection === 'vehicles' && vehicleId) || activeSection === 'team' || activeSection === 'tickets' ? detailCrumb || null : null}
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

      {!inSettings && access.loaded && !canSee(activeSection) && (
        <NoAccess lang={lang} title={L('Bu sayfa', 'This page')} />
      )}
      {!inSettings && !access.loaded && (
        <p className="p-8 text-sm" style={{ color: 'var(--a-muted)' }}>{L('Yetkiler yükleniyor…', 'Loading permissions…')}</p>
      )}
      {activeSection === 'team' && access.loaded && canSee('team') && (
        <AdminTeamView key={`team-${deepLink.n}`} lang={lang} isDark={isDark} openMember={deepLink.team || null} onCrumb={(t) => setDetailCrumb(t || '')} />
      )}
      {allowed && activeSection === 'overview' && (
        <AdminOverviewView lang={lang} isDark={isDark} uid={uid} onNavigate={go} />
      )}
      {allowed && activeSection === 'compare' && (
        <AdminCompareView lang={lang} isDark={isDark} onNavigate={go} />
      )}
      {allowed && activeSection === 'depot' && (
        <AdminDepotView lang={lang} isDark={isDark} role={role} batches={batches} batchesError={batchesError} onOpenBatch={openBatch} />
      )}
      {allowed && activeSection === 'batch' && batchId && (
        <AdminBatchView
          lang={lang} isDark={isDark} role={role} batchId={batchId}
          batch={batches?.find((b) => b.id === batchId)}
          onBack={() => go('depot')}
        />
      )}
      {allowed && activeSection === 'stand' && <AdminStandView lang={lang} isDark={isDark} role={role} onOpenBatch={openBatch} />}
      {allowed && activeSection === 'bank' && <AdminBankView lang={lang} isDark={isDark} role={role} onOpenBatch={openBatch} />}
      {allowed && activeSection === 'disabled' && <AdminDisabledView lang={lang} isDark={isDark} role={role} onOpenBatch={openBatch} />}
      {allowed && activeSection === 'trash' && <AdminTrashView lang={lang} isDark={isDark} role={role} onOpenBatch={openBatch} />}

      {allowed && activeSection === 'vehicles' && (
        <AdminVehiclesView
          lang={lang} isDark={isDark} role={role} detailId={vehicleId}
          onOpenVehicle={openVehicle} onCloseVehicle={() => setVehicleId(null)} onOpenUser={openUser}
        />
      )}
      {allowed && activeSection === 'users' && (
        <AdminUsersView
          key={`users-${deepLink.usersTab || 'accounts'}-${deepLink.usersTab ? deepLink.n : 0}`}
          initialTab={deepLink.usersTab}
          lang={lang} isDark={isDark} role={role} detailUid={userId}
          onOpenUser={openUser} onCloseUser={() => setUserId(null)} onOpenVehicle={openVehicle}
        />
      )}
      {allowed && activeSection === 'tickets' && (
        <AdminTicketsView
          key={`tickets-${deepLink.n}`}
          lang={lang} isDark={isDark}
          openId={deepLink.ticket || null} initialTab={deepLink.ticketTab}
          onCrumb={(t) => setDetailCrumb(t || '')}
          onOpenUser={openUser} onOpenVehicle={openVehicle}
        />
      )}
      {access.loaded && activeSection === 'notifications' && (
        <AdminNotificationsView lang={lang} isDark={isDark} email={session.email} onNavigate={openLink} />
      )}
      {allowed && activeSection === 'audit' && (
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

import React, { useEffect, useState } from 'react';
import { AdminSession, AdminThemePref } from '../lib/adminSessionService';
import { AdminLang, Avatar, Icon, IconName, roleLabel, themeVars, useAdminFonts } from './admin/adminUi';
import { ProfileMenu, SettingsTab } from './admin/ProfileMenu';
import { canSee, useAccess } from '../lib/access';

interface AdminLayoutProps {
  session: AdminSession;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onLogout: () => void;
  lang: AdminLang;
  onLang: (l: AdminLang) => void;
  themePref: AdminThemePref;
  onTheme: (t: AdminThemePref) => void;
  isDark: boolean;
  displayName: string;
  photo: string | null;
  sessionCount: number;
  expiresAt: number;
  /** Profil ve Ayarlar gibi kendi menüsü olan sayfalarda kenar menü gizlenir */
  hideSidebar?: boolean;
  /** Menüde bölüm adının yanında gösterilen sayılar (QR Deposu, Satış Standı…) */
  navCounts?: Record<string, number>;
  /** Üst çubuktaki konum yazısına eklenen alt sayfa (örn. parti kodu) */
  crumbExtra?: string | null;
  children: React.ReactNode;
}

const NAV: { group: 'ops' | 'out' | 'sec'; id: string; icon: IconName; tr: string; en: string }[] = [
  { group: 'ops', id: 'overview', icon: 'grid', tr: 'Genel Bakış', en: 'Overview' },
  { group: 'ops', id: 'depot', icon: 'box', tr: 'QR Deposu', en: 'QR Stock' },
  { group: 'ops', id: 'stand', icon: 'store', tr: 'Satış Standı', en: 'On Sale' },
  { group: 'ops', id: 'bank', icon: 'qr', tr: 'QR Bankası', en: 'QR Bank' },
  { group: 'ops', id: 'vehicles', icon: 'car', tr: 'Bağlı Araçlar', en: 'Linked Vehicles' },
  { group: 'ops', id: 'users', icon: 'users', tr: 'Kullanıcılar', en: 'Users' },
  { group: 'out', id: 'disabled', icon: 'ban', tr: 'Devre Dışı', en: 'Disabled' },
  { group: 'out', id: 'trash', icon: 'trash', tr: 'Çöp Kutusu', en: 'Trash' },
  { group: 'sec', id: 'team', icon: 'key', tr: 'Ekip ve Yetkiler', en: 'Team & Permissions' },
  { group: 'sec', id: 'audit', icon: 'shield', tr: 'Denetim Kayıtları', en: 'Audit Logs' },
];

/** Alt sayfalar menüde ana sayfalarını vurgular */
const PARENT: Record<string, string> = { compare: 'overview', batch: 'depot' };

/** Yetkisi olmayan sayfa menüde hiç görünmez (asıl denetim sunucuda). */
const visibleNav = (group: string) => NAV.filter((n) => n.group === group && canSee(n.id));

export const AdminLayout: React.FC<AdminLayoutProps> = (p) => {
  useAdminFonts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const access = useAccess();
  const role = access.superAdmin ? roleLabel('super_admin', p.lang) : (access.positionName || p.session.positionName || roleLabel(p.session.role, p.lang));

  useEffect(() => { setNavOpen(false); }, [p.activeSection]);

  const current = NAV.find((n) => n.id === (PARENT[p.activeSection] || p.activeSection));
  const crumb = p.activeSection.startsWith('settings') ? L('Profil ve Ayarlar', 'Profile & Settings')
    : p.activeSection === 'compare' ? L('Dönem karşılaştırma', 'Period comparison')
      : current ? `${L(current.tr, current.en)}${p.crumbExtra ? ` / ${p.crumbExtra}` : ''}` : '';

  const navLink = (n: (typeof NAV)[number]) => {
    const on = p.activeSection === n.id || PARENT[p.activeSection] === n.id;
    const count = p.navCounts?.[n.id];
    return (
      <button
        key={n.id}
        type="button"
        aria-current={on ? 'page' : undefined}
        onClick={() => p.onSelectSection(n.id)}
        className="w-full flex items-center gap-2.5 h-10 md:h-[38px] px-2.5 rounded-lg text-left text-[13.5px] transition-colors hover:bg-[var(--a-hover)]"
        style={{ background: on ? 'var(--a-active)' : undefined, color: on ? 'var(--a-text)' : 'var(--a-text2)', fontWeight: on ? 600 : 400 }}
      >
        <span style={{ color: on ? 'var(--a-accent)' : 'currentColor' }}><Icon name={n.icon} size={18} /></span>
        <span className="flex-1 truncate">{L(n.tr, n.en)}</span>
        {count !== undefined && <span className="text-[12px] font-normal" style={{ color: 'var(--a-faint)', fontFeatureSettings: '"tnum" 1' }}>{count}</span>}
      </button>
    );
  };

  const groupTitle = (text: string, first = false) => (
    <div className={`px-2.5 ${first ? 'pt-1.5' : 'pt-4'} pb-2 text-[12px]`} style={{ color: 'var(--a-faint)' }}>{text}</div>
  );

  const sidebar = (
    <nav aria-label={L('Yönetim menüsü', 'Admin menu')} className="flex flex-col gap-0.5 p-3 pt-4">
      {visibleNav('ops').length > 0 && groupTitle(L('QR ve müşteriler', 'QR & customers'), true)}
      {visibleNav('ops').map(navLink)}
      {visibleNav('out').length > 0 && groupTitle(L('Kullanım dışı', 'Out of use'), visibleNav('ops').length === 0)}
      {visibleNav('out').map(navLink)}
      {visibleNav('sec').length > 0 && groupTitle(L('Yönetim', 'Administration'), visibleNav('ops').length + visibleNav('out').length === 0)}
      {visibleNav('sec').map(navLink)}
      {access.loaded && NAV.every((n) => !canSee(n.id)) && (
        <p className="m-0 px-2.5 pt-2 text-[12px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>{L('Pozisyonunuza henüz sayfa yetkisi verilmemiş. Süper yöneticiyle görüşün.', 'Your position has no pages yet.')}</p>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ ...themeVars(p.isDark), background: 'var(--a-bg)', color: 'var(--a-text)', colorScheme: p.isDark ? 'dark' : 'light' }}>
      {/* ÜST ÇUBUK */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-3 pl-1 pr-3 md:px-5 sticky top-0 z-30" style={{ background: 'var(--a-panel)', borderBottom: '1px solid var(--a-line)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {!p.hideSidebar ? (
            <button type="button" onClick={() => setNavOpen(true)} aria-label={L('Menüyü aç', 'Open menu')} className="md:hidden w-11 h-11 flex items-center justify-center" style={{ color: 'var(--a-text2)' }}>
              <Icon name="menu" size={20} />
            </button>
          ) : <span className="w-2 md:hidden" />}
          <div className="w-[30px] h-[30px] rounded-full bg-black flex items-center justify-center text-white font-semibold shrink-0" style={{ fontSize: 7.5, letterSpacing: 0.5, border: p.isDark ? '1.5px solid #E7E9EC' : 'none' }}>H***F</div>
          <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">{L('Yönetim Konsolu', 'Admin Console')}</span>
          {crumb && <span className="hidden sm:block w-px h-[18px]" style={{ background: 'var(--a-line2)' }} />}
          <span className="text-[13px] truncate" style={{ color: 'var(--a-muted)' }}>{crumb}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            data-profile-trigger
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 p-1 sm:pr-2.5 rounded-[10px] transition-colors hover:bg-[var(--a-hover)]"
            style={{ border: `1px solid ${menuOpen ? 'var(--a-line3)' : 'transparent'}`, background: menuOpen ? 'var(--a-hover)' : undefined, color: 'var(--a-text)' }}
          >
            <Avatar name={p.displayName} photo={p.photo} size={32} />
            <span className="hidden sm:flex flex-col items-start leading-tight">
              <span className="text-[13px] font-semibold max-w-[180px] truncate">{p.displayName}</span>
              <span className="text-[11px]" style={{ color: 'var(--a-muted)' }}>{role}</span>
            </span>
            <span className="hidden sm:inline" style={{ color: 'var(--a-muted)', transform: menuOpen ? 'rotate(180deg)' : undefined }}><Icon name="chevronDown" size={16} /></span>
          </button>

          <ProfileMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            name={p.displayName}
            email={p.session.email}
            role={role}
            photo={p.photo}
            loginTime={p.session.loginTime}
            expiresAt={p.expiresAt}
            sessionCount={p.sessionCount}
            lang={p.lang}
            onLang={p.onLang}
            themePref={p.themePref}
            onTheme={p.onTheme}
            onOpenSettings={p.onOpenSettings}
            onLogout={() => setShowLogoutConfirm(true)}
          />
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {!p.hideSidebar && (
          <>
            <aside className="hidden md:block w-[232px] shrink-0" style={{ background: 'var(--a-panel)', borderRight: '1px solid var(--a-line)' }}>
              {sidebar}
            </aside>
            {navOpen && (
              <div className="md:hidden fixed inset-0 z-40">
                <div className="absolute inset-0" style={{ background: 'var(--a-overlay)' }} onClick={() => setNavOpen(false)} />
                <aside className="absolute inset-y-0 left-0 w-[264px] max-w-[85vw] overflow-y-auto" style={{ background: 'var(--a-panel)', borderRight: '1px solid var(--a-line)' }}>
                  <div className="flex justify-end p-1.5">
                    <button type="button" onClick={() => setNavOpen(false)} aria-label={L('Menüyü kapat', 'Close menu')} className="w-11 h-11 flex items-center justify-center" style={{ color: 'var(--a-text2)' }}>
                      <Icon name="x" size={20} />
                    </button>
                  </div>
                  {sidebar}
                </aside>
              </div>
            )}
          </>
        )}

        <main className={`flex-1 min-w-0 overflow-y-auto ${p.hideSidebar ? '' : 'p-5 md:p-8'}`}>
          {p.children}
        </main>
      </div>

      {/* ÇIKIŞ ONAYI */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'var(--a-overlay)' }} role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="w-full max-w-md p-6 rounded-[14px]" style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: 'var(--a-danger-tint)', color: 'var(--a-danger)' }}>
                <Icon name="logout" size={19} />
              </div>
              <div className="min-w-0">
                <h3 id="logout-title" className="text-base font-semibold">{L('Oturumu kapat', 'Sign out')}</h3>
                <p className="text-xs truncate" style={{ color: 'var(--a-muted)' }}>{p.session.email}</p>
              </div>
            </div>
            <p className="text-[13px] mb-6 leading-relaxed" style={{ color: 'var(--a-text2)' }}>
              {L('Yönetim panelinden çıkmak istediğinize emin misiniz? Bu tarayıcıdaki oturum kapanacak.', 'Sign out of the admin console? The session in this browser will end.')}
            </p>
            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="h-10 px-4 rounded-lg text-[13.5px] transition-colors hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-text2)' }}>
                {L('Vazgeç', 'Cancel')}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => { setShowLogoutConfirm(false); p.onLogout(); }}
                className="h-10 px-4 rounded-lg text-[13.5px] font-semibold text-white"
                style={{ background: p.isDark ? '#C2412F' : '#B42318' }}
              >
                {L('Evet, çıkış yap', 'Yes, sign out')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

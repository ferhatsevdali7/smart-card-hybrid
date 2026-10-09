import React, { useEffect, useRef } from 'react';
import type { AdminThemePref } from '../../lib/adminSessionService';
import { APP_VERSION } from '../../lib/appInfo';
import { AdminLang, Avatar, Icon, MONO, Segmented, formatClock, formatRemaining, useNow } from './adminUi';

export type SettingsTab = 'profile' | 'security' | 'sessions' | 'activity' | 'help';

interface ProfileMenuProps {
  open: boolean;
  onClose: () => void;
  name: string;
  email: string;
  role: string;
  photo: string | null;
  loginTime: number;
  expiresAt: number;
  sessionCount: number;
  lang: AdminLang;
  onLang: (l: AdminLang) => void;
  themePref: AdminThemePref;
  onTheme: (t: AdminThemePref) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onLogout: () => void;
}

/**
 * Sağ üstteki profil menüsü.
 * Masaüstünde düğmenin altında açılır; telefonda ekranın altından panel olarak gelir.
 */
export const ProfileMenu: React.FC<ProfileMenuProps> = (p) => {
  const ref = useRef<HTMLDivElement>(null);
  const now = useNow();
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-profile-trigger]')) p.onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [p.open]);

  if (!p.open) return null;

  const item = (icon: Parameters<typeof Icon>[0]['name'], label: string, onClick: () => void, meta?: string) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => { p.onClose(); onClick(); }}
      className="w-full flex items-center gap-3 h-12 sm:h-10 px-3 sm:px-2.5 rounded-lg text-left text-[15px] sm:text-[13.5px] outline-none transition-colors hover:bg-[var(--a-hover)] focus-visible:bg-[var(--a-hover)]"
      style={{ color: 'var(--a-text)' }}
    >
      <span style={{ color: 'var(--a-muted)' }}><Icon name={icon} /></span>
      <span className="flex-1">{label}</span>
      {meta && <span className="text-xs" style={{ color: 'var(--a-muted)' }}>{meta}</span>}
    </button>
  );

  return (
    <>
      {/* Telefonda arka plan karartması */}
      <div className="fixed inset-0 z-40 sm:hidden" style={{ background: 'var(--a-overlay)' }} onClick={p.onClose} />

      <div
        ref={ref}
        role="menu"
        aria-label={L('Profil ve ayarlar', 'Profile and settings')}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] pb-5 pt-2 sm:pb-0 sm:pt-0 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+6px)] sm:w-[324px] sm:rounded-[14px] overflow-hidden"
        style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded sm:hidden" style={{ background: 'var(--a-line3)' }} />

        {/* Kimlik */}
        <div className="flex items-start gap-3 px-5 sm:px-4 pt-3 sm:pt-4 pb-3">
          <Avatar name={p.name} photo={p.photo} size={44} />
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[15px] sm:text-sm font-semibold truncate" style={{ color: 'var(--a-text)' }}>{p.name}</span>
            <span className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{p.email}</span>
            <span className="self-start mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: 'var(--a-accent)', background: 'var(--a-accent-tint)' }}>{p.role}</span>
          </div>
        </div>
        <div className="mx-5 sm:mx-4 mb-3.5 px-3 py-2.5 rounded-[10px] flex justify-between gap-2 text-xs" style={{ background: 'var(--a-surface2)', color: 'var(--a-muted)' }}>
          <span>{L('Son giriş', 'Signed in')}: {formatClock(new Date(p.loginTime), p.lang)}</span>
          <span>{L('Kalan', 'Left')}: <span style={{ color: 'var(--a-text)', fontFamily: MONO }}>{formatRemaining(p.expiresAt - now, p.lang)}</span></span>
        </div>

        <div className="h-px" style={{ background: 'var(--a-line)' }} />

        {/* Hızlı ayarlar */}
        <div className="px-5 sm:px-4 py-3 grid grid-cols-2 gap-3 sm:flex sm:flex-col sm:gap-2.5">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2.5 text-[11.5px] sm:text-[13px]" style={{ color: 'var(--a-text2)' }}>
              <span className="hidden sm:inline"><Icon name="globe" /></span>{L('Dil', 'Language')}
            </span>
            <Segmented
              label={L('Dil', 'Language')}
              value={p.lang}
              onChange={p.onLang}
              options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2.5 text-[11.5px] sm:text-[13px]" style={{ color: 'var(--a-text2)' }}>
              <span className="hidden sm:inline"><Icon name="moon" /></span>{L('Tema', 'Theme')}
            </span>
            <Segmented
              label={L('Tema', 'Theme')}
              value={p.themePref}
              onChange={p.onTheme}
              options={[
                { value: 'light', icon: 'sun', aria: L('Açık', 'Light') },
                { value: 'dark', icon: 'moon', aria: L('Koyu', 'Dark') },
                { value: 'system', icon: 'laptop', aria: L('Sistem', 'System') },
              ]}
            />
          </div>
        </div>

        <div className="h-px" style={{ background: 'var(--a-line)' }} />

        <div className="p-1.5 sm:p-1.5 flex flex-col">
          {item('user', L('Profil ve Ayarlar', 'Profile & Settings'), () => p.onOpenSettings('profile'))}
          {item('key', L('Güvenlik ve şifre', 'Security & password'), () => p.onOpenSettings('security'))}
          {item('devices', L('Aktif oturumlar', 'Active sessions'), () => p.onOpenSettings('sessions'),
            p.sessionCount > 0 ? L(`${p.sessionCount} cihaz`, `${p.sessionCount} device${p.sessionCount > 1 ? 's' : ''}`) : undefined)}
          {item('activity', L('Hesap etkinliğim', 'My activity'), () => p.onOpenSettings('activity'))}
          {item('help', L('Yardım ve kılavuz', 'Help & guide'), () => p.onOpenSettings('help'))}
        </div>

        <div className="h-px" style={{ background: 'var(--a-line)' }} />

        <div className="p-1.5 flex items-center justify-between">
          <button
            type="button"
            role="menuitem"
            onClick={() => { p.onClose(); p.onLogout(); }}
            className="flex items-center gap-3 h-12 sm:h-10 px-3 sm:px-2.5 rounded-lg text-[15px] sm:text-[13.5px] font-medium outline-none transition-colors hover:bg-[var(--a-danger-tint)] focus-visible:bg-[var(--a-danger-tint)]"
            style={{ color: 'var(--a-danger)' }}
          >
            <Icon name="logout" /> {L('Güvenli çıkış', 'Sign out')}
          </button>
          <span className="pr-3 text-[11.5px]" style={{ color: 'var(--a-faint)', fontFamily: MONO }}>v{APP_VERSION}</span>
        </div>
      </div>
    </>
  );
};

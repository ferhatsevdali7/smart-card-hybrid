// Yönetici paneli için ortak tasarım dili: renkler (açık/koyu), yazı tipi, küçük parçalar.
// Renkler CSS değişkeni olarak kök öğeye verilir; bileşenler `var(--a-*)` kullanır.

import React, { useEffect, useState } from 'react';
import type { AdminThemePref } from '../../lib/adminSessionService';
import type { StaffRole } from '../../types/card';

export type AdminLang = 'tr' | 'en';

const DARK: Record<string, string> = {
  '--a-bg': '#0E1013',
  '--a-panel': '#121519',
  '--a-surface': '#13161A',
  '--a-surface2': '#15181D',
  '--a-raised': '#1A1E24',
  '--a-field': '#0F1215',
  '--a-line': '#22262D',
  '--a-line2': '#2A2F37',
  '--a-line3': '#343A43',
  '--a-hover': '#1B1F25',
  '--a-active': '#1F242B',
  '--a-text': '#E7E9EC',
  '--a-text2': '#C9CDD3',
  '--a-muted': '#9AA1AB',
  '--a-faint': '#8A919B',
  '--a-accent': '#7AB0FF',
  '--a-accent-tint': 'rgba(122, 176, 255, 0.14)',
  '--a-avatar': '#1B2A44',
  '--a-primary': '#2563EB',
  '--a-primary-hover': '#1D4ED8',
  '--a-danger': '#F2867A',
  '--a-danger-line': '#5A2A25',
  '--a-danger-tint': 'rgba(242, 134, 122, 0.12)',
  '--a-success': '#57C08B',
  '--a-success-tint': 'rgba(87, 192, 139, 0.12)',
  '--a-seg': '#121519',
  '--a-seg-on': '#2C323A',
  '--a-shadow': '0 24px 56px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.4)',
  '--a-overlay': 'rgba(5, 6, 8, 0.62)',
};

const LIGHT: Record<string, string> = {
  '--a-bg': '#F4F5F7',
  '--a-panel': '#FFFFFF',
  '--a-surface': '#FFFFFF',
  '--a-surface2': '#F8F9FA',
  '--a-raised': '#FFFFFF',
  '--a-field': '#FFFFFF',
  '--a-line': '#E2E5E9',
  '--a-line2': '#E2E5E9',
  '--a-line3': '#D5D9DE',
  '--a-hover': '#F4F5F7',
  '--a-active': '#EEF0F3',
  '--a-text': '#16191D',
  '--a-text2': '#3A4048',
  '--a-muted': '#5B636D',
  '--a-faint': '#5B636D',
  '--a-accent': '#1D4ED8',
  '--a-accent-tint': '#E3ECFD',
  '--a-avatar': '#E3ECFD',
  '--a-primary': '#2563EB',
  '--a-primary-hover': '#1D4ED8',
  '--a-danger': '#B42318',
  '--a-danger-line': '#F3C4BE',
  '--a-danger-tint': '#FDECEA',
  '--a-success': '#1F7A4B',
  '--a-success-tint': '#DDF3E7',
  '--a-seg': '#F1F2F4',
  '--a-seg-on': '#FFFFFF',
  '--a-shadow': '0 24px 56px rgba(16, 24, 40, 0.16), 0 2px 6px rgba(16, 24, 40, 0.08)',
  '--a-overlay': 'rgba(16, 24, 40, 0.45)',
};

export function themeVars(isDark: boolean): React.CSSProperties {
  return { ...(isDark ? DARK : LIGHT), fontFamily: "'IBM Plex Sans', system-ui, sans-serif" } as React.CSSProperties;
}

/** Tercihi (açık/koyu/sistem) gerçek temaya çevirir; sistem ayarı değişince güncellenir. */
export function useResolvedDark(pref: AdminThemePref): boolean {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [systemDark, setSystemDark] = useState<boolean>(query ? query.matches : true);
  useEffect(() => {
    if (!query) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, []);
  return pref === 'system' ? systemDark : pref === 'dark';
}

/** IBM Plex yazı tiplerini yalnızca yönetici paneli açıldığında yükler. */
export function useAdminFonts(): void {
  useEffect(() => {
    const id = 'admin-plex-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export function roleLabel(role: StaffRole | string, lang: AdminLang): string {
  const tr: Record<string, string> = { super_admin: 'Süper Yönetici', production: 'Üretim Sorumlusu', support: 'Destek', warehouse: 'Depo' };
  const en: Record<string, string> = { super_admin: 'Super Admin', production: 'Production', support: 'Support', warehouse: 'Warehouse' };
  return (lang === 'tr' ? tr : en)[role] || String(role);
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toLocaleUpperCase('tr-TR');
}

export const Avatar: React.FC<{ name: string; photo?: string | null; size?: number }> = ({ name, photo, size = 30 }) => (
  photo ? (
    <img src={photo} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="rounded-full shrink-0 flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: 'var(--a-avatar)', color: 'var(--a-accent)' }}
    >
      {initials(name)}
    </span>
  )
);

/** Küçük çizgi simgeler (lucide ile aynı stil) */
export const Icon: React.FC<{ name: IconName; size?: number; className?: string; style?: React.CSSProperties }> = ({ name, size = 17, className, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
    {PATHS[name]}
  </svg>
);

export type IconName =
  | 'layers' | 'qr' | 'car' | 'users' | 'shield' | 'user' | 'key' | 'devices' | 'activity' | 'help'
  | 'logout' | 'globe' | 'sun' | 'moon' | 'laptop' | 'chevronDown' | 'chevronLeft' | 'chevronRight'
  | 'menu' | 'x' | 'check' | 'lock' | 'phone' | 'clock' | 'info' | 'login' | 'ban'
  | 'grid' | 'alert' | 'calendar' | 'refresh' | 'plus' | 'trash' | 'arrowUp' | 'arrowDown'
  | 'box' | 'store' | 'print' | 'zip' | 'undo' | 'search' | 'dots' | 'download' | 'arrowRight' | 'arrowLeft';

const PATHS: Record<IconName, React.ReactNode> = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17 21h4v-3" /></>,
  car: <><path d="M5 16h14M6 16l1.6-5.2a1 1 0 0 1 1-.8h6.8a1 1 0 0 1 1 .8L18 16" /><path d="M4 16v3h3v-3M17 16v3h3v-3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M15 8l2 2" /></>,
  devices: <><rect x="2" y="4" width="14" height="10" rx="2" /><path d="M6 18h6" /><rect x="17" y="8" width="5" height="12" rx="1" /></>,
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" /><path d="M12 17h.01" /></>,
  logout: <><path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  login: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="m10 17 5-5-5-5" /><path d="M15 12H3" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5 9-10" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  clock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  ban: <><circle cx="12" cy="12" r="8" /><path d="m6.5 6.5 11 11" /></>,
  grid: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
  store: <><path d="M4 9h16l-1.5-5h-13z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  print: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  zip: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M11 7h1M11 10h1M11 13h1v3h-1z" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
};

/** İki/üç seçenekli kaydırmalı seçici */
export function Segmented<T extends string>({ value, options, onChange, label, size = 'sm' }: {
  value: T;
  options: { value: T; label?: string; icon?: IconName; aria?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'lg';
}) {
  const h = size === 'lg' ? 38 : 28;
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg p-0.5" style={{ background: 'var(--a-seg)', border: '1px solid var(--a-line2)' }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria || o.label}
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-center rounded-md text-xs transition-colors ${size === 'lg' ? 'flex-1' : ''} ${o.label ? 'px-3' : 'w-9'}`}
            style={{
              height: h,
              background: on ? 'var(--a-seg-on)' : 'transparent',
              color: on ? 'var(--a-text)' : 'var(--a-muted)',
              fontWeight: on ? 600 : 400,
              boxShadow: on ? '0 1px 2px rgba(16, 24, 40, 0.12)' : 'none',
            }}
          >
            {o.icon ? <Icon name={o.icon} size={15} /> : o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "7 sa 18 dk" */
export function formatRemaining(ms: number, lang: AdminLang): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return lang === 'tr' ? (h > 0 ? `${h} sa ${m} dk` : `${m} dk`) : (h > 0 ? `${h}h ${m}m` : `${m}m`);
}

export function formatClock(d: Date | null, lang: AdminLang): string {
  if (!d) return '—';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return lang === 'tr' ? `bugün ${time}` : `today ${time}`;
  if (yesterday) return lang === 'tr' ? `dün ${time}` : `yesterday ${time}`;
  return `${d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

export function formatAgo(d: Date | null, lang: AdminLang): string {
  if (!d) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return lang === 'tr' ? 'şimdi' : 'now';
  if (mins < 60) return lang === 'tr' ? `${mins} dk önce` : `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return lang === 'tr' ? `${h} sa önce` : `${h}h ago`;
  return formatClock(d, lang);
}

/** Dakikada bir yenilenen saat (geri sayımlar için) */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

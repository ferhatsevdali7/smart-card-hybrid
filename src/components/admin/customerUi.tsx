// Kullanıcılar ve Bağlı Araçlar sayfalarının ortak parçaları (sade kart düzeni)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLang, Icon, IconName, MONO } from './adminUi';
import { errorText } from './lifecycleUi';

export const nfFor = (lang: AdminLang) => new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB');

export function fmtDay(ms: number | null, lang: AdminLang, withTime = false): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: sameYear && withTime ? undefined : 'numeric' });
  return withTime ? `${date} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}` : date;
}

/** "2 saat önce", "dün", "5 Eki" */
export function fmtAgo(ms: number | null, lang: AdminLang): string {
  if (!ms) return '—';
  const tr = lang === 'tr';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 2) return tr ? 'şimdi' : 'just now';
  if (mins < 60) return tr ? `${mins} dk önce` : `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return tr ? `${h} saat önce` : `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return tr ? 'dün' : 'yesterday';
  if (days < 7) return tr ? `${days} gün önce` : `${days} days ago`;
  return fmtDay(ms, lang);
}

// ------------------------------------------------------------------ kartlar ve satırlar

export const Card: React.FC<{ title?: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }> = ({ title, sub, right, children, className = '', pad = true }) => (
  <section className={`rounded-[14px] ${pad ? 'p-6 sm:p-7' : ''} ${className}`} style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)' }}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {title && <h2 className="m-0 text-[15.5px] font-medium">{title}</h2>}
          {sub && <p className="m-0 mt-1.5 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{sub}</p>}
        </div>
        {right && <div className="shrink-0 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{right}</div>}
      </div>
    )}
    <div className={title || right ? 'mt-3' : ''}>{children}</div>
  </section>
);

/** Kart içinde "etiket — değer" satırı */
export const InfoRow: React.FC<{ label: React.ReactNode; children: React.ReactNode; first?: boolean }> = ({ label, children, first }) => (
  <div className="flex items-center justify-between gap-4 py-4 text-[13.5px]" style={{ borderTop: first ? undefined : '1px solid var(--a-line)' }}>
    <span className="shrink-0" style={{ color: 'var(--a-muted)' }}>{label}</span>
    <span className="min-w-0 text-right break-words">{children}</span>
  </div>
);

export const StatCards: React.FC<{ items: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] }> = ({ items }) => (
  <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
    {items.map((it, i) => (
      <div key={i} className="rounded-[14px] px-5 py-5 min-w-0" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)' }}>
        <div className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{it.label}</div>
        <div className="text-[26px] font-medium tracking-[-0.4px] leading-none mt-3">{it.value}</div>
        {it.sub && <div className="text-[12px] mt-2.5 truncate" style={{ color: 'var(--a-faint)' }}>{it.sub}</div>}
      </div>
    ))}
  </div>
);

export const Tabs: React.FC<{ tabs: { id: string; label: string; count?: React.ReactNode }[]; value: string; onChange: (id: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex gap-7 overflow-x-auto" role="tablist" style={{ borderBottom: '1px solid var(--a-line)' }}>
    {tabs.map((t) => {
      const on = t.id === value;
      return (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(t.id)}
          className="pb-3.5 text-[14px] flex items-center gap-2 whitespace-nowrap transition-colors"
          style={{ color: on ? 'var(--a-text)' : 'var(--a-muted)', boxShadow: on ? 'inset 0 -2px 0 var(--a-text)' : undefined }}
        >
          {t.label}
          {t.count !== undefined && <span className="text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{t.count}</span>}
        </button>
      );
    })}
  </div>
);

/** Durum noktası: açık (yeşil) / kapalı (gri) */
export const StatusDot: React.FC<{ on: boolean; onText: string; offText: string; color?: string }> = ({ on, onText, offText, color }) => (
  <span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap" style={{ color: on ? 'var(--a-text2)' : 'var(--a-faint)' }}>
    <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: on ? (color || 'var(--a-success)') : 'var(--a-line3)' }} />
    {on ? onText : offText}
  </span>
);

export const ColorDot: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap">
    <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color }} />{children}
  </span>
);

/** Türk plakası rozeti */
export const Plate: React.FC<{ plate: string; large?: boolean }> = ({ plate, large }) => (
  <span
    className={`inline-flex items-stretch overflow-hidden whitespace-nowrap ${large ? 'h-11 rounded-[7px] text-[21px] self-start sm:self-auto' : 'h-[26px] rounded-[5px] text-[13px] self-start sm:self-auto'}`}
    style={{ border: '1px solid var(--a-line3)', background: 'var(--a-field)', fontFamily: MONO, fontWeight: 500, letterSpacing: '0.5px', color: 'var(--a-text)' }}
  >
    <i className={large ? 'w-2' : 'w-[5px]'} style={{ background: '#2563EB' }} />
    <span className={`flex items-center ${large ? 'px-4' : 'px-2.5'}`}>{plate || '—'}</span>
  </span>
);

export const Initials: React.FC<{ text: string; large?: boolean; icon?: IconName }> = ({ text, large, icon }) => (
  <span
    className={`rounded-full inline-flex items-center justify-center shrink-0 font-medium ${large ? 'w-14 h-14 text-[18px]' : 'w-[34px] h-[34px] text-[12px]'}`}
    style={{ background: 'var(--a-active)', color: icon ? 'var(--a-faint)' : 'var(--a-text2)' }}
    aria-hidden="true"
  >
    {icon ? <Icon name={icon} size={large ? 22 : 16} /> : text}
  </span>
);

export const Tag: React.FC<{ children: React.ReactNode; tone?: 'plain' | 'ok' | 'warn' }> = ({ children, tone = 'plain' }) => (
  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-[12px] whitespace-nowrap" style={{
    background: tone === 'ok' ? 'var(--a-success-tint)' : 'var(--a-active)',
    color: tone === 'ok' ? 'var(--a-success)' : tone === 'warn' ? '#E3A857' : 'var(--a-muted)',
  }}>{children}</span>
);

/** Büyük arama kutusu (yazdıkça arar) */
export const BigSearch: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; label?: string; mono?: boolean; busy?: boolean }> = ({ value, onChange, placeholder, label, mono, busy }) => (
  <div>
    {label && <div className="text-[12.5px] mb-2.5" style={{ color: 'var(--a-muted)' }}>{label}</div>}
    <label className="flex items-center gap-3 h-11 px-4 rounded-[10px] w-full transition-colors" style={{ border: `1px solid ${value ? 'var(--a-line3)' : 'var(--a-line2)'}`, background: 'var(--a-field)', color: 'var(--a-faint)' }}>
      <Icon name="search" size={17} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label || placeholder}
        maxLength={40}
        className="flex-1 min-w-0 bg-transparent outline-none text-[14px]"
        style={{ color: 'var(--a-text)', fontFamily: mono && value ? MONO : undefined, letterSpacing: mono && value ? '0.4px' : undefined }}
      />
      {busy && <span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>…</span>}
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Aramayı temizle" style={{ color: 'var(--a-faint)' }}><Icon name="x" size={15} /></button>
      )}
    </label>
  </div>
);

export const Pager: React.FC<{ text: React.ReactNode; canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void; lang: AdminLang }> = ({ text, canPrev, canNext, onPrev, onNext, lang }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 text-[12.5px]">
    <span style={{ color: 'var(--a-faint)' }}>{text}</span>
    {(canPrev || canNext) && (
      <div className="flex gap-2">
        <button type="button" disabled={!canPrev} onClick={onPrev} className="inline-flex items-center gap-2 h-8 px-3 rounded-lg transition-colors hover:bg-[var(--a-hover)] disabled:opacity-40 disabled:cursor-not-allowed" style={{ border: '1px solid var(--a-line2)' }}>
          <Icon name="arrowLeft" size={14} />{lang === 'tr' ? 'Önceki' : 'Previous'}
        </button>
        <button type="button" disabled={!canNext} onClick={onNext} className="inline-flex items-center gap-2 h-8 px-3 rounded-lg transition-colors hover:bg-[var(--a-hover)] disabled:opacity-40 disabled:cursor-not-allowed" style={{ border: '1px solid var(--a-line2)' }}>
          {lang === 'tr' ? 'Sonraki' : 'Next'}<Icon name="arrowRight" size={14} />
        </button>
      </div>
    )}
  </div>
);

export const ErrorPanel: React.FC<{ error: unknown; lang: AdminLang; onRetry?: () => void }> = ({ error, lang, onRetry }) => (
  <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl px-4 py-3.5 text-[13px]" style={{ border: '1px solid var(--a-danger-line)', background: 'var(--a-danger-tint)' }}>
    <span className="flex items-center gap-2.5 flex-1" style={{ color: 'var(--a-danger)' }}><Icon name="alert" size={16} />{errorText(error, lang)}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="h-8 px-3 rounded-lg text-[12.5px] hover:bg-[var(--a-hover)]" style={{ border: '1px solid var(--a-line2)', color: 'var(--a-text)' }}>
        {lang === 'tr' ? 'Tekrar dene' : 'Retry'}
      </button>
    )}
  </div>
);

export const NoAccess: React.FC<{ lang: AdminLang; title: string }> = ({ lang, title }) => (
  <div className="max-w-[1180px] mx-auto">
    <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px]">{title}</h1>
    <div className="mt-10 flex flex-col items-center text-center gap-2 py-16 px-4 rounded-xl" style={{ border: '1px dashed var(--a-line2)' }}>
      <span style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={26} /></span>
      <div className="text-[14px] mt-1">{lang === 'tr' ? 'Bu sayfa için yetkiniz yok' : 'You do not have access to this page'}</div>
      <p className="m-0 text-[12.5px] max-w-md" style={{ color: 'var(--a-faint)' }}>
        {lang === 'tr' ? 'Müşteri kayıtlarını yalnızca destek ekibi ve süper yöneticiler görebilir.' : 'Only support staff and super admins can see customer records.'}
      </p>
    </div>
  </div>
);

export const BackLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-[var(--a-text)]" style={{ color: 'var(--a-muted)' }}>
    <Icon name="arrowLeft" size={14} />{label}
  </button>
);

export const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-[12.5px] underline underline-offset-4 transition-colors hover:text-[var(--a-text)]" style={{ color: 'var(--a-muted)', textDecorationColor: 'var(--a-line3)' }}>
    {children}
  </button>
);

// ------------------------------------------------------------------ veri yükleme yardımcıları

/** Yazdıkça aramak için gecikmeli değer */
export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Tek bir uzak çağrının sonucu. key değişince yeniden yükler; eski isteğin cevabı
 * geç gelse bile yenisinin üzerine yazmaz.
 */
export function useRemote<T>(fn: () => Promise<T>, key: string): { data: T | null; error: unknown; loading: boolean; reload: () => void } {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    fnRef.current().then(
      (data) => { if (id === seq.current) setState({ data, error: null, loading: false }); },
      (error) => { if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false })); },
    );
  }, []);
  useEffect(() => { load(); }, [key, load]);
  return { ...state, reload: load };
}

/** İmleçli sayfalama: sonraki sayfa imleci + geri dönmek için imleç yığını */
export function useCursorPages(resetKey: string): { cursor: string | null; page: number; next: (c: string) => void; prev: () => void } {
  const [stack, setStack] = useState<(string | null)[]>([null]);
  useEffect(() => { setStack([null]); }, [resetKey]);
  return {
    cursor: stack[stack.length - 1],
    page: stack.length,
    next: (c) => setStack((s) => [...s, c]),
    prev: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };
}

export const SkeletonRows: React.FC<{ rows?: number; h?: number }> = ({ rows = 6, h = 56 }) => (
  <div className="flex flex-col gap-2.5 animate-pulse" aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="rounded-lg" style={{ height: h, background: 'var(--a-hover)' }} />)}
  </div>
);

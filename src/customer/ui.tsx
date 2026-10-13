// Müşteri sitesi: ortak görünüm parçaları. Renkler CSS değişkenlerinden gelir (açık / koyu tema).

import React, { createContext, useContext } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Info, Loader2, X } from 'lucide-react';

export type Lang = 'tr' | 'en';
export type ThemeName = 'light' | 'dark';

export const P = '#14798D';

const LIGHT: Record<string, string> = {
  bg: '#F5F6F8', sf: '#FFFFFF', ln: '#E5E7EB', ln2: '#D1D5DB', tx: '#111827', mu: '#4B5563', fn: '#6B7280',
  tint: '#E8F3F5', tintb: '#CFE6EA', pt: '#0E6476', ok: '#15803D', okb: '#ECFDF3', wr: '#B45309', wrb: '#FFF7ED',
  dg: '#B42318', dgb: '#FEF3F2', sub: '#F3F4F6', p: P, ph: '#9CA3AF', shadow: '0 1px 2px rgba(17,24,39,.04)',
};
const DARK: Record<string, string> = {
  bg: '#0B0D10', sf: '#14171C', ln: '#23272F', ln2: '#323843', tx: '#F3F4F6', mu: '#AEB4BE', fn: '#8A919C',
  tint: 'rgba(20,121,141,.18)', tintb: 'rgba(20,121,141,.35)', pt: '#7CC7D4', ok: '#4ADE80', okb: 'rgba(74,222,128,.10)', wr: '#F5B76A', wrb: 'rgba(245,183,106,.10)',
  dg: '#F98B83', dgb: 'rgba(249,139,131,.10)', sub: '#1B1F25', p: P, ph: '#6B7280', shadow: 'none',
};
export const THEME_BG = { light: LIGHT.bg, dark: DARK.bg };
export function themeVars(t: ThemeName): React.CSSProperties {
  const src = t === 'dark' ? DARK : LIGHT;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) out[`--c-${k}`] = v;
  return out as React.CSSProperties;
}

// ------------------------------------------------------------------ dil
export const LangCtx = createContext<Lang>('tr');
export function useL() {
  const lang = useContext(LangCtx);
  return (tr: string, en: string) => (lang === 'tr' ? tr : en);
}
export function useLang() { return useContext(LangCtx); }

// ------------------------------------------------------------------ yerleşim
export const Page: React.FC<{ children: React.ReactNode; wide?: number }> = ({ children, wide }) => (
  <div className="w-full mx-auto" style={{ maxWidth: wide || 760 }}>{children}</div>
);

export const H1: React.FC<{ children: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }> = ({ children, sub, right }) => (
  <div className="flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="m-0 text-[24px] lg:text-[28px] font-bold tracking-[-0.4px] leading-tight" style={{ color: 'var(--c-tx)' }}>{children}</h1>
      {sub && <div className="text-[13.5px] lg:text-[14px] mt-1" style={{ color: 'var(--c-fn)' }}>{sub}</div>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <div className={`text-[12.5px] font-semibold tracking-[.4px] uppercase ${first ? 'mt-0' : 'mt-[26px]'} mb-2`} style={{ color: 'var(--c-fn)' }}>{children}</div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; highlight?: boolean }> = ({ children, className = '', style, highlight }) => (
  <div className={`rounded-[14px] ${className}`} style={{ background: 'var(--c-sf)', border: `1px solid ${highlight ? 'var(--c-p)' : 'var(--c-ln)'}`, boxShadow: highlight ? '0 0 0 1px var(--c-p)' : 'var(--c-shadow)', ...style }}>{children}</div>
);

export const IconBox: React.FC<{ children: React.ReactNode; tone?: 'default' | 'accent' | 'ok' | 'danger'; size?: number }> = ({ children, tone = 'default', size = 34 }) => {
  const look = tone === 'accent' ? { bg: 'var(--c-tint)', c: 'var(--c-pt)' } : tone === 'ok' ? { bg: 'var(--c-okb)', c: 'var(--c-ok)' } : tone === 'danger' ? { bg: 'var(--c-dgb)', c: 'var(--c-dg)' } : { bg: 'var(--c-sub)', c: 'var(--c-mu)' };
  return <span className="rounded-[9px] flex items-center justify-center shrink-0" style={{ width: size, height: size, background: look.bg, color: look.c }}>{children}</span>;
};

/** Ayar satırı: simge, başlık, isteğe bağlı açıklama, sağda değer / düğme */
export const Row: React.FC<{
  icon?: React.ReactNode; title: React.ReactNode; desc?: React.ReactNode; value?: React.ReactNode; right?: React.ReactNode;
  onClick?: () => void; chevron?: boolean; danger?: boolean; first?: boolean; ariaLabel?: string;
}> = ({ icon, title, desc, value, right, onClick, chevron, danger, first, ariaLabel }) => {
  const inner = (
    <>
      {icon && <IconBox tone={danger ? 'danger' : 'default'}>{icon}</IconBox>}
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[15px] font-medium truncate" style={{ color: danger ? 'var(--c-dg)' : 'var(--c-tx)' }}>{title}</div>
        {desc && <div className="text-[12.5px] mt-[2px] leading-snug" style={{ color: 'var(--c-fn)' }}>{desc}</div>}
      </div>
      {value !== undefined && value !== null && <span className="text-[14px] truncate max-w-[45%] text-right" style={{ color: 'var(--c-fn)' }}>{value}</span>}
      {right}
      {(chevron ?? !!onClick) && <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--c-fn)' }} />}
    </>
  );
  const cls = 'w-full flex items-center gap-[13px] px-4 py-[13px] min-h-[58px]';
  const style = { borderTop: first ? undefined : '1px solid var(--c-ln)' };
  return onClick
    ? <button type="button" onClick={onClick} aria-label={ariaLabel} className={`${cls} transition-colors hover:bg-[var(--c-sub)] first:rounded-t-[14px] last:rounded-b-[14px]`} style={style}>{inner}</button>
    : <div className={cls} style={style}>{inner}</div>;
};

export const Switch: React.FC<{ on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }> = ({ on, onChange, disabled, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)}
    className="relative w-11 h-[26px] rounded-full shrink-0 transition-colors disabled:opacity-50" style={{ background: on ? 'var(--c-p)' : 'var(--c-ln2)' }}>
    <span className="absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 21 : 3 }} />
  </button>
);

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex p-[3px] rounded-[10px] gap-[2px]" style={{ background: 'var(--c-sub)' }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
            className="flex-1 px-3 py-[7px] rounded-[8px] text-[13px] font-semibold whitespace-nowrap transition-colors"
            style={on ? { background: 'var(--c-sf)', color: 'var(--c-tx)', boxShadow: '0 1px 2px rgba(0,0,0,.10)' } : { color: 'var(--c-mu)' }}>
            {o.t}
          </button>
        );
      })}
    </div>
  );
}

export const Btn: React.FC<{
  children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; busy?: boolean; disabled?: boolean;
  full?: boolean; type?: 'button' | 'submit'; small?: boolean; ariaLabel?: string; className?: string;
}> = ({ children, onClick, kind = 'primary', busy, disabled, full, type = 'button', small, ariaLabel, className = '' }) => {
  const look = kind === 'primary' ? { background: 'var(--c-p)', color: '#fff', border: '1px solid transparent' }
    : kind === 'danger' ? { background: '#B42318', color: '#fff', border: '1px solid transparent' }
      : kind === 'ghost' ? { background: 'transparent', color: 'var(--c-pt)', border: '1px solid transparent' }
        : { background: 'var(--c-sf)', color: 'var(--c-tx)', border: '1px solid var(--c-ln2)' };
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} aria-label={ariaLabel}
      className={`${full ? 'w-full' : ''} ${small ? 'h-[38px] px-[14px] text-[14px]' : 'h-[48px] px-5 text-[15px]'} rounded-[12px] font-semibold inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-45 ${className}`}
      style={look}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}{children}
    </button>
  );
};

export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; error?: string | null; htmlFor?: string; right?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, error, htmlFor, right, children }) => (
  <div className="mt-[18px]">
    <label htmlFor={htmlFor} className="flex justify-between gap-2 text-[13px] font-semibold mb-[7px]" style={{ color: 'var(--c-mu)' }}>
      <span>{label}</span>{right && <span className="font-normal" style={{ color: 'var(--c-fn)' }}>{right}</span>}
    </label>
    {children}
    {error ? <p role="alert" className="m-0 mt-[6px] text-[12.5px]" style={{ color: 'var(--c-dg)' }}>{error}</p>
      : hint ? <p className="m-0 mt-[6px] text-[12.5px] leading-snug" style={{ color: 'var(--c-fn)' }}>{hint}</p> : null}
  </div>
);

export const inputCls = 'w-full rounded-[10px] px-[14px] py-[12px] text-[15px] outline-none box-border transition-colors focus:border-[var(--c-p)] placeholder:text-[var(--c-ph)]';
export const inputStyle = (bad?: boolean): React.CSSProperties => ({ background: 'var(--c-sf)', color: 'var(--c-tx)', border: `1px solid ${bad ? 'var(--c-dg)' : 'var(--c-ln2)'}` });

export const Plate: React.FC<{ plate: string; small?: boolean }> = ({ plate, small }) => (
  <span className="inline-flex items-stretch rounded-[6px] overflow-hidden shrink-0" style={{ height: small ? 30 : 34, border: '1.5px solid #111827', background: '#fff', color: '#111827' }}>
    <span className="flex items-end justify-center pb-[4px]" style={{ width: 14, background: '#003399', color: '#fff', fontSize: 7, fontWeight: 700 }}>TR</span>
    <span className="px-[10px] flex items-center font-bold whitespace-nowrap" style={{ fontSize: small ? 14 : 16, letterSpacing: 1.2, fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' }}>{plate}</span>
  </span>
);

export const Pill: React.FC<{ tone: 'ok' | 'muted' | 'accent' | 'danger' | 'warn'; children: React.ReactNode; icon?: React.ReactNode }> = ({ tone, children, icon }) => {
  const look = { ok: ['var(--c-okb)', 'var(--c-ok)'], muted: ['var(--c-sub)', 'var(--c-fn)'], accent: ['var(--c-tint)', 'var(--c-pt)'], danger: ['var(--c-dgb)', 'var(--c-dg)'], warn: ['var(--c-wrb)', 'var(--c-wr)'] }[tone];
  return <span className="inline-flex items-center gap-[5px] h-[22px] px-[9px] rounded-full text-[11.5px] font-semibold whitespace-nowrap" style={{ background: look[0], color: look[1] }}>{icon}{children}</span>;
};

export const Ring: React.FC<{ pct: number; size?: number }> = ({ pct, size = 38 }) => {
  const r = (size - 6) / 2; const c = 2 * Math.PI * r;
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-label={`%${pct}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-ln)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-p)" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-bold" style={{ fontSize: size > 50 ? 14 : 10.5, color: 'var(--c-tx)' }}>%{pct}</span>
    </span>
  );
};

export const Notice: React.FC<{ tone: 'ok' | 'danger' | 'info' | 'warn'; children: React.ReactNode; onClose?: () => void; action?: React.ReactNode }> = ({ tone, children, onClose, action }) => {
  const look = { ok: ['var(--c-okb)', 'var(--c-ok)'], danger: ['var(--c-dgb)', 'var(--c-dg)'], info: ['var(--c-tint)', 'var(--c-pt)'], warn: ['var(--c-wrb)', 'var(--c-wr)'] }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className="flex items-start gap-[10px] px-3 py-[10px] rounded-[12px] text-[13.5px] leading-snug" style={{ background: look[0], color: look[1] }}>
      <Icon className="w-[17px] h-[17px] shrink-0 mt-[1px]" />
      <span className="flex-1 min-w-0">{children}</span>
      {action}
      {onClose && <button type="button" onClick={onClose} aria-label="Kapat" className="shrink-0 p-[2px]"><X className="w-4 h-4" /></button>}
    </div>
  );
};

export const BackLink: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button type="button" onClick={onClick} className="hidden lg:inline-flex items-center gap-[6px] text-[14px] font-semibold mb-[18px]" style={{ color: 'var(--c-fn)' }}>
    <ArrowLeft className="w-4 h-4" />{label}
  </button>
);

export const Loading: React.FC = () => (
  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--c-p)' }} /></div>
);

export const StepMark: React.FC<{ done: boolean }> = ({ done }) => done
  ? <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: 'var(--c-p)' }}><Check className="w-[14px] h-[14px]" /></span>
  : <span className="w-[26px] h-[26px] rounded-full shrink-0 box-border" style={{ border: '2px solid var(--c-ln2)' }} />;

/** Siyah-beyaz marka simgesi */
export const Logo: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: '#000', boxShadow: '0 0 0 1px rgba(255,255,255,.18)' }} aria-hidden="true">
    <span className="rounded-full flex items-center justify-center box-border text-white font-extrabold" style={{ width: size - 6, height: size - 6, border: '1.5px solid #fff', fontSize: size * 0.2, letterSpacing: 0.2 }}>H***F</span>
  </span>
);

export function initialsOf(name: string, email: string): string {
  const n = (name || '').trim();
  if (n) { const p = n.split(/\s+/); return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toLocaleUpperCase('tr-TR'); }
  return (email || '?').slice(0, 2).toLocaleUpperCase('tr-TR');
}

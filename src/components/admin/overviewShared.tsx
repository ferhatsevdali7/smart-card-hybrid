// Genel Bakış ve Dönem Karşılaştırma ekranlarının ortak parçaları.

import React from 'react';
import type { AdminLang } from './adminUi';
import type { OverviewMetric } from '../../lib/overviewService';

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** İstanbul saatine göre bugün: 2026-10-11 */
export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function fmtDay(key: string, lang: AdminLang, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', ...opts });
}

/** "11 Ağu – 9 Eyl" (yıllar farklıysa yıl da yazılır) */
export function fmtRange(start: string, end: string, lang: AdminLang, withYear = false): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const a = fmtDay(start, lang, { day: 'numeric', month: 'short', year: withYear && !sameYear ? 'numeric' : undefined });
  const b = fmtDay(end, lang, { day: 'numeric', month: 'short', year: withYear || !sameYear ? 'numeric' : undefined });
  return `${a} – ${b}`;
}

export const nf = (lang: AdminLang) => new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB');

export function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || 10 * pow;
  const s = step < 1 ? 1 : step;
  return { top: Math.ceil(max / s) * s, step: s };
}

export const METRICS: { id: OverviewMetric; tr: string; en: string; unitTr: string; unitEn: string }[] = [
  { id: 'scans', tr: 'QR okutma', en: 'QR scans', unitTr: 'okutma', unitEn: 'scans' },
  { id: 'notices', tr: 'Bildirim', en: 'Notices', unitTr: 'bildirim', unitEn: 'notices' },
  { id: 'newUsers', tr: 'Yeni kullanıcı', en: 'New users', unitTr: 'yeni kullanıcı', unitEn: 'new users' },
  { id: 'claims', tr: 'QR bağlama', en: 'QR links', unitTr: 'bağlama', unitEn: 'links' },
  { id: 'newVehicles', tr: 'Yeni araç', en: 'New vehicles', unitTr: 'yeni araç', unitEn: 'new vehicles' },
];

export function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* tarayıcı izin vermiyorsa yok say */ }
}

export const MetricTabs: React.FC<{ value: OverviewMetric; onChange: (m: OverviewMetric) => void; lang: AdminLang }> = ({ value, onChange, lang }) => (
  <div role="tablist" className="flex gap-5 md:gap-6 overflow-x-auto" style={{ borderBottom: '1px solid var(--a-line)' }}>
    {METRICS.map((x) => {
      const on = x.id === value;
      return (
        <button
          key={x.id}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onChange(x.id)}
          className="pb-3 -mb-px text-[13px] whitespace-nowrap transition-colors"
          style={{ color: on ? 'var(--a-text)' : 'var(--a-faint)', borderBottom: `1.5px solid ${on ? 'var(--a-text)' : 'transparent'}` }}
        >
          {lang === 'tr' ? x.tr : x.en}
        </button>
      );
    })}
  </div>
);

export const DateField: React.FC<{ label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }> = ({ label, value, min, max, onChange }) => (
  <label className="flex flex-col gap-1 min-w-0 text-[12px]" style={{ color: 'var(--a-faint)' }}>
    {label}
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full min-w-0 px-2.5 rounded-lg text-[13px] outline-none"
      style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
    />
  </label>
);

export const SectionHead: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }> = ({ title, sub, right }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div className="min-w-0">
      <h2 className="m-0 text-[15px] font-medium">{title}</h2>
      {sub && <p className="m-0 mt-1 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{sub}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

export const LinkBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>
    {children}
  </button>
);

export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
    <span className="relative inline-block w-7 h-4 rounded-full transition-colors" style={{ background: on ? 'var(--a-text)' : 'var(--a-line3)' }}>
      <span className="absolute top-0.5 w-3 h-3 rounded-full transition-all" style={{ left: on ? 14 : 2, background: on ? 'var(--a-bg)' : 'var(--a-faint)' }} />
    </span>
    {label}
  </button>
);

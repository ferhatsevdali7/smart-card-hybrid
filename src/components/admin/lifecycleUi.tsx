// QR yaşam döngüsü sayfalarının ortak parçaları (QR Deposu, Parti, Satış Standı, QR Bankası, Devre Dışı, Çöp Kutusu)

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon, IconName } from './adminUi';
import type { ActionResult, Stage } from '../../lib/lifecycleService';
import { functionErrorMessage } from '../../lib/functionsClient';

// ------------------------------------------------------------------ aşamalar

const COLORS_DARK: Record<Stage, string> = {
  in_stock: '#A1A1AA', on_sale: '#7AB0FF', active: '#5DBE8E', disabled: '#E3A857', expired: '#C9A66B', trashed: '#E8776C',
};
const COLORS_LIGHT: Record<Stage, string> = {
  in_stock: '#71717A', on_sale: '#1D4ED8', active: '#1F7A4B', disabled: '#B45309', expired: '#92400E', trashed: '#B42318',
};

export function stageColor(stage: Stage, isDark: boolean): string {
  return (isDark ? COLORS_DARK : COLORS_LIGHT)[stage];
}

const LABELS: Record<Stage, { tr: string; en: string; shortTr: string; shortEn: string }> = {
  in_stock: { tr: 'Depoda', en: 'In stock', shortTr: 'Depoda', shortEn: 'In stock' },
  on_sale: { tr: 'Satış standında', en: 'On sale', shortTr: 'Standda', shortEn: 'On sale' },
  active: { tr: 'QR bankasında', en: 'In QR bank', shortTr: 'Bankada', shortEn: 'In bank' },
  disabled: { tr: 'Devre dışı', en: 'Disabled', shortTr: 'Devre dışı', shortEn: 'Disabled' },
  expired: { tr: 'Süresi doldu', en: 'Expired', shortTr: 'Süresi doldu', shortEn: 'Expired' },
  trashed: { tr: 'Çöp kutusunda', en: 'In trash', shortTr: 'Çöpte', shortEn: 'Trash' },
};

export function stageLabel(stage: Stage, lang: AdminLang, short = false): string {
  const l = LABELS[stage];
  return lang === 'tr' ? (short ? l.shortTr : l.tr) : (short ? l.shortEn : l.en);
}

export const StageBadge: React.FC<{ stage: Stage; isDark: boolean; lang: AdminLang; label?: string }> = ({ stage, isDark, lang, label }) => (
  <span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap">
    <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: stageColor(stage, isDark) }} />
    {label || stageLabel(stage, lang)}
  </span>
);

export const StageBar: React.FC<{ parts: [Stage, number][]; isDark: boolean; height?: number }> = ({ parts, isDark, height = 6 }) => {
  const total = parts.reduce((a, [, v]) => a + v, 0);
  return (
    <div className="flex overflow-hidden rounded-full gap-[2px]" style={{ height, background: 'var(--a-line)' }} role="img" aria-label={parts.map(([s, v]) => `${s}: ${v}`).join(', ')}>
      {total > 0 && parts.filter(([, v]) => v > 0).map(([s, v]) => (
        <span key={s} style={{ width: `${(v / total) * 100}%`, background: stageColor(s, isDark) }} />
      ))}
    </div>
  );
};

export const StageLegend: React.FC<{ parts: [Stage, number][]; isDark: boolean; lang: AdminLang }> = ({ parts, isDark, lang }) => (
  <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 mt-2.5 text-[12px]" style={{ color: 'var(--a-text2)' }}>
    {parts.map(([s, v]) => (
      <span key={s} className="inline-flex items-center gap-[7px]">
        <i className="w-[7px] h-[7px] rounded-full" style={{ background: stageColor(s, isDark) }} />
        {stageLabel(s, lang)} <span style={{ color: 'var(--a-faint)' }}>{v}</span>
      </span>
    ))}
  </div>
);

// ------------------------------------------------------------------ biçimlendirme

export function fmtDate(d: Date | null, lang: AdminLang, withTime = false): string {
  if (!d) return '—';
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() && !withTime ? undefined : 'numeric' });
  return withTime ? `${date} ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}` : date;
}

export function daysSince(d: Date | null): number | null {
  return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null;
}

const LAST_ACTION: Record<string, { tr: string; en: string }> = {
  created: { tr: 'Üretildi', en: 'Produced' },
  migrated: { tr: 'Depoya taşındı', en: 'Moved to stock' },
  release: { tr: 'Satışa çıktı', en: 'Released' },
  unrelease: { tr: 'Depoya geri alındı', en: 'Returned to stock' },
  mark_printed: { tr: 'Basıldı', en: 'Printed' },
  unmark_printed: { tr: 'Basılmadı yapıldı', en: 'Marked unprinted' },
  trash: { tr: 'Çöpe atıldı', en: 'Trashed' },
  restore: { tr: 'Geri yüklendi', en: 'Restored' },
  claimed: { tr: 'Bağlandı', en: 'Linked' },
  moved: { tr: 'Araç değişti', en: 'Moved' },
  reported_lost: { tr: 'Kayıp bildirildi', en: 'Reported lost' },
  disable: { tr: 'Kapatıldı', en: 'Disabled' },
  enable: { tr: 'Yeniden açıldı', en: 'Re-enabled' },
  expire: { tr: 'Süresi bitirildi', en: 'Expired' },
  reset: { tr: 'Eşleşme sıfırlandı', en: 'Reset' },
};

export function lastActionText(action: string | null, lang: AdminLang): string {
  if (!action) return lang === 'tr' ? 'Üretildi' : 'Produced';
  const a = LAST_ACTION[action];
  return a ? (lang === 'tr' ? a.tr : a.en) : action;
}

/** "4 QR satışa çıkarıldı · 1 QR atlandı (Bu aşamadaki QR için uygun değil)" */
export function resultMessage(r: ActionResult, doneText: string, lang: AdminLang): { text: string; kind: 'ok' | 'warn' } {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (!r.skipped.length) return { text: doneText, kind: 'ok' };
  const reasons = [...new Set(r.skipped.map((s) => s.reason))].slice(0, 2).join('; ');
  const skip = L(`${r.skipped.length} QR atlandı (${reasons})`, `${r.skipped.length} skipped (${reasons})`);
  return { text: r.done ? `${doneText} · ${skip}` : skip, kind: 'warn' };
}

export function errorText(e: unknown, lang: AdminLang): string {
  return functionErrorMessage(e, lang === 'tr' ? 'İşlem yapılamadı. Lütfen tekrar deneyin.' : 'Action failed. Please try again.');
}

// ------------------------------------------------------------------ küçük bileşenler

export const PageHeader: React.FC<{ title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; back?: { label: string; onClick: () => void } }> = ({ title, sub, right, back }) => (
  <div>
    {back && (
      <button type="button" onClick={back.onClick} className="flex items-center gap-1.5 mb-3 text-[12.5px] transition-colors hover:text-[var(--a-text)]" style={{ color: 'var(--a-muted)' }}>
        <Icon name="arrowLeft" size={14} />{back.label}
      </button>
    )}
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px] break-words">{title}</h1>
        {sub && <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap gap-2 shrink-0">{right}</div>}
    </div>
  </div>
);

export const Btn: React.FC<{
  onClick?: () => void; icon?: IconName; children?: React.ReactNode; variant?: 'primary' | 'ghost' | 'danger' | 'dangerSolid';
  disabled?: boolean; title?: string; small?: boolean; ariaLabel?: string;
}> = ({ onClick, icon, children, variant = 'ghost', disabled, title, small, ariaLabel }) => {
  const style: React.CSSProperties =
    variant === 'primary' ? { background: 'var(--a-primary)', color: '#fff', border: '1px solid transparent' }
      : variant === 'dangerSolid' ? { background: '#B93B2F', color: '#fff', border: '1px solid transparent' }
        : variant === 'danger' ? { color: 'var(--a-danger)', border: '1px solid var(--a-danger-line)' }
          : { color: 'var(--a-text)', border: '1px solid var(--a-line2)' };
  return (
    <button
      type="button"
      // Tablo satırlarının içindeki düğmeler satırın kendi tıklamasını (önizleme) tetiklemesin.
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center gap-2 rounded-lg whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variant === 'primary' || variant === 'dangerSolid' ? 'font-medium hover:brightness-110' : 'hover:bg-[var(--a-hover)]'} ${small ? 'h-[30px] px-2.5 text-[12.5px]' : 'h-[34px] px-3.5 text-[13px]'}`}
      style={style}
    >
      {icon && <Icon name={icon} size={small ? 14 : 15} />}
      {children}
    </button>
  );
};

export const Checkbox: React.FC<{ checked: boolean; indeterminate?: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string; title?: string }> = ({ checked, indeterminate, disabled, onChange, label, title }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      title={title}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 align-middle cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
      style={{ accentColor: 'var(--a-text)' }}
    />
  );
};

export const FilterChip: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode; count?: number; dot?: string }> = ({ on, onClick, children, count, dot }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className="inline-flex items-center gap-[7px] h-[30px] px-[11px] rounded-[7px] text-[12.5px] transition-colors hover:bg-[var(--a-hover)]"
    style={{ background: on ? 'var(--a-active)' : undefined, color: on ? 'var(--a-text)' : 'var(--a-muted)' }}
  >
    {dot && <i className="w-[7px] h-[7px] rounded-full" style={{ background: dot }} />}
    {children}
    {count !== undefined && <span style={{ color: on ? 'var(--a-muted)' : 'var(--a-faint)' }}>{count}</span>}
  </button>
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; width?: number }> = ({ value, onChange, placeholder, width = 260 }) => (
  <label className="flex items-center gap-2 h-[34px] px-3 rounded-lg w-full" style={{ border: '1px solid var(--a-line2)', color: 'var(--a-faint)', background: 'var(--a-field)', maxWidth: width }}>
    <Icon name="search" size={15} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
      style={{ color: 'var(--a-text)' }}
    />
    {value && (
      <button type="button" onClick={() => onChange('')} aria-label="Temizle" className="shrink-0" style={{ color: 'var(--a-faint)' }}><Icon name="x" size={14} /></button>
    )}
  </label>
);

export const Kpis: React.FC<{ items: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; dot?: string }[] }> = ({ items }) => (
  <div className="grid grid-cols-2 md:flex gap-y-6">
    {items.map((it, i) => (
      <div key={i} className={`min-w-0 md:flex-1 ${i % 2 === 1 ? 'pl-5 border-l' : 'pr-5'} ${i === 0 ? 'md:pl-0 md:pr-6' : 'md:pl-6 md:pr-6 md:border-l'}`} style={{ borderColor: 'var(--a-line)' }}>
        <div className="flex items-center gap-[7px] text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>
          {it.dot && <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: it.dot }} />}{it.label}
        </div>
        <div className="text-[26px] font-medium tracking-[-0.4px] leading-none mt-2.5">{it.value}</div>
        {it.sub && <div className="text-[12px] mt-2" style={{ color: 'var(--a-faint)' }}>{it.sub}</div>}
      </div>
    ))}
  </div>
);

export const Note: React.FC<{ children: React.ReactNode; tone?: 'info' | 'plain' }> = ({ children, tone = 'plain' }) => (
  <p className="m-0 flex gap-2 items-start text-[12px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>
    <span className="mt-px shrink-0" style={{ color: tone === 'info' ? 'var(--a-accent)' : undefined }}><Icon name="info" size={14} /></span>
    <span>{children}</span>
  </p>
);

export const EmptyState: React.FC<{ icon: IconName; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <div className="flex flex-col items-center text-center gap-2 py-16 px-4 rounded-xl" style={{ border: '1px dashed var(--a-line2)' }}>
    <span style={{ color: 'var(--a-faint)' }}><Icon name={icon} size={26} /></span>
    <div className="text-[14px] mt-1">{title}</div>
    {text && <p className="m-0 text-[12.5px] max-w-md" style={{ color: 'var(--a-faint)' }}>{text}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const LoadingRows: React.FC = () => (
  <div className="flex flex-col gap-3 mt-2 animate-pulse" aria-hidden="true">
    {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-11 rounded" style={{ background: 'var(--a-hover)' }} />)}
  </div>
);

/** Tablo sarmalayıcı: dar ekranda yatay kaydırma (sayfa taşmaz) */
export const TableWrap: React.FC<{ children: React.ReactNode; minWidth?: number }> = ({ children, minWidth = 760 }) => (
  <div className="overflow-x-auto -mx-1 px-1">
    <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>{children}</table>
  </div>
);

export const Th: React.FC<{ children?: React.ReactNode; right?: boolean; w?: number }> = ({ children, right, w }) => (
  <th className={`pb-2.5 px-3 first:pl-0 last:pr-0 text-[12px] font-normal ${right ? 'text-right' : 'text-left'}`} style={{ color: 'var(--a-faint)', width: w }}>{children}</th>
);

export const Td: React.FC<{ children?: React.ReactNode; right?: boolean; mono?: boolean; muted?: boolean; w?: number; className?: string }> = ({ children, right, mono, muted, w, className = '' }) => (
  <td
    className={`h-12 px-3 first:pl-0 last:pr-0 ${right ? 'text-right' : ''} ${className}`}
    style={{ borderTop: '1px solid var(--a-line)', width: w, color: muted ? 'var(--a-muted)' : undefined, fontFamily: mono ? "'IBM Plex Mono', ui-monospace, monospace" : undefined, fontSize: mono ? 12 : undefined }}
  >
    {children}
  </td>
);

export const Dash: React.FC = () => <span style={{ color: 'var(--a-faint)' }}>—</span>;

// ------------------------------------------------------------------ seçim çubuğu

export const SelectionBar: React.FC<{ count: number; label: string; info?: React.ReactNode; onClear: () => void; children: React.ReactNode }> = ({ count, label, info, onClear, children }) => {
  if (count === 0) return null;
  return (
    <>
      {/* Sabit çubuk son satırları örtmesin diye altta boşluk */}
      <div aria-hidden="true" className="h-36 md:h-24" />
      <div className="fixed z-30 bottom-3 left-3 right-3 md:left-[264px] md:right-8 max-w-[1180px] md:mx-auto">
      <div
        className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}
        role="region"
        aria-label={label}
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="text-[13px]">{label}</span>
          {info}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {children}
          <button type="button" onClick={onClear} aria-label="Seçimi kaldır" className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-muted)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

// ------------------------------------------------------------------ onay penceresi

export const Dialog: React.FC<{
  title: string;
  icon?: IconName;
  danger?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  width?: number;
}> = ({ title, icon, danger, onClose, children, footer, width = 460 }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'var(--a-overlay)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-h-[90vh] overflow-y-auto rounded-t-[14px] sm:rounded-[14px] p-5 sm:p-6" style={{ maxWidth: width, background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}>
        <div className="flex items-center gap-3">
          {icon && (
            <span className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: danger ? 'var(--a-danger-tint)' : 'var(--a-accent-tint)', color: danger ? 'var(--a-danger)' : 'var(--a-accent)' }}>
              <Icon name={icon} size={18} />
            </span>
          )}
          <h3 className="m-0 text-[16px] font-medium">{title}</h3>
        </div>
        <div className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--a-text2)' }}>{children}</div>
        <div className="flex justify-end gap-2.5 mt-6">{footer}</div>
      </div>
    </div>
  );
};

/** Basit "emin misiniz" penceresi; onaylanınca işlem bitene kadar düğme meşgul görünür. */
export const ConfirmDialog: React.FC<{
  title: string; icon?: IconName; danger?: boolean; confirmLabel: string; cancelLabel: string;
  onConfirm: () => Promise<void> | void; onClose: () => void; children: React.ReactNode;
}> = ({ title, icon, danger, confirmLabel, cancelLabel, onConfirm, onClose, children }) => {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={title}
      icon={icon}
      danger={danger}
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{cancelLabel}</button>
          <Btn
            variant={danger ? 'dangerSolid' : 'primary'}
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}
          >
            {busy ? '…' : confirmLabel}
          </Btn>
        </>
      )}
    >
      {children}
    </Dialog>
  );
};

// ------------------------------------------------------------------ bildirim kutusu

type Toast = { id: number; text: string; kind: 'ok' | 'warn' | 'error' };

export function useToasts(): { node: React.ReactNode; show: (text: string, kind?: Toast['kind']) => void } {
  const [list, setList] = useState<Toast[]>([]);
  const seq = useRef(0);
  const remove = useCallback((id: number) => setList((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, text, kind }]);
    if (kind !== 'error') setTimeout(() => remove(id), kind === 'warn' ? 7000 : 4000);
  }, [remove]);
  const node = useMemo(() => (
    <div className="fixed z-[80] right-4 top-[68px] left-4 sm:left-auto sm:w-[380px] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl text-[13px]"
          style={{ background: 'var(--a-raised)', border: `1px solid ${t.kind === 'error' ? 'var(--a-danger-line)' : 'var(--a-line3)'}`, boxShadow: 'var(--a-shadow)' }}
        >
          <span className="mt-px shrink-0" style={{ color: t.kind === 'ok' ? 'var(--a-success)' : t.kind === 'warn' ? '#E3A857' : 'var(--a-danger)' }}>
            <Icon name={t.kind === 'ok' ? 'check' : 'alert'} size={16} />
          </span>
          <span className="flex-1 leading-relaxed">{t.text}</span>
          <button type="button" onClick={() => remove(t.id)} aria-label="Kapat" className="shrink-0" style={{ color: 'var(--a-faint)' }}><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  ), [list, remove]);
  return { node, show };
}

// ------------------------------------------------------------------ sayfalama ve seçim yardımcıları

export function usePaged<T>(list: T[], pageSize = 50, resetKey: unknown = null): { shown: T[]; more: boolean; loadMore: () => void } {
  const [n, setN] = useState(pageSize);
  useEffect(() => { setN(pageSize); }, [resetKey, pageSize]);
  return { shown: list.slice(0, n), more: list.length > n, loadMore: () => setN((v) => v + pageSize * 2) };
}

export function useSelection(validCodes: string[]): {
  selected: Set<string>; toggle: (code: string, on: boolean) => void; setAll: (codes: string[], on: boolean) => void; clear: () => void;
} {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Listeden düşen (örn. başka sayfaya taşınan) QR'lar seçimden de çıkar.
  const key = validCodes.join(',');
  useEffect(() => {
    setSelected((s) => {
      const valid = new Set(validCodes);
      const next = new Set([...s].filter((c) => valid.has(c)));
      return next.size === s.size ? s : next;
    });
  }, [key]);
  return {
    selected,
    toggle: (code, on) => setSelected((s) => { const n = new Set(s); if (on) n.add(code); else n.delete(code); return n; }),
    setAll: (codes, on) => setSelected((s) => { const n = new Set(s); codes.forEach((c) => (on ? n.add(c) : n.delete(c))); return n; }),
    clear: () => setSelected(new Set()),
  };
}

export function matchesSearch(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLocaleLowerCase('tr-TR').replace(/[\s-]/g, '');
  if (!needle) return true;
  return fields.some((f) => !!f && f.toLocaleLowerCase('tr-TR').replace(/[\s-]/g, '').includes(needle));
}

// ------------------------------------------------------------------ satır menüsü

export interface MenuItem { label: string; icon?: IconName; onClick: () => void; danger?: boolean; disabled?: boolean; hidden?: boolean }

export const RowMenu: React.FC<{ items: MenuItem[]; label: string; icon?: IconName; buttonLabel?: string }> = ({ items, label, icon = 'dots', buttonLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const visible = items.filter((i) => !i.hidden);
  if (!visible.length) return null;
  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center gap-2 rounded-md transition-colors hover:bg-[var(--a-hover)] ${buttonLabel ? 'h-[34px] px-3 text-[13px]' : 'w-8 h-8'}`}
        style={{ color: buttonLabel ? 'var(--a-text)' : 'var(--a-muted)', border: buttonLabel ? '1px solid var(--a-line2)' : undefined }}
      >
        <Icon name={icon} size={16} />{buttonLabel}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-40 min-w-[220px] py-1.5 rounded-xl text-left" style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line2)', boxShadow: 'var(--a-shadow)' }}>
          {visible.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              className="w-full flex items-center gap-2.5 px-3.5 h-9 text-[13px] text-left transition-colors hover:bg-[var(--a-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: it.danger ? 'var(--a-danger)' : 'var(--a-text)' }}
            >
              {it.icon && <span style={{ color: it.danger ? 'var(--a-danger)' : 'var(--a-muted)' }}><Icon name={it.icon} size={15} /></span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

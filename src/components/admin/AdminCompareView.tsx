// Yönetici paneli › Dönem karşılaştırma
// Seçilen tarih aralıkları aynı grafikte, her biri kendi ilk gününden başlayarak (1. gün, 2. gün…) üst üste çizilir.
// Dönemler kaydedilmez; yalnızca bu tarayıcı son seçimi hatırlar.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import { OverviewMetric, PeriodSeries, fetchPeriodSeries } from '../../lib/overviewService';
import { functionErrorMessage } from '../../lib/functionsClient';
import {
  DateField, METRICS, MetricTabs, SectionHead,
  addDays, daysBetween, fmtDay, fmtRange, nf, niceScale, readJson, todayKey, writeJson,
} from './overviewShared';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  onNavigate: (section: string) => void;
}

interface Period {
  id: string;
  label: string;
  start: string;
  end: string;
  visible: boolean;
  color: number;
}

const STORE_KEY = 'admin_compare_v1';
const MAX_PERIODS = 6;
const COLORS_DARK = ['#7AB0FF', '#E3A857', '#4FC1B0', '#E58FB5', '#A99BF0', '#9FBF6E'];
const COLORS_LIGHT = ['#1D4ED8', '#B45309', '#0F766E', '#BE185D', '#6D28D9', '#4D7C0F'];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthStart(key: string): string { return `${key.slice(0, 7)}-01`; }
function monthEnd(key: string): string { return addDays(`${addDays(monthStart(key), 32).slice(0, 7)}-01`, -1); }
function monthLabel(key: string, lang: AdminLang): string {
  const s = fmtDay(monthStart(key), lang, { month: 'long', year: 'numeric' });
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

function newId(): string { return Math.random().toString(36).slice(2, 10); }

function presets(lang: AdminLang): { key: string; label: string; make: () => Omit<Period, 'id' | 'visible' | 'color'> }[] {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const t = todayKey();
  const lastMonth = addDays(monthStart(t), -1);
  const lastYear = `${Number(t.slice(0, 4)) - 1}${t.slice(4, 7)}-01`;
  return [
    { key: 'this', label: L('Bu ay', 'This month'), make: () => ({ label: monthLabel(t, lang), start: monthStart(t), end: t }) },
    { key: 'last', label: L('Geçen ay', 'Last month'), make: () => ({ label: monthLabel(lastMonth, lang), start: monthStart(lastMonth), end: lastMonth }) },
    { key: 'ly', label: L('Geçen yıl bu ay', 'This month last year'), make: () => ({ label: monthLabel(lastYear, lang), start: lastYear, end: monthEnd(lastYear) }) },
    { key: '30', label: L('Son 30 gün', 'Last 30 days'), make: () => ({ label: L('Son 30 gün', 'Last 30 days'), start: addDays(t, -29), end: t }) },
    { key: '90', label: L('Son 90 gün', 'Last 90 days'), make: () => ({ label: L('Son 90 gün', 'Last 90 days'), start: addDays(t, -89), end: t }) },
  ];
}

function loadPeriods(lang: AdminLang): Period[] {
  const saved = readJson<Period[] | null>(STORE_KEY, null);
  if (Array.isArray(saved)) {
    const ok = saved.filter((p) => p && DAY_RE.test(p.start) && DAY_RE.test(p.end) && p.start <= p.end).slice(0, MAX_PERIODS);
    if (ok.length) return ok;
  }
  const [thisMonth, lastMonth] = presets(lang);
  return [
    { id: newId(), ...thisMonth.make(), visible: true, color: 0 },
    { id: newId(), ...lastMonth.make(), visible: true, color: 1 },
  ];
}

export const AdminCompareView: React.FC<Props> = ({ lang, isDark, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT;
  const UP = isDark ? '#5DBE8E' : '#1F7A4B';
  const DOWN = isDark ? '#E8776C' : '#B42318';

  const [periods, setPeriods] = useState<Period[]>(() => loadPeriods(lang));
  const [metric, setMetric] = useState<OverviewMetric>(() => readJson<OverviewMetric>('admin_compare_metric', 'scans'));
  const [series, setSeries] = useState<Record<string, PeriodSeries>>({});
  const [scansSince, setScansSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState(addDays(todayKey(), -29));
  const [to, setTo] = useState(todayKey());
  const reqId = useRef(0);

  useEffect(() => { writeJson(STORE_KEY, periods); }, [periods]);
  useEffect(() => { writeJson('admin_compare_metric', metric); }, [metric]);

  // Yalnızca tarih aralıkları değişince sunucuya gidilir (gizle/göster yeniden yüklemez).
  const rangesKey = periods.map((p) => `${p.start}|${p.end}`).sort().join(',');
  useEffect(() => {
    if (!periods.length) return;
    const unique = [...new Map(periods.map((p) => [`${p.start}|${p.end}`, { start: p.start, end: p.end }])).values()];
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetchPeriodSeries(unique)
      .then((res) => {
        if (id !== reqId.current) return;
        const map: Record<string, PeriodSeries> = {};
        // Sunucu bitişi bugüne kısaltabilir; istenen aralık anahtarıyla eşleştirilir.
        res.periods.forEach((p, i) => { map[`${unique[i].start}|${unique[i].end}`] = p; });
        setSeries(map);
        setScansSince(res.scansSince);
      })
      .catch((e) => {
        console.error('[compare]', e);
        if (id === reqId.current) setError(functionErrorMessage(e, L('Veriler alınamadı. Lütfen tekrar deneyin.', 'Could not load data. Please try again.')));
      })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [rangesKey]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const addPeriod = (p: Omit<Period, 'id' | 'visible' | 'color'>) => {
    if (periods.length >= MAX_PERIODS) {
      setNotice(L(`En fazla ${MAX_PERIODS} dönem eklenebilir. Önce birini kaldırın.`, `Up to ${MAX_PERIODS} periods. Remove one first.`));
      return;
    }
    if (periods.some((x) => x.start === p.start && x.end === p.end)) {
      setNotice(L('Bu dönem zaten listede.', 'This period is already in the list.'));
      return;
    }
    const used = new Set(periods.map((x) => x.color));
    const color = [0, 1, 2, 3, 4, 5].find((c) => !used.has(c)) ?? 0;
    setPeriods((list) => [...list, { ...p, id: newId(), visible: true, color }]);
  };

  const addCustom = () => {
    const t = todayKey();
    if (!from || !to || from > to) return;
    if (from > t) {
      setNotice(L('Başlangıç tarihi bugünden sonra olamaz.', 'Start cannot be in the future.'));
      return;
    }
    if (daysBetween(from, to) > 1100) {
      setNotice(L('Bir dönem en fazla 3 yıl olabilir.', 'A period can be at most 3 years.'));
      return;
    }
    addPeriod({ label: fmtRange(from, to > t ? t : to, lang, true), start: from, end: to > t ? t : to });
  };

  const visible = periods.filter((p) => p.visible && series[`${p.start}|${p.end}`]);
  const m = METRICS.find((x) => x.id === metric)!;

  // Liste özeti (toplam, günlük ortalama, ilk döneme göre)
  const rows = periods.map((p) => {
    const s = series[`${p.start}|${p.end}`];
    const arr = s ? s.series[metric] : null;
    const days = s ? daysBetween(s.start, s.end) + 1 : daysBetween(p.start, p.end) + 1;
    const total = arr ? arr.reduce((a, v) => a + v, 0) : null;
    return { p, s, days, total, avg: total === null ? null : total / days };
  });
  const ref = rows[0];

  const earliest = periods.reduce((a, p) => (p.start < a ? p.start : a), '9999-12-31');
  const showScansNote = metric === 'scans' && (!scansSince || scansSince > earliest);

  return (
    <div className="max-w-[1180px] mx-auto pb-16" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <button type="button" onClick={() => onNavigate('overview')} className="flex items-center gap-1 text-[12.5px] transition-colors hover:text-[var(--a-text)]" style={{ color: 'var(--a-muted)' }}>
        <Icon name="chevronLeft" size={15} />{L('Genel Bakış', 'Overview')}
      </button>
      <h1 className="m-0 mt-3 text-[24px] font-medium tracking-[-0.3px]">{L('Dönem karşılaştırma', 'Period comparison')}</h1>
      <p className="m-0 mt-2 text-[13px] max-w-[640px]" style={{ color: 'var(--a-faint)' }}>
        {L('İstediğiniz tarih aralıklarını aynı grafikte üst üste görün. Dönemler kendi ilk gününden başlayarak hizalanır.', 'See any date ranges on one chart. Each period is aligned from its own first day.')}
      </p>

      <div className="mt-10">
        <MetricTabs value={metric} onChange={setMetric} lang={lang} />
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 mt-6 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8" style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
        {visible.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-[13px] rounded-lg" style={{ border: '1px dashed var(--a-line2)', color: 'var(--a-faint)' }}>
            {loading ? L('Yükleniyor…', 'Loading…') : periods.length ? L('Grafikte göstermek için listeden en az bir dönem işaretleyin.', 'Tick at least one period below.') : L('Aşağıdan bir dönem ekleyin.', 'Add a period below.')}
          </div>
        ) : (
          <CompareChart
            lines={visible.map((p) => ({ id: p.id, color: COLORS[p.color % COLORS.length], start: series[`${p.start}|${p.end}`].start, values: series[`${p.start}|${p.end}`].series[metric] }))}
            lang={lang}
            unitLabel={L(m.unitTr, m.unitEn)}
          />
        )}
        {showScansNote && (
          <p className="m-0 mt-3 text-[12px]" style={{ color: 'var(--a-faint)' }}>
            {scansSince
              ? L(`Okutmalar ${fmtDay(scansSince, lang, { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri sayılıyor; öncesi 0 görünür.`, `Scans are counted since ${fmtDay(scansSince, lang, { day: 'numeric', month: 'long', year: 'numeric' })}; earlier days show 0.`)
              : L('Okutma sayımı ilk okutmayla başlayacak.', 'Scan counting starts with the first scan.')}
          </p>
        )}
      </div>

      <div className="mt-12 md:mt-16">
        <SectionHead
          title={L('Dönemler', 'Periods')}
          sub={L(`İşareti kaldırılan dönem grafikte gizlenir · en fazla ${MAX_PERIODS} dönem · fark, günlük ortalamaya göre hesaplanır`, `Unticked periods are hidden · up to ${MAX_PERIODS} · difference uses the daily average`)}
        />
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="text-[12px]" style={{ color: 'var(--a-faint)' }}>
                <th className="pb-2.5 w-9" />
                <th className="pb-2.5 w-6" />
                <th className="pb-2.5 text-left font-normal">{L('Dönem', 'Period')}</th>
                <th className="pb-2.5 text-right font-normal w-[100px]">{L('Toplam', 'Total')}</th>
                <th className="pb-2.5 text-right font-normal w-[110px]">{L('Günlük ort.', 'Daily avg.')}</th>
                <th className="pb-2.5 text-right font-normal w-[130px]">{L('İlk döneme göre', 'vs. first')}</th>
                <th className="pb-2.5 w-11" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, s, days, total, avg }, i) => {
                let diff: React.ReactNode = <span style={{ color: 'var(--a-faint)' }}>—</span>;
                if (i === 0) diff = <span style={{ color: 'var(--a-faint)' }}>{L('referans', 'reference')}</span>;
                else if (avg !== null && ref?.avg !== null && ref?.avg !== undefined) {
                  if (ref.avg === 0) diff = <span style={{ color: 'var(--a-faint)' }}>{avg === 0 ? L('aynı', 'same') : '—'}</span>;
                  else {
                    const pc = Math.round(((avg - ref.avg) / ref.avg) * 100);
                    diff = pc === 0
                      ? <span style={{ color: 'var(--a-faint)' }}>{L('aynı', 'same')}</span>
                      : <span className="font-medium" style={{ color: pc > 0 ? UP : DOWN }}>{pc > 0 ? '↑' : '↓'} %{N.format(Math.abs(pc))}</span>;
                  }
                }
                const color = COLORS[p.color % COLORS.length];
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--a-line)', opacity: p.visible ? 1 : 0.5 }}>
                    <td className="h-[60px]">
                      <input
                        type="checkbox"
                        checked={p.visible}
                        onChange={(e) => setPeriods((list) => list.map((x) => (x.id === p.id ? { ...x, visible: e.target.checked } : x)))}
                        aria-label={L(`${p.label} grafikte göster`, `Show ${p.label}`)}
                        className="w-4 h-4"
                        style={{ accentColor: color }}
                      />
                    </td>
                    <td><span className="block w-2.5 h-2.5 rounded-full" style={{ background: color }} /></td>
                    <td>
                      <div className="truncate max-w-[320px]">{p.label}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>
                        {fmtRange(s?.start || p.start, s?.end || p.end, lang, true)} · {N.format(days)} {L('gün', 'days')}
                      </div>
                    </td>
                    <td className="text-right">{total === null ? '…' : N.format(total)}</td>
                    <td className="text-right">{avg === null ? '…' : avg.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</td>
                    <td className="text-right">{diff}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => setPeriods((list) => list.filter((x) => x.id !== p.id))}
                        aria-label={L('Dönemi kaldır', 'Remove period')}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--a-hover)]"
                        style={{ color: 'var(--a-muted)' }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {periods.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Liste boş.', 'No periods.')}</p>}

        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--a-line)' }}>
          <div className="flex items-baseline justify-between gap-3 mb-3.5">
            <div className="text-[13.5px]">{L('Dönem ekle', 'Add a period')}</div>
            <span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{periods.length} / {MAX_PERIODS}</span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {presets(lang).map((pr) => (
              <button
                key={pr.key}
                type="button"
                disabled={periods.length >= MAX_PERIODS}
                onClick={() => addPeriod(pr.make())}
                className="h-9 px-3 rounded-lg text-[12.5px] transition-colors hover:bg-[var(--a-hover)] disabled:opacity-40"
                style={{ border: '1px solid var(--a-line2)', color: 'var(--a-text2)' }}
              >
                {pr.label}
              </button>
            ))}
            <span className="hidden md:block w-px h-6 mx-2 self-center" style={{ background: 'var(--a-line)' }} />
            <DateField label={L('Başlangıç', 'From')} value={from} max={to} onChange={setFrom} />
            <DateField label={L('Bitiş', 'To')} value={to} min={from} max={todayKey()} onChange={setTo} />
            <button
              type="button"
              disabled={periods.length >= MAX_PERIODS || !from || !to || from > to}
              onClick={addCustom}
              className="h-9 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-40"
              style={{ background: 'var(--a-primary)' }}
            >
              {L('Ekle', 'Add')}
            </button>
          </div>
          {notice && <p role="status" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{notice}</p>}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ grafik (gün sırasına göre hizalı)

interface Line { id: string; color: string; start: string; values: number[] }

const CompareChart: React.FC<{ lines: Line[]; lang: AdminLang; unitLabel: string }> = ({ lines, lang, unitLabel }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const N = nf(lang);
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Uzun dönemlerde gün yerine hafta (7 gün) ya da ay (30 gün) grupları kullanılır.
  const maxLen = Math.max(...lines.map((l) => l.values.length));
  const size = maxLen <= 92 ? 1 : maxLen <= 400 ? 7 : 30;
  const grouped = useMemo(() => lines.map((l) => {
    const out: number[] = [];
    for (let i = 0; i < l.values.length; i += size) out.push(l.values.slice(i, i + size).reduce((a, v) => a + v, 0));
    return { ...l, g: out };
  }), [lines, size]);
  const n = Math.max(...grouped.map((l) => l.g.length));

  useEffect(() => { setHover(null); }, [n, size]);

  const H = 290;
  const T = 16;
  const B = H - 30;
  const R = 34;
  const plotW = width - R;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? i * step : plotW / 2);
  const { top, step: yStep } = niceScale(Math.max(1, ...grouped.flatMap((l) => l.g)));
  const y = (v: number) => B - ((B - T) * v) / top;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += yStep) ticks.push(Math.round(v * 100) / 100);

  const unitName = (i: number) => (size === 1 ? L(`${i + 1}. gün`, `Day ${i + 1}`) : size === 7 ? L(`${i + 1}. hafta`, `Week ${i + 1}`) : L(`${i + 1}. ay`, `Month ${i + 1}`));
  const labelCount = Math.min(n, width < 520 ? 4 : 7);
  const labelIdx = labelCount <= 1 ? [0] : [...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / (labelCount - 1))))];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = n > 1 ? Math.round((e.clientX - rect.left) / step) : 0;
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // Dönem eklenip çıkarıldığında eski imleç konumu dizinin dışında kalabilir.
  const hv = hover !== null && hover < n ? hover : null;
  const tipW = 250;
  const hx = hv !== null ? x(hv) : 0;
  const tipLeft = hx + 14 + tipW > width ? hx - 14 - tipW : hx + 14;

  const dateOf = (l: Line, i: number) => {
    const a = addDays(l.start, i * size);
    if (size === 1) return fmtDay(a, lang, { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' });
    const last = Math.min(l.values.length - 1, i * size + size - 1);
    return fmtRange(a, addDays(l.start, last), lang, true);
  };

  return (
    <div ref={wrapRef} className="relative select-none">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={unitLabel}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="var(--a-line)" strokeOpacity={v === 0 ? 1 : 0.55} />
            <text x={width} y={y(v) + 4} fontSize="11" textAnchor="end" fill="var(--a-faint)">{N.format(v)}</text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={B + 20} fontSize="11" fill="var(--a-faint)" textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>
            {unitName(i)}
          </text>
        ))}
        {grouped.map((l, k) => (
          l.g.length === 1
            ? <circle key={l.id} cx={x(0)} cy={y(l.g[0])} r={3} fill={l.color} />
            : <polyline key={l.id} points={l.g.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={l.color} strokeWidth={k === 0 ? 1.8 : 1.4} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hv !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={T} y2={B} stroke="var(--a-line3)" />
            {grouped.map((l) => (hv < l.g.length
              ? <circle key={l.id} cx={hx} cy={y(l.g[hv])} r={3.5} fill="var(--a-bg)" stroke={l.color} strokeWidth={1.6} />
              : null))}
          </g>
        )}
      </svg>

      {hv !== null && (
        <div
          className="absolute top-1 pointer-events-none rounded-lg px-3 py-2.5 text-[12px]"
          style={{ left: Math.max(0, tipLeft), width: tipW, background: 'var(--a-raised)', border: '1px solid var(--a-line2)', boxShadow: 'var(--a-shadow)' }}
        >
          <div className="mb-2" style={{ color: 'var(--a-text)' }}>{unitName(hv)}</div>
          {grouped.map((l) => (
            <div key={l.id} className="flex items-center gap-2 mt-1.5 first:mt-0">
              <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: l.color }} />
              {hv < l.g.length ? (
                <>
                  <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--a-muted)' }}>{dateOf(l, hv)}</span>
                  <span>{N.format(l.g[hv])}</span>
                </>
              ) : (
                <span className="flex-1" style={{ color: 'var(--a-faint)' }}>{L('dönem bitti', 'period ended')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

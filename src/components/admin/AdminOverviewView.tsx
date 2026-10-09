// Yönetici paneli › Genel Bakış
// Veriler tek bir sunucu çağrısıyla (adminOverview) gelir; kampanya işaretleri Firestore'dan canlı dinlenir.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon, IconName, MONO } from './adminUi';
import {
  AttentionItem, Campaign, Kpi, OverviewData, OverviewMetric, OverviewRange, PROVINCES, RecentEvent,
  addCampaign, deleteCampaign, fetchOverview, listenCampaigns,
} from '../../lib/overviewService';
import { functionErrorMessage } from '../../lib/functionsClient';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  uid: string | null;
  onNavigate: (section: string) => void;
}

const PREF_KEY = 'admin_overview_prefs_v1';

function loadPrefs(): { range: OverviewRange; compare: boolean; metric: OverviewMetric } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return {
      range: ['7d', '30d', '90d', '12m', 'all'].includes(p.range) ? p.range : '30d',
      compare: p.compare !== false,
      metric: ['scans', 'notices', 'newUsers', 'claims', 'newVehicles'].includes(p.metric) ? p.metric : 'scans',
    };
  } catch {
    return { range: '30d', compare: true, metric: 'scans' };
  }
}

// ------------------------------------------------------------------ tarih yardımcıları

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function fmtDay(key: string, lang: AdminLang, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { timeZone: 'UTC', ...opts });
}

const nf = (lang: AdminLang) => new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB');

// ------------------------------------------------------------------ grafik kovaları

interface Bucket { start: string; end: string }

function bucketize(start: string, cur: number[], prev: number[] | null) {
  const n = cur.length;
  const bounds: [number, number][] = [];
  let unit: 'day' | 'week' | 'month' = 'day';
  if (n <= 92) {
    for (let i = 0; i < n; i++) bounds.push([i, i]);
  } else if (n <= 400) {
    unit = 'week';
    for (let i = 0; i < n; i += 7) bounds.push([i, Math.min(n - 1, i + 6)]);
  } else {
    unit = 'month';
    let from = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || addDays(start, i).slice(0, 7) !== addDays(start, i - 1).slice(0, 7)) {
        bounds.push([from, i - 1]);
        from = i;
      }
    }
  }
  const sum = (arr: number[], [a, b]: [number, number]) => arr.slice(a, b + 1).reduce((s, v) => s + v, 0);
  return {
    unit,
    buckets: bounds.map(([a, b]) => ({ start: addDays(start, a), end: addDays(start, b) })) as Bucket[],
    bounds,
    cur: bounds.map((r) => sum(cur, r)),
    prev: prev ? bounds.map((r) => sum(prev, r)) : null,
  };
}

function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 3;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) || 10 * pow;
  const s = step < 1 ? 1 : step;
  return { top: Math.ceil(max / s) * s, step: s };
}

// ------------------------------------------------------------------ ana bileşen

export const AdminOverviewView: React.FC<Props> = ({ lang, isDark, uid, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const prefs = useMemo(loadPrefs, []);
  const [range, setRange] = useState<OverviewRange>(prefs.range);
  const [compare, setCompare] = useState(prefs.compare);
  const [metric, setMetric] = useState<OverviewMetric>(prefs.metric);
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => ({ from: addDays(todayKey(), -29), to: todayKey() }));
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [allProvinces, setAllProvinces] = useState(false);
  const reqId = useRef(0);

  const UP = isDark ? '#5DBE8E' : '#1F7A4B';
  const DOWN = isDark ? '#E8776C' : '#B42318';

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ range: range === 'custom' ? '30d' : range, compare, metric })); } catch { /* yok say */ }
  }, [range, compare, metric]);

  const load = useCallback(async (fresh = false) => {
    if (range === 'custom' && !appliedCustom) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOverview(range, appliedCustom?.from, appliedCustom?.to, fresh);
      if (id === reqId.current) setData(res);
    } catch (e) {
      console.error('[overview]', e);
      if (id === reqId.current) setError(functionErrorMessage(e, L('Veriler alınamadı. Lütfen tekrar deneyin.', 'Could not load data. Please try again.')));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, appliedCustom]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => listenCampaigns(setCampaigns, (e) => console.warn('[campaigns]', e)), []);

  const periods: { id: OverviewRange; label: string }[] = [
    { id: '7d', label: L('7G', '7D') },
    { id: '30d', label: L('30G', '30D') },
    { id: '90d', label: L('90G', '90D') },
    { id: '12m', label: L('12A', '12M') },
    { id: 'all', label: L('Tümü', 'All') },
  ];

  const showPrev = compare && !!data?.range.prevStart;

  // ------------------------------------------------------------ alt başlık
  const subtitle = data
    ? `${fmtDay(data.range.start, lang, { day: 'numeric', month: 'long', year: data.range.start.slice(0, 4) !== data.range.end.slice(0, 4) ? 'numeric' : undefined })} – ${fmtDay(data.range.end, lang, { day: 'numeric', month: 'long', year: 'numeric' })}`
      + (showPrev && data.range.prevStart && data.range.prevEnd
        ? ` · ${L('önceki dönem', 'previous')} ${fmtDay(data.range.prevStart, lang, { day: 'numeric', month: 'short' })} – ${fmtDay(data.range.prevEnd, lang, { day: 'numeric', month: 'short' })}`
        : '')
    : L('Yükleniyor…', 'Loading…');

  return (
    <div className="max-w-[1180px] mx-auto" style={{ fontFeatureSettings: '"tnum" 1' }}>
      {/* ÜST */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6 md:mb-7">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-medium tracking-[-0.3px]">{L('Genel Bakış', 'Overview')}</h1>
          <p className="m-0 mt-1.5 text-[13px]" style={{ color: 'var(--a-faint)' }}>{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="radiogroup" aria-label={L('Dönem', 'Period')} className="flex flex-wrap gap-0.5">
            {periods.map((p) => (
              <PeriodBtn key={p.id} on={range === p.id} onClick={() => { setRange(p.id); setAppliedCustom(null); }}>{p.label}</PeriodBtn>
            ))}
            <PeriodBtn on={range === 'custom'} onClick={() => setRange('custom')}>
              <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} />{L('Özel', 'Custom')}</span>
            </PeriodBtn>
          </div>
          <span className="hidden sm:block w-px h-[18px]" style={{ background: 'var(--a-line)' }} />
          <label className="flex items-center gap-2 text-[12.5px] cursor-pointer select-none" style={{ color: 'var(--a-text2)' }}>
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="w-3.5 h-3.5" style={{ accentColor: 'var(--a-text)' }} />
            {L('Önceki dönemle karşılaştır', 'Compare to previous')}
          </label>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            title={data ? L(`Güncellendi: ${new Date(data.generatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`, 'Refresh') : undefined}
            aria-label={L('Yenile', 'Refresh')}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--a-hover)] disabled:opacity-50"
            style={{ color: 'var(--a-muted)' }}
          >
            <span className={loading ? 'animate-spin' : ''}><Icon name="refresh" size={15} /></span>
          </button>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mb-6 -mt-2">
          <DateField label={L('Başlangıç', 'From')} value={custom.from} max={custom.to} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
          <DateField label={L('Bitiş', 'To')} value={custom.to} min={custom.from} max={todayKey()} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
          <button
            type="button"
            disabled={!custom.from || !custom.to || custom.from > custom.to}
            onClick={() => setAppliedCustom({ ...custom })}
            className="h-9 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--a-primary)' }}
          >
            {L('Uygula', 'Apply')}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 mb-6 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
          <span>{error}</span>
          <button type="button" onClick={() => load(true)} className="underline underline-offset-4">{L('Tekrar dene', 'Retry')}</button>
        </div>
      )}

      {!data && !error && <SkeletonBlock />}

      {data && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
          {/* SAYILAR */}
          <KpiRow
            title={L('Etiketler', 'Tags')}
            lang={lang} up={UP} down={DOWN}
            items={[
              { label: L('Toplam üretilen', 'Total produced'), kpi: data.kpis.tagsTotal },
              { label: L('Aktif (araca bağlı)', 'Active (linked)'), kpi: data.kpis.tagsActive },
              { label: L('Boşta (satışa hazır)', 'Idle (in stock)'), kpi: data.kpis.tagsIdle },
              { label: L('Kapalı / süresi dolmuş', 'Closed / expired'), kpi: data.kpis.tagsClosed, inverse: true },
            ]}
          />
          <KpiRow
            title={L('Müşteriler', 'Customers')}
            lang={lang} up={UP} down={DOWN}
            items={[
              { label: L('Kayıtlı kullanıcı', 'Registered users'), kpi: data.kpis.users },
              { label: L('QR kullanan kullanıcı', 'Users with a QR'), kpi: data.kpis.usersWithTag },
              { label: L('Kayıtlı araç', 'Registered vehicles'), kpi: data.kpis.vehicles },
              { label: L('QR bağlı araç', 'Vehicles with a QR'), kpi: data.kpis.vehiclesWithTag },
            ]}
          />

          {/* TREND */}
          <TrendSection
            data={data}
            metric={metric}
            onMetric={setMetric}
            showPrev={showPrev}
            campaigns={campaigns}
            onCampaigns={() => setShowCampaigns(true)}
            lang={lang}
            up={UP}
            down={DOWN}
          />

          {/* HUNİ + İLLER */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-12 gap-y-8 pt-6 mt-6" style={{ borderTop: '1px solid var(--a-line)' }}>
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-5">
                <h2 className="m-0 text-sm font-medium">{L('Müşteri hunisi', 'Customer funnel')}</h2>
                <span className="text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
                  {data.range.key === 'all' ? L('Tüm kullanıcılar', 'All users') : L('Bu dönemde kayıt olanlar', 'Signed up in this period')}
                </span>
              </div>
              <Funnel data={data.funnel} lang={lang} />
            </section>
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <h2 className="m-0 text-sm font-medium">{L('İllere göre QR bağlı araç', 'QR-linked vehicles by province')}</h2>
                {data.provinces.length > 6 && (
                  <button type="button" onClick={() => setAllProvinces((v) => !v)} className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>
                    {allProvinces ? L('Daha az göster', 'Show less') : L(`${data.provinces.length} ilin tümü`, `All ${data.provinces.length}`)}
                  </button>
                )}
              </div>
              <Provinces list={allProvinces ? data.provinces : data.provinces.slice(0, 6)} total={data.kpis.vehiclesWithTag.value} lang={lang} />
            </section>
          </div>

          {/* DİKKAT + SON İŞLEMLER */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-12 gap-y-8 pt-6 mt-7" style={{ borderTop: '1px solid var(--a-line)' }}>
            <section>
              <div className="flex items-baseline gap-2 mb-2.5">
                <h2 className="m-0 text-sm font-medium">{L('Dikkat gerektirenler', 'Needs attention')}</h2>
                {data.attention.length > 0 && <span className="text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{data.attention.length}</span>}
              </div>
              <Attention items={data.attention} lang={lang} danger={DOWN} onNavigate={onNavigate} />
            </section>
            <section>
              <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <h2 className="m-0 text-sm font-medium">{L('Son işlemler', 'Recent activity')}</h2>
                <button type="button" onClick={() => onNavigate('audit')} className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>
                  {L('Tümünü gör', 'See all')}
                </button>
              </div>
              <Recent list={data.recent} lang={lang} />
            </section>
          </div>
        </div>
      )}

      {showCampaigns && (
        <CampaignDialog
          lang={lang}
          uid={uid}
          campaigns={campaigns}
          onClose={() => setShowCampaigns(false)}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ küçük parçalar

const PeriodBtn: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={on}
    onClick={onClick}
    className="h-8 px-2.5 rounded-md text-[12.5px] transition-colors hover:bg-[var(--a-hover)]"
    style={{ background: on ? 'var(--a-active)' : undefined, color: on ? 'var(--a-text)' : 'var(--a-muted)', fontWeight: on ? 500 : 400 }}
  >
    {children}
  </button>
);

const DateField: React.FC<{ label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }> = ({ label, value, min, max, onChange }) => (
  <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--a-faint)' }}>
    {label}
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2.5 rounded-lg text-[13px] outline-none"
      style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)', colorScheme: 'inherit' }}
    />
  </label>
);

const SkeletonBlock: React.FC = () => (
  <div className="flex flex-col gap-4 animate-pulse" aria-hidden="true">
    {[0, 1].map((r) => (
      <div key={r} className="grid grid-cols-2 md:grid-cols-4 gap-6 py-5" style={{ borderTop: '1px solid var(--a-line)' }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="h-3 w-24 rounded" style={{ background: 'var(--a-active)' }} />
            <div className="h-6 w-16 rounded" style={{ background: 'var(--a-active)' }} />
          </div>
        ))}
      </div>
    ))}
    <div className="h-[300px] rounded" style={{ background: 'var(--a-hover)' }} />
  </div>
);

// ------------------------------------------------------------------ sayı satırları

function Delta({ kpi, lang, up, down, inverse }: { kpi: Kpi; lang: AdminLang; up: string; down: string; inverse?: boolean }) {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  if (kpi.prev === null) return <span style={{ color: 'var(--a-faint)' }}>{L('karşılaştırma yok', 'no comparison')}</span>;
  const diff = kpi.value - kpi.prev;
  if (diff === 0) return <span style={{ color: 'var(--a-faint)' }}>{L('değişim yok', 'no change')} · {L('önceki', 'prev')}: {N.format(kpi.prev)}</span>;
  const good = inverse ? diff < 0 : diff > 0;
  const amount = kpi.prev > 0 ? `%${N.format(Math.round((Math.abs(diff) / kpi.prev) * 100))}` : N.format(Math.abs(diff));
  return (
    <span>
      <span className="font-medium" style={{ color: good ? up : down }}>{diff > 0 ? '↑' : '↓'} {amount}</span>
      <span style={{ color: 'var(--a-faint)' }}>&nbsp; {L('önceki', 'prev')}: {N.format(kpi.prev)}</span>
    </span>
  );
}

const KpiRow: React.FC<{
  title: string;
  items: { label: string; kpi: Kpi; inverse?: boolean }[];
  lang: AdminLang; up: string; down: string;
}> = ({ title, items, lang, up, down }) => (
  <div className="grid grid-cols-2 md:grid-cols-[110px_repeat(4,minmax(0,1fr))] gap-y-5 py-5" style={{ borderTop: '1px solid var(--a-line)' }}>
    <div className="col-span-2 md:col-span-1 text-[12.5px] pt-px" style={{ color: 'var(--a-faint)' }}>{title}</div>
    {items.map((it, i) => (
      <div
        key={it.label}
        className={`min-w-0 ${i % 2 === 1 ? 'pl-4 border-l' : 'pr-4 border-l-0'} md:px-5 ${i >= 1 ? 'md:border-l' : 'md:border-l-0'}`}
        style={{ borderColor: 'var(--a-line)' }}
      >
        <div className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{it.label}</div>
        <div className="text-[24px] md:text-[26px] font-medium tracking-[-0.4px] leading-none mt-2">{nf(lang).format(it.kpi.value)}</div>
        <div className="text-[12px] mt-2 leading-snug"><Delta kpi={it.kpi} lang={lang} up={up} down={down} inverse={it.inverse} /></div>
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------------ trend

const METRICS: { id: OverviewMetric; tr: string; en: string; unitTr: string; unitEn: string }[] = [
  { id: 'scans', tr: 'QR okutma', en: 'QR scans', unitTr: 'okutma', unitEn: 'scans' },
  { id: 'notices', tr: 'Bildirim', en: 'Notices', unitTr: 'bildirim', unitEn: 'notices' },
  { id: 'newUsers', tr: 'Yeni kullanıcı', en: 'New users', unitTr: 'yeni kullanıcı', unitEn: 'new users' },
  { id: 'claims', tr: 'QR bağlama', en: 'QR links', unitTr: 'bağlama', unitEn: 'links' },
  { id: 'newVehicles', tr: 'Yeni araç', en: 'New vehicles', unitTr: 'yeni araç', unitEn: 'new vehicles' },
];

const TrendSection: React.FC<{
  data: OverviewData;
  metric: OverviewMetric;
  onMetric: (m: OverviewMetric) => void;
  showPrev: boolean;
  campaigns: Campaign[];
  onCampaigns: () => void;
  lang: AdminLang; up: string; down: string;
}> = ({ data, metric, onMetric, showPrev, campaigns, onCampaigns, lang, up, down }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  const m = METRICS.find((x) => x.id === metric)!;
  const s = data.series[metric];
  const prev = showPrev ? s.prev : null;
  const b = useMemo(() => bucketize(data.range.start, s.cur, prev), [data, metric, showPrev]);
  const total = s.cur.reduce((a, v) => a + v, 0);
  const prevTotal = prev ? prev.reduce((a, v) => a + v, 0) : null;

  const bands = useMemo(() => campaigns
    .filter((c) => c.end >= data.range.start && c.start <= data.range.end)
    .map((c) => {
      const from = b.buckets.findIndex((x) => x.end >= c.start);
      let to = b.buckets.length - 1;
      for (let i = b.buckets.length - 1; i >= 0; i--) { if (b.buckets[i].start <= c.end) { to = i; break; } }
      return { from: Math.max(0, from), to, title: c.title };
    }), [campaigns, b, data]);

  let note: string | null = null;
  if (metric === 'scans') {
    if (!data.scansSince) note = L('Okutma sayımı ilk okutmayla başlayacak.', 'Scan counting starts with the first scan.');
    else if (data.scansSince > (data.range.prevStart && showPrev ? data.range.prevStart : data.range.start)) {
      note = L(
        `Okutmalar ${fmtDay(data.scansSince, lang, { day: 'numeric', month: 'long' })} tarihinden beri sayılıyor; öncesi grafikte 0 görünür.`,
        `Scans are counted since ${fmtDay(data.scansSince, lang, { day: 'numeric', month: 'long' })}; earlier days show 0.`,
      );
    }
  }

  return (
    <section className="pt-6" style={{ borderTop: '1px solid var(--a-line)' }}>
      <div role="tablist" className="flex gap-5 md:gap-6 overflow-x-auto mb-6" style={{ borderBottom: '1px solid var(--a-line)' }}>
        {METRICS.map((x) => {
          const on = x.id === metric;
          return (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onMetric(x.id)}
              className="pb-3 -mb-px text-[13px] whitespace-nowrap transition-colors"
              style={{ color: on ? 'var(--a-text)' : 'var(--a-faint)', borderBottom: `1.5px solid ${on ? 'var(--a-text)' : 'transparent'}` }}
            >
              {L(x.tr, x.en)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[40px] font-medium tracking-[-1px] leading-none">{N.format(total)}</span>
            <span style={{ color: 'var(--a-muted)' }}>{L(m.unitTr, m.unitEn)}</span>
          </div>
          {prevTotal !== null && (
            <div className="mt-2 text-[13px]">
              {total === prevTotal ? (
                <span style={{ color: 'var(--a-faint)' }}>{L('önceki dönemle aynı', 'same as previous')}</span>
              ) : (
                <>
                  <span className="font-medium" style={{ color: total > prevTotal ? up : down }}>
                    {total > prevTotal ? '↑' : '↓'} {prevTotal > 0 ? `%${N.format(Math.round((Math.abs(total - prevTotal) / prevTotal) * 100))}` : N.format(Math.abs(total - prevTotal))}
                  </span>
                  <span style={{ color: 'var(--a-faint)' }}>&nbsp; {L(`önceki dönemde ${N.format(prevTotal)}`, `previous period ${N.format(prevTotal)}`)}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
          <span className="flex items-center gap-2"><span className="w-3.5 h-[2px]" style={{ background: 'var(--a-accent)' }} />{L('Bu dönem', 'This period')}</span>
          {prev && <span className="flex items-center gap-2"><span className="w-3.5" style={{ borderTop: '1.5px dashed var(--a-faint)' }} />{L('Önceki dönem', 'Previous period')}</span>}
          <button type="button" onClick={onCampaigns} className="whitespace-nowrap" style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>
            {L('Kampanya işaretle', 'Mark a campaign')}
          </button>
        </div>
      </div>

      <TrendChart
        buckets={b.buckets}
        unit={b.unit}
        cur={b.cur}
        prev={b.prev}
        bands={bands}
        lang={lang}
        unitLabel={L(m.unitTr, m.unitEn)}
        today={todayKey()}
      />
      {note && <p className="m-0 mt-3 text-[12px]" style={{ color: 'var(--a-faint)' }}>{note}</p>}
    </section>
  );
};

const TrendChart: React.FC<{
  buckets: Bucket[];
  unit: 'day' | 'week' | 'month';
  cur: number[];
  prev: number[] | null;
  bands: { from: number; to: number; title: string }[];
  lang: AdminLang;
  unitLabel: string;
  today: string;
}> = ({ buckets, unit, cur, prev, bands, lang, unitLabel, today }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);
  const gid = useId().replace(/:/g, '');
  const N = nf(lang);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 250;
  const T = 30;
  const B = H - 30;
  const R = 34;
  const plotW = width - R;
  const n = cur.length;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? i * step : plotW / 2);
  const { top, step: yStep } = niceScale(Math.max(1, ...cur, ...(prev || [])));
  const y = (v: number) => B - ((B - T) * v) / top;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += yStep) ticks.push(Math.round(v * 100) / 100);

  const line = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `M${x(0).toFixed(1)},${B} L${cur.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L')} L${x(n - 1).toFixed(1)},${B} Z`;

  const labelCount = Math.min(n, width < 520 ? 4 : 6);
  const labelIdx = labelCount <= 1 ? [0] : [...new Set(Array.from({ length: labelCount }, (_, k) => Math.round((k * (n - 1)) / (labelCount - 1))))];

  const shortLabel = (bk: Bucket, i: number) => {
    if (unit === 'month') return fmtDay(bk.start, lang, { month: 'short', year: '2-digit' });
    if (unit === 'day' && i === n - 1 && bk.end === today) return lang === 'tr' ? 'Bugün' : 'Today';
    return fmtDay(bk.start, lang, { day: 'numeric', month: 'short' });
  };
  const longLabel = (bk: Bucket) => {
    if (unit === 'day') return fmtDay(bk.start, lang, { weekday: 'short', day: 'numeric', month: 'long' });
    if (unit === 'month') return fmtDay(bk.start, lang, { month: 'long', year: 'numeric' });
    return `${fmtDay(bk.start, lang, { day: 'numeric', month: 'short' })} – ${fmtDay(bk.end, lang, { day: 'numeric', month: 'short' })}`;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n > 1 ? Math.round(px / step) : 0;
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const tipW = 176;
  const hx = hover !== null ? x(hover) : 0;
  const tipLeft = hx + 14 + tipW > width ? hx - 14 - tipW : hx + 14;

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
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--a-accent)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--a-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {bands.map((bd, k) => {
          const half = n > 1 ? step / 2 : 8;
          const x1 = Math.max(0, x(bd.from) - (bd.from === bd.to ? half : 0));
          const x2 = Math.min(plotW, x(bd.to) + (bd.from === bd.to ? half : 0));
          return (
            <g key={k}>
              <rect x={x1} y={T} width={Math.max(2, x2 - x1)} height={B - T} fill="var(--a-text)" opacity={0.035} />
              <path d={`M${x1},${T - 4} V${T - 9} H${x2} V${T - 4}`} fill="none" stroke="var(--a-line3)" />
              <text x={x1 + 6} y={T - 14} fontSize="11" fill="var(--a-muted)">{bd.title}</text>
            </g>
          );
        })}

        {ticks.map((v) => (
          <g key={v}>
            <line x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke="var(--a-line)" strokeOpacity={v === 0 ? 1 : 0.55} />
            <text x={width} y={y(v) + 4} fontSize="11" textAnchor="end" fill="var(--a-faint)">{N.format(v)}</text>
          </g>
        ))}

        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={B + 20} fontSize="11" fill={i === n - 1 ? 'var(--a-muted)' : 'var(--a-faint)'} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>
            {shortLabel(buckets[i], i)}
          </text>
        ))}

        <path d={area} fill={`url(#g${gid})`} />
        {prev && <polyline points={line(prev)} fill="none" stroke="var(--a-faint)" strokeWidth={1.25} strokeDasharray="3 3" />}
        <polyline points={line(cur)} fill="none" stroke="var(--a-accent)" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={T} y2={B} stroke="var(--a-line3)" />
            {prev && <circle cx={hx} cy={y(prev[hover])} r={3} fill="var(--a-bg)" stroke="var(--a-faint)" strokeWidth={1.25} />}
            <circle cx={hx} cy={y(cur[hover])} r={3.5} fill="var(--a-bg)" stroke="var(--a-accent)" strokeWidth={1.6} />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="absolute top-1 pointer-events-none rounded-lg px-3 py-2.5 text-[12px]"
          style={{ left: Math.max(0, tipLeft), width: tipW, background: 'var(--a-raised)', border: '1px solid var(--a-line2)', boxShadow: 'var(--a-shadow)' }}
        >
          <div className="mb-2" style={{ color: 'var(--a-muted)' }}>{longLabel(buckets[hover])}</div>
          <div className="flex justify-between gap-3">
            <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a-accent)' }} />{lang === 'tr' ? 'Bu dönem' : 'This period'}</span>
            <span>{N.format(cur[hover])}</span>
          </div>
          {prev && (
            <div className="flex justify-between gap-3 mt-1" style={{ color: 'var(--a-muted)' }}>
              <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a-faint)' }} />{lang === 'tr' ? 'Önceki' : 'Previous'}</span>
              <span>{N.format(prev[hover])}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ huni

const Funnel: React.FC<{ data: OverviewData['funnel']; lang: AdminLang }> = ({ data, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  if (data.registered === 0) {
    return <p className="m-0 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu dönemde yeni kayıt yok.', 'No sign-ups in this period.')}</p>;
  }
  const steps = [
    { label: L('Kayıt olan', 'Signed up'), v: data.registered },
    { label: L('Araç ekleyen', 'Added a vehicle'), v: data.withVehicle },
    { label: L('QR bağlayan', 'Linked a QR'), v: data.withTag },
    { label: L('Bildirim açık', 'Push enabled'), v: data.withPush },
  ];
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  return (
    <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-y-5">
      {steps.map((st, i) => (
        <React.Fragment key={st.label}>
          {i > 0 && (
            <div className="hidden sm:flex flex-col items-center justify-center gap-1 w-14 shrink-0 text-[12px]" style={{ color: 'var(--a-muted)' }}>
              <span>%{pct(st.v, steps[i - 1].v)}</span>
              <span style={{ color: 'var(--a-line3)' }}><Icon name="chevronRight" size={14} /></span>
            </div>
          )}
          <div className={`flex-1 min-w-0 ${i % 2 === 1 ? 'pl-4 sm:pl-0' : 'pr-4 sm:pr-0'}`}>
            <div className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{st.label}</div>
            <div className="text-[24px] font-medium tracking-[-0.4px] leading-none mt-2">{N.format(st.v)}</div>
            <div className="h-[3px] rounded-sm mt-3.5" style={{ background: 'var(--a-line)' }}>
              <div className="h-full rounded-sm" style={{ width: `${pct(st.v, data.registered)}%`, background: 'var(--a-accent)' }} />
            </div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--a-faint)' }}>
              %{pct(st.v, data.registered)}
              {i > 0 && <span className="sm:hidden"> · {L('önceki adımın', 'of prev. step')} %{pct(st.v, steps[i - 1].v)}</span>}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ iller

const Provinces: React.FC<{ list: { code: string; count: number }[]; total: number; lang: AdminLang }> = ({ list, total, lang }) => {
  const N = nf(lang);
  if (!list.length) {
    return <p className="m-0 pt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{lang === 'tr' ? 'Henüz QR bağlı araç yok.' : 'No QR-linked vehicles yet.'}</p>;
  }
  const max = list[0].count || 1;
  return (
    <div>
      {list.map((p) => (
        <div key={p.code} className="grid grid-cols-[26px_minmax(0,110px)_1fr_36px_40px] items-center gap-3 h-9 text-[13px]" style={{ borderTop: '1px solid var(--a-line)' }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--a-faint)' }}>{p.code === '??' ? '—' : p.code}</span>
          <span className="truncate">{PROVINCES[p.code] || (lang === 'tr' ? 'Bilinmiyor' : 'Unknown')}</span>
          <div className="h-[3px] rounded-sm" style={{ background: 'var(--a-line)' }}>
            <div className="h-full rounded-sm" style={{ width: `${(p.count / max) * 100}%`, background: 'var(--a-muted)' }} />
          </div>
          <span className="text-right">{N.format(p.count)}</span>
          <span className="text-right" style={{ color: 'var(--a-faint)' }}>%{total ? Math.round((p.count / total) * 100) : 0}</span>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ dikkat gerektirenler

const Attention: React.FC<{ items: AttentionItem[]; lang: AdminLang; danger: string; onNavigate: (s: string) => void }> = ({ items, lang, danger, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  if (!items.length) {
    return (
      <div className="flex items-center gap-3 py-3.5 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-muted)' }}>
        <Icon name="check" size={16} />{L('Şu an dikkat gerektiren bir şey yok.', 'Nothing needs attention right now.')}
      </div>
    );
  }
  const row = (key: string, icon: IconName, color: string, title: string, sub: string, action: string, section: string) => (
    <div key={key} className="flex items-start gap-3.5 py-3.5" style={{ borderTop: '1px solid var(--a-line)' }}>
      <span className="mt-0.5" style={{ color }}><Icon name={icon} size={16} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px]">{title}</div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{sub}</div>
      </div>
      <button type="button" onClick={() => onNavigate(section)} className="text-[12.5px] whitespace-nowrap" style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>{action}</button>
    </div>
  );
  return (
    <div>
      {items.map((it, i) => {
        switch (it.kind) {
          case 'stock': {
            const left = it.daysLeft === null ? null : it.daysLeft < 14 ? L(`yaklaşık ${it.daysLeft} gün`, `about ${it.daysLeft} days`) : L(`yaklaşık ${Math.round(it.daysLeft / 7)} hafta`, `about ${Math.round(it.daysLeft / 7)} weeks`);
            return row(`s${i}`, 'layers', 'var(--a-muted)', L('Stok azalıyor', 'Stock running low'),
              left ? L(`Boşta ${N.format(it.idle)} etiket · mevcut hızla ${left} yeter`, `${N.format(it.idle)} idle tags · ${left} at the current pace`)
                : L(`Boşta yalnızca ${N.format(it.idle)} etiket kaldı`, `Only ${N.format(it.idle)} idle tags left`),
              L('Parti oluştur', 'New batch'), 'batches');
          }
          case 'pending_batch':
            return row(`b${i}`, 'clock', 'var(--a-muted)', L('Bekleyen parti', 'Pending batch'),
              L(`${it.batchId} · ${it.waitingDays} gündür baskıya gönderilmedi`, `${it.batchId} · not sent to print for ${it.waitingDays} days`),
              L('Aç', 'Open'), 'batches');
          case 'lost':
            return row(`l${i}`, 'alert', danger, L(`${N.format(it.count)} kayıp bildirimi`, `${N.format(it.count)} lost reports`),
              L('Son 30 günde müşteriler etiketini kayıp bildirdi; etiketler otomatik kapatıldı', 'Reported lost in the last 30 days; tags were closed automatically'),
              L('İncele', 'Review'), 'qr_bank');
          case 'scan_spike':
            return row(`a${i}`, 'alert', danger, L('Şüpheli okutma', 'Suspicious scans'),
              L(`${it.serial || it.code} · son 1 saatte ${N.format(it.count)}+ okutma`, `${it.serial || it.code} · ${N.format(it.count)}+ scans in an hour`),
              L('Etiketi aç', 'Open tag'), 'qr_bank');
          default:
            return null;
        }
      })}
    </div>
  );
};

// ------------------------------------------------------------------ son işlemler

const ACTION_TEXT: Record<string, { tr: string; en: string }> = {
  claimed: { tr: 'etiket bağladı', en: 'linked a tag' },
  moved: { tr: 'etiketi başka araca taşıdı', en: 'moved a tag' },
  unlinked: { tr: 'etiketi araçtan ayırdı', en: 'unlinked a tag' },
  reported_lost: { tr: 'kayıp bildirdi', en: 'reported a tag lost' },
  batch_created: { tr: 'parti oluşturdu', en: 'created a batch' },
  admin_disable: { tr: 'etiketi kapattı', en: 'disabled a tag' },
  admin_enable: { tr: 'etiketi yeniden açtı', en: 'enabled a tag' },
  admin_expire: { tr: 'etiketin süresini bitirdi', en: 'expired a tag' },
  admin_reset: { tr: 'eşleşmeyi sıfırladı', en: 'reset a tag' },
  notice_sent: { tr: 'bildirim gönderdi', en: 'sent a notice' },
  scan_alert: { tr: 'şüpheli okutma işaretledi', en: 'flagged suspicious scans' },
};

const Recent: React.FC<{ list: RecentEvent[]; lang: AdminLang }> = ({ list, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (!list.length) {
    return <p className="m-0 py-3.5 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)' }}>{L('Henüz işlem yok.', 'No activity yet.')}</p>;
  }
  const when = (ms: number | null) => {
    if (!ms) return '—';
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (new Date(now.getTime() - 86400000).toDateString() === d.toDateString()) return L('Dün', 'Yest.');
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short' });
  };
  const who = (e: RecentEvent) => (
    e.actor === 'staff' ? e.actorName
      : e.actor === 'visitor' ? L('Bir ziyaretçi', 'A visitor')
        : e.actor === 'system' ? L('Sistem', 'System')
          : L('Bir müşteri', 'A customer')
  );
  return (
    <div>
      {list.map((e, i) => (
        <div key={i} className="flex gap-3.5 py-3" style={{ borderTop: '1px solid var(--a-line)' }}>
          <span className="w-11 shrink-0 text-[12.5px] pt-px" style={{ color: 'var(--a-faint)' }}>{when(e.at)}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px]"><span className="font-medium">{who(e)}</span> {ACTION_TEXT[e.action] ? L(ACTION_TEXT[e.action].tr, ACTION_TEXT[e.action].en) : e.action}</div>
            {e.target && <div className="truncate mt-0.5" style={{ fontFamily: MONO, fontSize: 12, color: 'var(--a-faint)' }}>{e.target}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ kampanya penceresi

const CampaignDialog: React.FC<{ lang: AdminLang; uid: string | null; campaigns: Campaign[]; onClose: () => void }> = ({ lang, uid, campaigns, onClose }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const t = todayKey();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(addDays(t, -6));
  const [end, setEnd] = useState(t);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = title.trim().length > 0 && !!start && !!end && start <= end && !!uid;

  const save = async () => {
    if (!valid || !uid) return;
    setBusy(true);
    setErr(null);
    try {
      await addCampaign(uid, { title, start, end });
      setTitle('');
    } catch (e) {
      console.error('[campaigns]', e);
      setErr(L('Kaydedilemedi. Lütfen tekrar deneyin.', 'Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteCampaign(id);
    } catch (e) {
      console.error('[campaigns]', e);
      setErr(L('Silinemedi. Lütfen tekrar deneyin.', 'Could not delete. Please try again.'));
    }
    setConfirmId(null);
  };

  const fmt = (k: string) => fmtDay(k, lang, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'var(--a-overlay)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="camp-title" className="w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto rounded-t-[14px] sm:rounded-[14px] p-5 sm:p-6" style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}>
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3 id="camp-title" className="m-0 text-base font-medium">{L('Kampanya işaretleri', 'Campaign markers')}</h3>
          <button type="button" onClick={onClose} aria-label={L('Kapat', 'Close')} className="w-8 h-8 -mr-1.5 -mt-1 rounded-md flex items-center justify-center hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-muted)' }}><Icon name="x" size={16} /></button>
        </div>
        <p className="m-0 mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>
          {L('İşaretlenen tarih aralığı grafikte hafif bir şeritle gösterilir; kampanyanın etkisini görmeyi kolaylaştırır.', 'The date range is shaded on the chart so you can see the campaign\'s effect.')}
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px]" style={{ color: 'var(--a-faint)' }}>
            {L('Ad', 'Name')}
            <input
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={L('örn. Fuar standı', 'e.g. Trade fair')}
              className="h-9 px-3 rounded-lg text-[13.5px] outline-none"
              style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <DateField label={L('Başlangıç', 'Start')} value={start} max={end} onChange={setStart} />
            <DateField label={L('Bitiş', 'End')} value={end} min={start} onChange={setEnd} />
          </div>
          {err && <p role="alert" className="m-0 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
          <div className="flex justify-end">
            <button type="button" disabled={!valid || busy} onClick={save} className="h-9 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ background: 'var(--a-primary)' }}>
              {busy ? L('Kaydediliyor…', 'Saving…') : L('İşaretle', 'Add marker')}
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-[12px] mb-1" style={{ color: 'var(--a-faint)' }}>{L('Kayıtlı işaretler', 'Saved markers')}</div>
          {campaigns.length === 0 && <p className="m-0 py-3 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)' }}>{L('Henüz işaret yok.', 'No markers yet.')}</p>}
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: '1px solid var(--a-line)' }}>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] truncate">{c.title}</div>
                <div className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{fmt(c.start)} – {fmt(c.end)}</div>
              </div>
              {confirmId === c.id ? (
                <span className="flex items-center gap-2 text-[12.5px]">
                  <button type="button" onClick={() => setConfirmId(null)} style={{ color: 'var(--a-muted)' }}>{L('Vazgeç', 'Cancel')}</button>
                  <button type="button" onClick={() => remove(c.id)} className="font-medium" style={{ color: 'var(--a-danger)' }}>{L('Sil', 'Delete')}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmId(c.id)} aria-label={L('Sil', 'Delete')} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-muted)' }}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

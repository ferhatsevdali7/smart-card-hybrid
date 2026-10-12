// Yönetici paneli › Genel Bakış
// Veriler tek bir sunucu çağrısıyla (adminOverview) gelir; kampanya işaretleri Firestore'dan canlı dinlenir.

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon, IconName, MONO } from './adminUi';
import {
  AttentionItem, Campaign, CompareMode, Kpi, OverviewData, OverviewMetric, OverviewRange, PROVINCES, RecentEvent,
  addCampaign, deleteCampaign, fetchOverview, listenCampaigns,
} from '../../lib/overviewService';
import { functionErrorMessage } from '../../lib/functionsClient';
import {
  DateField, LinkBtn, METRICS, MetricTabs, SectionHead, Toggle,
  addDays, daysBetween, fmtDay, fmtRange, nf, niceScale, readJson, todayKey, writeJson,
} from './overviewShared';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  uid: string | null;
  onNavigate: (section: string) => void;
}

const PREF_KEY = 'admin_overview_prefs_v2';

interface Prefs { range: OverviewRange; compare: boolean; compareMode: CompareMode; metric: OverviewMetric; showCampaigns: boolean }

function loadPrefs(): Prefs {
  const p = readJson<Partial<Prefs>>(PREF_KEY, {});
  return {
    range: p.range && ['7d', '30d', '90d', '12m', 'all'].includes(p.range) ? p.range : '30d',
    compare: p.compare !== false,
    compareMode: p.compareMode === 'yoy' ? 'yoy' : 'prev',
    metric: p.metric && METRICS.some((m) => m.id === p.metric) ? p.metric : 'scans',
    showCampaigns: p.showCampaigns !== false,
  };
}

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
    cur: bounds.map((r) => sum(cur, r)),
    prev: prev ? bounds.map((r) => sum(prev, r)) : null,
  };
}

// ------------------------------------------------------------------ ana bileşen

export const AdminOverviewView: React.FC<Props> = ({ lang, isDark, uid, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const prefs = useMemo(loadPrefs, []);
  const [range, setRange] = useState<OverviewRange>(prefs.range);
  const [compare, setCompare] = useState(prefs.compare);
  const [compareMode, setCompareMode] = useState<CompareMode>(prefs.compareMode);
  const [metric, setMetric] = useState<OverviewMetric>(prefs.metric);
  const [showCampaignBands, setShowCampaignBands] = useState(prefs.showCampaigns);
  const [custom, setCustom] = useState<{ from: string; to: string }>(() => ({ from: addDays(todayKey(), -29), to: todayKey() }));
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const reqId = useRef(0);

  const UP = isDark ? '#5DBE8E' : '#1F7A4B';
  const DOWN = isDark ? '#E8776C' : '#B42318';

  useEffect(() => {
    writeJson(PREF_KEY, { range: range === 'custom' ? '30d' : range, compare, compareMode, metric, showCampaigns: showCampaignBands });
  }, [range, compare, compareMode, metric, showCampaignBands]);

  const load = useCallback(async (fresh = false) => {
    if (range === 'custom' && !appliedCustom) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOverview(range, compareMode, appliedCustom?.from, appliedCustom?.to, fresh);
      if (id === reqId.current) setData(res);
    } catch (e) {
      console.error('[overview]', e);
      if (id === reqId.current) setError(functionErrorMessage(e, L('Veriler alınamadı. Lütfen tekrar deneyin.', 'Could not load data. Please try again.')));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, appliedCustom, compareMode]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => listenCampaigns(setCampaigns, (e) => console.warn('[campaigns]', e)), []);

  /** Kampanyanın tarihlerine git: öncesine ve sonrasına sürenin yarısı kadar (en az 3) gün eklenir. */
  const goToCampaign = (c: Campaign) => {
    const len = daysBetween(c.start, c.end) + 1;
    const pad = Math.max(3, Math.ceil(len / 2));
    const today = todayKey();
    const from = addDays(c.start, -pad);
    let to = addDays(c.end, pad);
    if (to > today) to = today;
    const next = { from: from > to ? to : from, to };
    setCustom(next);
    setAppliedCustom(next);
    setRange('custom');
    setShowCampaignBands(true);
    setShowCampaigns(false);
  };

  const periods: { id: OverviewRange; label: string }[] = [
    { id: '7d', label: L('7G', '7D') },
    { id: '30d', label: L('30G', '30D') },
    { id: '90d', label: L('90G', '90D') },
    { id: '12m', label: L('12A', '12M') },
    { id: 'all', label: L('Tümü', 'All') },
  ];

  const showPrev = compare && !!data?.range.prevStart;

  const subtitle = data
    ? `${fmtDay(data.range.start, lang, { day: 'numeric', month: 'long', year: data.range.start.slice(0, 4) !== data.range.end.slice(0, 4) ? 'numeric' : undefined })} – ${fmtDay(data.range.end, lang, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : L('Yükleniyor…', 'Loading…');

  return (
    <div className="max-w-[1180px] mx-auto pb-16" style={{ fontFeatureSettings: '"tnum" 1' }}>
      {/* ÜST */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px]">{L('Genel Bakış', 'Overview')}</h1>
          <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="radiogroup" aria-label={L('Dönem', 'Period')} className="flex flex-wrap gap-0.5">
            {periods.map((p) => (
              <PeriodBtn key={p.id} on={range === p.id} onClick={() => { setRange(p.id); setAppliedCustom(null); }}>{p.label}</PeriodBtn>
            ))}
            <PeriodBtn on={range === 'custom'} onClick={() => setRange('custom')}>
              <span className="flex items-center gap-1.5"><Icon name="calendar" size={14} />{L('Özel', 'Custom')}</span>
            </PeriodBtn>
          </div>
          <span className="hidden sm:block w-px h-[18px]" style={{ background: 'var(--a-line)' }} />
          <CompareControl
            lang={lang}
            enabled={compare}
            onEnabled={setCompare}
            mode={compareMode}
            onMode={setCompareMode}
            data={data}
            onOpenCompare={() => onNavigate('compare')}
          />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            title={data ? `${L('Güncellendi', 'Updated')}: ${new Date(data.generatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : undefined}
            aria-label={L('Yenile', 'Refresh')}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--a-hover)] disabled:opacity-50"
            style={{ color: 'var(--a-muted)' }}
          >
            <span className={loading ? 'animate-spin' : ''}><Icon name="refresh" size={15} /></span>
          </button>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mt-5">
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
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 mt-6 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
          <span>{error}</span>
          <button type="button" onClick={() => load(true)} className="underline underline-offset-4">{L('Tekrar dene', 'Retry')}</button>
        </div>
      )}

      {!data && !error && <SkeletonBlock />}

      {data && (
        <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .15s' }}>
          <Section>
            <SectionHead title={L('Etiketler', 'Tags')} sub={L('Üretilen QR etiketlerinin durumu', 'Status of produced QR tags')} />
            <KpiGrid
              lang={lang} up={UP} down={DOWN}
              items={[
                { label: L('Toplam üretilen', 'Total produced'), kpi: data.kpis.tagsTotal },
                { label: L('Aktif (araca bağlı)', 'Active (linked)'), kpi: data.kpis.tagsActive },
                { label: L('Boşta (satışa hazır)', 'Idle (in stock)'), kpi: data.kpis.tagsIdle },
                { label: L('Kapalı / süresi dolmuş', 'Closed / expired'), kpi: data.kpis.tagsClosed, inverse: true },
              ]}
            />
          </Section>

          <Section>
            <SectionHead title={L('Müşteriler', 'Customers')} sub={L('Kayıtlı hesaplar ve araçları', 'Registered accounts and vehicles')} />
            <KpiGrid
              lang={lang} up={UP} down={DOWN}
              items={[
                { label: L('Kayıtlı kullanıcı', 'Registered users'), kpi: data.kpis.users },
                { label: L('QR kullanan kullanıcı', 'Users with a QR'), kpi: data.kpis.usersWithTag },
                { label: L('Kayıtlı araç', 'Registered vehicles'), kpi: data.kpis.vehicles },
                { label: L('QR bağlı araç', 'Vehicles with a QR'), kpi: data.kpis.vehiclesWithTag },
              ]}
            />
          </Section>

          <Section>
            <TrendSection
              data={data}
              metric={metric}
              onMetric={setMetric}
              showPrev={showPrev}
              campaigns={campaigns}
              showBands={showCampaignBands}
              onShowBands={setShowCampaignBands}
              onCampaigns={() => setShowCampaigns(true)}
              onOpenCompare={() => onNavigate('compare')}
              lang={lang}
              up={UP}
              down={DOWN}
            />
          </Section>

          <Section>
            <SectionHead
              title={L('Müşteri hunisi', 'Customer funnel')}
              sub={data.range.key === 'all'
                ? L(`Tüm ${nf(lang).format(data.funnel.registered)} kullanıcının ilerleyişi`, `Progress of all ${data.funnel.registered} users`)
                : L(`Bu dönemde kayıt olan ${nf(lang).format(data.funnel.registered)} kullanıcının ilerleyişi`, `Progress of ${data.funnel.registered} users who signed up in this period`)}
            />
            <Funnel data={data.funnel} lang={lang} />
          </Section>

          <Section>
            <ProvinceTable list={data.provinces} lang={lang} />
          </Section>

          <Section className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-14">
            <section>
              <SectionHead title={<>{L('Dikkat gerektirenler', 'Needs attention')}{data.attention.length > 0 && <span className="font-normal" style={{ color: 'var(--a-faint)' }}> {data.attention.length}</span>}</>} />
              <Attention items={data.attention} lang={lang} danger={DOWN} onNavigate={onNavigate} />
            </section>
            <section>
              <SectionHead title={L('Son işlemler', 'Recent activity')} right={<LinkBtn onClick={() => onNavigate('audit')}>{L('Tümünü gör', 'See all')}</LinkBtn>} />
              <Recent list={data.recent} lang={lang} />
            </section>
          </Section>
        </div>
      )}

      {showCampaigns && (
        <CampaignDialog
          lang={lang}
          uid={uid}
          campaigns={campaigns}
          onGoTo={goToCampaign}
          onClose={() => setShowCampaigns(false)}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------ küçük parçalar

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mt-12 md:mt-16 ${className}`}>{children}</div>
);

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

const SkeletonBlock: React.FC = () => (
  <div className="flex flex-col gap-12 mt-14 animate-pulse" aria-hidden="true">
    {[0, 1].map((r) => (
      <div key={r} className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="h-3 w-24 rounded" style={{ background: 'var(--a-active)' }} />
            <div className="h-7 w-16 rounded" style={{ background: 'var(--a-active)' }} />
          </div>
        ))}
      </div>
    ))}
    <div className="h-[300px] rounded" style={{ background: 'var(--a-hover)' }} />
  </div>
);

// ------------------------------------------------------------------ karşılaştırma seçimi

const CompareControl: React.FC<{
  lang: AdminLang;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  mode: CompareMode;
  onMode: (m: CompareMode) => void;
  data: OverviewData | null;
  onOpenCompare: () => void;
}> = ({ lang, enabled, onEnabled, mode, onMode, data, onOpenCompare }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
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

  // Seçeneklerin altında gösterilecek aralıklar (seçili dönem uzunluğuna göre)
  const r = data?.range;
  const prevRange = r && r.key !== 'all' ? fmtRange(addDays(r.start, -r.days), addDays(r.start, -1), lang, true) : null;
  const yoyStart = r ? `${Number(r.start.slice(0, 4)) - 1}${r.start.slice(4) === '-02-29' ? '-02-28' : r.start.slice(4)}` : '';
  const yoyRange = r && r.key !== 'all' ? fmtRange(yoyStart, addDays(yoyStart, r.days - 1), lang, true) : null;
  // Karşılaştırma dönemi bu yıldan farklı bir yıldaysa yıl da yazılır (örn. geçen yıl).
  const current = r?.prevStart && r.prevEnd ? fmtRange(r.prevStart, r.prevEnd, lang, r.prevStart.slice(0, 4) !== r.end.slice(0, 4)) : null;
  const unavailable = r?.key === 'all';

  const option = (m: CompareMode, title: string, sub: string | null) => {
    const on = mode === m;
    return (
      <button
        type="button"
        role="menuitemradio"
        aria-checked={on}
        onClick={() => { onMode(m); onEnabled(true); setOpen(false); }}
        className="w-full flex items-start gap-3 text-left px-3.5 py-3 rounded-lg transition-colors hover:bg-[var(--a-hover)]"
        style={{ background: on ? 'var(--a-active)' : undefined }}
      >
        <span className="mt-0.5 w-4 h-4 rounded-full shrink-0 flex items-center justify-center" style={{ border: `1.5px solid ${on ? 'var(--a-text)' : 'var(--a-line3)'}` }}>
          {on && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--a-text)' }} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px]" style={{ color: 'var(--a-text)' }}>{title}</span>
          {sub && <span className="block text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{sub}</span>}
        </span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center h-8 rounded-lg" style={{ border: '1px solid var(--a-line2)' }}>
        <label className="flex items-center gap-2 pl-2.5 pr-2 h-full cursor-pointer select-none text-[12.5px]" style={{ color: 'var(--a-text)' }}>
          <input type="checkbox" checked={enabled && !unavailable} disabled={unavailable} onChange={(e) => onEnabled(e.target.checked)} className="w-3.5 h-3.5" style={{ accentColor: 'var(--a-text)' }} />
          {L('Karşılaştır', 'Compare')}
        </label>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 h-full pl-1 pr-2.5 text-[12.5px] rounded-r-lg transition-colors hover:bg-[var(--a-hover)]"
          style={{ color: 'var(--a-muted)' }}
        >
          {unavailable ? L('“Tümü”nde yok', 'n/a for “All”') : current || '—'}
          <Icon name="chevronDown" size={13} />
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 lg:right-auto lg:left-0 top-10 z-40 w-[320px] max-w-[calc(100vw-32px)] p-2 rounded-xl" style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line2)', boxShadow: 'var(--a-shadow)' }}>
          {unavailable && (
            <p className="m-0 px-3.5 py-2.5 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
              {L('“Tümü” seçiliyken karşılaştırılacak önceki dönem yok. Başka bir dönem seçin.', 'There is no previous period for “All”.')}
            </p>
          )}
          {option('prev', L('Hemen önceki dönem', 'Previous period'), prevRange ? `${prevRange} · ${L('aynı uzunlukta, hemen öncesi', 'same length, right before')}` : null)}
          {option('yoy', L('Geçen yılın aynı dönemi', 'Same period last year'), yoyRange)}
          <div className="flex items-center justify-between gap-3 mt-2 mx-1.5 pt-3 pb-1.5 px-2" style={{ borderTop: '1px solid var(--a-line)' }}>
            <span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{L('Daha fazla dönem için', 'For more periods')}</span>
            <LinkBtn onClick={() => { setOpen(false); onOpenCompare(); }}>{L('Dönem karşılaştırma', 'Period comparison')}</LinkBtn>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ sayılar

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

const KpiGrid: React.FC<{
  items: { label: string; kpi: Kpi; inverse?: boolean }[];
  lang: AdminLang; up: string; down: string;
}> = ({ items, lang, up, down }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-7">
    {items.map((it, i) => (
      <div
        key={it.label}
        className={`min-w-0 ${i % 2 === 1 ? 'pl-5 border-l' : 'pr-5 border-l-0'} ${i === 0 ? 'md:pl-0' : 'md:pl-6'} md:pr-6 ${i >= 1 ? 'md:border-l' : 'md:border-l-0'}`}
        style={{ borderColor: 'var(--a-line)' }}
      >
        <div className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{it.label}</div>
        <div className="text-[26px] md:text-[28px] font-medium tracking-[-0.5px] leading-none mt-2.5">{nf(lang).format(it.kpi.value)}</div>
        <div className="text-[12px] mt-2.5 leading-snug"><Delta kpi={it.kpi} lang={lang} up={up} down={down} inverse={it.inverse} /></div>
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------------ trend

const TrendSection: React.FC<{
  data: OverviewData;
  metric: OverviewMetric;
  onMetric: (m: OverviewMetric) => void;
  showPrev: boolean;
  campaigns: Campaign[];
  showBands: boolean;
  onShowBands: (v: boolean) => void;
  onCampaigns: () => void;
  onOpenCompare: () => void;
  lang: AdminLang; up: string; down: string;
}> = ({ data, metric, onMetric, showPrev, campaigns, showBands, onShowBands, onCampaigns, onOpenCompare, lang, up, down }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  const m = METRICS.find((x) => x.id === metric)!;
  const s = data.series[metric];
  const prev = showPrev ? s.prev : null;
  const b = useMemo(() => bucketize(data.range.start, s.cur, prev), [data, metric, showPrev]);
  const total = s.cur.reduce((a, v) => a + v, 0);
  const prevTotal = prev ? prev.reduce((a, v) => a + v, 0) : null;
  const prevLabel = data.range.compare === 'yoy' ? L('geçen yıl aynı dönemde', 'same period last year') : L('önceki dönemde', 'previous period');

  const bands = useMemo(() => (showBands ? campaigns : [])
    .filter((c) => c.end >= data.range.start && c.start <= data.range.end)
    .map((c) => {
      const from = b.buckets.findIndex((x) => x.end >= c.start);
      let to = b.buckets.length - 1;
      for (let i = b.buckets.length - 1; i >= 0; i--) { if (b.buckets[i].start <= c.end) { to = i; break; } }
      return { from: Math.max(0, from), to, title: c.title };
    }), [campaigns, b, data, showBands]);

  let note: string | null = null;
  if (metric === 'scans') {
    const earliest = prev && data.range.prevStart ? data.range.prevStart : data.range.start;
    if (!data.scansSince) note = L('Okutma sayımı ilk okutmayla başlayacak.', 'Scan counting starts with the first scan.');
    else if (data.scansSince > earliest) {
      note = L(
        `Okutmalar ${fmtDay(data.scansSince, lang, { day: 'numeric', month: 'long', year: 'numeric' })} tarihinden beri sayılıyor; öncesi grafikte 0 görünür.`,
        `Scans are counted since ${fmtDay(data.scansSince, lang, { day: 'numeric', month: 'long', year: 'numeric' })}; earlier days show 0.`,
      );
    }
  }

  return (
    <section>
      <SectionHead
        title={L('Etkinlik', 'Activity')}
        sub={L('Günlük okutma, bildirim ve kayıt hareketleri', 'Daily scans, notices and sign-ups')}
        right={(
          <button type="button" onClick={onOpenCompare} className="flex items-center gap-2 h-8 px-3 rounded-lg text-[12.5px] transition-colors hover:bg-[var(--a-hover)]" style={{ border: '1px solid var(--a-line2)', color: 'var(--a-text)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-9" /><path d="M14 7h6v6" /></svg>
            <span className="hidden sm:inline">{L('Dönem karşılaştırma', 'Compare periods')}</span>
            <span className="sm:hidden">{L('Karşılaştır', 'Compare')}</span>
          </button>
        )}
      />
      <MetricTabs value={metric} onChange={onMetric} lang={lang} />

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-7 mb-6">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[40px] font-medium tracking-[-1px] leading-none">{N.format(total)}</span>
            <span style={{ color: 'var(--a-muted)' }}>{L(m.unitTr, m.unitEn)}</span>
          </div>
          {prevTotal !== null && (
            <div className="mt-2 text-[13px]">
              {total === prevTotal ? (
                <span style={{ color: 'var(--a-faint)' }}>{prevLabel} {L('de aynı', 'the same')}: {N.format(prevTotal)}</span>
              ) : (
                <>
                  <span className="font-medium" style={{ color: total > prevTotal ? up : down }}>
                    {total > prevTotal ? '↑' : '↓'} {prevTotal > 0 ? `%${N.format(Math.round((Math.abs(total - prevTotal) / prevTotal) * 100))}` : N.format(Math.abs(total - prevTotal))}
                  </span>
                  <span style={{ color: 'var(--a-faint)' }}>&nbsp; {prevLabel} {N.format(prevTotal)}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col md:items-end gap-2.5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
            <span className="flex items-center gap-2"><span className="w-3.5 h-[2px]" style={{ background: 'var(--a-accent)' }} />{L('Bu dönem', 'This period')}</span>
            {prev && (
              <span className="flex items-center gap-2">
                <span className="w-3.5" style={{ borderTop: '1.5px dashed var(--a-faint)' }} />
                {data.range.compare === 'yoy' ? L('Geçen yıl', 'Last year') : L('Önceki dönem', 'Previous period')}
              </span>
            )}
            <LinkBtn onClick={onCampaigns}>{L('Kampanya işaretle', 'Mark a campaign')}</LinkBtn>
          </div>
          <Toggle on={showBands} onChange={onShowBands} label={L('Kampanyaları grafikte göster', 'Show campaigns on chart')} />
        </div>
      </div>

      <TrendChart buckets={b.buckets} unit={b.unit} cur={b.cur} prev={b.prev} bands={bands} lang={lang} unitLabel={L(m.unitTr, m.unitEn)} today={todayKey()} />
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

  useEffect(() => { setHover(null); }, [cur.length]);

  const H = 260;
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
    if (unit === 'day') return fmtDay(bk.start, lang, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    if (unit === 'month') return fmtDay(bk.start, lang, { month: 'long', year: 'numeric' });
    return fmtRange(bk.start, bk.end, lang, true);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n > 1 ? Math.round(px / step) : 0;
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  // Veri değişip nokta sayısı azaldığında eski imleç konumu dizinin dışında kalabilir;
  // (ör. "Aralığa git" sonrası) bu durumda imleç yok sayılır. Çökmeyi bu engeller.
  const hv = hover !== null && hover < n ? hover : null;
  const tipW = 196;
  const hx = hv !== null ? x(hv) : 0;
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

        {hv !== null && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={T} y2={B} stroke="var(--a-line3)" />
            {prev && <circle cx={hx} cy={y(prev[hv])} r={3} fill="var(--a-bg)" stroke="var(--a-faint)" strokeWidth={1.25} />}
            <circle cx={hx} cy={y(cur[hv])} r={3.5} fill="var(--a-bg)" stroke="var(--a-accent)" strokeWidth={1.6} />
          </g>
        )}
      </svg>

      {hv !== null && (
        <div
          className="absolute top-1 pointer-events-none rounded-lg px-3 py-2.5 text-[12px]"
          style={{ left: Math.max(0, tipLeft), width: tipW, background: 'var(--a-raised)', border: '1px solid var(--a-line2)', boxShadow: 'var(--a-shadow)' }}
        >
          <div className="mb-2" style={{ color: 'var(--a-muted)' }}>{longLabel(buckets[hv])}</div>
          <div className="flex justify-between gap-3">
            <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a-accent)' }} />{lang === 'tr' ? 'Bu dönem' : 'This period'}</span>
            <span>{N.format(cur[hv])}</span>
          </div>
          {prev && (
            <div className="flex justify-between gap-3 mt-1" style={{ color: 'var(--a-muted)' }}>
              <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a-faint)' }} />{lang === 'tr' ? 'Karşılaştırma' : 'Comparison'}</span>
              <span>{N.format(prev[hv])}</span>
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
    <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-y-7">
      {steps.map((st, i) => (
        <React.Fragment key={st.label}>
          {i > 0 && (
            <div className="hidden sm:flex flex-col items-center justify-center gap-1 w-16 shrink-0 text-[12px]" style={{ color: 'var(--a-muted)' }}>
              <span>%{pct(st.v, steps[i - 1].v)}</span>
              <span style={{ color: 'var(--a-line3)' }}><Icon name="chevronRight" size={14} /></span>
            </div>
          )}
          <div className={`flex-1 min-w-0 ${i % 2 === 1 ? 'pl-5 sm:pl-0' : 'pr-5 sm:pr-0'}`}>
            <div className="text-[12.5px] truncate" style={{ color: 'var(--a-muted)' }}>{st.label}</div>
            <div className="text-[28px] font-medium tracking-[-0.5px] leading-none mt-2.5">{N.format(st.v)}</div>
            <div className="h-[3px] rounded-sm mt-4" style={{ background: 'var(--a-line)' }}>
              <div className="h-full rounded-sm" style={{ width: `${pct(st.v, data.registered)}%`, background: 'var(--a-accent)' }} />
            </div>
            <div className="text-[12px] mt-2" style={{ color: 'var(--a-faint)' }}>
              %{pct(st.v, data.registered)} {L('toplamın', 'of total')}
              {i > 0 && <span className="sm:hidden"> · {L('önceki adımın', 'of prev.')} %{pct(st.v, steps[i - 1].v)}</span>}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ iller

type ProvSort = 'linked' | 'unlinked' | 'rate';

const ProvinceTable: React.FC<{ list: OverviewData['provinces']; lang: AdminLang }> = ({ list, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  const [sort, setSort] = useState<ProvSort>('linked');
  const [all, setAll] = useState(false);
  const rate = (p: { linked: number; unlinked: number }) => (p.linked + p.unlinked ? p.linked / (p.linked + p.unlinked) : 0);
  const sorted = useMemo(() => [...list].sort((a, b) => {
    const d = sort === 'linked' ? b.linked - a.linked : sort === 'unlinked' ? b.unlinked - a.unlinked : rate(b) - rate(a);
    return d || (b.linked + b.unlinked) - (a.linked + a.unlinked) || a.code.localeCompare(b.code);
  }), [list, sort]);
  const shown = all ? sorted : sorted.slice(0, 8);

  const head = (id: ProvSort, label: string, align: 'right' | 'left' = 'right') => (
    <th className={`pb-2.5 font-normal ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => setSort(id)}
        aria-sort={sort === id ? 'descending' : undefined}
        className="inline-flex items-center gap-1 text-[12px] whitespace-nowrap"
        style={{ color: sort === id ? 'var(--a-text2)' : 'var(--a-faint)' }}
      >
        {label}{sort === id && <span aria-hidden="true">↓</span>}
      </button>
    </th>
  );

  return (
    <section>
      <SectionHead
        title={L('İllere göre araçlar', 'Vehicles by province')}
        sub={L('Plakanın ilk iki hanesinden · QR bağlı olmayan araçlar satış fırsatıdır', 'From the plate code · vehicles without a QR are sales opportunities')}
        right={list.length > 8 ? <LinkBtn onClick={() => setAll((v) => !v)}>{all ? L('Daha az göster', 'Show less') : L(`${list.length} ilin tümü`, `All ${list.length}`)}</LinkBtn> : undefined}
      />
      {list.length === 0 ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Henüz kayıtlı araç yok.', 'No vehicles yet.')}</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="pb-2.5 text-left text-[12px] font-normal w-12" style={{ color: 'var(--a-faint)' }}>{L('Kod', 'Code')}</th>
                <th className="pb-2.5 text-left text-[12px] font-normal" style={{ color: 'var(--a-faint)' }}>{L('İl', 'Province')}</th>
                {head('linked', L('QR bağlı', 'With QR'))}
                {head('unlinked', L('QR bağlı değil', 'Without QR'))}
                <th className="pb-2.5 pl-8 md:pl-12 text-left font-normal">
                  <button type="button" onClick={() => setSort('rate')} aria-sort={sort === 'rate' ? 'descending' : undefined} className="inline-flex items-center gap-1 text-[12px]" style={{ color: sort === 'rate' ? 'var(--a-text2)' : 'var(--a-faint)' }}>
                    {L('Bağlanma oranı', 'Link rate')}{sort === 'rate' && <span aria-hidden="true">↓</span>}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const r = Math.round(rate(p) * 100);
                return (
                  <tr key={p.code} style={{ borderTop: '1px solid var(--a-line)' }}>
                    <td className="h-11" style={{ fontFamily: MONO, fontSize: 12, color: 'var(--a-faint)' }}>{p.code === '??' ? '—' : p.code}</td>
                    <td className="truncate max-w-[180px]">{PROVINCES[p.code] || L('Bilinmiyor', 'Unknown')}</td>
                    <td className="text-right w-[100px]">{N.format(p.linked)}</td>
                    <td className="text-right w-[120px]" style={{ color: 'var(--a-muted)' }}>{N.format(p.unlinked)}</td>
                    <td className="pl-8 md:pl-12">
                      <div className="flex items-center gap-3.5">
                        <div className="flex-1 h-[3px] rounded-sm" style={{ background: 'var(--a-line)' }}>
                          <div className="h-full rounded-sm" style={{ width: `${r}%`, background: 'var(--a-muted)' }} />
                        </div>
                        <span className="w-10 text-right">%{r}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ------------------------------------------------------------------ dikkat gerektirenler

const Attention: React.FC<{ items: AttentionItem[]; lang: AdminLang; danger: string; onNavigate: (s: string) => void }> = ({ items, lang, danger, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const N = nf(lang);
  if (!items.length) {
    return (
      <div className="flex items-center gap-3 py-4 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-muted)' }}>
        <Icon name="check" size={16} />{L('Şu an dikkat gerektiren bir şey yok.', 'Nothing needs attention right now.')}
      </div>
    );
  }
  const row = (key: string, icon: IconName, color: string, title: string, sub: string, action: string, section: string) => (
    <div key={key} className="flex items-start gap-3.5 py-4" style={{ borderTop: '1px solid var(--a-line)' }}>
      <span className="mt-0.5" style={{ color }}><Icon name={icon} size={16} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px]">{title}</div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{sub}</div>
      </div>
      <LinkBtn onClick={() => onNavigate(section)}>{action}</LinkBtn>
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
              L('Parti oluştur', 'New batch'), 'depot');
          }
          case 'pending_batch':
            return row(`b${i}`, 'clock', 'var(--a-muted)', L('Bekleyen parti', 'Pending batch'),
              L(`${it.batchId} · ${it.waitingDays} gündür baskıya gönderilmedi`, `${it.batchId} · not sent to print for ${it.waitingDays} days`),
              L('Aç', 'Open'), 'depot');
          case 'lost':
            return row(`l${i}`, 'alert', danger, L(`${N.format(it.count)} kayıp bildirimi`, `${N.format(it.count)} lost reports`),
              L('Son 30 günde müşteriler etiketini kayıp bildirdi; etiketler otomatik kapatıldı', 'Reported lost in the last 30 days; tags were closed automatically'),
              L('İncele', 'Review'), 'disabled');
          case 'scan_spike':
            return row(`a${i}`, 'alert', danger, L('Şüpheli okutma', 'Suspicious scans'),
              L(`${it.serial || it.code} · son 1 saatte ${N.format(it.count)}+ okutma`, `${it.serial || it.code} · ${N.format(it.count)}+ scans in an hour`),
              L('Etiketi aç', 'Open tag'), 'bank');
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
  tags_released: { tr: 'QR satışa çıkardı', en: 'released QR codes' },
  tags_unreleased: { tr: 'QR depoya geri aldı', en: 'returned QR codes to stock' },
  tags_printed: { tr: 'QR basıldı olarak işaretledi', en: 'marked QR codes printed' },
  tags_unprinted: { tr: 'QR basılmadı olarak işaretledi', en: 'marked QR codes unprinted' },
  tags_trashed: { tr: 'QR çöpe attı', en: 'trashed QR codes' },
  tags_restored: { tr: 'QR geri yükledi', en: 'restored QR codes' },
  tags_purged: { tr: 'QR kalıcı olarak sildi', en: 'permanently deleted QR codes' },
  account_deleted: { tr: 'hesabını sildi; QR\'ları kapatıldı', en: 'deleted their account; QR codes closed' },
};

const Recent: React.FC<{ list: RecentEvent[]; lang: AdminLang }> = ({ list, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (!list.length) {
    return <p className="m-0 py-4 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)' }}>{L('Henüz işlem yok.', 'No activity yet.')}</p>;
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
        <div key={i} className="flex gap-3.5 py-4" style={{ borderTop: '1px solid var(--a-line)' }}>
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

const CampaignDialog: React.FC<{
  lang: AdminLang;
  uid: string | null;
  campaigns: Campaign[];
  onGoTo: (c: Campaign) => void;
  onClose: () => void;
}> = ({ lang, uid, campaigns, onGoTo, onClose }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const t = todayKey();
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(addDays(t, -6));
  const [end, setEnd] = useState(t);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valid = title.trim().length > 0 && !!start && !!end && start <= end && !!uid;
  const q = search.trim().toLocaleLowerCase('tr-TR');
  const filtered = q ? campaigns.filter((c) => c.title.toLocaleLowerCase('tr-TR').includes(q)) : campaigns;

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'var(--a-overlay)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="camp-title" className="w-full sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-t-[14px] sm:rounded-[14px] p-5 sm:p-6" style={{ background: 'var(--a-raised)', border: '1px solid var(--a-line3)', boxShadow: 'var(--a-shadow)' }}>
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3 id="camp-title" className="m-0 text-base font-medium">{L('Kampanya işaretleri', 'Campaign markers')}</h3>
          <button type="button" onClick={onClose} aria-label={L('Kapat', 'Close')} className="w-8 h-8 -mr-1.5 -mt-1 rounded-md flex items-center justify-center hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-muted)' }}><Icon name="x" size={16} /></button>
        </div>
        <p className="m-0 mb-5 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>
          {L('İşaretlenen tarih aralığı grafikte hafif bir şeritle gösterilir; kampanyanın etkisini görmeyi kolaylaştırır.', 'The date range is shaded on the chart so you can see the campaign\'s effect.')}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1 text-[12px]" style={{ color: 'var(--a-faint)' }}>
            {L('Ad', 'Name')}
            <input
              value={title}
              maxLength={60}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              placeholder={L('örn. Fuar standı', 'e.g. Trade fair')}
              className="h-9 px-3 rounded-lg text-[13.5px] outline-none"
              style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
            />
          </label>
          <DateField label={L('Başlangıç', 'Start')} value={start} max={end} onChange={setStart} />
          <DateField label={L('Bitiş', 'End')} value={end} min={start} onChange={setEnd} />
        </div>
        {err && <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
        <div className="flex justify-end mt-3">
          <button type="button" disabled={!valid || busy} onClick={save} className="h-9 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50" style={{ background: 'var(--a-primary)' }}>
            {busy ? L('Kaydediliyor…', 'Saving…') : L('İşaretle', 'Add marker')}
          </button>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center gap-2 h-9 px-3 rounded-lg" style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-faint)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={L('Kampanya ara', 'Search campaigns')}
                aria-label={L('Kampanya ara', 'Search campaigns')}
                className="flex-1 min-w-0 bg-transparent outline-none text-[13px]"
                style={{ color: 'var(--a-text)' }}
              />
            </label>
            <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--a-faint)' }}>
              {q ? `${filtered.length} / ${campaigns.length}` : L(`${campaigns.length} kampanya`, `${campaigns.length} campaigns`)}
            </span>
          </div>
          <div className="mt-2">
            {filtered.length === 0 && (
              <p className="m-0 py-3 text-[13px]" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)' }}>
                {campaigns.length === 0 ? L('Henüz işaret yok.', 'No markers yet.') : L('Aramayla eşleşen kampanya yok.', 'No matching campaigns.')}
              </p>
            )}
            {filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: '1px solid var(--a-line)' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] truncate">{c.title}</div>
                  <div className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{fmtRange(c.start, c.end, lang, true)}</div>
                </div>
                {confirmId === c.id ? (
                  <span className="flex items-center gap-3 text-[12.5px]">
                    <button type="button" onClick={() => setConfirmId(null)} style={{ color: 'var(--a-muted)' }}>{L('Vazgeç', 'Cancel')}</button>
                    <button type="button" onClick={() => remove(c.id)} className="font-medium" style={{ color: 'var(--a-danger)' }}>{L('Sil', 'Delete')}</button>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onGoTo(c)}
                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] whitespace-nowrap transition-colors hover:bg-[var(--a-hover)]"
                      style={{ border: '1px solid var(--a-line2)', color: 'var(--a-text)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      {L('Aralığa git', 'Go to range')}
                    </button>
                    <button type="button" onClick={() => setConfirmId(c.id)} aria-label={L('Sil', 'Delete')} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-muted)' }}>
                      <Icon name="trash" size={15} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

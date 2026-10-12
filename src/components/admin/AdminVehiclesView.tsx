// Bağlı Araçlar: araç listesi (plaka / QR kodu / seri no araması) ve araç detayı
// Telefon her zaman maskelidir; ziyaretçi notları yöneticiye gösterilmez (yalnızca bildirim türü).

import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import { Note, TableWrap, Th, Td, stageColor } from './lifecycleUi';
import {
  BackLink, BigSearch, Card, ColorDot, ErrorPanel, InfoRow, Initials, LinkButton, NoAccess, Pager, Plate, SkeletonRows,
  StatCards, StatusDot, fmtAgo, fmtDay, nfFor, useCursorPages, useDebounced, useRemote,
} from './customerUi';
import { tagStatusText } from './AdminUsersView';
import { QrPreviewDialog } from './QrPreviewDialog';
import type { LTag } from '../../lib/lifecycleService';
import {
  DISABLE_REASON, NOTICE_TEXT, PROVINCES, TagState, VehicleDetail, VehicleFilter, activityText, canViewCustomers,
  ensureDirectory, getVehicle, initials, listVehicles, normPlate, provinceName, vehicleStats,
} from '../../lib/directoryService';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  role: string;
  detailId: string | null;
  onOpenVehicle: (id: string, plate: string) => void;
  onCloseVehicle: () => void;
  onOpenUser: (uid: string, name: string) => void;
}

export const AdminVehiclesView: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  if (!canViewCustomers(p.role)) return <NoAccess lang={p.lang} title={L('Bağlı Araçlar', 'Linked Vehicles')} />;
  return (
    <>
      <div className={p.detailId ? 'hidden' : ''}><VehiclesList {...p} /></div>
      {p.detailId && <VehicleDetailView key={p.detailId} {...p} id={p.detailId} />}
    </>
  );
};

function stateDot(state: TagState, isDark: boolean): string {
  return state === 'linked' ? stageColor('active', isDark) : state === 'disabled' ? stageColor('disabled', isDark) : 'var(--a-line3)';
}

// =====================================================================
// LİSTE
// =====================================================================

const VehiclesList: React.FC<Props> = ({ lang, isDark, onOpenVehicle, onOpenUser }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const [filter, setFilter] = useState<VehicleFilter>('all');
  const [province, setProvince] = useState<string>('');

  useEffect(() => {
    let alive = true;
    ensureDirectory().catch((e) => console.warn('[directory]', e)).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const stats = useRemote(() => vehicleStats(), `vstats|${ready}`);
  const pages = useCursorPages(`${dq}|${filter}|${province}`);
  const list = useRemote(
    () => (ready ? listVehicles(dq, filter, province || null, pages.cursor) : Promise.resolve(null)),
    `${ready}|${dq}|${filter}|${province}|${pages.cursor}`,
  );
  const s = stats.data;
  const rows = list.data?.rows || [];
  const searching = !!dq;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const filterCount = (f: VehicleFilter) => (s ? (f === 'all' ? s.total : s[f]) : null);
  const total = province ? null : filterCount(filter);
  const from = (pages.page - 1) * 25 + 1;
  const shownNorm = list.data?.normalized || normPlate(dq);

  const provinceOptions = useMemo(() => {
    const entries = Object.entries(s?.provinces || {});
    return entries.sort((a, b) => provinceName(a[0]).localeCompare(provinceName(b[0]), 'tr'));
  }, [s]);

  const openFirstIfSingle = () => {
    if (rows.length === 1) onOpenVehicle(rows[0].id, rows[0].plate);
  };

  const FILTERS: { id: VehicleFilter; label: string }[] = [
    { id: 'all', label: L('Tümü', 'All') },
    { id: 'linked', label: L('QR bağlı', 'QR linked') },
    { id: 'none', label: L('QR yok', 'No QR') },
    { id: 'disabled', label: L('QR devre dışı', 'QR disabled') },
  ];

  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px]">{L('Bağlı Araçlar', 'Linked Vehicles')}</h1>
      <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Sisteme kaydedilmiş bütün araçlar', 'All vehicles registered in the system')}</p>

      {stats.error && <div className="mt-8"><ErrorPanel error={stats.error} lang={lang} onRetry={stats.reload} /></div>}
      <section className="mt-9">
        {s ? (
          <StatCards items={[
            { label: L('Toplam araç', 'Total vehicles'), value: nf.format(s.total), sub: L(`Bu ay ${nf.format(s.newMonth)} yeni`, `${s.newMonth} new this month`) },
            { label: L('QR bağlı', 'QR linked'), value: nf.format(s.linked), sub: L(`Araçların %${pct(s.linked, s.total)}'i`, `${pct(s.linked, s.total)}% of vehicles`) },
            { label: L('QR bağlı değil', 'No QR'), value: nf.format(s.none), sub: L('Satış fırsatı', 'Sales opportunity') },
            { label: L('QR devre dışı', 'QR disabled'), value: nf.format(s.disabled), sub: L('Kapatılmış ya da süresi dolmuş', 'Closed or expired') },
          ]} />
        ) : !stats.error && <SkeletonRows rows={1} h={112} />}
      </section>

      <section className="mt-12">
        <div onKeyDown={(e) => { if (e.key === 'Enter') openFirstIfSingle(); }}>
          <BigSearch
            label={L('Plaka, QR kodu veya seri no', 'Plate, QR code or serial')}
            value={q}
            onChange={setQ}
            placeholder={L('Örn. 34 ABC 127', 'e.g. 34 ABC 127')}
            mono
            busy={list.loading && searching}
          />
        </div>
        <div className="text-[12.5px] mt-2.5 min-h-[18px]" style={{ color: 'var(--a-faint)' }}>
          {searching && (list.data?.byTag
            ? L('QR koduyla eşleşen araç', 'Vehicle matching the QR code')
            : <>{L('“', '“')}<span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: 'var(--a-text2)' }}>{shownNorm}</span>{L('” ile başlayan plakalar · boşluk ve büyük/küçük harf farkı yok sayılır', '” · spaces and letter case are ignored')}{rows.length === 1 ? L(' · açmak için Enter', ' · press Enter to open') : ''}</>)}
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-6">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className="inline-flex items-center gap-[7px] h-[30px] px-[11px] rounded-[7px] text-[12.5px] transition-colors hover:bg-[var(--a-hover)]"
                style={{ background: filter === f.id ? 'var(--a-active)' : undefined, color: filter === f.id ? 'var(--a-text)' : 'var(--a-muted)' }}
              >
                {f.label}{!searching && filterCount(f.id) !== null && <span style={{ color: 'var(--a-faint)' }}>{nf.format(filterCount(f.id)!)}</span>}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 h-[34px] pl-3 pr-2 rounded-lg text-[12.5px] self-start" style={{ border: '1px solid var(--a-line2)', color: 'var(--a-muted)' }}>
            {L('İl', 'Province')}:
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              aria-label={L('İl filtresi', 'Province filter')}
              className="bg-transparent outline-none text-[12.5px] pr-1"
              style={{ color: 'var(--a-text)' }}
            >
              <option value="">{L('Tümü', 'All')}</option>
              {provinceOptions.map(([code, n]) => <option key={code} value={code}>{provinceName(code)} ({n})</option>)}
              {province && !s?.provinces[province] && <option value={province}>{PROVINCES[province] || province}</option>}
            </select>
          </label>
        </div>

        <div className="mt-5">
          {list.error && <ErrorPanel error={list.error} lang={lang} onRetry={list.reload} />}
          {!list.error && !list.data && <SkeletonRows />}
          {list.data && rows.length === 0 && (
            <div className="flex flex-col items-center text-center gap-2 py-14 px-4 rounded-xl" style={{ border: '1px dashed var(--a-line2)' }}>
              <span style={{ color: 'var(--a-faint)' }}><Icon name={searching ? 'search' : 'car'} size={24} /></span>
              <div className="text-[14px] mt-1">{searching ? L('Bu aramayla eşleşen araç yok', 'No vehicles match this search') : L('Bu filtrede araç yok', 'No vehicles in this filter')}</div>
              {searching && <p className="m-0 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Plakanın başını, 12 haneli QR kodunu ya da HF- ile başlayan seri numarasını yazın.', 'Type the start of a plate, the 12-character code or the HF- serial.')}</p>}
            </div>
          )}
          {rows.length > 0 && (
            <div className={list.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <TableWrap minWidth={780}>
                <thead><tr>
                  <Th>{L('Plaka', 'Plate')}</Th><Th>{L('Araç', 'Vehicle')}</Th><Th>{L('Sahibi', 'Owner')}</Th>
                  <Th>QR</Th><Th>{L('Eklendi', 'Added')}</Th><Th w={24} />
                </tr></thead>
                <tbody>
                  {rows.map((v) => (
                    <tr
                      key={v.id}
                      tabIndex={0}
                      onClick={() => onOpenVehicle(v.id, v.plate)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onOpenVehicle(v.id, v.plate); }}
                      className="cursor-pointer transition-colors hover:bg-[var(--a-hover)] focus:outline-none focus-visible:bg-[var(--a-hover)]"
                    >
                      <Td className="h-[72px]"><Plate plate={v.plate} /></Td>
                      <Td>
                        <div className="truncate max-w-[220px]">{v.brandModel || <span style={{ color: 'var(--a-faint)' }}>—</span>}</div>
                        {v.province && <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{provinceName(v.province)}</div>}
                      </Td>
                      <Td>
                        {v.ownerUid ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenUser(v.ownerUid, v.ownerName || v.ownerEmail); }}
                            className="text-left truncate max-w-[220px] underline-offset-4 hover:underline"
                          >
                            {v.ownerName || v.ownerEmail || L('Sahip', 'Owner')}
                          </button>
                        ) : <span style={{ color: 'var(--a-faint)' }}>—</span>}
                      </Td>
                      <Td>
                        <ColorDot color={stateDot(v.tagState, isDark)}>
                          {v.tagState === 'linked' ? L('QR bağlı', 'Linked') : v.tagState === 'disabled'
                            ? `${L('QR devre dışı', 'Disabled')}${v.tagReason && DISABLE_REASON[v.tagReason] ? ` · ${(lang === 'tr' ? DISABLE_REASON[v.tagReason].tr : DISABLE_REASON[v.tagReason].en).toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-GB')}` : ''}`
                            : <span style={{ color: 'var(--a-faint)' }}>{L('QR yok', 'No QR')}</span>}
                        </ColorDot>
                        {v.tagSerial && <div className="text-[11.5px] mt-1" style={{ color: 'var(--a-faint)', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{v.tagSerial}</div>}
                      </Td>
                      <Td muted>{fmtDay(v.createdAt, lang)}</Td>
                      <Td w={24}><span style={{ color: 'var(--a-faint)' }}><Icon name="chevronRight" size={15} /></span></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          )}
          {list.data && rows.length > 0 && (
            searching || province ? (
              <Pager
                lang={lang}
                canPrev={!searching && pages.page > 1}
                canNext={!searching && !!list.data.next}
                onPrev={pages.prev}
                onNext={() => list.data?.next && pages.next(list.data.next)}
                text={list.data.truncated
                  ? L(`İlk ${rows.length} sonuç gösteriliyor; plakanın devamını yazın.`, `Showing the first ${rows.length}; type more of the plate.`)
                  : searching ? L(`${rows.length} araç bulundu`, `${rows.length} vehicles found`) : L(`${nf.format(from)}–${nf.format(from + rows.length - 1)}. araçlar`, `Vehicles ${from}–${from + rows.length - 1}`)}
              />
            ) : (
              <Pager
                lang={lang}
                canPrev={pages.page > 1}
                canNext={!!list.data.next}
                onPrev={pages.prev}
                onNext={() => list.data?.next && pages.next(list.data.next)}
                text={total !== null ? `${nf.format(from)}–${nf.format(from + rows.length - 1)} / ${nf.format(total)} ${L('araç', 'vehicles')}` : ''}
              />
            )
          )}
        </div>
        <div className="mt-8">
          <Note>{L('İl, plakanın ilk iki hanesinden belirlenir (34 → İstanbul). Arama veritabanında yapılır; araç sayısı arttıkça da aynı hızda çalışır.', 'Province comes from the first two digits of the plate. Search runs in the database and stays fast as the list grows.')}</Note>
        </div>
      </section>
    </div>
  );
};

// =====================================================================
// ARAÇ DETAYI
// =====================================================================

function previewTag(v: VehicleDetail): LTag | null {
  const t = v.tag;
  if (!t || !t.stage) return null;
  const d = (ms: number | null) => (ms ? new Date(ms) : null);
  return {
    code: t.code, tagId: t.serial, batchId: t.batchId || '', sequenceNumber: 0, stage: t.stage, printed: t.printed,
    assignedPlate: v.plate, assignedUserEmail: v.owner?.email || null, scanCount: t.scanCount, lastAction: t.lastAction,
    lastActionBy: null, stageChangedAt: d(t.stageChangedAt), createdAt: null, releasedAt: null, activatedAt: d(t.activatedAt),
    trashedFrom: null, trashedAt: null, trashedBy: null,
    disabledReason: (t.reason as LTag['disabledReason']) || null, disabledAt: null, disabledBy: null, permanent: t.permanent,
  };
}

const VehicleDetailView: React.FC<Props & { id: string }> = ({ lang, isDark, id, onCloseVehicle, onOpenUser, onOpenVehicle }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const r = useRemote(() => getVehicle(id), id);
  const v = r.data;
  const [showQr, setShowQr] = useState(false);
  useEffect(() => { if (v) onOpenVehicle(id, v.plate); }, [v?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = v ? tagStatusText(v.tag, lang) : null;
  const max = v ? Math.max(1, ...v.scans.days) : 1;
  const qr = v ? previewTag(v) : null;

  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <BackLink label={L('Bağlı Araçlar', 'Linked Vehicles')} onClick={onCloseVehicle} />
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!v && !r.error && <div className="mt-6"><SkeletonRows rows={5} h={90} /></div>}
      {v && st && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mt-6">
            <Plate plate={v.plate} large />
            <div className="flex-1 min-w-0">
              <div className="text-[20px] font-medium break-words">{v.brandModel || <span style={{ color: 'var(--a-faint)' }}>{L('Model belirtilmemiş', 'No model')}</span>}</div>
              <div className="text-[13px] mt-1.5" style={{ color: 'var(--a-faint)' }}>
                {[provinceName(v.province), L(`${fmtDay(v.createdAt, lang)} tarihinde eklendi`, `Added ${fmtDay(v.createdAt, lang)}`)].filter(Boolean).join(' · ')}
              </div>
            </div>
            <ColorDot color={st.color ? stageColor(st.color as never, isDark) : 'var(--a-line3)'}>{st.text}</ColorDot>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-10">
            <Card title={L('Sahibi', 'Owner')} right={v.owner && <LinkButton onClick={() => onOpenUser(v.owner!.uid, v.owner!.name || v.owner!.email)}>{L('Kullanıcıya git', 'Open user')}</LinkButton>}>
              {v.owner ? (
                <>
                  <div className="flex items-center gap-3.5 mt-4 mb-2">
                    <Initials text={initials(v.owner.name, v.owner.email)} />
                    <div className="min-w-0">
                      <div className="truncate">{v.owner.name || <span style={{ color: 'var(--a-faint)', fontStyle: 'italic' }}>{L('İsimsiz kullanıcı', 'Unnamed user')}</span>}</div>
                      <div className="text-[12.5px] mt-0.5 truncate" style={{ color: 'var(--a-faint)' }}>{v.owner.email}</div>
                    </div>
                  </div>
                  <InfoRow first label={L('Telefon', 'Phone')}>
                    {v.phoneMasked
                      ? <span className="inline-flex items-center gap-2" title={L('Telefon numaraları gizlidir', 'Phone numbers are hidden')}><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 13 }}>{v.phoneMasked}</span><span style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={13} /></span></span>
                      : <span style={{ color: 'var(--a-faint)' }}>{L('Eklenmemiş', 'Not added')}</span>}
                  </InfoRow>
                  <InfoRow label={L('Diğer araçları', 'Other vehicles')}>
                    {v.owner.otherPlates.length ? <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5 }}>{v.owner.otherPlates.slice(0, 4).join(', ')}{v.owner.otherPlates.length > 4 ? ` +${v.owner.otherPlates.length - 4}` : ''}</span> : <span style={{ color: 'var(--a-faint)' }}>{L('Yok', 'None')}</span>}
                  </InfoRow>
                  <InfoRow label={L('Bildirim', 'Notifications')}><StatusDot on={v.owner.pushEnabled} onText={L('Açık', 'On')} offText={L('Kapalı', 'Off')} /></InfoRow>
                </>
              ) : <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Sahip bilgisi bulunamadı.', 'Owner not found.')}</p>}
            </Card>

            <Card title={L('Bağlı QR', 'Linked QR')} right={qr && <LinkButton onClick={() => setShowQr(true)}>{L("QR'ı göster", 'Show QR')}</LinkButton>}>
              {v.tag ? (
                <>
                  <div className="mt-4" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 15 }}>{v.tag.serial}</div>
                  <div className="mt-1.5 mb-2 text-[12px]" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", color: 'var(--a-faint)' }}>{v.tag.code.replace(/(.{4})(?=.)/g, '$1-')}</div>
                  <InfoRow first label={L('Durum', 'Status')}><ColorDot color={st.color ? stageColor(st.color as never, isDark) : 'var(--a-line3)'}>{st.text}</ColorDot></InfoRow>
                  <InfoRow label={L('Bağlandı', 'Linked on')}>{fmtDay(v.tag.activatedAt, lang)}</InfoRow>
                  <InfoRow label={L('Toplam okutma', 'Total scans')}>{nf.format(v.tag.scanCount)}{v.tag.lastScanAt ? <span style={{ color: 'var(--a-faint)' }}> · {L('son', 'last')} {fmtAgo(v.tag.lastScanAt, lang)}</span> : null}</InfoRow>
                </>
              ) : <p className="m-0 py-4 text-[13px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>{L('Bu araca bağlı QR yok.', 'No QR is linked to this vehicle.')}</p>}
            </Card>
          </div>

          <div className="mt-5">
            <Card title={L('Okutmalar', 'Scans')} sub={L(`Son 30 gün${v.tag?.lastScanAt ? ` · son okutma ${fmtAgo(v.tag.lastScanAt, lang)}` : ''}`, 'Last 30 days')} right={<span className="text-[22px] font-medium tracking-[-0.3px]" style={{ color: 'var(--a-text)' }}>{nf.format(v.scans.total)}</span>}>
              <div className="flex items-end gap-[3px] sm:gap-1 h-[64px] mt-6" role="img" aria-label={L(`Son 30 günde ${v.scans.total} okutma`, `${v.scans.total} scans in 30 days`)}>
                {v.scans.days.map((n, i) => (
                  <span key={i} className="flex-1 rounded-[2px]" title={String(n)} style={{ height: `${Math.max(3, (n / max) * 60)}px`, background: n ? stageColor('active', isDark) : 'var(--a-line)' }} />
                ))}
              </div>
              <div className="flex justify-between text-[11.5px] mt-2.5" style={{ color: 'var(--a-faint)' }}>
                <span>{fmtDay(Date.now() - 29 * 86400000, lang)}</span><span>{L('Bugün', 'Today')}</span>
              </div>
              {!v.tag && <p className="m-0 mt-3 text-[12px]" style={{ color: 'var(--a-faint)' }}>{L('QR bağlı olmadığı için okutma yok.', 'No QR, so no scans.')}</p>}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card title={L('Ziyaretçi bildirimleri', 'Visitor notices')} right={L(`30 günde ${nf.format(v.notices30)}`, `${v.notices30} in 30 days`)}>
              {v.notices.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Henüz bildirim gelmedi.', 'No notices yet.')}</p>}
              {v.notices.map((n, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3.5" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px]">{lang === 'tr' ? (NOTICE_TEXT[n.type] || NOTICE_TEXT.other).tr : (NOTICE_TEXT[n.type] || NOTICE_TEXT.other).en}</div>
                    <div className="text-[12px] mt-1" style={{ color: 'var(--a-faint)' }}>{fmtDay(n.at, lang, true)}</div>
                  </div>
                  <span className="text-[12.5px] shrink-0" style={{ color: n.read ? 'var(--a-faint)' : '#E3A857' }}>{n.read ? L('Okundu', 'Read') : L('Okunmadı', 'Unread')}</span>
                </div>
              ))}
              {v.notices.length > 0 && <p className="m-0 mt-2 text-[11.5px]" style={{ color: 'var(--a-faint)' }}>{L('Ziyaretçinin yazdığı not gizlilik gereği burada gösterilmez.', 'Visitor notes are not shown for privacy.')}</p>}
            </Card>
            <Card title={L('Ziyaretçinin gördüğü', 'What visitors see')}>
              <InfoRow first label={L('Plaka', 'Plate')}><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5 }}>{v.plateMasked}</span></InfoRow>
              <InfoRow label={L('Mesaj izni', 'Messages')}>{v.allowMessages ? L('Açık', 'On') : L('Kapalı', 'Off')}</InfoRow>
              <InfoRow label={L('Park notu', 'Parking note')}>{v.parkingNote ? <span style={{ color: 'var(--a-text2)' }}>“{v.parkingNote}”</span> : <span style={{ color: 'var(--a-faint)' }}>{L('Yok', 'None')}</span>}</InfoRow>
            </Card>
          </div>

          <div className="mt-5">
            <Card title={L('Geçmiş', 'History')}>
              {v.history.map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3.5" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px]">{activityText(h.kind, lang === 'tr')}</div>
                    {h.detail && <div className="text-[12px] mt-1 truncate" style={{ color: 'var(--a-faint)' }}>{h.detail}</div>}
                  </div>
                  <span className="text-[12.5px] shrink-0" style={{ color: 'var(--a-faint)' }}>{fmtDay(h.at, lang, true)}</span>
                </div>
              ))}
            </Card>
          </div>
          <div className="mt-8"><Note>{L('Bu sayfayı açmanız erişim kaydına yazılır. Telefon numarasına panelden erişilemez.', 'Opening this page is logged. Phone numbers are never available in the panel.')}</Note></div>
          {showQr && qr && <QrPreviewDialog tag={qr} lang={lang} isDark={isDark} onClose={() => setShowQr(false)} />}
        </>
      )}
    </div>
  );
};

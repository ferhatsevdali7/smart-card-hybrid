// Talepler: müşterilerden gelen istek, şikayet, öneri ve sorular + QR sayfasından gelen kötüye kullanım bildirimleri.
// Liste (hedef süre uyarılarıyla), talep detayı (yazışma, iç not, hazır yanıt, görsel), hazır yanıt yönetimi.
// Bütün yazmalar sunucuda yetkiyle denetlenir; bu ekran yalnızca yetkiye göre düğmeleri gösterir.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import { Btn, ConfirmDialog, Dialog, EmptyState, FilterChip, Note, PageHeader, TableWrap, Td, Th, errorText, useToasts } from './lifecycleUi';
import { BackLink, BigSearch, Card, ErrorPanel, InfoRow, Initials, Plate, SkeletonRows, StatCards, Tabs, fmtAgo, fmtDay, nfFor, useDebounced, useRemote } from './customerUi';
import { canSee, has, useAccess } from '../../lib/access';
import { initials } from '../../lib/directoryService';
import { ImageError, jpegUrl, prepareImage, type PreparedImage } from '../../lib/imageCompress';
import {
  LIMITS, TYPES, deleteTemplate, disableFromAbuse, durationText, eventLabel, getTicket, listAbuse, listTemplates, listTickets,
  reviewAbuse, saveTemplate, slaText, staffFile, staffReply, statusLabel, ticketStaff, topicLabel, typeLabel, updateTicket, uploadImage,
  type AbuseReport, type Attachment, type ListView, type Priority, type Template, type ThreadItem, type TicketDetail, type TicketStatus, type TicketType,
} from '../../lib/ticketService';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  /** Bildirimden gelinince açılacak talep / sekme */
  openId?: string | null;
  initialTab?: 'tickets' | 'abuse';
  onCrumb: (text: string | null) => void;
  onOpenUser: (uid: string, name: string) => void;
  onOpenVehicle: (id: string, plate: string) => void;
}

const STATUS_COLOR: Record<string, string> = { new: 'var(--a-accent)', in_review: '#B79CFF', waiting_customer: 'var(--tk-amber)', resolved: 'var(--a-success)', closed: 'var(--a-line3)' };
const TYPE_TONE: Record<string, { c: string; bg: string }> = {
  complaint: { c: 'var(--a-danger)', bg: 'var(--a-danger-tint)' },
  request: { c: 'var(--a-accent)', bg: 'var(--a-accent-tint)' },
  suggestion: { c: 'var(--a-success)', bg: 'var(--a-success-tint)' },
  question: { c: 'var(--a-muted)', bg: 'var(--a-active)' },
};
const TONE: Record<string, string> = { ok: 'var(--a-muted)', warn: 'var(--tk-amber)', bad: 'var(--a-danger)', done: 'var(--a-success)', muted: 'var(--a-faint)' };

export const TypeTag: React.FC<{ t: string; lang: AdminLang }> = ({ t, lang }) => {
  const tone = TYPE_TONE[t] || TYPE_TONE.question;
  return <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px] whitespace-nowrap" style={{ color: tone.c, background: tone.bg }}>{typeLabel(t, lang)}</span>;
};
export const StatusText: React.FC<{ s: string; lang: AdminLang }> = ({ s, lang }) => (
  <span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap" style={{ color: s === 'closed' ? 'var(--a-faint)' : 'var(--a-text2)' }}>
    <i className="w-[7px] h-[7px] rounded-full" style={{ background: STATUS_COLOR[s] || 'var(--a-line3)' }} />{statusLabel(s, lang)}
  </span>
);

export const AdminTicketsView: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  const [tab, setTab] = useState<'tickets' | 'abuse'>(p.initialTab || 'tickets');
  const [openId, setOpenId] = useState<string | null>(p.openId || null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const toasts = useToasts();
  useEffect(() => { if (!openId) p.onCrumb(tab === 'abuse' ? L('Kötüye kullanım', 'Abuse reports') : null); }, [openId, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!canSee('tickets')) return null;
  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1', ['--tk-amber' as string]: p.isDark ? '#E3A857' : '#9A5B0B' } as React.CSSProperties}>
      {openId ? (
        <TicketDetailView
          key={openId} {...p} id={openId} toast={toasts.show}
          onBack={() => { setOpenId(null); setVersion((v) => v + 1); }}
          onOpenTemplates={() => setTemplatesOpen(true)}
        />
      ) : (
        <>
          <PageHeader
            title={L('Talepler', 'Tickets')}
            sub={L('Müşterilerden gelen istek, şikayet, öneri ve sorular', 'Requests, complaints, suggestions and questions from customers')}
            right={<Btn icon="layers" onClick={() => setTemplatesOpen(true)}>{L('Hazır yanıtlar', 'Templates')}</Btn>}
          />
          <div className="mt-8">
            <Tabs value={tab} onChange={(v) => setTab(v as 'tickets' | 'abuse')} tabs={[{ id: 'tickets', label: L('Talepler', 'Tickets') }, { id: 'abuse', label: L('Kötüye kullanım bildirimleri', 'Abuse reports') }]} />
          </div>
          {tab === 'tickets' && <TicketList key={version} lang={p.lang} onOpen={(id, no) => { setOpenId(id); p.onCrumb(no); }} />}
          {tab === 'abuse' && <AbuseList lang={p.lang} toast={toasts.show} />}
        </>
      )}
      {templatesOpen && <TemplatesDialog lang={p.lang} onClose={() => setTemplatesOpen(false)} toast={toasts.show} />}
      {toasts.node}
    </div>
  );
};

// =====================================================================
// LİSTE
// =====================================================================

const TicketList: React.FC<{ lang: AdminLang; onOpen: (id: string, no: string) => void }> = ({ lang, onOpen }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const [view, setView] = useState<ListView>('open');
  const [type, setType] = useState<TicketType | ''>('');
  const [assignee, setAssignee] = useState<'' | 'me' | 'none'>('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);
  const [before, setBefore] = useState<number | null>(null);
  const [extra, setExtra] = useState<Awaited<ReturnType<typeof listTickets>>['rows']>([]);
  const key = `${view}|${type}|${assignee}|${dq}`;
  const r = useRemote(() => listTickets({ view, type: type || null, assignee: assignee || null, q: dq || undefined }), key);
  useEffect(() => { setBefore(null); setExtra([]); }, [key]);
  const more = useRemote(() => (before ? listTickets({ view, type: type || null, assignee: assignee || null, before }) : Promise.resolve(null)), `${key}|${before}`);
  useEffect(() => { if (more.data) setExtra((x) => [...x, ...more.data!.rows.filter((n) => !x.some((o) => o.id === n.id))]); }, [more.data]);
  const d = r.data;
  const rows = d ? [...d.rows, ...extra] : [];
  const next = more.data ? more.data.next : d?.next || null;

  const chips: { id: ListView; label: string; count?: number }[] = [
    { id: 'open', label: L('Açık', 'Open'), count: d?.counts.open },
    { id: 'new', label: L('Yeni', 'New'), count: d?.counts.new },
    { id: 'in_review', label: L('İnceleniyor', 'In review'), count: d?.counts.in_review },
    { id: 'waiting_customer', label: L('Bilgi bekleniyor', 'Waiting'), count: d?.counts.waiting_customer },
    { id: 'resolved', label: L('Çözüldü', 'Resolved'), count: d?.counts.resolved },
    { id: 'closed', label: L('Kapandı', 'Closed'), count: d?.counts.closed },
  ];
  const sel = 'h-[34px] px-3 rounded-lg text-[12.5px] outline-none';
  const selStyle = { background: 'var(--a-field)', border: '1px solid var(--a-line2)', color: 'var(--a-text)' };
  return (
    <>
      {d && (
        <section className="mt-8">
          <StatCards items={[
            { label: L('Açık talep', 'Open'), value: nf.format(d.kpis.open), sub: L(`${d.kpis.newCount} yeni · ${d.kpis.unassigned} atanmamış`, `${d.kpis.newCount} new · ${d.kpis.unassigned} unassigned`) },
            { label: L('Süresi geçen', 'Overdue'), value: <span style={{ color: d.kpis.overdue ? 'var(--a-danger)' : undefined }}>{nf.format(d.kpis.overdue)}</span>, sub: L('İlk yanıt 24 sa · çözüm 3 gün', 'First reply 24 h · resolve 3 d') },
            { label: L('Ortalama ilk yanıt', 'Avg. first reply'), value: d.kpis.avgFirstResponseMs !== null ? durationText(d.kpis.avgFirstResponseMs, lang) : '—', sub: L('Son 30 gün', 'Last 30 days') },
            { label: L('Memnuniyet', 'Satisfaction'), value: d.kpis.satisfaction !== null ? <>{d.kpis.satisfaction.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB')}<span className="text-[16px]" style={{ color: 'var(--a-faint)' }}> / 5</span></> : '—', sub: L(`${d.kpis.ratedCount} değerlendirme · son 30 gün`, `${d.kpis.ratedCount} ratings · 30 days`) },
          ]} />
        </section>
      )}
      <div className="mt-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => <FilterChip key={c.id} on={view === c.id} onClick={() => setView(c.id)} count={c.count}>{c.label}</FilterChip>)}
        </div>
        <div className="flex gap-2">
          <select aria-label={L('Tür', 'Type')} value={type} onChange={(e) => setType(e.target.value as TicketType | '')} className={sel} style={selStyle}>
            <option value="">{L('Tür: Tümü', 'Type: All')}</option>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{lang === 'tr' ? t.tr : t.en}</option>)}
          </select>
          <select aria-label={L('Sorumlu', 'Assignee')} value={assignee} onChange={(e) => setAssignee(e.target.value as '' | 'me' | 'none')} className={sel} style={selStyle}>
            <option value="">{L('Sorumlu: Herkes', 'Assignee: All')}</option>
            <option value="me">{L('Bana atananlar', 'Assigned to me')}</option>
            <option value="none">{L('Atanmamış', 'Unassigned')}</option>
          </select>
        </div>
      </div>
      <div className="mt-4"><BigSearch value={q} onChange={setQ} placeholder={L('Talep no, müşteri, e-posta ya da plaka ara', 'Ticket no, customer, email or plate')} busy={r.loading && !!dq} /></div>
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!d && !r.error && <div className="mt-6"><SkeletonRows rows={6} h={60} /></div>}
      {d && rows.length === 0 && (
        <div className="mt-6"><EmptyState icon="message" title={dq ? L(`“${dq}” ile eşleşen talep yok`, `No tickets match “${dq}”`) : view === 'open' ? L('Açık talep yok', 'No open tickets') : L('Bu durumda talep yok', 'No tickets here')} /></div>
      )}
      {d && rows.length > 0 && (
        <div className="mt-5">
          <TableWrap minWidth={900}>
            <thead><tr><Th>{L('Talep', 'Ticket')}</Th><Th>{L('Tür', 'Type')}</Th><Th>{L('Durum', 'Status')}</Th><Th>{L('Sorumlu', 'Assignee')}</Th><Th>{L('Hedef süre', 'Target')}</Th><Th right>{L('Son hareket', 'Last activity')}</Th></tr></thead>
            <tbody>
              {rows.map((t) => {
                const s = slaText(t.sla, lang);
                return (
                  <tr key={t.id} tabIndex={0} onClick={() => onOpen(t.id, t.no)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t.id, t.no); }} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)] focus:outline-none focus-visible:bg-[var(--a-hover)]">
                    <Td className="py-3.5">
                      <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--a-faint)', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
                        {t.no}{t.unreadForStaff && <i className="w-[7px] h-[7px] rounded-full" title={L('Okunmamış müşteri mesajı', 'Unread customer message')} style={{ background: 'var(--a-accent)' }} />}
                        {t.priority !== 'normal' && <span className="text-[11px]" style={{ color: t.priority === 'urgent' ? 'var(--a-danger)' : 'var(--tk-amber)', fontFamily: 'inherit' }}>{t.priority === 'urgent' ? L('ACİL', 'URGENT') : L('YÜKSEK', 'HIGH')}</span>}
                      </div>
                      <div className={`text-[13.5px] mt-0.5 truncate max-w-[340px] ${t.unreadForStaff ? 'font-medium' : ''}`}>{t.title}</div>
                      <div className="text-[12px] mt-0.5 truncate max-w-[340px]" style={{ color: 'var(--a-faint)' }}>{[t.userName, t.userEmail].filter(Boolean).join(' · ')}</div>
                    </Td>
                    <Td><TypeTag t={t.type} lang={lang} /></Td>
                    <Td><StatusText s={t.status} lang={lang} /></Td>
                    <Td>{t.assignee ? <span className="inline-flex items-center gap-2.5 whitespace-nowrap"><Initials text={initials(t.assignee.name, t.assignee.email)} />{t.assignee.name}</span> : <span style={{ color: 'var(--a-faint)' }}>{L('Atanmadı', 'Unassigned')}</span>}</Td>
                    <Td>
                      <div className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap" style={{ color: TONE[s.tone] }}><i className="w-[7px] h-[7px] rounded-full" style={{ background: TONE[s.tone] }} />{s.text}</div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{s.sub}</div>
                    </Td>
                    <Td right muted><span className="whitespace-nowrap">{fmtAgo(t.lastActivityAt, lang)}</span><div className="text-[11.5px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{t.lastActor === 'customer' ? L('müşteri yazdı', 'customer wrote') : L('ekip yanıtladı', 'team replied')}</div></Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          {next && <div className="flex justify-center mt-6"><Btn disabled={more.loading} onClick={() => setBefore(next)}>{more.loading ? '…' : L('Daha eskileri göster', 'Show older')}</Btn></div>}
        </div>
      )}
    </>
  );
};

// =====================================================================
// GÖRSELLER
// =====================================================================

const Thumbs: React.FC<{ list: Attachment[]; onOpen: (a: Attachment) => void; lang: AdminLang }> = ({ list, onOpen, lang }) => (
  <div className="flex flex-wrap gap-2.5 mt-3.5">
    {list.map((a, i) => (
      <button key={a.id} type="button" onClick={() => onOpen(a)} aria-label={lang === 'tr' ? `Görsel ${i + 1}` : `Image ${i + 1}`} className="rounded-[9px] overflow-hidden focus:outline-none focus-visible:ring-2" style={{ border: '1px solid var(--a-line2)' }}>
        <img src={jpegUrl(a.thumb)} alt="" className="block w-[96px] h-[72px] object-cover" />
      </button>
    ))}
  </div>
);

const ImageViewer: React.FC<{ att: Attachment; lang: AdminLang; onClose: () => void }> = ({ att, lang, onClose }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const r = useRemote(() => staffFile(att.id), att.id);
  return (
    <Dialog title={L('Görsel', 'Image')} icon="message" width={900} onClose={onClose} footer={<Btn onClick={onClose}>{L('Kapat', 'Close')}</Btn>}>
      {r.error && <ErrorPanel error={r.error} lang={lang} onRetry={r.reload} />}
      {!r.data && !r.error && <img src={jpegUrl(att.thumb)} alt="" className="w-full rounded-lg opacity-60" style={{ filter: 'blur(2px)' }} />}
      {r.data && <img src={jpegUrl(r.data)} alt="" className="w-full rounded-lg" style={{ maxHeight: '70vh', objectFit: 'contain' }} />}
    </Dialog>
  );
};

// =====================================================================
// TALEP DETAYI
// =====================================================================

const TicketDetailView: React.FC<Props & { id: string; onBack: () => void; onOpenTemplates: () => void; toast: (t: string, k?: 'ok' | 'warn' | 'error') => void }> = (p) => {
  const { lang, id } = p;
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [version, setVersion] = useState(0);
  const r = useRemote(() => getTicket(id), `${id}|${version}`);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const reload = () => setVersion((v) => v + 1);
  const d = r.data;
  useEffect(() => { if (d) p.onCrumb(d.ticket.no); }, [d?.ticket.no]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <BackLink label={L('Talepler', 'Tickets')} onClick={p.onBack} />
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!d && !r.error && <div className="mt-6"><SkeletonRows rows={5} h={90} /></div>}
      {d && (
        <>
          <div className="mt-6">
            <div className="text-[12px]" style={{ color: 'var(--a-faint)', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{d.ticket.no}</div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mt-1.5">
              <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px] break-words">{d.ticket.title}</h1>
              <StatusText s={d.ticket.status} lang={lang} />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <TypeTag t={d.ticket.type} lang={lang} />
              <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px]" style={{ color: 'var(--a-muted)', background: 'var(--a-active)' }}>{topicLabel(d.ticket.topic, lang)}</span>
              <span className="text-[12.5px] ml-1" style={{ color: 'var(--a-faint)' }}>{fmtDay(d.ticket.createdAt, lang, true)} · {L('müşteri formu', 'customer form')}{d.ticket.reopenCount ? L(` · ${d.ticket.reopenCount} kez yeniden açıldı`, ` · reopened ${d.ticket.reopenCount}×`) : ''}</span>
            </div>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-6 mt-8 items-start">
            <div className="flex flex-col gap-3 min-w-0">
              {d.thread.map((m) => <ThreadEntry key={m.id} m={m} lang={lang} onOpen={setViewer} customerName={d.customer.name} />)}
              {d.can.reply
                ? <Composer key={version} d={d} lang={lang} onSent={(t) => { p.toast(t); reload(); }} onOpenTemplates={p.onOpenTemplates} />
                : <Note>{L('Yanıt yazma yetkiniz yok; talebi yalnızca görüntüleyebilirsiniz.', 'You can only view this ticket.')}</Note>}
            </div>
            <Sidebar d={d} {...p} onChanged={(t, k) => { p.toast(t, k); if (k !== 'error') reload(); }} />
          </div>
        </>
      )}
      {viewer && <ImageViewer att={viewer} lang={lang} onClose={() => setViewer(null)} />}
    </>
  );
};

const ThreadEntry: React.FC<{ m: ThreadItem; lang: AdminLang; onOpen: (a: Attachment) => void; customerName: string }> = ({ m, lang, onOpen, customerName }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (m.kind === 'event' || m.kind === 'staff_event') {
    const text = m.kind === 'staff_event'
      ? m.event === 'assigned' ? L(`${String(m.data?.to || '')} talebe sorumlu olarak atandı`, `Assigned to ${String(m.data?.to || '')}`)
        : m.event === 'priority' ? L(`Öncelik: ${m.data?.to === 'urgent' ? 'Acil' : m.data?.to === 'high' ? 'Yüksek' : 'Normal'}`, `Priority: ${String(m.data?.to)}`) : m.event || ''
      : eventLabel(m.event, lang);
    return <div className="text-center text-[12px] py-1.5" style={{ color: 'var(--a-faint)' }}>{text}{m.kind === 'staff_event' && m.authorName ? ` · ${m.authorName}` : ''} · {fmtDay(m.createdAt, lang, true)}</div>;
  }
  const note = m.kind === 'note';
  const customer = m.kind === 'customer';
  return (
    <article className="rounded-[14px] px-5 py-4" style={{
      background: note ? 'rgba(227,168,87,.07)' : customer ? 'var(--a-surface)' : 'var(--a-surface2)',
      border: `1px solid ${note ? 'rgba(227,168,87,.32)' : 'var(--a-line)'}`,
    }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          {note ? <span style={{ color: 'var(--tk-amber)' }}><Icon name="lock" size={14} /></span> : <Initials text={initials(m.authorName || (customer ? customerName : ''), '')} />}
          <b className="font-medium truncate">{m.authorName || (customer ? customerName : '')}</b>
          <span className="text-[12px] whitespace-nowrap" style={{ color: note ? 'var(--tk-amber)' : 'var(--a-faint)' }}>· {note ? L('iç not, müşteri görmez', 'internal note') : customer ? L('müşteri', 'customer') : L('destek ekibi', 'support')}</span>
        </div>
        <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--a-faint)' }}>{fmtDay(m.createdAt, lang, true)}</span>
      </div>
      {m.body && <div className="text-[13.5px] leading-relaxed mt-2.5 break-words" style={{ color: 'var(--a-text2)', whiteSpace: 'pre-wrap' }}>{m.body}</div>}
      {m.attachments.length > 0 && <Thumbs list={m.attachments} onOpen={onOpen} lang={lang} />}
    </article>
  );
};

type Pending = { key: string; img: PreparedImage; id: string | null; error: string | null };

/** Görsel seçme + küçültme + yükleme (müşteri formunda da aynı kurallar) */
export function useAttachments(lang: AdminLang, max = LIMITS.attachMax) {
  const [list, setList] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const add = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setErr(null);
    const room = max - list.length;
    const picked = [...files].slice(0, Math.max(0, room));
    if (files.length > room) setErr(L(`En fazla ${max} görsel eklenebilir.`, `Up to ${max} images.`));
    for (const f of picked) {
      setBusy((b) => b + 1);
      try {
        const img = await prepareImage(f);
        const key = `${Date.now()}-${Math.random()}`;
        setList((l) => [...l, { key, img, id: null, error: null }]);
        try {
          const id = await uploadImage(img);
          setList((l) => l.map((x) => (x.key === key ? { ...x, id } : x)));
        } catch (e) {
          setList((l) => l.map((x) => (x.key === key ? { ...x, error: errorText(e, lang) } : x)));
        }
      } catch (e) {
        setErr(e instanceof ImageError ? e.message : L('Görsel eklenemedi.', 'Could not add image.'));
      } finally { setBusy((b) => b - 1); }
    }
  };
  return {
    list, busy: busy > 0, err, add,
    remove: (key: string) => setList((l) => l.filter((x) => x.key !== key)),
    clear: () => { setList([]); setErr(null); },
    ids: list.filter((x) => x.id).map((x) => x.id!),
    ready: busy === 0 && list.every((x) => x.id && !x.error),
  };
}

const Composer: React.FC<{ d: TicketDetail; lang: AdminLang; onSent: (text: string) => void; onOpenTemplates: () => void }> = ({ d, lang, onSent, onOpenTemplates }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const closed = d.ticket.status === 'closed';
  const [mode, setMode] = useState<'reply' | 'note'>(closed ? 'note' : 'reply');
  const [body, setBody] = useState('');
  const [next, setNext] = useState<TicketStatus>(d.ticket.status === 'resolved' ? 'resolved' : 'waiting_customer');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const att = useAttachments(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const tpl = useRemote(() => listTemplates(), 'tpl');
  const firstName = (d.customer.name || '').split(' ')[0] || '';
  const text = body.trim();
  const canSend = !busy && att.ready && (text.length > 0 || att.ids.length > 0) && text.length <= LIMITS.replyMax;

  const send = async () => {
    if (!canSend) return;
    setBusy(true); setErr(null);
    try {
      await staffReply({ id: d.ticket.id, body: text, internal: mode === 'note', nextStatus: mode === 'reply' ? next : undefined, attachments: att.ids, templateId: templateId || undefined });
      setBody(''); att.clear(); setTemplateId(null);
      onSent(mode === 'note' ? L('İç not eklendi.', 'Note added.') : L('Yanıt müşteriye gönderildi.', 'Reply sent.'));
    } catch (e) { setErr(errorText(e, lang)); } finally { setBusy(false); }
  };
  const useTemplate = (t: Template) => { setBody((b) => (b.trim() ? `${b.trimEnd()}\n\n` : '') + t.body.replace(/\{ad\}/g, firstName || L('Değerli müşterimiz', 'customer'))); setTemplateId(t.id); };
  const field = { background: 'var(--a-field)', border: 'none', color: 'var(--a-text)' };
  return (
    <section className="rounded-[14px] mt-2 overflow-hidden" style={{ background: 'var(--a-surface2)', border: `1px solid ${mode === 'note' ? 'rgba(227,168,87,.4)' : 'var(--a-line2)'}` }}>
      <div className="flex items-center gap-1 px-3 pt-1" style={{ borderBottom: '1px solid var(--a-line)' }} role="tablist">
        {([['reply', L('Müşteriye yanıt', 'Reply to customer')], ['note', L('İç not', 'Internal note')]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} disabled={k === 'reply' && closed} onClick={() => setMode(k)}
            className="px-3 py-2.5 text-[13px] disabled:opacity-40" style={{ color: mode === k ? 'var(--a-text)' : 'var(--a-muted)', boxShadow: mode === k ? 'inset 0 -2px 0 var(--a-text)' : undefined }}>
            {k === 'note' && <span className="inline-block mr-1.5 align-[-2px]"><Icon name="lock" size={12} /></span>}{label}
          </button>
        ))}
        <div className="ml-auto">
          <select
            aria-label={L('Hazır yanıt ekle', 'Insert template')} value=""
            onChange={(e) => { const t = tpl.data?.templates.find((x) => x.id === e.target.value); if (t) useTemplate(t); else if (e.target.value === '__manage') onOpenTemplates(); }}
            className="h-8 px-2 rounded-md text-[12.5px] outline-none max-w-[190px]" style={{ background: 'transparent', color: 'var(--a-text2)' }}
          >
            <option value="">{L('Hazır yanıt ekle…', 'Insert template…')}</option>
            {(tpl.data?.templates || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            <option value="__manage">{L('Şablonları yönet', 'Manage templates')}</option>
          </select>
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, LIMITS.replyMax + 50))}
        rows={5}
        aria-label={mode === 'note' ? L('İç not', 'Internal note') : L('Yanıt', 'Reply')}
        placeholder={mode === 'note' ? L('Yalnızca ekibin göreceği notu yazın…', 'Note for the team only…') : L('Müşteriye yanıtınızı yazın…', 'Write your reply…')}
        className="w-full px-4 py-3 text-[13.5px] leading-relaxed outline-none resize-y box-border block" style={field}
      />
      {att.list.length > 0 && (
        <div className="flex flex-wrap gap-2.5 px-4 pb-3">
          {att.list.map((x) => (
            <span key={x.key} className="relative">
              <img src={x.img.previewUrl} alt="" className="block w-[72px] h-[56px] object-cover rounded-md" style={{ border: `1px solid ${x.error ? 'var(--a-danger)' : 'var(--a-line2)'}`, opacity: x.id ? 1 : 0.5 }} />
              <button type="button" onClick={() => att.remove(x.key)} aria-label={L('Görseli kaldır', 'Remove image')} className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--a-text)', color: 'var(--a-bg)' }}><Icon name="x" size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--a-line)' }}>
        <div className="flex items-center gap-3 sm:mr-auto">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { att.add(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={att.list.length >= LIMITS.attachMax} className="inline-flex items-center gap-1.5 text-[12.5px] disabled:opacity-40" style={{ color: 'var(--a-muted)' }}>
            <Icon name="plus" size={14} />{att.busy ? L('Görsel yükleniyor…', 'Uploading…') : L('Görsel ekle', 'Add image')}
          </button>
          <span className="text-[11.5px]" style={{ color: text.length > LIMITS.replyMax ? 'var(--a-danger)' : 'var(--a-faint)' }}>{text.length} / {LIMITS.replyMax}</span>
        </div>
        {mode === 'reply' && (
          <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
            {L('Gönderince durum:', 'Then set status:')}
            <select value={next} onChange={(e) => setNext(e.target.value as TicketStatus)} className="h-[32px] px-2 rounded-md text-[12.5px] outline-none" style={{ background: 'var(--a-field)', border: '1px solid var(--a-line2)', color: 'var(--a-text)' }}>
              <option value="in_review">{statusLabel('in_review', lang)}</option>
              <option value="waiting_customer">{L('Müşteriden bilgi bekleniyor', 'Waiting on customer')}</option>
              <option value="resolved">{statusLabel('resolved', lang)}</option>
            </select>
          </label>
        )}
        <Btn variant="primary" icon={mode === 'note' ? 'lock' : 'send'} disabled={!canSend} onClick={send}>{busy ? L('Gönderiliyor…', 'Sending…') : mode === 'note' ? L('Notu ekle', 'Add note') : L('Gönder', 'Send')}</Btn>
      </div>
      {(err || att.err || att.list.some((x) => x.error)) && (
        <p role="alert" className="m-0 px-4 pb-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err || att.err || att.list.find((x) => x.error)?.error}</p>
      )}
    </section>
  );
};

const Sidebar: React.FC<Props & { d: TicketDetail; onChanged: (text: string, kind?: 'ok' | 'error') => void }> = ({ d, lang, onChanged, onOpenUser, onOpenVehicle }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const t = d.ticket;
  const staff = useRemote(() => (d.can.manage ? ticketStaff() : Promise.resolve({ staff: [] })), `staff|${d.can.manage}`);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const run = async (patch: { status?: TicketStatus; assigneeEmail?: string | null; priority?: Priority }, text: string) => {
    setBusy(true);
    try { const r = await updateTicket({ id: t.id, ...patch }); if (r.changed) onChanged(text); } catch (e) { onChanged(errorText(e, lang), 'error'); } finally { setBusy(false); }
  };
  const sel = 'w-full h-10 px-3 rounded-lg text-[13.5px] outline-none box-border';
  const selStyle = { background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' };
  const first = t.firstResponseAt && t.createdAt ? t.firstResponseAt - t.createdAt : null;
  const sla = slaText(t.sla, lang);
  const closed = t.status === 'closed';
  const label = (s: string) => <div className="text-[12px] mb-1.5 mt-4 first:mt-0" style={{ color: 'var(--a-faint)' }}>{s}</div>;
  return (
    <div className="flex flex-col gap-4">
      <Card title={L('Durum ve atama', 'Status & assignment')}>
        {d.can.manage ? (
          <div>
            {label(L('Durum', 'Status'))}
            <select aria-label={L('Durum', 'Status')} disabled={busy || closed} value={t.status} className={sel} style={selStyle}
              onChange={(e) => { const s = e.target.value as TicketStatus; if (s === 'closed') setConfirmClose(true); else run({ status: s }, L(`Durum: ${statusLabel(s, lang)}`, 'Status changed')); }}>
              {t.status === 'new' && <option value="new">{statusLabel('new', lang)}</option>}
              {(['in_review', 'waiting_customer', 'resolved', 'closed'] as TicketStatus[]).map((s) => <option key={s} value={s}>{statusLabel(s, lang)}</option>)}
            </select>
            {label(L('Sorumlu', 'Assignee'))}
            <select aria-label={L('Sorumlu', 'Assignee')} disabled={busy || closed} value={t.assignee?.email || ''} className={sel} style={selStyle}
              onChange={(e) => run({ assigneeEmail: e.target.value || null }, e.target.value ? L('Sorumlu değiştirildi.', 'Assignee changed.') : L('Sorumlu kaldırıldı.', 'Unassigned.'))}>
              <option value="">{L('Atanmadı', 'Unassigned')}</option>
              {t.assignee && !(staff.data?.staff || []).some((s) => s.email === t.assignee!.email) && <option value={t.assignee.email}>{t.assignee.name}</option>}
              {(staff.data?.staff || []).map((s) => <option key={s.email} value={s.email}>{s.name}{s.superAdmin ? L(' · süper yönetici', ' · super admin') : ''}</option>)}
            </select>
            {label(L('Öncelik', 'Priority'))}
            <select aria-label={L('Öncelik', 'Priority')} disabled={busy || closed} value={t.priority} className={sel} style={selStyle}
              onChange={(e) => run({ priority: e.target.value as Priority }, L('Öncelik değiştirildi.', 'Priority changed.'))}>
              <option value="normal">Normal</option><option value="high">{L('Yüksek', 'High')}</option><option value="urgent">{L('Acil', 'Urgent')}</option>
            </select>
          </div>
        ) : (
          <div>
            <InfoRow first label={L('Durum', 'Status')}><StatusText s={t.status} lang={lang} /></InfoRow>
            <InfoRow label={L('Sorumlu', 'Assignee')}>{t.assignee?.name || L('Atanmadı', 'Unassigned')}</InfoRow>
            <InfoRow label={L('Öncelik', 'Priority')}>{t.priority === 'urgent' ? L('Acil', 'Urgent') : t.priority === 'high' ? L('Yüksek', 'High') : 'Normal'}</InfoRow>
          </div>
        )}
      </Card>
      <Card title={L('Hedef süreler', 'Targets')}>
        <InfoRow first label={L('İlk yanıt', 'First reply')}>
          {first !== null ? <span className="inline-flex items-center gap-1.5" style={{ color: first <= 24 * 3600e3 ? 'var(--a-success)' : 'var(--tk-amber)' }}><Icon name="check" size={13} />{L(`${durationText(first, lang)} içinde verildi`, `in ${durationText(first, lang)}`)}</span>
            : <span style={{ color: TONE[sla.tone] }}>{sla.text}</span>}
        </InfoRow>
        <InfoRow label={L('Çözüm', 'Resolution')}><span style={{ color: TONE[t.sla.kind === 'first' ? 'muted' : sla.tone] }}>{t.sla.kind === 'first' ? L('İlk yanıttan sonra', 'After first reply') : sla.text}</span></InfoRow>
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>{L('İlk yanıt 24 saat, çözüm 3 gün içinde. Müşteriden bilgi beklenirken süre durur.', 'First reply in 24 h, resolution in 3 days. Paused while waiting on the customer.')}</p>
      </Card>
      <Card title={L('Müşteri', 'Customer')}>
        <div className="flex items-center gap-3"><Initials text={initials(d.customer.name, d.customer.email)} /><div className="min-w-0"><div className="truncate">{d.customer.name || '—'}</div><div className="text-[12px] truncate" style={{ color: 'var(--a-faint)' }}>{d.customer.email || d.customer.emailMasked}</div></div></div>
        <div className="mt-2">
          <InfoRow first label={L('Telefon', 'Phone')}>{d.customer.phoneMasked || '—'}</InfoRow>
          <InfoRow label={L('Talepleri', 'Tickets')}>{d.customer.ticketCount}</InfoRow>
          <InfoRow label={L('Üyelik', 'Member since')}>{fmtDay(d.customer.createdAt, lang)}</InfoRow>
        </div>
        {d.customer.deleted ? <Note>{L('Müşteri kaydı bulunamadı.', 'Customer record not found.')}</Note>
          : canSee('users') && <button type="button" onClick={() => onOpenUser(d.customer.uid, d.customer.name || d.customer.email)} className="text-[12.5px] underline underline-offset-4 mt-1" style={{ color: 'var(--a-text2)', textDecorationColor: 'var(--a-line3)' }}>{L('Kullanıcıya git', 'Open customer')}</button>}
      </Card>
      {(t.plate || d.tag) && (
        <Card title={L('İlgili araç ve QR', 'Vehicle & QR')}>
          {t.plate && <div className="flex items-center gap-3 flex-wrap"><Plate plate={t.plate} /><span className="text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{t.brandModel || ''}</span></div>}
          <div className="mt-2">
            {(d.tag?.serial || t.serial) && <InfoRow first label="QR"><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12 }}>{d.tag?.serial || t.serial}</span></InfoRow>}
            {d.tag && <InfoRow label={L('Durum', 'State')}>{d.tag.status === 'active' ? L('QR Bankası · etkin', 'Active') : d.tag.status === 'disabled' ? L('Devre dışı', 'Disabled') : d.tag.status || '—'}</InfoRow>}
            {d.tag && <InfoRow label={L('Son okutma', 'Last scan')}>{fmtAgo(d.tag.lastScanAt, lang)}</InfoRow>}
          </div>
          {t.vehicleId && canSee('vehicles') && <button type="button" onClick={() => onOpenVehicle(t.vehicleId!, t.plate || '')} className="text-[12.5px] underline underline-offset-4 mt-1" style={{ color: 'var(--a-text2)', textDecorationColor: 'var(--a-line3)' }}>{L('Araca git', 'Open vehicle')}</button>}
        </Card>
      )}
      {t.ratingDetail && (
        <Card title={L('Müşteri değerlendirmesi', 'Customer rating')}>
          <div className="text-[20px]" aria-label={`${t.ratingDetail.score} / 5`}>{'★★★★★'.split('').map((s, i) => <span key={i} style={{ color: i < t.ratingDetail!.score ? '#F5B301' : 'var(--a-line3)' }}>{s}</span>)}</div>
          {t.ratingDetail.comment && <p className="m-0 mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--a-text2)' }}>“{t.ratingDetail.comment}”</p>}
        </Card>
      )}
      {confirmClose && (
        <ConfirmDialog title={L('Talep kapatılsın mı?', 'Close ticket?')} icon="lock" confirmLabel={L('Talebi kapat', 'Close ticket')} cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirmClose(false)} onConfirm={async () => { await run({ status: 'closed' }, L('Talep kapatıldı.', 'Ticket closed.')); setConfirmClose(false); }}>
          <p className="m-0">{L('Kapatılan talebe müşteri yanıt veremez ve talep yeniden açılamaz; müşteri gerekirse yeni talep oluşturur. Çözüldü olarak işaretlerseniz müşteri değerlendirebilir ve 3 gün sonra talep kendiliğinden kapanır.', 'Closed tickets cannot be reopened.')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

// =====================================================================
// KÖTÜYE KULLANIM
// =====================================================================

const AbuseList: React.FC<{ lang: AdminLang; toast: (t: string, k?: 'ok' | 'warn' | 'error') => void }> = ({ lang, toast }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const access = useAccess();
  const [status, setStatus] = useState<'new' | 'reviewed'>('new');
  const [version, setVersion] = useState(0);
  const r = useRemote(() => listAbuse(status), `${status}|${version}`);
  const [confirm, setConfirm] = useState<AbuseReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const canDisable = access.superAdmin || has('act.disable');
  const canReview = access.superAdmin || has('act.ticket_manage');
  const review = async (x: AbuseReport) => {
    setBusy(x.id);
    try { await reviewAbuse(x.id); toast(L('İncelendi olarak işaretlendi.', 'Marked as reviewed.')); setVersion((v) => v + 1); } catch (e) { toast(errorText(e, lang), 'error'); } finally { setBusy(null); }
  };
  return (
    <>
      <div className="mt-7 flex flex-wrap gap-1">
        <FilterChip on={status === 'new'} onClick={() => setStatus('new')} count={r.data?.counts.new}>{L('Yeni', 'New')}</FilterChip>
        <FilterChip on={status === 'reviewed'} onClick={() => setStatus('reviewed')} count={r.data?.counts.reviewed}>{L('İncelendi', 'Reviewed')}</FilterChip>
      </div>
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!r.data && !r.error && <div className="mt-6"><SkeletonRows rows={3} h={110} /></div>}
      {r.data && r.data.reports.length === 0 && <div className="mt-6"><EmptyState icon="shield" title={status === 'new' ? L('Bekleyen bildirim yok', 'No pending reports') : L('İncelenmiş bildirim yok', 'Nothing reviewed yet')} /></div>}
      <div className="flex flex-col gap-3 mt-5">
        {(r.data?.reports || []).map((x) => (
          <article key={x.id} className="rounded-[14px] p-5 flex flex-col md:flex-row gap-4 md:items-start" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)' }}>
            <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: x.status === 'new' ? 'var(--a-danger-tint)' : 'var(--a-active)', color: x.status === 'new' ? 'var(--a-danger)' : 'var(--a-muted)' }}><Icon name="alert" size={17} /></span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 items-center">
                {x.sameCode7d > 1 && <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px]" style={{ color: 'var(--tk-amber)', background: 'rgba(227,168,87,.12)' }}>{L(`Bu QR için ${x.sameCode7d} bildirim · son 7 gün`, `${x.sameCode7d} reports for this QR · 7 days`)}</span>}
                {x.status === 'reviewed' && <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px]" style={{ color: x.action === 'disabled' ? 'var(--a-danger)' : 'var(--a-muted)', background: 'var(--a-active)' }}>{x.action === 'disabled' ? L('QR kapatıldı', 'QR disabled') : L('İncelendi', 'Reviewed')}{x.reviewedByName ? ` · ${x.reviewedByName}` : ''}</span>}
              </div>
              <div className="text-[14.5px] mt-2">{x.reasonText}</div>
              <div className="text-[12.5px] mt-1 break-words" style={{ color: 'var(--a-faint)' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{x.serial || x.code}</span>{x.plate ? ` · ${x.plate}` : ''}{x.ownerName ? L(` · sahibi ${x.ownerName}`, ` · owner ${x.ownerName}`) : ''} · {fmtAgo(x.createdAt, lang)}
              </div>
              {x.note && <div className="text-[13px] mt-2 break-words" style={{ color: 'var(--a-text2)' }}>{L('Açıklama', 'Note')}: “{x.note}”</div>}
              <div className="text-[12px] mt-1.5" style={{ color: 'var(--a-faint)' }}>{L('Bildiren: ziyaretçi · kimlik istenmedi', 'Reported by a visitor')}</div>
            </div>
            {x.status === 'new' && (canDisable || canReview) && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {canDisable && <Btn variant="danger" disabled={busy === x.id} onClick={() => setConfirm(x)}>{L('QR\'ı devre dışı bırak', 'Disable QR')}</Btn>}
                {canReview && <Btn disabled={busy === x.id} onClick={() => review(x)}>{L('İncelendi', 'Reviewed')}</Btn>}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mt-8">
        <Note>{L('QR sayfasını okutan herkes giriş yapmadan bildirim gönderebilir; kimlik istenmez, IP adresi açık olarak saklanmaz, aynı kişiden aynı QR için günde bir bildirim kabul edilir. Devre dışı bırakma QR Bankası\'ndaki yetkiyle yapılır; QR Devre Dışı sayfasına "Kötüye kullanım bildirimi" notuyla düşer ve gerekirse oradan yeniden açılabilir.', 'Visitors can report without signing in. Disabling uses the QR Bank permission.')}</Note>
      </div>
      {confirm && (
        <ConfirmDialog title={L('QR devre dışı bırakılsın mı?', 'Disable this QR?')} icon="ban" danger confirmLabel={L('Devre dışı bırak', 'Disable')} cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try { await disableFromAbuse(confirm.id); toast(L('QR devre dışı bırakıldı; bu QR\'ın bekleyen bildirimleri de kapatıldı.', 'QR disabled.')); setVersion((v) => v + 1); } catch (e) { toast(errorText(e, lang), 'error'); }
            setConfirm(null);
          }}>
          <p className="m-0"><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>{confirm.serial || confirm.code}</span>{confirm.plate ? ` · ${confirm.plate}` : ''}</p>
          <p className="m-0 mt-2">{L('QR okutulduğunda "kullanıma kapalı" görünür; araç sahibi bildirim alamaz. Devre Dışı sayfasından yeniden açılabilir.', 'Scanning will show it as disabled.')}</p>
        </ConfirmDialog>
      )}
    </>
  );
};

// =====================================================================
// HAZIR YANITLAR
// =====================================================================

const TemplatesDialog: React.FC<{ lang: AdminLang; onClose: () => void; toast: (t: string, k?: 'ok' | 'warn' | 'error') => void }> = ({ lang, onClose, toast }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const access = useAccess();
  const canManage = access.superAdmin || has('act.ticket_manage');
  const [version, setVersion] = useState(0);
  const r = useRemote(() => listTemplates(), `tpl|${version}`);
  const [edit, setEdit] = useState<{ id?: string; title: string; body: string } | null>(null);
  const [del, setDel] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = { background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' };
  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr(null);
    try { await saveTemplate(edit); toast(edit.id ? L('Şablon güncellendi.', 'Template saved.') : L('Şablon eklendi.', 'Template added.')); setEdit(null); setVersion((v) => v + 1); } catch (e) { setErr(errorText(e, lang)); } finally { setBusy(false); }
  };
  const list = useMemo(() => r.data?.templates || [], [r.data]);
  return (
    <Dialog title={L('Hazır yanıtlar', 'Reply templates')} icon="layers" width={640} onClose={() => { if (!busy) onClose(); }}
      footer={edit ? (
        <>
          <button type="button" onClick={() => { setEdit(null); setErr(null); }} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <Btn variant="primary" disabled={busy || edit.title.trim().length < 2 || edit.body.trim().length < 5} onClick={save}>{busy ? '…' : L('Kaydet', 'Save')}</Btn>
        </>
      ) : <Btn onClick={onClose}>{L('Kapat', 'Close')}</Btn>}
    >
      {!edit && (
        <>
          <div className="flex items-start justify-between gap-4">
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>{L('Sık gelen talepler için yanıt şablonları. Yanıt yazarken "Hazır yanıt ekle" ile seçilir; {ad} müşterinin adıyla dolar, göndermeden önce düzenlenebilir.', 'Templates for common replies. {ad} is replaced with the customer\'s first name.')}</p>
            {canManage && <Btn small icon="plus" onClick={() => setEdit({ title: '', body: '' })}>{L('Yeni şablon', 'New')}</Btn>}
          </div>
          {r.error && <div className="mt-4"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
          {!r.data && !r.error && <div className="mt-4"><SkeletonRows rows={3} h={60} /></div>}
          {r.data && list.length === 0 && <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Henüz şablon yok.', 'No templates yet.')}</p>}
          <div className="mt-3">
            {list.map((t, i) => (
              <div key={t.id} className="py-4" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                <div className="flex justify-between gap-3"><span className="text-[13.5px]" style={{ color: 'var(--a-text)' }}>{t.title}</span>
                  {canManage && <span className="flex gap-3 text-[12.5px]"><button type="button" onClick={() => setEdit({ id: t.id, title: t.title, body: t.body })} style={{ color: 'var(--a-text2)' }}>{L('Düzenle', 'Edit')}</button><button type="button" onClick={() => setDel(t)} style={{ color: 'var(--a-danger)' }}>{L('Sil', 'Delete')}</button></span>}
                </div>
                <div className="text-[12.5px] leading-relaxed mt-1.5 break-words" style={{ color: 'var(--a-muted)', whiteSpace: 'pre-wrap' }}>{t.body}</div>
                <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--a-faint)' }}>{[t.updatedByName, L(`${t.uses} kez kullanıldı`, `used ${t.uses}×`)].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {edit && (
        <div>
          <label className="block text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{L('Şablon adı', 'Name')}
            <input value={edit.title} maxLength={60} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="mt-1.5 w-full h-10 px-3 rounded-lg text-[14px] outline-none box-border" style={field} />
          </label>
          <label className="block text-[12.5px] mt-4" style={{ color: 'var(--a-muted)' }}>{L('Metin', 'Text')} <span style={{ color: 'var(--a-faint)' }}>{`{ad}`} {L('müşterinin adıyla dolar', 'is replaced with the first name')}</span>
            <textarea value={edit.body} maxLength={1500} rows={6} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-lg text-[13.5px] leading-relaxed outline-none resize-y box-border" style={field} />
          </label>
          {err && <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
        </div>
      )}
      {del && (
        <ConfirmDialog title={L(`"${del.title}" silinsin mi?`, `Delete "${del.title}"?`)} icon="trash" danger confirmLabel={L('Sil', 'Delete')} cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setDel(null)} onConfirm={async () => { try { await deleteTemplate(del.id); toast(L('Şablon silindi.', 'Template deleted.')); setVersion((v) => v + 1); } catch (e) { toast(errorText(e, lang), 'error'); } setDel(null); }}>
          <p className="m-0">{L('Bu işlem geri alınamaz.', 'This cannot be undone.')}</p>
        </ConfirmDialog>
      )}
    </Dialog>
  );
};

// Müşteri: Destek Talepleri — taleplerim, yeni talep, yazışma, değerlendirme.
// Onaylanan tasarım (9c): açık tema, müşteri mavisi, kartlar, hap sekmeler, mesaj balonları, resmi dil.
// Alttan açılan pencere kullanılmaz; görsel tam ekran ortada açılır.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ImagePlus, Info, Loader2, Plus, Send, Star, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { functionErrorMessage } from '../lib/functionsClient';
import { ImageError, jpegUrl, prepareImage, type PreparedImage } from '../lib/imageCompress';
import { listenMyVehicles } from '../lib/vehicleService';
import type { Vehicle } from '../types/vehicle';
import {
  LIMITS, OPEN_STATUSES, TOPICS, TYPES, createTicket, eventLabel, getMyFile, listenMessages, listenMyTickets, listenTicket,
  markTicketRead, rateTicket, reopenTicket, replyTicket, statusLabel, typeLabel, uploadImage,
  type Attachment, type CustomerMessage, type CustomerTicket, type TicketType,
} from '../lib/ticketService';

const P = 'var(--c-p, #14798D)';
const PD = 'var(--c-pt, #0E6476)';
const TINT = 'var(--c-tint, #E8F3F5)';
const LINE = 'var(--c-ln, #E2E8F0)';
const FIELD_LINE = 'var(--c-ln2, #CBD5E1)';
const STAR = '#F5B301';
const OPEN_MAX = 5;
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

type Lang = 'tr' | 'en';
type Screen = { kind: 'list' } | { kind: 'new' } | { kind: 'thread'; id: string };

interface Props {
  user: User;
  lang: Lang;
  /** Bildirimden / bağlantıdan gelinince açılacak talep */
  initialTicketId?: string | null;
  onOpenPrivacy: () => void;
  /** Müşteri sitesinin kabuğu içinde (zemin ve kenar boşluğu kabuktan gelir) */
  embedded?: boolean;
}

// ------------------------------------------------------------------ yardımcılar

const STATUS_LOOK: Record<string, { c: string; bg: string }> = {
  new: { c: 'var(--c-mu, #334155)', bg: 'var(--c-sub, #EEF2F6)' },
  in_review: { c: 'var(--c-mu, #334155)', bg: 'var(--c-sub, #EEF2F6)' },
  waiting_customer: { c: PD, bg: 'var(--c-tint, #DDEFF2)' },
  resolved: { c: 'var(--c-ok, #15803D)', bg: 'var(--c-okb, #E3F4E8)' },
  closed: { c: 'var(--c-fn, #64748B)', bg: 'var(--c-sub, #F1F5F9)' },
};

const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
function when(ms: number | null, lang: Lang, timeOnlyToday = false): string {
  if (!ms) return '';
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const time = new Date(ms).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const diff = Math.round((dayStart(Date.now()) - dayStart(ms)) / 86400e3);
  if (diff <= 0) return timeOnlyToday ? time : `${lang === 'tr' ? 'Bugün' : 'Today'} ${time}`;
  if (diff === 1) return `${lang === 'tr' ? 'Dün' : 'Yesterday'} ${time}`;
  const sameYear = new Date(ms).getFullYear() === new Date().getFullYear();
  return new Date(ms).toLocaleDateString(loc, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) }) + (diff < 7 ? ` ${time}` : '');
}
/** "2 gün 4 saatte", "5 saatte", "3 günde", "40 dakikada" */
function tookText(ms: number, lang: Lang): string {
  const m = Math.max(1, Math.round(ms / 60000));
  const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60);
  if (lang !== 'tr') return d ? `${d} d${h ? ` ${h} h` : ''}` : h ? `${h} h` : `${m} min`;
  if (d && h) return `${d} gün ${h} saatte`;
  if (d) return `${d} günde`;
  if (h) return `${h} saatte`;
  return `${m} dakikada`;
}
const fmtNo = (no: string) => no || '—';

const StatusPill: React.FC<{ s: string; lang: Lang }> = ({ s, lang }) => {
  const look = STATUS_LOOK[s] || STATUS_LOOK.new;
  return <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap" style={{ color: look.c, background: look.bg }}>{statusLabel(s, lang, 'customer')}</span>;
};
const Stars: React.FC<{ n: number; size?: number }> = ({ n, size = 13 }) => (
  <span className="inline-flex gap-[2px] align-[-2px]" aria-label={`${n} / 5`}>
    {[0, 1, 2, 3, 4].map((i) => <Star key={i} width={size} height={size} fill={i < n ? STAR : '#CBD5E1'} stroke="none" />)}
  </span>
);
const Card: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`bg-[var(--c-sf,#fff)] rounded-2xl p-4 ${className}`} style={{ border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(15,23,42,.04)', ...style }}>{children}</div>
);
const Label: React.FC<{ children: React.ReactNode; htmlFor?: string; right?: React.ReactNode }> = ({ children, htmlFor, right }) => (
  <label htmlFor={htmlFor} className="flex justify-between text-[12.5px] font-semibold mt-4 mb-[7px]" style={{ color: 'var(--c-mu, #334155)' }}>
    <span>{children}</span>{right && <span className="font-normal" style={{ color: 'var(--c-fn, #64748B)' }}>{right}</span>}
  </label>
);
const PrimaryBtn: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; type?: 'button' | 'submit' }> = ({ children, onClick, disabled, busy, type = 'button' }) => (
  <button type={type} onClick={onClick} disabled={disabled || busy} className="w-full h-12 rounded-[14px] text-white text-[14px] font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-45" style={{ background: P }}>
    {busy && <Loader2 className="w-4 h-4 animate-spin" />}{children}
  </button>
);
const fieldCls = 'w-full bg-[var(--c-sf,#fff)] rounded-xl px-3.5 py-3 text-[14px] outline-none box-border focus:border-[#14798D]';
const fieldStyle: React.CSSProperties = { border: `1px solid ${FIELD_LINE}`, color: 'var(--c-tx, #0F172A)' };

// ------------------------------------------------------------------ görsel ekleme

type Pending = { key: string; img: PreparedImage; id: string | null; error: string | null };
function useImages(lang: Lang, max = LIMITS.attachMax) {
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
          setList((l) => l.map((x) => (x.key === key ? { ...x, error: functionErrorMessage(e, L('Görsel yüklenemedi.', 'Upload failed.')) } : x)));
        }
      } catch (e) {
        setErr(e instanceof ImageError ? e.message : L('Görsel eklenemedi.', 'Could not add image.'));
      } finally { setBusy((b) => b - 1); }
    }
  };
  const failed = list.find((x) => x.error);
  return {
    list, busy: busy > 0, add,
    err: err || (failed ? failed.error : null),
    remove: (key: string) => setList((l) => l.filter((x) => x.key !== key)),
    clear: () => { setList([]); setErr(null); },
    ids: list.filter((x) => x.id).map((x) => x.id!),
    ready: busy === 0 && list.every((x) => x.id && !x.error),
  };
}

const ImageViewer: React.FC<{ att: Attachment; lang: Lang; onClose: () => void }> = ({ att, lang, onClose }) => {
  const [data, setData] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    getMyFile(att.id).then((d) => { if (live) { if (d) setData(d); else setFailed(true); } }).catch(() => { if (live) setFailed(true); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { live = false; window.removeEventListener('keydown', onKey); };
  }, [att.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div role="dialog" aria-modal="true" aria-label={lang === 'tr' ? 'Görsel' : 'Image'} className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,.88)' }} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label={lang === 'tr' ? 'Kapat' : 'Close'} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"><X className="w-5 h-5" /></button>
      <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full flex items-center justify-center">
        {failed ? <p className="text-white/80 text-sm">{lang === 'tr' ? 'Görsel görüntülenemedi.' : 'Image could not be loaded.'}</p>
          : <img src={jpegUrl(data || att.thumb)} alt="" className="max-w-full rounded-lg" style={{ maxHeight: '85vh', filter: data ? undefined : 'blur(3px)', opacity: data ? 1 : 0.7 }} />}
      </div>
    </div>
  );
};

const PendingThumbs: React.FC<{ imgs: ReturnType<typeof useImages>; size: number; lang: Lang }> = ({ imgs, size, lang }) => (
  <>
    {imgs.list.map((x) => (
      <span key={x.key} className="relative block shrink-0">
        <img src={x.img.previewUrl} alt="" className="block object-cover rounded-[10px]" style={{ width: size, height: size, border: `1px solid ${x.error ? 'var(--c-dg, #B42318)' : LINE}`, opacity: x.id ? 1 : 0.55 }} />
        {!x.id && !x.error && <Loader2 className="absolute inset-0 m-auto w-5 h-5 animate-spin" style={{ color: P }} />}
        <button type="button" onClick={() => imgs.remove(x.key)} aria-label={lang === 'tr' ? 'Görseli kaldır' : 'Remove image'}
          className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-white" style={{ background: 'var(--c-tx, #0F172A)', border: '2px solid var(--c-sf, #fff)' }}>
          <X className="w-[11px] h-[11px]" />
        </button>
      </span>
    ))}
  </>
);

// ------------------------------------------------------------------ ana bileşen

export const SupportView: React.FC<Props> = ({ user, lang, initialTicketId, onOpenPrivacy, embedded }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [screen, setScreen] = useState<Screen>(initialTicketId ? { kind: 'thread', id: initialTicketId } : { kind: 'list' });
  const [tickets, setTickets] = useState<CustomerTicket[] | null>(null);
  const [listError, setListError] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const pushed = useRef(false);

  useEffect(() => listenMyTickets(user.uid, (l) => { setTickets(l); setListError(false); }, (e) => { console.error('[tickets]', e); setListError(true); }), [user.uid]);

  // Adres çubuğu: talep açıkken ?view=support&ticket=…; geri tuşu listeye döner.
  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      pushed.current = false;
      if (q.get('view') !== 'support') return;
      const id = q.get('ticket');
      setScreen(id ? { kind: 'thread', id } : { kind: 'list' });
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (new URLSearchParams(window.location.search).get('view') === 'support') window.history.replaceState(null, '', window.location.pathname);
    };
  }, []);
  useEffect(() => {
    const want = screen.kind === 'thread' ? `?view=support&ticket=${encodeURIComponent(screen.id)}` : '?view=support';
    if (window.location.search !== want) {
      if (screen.kind === 'thread' && new URLSearchParams(window.location.search).get('ticket') !== screen.id) { window.history.pushState(null, '', `${window.location.pathname}${want}`); pushed.current = true; }
      else window.history.replaceState(null, '', `${window.location.pathname}${want}`);
    }
    window.scrollTo(0, 0);
  }, [screen]);

  const openCount = (tickets || []).filter((t) => OPEN_STATUSES.includes(t.status)).length;
  // Talebe sayfa içinden gelindiyse tarayıcı geçmişinde geri gidilir (telefonun geri tuşuyla aynı sonuç)
  const goList = () => {
    if (pushed.current) { pushed.current = false; window.history.back(); } else setScreen({ kind: 'list' });
  };

  return (
    <div className={embedded ? 'w-full' : 'min-h-[calc(100vh-64px)] w-full'} style={embedded ? { color: 'var(--c-tx)' } : { background: '#F4F6F8', color: 'var(--c-tx, #0F172A)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      <div className={embedded ? 'max-w-[560px] mx-auto' : 'max-w-[560px] mx-auto px-4 pt-5 pb-10'}>
        {screen.kind !== 'thread' && (
          <>
            <h1 className={embedded ? 'm-0 text-[24px] lg:text-[28px] font-bold tracking-[-0.4px]' : 'm-0 text-[19px] font-bold'}>{L('Destek Talepleri', 'Support requests')}</h1>
            <p className="text-[13px] mt-1.5 mb-[18px] leading-[1.55]" style={{ color: 'var(--c-mu, #475569)' }}>
              {L('Talep, öneri ve şikayetlerinizi bu sayfadan iletebilirsiniz. Talepleriniz en geç 24 saat içinde yanıtlanır.', 'You can send your requests, suggestions and complaints here. We reply within 24 hours.')}
            </p>
            <div role="tablist" className="flex p-1 rounded-full bg-[var(--c-sf,#fff)]" style={{ border: `1px solid ${LINE}` }}>
              {([['list', L(`Taleplerim${tickets ? ` (${tickets.length})` : ''}`, `My requests${tickets ? ` (${tickets.length})` : ''}`)], ['new', L('Yeni Talep', 'New request')]] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={screen.kind === k} onClick={() => setScreen({ kind: k })}
                  className="flex-1 text-center py-[9px] rounded-full text-[12.5px] font-semibold transition-colors"
                  style={screen.kind === k ? { background: P, color: '#fff' } : { color: 'var(--c-mu, #475569)' }}>{label}</button>
              ))}
            </div>
          </>
        )}

        {screen.kind === 'list' && (
          <TicketList lang={lang} tickets={tickets} error={listError} onOpen={(id) => setScreen({ kind: 'thread', id })} onNew={() => setScreen({ kind: 'new' })} />
        )}
        {screen.kind === 'new' && (
          <NewTicket
            lang={lang} uid={user.uid} openCount={openCount} onOpenPrivacy={onOpenPrivacy}
            onCreated={(id, no) => { setJustCreated(no); setScreen({ kind: 'thread', id }); }}
          />
        )}
        {screen.kind === 'thread' && (
          <Thread key={screen.id} id={screen.id} lang={lang} justCreated={justCreated} onDismissCreated={() => setJustCreated(null)} onBack={goList} />
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ taleplerim

const TicketList: React.FC<{ lang: Lang; tickets: CustomerTicket[] | null; error: boolean; onOpen: (id: string) => void; onNew: () => void }> = ({ lang, tickets, error, onOpen, onNew }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (error) return <Card className="mt-4 text-center text-[13px]" style={{ color: 'var(--c-mu, #475569)' }}>{L('Talepleriniz şu anda görüntülenemiyor. Lütfen daha sonra tekrar deneyiniz.', 'Your requests cannot be shown right now.')}</Card>;
  if (!tickets) return <div className="mt-4 flex flex-col gap-3">{[0, 1].map((i) => <div key={i} className="h-[112px] rounded-2xl bg-[var(--c-sf,#fff)] animate-pulse" style={{ border: `1px solid ${LINE}` }} />)}</div>;
  return (
    <>
      {tickets.length === 0 && (
        <Card className="mt-4 text-center py-8">
          <div className="text-[15px] font-bold">{L('Henüz bir talebiniz bulunmamaktadır.', 'You have no requests yet.')}</div>
          <p className="text-[13px] mt-1.5 mb-5 leading-[1.55]" style={{ color: 'var(--c-mu, #475569)' }}>{L('Yaşadığınız sorunu veya önerinizi iletmek için yeni bir talep oluşturabilirsiniz.', 'Create a new request to tell us about an issue or suggestion.')}</p>
          <div className="max-w-[240px] mx-auto"><PrimaryBtn onClick={onNew}><Plus className="w-4 h-4" />{L('Yeni Talep Oluştur', 'New request')}</PrimaryBtn></div>
        </Card>
      )}
      {tickets.map((t) => {
        const hl = t.unreadForCustomer;
        const done = t.status === 'resolved' || t.status === 'closed';
        return (
          <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="block w-full text-left mt-3 bg-[var(--c-sf,#fff)] rounded-2xl p-4 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14798D]"
            style={{ border: `1px solid ${hl ? P : LINE}`, boxShadow: hl ? `0 0 0 1px ${P}` : '0 1px 2px rgba(15,23,42,.04)' }}>
            <div className="flex justify-between items-center gap-2.5">
              <span className="text-[11.5px] truncate" style={{ color: 'var(--c-fn, #64748B)', fontFamily: MONO }}>{fmtNo(t.no)} · {typeLabel(t.type, lang)}</span>
              <StatusPill s={t.status} lang={lang} />
            </div>
            <div className="text-[15px] font-bold mt-2.5 break-words">{t.title}</div>
            {!done && t.previewBy === 'staff' && t.preview && (
              <div className="text-[13px] mt-1.5 leading-[1.5] line-clamp-2" style={{ color: 'var(--c-mu, #475569)' }}><b className="font-semibold" style={{ color: 'var(--c-tx, #0F172A)' }}>{L('Destek ekibi:', 'Support:')}</b> {t.preview}</div>
            )}
            {done && t.rating && <div className="text-[13px] mt-1.5"><Stars n={t.rating.score} /> <span className="ml-1" style={{ color: 'var(--c-fn, #64748B)' }}>{L('Değerlendirmeniz', 'Your rating')}</span></div>}
            {done && !t.rating && <div className="text-[13px] mt-1.5 font-semibold" style={{ color: P }}>{L('Değerlendirmenizi bekliyoruz', 'Please rate our support')}</div>}
            <div className="text-[12px] mt-2.5" style={{ color: 'var(--c-fn, #64748B)' }}>{[t.plate, when(t.lastActivityAt, lang)].filter(Boolean).join(' · ')}</div>
          </button>
        );
      })}
      <div className="flex gap-2 mt-5 text-[12.5px] leading-[1.6]" style={{ color: 'var(--c-fn, #64748B)' }}>
        <Info className="w-[15px] h-[15px] shrink-0 mt-[3px]" style={{ color: P }} />
        <span>{L('Etiketinizin kaybolması veya çalınması durumunda QR etiketinizi talep beklemeden Araçlarım sayfasından kullanıma kapatabilirsiniz.', 'If your tag is lost or stolen you can disable it right away from My Vehicles.')}</span>
      </div>
    </>
  );
};

// ------------------------------------------------------------------ yeni talep

const NewTicket: React.FC<{ lang: Lang; uid: string; openCount: number; onOpenPrivacy: () => void; onCreated: (id: string, no: string) => void }> = ({ lang, uid, openCount, onOpenPrivacy, onCreated }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [type, setType] = useState<TicketType | null>(null);
  const [topic, setTopic] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const imgs = useImages(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => listenMyVehicles(uid, setVehicles, () => setVehicles([])), [uid]);

  const t = title.trim(); const b = body.trim();
  const errors = {
    type: !type ? L('Talep türünü seçiniz.', 'Choose a type.') : null,
    topic: !topic ? L('Konu seçiniz.', 'Choose a topic.') : null,
    title: t.length < LIMITS.titleMin ? L(`Başlık en az ${LIMITS.titleMin} karakter olmalıdır.`, `At least ${LIMITS.titleMin} characters.`) : null,
    body: b.length < LIMITS.bodyMin ? L(`Açıklama en az ${LIMITS.bodyMin} karakter olmalıdır.`, `At least ${LIMITS.bodyMin} characters.`) : null,
  };
  const full = openCount >= OPEN_MAX;
  const valid = !errors.type && !errors.topic && !errors.title && !errors.body;

  const submit = async () => {
    setTried(true); setErr(null);
    if (!valid || full || !imgs.ready) return;
    setBusy(true);
    try {
      const r = await createTicket({ type: type!, topic, title: t, body: b, vehicleId: vehicleId || null, attachments: imgs.ids });
      onCreated(r.id, r.no);
    } catch (e) {
      setErr(functionErrorMessage(e, L('Talebiniz iletilemedi. Lütfen tekrar deneyiniz.', 'Your request could not be sent.')));
    } finally { setBusy(false); }
  };
  const fe = (m: string | null) => (tried && m ? <p className="m-0 mt-1.5 text-[12px]" style={{ color: 'var(--c-dg, #B42318)' }}>{m}</p> : null);
  const sel = (id: string, value: string, onChange: (v: string) => void, options: { v: string; t: string }[], placeholder: string, bad?: boolean) => (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldCls} appearance-none pr-10`} style={{ ...fieldStyle, color: value ? 'var(--c-tx, #0F172A)' : 'var(--c-ph, #94A3B8)', borderColor: bad ? 'var(--c-dg, #B42318)' : FIELD_LINE }}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--c-fn, #64748B)' }} />
    </div>
  );

  return (
    <>
      {full && (
        <div className="mt-4 flex gap-2.5 p-3.5 rounded-[14px] text-[12.5px] leading-[1.55]" style={{ background: TINT, border: '1px solid var(--c-tintb, #CFE6EA)', color: PD }}>
          <Info className="w-4 h-4 shrink-0 mt-[2px]" />
          <span>{L(`Aynı anda en fazla ${OPEN_MAX} açık talebiniz olabilir. Mevcut talepleriniz sonuçlandığında yeni talep oluşturabilirsiniz.`, `You can have up to ${OPEN_MAX} open requests at a time.`)}</span>
        </div>
      )}
      <Card className="mt-4 pt-1 pb-[18px]">
        <Label>{L('Talep türü', 'Type')}</Label>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={L('Talep türü', 'Type')}>
          {TYPES.map((x) => {
            const on = type === x.id;
            return (
              <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setType(x.id)} className="px-3.5 py-[9px] rounded-xl text-[13px] transition-colors"
                style={on ? { border: `1px solid ${P}`, background: TINT, color: PD, fontWeight: 600 } : { border: `1px solid ${tried && errors.type ? 'var(--c-dg, #B42318)' : FIELD_LINE}`, background: 'var(--c-sf, #fff)', color: 'var(--c-mu, #334155)' }}>
                {lang === 'tr' ? x.tr : x.en}
              </button>
            );
          })}
        </div>
        {fe(errors.type)}
        <Label htmlFor="tk-topic">{L('Konu', 'Topic')}</Label>
        {sel('tk-topic', topic, setTopic, TOPICS.map((x) => ({ v: x.id, t: lang === 'tr' ? x.tr : x.en })), L('Konu seçiniz', 'Choose a topic'), tried && !!errors.topic)}
        {fe(errors.topic)}
        {vehicles.length > 0 && (
          <>
            <Label htmlFor="tk-vehicle" right={L('isteğe bağlı', 'optional')}>{L('İlgili araç', 'Vehicle')}</Label>
            {sel('tk-vehicle', vehicleId, setVehicleId, vehicles.map((v) => ({ v: v.id, t: [v.plateNumber, v.brandModel].filter(Boolean).join(' · ') })), L('Araç seçilmedi', 'No vehicle'))}
          </>
        )}
        <Label htmlFor="tk-title">{L('Başlık', 'Title')}</Label>
        <input id="tk-title" value={title} maxLength={LIMITS.titleMax} onChange={(e) => setTitle(e.target.value)} placeholder={L('Talebinizi kısaca özetleyiniz', 'Summarise your request')}
          className={fieldCls} style={{ ...fieldStyle, borderColor: tried && errors.title ? 'var(--c-dg, #B42318)' : FIELD_LINE }} />
        {fe(errors.title)}
        <Label htmlFor="tk-body" right={`${body.length} / ${LIMITS.bodyMax}`}>{L('Açıklama', 'Description')}</Label>
        <textarea id="tk-body" value={body} maxLength={LIMITS.bodyMax} rows={4} onChange={(e) => setBody(e.target.value)}
          placeholder={L('Yaşadığınız durumu ayrıntılı olarak açıklayınız', 'Describe the situation in detail')}
          className={`${fieldCls} leading-[1.55] resize-y min-h-[92px]`} style={{ ...fieldStyle, borderColor: tried && errors.body ? 'var(--c-dg, #B42318)' : FIELD_LINE }} />
        {fe(errors.body)}
        <Label>{L('Fotoğraf veya ekran görüntüsü', 'Photo or screenshot')}</Label>
        <div className="flex gap-3 flex-wrap">
          <PendingThumbs imgs={imgs} size={76} lang={lang} />
          {imgs.list.length < LIMITS.attachMax && (
            <button type="button" onClick={() => fileRef.current?.click()} className="w-[76px] h-[76px] rounded-[10px] flex flex-col items-center justify-center gap-[3px] text-[11.5px] box-border"
              style={{ border: '1.5px dashed var(--c-ln2, #94A3B8)', color: 'var(--c-mu, #475569)', background: 'var(--c-sub, #F8FAFC)' }}>
              {imgs.busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Plus className="w-[18px] h-[18px]" />}{L('Ekle', 'Add')}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { imgs.add(e.target.files); e.target.value = ''; }} />
        </div>
        <div className="text-[11.5px] mt-2" style={{ color: 'var(--c-fn, #64748B)' }}>{L(`En fazla ${LIMITS.attachMax} görsel · JPG, PNG, HEIC · her biri en fazla 5 MB`, `Up to ${LIMITS.attachMax} images · max 5 MB each`)}</div>
        {imgs.err && <p role="alert" className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-dg, #B42318)' }}>{imgs.err}</p>}
      </Card>
      {err && <p role="alert" className="m-0 mt-4 text-[13px] text-center" style={{ color: 'var(--c-dg, #B42318)' }}>{err}</p>}
      <div className="mt-[18px]">
        <PrimaryBtn onClick={submit} busy={busy} disabled={full || imgs.busy}><Send className="w-4 h-4" />{L('Talebi Gönder', 'Send request')}</PrimaryBtn>
      </div>
      <p className="text-[11.5px] mt-3 leading-[1.55] text-center" style={{ color: 'var(--c-fn, #64748B)' }}>
        {L('Paylaştığınız bilgiler yalnızca talebinizin sonuçlandırılması amacıyla işlenir.', 'Your information is only used to handle your request.')}{' '}
        <button type="button" onClick={onOpenPrivacy} className="font-medium underline" style={{ color: P }}>{L('KVKK Aydınlatma Metni', 'Privacy notice')}</button>
      </p>
    </>
  );
};

// ------------------------------------------------------------------ yazışma

const Thread: React.FC<{ id: string; lang: Lang; justCreated: string | null; onDismissCreated: () => void; onBack: () => void }> = ({ id, lang, justCreated, onDismissCreated, onBack }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [t, setT] = useState<CustomerTicket | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<CustomerMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  useEffect(() => listenTicket(id, setT, () => setFailed(true)), [id]);
  useEffect(() => listenMessages(id, setMsgs, () => setFailed(true)), [id]);
  useEffect(() => { if (t?.unreadForCustomer) markTicketRead(id).catch(() => undefined); }, [t?.unreadForCustomer, id]);
  useEffect(() => () => onDismissCreated(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!msgs || msgs.length < 3) return;
    endRef.current?.scrollIntoView({ behavior: firstScroll.current ? 'auto' : 'smooth', block: 'end' });
    firstScroll.current = false;
  }, [msgs?.length]);

  const back = (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--c-tx, #0F172A)' }}>
      <ArrowLeft className="w-[18px] h-[18px]" />{L('Taleplerim', 'My requests')}
    </button>
  );
  if (failed || t === null) {
    return <>{back}<Card className="mt-5 text-center text-[13px]" style={{ color: 'var(--c-mu, #475569)' }}>{L('Talep bulunamadı veya görüntüleme yetkiniz bulunmamaktadır.', 'Request not found.')}</Card></>;
  }
  if (t === undefined || !msgs) return <>{back}<div className="mt-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: P }} /></div></>;

  const done = t.status === 'resolved' || t.status === 'closed';
  const sub = done && t.resolvedAt && t.createdAt
    ? L(`${tookText(t.resolvedAt - t.createdAt, lang)} çözüldü`, `resolved in ${tookText(t.resolvedAt - t.createdAt, lang)}`)
    : [typeLabel(t.type, lang), t.plate].filter(Boolean).join(' · ');

  return (
    <div className={done ? '' : 'pb-4'}>
      {back}
      <div className="mt-5">
        <div className="text-[12px]" style={{ color: 'var(--c-fn, #64748B)', fontFamily: MONO }}>{fmtNo(t.no)}</div>
        <h1 className="m-0 mt-1 text-[18px] font-bold break-words">{t.title}</h1>
        <div className="flex gap-2 items-center mt-2.5 flex-wrap"><StatusPill s={t.status} lang={lang} /><span className="text-[12px]" style={{ color: 'var(--c-fn, #64748B)' }}>{sub}</span></div>
      </div>

      {justCreated && (
        <div className="mt-4 flex gap-2.5 p-3.5 rounded-[14px] text-[12.5px] leading-[1.55]" style={{ background: 'var(--c-okb, #E3F4E8)', border: '1px solid var(--c-okb, #BFE3CB)', color: 'var(--c-ok, #166534)' }}>
          <Info className="w-4 h-4 shrink-0 mt-[2px]" />
          <span>{L('Talep numaranız ', 'Your request number is ')}<b className="font-semibold whitespace-nowrap">{justCreated}</b>{L('. Talebiniz en geç 24 saat içinde yanıtlanacaktır.', '. We will reply within 24 hours.')}</span>
        </div>
      )}
      {t.status === 'waiting_customer' && (
        <div className="mt-4 flex gap-2.5 p-3.5 rounded-[14px] text-[12.5px] leading-[1.55]" style={{ background: TINT, border: '1px solid var(--c-tintb, #CFE6EA)', color: PD }}>
          <Info className="w-4 h-4 shrink-0 mt-[2px]" />
          <span>{L('Destek ekibimiz sizden ek bilgi talep etmiştir. Yanıtınız iletildiğinde talebiniz yeniden incelemeye alınacaktır.', 'Our team needs more information. Your request will be reviewed again once you reply.')}</span>
        </div>
      )}

      <div className="text-center text-[11.5px] mt-[18px]" style={{ color: 'var(--c-fn, #64748B)' }}>{L('Talebiniz alınmıştır', 'Request received')} · {when(t.createdAt, lang)}</div>
      {msgs.map((m) => <Bubble key={m.id} m={m} lang={lang} onOpen={setViewer} />)}
      <div ref={endRef} />

      {t.status === 'resolved' && !t.rating && <RatingCard t={t} lang={lang} canReopen />}
      {t.status === 'closed' && !t.rating && <RatingCard t={t} lang={lang} canReopen={false} />}
      {t.rating && (
        <Card className="mt-5 text-center">
          <div className="text-[13px] font-semibold">{L('Değerlendirmeniz', 'Your rating')}</div>
          <div className="mt-2"><Stars n={t.rating.score} size={22} /></div>
          {t.rating.comment && <p className="m-0 mt-2.5 text-[13px] leading-[1.55]" style={{ color: 'var(--c-mu, #475569)' }}>“{t.rating.comment}”</p>}
          <p className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-fn, #64748B)' }}>{L('Geri bildiriminiz için teşekkür ederiz.', 'Thank you for your feedback.')}</p>
        </Card>
      )}
      {t.status === 'resolved' && <div className="text-[11.5px] mt-3.5 leading-[1.55] text-center" style={{ color: 'var(--c-fn, #64748B)' }}>{L('Çözülen talepler 3 gün sonra otomatik olarak kapatılır.', 'Resolved requests close automatically after 3 days.')}</div>}
      {t.status === 'closed' && <div className="text-[12px] mt-4 leading-[1.55] text-center" style={{ color: 'var(--c-fn, #64748B)' }}>{L('Bu talep kapatılmıştır. Gerekli olması durumunda yeni bir talep oluşturabilirsiniz.', 'This request is closed. You can create a new one if needed.')}</div>}

      {!done && <Composer id={id} lang={lang} />}
      {viewer && <ImageViewer att={viewer} lang={lang} onClose={() => setViewer(null)} />}
    </div>
  );
};

const Bubble: React.FC<{ m: CustomerMessage; lang: Lang; onOpen: (a: Attachment) => void }> = ({ m, lang, onOpen }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  if (m.kind === 'event') return <div className="text-center text-[11.5px] mt-4" style={{ color: 'var(--c-fn, #64748B)' }}>{eventLabel(m.event, lang, 'customer')} · {when(m.createdAt, lang)}</div>;
  const me = m.kind === 'customer';
  return (
    <div className={`flex flex-col mt-3.5 ${me ? 'items-end' : 'items-start'}`}>
      <div className="text-[11.5px] mb-[5px]" style={{ color: 'var(--c-fn, #64748B)' }}>{me ? L('Siz', 'You') : `${m.authorName || L('Destek Ekibi', 'Support')}${m.authorName ? L(' · Destek Ekibi', ' · Support') : ''}`} · {when(m.createdAt, lang, true)}</div>
      <div className="max-w-[84%] rounded-2xl px-3.5 py-3 text-[13.5px] leading-[1.55] break-words"
        style={me ? { background: TINT, border: '1px solid var(--c-tintb, #CFE6EA)', borderBottomRightRadius: 6 } : { background: 'var(--c-sf, #fff)', border: `1px solid ${LINE}`, borderBottomLeftRadius: 6 }}>
        {m.body && <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>}
        {m.attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${m.body ? 'mt-2.5' : ''}`}>
            {m.attachments.map((a, i) => (
              <button key={a.id} type="button" onClick={() => onOpen(a)} aria-label={L(`Görsel ${i + 1}`, `Image ${i + 1}`)} className="block rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                <img src={jpegUrl(a.thumb)} alt="" className="block w-[60px] h-[60px] object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Composer: React.FC<{ id: string; lang: Lang }> = ({ id, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const imgs = useImages(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const text = body.trim();
  const canSend = !busy && imgs.ready && (text.length > 0 || imgs.ids.length > 0) && text.length <= LIMITS.replyMax;
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [body]);
  const send = async () => {
    if (!canSend) return;
    setBusy(true); setErr(null);
    try { await replyTicket(id, text, imgs.ids); setBody(''); imgs.clear(); } catch (e) { setErr(functionErrorMessage(e, L('Yanıtınız iletilemedi. Lütfen tekrar deneyiniz.', 'Your reply could not be sent.'))); } finally { setBusy(false); }
  };
  const error = err || imgs.err;
  return (
    <div className="sticky -mx-4 mt-6 px-4 pt-3 pb-[18px] bg-[var(--c-sf,#fff)] z-10" style={{ borderTop: `1px solid ${LINE}`, bottom: 'var(--c-tabh, 0px)' }}>
      {imgs.list.length > 0 && <div className="flex gap-2.5 mb-3 flex-wrap"><PendingThumbs imgs={imgs} size={56} lang={lang} /></div>}
      <div className="flex gap-2.5 items-end">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={imgs.list.length >= LIMITS.attachMax} aria-label={L('Görsel ekle', 'Add image')}
          className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center disabled:opacity-40" style={{ border: `1px solid ${FIELD_LINE}`, color: 'var(--c-mu, #475569)' }}>
          {imgs.busy ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <ImagePlus className="w-[18px] h-[18px]" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { imgs.add(e.target.files); e.target.value = ''; }} />
        <textarea ref={taRef} value={body} rows={1} maxLength={LIMITS.replyMax} onChange={(e) => setBody(e.target.value)} aria-label={L('Yanıtınız', 'Your reply')}
          placeholder={L('Yanıtınızı yazınız', 'Write your reply')} className={`${fieldCls} resize-none py-[11px] leading-[1.45]`} style={{ ...fieldStyle, minHeight: 44 }} />
        <button type="button" onClick={send} disabled={!canSend} aria-label={L('Gönder', 'Send')} className="w-11 h-11 shrink-0 rounded-xl text-white flex items-center justify-center disabled:opacity-45" style={{ background: P }}>
          {busy ? <Loader2 className="w-[17px] h-[17px] animate-spin" /> : <Send className="w-[17px] h-[17px]" />}
        </button>
      </div>
      {body.length > LIMITS.replyMax - 200 && <div className="text-[11.5px] mt-1.5 text-right" style={{ color: 'var(--c-fn, #64748B)' }}>{body.length} / {LIMITS.replyMax}</div>}
      {error && <p role="alert" className="m-0 mt-2 text-[12px]" style={{ color: 'var(--c-dg, #B42318)' }}>{error}</p>}
    </div>
  );
};

const RatingCard: React.FC<{ t: CustomerTicket; lang: Lang; canReopen: boolean }> = ({ t, lang, canReopen }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'rate' | 'reopen' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const shown = hover || score;
  const words = useMemo(() => [L('Çok kötü', 'Very poor'), L('Kötü', 'Poor'), L('Orta', 'Fair'), L('İyi', 'Good'), L('Çok iyi', 'Very good')], [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const rate = async () => {
    if (!score) return;
    setBusy('rate'); setErr(null);
    try { await rateTicket(t.id, score, comment.trim()); } catch (e) { setErr(functionErrorMessage(e, L('Değerlendirmeniz iletilemedi.', 'Could not send your rating.'))); } finally { setBusy(null); }
  };
  const reopen = async () => {
    setBusy('reopen'); setErr(null);
    try { await reopenTicket(t.id); } catch (e) { setErr(functionErrorMessage(e, L('Talep yeniden açılamadı.', 'Could not reopen.'))); } finally { setBusy(null); }
  };
  return (
    <Card className="mt-5 text-center">
      <div className="text-[15px] font-bold">{L('Hizmet Değerlendirmesi', 'Rate our support')}</div>
      <div className="text-[12.5px] mt-1" style={{ color: 'var(--c-mu, #475569)' }}>{L('Destek hizmetimizi değerlendirmenizi rica ederiz.', 'Please rate our support.')}</div>
      <div className="flex justify-center gap-1.5 mt-3.5" role="radiogroup" aria-label={L('Puan', 'Score')} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={L(`${n} yıldız`, `${n} stars`)} onClick={() => setScore(n)} onMouseEnter={() => setHover(n)} className="p-0.5">
            <Star width={30} height={30} fill={n <= shown ? STAR : '#CBD5E1'} stroke="none" />
          </button>
        ))}
      </div>
      <div className="text-[12px] mt-1 h-[18px]" style={{ color: 'var(--c-fn, #64748B)' }}>{shown ? words[shown - 1] : ''}</div>
      <textarea value={comment} maxLength={LIMITS.commentMax} rows={2} onChange={(e) => setComment(e.target.value)} aria-label={L('Görüşünüz', 'Comment')}
        placeholder={L('Görüşünüz (isteğe bağlı)', 'Comment (optional)')} className={`${fieldCls} mt-2.5 text-left resize-none min-h-[56px] leading-[1.5]`} style={fieldStyle} />
      <div className="mt-3.5"><PrimaryBtn onClick={rate} disabled={!score || busy === 'reopen'} busy={busy === 'rate'}>{L('Değerlendirmeyi Gönder', 'Send rating')}</PrimaryBtn></div>
      {canReopen && (
        <button type="button" onClick={reopen} disabled={!!busy} className="mt-3.5 text-[13px] font-semibold disabled:opacity-50" style={{ color: P }}>
          {busy === 'reopen' ? L('Açılıyor…', 'Reopening…') : L('Sorun devam ediyor, talebi yeniden aç', 'Problem persists, reopen')}
        </button>
      )}
      {err && <p role="alert" className="m-0 mt-2.5 text-[12px]" style={{ color: 'var(--c-dg, #B42318)' }}>{err}</p>}
    </Card>
  );
};

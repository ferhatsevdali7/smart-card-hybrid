// Bildirimler: kişinin kendi gelen kutusu (canlı), görevler, temizleme;
// süper yöneticiye özel "Bildirim gönder" ve "Gönderdiklerim" (kim okudu, kim tamamladı).
// Sayfa açıldığında okunmamış bildirimler okundu sayılır, zildeki sayaç sıfırlanır.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLang, Icon, IconName } from './adminUi';
import { Btn, ConfirmDialog, Dialog, EmptyState, FilterChip, Note, PageHeader, errorText, useToasts } from './lifecycleUi';
import { ErrorPanel, Initials, SkeletonRows, Tabs, fmtDay, nfFor, useRemote } from './customerUi';
import { canSee, useAccess } from '../../lib/access';
import { liftLimit, teamOverview, type TeamOverview } from '../../lib/teamService';
import { initials } from '../../lib/directoryService';
import {
  BODY_MAX, COMPOSE_SECTIONS, KEEP_DAYS, SECTION_NAMES, TITLE_MAX, clearInbox, limitExpired, limitPending, linkLabel, listSent,
  listenInbox, markAllRead, markTaskDone, noteText, removable, sendNotification, taskOpen, todayKey,
  type InboxItem, type LinkSection, type NoteLink, type SendInput, type SentItem,
} from '../../lib/notificationService';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  email: string;
  onNavigate: (link: NoteLink) => void;
}

type Filter = 'all' | 'task' | 'ticket' | 'critical' | 'system' | 'message';

export const AdminNotificationsView: React.FC<Props> = ({ lang, isDark, email, onNavigate }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const access = useAccess();
  const sup = access.superAdmin;
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [compose, setCompose] = useState(false);
  const [sentVersion, setSentVersion] = useState(0);
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const toasts = useToasts();

  return (
    <div className="max-w-[1080px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader
        title={L('Bildirimler', 'Notifications')}
        sub={sup ? L('Size gelen bildirimler ve ekibe gönderdikleriniz', 'Your notifications and what you sent to the team') : L('Size gelen bildirimler ve görevler', 'Your notifications and tasks')}
        right={sup ? <Btn variant="primary" icon="send" onClick={() => setCompose(true)}>{L('Bildirim gönder', 'Send notification')}</Btn> : undefined}
      />
      <div className="mt-8">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as 'inbox' | 'sent')}
          tabs={[
            { id: 'inbox', label: L('Gelen', 'Inbox'), count: inboxCount ?? undefined },
            ...(sup ? [{ id: 'sent', label: L('Gönderdiklerim', 'Sent'), count: sentCount ?? undefined }] : []),
          ]}
        />
      </div>
      {tab === 'inbox' && <Inbox lang={lang} isDark={isDark} email={email} onNavigate={onNavigate} onCount={setInboxCount} toast={toasts.show} />}
      {tab === 'sent' && sup && <SentList key={sentVersion} lang={lang} isDark={isDark} me={email} onCount={setSentCount} />}
      {compose && sup && (
        <ComposeDialog
          lang={lang}
          me={email}
          onClose={() => setCompose(false)}
          onSent={(count) => {
            setCompose(false);
            setSentVersion((v) => v + 1);
            setTab('sent');
            toasts.show(L(`Bildirim ${count} kişiye gönderildi.`, `Sent to ${count} people.`));
          }}
        />
      )}
      {toasts.node}
    </div>
  );
};

// =====================================================================
// Yardımcılar
// =====================================================================

function timeText(ms: number | null, lang: AdminLang): string {
  if (!ms) return '';
  const d = new Date(ms);
  const loc = lang === 'tr' ? 'tr-TR' : 'en-GB';
  const hm = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  const days = dayDiff(ms);
  if (days === 0) return hm;
  if (days < 7) return `${d.toLocaleDateString(loc, { weekday: 'long' })} ${hm}`;
  return fmtDay(ms, lang, true);
}

/** Bugünden kaç gün önce (İstanbul saatiyle takvim günü) */
function dayDiff(ms: number): number {
  const key = (t: number) => todayKey(new Date(t));
  const a = new Date(`${key(Date.now())}T12:00:00Z`).getTime();
  const b = new Date(`${key(ms)}T12:00:00Z`).getTime();
  return Math.round((a - b) / 86400e3);
}

function groupOf(ms: number | null): 0 | 1 | 2 | 3 {
  if (!ms) return 0;
  const d = dayDiff(ms);
  return d <= 0 ? 0 : d === 1 ? 1 : d < 7 ? 2 : 3;
}

function kindLook(it: InboxItem, isDark: boolean): { icon: IconName; color: string; bg: string } {
  const purple = isDark ? { color: '#C9B8FF', bg: 'rgba(157,143,232,.13)' } : { color: '#6941C6', bg: '#F1EDFD' };
  const amber = isDark ? { color: '#E3A857', bg: 'rgba(227,168,87,.13)' } : { color: '#9A5B0B', bg: '#FDF1DE' };
  const red = { color: 'var(--a-danger)', bg: 'var(--a-danger-tint)' };
  const gray = { color: 'var(--a-muted)', bg: 'var(--a-active)' };
  const teal = isDark ? { color: '#7CC7D4', bg: 'rgba(20,121,141,.18)' } : { color: '#0E6476', bg: '#E8F3F5' };
  switch (it.kind) {
    case 'critical': return { icon: it.data.action === 'qr_purged' ? 'trash' : 'userX', ...red };
    case 'limit_reached': return { icon: 'alert', ...amber };
    case 'batch_created': return { icon: 'layers', ...gray };
    case 'tag_lost': return { icon: 'ban', ...gray };
    case 'task': return it.doneAt ? { icon: 'task', color: 'var(--a-success)', bg: 'var(--a-success-tint)' } : { icon: 'task', ...purple };
    case 'message': return { icon: 'mail', color: 'var(--a-accent)', bg: 'var(--a-accent-tint)' };
    case 'ticket_new': return { icon: 'message', ...teal };
    case 'ticket_reply': return { icon: 'message', ...teal };
    case 'ticket_sla': return it.data.breached ? { icon: 'clock', ...red } : { icon: 'clock', ...amber };
    case 'abuse_report': return { icon: 'alert', ...red };
    default: return { icon: 'bell', ...gray };
  }
}

const CategoryTag: React.FC<{ it: InboxItem; isDark: boolean; lang: AdminLang }> = ({ it, isDark, lang }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const c = it.category;
  const look = c === 'critical' ? { color: 'var(--a-danger)', bg: 'var(--a-danger-tint)', text: L('Kritik işlem', 'Critical') }
    : c === 'task' ? { ...(isDark ? { color: '#C9B8FF', bg: 'rgba(157,143,232,.13)' } : { color: '#6941C6', bg: '#F1EDFD' }), text: L('Görev', 'Task') }
      : c === 'message' ? { color: 'var(--a-accent)', bg: 'var(--a-accent-tint)', text: L('Duyuru', 'Announcement') }
        : c === 'ticket' ? { ...(isDark ? { color: '#7CC7D4', bg: 'rgba(20,121,141,.18)' } : { color: '#0E6476', bg: '#E8F3F5' }), text: L('Talep', 'Request') }
        : { color: 'var(--a-muted)', bg: 'var(--a-active)', text: L('Sistem', 'System') };
  return <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px] whitespace-nowrap" style={{ color: look.color, background: look.bg }}>{look.text}</span>;
};

// =====================================================================
// GELEN KUTUSU
// =====================================================================

const PAGE = 50;

const Inbox: React.FC<{
  lang: AdminLang; isDark: boolean; email: string; onNavigate: (l: NoteLink) => void;
  onCount: (n: number | null) => void; toast: (t: string, k?: 'ok' | 'warn' | 'error') => void;
}> = ({ lang, isDark, email, onNavigate, onCount, toast }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const access = useAccess();
  const [n, setN] = useState(PAGE);
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  // Bu sayfada okunmamış olarak görülenler "Yeni" etiketiyle kalır
  const seenUnread = useRef(new Set<string>());
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const [confirm, setConfirm] = useState<null | { kind: 'clear' } | { kind: 'task'; it: InboxItem } | { kind: 'lift'; it: InboxItem }>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const today = todayKey();

  useEffect(() => {
    setError(null);
    return listenInbox(email, n, (list) => {
      list.forEach((it) => { if (!it.readAt) seenUnread.current.add(it.id); });
      setItems(list);
    }, (e) => setError(e));
  }, [email, n, attempt]);

  useEffect(() => {
    const h = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  // Sayfa görünürken okunmamış varsa okundu yap (sayaç sıfırlanır). Hata olursa sessizce bir sonraki değişiklikte yeniden denenir.
  const unread = items?.filter((i) => !i.readAt).length || 0;
  useEffect(() => {
    if (!unread || !visible) return;
    const t = setTimeout(() => { markAllRead().catch((e) => console.warn('[inbox] okundu yapılamadı', e)); }, 600);
    return () => clearTimeout(t);
  }, [unread, visible]);

  useEffect(() => { onCount(items ? items.length : null); }, [items?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { all: 0, task: 0, ticket: 0, critical: 0, system: 0, message: 0 } as Record<Filter, number>;
    for (const it of items || []) { c.all += 1; if (it.category in c) c[it.category as Filter] += 1; }
    return c;
  }, [items]);
  const shown = (items || []).filter((it) => filter === 'all' || it.category === filter);
  const removableCount = (items || []).filter((it) => removable(it, today)).length;

  const remove = async (it: InboxItem) => {
    setBusyId(it.id);
    try {
      const r = await clearInbox([it.id]);
      if (!r.removed) toast(L('Bu bildirim şu an temizlenemez.', 'This notification cannot be removed yet.'), 'warn');
    } catch (e) { toast(errorText(e, lang), 'error'); } finally { setBusyId(null); }
  };

  const goLink = (l: NoteLink) => onNavigate(l);
  const linkAllowed = (l: NoteLink) => (l.section === 'team' ? access.superAdmin : canSee(l.section));

  if (error) return <div className="mt-8"><ErrorPanel error={error} lang={lang} onRetry={() => setAttempt((v) => v + 1)} /></div>;
  if (!items) return <div className="mt-8"><SkeletonRows rows={4} h={110} /></div>;

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: L('Tümü', 'All') },
    { id: 'task', label: L('Görevler', 'Tasks') },
    { id: 'ticket', label: L('Talepler', 'Requests') },
    { id: 'critical', label: L('Kritik işlemler', 'Critical') },
    { id: 'system', label: L('Sistem', 'System') },
    { id: 'message', label: L('Duyurular', 'Announcements') },
  ];
  const groups: { title: string; list: InboxItem[] }[] = [];
  const titles = [L('Bugün', 'Today'), L('Dün', 'Yesterday'), L('Bu hafta', 'This week'), L('Daha eski', 'Older')];
  for (const it of shown) {
    const g = groupOf(it.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.title === titles[g]) last.list.push(it);
    else groups.push({ title: titles[g], list: [it] });
  }

  return (
    <>
      {items.length > 0 && (
        <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {filters.filter((f) => f.id === 'all' || counts[f.id] > 0 || filter === f.id).map((f) => (
              <FilterChip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)} count={counts[f.id]}>{f.label}</FilterChip>
            ))}
          </div>
          <Btn icon="broom" disabled={!removableCount} onClick={() => setConfirm({ kind: 'clear' })} title={removableCount ? undefined : L('Temizlenecek okunmuş bildirim yok', 'Nothing to clear')}>
            {L('Okunanları temizle', 'Clear read')}
          </Btn>
        </div>
      )}

      {items.length === 0 && (
        <div className="mt-8"><EmptyState icon="bell" title={L('Bildiriminiz yok', 'No notifications')} text={L('Size bir görev ya da bildirim geldiğinde burada görünür; sağ üstteki zilde sayısı yazar.', 'New tasks and notifications appear here.')} /></div>
      )}
      {items.length > 0 && shown.length === 0 && (
        <p className="mt-10 text-center text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu süzgeçte bildirim yok.', 'Nothing in this filter.')}</p>
      )}

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="m-0 mt-8 mb-3 text-[12px] font-normal" style={{ color: 'var(--a-faint)' }}>{g.title}</h2>
          <div className="flex flex-col gap-3">
            {g.list.map((it) => (
              <NoteCard
                key={it.id}
                it={it}
                lang={lang}
                isDark={isDark}
                me={email}
                isNew={seenUnread.current.has(it.id)}
                busy={busyId === it.id}
                canRemove={removable(it, today)}
                canLift={access.superAdmin && limitPending(it, today)}
                linkOk={!!it.link && linkAllowed(it.link)}
                onRemove={() => remove(it)}
                onTask={() => setConfirm({ kind: 'task', it })}
                onLift={() => setConfirm({ kind: 'lift', it })}
                onLink={() => it.link && goLink(it.link)}
              />
            ))}
          </div>
        </section>
      ))}

      {items.length >= n && (
        <div className="flex justify-center mt-8"><Btn onClick={() => setN((v) => v + PAGE)}>{L('Daha eski bildirimleri göster', 'Show older')}</Btn></div>
      )}

      <div className="mt-10">
        <Note>
          {L(
            `Sayfayı açtığınızda bildirimler okundu sayılır ve zildeki sayaç sıfırlanır; yeni gelenler “Yeni” etiketiyle ayrışır. Bildirimler ${KEEP_DAYS} gün sonra kendiliğinden silinir. Tamamlanmamış görevler ve karar bekleyen sınır bildirimleri temizlenemez.`,
            `Opening this page marks notifications as read. They are deleted after ${KEEP_DAYS} days. Open tasks and pending limit decisions cannot be cleared.`,
          )}
        </Note>
      </div>

      {confirm?.kind === 'clear' && (
        <ConfirmDialog
          title={L(`Okunmuş ${removableCount} bildirim temizlensin mi?`, `Clear ${removableCount} read notifications?`)}
          icon="broom"
          confirmLabel={L('Temizle', 'Clear')}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            try {
              const r = await clearInbox();
              const keptOpen = r.kept.task + r.kept.limit;
              toast(L(`${r.removed} bildirim temizlendi.${keptOpen ? ` ${keptOpen} bildirim karar ya da işlem beklediği için kaldı.` : ''}`, `${r.removed} cleared.`));
            } catch (e) { toast(errorText(e, lang), 'error'); }
            setConfirm(null);
          }}
        >
          <p className="m-0">{L('Silinen bildirimler geri gelmez. Tamamlanmamış görevler ve bugün karar bekleyen sınır bildirimleri kalır.', 'Cleared notifications cannot be restored. Open tasks stay.')}</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === 'task' && (
        <ConfirmDialog
          title={L('Görev tamamlandı olarak işaretlensin mi?', 'Mark task as done?')}
          icon="task"
          confirmLabel={L('Tamamlandı', 'Done')}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const it = confirm.it;
            try {
              await markTaskDone(it.id);
              toast(L('Görev tamamlandı olarak işaretlendi; gönderen kişi görebilir.', 'Marked as done.'));
            } catch (e) { toast(errorText(e, lang), 'error'); }
            setConfirm(null);
          }}
        >
          <p className="m-0"><b className="font-medium" style={{ color: 'var(--a-text)' }}>{confirm.it.title}</b></p>
          <p className="m-0 mt-2">{L(`${confirm.it.actorName || 'Gönderen'} bunu Gönderdiklerim'de görür. Bu işaret geri alınamaz.`, 'The sender will see it. This cannot be undone.')}</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === 'lift' && (
        <ConfirmDialog
          title={L('Bugünlük kısıt kaldırılsın mı?', 'Lift the limit for today?')}
          icon="alert"
          confirmLabel={L('Kısıtı kaldır', 'Lift limit')}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            const it = confirm.it;
            try {
              await liftLimit(String(it.data.targetEmail || it.actorEmail || ''), it.data.action === 'purge' ? 'purge' : 'user_delete');
              toast(L('Bugünlük kısıt kaldırıldı.', 'Limit lifted for today.'));
            } catch (e) { toast(errorText(e, lang), 'error'); }
            setConfirm(null);
          }}
        >
          <p className="m-0">{L(
            `${confirm.it.actorName || 'Bu kişi'} bugün gece yarısına kadar ${confirm.it.data.action === 'purge' ? 'QR kalıcı silme' : 'müşteri hesabı silme'} işlemine sınırsız devam edebilir. Her işlem yine şifre ve sebep ister, size bildirilir ve denetim kaydına yazılır.`,
            'They can continue without a limit until midnight. Each action still needs a password and reason.',
          )}</p>
        </ConfirmDialog>
      )}
    </>
  );
};

const NoteCard: React.FC<{
  it: InboxItem; lang: AdminLang; isDark: boolean; me: string; isNew: boolean; busy: boolean;
  canRemove: boolean; canLift: boolean; linkOk: boolean;
  onRemove: () => void; onTask: () => void; onLift: () => void; onLink: () => void;
}> = ({ it, lang, isDark, me, isNew, busy, canRemove, canLift, linkOk, onRemove, onTask, onLift, onLink }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const t = noteText(it, L);
  const look = kindLook(it, isDark);
  const isReason = it.kind === 'critical' && !!t.body;
  const resolvedBy = typeof it.data.resolvedBy === 'string' ? it.data.resolvedBy : '';
  return (
    <article
      className="relative rounded-[14px] p-4 sm:p-5 flex gap-3.5 sm:gap-4"
      style={{ background: isNew ? (isDark ? '#12161D' : '#F5F8FF') : 'var(--a-surface2)', border: `1px solid ${isNew ? (isDark ? '#2B3A55' : '#C9D8F8') : 'var(--a-line)'}` }}
      aria-label={t.actor ? `${t.actor} ${t.rest}` : t.rest}
    >
      <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: look.bg, color: look.color }}><Icon name={look.icon} size={17} /></span>
      <div className={`flex-1 min-w-0 ${canRemove ? 'pr-7' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <CategoryTag it={it} isDark={isDark} lang={lang} />
          {isNew && <span className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--a-accent)' }}><i className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--a-accent)' }} />{L('Yeni', 'New')}</span>}
        </div>
        <div className="text-[14px] leading-normal break-words">{t.actor && <b className="font-medium">{t.actor} </b>}{t.rest}</div>
        <div className="text-[12.5px] mt-1 break-words" style={{ color: 'var(--a-faint)' }}>{[timeText(it.createdAt, lang), t.meta].filter(Boolean).join(' · ')}</div>
        {t.body && (
          <div className="text-[13px] mt-2.5 leading-relaxed break-words" style={{ color: 'var(--a-text2)', whiteSpace: isReason ? undefined : 'pre-wrap' }}>
            {isReason ? <>{L('Sebep', 'Reason')}: “{t.body}”</> : t.body}
          </div>
        )}
        {it.kind === 'task' && it.doneAt && (
          <div className="flex items-center gap-2 mt-3 text-[12.5px]" style={{ color: 'var(--a-success)' }}><Icon name="check" size={14} />{L(`Tamamlandı olarak işaretlediniz · ${timeText(it.doneAt, lang)}`, `You marked this done · ${timeText(it.doneAt, lang)}`)}</div>
        )}
        {it.kind === 'limit_reached' && it.resolvedAt && (
          <div className="flex items-center gap-2 mt-3 text-[12.5px]" style={{ color: 'var(--a-success)' }}><Icon name="check" size={14} />
            {L(`Bugünlük kısıt kaldırıldı${resolvedBy ? ` · ${resolvedBy === me ? 'sizin tarafınızdan' : resolvedBy.split('@')[0]}` : ''}`, 'Limit lifted for today')}
          </div>
        )}
        {limitExpired(it) && (
          <div className="mt-3 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Günü geçti; sınır gece yarısı kendiliğinden sıfırlandı.', 'Expired; the limit reset at midnight.')}</div>
        )}
        {(taskOpen(it) || canLift || linkOk) && (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {taskOpen(it) && <Btn small variant="primary" icon="check" onClick={onTask}>{L('Tamamlandı olarak işaretle', 'Mark as done')}</Btn>}
            {canLift && <Btn small variant="primary" onClick={onLift}>{L('Bugünlük kısıtı kaldır', 'Lift for today')}</Btn>}
            {linkOk && it.link && <Btn small onClick={onLink}>{linkLabel(it.link, L)}<Icon name="arrowRight" size={13} /></Btn>}
          </div>
        )}
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={L('Bildirimi kaldır', 'Remove')}
          title={L('Kaldır', 'Remove')}
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--a-hover)] disabled:opacity-40"
          style={{ color: 'var(--a-faint)' }}
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </article>
  );
};

// =====================================================================
// GÖNDERDİKLERİM
// =====================================================================

type SentFilter = 'all' | 'open' | 'done' | 'message';

const SentList: React.FC<{ lang: AdminLang; isDark: boolean; me: string; onCount: (n: number | null) => void }> = ({ lang, isDark, me, onCount }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [items, setItems] = useState<SentItem[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<SentFilter>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    listSent(null).then((r) => {
      if (!alive) return;
      setItems(r.items); setNext(r.next);
      if (r.items[0]) setOpen(new Set([r.items[0].id]));
    }).catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [attempt]);
  useEffect(() => { onCount(items ? items.length : null); }, [items?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const more = async () => {
    if (!next) return;
    setLoadingMore(true);
    try { const r = await listSent(next); setItems((l) => [...(l || []), ...r.items.filter((x) => !(l || []).some((y) => y.id === x.id))]); setNext(r.next); } catch (e) { setError(e); } finally { setLoadingMore(false); }
  };

  if (error && !items) return <div className="mt-8"><ErrorPanel error={error} lang={lang} onRetry={() => setAttempt((v) => v + 1)} /></div>;
  if (!items) return <div className="mt-8"><SkeletonRows rows={3} h={96} /></div>;
  if (items.length === 0) {
    return <div className="mt-8"><EmptyState icon="send" title={L('Henüz bildirim göndermediniz', 'Nothing sent yet')} text={L('“Bildirim gönder” ile bir kişiye, bir pozisyona ya da tüm ekibe görev veya duyuru gönderebilirsiniz.', 'Send a task or announcement with “Send notification”.')} /></div>;
  }
  const isOpenTask = (x: SentItem) => x.task && x.doneCount < x.count;
  const counts: Record<SentFilter, number> = {
    all: items.length,
    open: items.filter(isOpenTask).length,
    done: items.filter((x) => x.task && x.doneCount >= x.count).length,
    message: items.filter((x) => !x.task).length,
  };
  const shown = items.filter((x) => filter === 'all' || (filter === 'open' ? isOpenTask(x) : filter === 'done' ? x.task && x.doneCount >= x.count : !x.task));
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <>
      <div className="mt-7 flex flex-wrap gap-1">
        {([['all', L('Tümü', 'All')], ['open', L('Açık görevler', 'Open tasks')], ['done', L('Tamamlanan', 'Completed')], ['message', L('Duyurular', 'Announcements')]] as [SentFilter, string][])
          .map(([id, label]) => <FilterChip key={id} on={filter === id} onClick={() => setFilter(id)} count={counts[id]}>{label}</FilterChip>)}
      </div>
      <div className="flex flex-col gap-3 mt-5">
        {shown.map((x) => <SentCard key={x.id} x={x} lang={lang} isDark={isDark} me={me} open={open.has(x.id)} onToggle={() => toggle(x.id)} />)}
        {shown.length === 0 && <p className="mt-6 text-center text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu süzgeçte kayıt yok.', 'Nothing here.')}</p>}
      </div>
      {next && <div className="flex justify-center mt-8"><Btn disabled={loadingMore} onClick={more}>{loadingMore ? '…' : L('Daha eskileri göster', 'Show older')}</Btn></div>}
      {error && items && <p role="alert" className="mt-4 text-center text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{errorText(error, lang)}</p>}
      <div className="mt-10">
        <Note>{L("Bu sekmeyi yalnızca süper yöneticiler görür; iki süper yöneticinin gönderdikleri birlikte listelenir. Gönderilen bildirim geri çekilemez ve düzenlenemez; kayıtları Denetim Kayıtları'nda kalıcıdır.", 'Only super admins see this tab. Sent notifications cannot be edited or withdrawn.')}</Note>
      </div>
    </>
  );
};

const Progress: React.FC<{ label: string; a: number; b: number; color: string }> = ({ label, a, b, color }) => (
  <div className="w-full sm:w-[150px]">
    <div className="flex justify-between text-[12.5px]"><span style={{ color: 'var(--a-faint)' }}>{label}</span><span>{a} / {b}</span></div>
    <div className="h-[5px] rounded-full mt-2 overflow-hidden" style={{ background: 'var(--a-line)' }}><span className="block h-full rounded-full" style={{ width: `${b ? (a / b) * 100 : 0}%`, background: color }} /></div>
  </div>
);

function audienceLabel(x: SentItem, L: (tr: string, en: string) => string): string {
  if (x.mode === 'all') return L(`Tüm ekip · ${x.count} kişi`, `Whole team · ${x.count}`);
  if (x.mode === 'positions') return `${x.positionNames.join(', ')} · ${L(`${x.count} kişi`, `${x.count} people`)}`;
  if (x.count === 1) return x.recipients[0]?.name || x.recipients[0]?.email || '';
  return L(`${x.count} kişi`, `${x.count} people`);
}

const SentCard: React.FC<{ x: SentItem; lang: AdminLang; isDark: boolean; me: string; open: boolean; onToggle: () => void }> = ({ x, lang, isDark, me, open, onToggle }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const purple = isDark ? { color: '#C9B8FF', bg: 'rgba(157,143,232,.13)' } : { color: '#6941C6', bg: '#F1EDFD' };
  const tag = x.task ? { ...purple, text: L('Görev', 'Task') } : { color: 'var(--a-accent)', bg: 'var(--a-accent-tint)', text: L('Duyuru', 'Announcement') };
  return (
    <article className="rounded-[14px]" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)' }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center h-6 px-2 rounded-md text-[12px]" style={{ color: tag.color, background: tag.bg }}>{tag.text}</span>
          <div className="text-[14.5px] mt-2 break-words">{x.title}</div>
          <div className="text-[12.5px] mt-1 break-words" style={{ color: 'var(--a-faint)' }}>
            {[timeText(x.createdAt, lang), audienceLabel(x, L), x.by !== me ? x.byName || x.by : ''].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex items-center gap-5 sm:gap-6 shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 flex-1">
            <Progress label={L('Okudu', 'Read')} a={x.readCount} b={x.count} color="var(--a-accent)" />
            {x.task && <Progress label={L('Tamamladı', 'Done')} a={x.doneCount} b={x.count} color="var(--a-success)" />}
          </div>
          <span style={{ color: 'var(--a-faint)', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}><Icon name="chevronRight" size={16} /></span>
        </div>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5">
          {x.body && <p className="m-0 mb-3 text-[13px] leading-relaxed" style={{ color: 'var(--a-text2)', whiteSpace: 'pre-wrap' }}>{x.body}</p>}
          {x.link && <p className="m-0 mb-3 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('İlgili sayfa', 'Linked page')}: {L(SECTION_NAMES[x.link.section]?.tr || x.link.section, SECTION_NAMES[x.link.section]?.en || x.link.section)}</p>}
          <div>
            {x.recipients.map((r) => (
              <div key={r.email} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_160px_170px] items-center gap-x-4 gap-y-1 py-3 text-[13px]" style={{ borderTop: '1px solid var(--a-line)' }}>
                <div className="flex items-center gap-3 min-w-0 row-span-2 sm:row-span-1">
                  <Initials text={initials(r.name, r.email)} />
                  <div className="min-w-0">
                    <div className="truncate">{r.name || r.email}</div>
                    <div className="text-[12px] truncate" style={{ color: 'var(--a-faint)' }}>{r.positionName || (r.name ? r.email : L('Süper yönetici', 'Super admin'))}</div>
                  </div>
                </div>
                <span className="text-right sm:text-left text-[12.5px]" style={{ color: r.readAt ? 'var(--a-text2)' : 'var(--a-faint)' }}>{r.readAt ? L(`Okudu · ${timeText(r.readAt, lang)}`, `Read · ${timeText(r.readAt, lang)}`) : L('Okumadı', 'Not read')}</span>
                {x.task && (
                  <span className="text-right sm:text-left text-[12.5px] inline-flex items-center justify-end sm:justify-start gap-1.5" style={{ color: r.doneAt ? 'var(--a-success)' : 'var(--a-faint)' }}>
                    {r.doneAt ? <><Icon name="check" size={13} />{L(`Tamamladı · ${timeText(r.doneAt, lang)}`, `Done · ${timeText(r.doneAt, lang)}`)}</> : L('Bekliyor', 'Pending')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

// =====================================================================
// BİLDİRİM GÖNDER
// =====================================================================

type Person = { email: string; name: string; sub: string; superAdmin: boolean; positionId: string | null };

const ComposeDialog: React.FC<{ lang: AdminLang; me: string; onClose: () => void; onSent: (count: number) => void }> = ({ lang, me, onClose, onSent }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const team = useRemote<TeamOverview>(() => teamOverview(), 'compose');
  const [mode, setMode] = useState<SendInput['mode']>('positions');
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [positions, setPositions] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [section, setSection] = useState<LinkSection | ''>('');
  const [task, setTask] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meLower = me.toLowerCase();

  // Gönderilebilecek kişiler: etkin / davetli ekip üyeleri ve diğer süper yönetici (sunucuyla aynı kural)
  const everyone: Person[] = useMemo(() => (team.data?.members || [])
    .filter((m) => m.email.toLowerCase() !== meLower && (m.superAdmin || m.status === 'active' || m.status === 'invited'))
    .map((m) => ({
      email: m.email, name: m.name, superAdmin: m.superAdmin, positionId: m.positionId,
      sub: m.superAdmin ? L('Süper yönetici', 'Super admin') : [m.positionName || L('Pozisyon yok', 'No position'), m.status === 'invited' ? L('davetli', 'invited') : ''].filter(Boolean).join(' · '),
    })), [team.data, meLower]); // eslint-disable-line react-hooks/exhaustive-deps
  const posCount = (id: string) => everyone.filter((p) => !p.superAdmin && p.positionId === id).length;

  const recipients: Person[] = mode === 'all' ? everyone
    : mode === 'positions' ? everyone.filter((p) => !p.superAdmin && p.positionId && positions.has(p.positionId))
      : everyone.filter((p) => people.has(p.email));
  const t = title.trim();
  const titleOk = t.length >= 3 && t.length <= TITLE_MAX;
  const bodyOk = body.trim().length <= BODY_MAX;
  const canSend = !busy && titleOk && bodyOk && recipients.length > 0;

  const ql = q.trim().toLocaleLowerCase('tr-TR');
  const filteredPeople = everyone.filter((p) => !ql || p.name.toLocaleLowerCase('tr-TR').includes(ql) || p.email.includes(ql) || p.sub.toLocaleLowerCase('tr-TR').includes(ql));

  const submit = async () => {
    if (!canSend) return;
    setBusy(true); setErr(null);
    try {
      const r = await sendNotification({
        mode,
        emails: mode === 'people' ? recipients.map((p) => p.email) : undefined,
        positionIds: mode === 'positions' ? [...positions] : undefined,
        title: t,
        body: body.trim(),
        task,
        link: section ? { section } : null,
      });
      onSent(r.count);
    } catch (e) {
      setErr(errorText(e, lang));
      setBusy(false);
    }
  };

  const names = recipients.map((p) => p.name || p.email);
  const preview = names.length <= 5 ? names.join(', ') : L(`${names.slice(0, 5).join(', ')} ve ${names.length - 5} kişi daha`, `${names.slice(0, 5).join(', ')} and ${names.length - 5} more`);
  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); fn(n); };
  const field = { background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' };
  const label = 'text-[12.5px] mb-2 flex justify-between gap-3';

  return (
    <Dialog
      title={L('Bildirim gönder', 'Send notification')}
      icon="send"
      width={620}
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-[12px] sm:mr-auto" style={{ color: 'var(--a-faint)' }}>
            {recipients.length ? L(`${nf.format(recipients.length)} kişiye gidecek · Denetim Kayıtları'na yazılır`, `${recipients.length} recipients · logged`) : L('Alıcı seçin', 'Choose recipients')}
          </span>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
            <Btn variant="primary" icon="send" disabled={!canSend} onClick={submit}>{busy ? L('Gönderiliyor…', 'Sending…') : L('Gönder', 'Send')}</Btn>
          </div>
        </div>
      )}
    >
      {team.error && <ErrorPanel error={team.error} lang={lang} onRetry={team.reload} />}
      {!team.data && !team.error && <SkeletonRows rows={3} h={44} />}
      {team.data && (
        <>
          <div className={label} style={{ color: 'var(--a-muted)' }}>{L('Kime', 'To')}</div>
          <div className="inline-flex p-[3px] rounded-[9px]" role="radiogroup" aria-label={L('Alıcı türü', 'Recipient type')} style={{ background: 'var(--a-seg)', border: '1px solid var(--a-line)' }}>
            {([['people', L('Kişiler', 'People')], ['positions', L('Pozisyon', 'Position')], ['all', L('Tüm ekip', 'Whole team')]] as [SendInput['mode'], string][]).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                onClick={() => setMode(id)}
                className="h-[30px] px-3.5 rounded-[7px] text-[12.5px] transition-colors"
                style={{ background: mode === id ? 'var(--a-seg-on)' : undefined, color: mode === id ? 'var(--a-text)' : 'var(--a-muted)' }}
              >
                {text}
              </button>
            ))}
          </div>

          {mode === 'positions' && (
            <div className="mt-3 flex flex-col gap-1.5 max-h-[210px] overflow-y-auto pr-1">
              {team.data.positions.map((p) => {
                const c = posCount(p.id);
                const on = positions.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[9px] ${c ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'}`} style={{ border: `1px solid ${on ? 'var(--a-line3)' : 'var(--a-line)'}`, background: on ? 'var(--a-hover)' : undefined }}>
                    <input type="checkbox" checked={on} disabled={!c} onChange={() => toggle(positions, p.id, setPositions)} className="w-4 h-4" style={{ accentColor: 'var(--a-text)' }} aria-label={p.name} />
                    <span className="flex-1 min-w-0 truncate text-[13.5px]" style={{ color: 'var(--a-text)' }}>{p.name}</span>
                    <span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{c ? L(`${c} kişi`, `${c}`) : L('etkin üye yok', 'no active members')}</span>
                  </label>
                );
              })}
            </div>
          )}

          {mode === 'people' && (
            <div className="mt-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L('Ad, e-posta ya da pozisyon ara', 'Search name, email or position')}
                aria-label={L('Kişi ara', 'Search people')}
                className="w-full h-10 px-3 rounded-lg text-[13.5px] outline-none box-border"
                style={field}
              />
              <div className="mt-2 flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
                {filteredPeople.map((p) => {
                  const on = people.has(p.email);
                  return (
                    <label key={p.email} className="flex items-center gap-3 px-3 py-2 rounded-[9px] cursor-pointer" style={{ border: `1px solid ${on ? 'var(--a-line3)' : 'transparent'}`, background: on ? 'var(--a-hover)' : undefined }}>
                      <input type="checkbox" checked={on} onChange={() => toggle(people, p.email, setPeople)} className="w-4 h-4" style={{ accentColor: 'var(--a-text)' }} aria-label={p.name || p.email} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13.5px]" style={{ color: 'var(--a-text)' }}>{p.name || p.email}</span>
                        <span className="block truncate text-[12px]" style={{ color: 'var(--a-faint)' }}>{p.name ? `${p.email} · ${p.sub}` : p.sub}</span>
                      </span>
                    </label>
                  );
                })}
                {filteredPeople.length === 0 && <p className="m-0 py-3 text-center text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{everyone.length ? L('Eşleşen kişi yok', 'No match') : L('Ekipte gönderilebilecek kimse yok', 'No one to send to')}</p>}
              </div>
            </div>
          )}

          {mode === 'all' && (
            <p className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Askıdakiler dışında bütün ekip üyelerine ve diğer süper yöneticiye gider.', 'Goes to every member except suspended ones, and the other super admin.')}</p>
          )}
          {recipients.length > 0 && mode !== 'all' && <p className="m-0 mt-2.5 text-[12px] break-words" style={{ color: 'var(--a-faint)' }}>{preview}</p>}

          <label className="block mt-5">
            <span className={label} style={{ color: 'var(--a-muted)' }}><span>{L('Başlık', 'Title')}</span><span style={{ color: t.length > TITLE_MAX ? 'var(--a-danger)' : 'var(--a-faint)' }}>{t.length} / {TITLE_MAX}</span></span>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX + 20))} maxLength={TITLE_MAX + 20} placeholder={L('Örn. Bu hafta 300 QR basılıp satışa çıkarılsın', 'e.g. Print and release 300 QR this week')} className="w-full h-10 px-3 rounded-lg text-[14px] outline-none box-border" style={field} />
          </label>
          <label className="block mt-4">
            <span className={label} style={{ color: 'var(--a-muted)' }}><span>{L('Mesaj', 'Message')} <span style={{ color: 'var(--a-faint)' }}>{L('(isteğe bağlı)', '(optional)')}</span></span><span style={{ color: body.trim().length > BODY_MAX ? 'var(--a-danger)' : 'var(--a-faint)' }}>{body.trim().length} / {BODY_MAX}</span></span>
            <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX + 50))} rows={4} className="w-full px-3 py-2.5 rounded-lg text-[13.5px] outline-none resize-y box-border leading-relaxed" style={field} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <label className="block">
              <span className={label} style={{ color: 'var(--a-muted)' }}><span>{L('İlgili sayfa', 'Linked page')} <span style={{ color: 'var(--a-faint)' }}>{L('(isteğe bağlı)', '(optional)')}</span></span></span>
              <select value={section} onChange={(e) => setSection(e.target.value as LinkSection | '')} className="w-full h-10 px-3 rounded-lg text-[13.5px] outline-none box-border" style={field}>
                <option value="">{L('Yok', 'None')}</option>
                {COMPOSE_SECTIONS.map((s) => <option key={s} value={s}>{L(SECTION_NAMES[s].tr, SECTION_NAMES[s].en)}</option>)}
              </select>
            </label>
            <label className="flex gap-3 items-start px-3.5 py-3 rounded-[10px] cursor-pointer sm:mt-[26px]" style={{ border: '1px solid var(--a-line3)' }}>
              <input type="checkbox" checked={task} onChange={(e) => setTask(e.target.checked)} className="w-4 h-4 mt-0.5" style={{ accentColor: 'var(--a-text)' }} />
              <span>
                <span className="block text-[13px]" style={{ color: 'var(--a-text)' }}>{L('Görev olarak gönder', 'Send as a task')}</span>
                <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{L('Alıcı “Tamamlandı” diye işaretler', 'Recipients mark it done')}</span>
              </span>
            </label>
          </div>
          {err && <p role="alert" className="m-0 mt-4 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
        </>
      )}
    </Dialog>
  );
};

// Ekip ve Yetkiler (yalnızca süper yönetici): ekip üyeleri, yönetici ekleme, pozisyonlar ve yetki tablosu, üye detayı.
// Tüm değişiklikler sunucuda doğrulanır ve denetim kaydına yazılır.

import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import { Btn, ConfirmDialog, Dialog, Note, TableWrap, Td, Th, errorText, useToasts } from './lifecycleUi';
import {
  BackLink, Card, ErrorPanel, InfoRow, Initials, NoAccess, SkeletonRows, StatCards, Tabs, Tag,
  fmtAgo, fmtDay, nfFor, useRemote,
} from './customerUi';
import { PERM_GROUPS, permSummary, togglePerm, useAccess } from '../../lib/access';
import {
  MemberStatus, PositionRow, TeamMemberRow, addMember, deletePosition, liftLimit, memberActivityText, removeMember,
  revokeMemberSessions, savePosition, setMemberPosition, setMemberStatus, teamMember, teamOverview,
} from '../../lib/teamService';
import { initials } from '../../lib/directoryService';

interface Props { lang: AdminLang; isDark: boolean; onCrumb: (text: string | null) => void }

type View = { kind: 'list' } | { kind: 'member'; email: string } | { kind: 'position'; id: string | null };

export const AdminTeamView: React.FC<Props> = ({ lang, isDark, onCrumb }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const access = useAccess();
  const [tab, setTab] = useState<'members' | 'positions'>('members');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [version, setVersion] = useState(0);
  const toasts = useToasts();
  const data = useRemote(() => (access.superAdmin ? teamOverview() : Promise.resolve(null)), `team|${version}|${access.superAdmin}`);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => { if (view.kind === 'list') onCrumb(tab === 'positions' ? L('Pozisyonlar', 'Positions') : null); }, [view.kind, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!access.superAdmin) return <NoAccess lang={lang} title={L('Ekip ve Yetkiler', 'Team & Permissions')} note={L('Bu sayfayı yalnızca süper yöneticiler görebilir.', 'Only super admins can see this page.')} />;

  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      {view.kind === 'list' && (
        <TeamList
          lang={lang} tab={tab} onTab={setTab} data={data.data} error={data.error} onRetry={data.reload}
          onOpenMember={(m) => { setView({ kind: 'member', email: m.email }); onCrumb(m.name || m.email); }}
          onOpenPosition={(id, name) => { setView({ kind: 'position', id }); onCrumb(name); }}
          onAdded={(email) => { refresh(); toasts.show(L(`${email} ekibe eklendi. Bu e-postayla giriş yaptığında panele erişebilir.`, `${email} was added.`)); }}
        />
      )}
      {view.kind === 'member' && (
        <MemberDetailView
          key={view.email} lang={lang} isDark={isDark} email={view.email} positions={data.data?.positions || []}
          onBack={() => { setView({ kind: 'list' }); refresh(); }}
          onChanged={(text) => { refresh(); toasts.show(text); }}
          onRemoved={(text) => { setView({ kind: 'list' }); refresh(); toasts.show(text); }}
        />
      )}
      {view.kind === 'position' && (
        <PositionEditor
          key={view.id || 'new'} lang={lang} position={view.id ? data.data?.positions.find((p) => p.id === view.id) || null : null}
          onBack={() => { setTab('positions'); setView({ kind: 'list' }); }}
          onSaved={(text) => { refresh(); toasts.show(text); setTab('positions'); setView({ kind: 'list' }); }}
        />
      )}
      {toasts.node}
    </div>
  );
};

// =====================================================================
// LİSTE (üyeler / pozisyonlar)
// =====================================================================

const STATUS_COLOR: Record<MemberStatus, string> = { active: 'var(--a-success)', invited: 'var(--a-line3)', suspended: '#E3A857' };

export function statusText(s: MemberStatus, tr: boolean): string {
  return s === 'active' ? (tr ? 'Etkin' : 'Active') : s === 'invited' ? (tr ? 'Davet bekliyor' : 'Invited') : (tr ? 'Askıda' : 'Suspended');
}

const StatusLabel: React.FC<{ s: MemberStatus; lang: AdminLang }> = ({ s, lang }) => (
  <span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap" style={{ color: s === 'suspended' ? '#E3A857' : s === 'invited' ? 'var(--a-muted)' : 'var(--a-text2)' }}>
    <i className="w-[7px] h-[7px] rounded-full" style={{ background: STATUS_COLOR[s] }} />{statusText(s, lang === 'tr')}
  </span>
);

const SuperTag: React.FC<{ lang: AdminLang }> = ({ lang }) => (
  <span className="inline-flex items-center h-6 px-2.5 rounded-md text-[12px] whitespace-nowrap" style={{ background: 'var(--a-accent-tint)', color: 'var(--a-accent)' }}>
    {lang === 'tr' ? 'Süper yönetici' : 'Super admin'}
  </span>
);

const CriticalTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center h-[22px] px-2 rounded-[5px] text-[11px] font-medium tracking-[0.2px] whitespace-nowrap" style={{ background: 'var(--a-danger-tint)', color: 'var(--a-danger)' }}>{children}</span>
);

function criticalName(p: string, tr: boolean): string {
  return p === 'act.purge' ? (tr ? 'Kalıcı silme' : 'Permanent delete') : (tr ? 'Müşteri hesabı silme' : 'Customer deletion');
}

function pageNames(perms: string[], tr: boolean): string {
  const set = new Set(perms);
  const names = PERM_GROUPS.filter((g) => set.has(g.view)).map((g) => (tr ? g.tr : g.en));
  return names.length ? names.join(', ') : (tr ? 'Hiçbir sayfa' : 'No pages');
}

/** Pozisyondaki kişiler: üst üste baş harfler + ilk iki ad + kalan sayı */
const MemberStack: React.FC<{ members: { email: string; name: string }[]; lang: AdminLang }> = ({ members, lang }) => {
  if (!members.length) return <span style={{ color: 'var(--a-faint)' }}>{lang === 'tr' ? 'Bu pozisyonda kimse yok' : 'No one yet'}</span>;
  const shown = members.slice(0, 4);
  const names = members.slice(0, 2).map((m) => m.name || m.email.split('@')[0]);
  const rest = members.length - names.length;
  return (
    <span className="inline-flex items-center gap-3 min-w-0" title={members.map((m) => m.name || m.email).join(', ')}>
      <span className="flex shrink-0">
        {shown.map((m, i) => (
          <span key={m.email} className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10.5px] font-medium" style={{ background: 'var(--a-active)', color: 'var(--a-text2)', border: '2px solid var(--a-surface2)', marginLeft: i ? -8 : 0 }}>
            {initials(m.name, m.email)}
          </span>
        ))}
        {members.length > 4 && (
          <span className="w-7 h-7 rounded-full inline-flex items-center justify-center text-[10.5px]" style={{ background: 'var(--a-hover)', color: 'var(--a-muted)', border: '2px solid var(--a-surface2)', marginLeft: -8 }}>+{members.length - 4}</span>
        )}
      </span>
      <span className="truncate" style={{ color: 'var(--a-muted)' }}>
        {names.join(', ')}{rest > 0 ? (lang === 'tr' ? ` ve ${rest} kişi daha` : ` and ${rest} more`) : ''}
      </span>
    </span>
  );
};

const TeamList: React.FC<{
  lang: AdminLang; tab: 'members' | 'positions'; onTab: (t: 'members' | 'positions') => void;
  data: import('../../lib/teamService').TeamOverview | null; error: unknown; onRetry: () => void;
  onOpenMember: (m: TeamMemberRow) => void; onOpenPosition: (id: string | null, name: string) => void; onAdded: (email: string) => void;
}> = ({ lang, tab, onTab, data, error, onRetry, onOpenMember, onOpenPosition, onAdded }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const [adding, setAdding] = useState(false);
  const members = data?.members || [];
  const count = (s: MemberStatus) => members.filter((m) => m.status === s).length;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px]">{L('Ekip ve Yetkiler', 'Team & Permissions')}</h1>
          <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Panele kimlerin girebildiği ve neleri yapabildiği', 'Who can access the panel and what they can do')}</p>
        </div>
        <Btn variant="primary" icon="plus" onClick={() => setAdding(true)} disabled={!data}>{L('Yönetici ekle', 'Add member')}</Btn>
      </div>
      <div className="mt-9">
        <Tabs value={tab} onChange={(t) => onTab(t as 'members' | 'positions')} tabs={[
          { id: 'members', label: L('Ekip üyeleri', 'Members'), count: data ? nf.format(members.length) : undefined },
          { id: 'positions', label: L('Pozisyonlar', 'Positions'), count: data ? nf.format(data.positions.length) : undefined },
        ]} />
      </div>
      {error && <div className="mt-8"><ErrorPanel error={error} lang={lang} onRetry={onRetry} /></div>}
      {!data && !error && <div className="mt-8"><SkeletonRows rows={5} h={64} /></div>}

      {data && tab === 'members' && (
        <>
          <section className="mt-8">
            <StatCards items={[
              { label: L('Ekip üyesi', 'Members'), value: nf.format(members.length), sub: L(`${members.filter((m) => m.superAdmin).length} süper yönetici`, `${members.filter((m) => m.superAdmin).length} super admins`) },
              { label: L('Etkin', 'Active'), value: nf.format(count('active')), sub: L('Panele girebilir', 'Can sign in') },
              { label: L('Davet bekliyor', 'Invited'), value: nf.format(count('invited')), sub: L('Giriş yapınca etkinleşir', 'Activates on first sign-in') },
              { label: L('Askıda', 'Suspended'), value: nf.format(count('suspended')), sub: L('Panele giremez', 'Cannot sign in') },
            ]} />
          </section>
          <section className="mt-12">
            <TableWrap minWidth={820}>
              <thead><tr>
                <Th>{L('Üye', 'Member')}</Th><Th>{L('Pozisyon', 'Position')}</Th><Th>{L('Durum', 'Status')}</Th>
                <Th>{L('Son giriş', 'Last sign-in')}</Th><Th right>{L('Açık oturum', 'Sessions')}</Th><Th w={24} />
              </tr></thead>
              <tbody>
                {members.map((m) => {
                  const clickable = !m.superAdmin;
                  return (
                    <tr
                      key={m.email}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => onOpenMember(m) : undefined}
                      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onOpenMember(m); } : undefined}
                      className={clickable ? 'cursor-pointer transition-colors hover:bg-[var(--a-hover)] focus:outline-none focus-visible:bg-[var(--a-hover)]' : ''}
                    >
                      <Td className="h-[72px]">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {m.status === 'invited' ? <Initials text="" icon="mail" /> : <Initials text={initials(m.name, m.email)} />}
                          <div className="min-w-0">
                            <div className="truncate">{m.status === 'invited' && !m.name ? m.email : (m.name || m.email.split('@')[0])}</div>
                            <div className="text-[12.5px] mt-0.5 truncate max-w-[280px]" style={{ color: 'var(--a-faint)' }}>{m.status === 'invited' && !m.name ? L('Henüz giriş yapmadı', 'Has not signed in yet') : m.email}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>{m.superAdmin ? <SuperTag lang={lang} /> : (m.positionName || <span style={{ color: 'var(--a-faint)' }}>{L('Pozisyon yok', 'No position')}</span>)}</Td>
                      <Td><StatusLabel s={m.status} lang={lang} /></Td>
                      <Td muted>{m.status === 'invited' ? '—' : fmtAgo(m.lastLoginAt, lang)}</Td>
                      <Td right muted>{m.sessions || '—'}</Td>
                      <Td w={24}><span style={{ color: 'var(--a-faint)' }} title={m.superAdmin ? L('Süper yöneticiler bu sayfadan değiştirilemez', 'Super admins cannot be changed here') : undefined}><Icon name={m.superAdmin ? 'lock' : 'chevronRight'} size={15} /></span></Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <div className="mt-9">
              <Card>
                <div className="flex gap-4 items-start">
                  <span className="mt-0.5" style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={17} /></span>
                  <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>
                    {L('Süper yöneticiler (kilit simgeli) bu sayfadan değiştirilemez, askıya alınamaz, çıkarılamaz. Süper yönetici yetkisi kimseye verilemez.', 'Super admins (lock icon) cannot be changed, suspended or removed here.')}
                    <br />{L("Bu sayfayı yalnızca süper yöneticiler görür. Buradaki her değişiklik Denetim Kayıtları'na yazılır.", 'Only super admins see this page. Every change is logged.')}
                  </p>
                </div>
              </Card>
            </div>
          </section>
        </>
      )}

      {data && tab === 'positions' && (
        <>
          <section className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="m-0 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Pozisyon, bir yetki paketidir. Her ekip üyesinin bir pozisyonu olur; pozisyon değişince o pozisyondaki herkese anında uygulanır.', 'A position is a permission bundle. Changes apply to everyone in it immediately.')}</p>
            <Btn icon="plus" onClick={() => onOpenPosition(null, L('Yeni pozisyon', 'New position'))}>{L('Yeni pozisyon', 'New position')}</Btn>
          </section>
          <section className="mt-7 grid md:grid-cols-2 gap-5">
            {data.positions.map((p) => {
              const sum = permSummary(p.perms);
              return (
                <button key={p.id} type="button" onClick={() => onOpenPosition(p.id, p.name)} className="text-left rounded-[14px] p-6 transition-colors hover:bg-[var(--a-hover)]" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-line)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[15.5px] font-medium break-words">{p.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Tag>{p.builtin ? L('Hazır', 'Built-in') : L('Özel', 'Custom')}</Tag>
                        {p.critical.map((c) => <CriticalTag key={c}>{L('KRİTİK', 'CRITICAL')} · {criticalName(c, lang === 'tr')}</CriticalTag>)}
                      </div>
                    </div>
                    <span className="text-[12.5px] shrink-0" style={{ color: 'var(--a-muted)' }}>{L(`${p.members.length} kişi`, `${p.members.length} people`)}</span>
                  </div>
                  <div className="mt-4 text-[13px] leading-relaxed"><span style={{ color: 'var(--a-faint)' }}>{L('Görebildiği', 'Can see')}:</span> {pageNames(p.perms, lang === 'tr')}</div>
                  <div className="mt-1.5 text-[13px]"><span style={{ color: 'var(--a-faint)' }}>{L('Yapabildiği', 'Can do')}:</span> {sum.actions ? L(`${sum.actions} işlem`, `${sum.actions} actions`) : L('İşlem yok', 'No actions')}</div>
                  <div className="mt-4 pt-3.5 flex items-center justify-between gap-3 text-[12.5px]" style={{ borderTop: '1px solid var(--a-line)' }}>
                    <MemberStack members={p.members} lang={lang} />
                    <span className="inline-flex items-center gap-1 shrink-0" style={{ color: 'var(--a-text2)' }}>{L('Düzenle', 'Edit')}<Icon name="chevronRight" size={13} /></span>
                  </div>
                </button>
              );
            })}
          </section>
        </>
      )}

      {adding && data && (
        <AddMemberDialog lang={lang} positions={data.positions} onClose={() => setAdding(false)} onAdded={(email) => { setAdding(false); onAdded(email); }} />
      )}
    </>
  );
};

// =====================================================================
// YÖNETİCİ EKLE
// =====================================================================

const AddMemberDialog: React.FC<{ lang: AdminLang; positions: PositionRow[]; onClose: () => void; onAdded: (email: string) => void }> = ({ lang, positions, onClose, onAdded }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [email, setEmail] = useState('');
  const [positionId, setPositionId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());

  const submit = async () => {
    if (!emailOk || !positionId || busy) return;
    setBusy(true); setErr(null);
    try {
      await addMember(email.trim().toLowerCase(), positionId);
      onAdded(email.trim().toLowerCase());
    } catch (e) {
      setErr(errorText(e, lang));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={L('Yönetici ekle', 'Add member')}
      icon="plus"
      width={560}
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-[12px] sm:mr-auto" style={{ color: 'var(--a-faint)' }}>{L('Pozisyonu sonra değiştirebilirsiniz', 'You can change the position later')}</span>
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
            <Btn variant="primary" disabled={!emailOk || !positionId || busy} onClick={submit}>{busy ? '…' : L('Ekle', 'Add')}</Btn>
          </div>
        </div>
      )}
    >
      <p className="m-0">{L('Kişi bu e-postayla Google ya da e-posta hesabıyla giriş yaptığında panele erişir. Şifre belirlemenize gerek yok.', 'They get access when they sign in with this email (Google or password). No password is set here.')}</p>
      <label className="flex flex-col gap-1.5 mt-5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
        {L('E-posta', 'Email')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          placeholder="ornek@gmail.com"
          className="h-10 px-3 rounded-lg text-[14px] outline-none"
          style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
        />
      </label>
      <div className="mt-5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{L('Pozisyon', 'Position')}</div>
      <div className="flex flex-col gap-2 mt-2 max-h-[300px] overflow-y-auto pr-1" role="radiogroup" aria-label={L('Pozisyon', 'Position')}>
        {positions.map((p) => {
          const on = positionId === p.id;
          const sum = permSummary(p.perms);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={p.name}
              onClick={() => setPositionId(p.id)}
              className="flex gap-3 items-start text-left px-4 py-3 rounded-[10px] transition-colors"
              style={{ border: `1px solid ${on ? 'var(--a-line3)' : 'var(--a-line)'}`, background: on ? 'var(--a-hover)' : undefined }}
            >
              <span className="mt-0.5 w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0" style={{ border: `1.5px solid ${on ? 'var(--a-text)' : 'var(--a-line3)'}` }}>
                {on && <i className="w-2 h-2 rounded-full" style={{ background: 'var(--a-text)' }} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex justify-between gap-3"><span className="text-[13.5px]" style={{ color: 'var(--a-text)' }}>{p.name}</span><span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{L(`${p.members.length} kişi`, `${p.members.length} people`)}</span></span>
                <span className="block text-[12px] mt-1" style={{ color: 'var(--a-faint)' }}>
                  {p.description || pageNames(p.perms, lang === 'tr')}{sum.critical ? L(` · ${sum.critical} kritik yetki`, ` · ${sum.critical} critical`) : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {err && <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
    </Dialog>
  );
};

// =====================================================================
// POZİSYON DÜZENLEME (gruplu yetki tablosu)
// =====================================================================

const Check: React.FC<{ on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, disabled, onChange, label }) => (
  <input
    type="checkbox"
    checked={on}
    disabled={disabled}
    aria-label={label}
    onChange={(e) => onChange(e.target.checked)}
    className="w-[17px] h-[17px] shrink-0 cursor-pointer disabled:cursor-not-allowed"
    style={{ accentColor: 'var(--a-text)' }}
  />
);

const PositionEditor: React.FC<{ lang: AdminLang; position: PositionRow | null; onBack: () => void; onSaved: (text: string) => void }> = ({ lang, position, onBack, onSaved }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [name, setName] = useState(position?.name || '');
  const [description, setDescription] = useState(position?.description || '');
  const [perms, setPerms] = useState<string[]>(position?.perms || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = useMemo(() => new Set(perms), [perms]);
  const sum = permSummary(perms);
  const dirty = !position || name !== position.name || description !== position.description
    || perms.length !== position.perms.length || perms.some((p) => !position.perms.includes(p));
  const nameOk = name.trim().length >= 2 && name.trim().length <= 40;

  const save = async () => {
    if (!nameOk || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await savePosition({ id: position?.id, name: name.trim(), description: description.trim(), perms });
      onSaved(position
        ? L(`Pozisyon kaydedildi${r.affectedMembers ? `; ${r.affectedMembers} kişiye anında uygulandı` : ''}.`, 'Position saved.')
        : L('Pozisyon oluşturuldu.', 'Position created.'));
    } catch (e) {
      setErr(errorText(e, lang));
      setBusy(false);
    }
  };

  return (
    <>
      <BackLink label={L('Pozisyonlar', 'Positions')} onClick={onBack} />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-5">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px] break-words">{position ? position.name : L('Yeni pozisyon', 'New position')}</h1>
          <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>
            {position ? `${position.builtin ? L('Hazır pozisyon', 'Built-in') : L('Özel pozisyon', 'Custom')} · ${L(`${position.members.length} kişi`, `${position.members.length} people`)}` : L('Boş başlar; vermek istediğiniz yetkileri tek tek seçin.', 'Starts empty; pick each permission.')}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Btn onClick={onBack} disabled={busy}>{L('Vazgeç', 'Cancel')}</Btn>
          <Btn variant="primary" onClick={save} disabled={busy || !nameOk || !dirty}>{busy ? '…' : position ? L('Değişiklikleri kaydet', 'Save changes') : L('Pozisyonu oluştur', 'Create position')}</Btn>
        </div>
      </div>
      {err && <div className="mt-6"><ErrorPanel error={{ code: 'functions/x', message: err }} lang={lang} /></div>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-7 mt-8">
        <div className="min-w-0">
          <Card>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
                {L('Pozisyon adı', 'Name')}
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} maxLength={40} className="h-10 px-3 rounded-lg text-[14px] outline-none" style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }} />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px]" style={{ color: 'var(--a-muted)' }}>
                {L('Açıklama (isteğe bağlı)', 'Description (optional)')}
                <input value={description} onChange={(e) => setDescription(e.target.value.slice(0, 120))} maxLength={120} className="h-10 px-3 rounded-lg text-[14px] outline-none" style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }} />
              </label>
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-4 mt-5 items-start">
            {PERM_GROUPS.map((g) => {
              const view = set.has(g.view);
              return (
                <section key={g.page} className="rounded-[14px] px-5 py-4" style={{ background: 'var(--a-surface2)', border: `1px solid ${view ? 'var(--a-line3)' : 'var(--a-line)'}` }} aria-label={lang === 'tr' ? g.tr : g.en}>
                  <div className="flex items-center justify-between gap-3 pb-3">
                    <span className="text-[14px] font-medium">{lang === 'tr' ? g.tr : g.en}</span>
                    <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: view ? 'var(--a-text)' : 'var(--a-muted)' }}>
                      <Check on={view} onChange={(v) => setPerms((p) => togglePerm(p, g.view, v))} label={L(`${g.tr}: sayfayı görebilir`, `${g.en}: can view`)} />
                      {L('Sayfayı görebilir', 'Can view page')}
                    </label>
                  </div>
                  {g.actions.length === 0 && (
                    <div className="text-[12px] py-3" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)', opacity: view ? 1 : 0.5 }}>{L('Bu sayfada işlem yok; yalnızca görüntüleme', 'View only')}</div>
                  )}
                  {g.actions.map((a) => {
                    const on = set.has(a.key) && view;
                    return (
                      <label key={a.key} className={`flex gap-3 items-start py-3 ${view ? 'cursor-pointer' : 'cursor-not-allowed'}`} style={{ borderTop: '1px solid var(--a-line)', opacity: view ? 1 : 0.45 }}>
                        <Check on={on} disabled={!view} onChange={(v) => setPerms((p) => togglePerm(p, a.key, v, g.view))} label={lang === 'tr' ? a.tr : a.en} />
                        <span className="flex-1 min-w-0 -mt-px">
                          <span className="flex flex-wrap items-center gap-2 text-[13px]">{lang === 'tr' ? a.tr : a.en}{a.critical && <CriticalTag>{L('KRİTİK', 'CRITICAL')}</CriticalTag>}</span>
                          {(a.critical || a.note) && (
                            <span className="block text-[11.5px] mt-1" style={{ color: 'var(--a-faint)' }}>
                              {a.critical ? (a.key === 'act.purge' ? L('Her işlemde şifre ve sebep istenir · günde en fazla 200 QR', 'Password and reason every time · max 200/day') : L('Her işlemde şifre ve sebep istenir · günde en fazla 10 hesap', 'Password and reason every time · max 10/day')) : (lang === 'tr' ? a.note!.tr : a.note!.en)}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card title={L('Özet', 'Summary')}>
            <InfoRow first label={L('Görebildiği sayfa', 'Pages')}>{sum.pages} / {PERM_GROUPS.length}</InfoRow>
            <InfoRow label={L('Yapabildiği işlem', 'Actions')}>{sum.actions}</InfoRow>
            <InfoRow label={L('Kritik yetki', 'Critical')}><span style={{ color: sum.critical ? 'var(--a-danger)' : undefined }}>{sum.critical}</span></InfoRow>
            {position && <InfoRow label={L('Bu pozisyonda', 'People')}>{L(`${position.members.length} kişi`, `${position.members.length}`)}</InfoRow>}
          </Card>
          <Card>
            <div className="flex gap-2.5 items-center text-[13.5px] font-medium"><span style={{ color: 'var(--a-danger)' }}><Icon name="alert" size={16} /></span>{L('Kritik yetkiler', 'Critical permissions')}</div>
            <p className="m-0 mt-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>{L('Bu yetkiyi alan kişi her işlemde şifresini yeniden girer ve sebep yazar. Günlük sınır dolunca işlem durur, süper yöneticilere bildirim gider; kısıt kaldırılabilir.', 'Password and reason are required each time. A daily limit applies; super admins are notified.')}</p>
          </Card>
          <Card>
            <div className="flex gap-2.5 items-center text-[13.5px] font-medium"><span style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={16} /></span>{L('Kimseye verilemeyenler', 'Never delegable')}</div>
            <p className="m-0 mt-2.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>{L('Ekip ve yetki yönetimi, süper yönetici yapma. Bunlar yalnızca süper yöneticilerdedir.', 'Team management and super admin rights stay with super admins.')}</p>
          </Card>
          <p className="m-0 mx-1 text-[12px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>{L("Kaydedince bu pozisyondaki herkese anında uygulanır. Görme yetkisi kaldırılan sayfanın işlemleri de kalkar. Değişiklik Denetim Kayıtları'na yazılır.", 'Applies to everyone immediately once saved.')}</p>
          {position && !position.builtin && (
            <div>
              <Btn variant="danger" icon="trash" disabled={busy || position.members.length > 0} title={position.members.length ? L('Önce bu pozisyondaki kişileri başka bir pozisyona taşıyın', 'Move members first') : undefined} onClick={() => setConfirmDelete(true)}>{L('Pozisyonu sil', 'Delete position')}</Btn>
              {position.members.length > 0 && <p className="m-0 mt-2 text-[11.5px]" style={{ color: 'var(--a-faint)' }}>{L('Üyesi olan pozisyon silinemez.', 'Positions with members cannot be deleted.')}</p>}
            </div>
          )}
        </div>
      </div>
      {confirmDelete && position && (
        <ConfirmDialog
          title={L(`"${position.name}" silinsin mi?`, `Delete "${position.name}"?`)} icon="trash" danger
          confirmLabel={L('Sil', 'Delete')} cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try { await deletePosition(position.id); onSaved(L('Pozisyon silindi.', 'Position deleted.')); } catch (e) { setErr(errorText(e, lang)); setConfirmDelete(false); }
          }}
        >
          <p className="m-0">{L('Bu işlem geri alınamaz.', 'This cannot be undone.')}</p>
        </ConfirmDialog>
      )}
    </>
  );
};

// =====================================================================
// ÜYE DETAYI
// =====================================================================

const MemberDetailView: React.FC<{
  lang: AdminLang; isDark: boolean; email: string; positions: PositionRow[];
  onBack: () => void; onChanged: (text: string) => void; onRemoved: (text: string) => void;
}> = ({ lang, email, positions, onBack, onChanged, onRemoved }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [version, setVersion] = useState(0);
  const r = useRemote(() => teamMember(email), `${email}|${version}`);
  const m = r.data;
  const [pos, setPos] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'suspend' | 'remove' | 'sessions'>(null);
  useEffect(() => { if (m) setPos(m.positionId || ''); }, [m?.positionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = () => setVersion((v) => v + 1);

  const run = async (fn: () => Promise<unknown>, text: string) => {
    setBusy(true); setErr(null);
    try { await fn(); onChanged(text); reload(); } catch (e) { setErr(errorText(e, lang)); } finally { setBusy(false); }
  };

  const posRow = positions.find((p) => p.id === (m?.positionId || ''));
  return (
    <>
      <BackLink label={L('Ekip ve Yetkiler', 'Team & Permissions')} onClick={onBack} />
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!m && !r.error && <div className="mt-6"><SkeletonRows rows={4} h={90} /></div>}
      {m && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mt-6">
            {m.status === 'invited' ? <Initials text="" icon="mail" large /> : <Initials text={initials(m.name, m.email)} large />}
            <div className="flex-1 min-w-0">
              <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px] break-words">{m.name || m.email}</h1>
              <div className="mt-2 text-[13px] break-all" style={{ color: 'var(--a-faint)' }}>
                {m.email}{m.invitedAt ? ` · ${L(`${fmtDay(m.invitedAt, lang)} tarihinde eklendi`, `added ${fmtDay(m.invitedAt, lang)}`)}` : ''}{m.invitedBy ? ` · ${L('ekleyen', 'by')} ${m.invitedBy.split('@')[0]}` : ''}
              </div>
            </div>
            <StatusLabel s={m.status} lang={lang} />
          </div>
          {err && <div className="mt-6"><ErrorPanel error={{ code: 'functions/x', message: err }} lang={lang} /></div>}

          <div className="grid lg:grid-cols-2 gap-5 mt-10">
            <Card title={L('Pozisyon', 'Position')}>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <select
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  aria-label={L('Pozisyon', 'Position')}
                  className="h-10 px-3 rounded-lg text-[14px] outline-none flex-1"
                  style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
                >
                  {!m.positionId && <option value="">{L('Pozisyon seçin', 'Choose a position')}</option>}
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Btn variant="primary" disabled={busy || !pos || pos === m.positionId} onClick={() => run(() => setMemberPosition(m.email, pos), L('Pozisyon değiştirildi; yeni yetkiler hemen geçerli.', 'Position changed.'))}>{L('Kaydet', 'Save')}</Btn>
              </div>
              {posRow && (
                <>
                  <div className="mt-4 text-[13px] leading-relaxed"><span style={{ color: 'var(--a-faint)' }}>{L('Görebildiği', 'Can see')}:</span> {pageNames(posRow.perms, lang === 'tr')}</div>
                  <div className="mt-1.5 text-[13px]"><span style={{ color: 'var(--a-faint)' }}>{L('Yapabildiği', 'Can do')}:</span> {L(`${permSummary(posRow.perms).actions} işlem`, `${permSummary(posRow.perms).actions} actions`)}{permSummary(posRow.perms).critical ? <span style={{ color: 'var(--a-danger)' }}> · {L(`${permSummary(posRow.perms).critical} kritik`, 'critical')}</span> : null}</div>
                </>
              )}
            </Card>
            <Card title={L('Bugünkü kritik işlemler', "Today's critical actions")} sub={L('Gece yarısı sıfırlanır', 'Resets at midnight')}>
              {m.quota.map((q, i) => {
                const label = q.kind === 'user_delete' ? L('Müşteri hesabı silme', 'Customer deletions') : L('Kalıcı QR silme', 'Permanent QR deletions');
                if (!q.allowed) return <InfoRow key={q.kind} first={i === 0} label={label}><span style={{ color: 'var(--a-faint)' }}>{L('Yetkisi yok', 'Not allowed')}</span></InfoRow>;
                const pct = Math.min(100, (q.used / q.limit) * 100);
                const full = q.used >= q.limit && !q.lifted;
                return (
                  <div key={q.kind} className="py-4" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                    <div className="flex justify-between text-[13.5px]"><span style={{ color: 'var(--a-muted)' }}>{label}</span><span>{q.used} / {q.lifted ? '∞' : q.limit}</span></div>
                    <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ background: 'var(--a-line)' }}>
                      <span className="block h-full" style={{ width: `${q.lifted ? 100 : pct}%`, background: q.lifted ? 'var(--a-accent)' : pct >= 70 ? '#E3A857' : 'var(--a-success)' }} />
                    </div>
                    {q.lifted && <div className="text-[12px] mt-2" style={{ color: 'var(--a-faint)' }}>{L('Bugünkü sınır kaldırıldı', 'Limit lifted today')}</div>}
                    {full && (
                      <div className="flex items-center justify-between gap-3 mt-3">
                        <span className="text-[12px]" style={{ color: '#E3A857' }}>{L('Sınır doldu; yeni işlemler durdu', 'Limit reached')}</span>
                        <Btn small variant="primary" disabled={busy} onClick={() => run(() => liftLimit(m.email, q.kind), L('Bugünlük kısıt kaldırıldı.', 'Limit lifted for today.'))}>{L('Bugünlük kısıtı kaldır', 'Lift for today')}</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card title={L('Açık oturumlar', 'Open sessions')} right={m.sessions.length > 0 && <Btn small disabled={busy} onClick={() => setConfirm('sessions')}>{L('Tümünü kapat', 'Close all')}</Btn>}>
              {m.sessions.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Açık oturum yok.', 'No open sessions.')}</p>}
              {m.sessions.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3.5 py-4" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <span style={{ color: 'var(--a-faint)' }}><Icon name="devices" size={17} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{s.device || L('Bilinmeyen cihaz', 'Unknown device')}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{L('Açıldı', 'Opened')} {fmtAgo(s.createdAt, lang)} · {L('son etkinlik', 'last active')} {fmtAgo(s.lastActiveAt, lang)}</div>
                  </div>
                  <Btn small disabled={busy} onClick={() => run(() => revokeMemberSessions(m.email, s.id), L('Oturum kapatıldı.', 'Session closed.'))}>{L('Kapat', 'Close')}</Btn>
                </div>
              ))}
            </Card>
            <Card title={L('Son işlemler', 'Recent activity')}>
              {m.activity.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Kayıt yok.', 'Nothing yet.')}</p>}
              {m.activity.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3.5" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px]">{memberActivityText(a.kind, lang === 'tr')}</div>
                    {a.detail && <div className="text-[12px] mt-1 truncate" style={{ color: 'var(--a-faint)', fontFamily: /^[A-Z0-9]{12}$/.test(a.detail) ? "'IBM Plex Mono', ui-monospace, monospace" : undefined }}>{a.detail}</div>}
                  </div>
                  <span className="text-[12.5px] shrink-0" style={{ color: 'var(--a-faint)' }}>{fmtAgo(a.at, lang)}</span>
                </div>
              ))}
            </Card>
          </div>

          <section className="mt-5 rounded-[14px] p-6 sm:p-7 flex flex-col md:flex-row md:items-center gap-5 justify-between" style={{ background: 'var(--a-surface2)', border: '1px solid var(--a-danger-line)' }}>
            <div>
              <div className="text-[14.5px] font-medium">{L('Erişimi durdur', 'Stop access')}</div>
              <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>{L('Askıya alınan kişi panele giremez, açık oturumları anında kapanır; daha sonra geri açılabilir. Ekipten çıkarılan kişinin geçmiş işlemleri silinmez.', 'Suspended members cannot sign in; open sessions close immediately.')}</p>
            </div>
            <div className="flex gap-2.5 shrink-0">
              {m.status === 'suspended'
                ? <Btn disabled={busy} onClick={() => run(() => setMemberStatus(m.email, 'active'), L('Erişim yeniden açıldı.', 'Access restored.'))}>{L('Yeniden aç', 'Reactivate')}</Btn>
                : <Btn disabled={busy} onClick={() => setConfirm('suspend')}>{L('Askıya al', 'Suspend')}</Btn>}
              <Btn variant="danger" disabled={busy} onClick={() => setConfirm('remove')}>{L('Ekipten çıkar', 'Remove')}</Btn>
            </div>
          </section>
          <div className="mt-8"><Note>{L("Bu sayfadaki her değişiklik Denetim Kayıtları'na yazılır.", 'Every change here is logged.')}</Note></div>

          {confirm && (
            <ConfirmDialog
              title={confirm === 'suspend' ? L(`${m.name || m.email} askıya alınsın mı?`, 'Suspend?') : confirm === 'remove' ? L(`${m.name || m.email} ekipten çıkarılsın mı?`, 'Remove from team?') : L('Tüm oturumları kapatılsın mı?', 'Close all sessions?')}
              icon={confirm === 'remove' ? 'trash' : confirm === 'suspend' ? 'ban' : 'logout'}
              danger
              confirmLabel={confirm === 'suspend' ? L('Askıya al', 'Suspend') : confirm === 'remove' ? L('Ekipten çıkar', 'Remove') : L('Hepsini kapat', 'Close all')}
              cancelLabel={L('Vazgeç', 'Cancel')}
              onClose={() => setConfirm(null)}
              onConfirm={async () => {
                const kind = confirm;
                setConfirm(null);
                if (kind === 'suspend') await run(() => setMemberStatus(m.email, 'suspended'), L('Askıya alındı; açık oturumları kapatıldı.', 'Suspended.'));
                else if (kind === 'sessions') await run(() => revokeMemberSessions(m.email), L('Tüm oturumlar kapatıldı.', 'All sessions closed.'));
                else {
                  setBusy(true);
                  try { await removeMember(m.email); onRemoved(L(`${m.email} ekipten çıkarıldı.`, 'Removed.')); } catch (e) { setErr(errorText(e, lang)); setBusy(false); }
                }
              }}
            >
              <p className="m-0">
                {confirm === 'suspend' ? L('Kişi panele giremez ve açık oturumları anında kapanır. Daha sonra yeniden açabilirsiniz.', 'They cannot sign in until reactivated.')
                  : confirm === 'remove' ? L('Kişinin panel erişimi ve oturumları kaldırılır. Geçmiş işlemleri Denetim Kayıtları\'nda kalır. Tekrar eklemek için yeniden davet etmeniz gerekir.', 'Access and sessions are removed; history stays.')
                    : L('Kişi tüm cihazlarda panelden çıkış yapar.', 'They are signed out everywhere.')}
              </p>
            </ConfirmDialog>
          )}
        </>
      )}
    </>
  );
};



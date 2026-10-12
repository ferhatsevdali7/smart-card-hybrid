// Kullanıcılar: hesaplar listesi, silinmiş hesaplar ve kullanıcı detayı
// Veriler Cloud Functions'tan gelir; telefon numarası her zaman maskelidir (tam numaraya erişim yok).

import React, { useEffect, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import { Note, TableWrap, Th, Td, stageColor, stageLabel } from './lifecycleUi';
import {
  BackLink, BigSearch, Card, ColorDot, ErrorPanel, InfoRow, Initials, NoAccess, Pager, Plate, SkeletonRows,
  StatCards, StatusDot, Tabs, Tag, fmtAgo, fmtDay, nfFor, useCursorPages, useDebounced, useRemote,
} from './customerUi';
import {
  DISABLE_REASON, TagSummary, UserFilter, activityText, canViewCustomers, ensureDirectory, getUser, initials,
  listDeleted, listUsers, providerLabel, userStats,
} from '../../lib/directoryService';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  role: string;
  detailUid: string | null;
  onOpenUser: (uid: string, name: string) => void;
  onCloseUser: () => void;
  onOpenVehicle: (vehicleId: string, plate: string) => void;
}

export const AdminUsersView: React.FC<Props> = (p) => {
  const L = (tr: string, en: string) => (p.lang === 'tr' ? tr : en);
  if (!canViewCustomers(p.role)) return <NoAccess lang={p.lang} title={L('Kullanıcılar', 'Users')} />;
  return (
    <>
      {/* Liste detay açıkken de yerinde kalır: geri dönünce arama ve sayfa kaybolmaz. */}
      <div className={p.detailUid ? 'hidden' : ''}><UsersList {...p} /></div>
      {p.detailUid && <UserDetailView key={p.detailUid} {...p} uid={p.detailUid} />}
    </>
  );
};

// =====================================================================
// LİSTE
// =====================================================================

const UsersList: React.FC<Props> = ({ lang, onOpenUser }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'accounts' | 'deleted'>('accounts');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);
  const [filter, setFilter] = useState<UserFilter>('all');

  useEffect(() => {
    let alive = true;
    ensureDirectory().catch((e) => console.warn('[directory]', e)).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const stats = useRemote(() => userStats(), `stats|${ready}`);
  const pages = useCursorPages(`${dq}|${filter}`);
  const list = useRemote(
    () => (ready ? listUsers(dq, filter, pages.cursor) : Promise.resolve(null)),
    `${ready}|${dq}|${filter}|${pages.cursor}`,
  );
  const delPages = useCursorPages('deleted');
  const deleted = useRemote(
    () => (ready && tab === 'deleted' ? listDeleted(delPages.cursor) : Promise.resolve(null)),
    `${ready}|${tab}|${delPages.cursor}`,
  );

  const s = stats.data;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const rows = list.data?.rows || [];
  const searching = !!dq;
  const total = s ? s.chips[filter] : null;
  const from = (pages.page - 1) * 25 + 1;

  const FILTERS: { id: UserFilter; label: string }[] = [
    { id: 'all', label: L('Tümü', 'All') },
    { id: 'no_qr', label: L("QR'ı olmayan", 'No QR') },
    { id: 'push_off', label: L('Bildirimi kapalı', 'Notifications off') },
    { id: 'recent', label: L('Son 7 gün', 'Last 7 days') },
  ];

  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px]">{L('Kullanıcılar', 'Users')}</h1>
      <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Uygulamaya kayıtlı bütün hesaplar', 'All accounts registered in the app')}</p>

      <div className="mt-9">
        <Tabs
          value={tab}
          onChange={(t) => setTab(t as 'accounts' | 'deleted')}
          tabs={[
            { id: 'accounts', label: L('Hesaplar', 'Accounts'), count: s ? nf.format(s.total) : undefined },
            { id: 'deleted', label: L('Silinmiş hesaplar', 'Deleted accounts'), count: s ? nf.format(s.deleted.total) : undefined },
          ]}
        />
      </div>

      {stats.error && <div className="mt-8"><ErrorPanel error={stats.error} lang={lang} onRetry={stats.reload} /></div>}

      {tab === 'accounts' && (
        <>
          <section className="mt-8">
            {s ? (
              <StatCards items={[
                { label: L('Toplam kullanıcı', 'Total users'), value: nf.format(s.total), sub: L(`Bu ay ${nf.format(s.newMonth)} yeni`, `${s.newMonth} new this month`) },
                { label: L('QR bağlamış', 'Linked a QR'), value: nf.format(s.withQr), sub: L(`Kullanıcıların %${pct(s.withQr, s.total)}'i`, `${pct(s.withQr, s.total)}% of users`) },
                { label: L('Bildirimi açık', 'Notifications on'), value: nf.format(s.pushOn), sub: L(`Kullanıcıların %${pct(s.pushOn, s.total)}'i`, `${pct(s.pushOn, s.total)}% of users`) },
                { label: L('Ana ekrana eklemiş', 'Added to home screen'), value: nf.format(s.home), sub: s.homeUnknown ? L(`${nf.format(s.homeUnknown)} kişi için bilinmiyor`, `Unknown for ${s.homeUnknown}`) : L('Tüm kullanıcılar için biliniyor', 'Known for everyone') },
              ]} />
            ) : !stats.error && <SkeletonRows rows={1} h={112} />}
          </section>

          <section className="mt-12">
            <BigSearch value={q} onChange={setQ} placeholder={L('Ad, e-posta veya plaka ile ara', 'Search by name, email or plate')} busy={list.loading && searching} />
            <div className="flex flex-wrap gap-1 mt-4">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className="inline-flex items-center gap-[7px] h-[30px] px-[11px] rounded-[7px] text-[12.5px] transition-colors hover:bg-[var(--a-hover)]"
                  style={{ background: filter === f.id ? 'var(--a-active)' : undefined, color: filter === f.id ? 'var(--a-text)' : 'var(--a-muted)' }}
                >
                  {f.label}{s && <span style={{ color: 'var(--a-faint)' }}>{nf.format(s.chips[f.id])}</span>}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {list.error && <ErrorPanel error={list.error} lang={lang} onRetry={list.reload} />}
              {!list.error && !list.data && <SkeletonRows />}
              {list.data && rows.length === 0 && (
                <div className="flex flex-col items-center text-center gap-2 py-14 px-4 rounded-xl" style={{ border: '1px dashed var(--a-line2)' }}>
                  <span style={{ color: 'var(--a-faint)' }}><Icon name={searching ? 'search' : 'users'} size={24} /></span>
                  <div className="text-[14px] mt-1">{searching ? L(`“${dq}” ile eşleşen kullanıcı yok`, `No users match “${dq}”`) : L('Bu filtrede kullanıcı yok', 'No users in this filter')}</div>
                  {searching && <p className="m-0 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Adın, e-postanın ya da plakanın başını yazmayı deneyin.', 'Try the beginning of a name, email or plate.')}</p>}
                  {!s?.ready && !searching && <p className="m-0 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Liste ilk kez hazırlanıyor olabilir; birkaç dakika sonra yenileyin.', 'The list may still be building.')}</p>}
                </div>
              )}
              {rows.length > 0 && (
                <div className={list.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                  <TableWrap minWidth={780}>
                    <thead><tr>
                      <Th>{L('Kullanıcı', 'User')}</Th><Th>{L('Telefon', 'Phone')}</Th><Th>{L('Araç ve QR', 'Vehicles & QR')}</Th>
                      <Th>{L('Bildirim', 'Notifications')}</Th><Th>{L('Katıldı', 'Joined')}</Th><Th w={24} />
                    </tr></thead>
                    <tbody>
                      {rows.map((u) => (
                        <tr
                          key={u.uid}
                          tabIndex={0}
                          onClick={() => onOpenUser(u.uid, u.name || u.email)}
                          onKeyDown={(e) => { if (e.key === 'Enter') onOpenUser(u.uid, u.name || u.email); }}
                          className="cursor-pointer transition-colors hover:bg-[var(--a-hover)] focus:outline-none focus-visible:bg-[var(--a-hover)]"
                        >
                          <Td className="h-[72px]">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <Initials text={initials(u.name, u.email)} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate" style={{ fontStyle: u.name ? undefined : 'italic', color: u.name ? undefined : 'var(--a-muted)' }}>{u.name || L('İsimsiz kullanıcı', 'Unnamed user')}</span>
                                  {u.isStaff && <Tag>{L('Yönetici', 'Staff')}</Tag>}
                                  {u.disabled && <Tag tone="warn">{L('Hesap kapalı', 'Disabled')}</Tag>}
                                </div>
                                <div className="text-[12.5px] mt-0.5 truncate max-w-[300px]" style={{ color: 'var(--a-faint)' }}>{u.email}</div>
                              </div>
                            </div>
                          </Td>
                          <Td mono muted>{u.phoneMasked || <span style={{ color: 'var(--a-faint)', fontFamily: 'inherit' }}>{L('Yok', 'None')}</span>}</Td>
                          <Td>
                            {u.vehicleCount
                              ? <>{L(`${u.vehicleCount} araç`, `${u.vehicleCount} vehicle${u.vehicleCount > 1 ? 's' : ''}`)}<span style={{ color: 'var(--a-faint)' }}> · {u.tagCount} QR</span></>
                              : <span style={{ color: 'var(--a-faint)' }}>{L('Araç yok', 'No vehicle')}</span>}
                          </Td>
                          <Td><StatusDot on={u.pushEnabled} onText={L('Açık', 'On')} offText={L('Kapalı', 'Off')} /></Td>
                          <Td muted>{fmtDay(u.createdAt, lang)}</Td>
                          <Td w={24}><span style={{ color: 'var(--a-faint)' }}><Icon name="chevronRight" size={15} /></span></Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              )}
              {list.data && rows.length > 0 && (
                searching ? (
                  <Pager
                    lang={lang}
                    canPrev={false}
                    canNext={false}
                    onPrev={() => undefined}
                    onNext={() => undefined}
                    text={list.data.truncated
                      ? L(`İlk ${rows.length} sonuç gösteriliyor; aramayı daraltın.`, `Showing the first ${rows.length} results; narrow your search.`)
                      : L(`${rows.length} kullanıcı bulundu`, `${rows.length} users found`)}
                  />
                ) : (
                  <Pager
                    lang={lang}
                    canPrev={pages.page > 1}
                    canNext={!!list.data.next}
                    onPrev={pages.prev}
                    onNext={() => list.data?.next && pages.next(list.data.next)}
                    text={total !== null ? `${nf.format(from)}–${nf.format(from + rows.length - 1)} / ${nf.format(total)} ${L('kullanıcı', 'users')}` : ''}
                  />
                )
              )}
            </div>
            <div className="mt-8">
              <Note>{L('Telefon numaraları güvenlik gereği yalnızca son iki hanesiyle gösterilir; tam numaraya panelden erişilemez ve telefonla arama yapılamaz.', 'Phone numbers only show their last two digits; full numbers are never available in the panel.')}</Note>
            </div>
          </section>
        </>
      )}

      {tab === 'deleted' && (
        <>
          <section className="mt-8">
            {s ? (
              <StatCards items={[
                { label: L('Silinen hesap', 'Deleted accounts'), value: nf.format(s.deleted.total), sub: s.total + s.deleted.total ? L(`Tüm hesapların %${pct(s.deleted.total, s.total + s.deleted.total)}'i`, `${pct(s.deleted.total, s.total + s.deleted.total)}% of all`) : undefined },
                { label: L('Bu ay silinen', 'Deleted this month'), value: nf.format(s.deleted.month), sub: L(`Geçen ay ${nf.format(s.deleted.prevMonth)}`, `Last month ${s.deleted.prevMonth}`) },
                { label: L('Kendisi silen', 'Deleted by the user'), value: nf.format(s.deleted.self), sub: L(`${nf.format(s.deleted.total - s.deleted.self)} hesap yönetici ya da sistem tarafından`, `${s.deleted.total - s.deleted.self} by staff or system`) },
              ]} />
            ) : !stats.error && <SkeletonRows rows={1} h={112} />}
          </section>
          <section className="mt-12">
            {deleted.error && <ErrorPanel error={deleted.error} lang={lang} onRetry={deleted.reload} />}
            {!deleted.error && !deleted.data && <SkeletonRows rows={4} />}
            {deleted.data && deleted.data.rows.length === 0 && (
              <div className="flex flex-col items-center text-center gap-2 py-14 px-4 rounded-xl" style={{ border: '1px dashed var(--a-line2)' }}>
                <span style={{ color: 'var(--a-faint)' }}><Icon name="userX" size={24} /></span>
                <div className="text-[14px] mt-1">{L('Silinmiş hesap yok', 'No deleted accounts')}</div>
              </div>
            )}
            {deleted.data && deleted.data.rows.length > 0 && (
              <>
                <TableWrap minWidth={760}>
                  <thead><tr>
                    <Th>{L('Hesap', 'Account')}</Th><Th>{L('Silinme tarihi', 'Deleted on')}</Th><Th>{L('Silen', 'Deleted by')}</Th>
                    <Th>{L('Sebep', 'Reason')}</Th><Th>{L('Silindiğinde', 'At deletion')}</Th>
                  </tr></thead>
                  <tbody>
                    {deleted.data.rows.map((d) => (
                      <tr key={d.id}>
                        <Td className="h-[72px]">
                          <div className="flex items-center gap-3.5"><Initials text="" icon="userX" /><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5, color: 'var(--a-text2)' }}>{d.emailMasked}</span></div>
                        </Td>
                        <Td>{fmtDay(d.deletedAt, lang)}</Td>
                        <Td muted>{d.by === 'self' ? L('Kullanıcı kendisi', 'The user') : d.by === 'admin' ? `${L('Yönetici', 'Staff')}${d.byEmail ? ` · ${d.byEmail.split('@')[0]}` : ''}` : L('Sistem', 'System')}</Td>
                        <Td muted>{d.reason ? `“${d.reason}”` : L('Belirtmedi', 'Not given')}</Td>
                        <Td>
                          {d.vehicleCount ? L(`${d.vehicleCount} araç`, `${d.vehicleCount} vehicle(s)`) : L('Araç yok', 'No vehicle')}
                          <span style={{ color: 'var(--a-faint)' }}> · {d.tagCount ? `${d.tagCount} QR` : L('QR yok', 'no QR')}</span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                <Pager
                  lang={lang}
                  canPrev={delPages.page > 1}
                  canNext={!!deleted.data.next}
                  onPrev={delPages.prev}
                  onNext={() => deleted.data?.next && delPages.next(deleted.data.next)}
                  text={s ? `${nf.format((delPages.page - 1) * 25 + 1)}–${nf.format((delPages.page - 1) * 25 + deleted.data.rows.length)} / ${nf.format(s.deleted.total)} ${L('silinmiş hesap', 'deleted accounts')}` : ''}
                />
              </>
            )}
            <div className="mt-10">
              <Card>
                <div className="flex gap-4 items-start">
                  <span className="mt-0.5" style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={18} /></span>
                  <div>
                    <div className="text-[14px] font-medium">{L('Silinen hesaplardan ne saklanıyor?', 'What is kept from deleted accounts?')}</div>
                    <p className="m-0 mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--a-muted)' }}>
                      {L('Ad, telefon ve plaka gibi kişisel bilgiler silinir. Yalnızca gizlenmiş e-posta, silinme tarihi, sebebi ve kaç araç ile QR\'ı olduğu kalır.', 'Name, phone and plates are deleted. Only the masked email, date, reason and counts are kept.')}
                      <br />
                      {L('Hesaba bağlı QR\'lar Devre Dışı sayfasına "Hesap silindi" sebebiyle düşer ve kalıcı olarak kapalı kalır; okutulunca "Bu QR kullanıma kapatılmış" görünür.', 'The account\'s QR codes move to Disabled with the reason "Account deleted" and stay closed for good.')}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

// =====================================================================
// KULLANICI DETAYI
// =====================================================================

export function tagStatusText(t: TagSummary | null, lang: AdminLang): { text: string; color: string | null } {
  const tr = lang === 'tr';
  if (!t || !t.stage) return { text: tr ? 'QR yok' : 'No QR', color: null };
  if (t.stage === 'active') return { text: tr ? 'Bağlı' : 'Linked', color: 'active' };
  if (t.stage === 'disabled' || t.stage === 'expired') {
    const r = t.reason && DISABLE_REASON[t.reason];
    return { text: r ? `${tr ? 'Devre dışı' : 'Disabled'} · ${(tr ? r.tr : r.en).toLocaleLowerCase(tr ? 'tr-TR' : 'en-GB')}` : stageLabel(t.stage, lang), color: t.stage };
  }
  return { text: stageLabel(t.stage, lang), color: t.stage };
}

const UserDetailView: React.FC<Props & { uid: string }> = ({ lang, isDark, uid, onCloseUser, onOpenVehicle, onOpenUser }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const r = useRemote(() => getUser(uid), uid);
  const u = r.data;

  // Üst çubuktaki konum yazısı yüklenen adla güncellensin
  useEffect(() => { if (u) onOpenUser(uid, u.name || u.email); }, [u?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const dotColor = (stage: string | null) => (stage ? stageColor(stage as never, isDark) : 'var(--a-line3)');

  return (
    <div className="max-w-[1180px] mx-auto pb-12" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <BackLink label={L('Kullanıcılar', 'Users')} onClick={onCloseUser} />
      {r.error && <div className="mt-6"><ErrorPanel error={r.error} lang={lang} onRetry={r.reload} /></div>}
      {!u && !r.error && <div className="mt-6"><SkeletonRows rows={5} h={90} /></div>}
      {u && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mt-6">
            <Initials text={initials(u.name, u.email)} large />
            <div className="flex-1 min-w-0">
              <h1 className="m-0 text-[24px] font-medium tracking-[-0.3px] break-words" style={{ fontStyle: u.name ? undefined : 'italic' }}>{u.name || L('İsimsiz kullanıcı', 'Unnamed user')}</h1>
              <div className="mt-2 text-[13px] break-all" style={{ color: 'var(--a-faint)' }}>
                {u.email} · {L(`${fmtDay(u.createdAt, lang)} tarihinden beri üye`, `Member since ${fmtDay(u.createdAt, lang)}`)}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {u.isStaff && <Tag>{L('Yönetici', 'Staff')}</Tag>}
              {u.disabled ? <Tag tone="warn">{L('Hesap kapalı', 'Account disabled')}</Tag> : <Tag tone="ok">{L('Hesap etkin', 'Active')}</Tag>}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-10">
            <Card title={L('İletişim ve hesap', 'Contact & account')}>
              <InfoRow first label={L('Telefon', 'Phone')}>
                {u.phoneMasked
                  ? <span className="inline-flex items-center gap-2" title={L('Telefon numaraları gizlidir', 'Phone numbers are hidden')}><span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 13 }}>{u.phoneMasked}</span><span style={{ color: 'var(--a-faint)' }}><Icon name="lock" size={13} /></span></span>
                  : <span style={{ color: 'var(--a-faint)' }}>{L('Eklenmemiş', 'Not added')}</span>}
              </InfoRow>
              <InfoRow label={L('Giriş yöntemi', 'Sign-in method')}>{providerLabel(u.provider, lang === 'tr')}</InfoRow>
              <InfoRow label={L('Son giriş', 'Last sign-in')}>{fmtAgo(u.lastSignInAt, lang)}</InfoRow>
              <InfoRow label={L('E-posta doğrulandı', 'Email verified')}>{u.emailVerified ? L('Evet', 'Yes') : L('Hayır', 'No')}</InfoRow>
            </Card>
            <Card title={L('Özet', 'Summary')}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-7 mt-5">
                {[
                  [L('Araç', 'Vehicles'), u.summary.vehicles],
                  [L('Bağlı QR', 'Linked QR'), u.summary.tags],
                  [L('Okutulma · 30 gün', 'Scans · 30 days'), u.summary.scans30],
                  [L('Bildirim · 30 gün', 'Notices · 30 days'), u.summary.notices30],
                ].map(([label, v]) => (
                  <div key={String(label)}>
                    <div className="text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{label}</div>
                    <div className="text-[22px] font-medium tracking-[-0.3px] mt-2">{nf.format(Number(v))}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-5">
            <Card title={L('Araçlar', 'Vehicles')} right={L(`${u.vehicles.length} araç`, `${u.vehicles.length} vehicle(s)`)}>
              {u.vehicles.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu kullanıcı henüz araç eklemedi.', 'No vehicles yet.')}</p>}
              {u.vehicles.map((v, i) => {
                const st = tagStatusText(v.tag, lang);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onOpenVehicle(v.id, v.plate)}
                    className="w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 py-5 text-left transition-colors hover:bg-[var(--a-hover)] -mx-2 px-2 rounded-lg"
                    style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}
                  >
                    <Plate plate={v.plate} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{v.brandModel || <span style={{ color: 'var(--a-faint)' }}>{L('Model belirtilmemiş', 'No model')}</span>}</div>
                      <div className="text-[12px] mt-1" style={{ color: 'var(--a-faint)', fontFamily: v.tag ? "'IBM Plex Mono', ui-monospace, monospace" : undefined }}>
                        {v.tag ? `QR ${v.tag.serial}` : L('QR bağlı değil', 'No QR linked')}
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1.5">
                      <ColorDot color={dotColor(st.color)}>{st.text}</ColorDot>
                      {v.tag && <span className="text-[12px]" style={{ color: 'var(--a-faint)' }}>{L(`${nf.format(v.tag.scans30)} okutma · 30 gün`, `${v.tag.scans30} scans · 30 days`)}</span>}
                    </div>
                    <span className="hidden sm:block" style={{ color: 'var(--a-faint)' }}><Icon name="chevronRight" size={15} /></span>
                  </button>
                );
              })}
              {u.looseTags.filter(Boolean).length > 0 && (
                <div className="mt-2 pt-4" style={{ borderTop: '1px solid var(--a-line)' }}>
                  <div className="text-[12.5px] mb-2" style={{ color: 'var(--a-muted)' }}>{L("Araca bağlı olmayan QR'lar", 'QR codes not on a vehicle')}</div>
                  {u.looseTags.filter((t): t is TagSummary => !!t).map((t) => {
                    const st = tagStatusText(t, lang);
                    return (
                      <div key={t.code} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
                        <span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5 }}>{t.serial}</span>
                        <ColorDot color={dotColor(st.color)}>{st.text === L('Bağlı', 'Linked') ? L('Müşteride · araçta değil', 'With customer · not on a vehicle') : st.text}</ColorDot>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-5">
            <Card title={L('Cihazlar', 'Devices')} sub={L('Bildirim izni ve ana ekrana ekleme cihaz başına tutulur', 'Notification permission and home screen are tracked per device')}>
              {u.devices.length === 0 && (
                <p className="m-0 py-4 text-[13px] leading-relaxed" style={{ color: 'var(--a-faint)' }}>
                  {L('Cihaz bilgisi yok. Kullanıcı uygulamayı bir sonraki açışında görünecek.', 'No device info yet. It appears the next time the user opens the app.')}
                </p>
              )}
              {u.devices.map((d, i) => (
                <div key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span style={{ color: 'var(--a-faint)' }}><Icon name={d.platform === 'desktop' ? 'laptop' : 'phone'} size={17} /></span>
                    <div className="min-w-0">
                      <div className="truncate">{d.label || L('Bilinmeyen cihaz', 'Unknown device')}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--a-faint)' }}>{L('Son görülme', 'Last seen')}: {fmtAgo(d.lastSeenAt, lang)}</div>
                    </div>
                  </div>
                  <div className="flex gap-5 pl-8 sm:pl-0">
                    <StatusDot on={d.push} onText={L('Bildirim açık', 'Notifications on')} offText={L('Bildirim kapalı', 'Notifications off')} />
                    <StatusDot on={d.standalone} onText={L('Ana ekranda', 'Home screen')} offText={L('Tarayıcıda', 'In browser')} />
                  </div>
                </div>
              ))}
            </Card>
            <Card title={L('Son işlemler', 'Recent activity')}>
              {u.activity.length === 0 && <p className="m-0 py-4 text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Kayıt yok.', 'Nothing yet.')}</p>}
              {u.activity.map((a, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3.5" style={{ borderTop: i ? '1px solid var(--a-line)' : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[13.5px]">{activityText(a.kind, lang === 'tr')}</div>
                    {a.detail && <div className="text-[12px] mt-1 truncate" style={{ color: 'var(--a-faint)' }}>{a.kind === 'account_created' ? providerLabel(a.detail, lang === 'tr') : a.detail}</div>}
                  </div>
                  <span className="text-[12.5px] shrink-0" style={{ color: 'var(--a-faint)' }}>{fmtAgo(a.at, lang)}</span>
                </div>
              ))}
            </Card>
          </div>
          <div className="mt-8">
            <Note>{L('Telefon numaraları güvenlik gereği yalnızca son iki hanesiyle gösterilir; tam numaraya panelden erişilemez. Bu sayfayı açmanız erişim kaydına yazılır.', 'Phone numbers only show their last two digits. Opening this page is logged.')}</Note>
          </div>
        </>
      )}
    </div>
  );
};

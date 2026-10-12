// Yönetici paneli › Satış Standı · QR Bankası · Devre Dışı · Çöp Kutusu

import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import {
  LTag, Stage, TagAction, canDo, hasPasswordProvider, listenTagsByStage, maskPlate, reauthenticate, tagAction,
} from '../../lib/lifecycleService';
import { downloadSingleQr } from '../../lib/qrVectorEngine';
import {
  Btn, Checkbox, ConfirmDialog, Dash, Dialog, EmptyState, FilterChip, Kpis, LoadingRows, Note, PageHeader, RowMenu, SearchBox,
  SelectionBar, StageBadge, TableWrap, Td, Th, daysSince, errorText, fmtDate, matchesSearch, resultMessage, stageColor,
  usePaged, useSelection, useToasts,
} from './lifecycleUi';
import { QrPreviewDialog } from './QrPreviewDialog';

interface BaseProps { lang: AdminLang; isDark: boolean; role: string; onOpenBatch: (batchId: string) => void }

type Pending = { title: string; body: React.ReactNode; confirm: string; danger?: boolean; icon?: 'trash' | 'alert' | 'ban' | 'undo'; run: () => Promise<void> };

/** Belirli aşamalardaki QR'ları canlı dinler */
function useStageTags(stages: Stage[]): { tags: LTag[] | null; error: boolean } {
  const [tags, setTags] = useState<LTag[] | null>(null);
  const [error, setError] = useState(false);
  const key = stages.join(',');
  useEffect(() => {
    setTags(null);
    setError(false);
    return listenTagsByStage(stages, setTags, (e) => { console.error('[stage]', key, e); setError(true); });
  }, [key]);
  return { tags, error };
}

/** İşlem çalıştırma + bildirim + onay penceresi (dört sayfada ortak) */
function useActions(lang: AdminLang) {
  const toasts = useToasts();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const run = async (codes: string[], action: TagAction, doneText: (n: number) => string, after?: () => void, note?: string) => {
    if (!codes.length) return;
    setBusy(true);
    try {
      const r = await tagAction(codes, action, note);
      const m = resultMessage(r, doneText(r.done), lang);
      toasts.show(m.text, m.kind);
      after?.();
    } catch (e) {
      console.error('[stage] action', action, e);
      toasts.show(errorText(e, lang), 'error');
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const dialog = pending && (
    <ConfirmDialog
      title={pending.title}
      icon={pending.icon || (pending.danger ? 'trash' : 'alert')}
      danger={pending.danger}
      confirmLabel={pending.confirm}
      cancelLabel={L('Vazgeç', 'Cancel')}
      onClose={() => setPending(null)}
      onConfirm={async () => { const p = pending; setPending(null); await p.run().catch(() => undefined); }}
    >
      {pending.body}
    </ConfirmDialog>
  );
  return { toasts, busy, run, setPending, dialog };
}

const ErrorBox: React.FC<{ lang: AdminLang }> = ({ lang }) => (
  <div role="alert" className="mt-8 px-4 py-3 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
    {lang === 'tr' ? 'Liste okunamadı. Sayfayı yenileyin.' : 'Could not load the list. Refresh the page.'}
  </div>
);

const BatchLink: React.FC<{ id: string; onOpen: (id: string) => void }> = ({ id, onOpen }) => (
  <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(id); }} className="hover:underline underline-offset-4" style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12, color: 'var(--a-muted)' }}>
    {id}
  </button>
);

function nfFor(lang: AdminLang) { return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB'); }

/** Parti süzgeci (en çok QR'ı olan 6 parti) */
function batchChips(tags: LTag[]): { id: string; n: number }[] {
  const m = new Map<string, number>();
  tags.forEach((t) => m.set(t.batchId, (m.get(t.batchId) || 0) + 1));
  return [...m.entries()].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n || b.id.localeCompare(a.id)).slice(0, 6);
}
const shortBatch = (id: string) => id.replace(/^BATCH-\d{4}-[A-Z]{2}-/, '');

// =====================================================================
// SATIŞ STANDI
// =====================================================================

export const AdminStandView: React.FC<BaseProps> = ({ lang, isDark, role, onOpenBatch }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const { tags, error } = useStageTags(['on_sale']);
  const [batch, setBatch] = useState('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<LTag | null>(null);
  const a = useActions(lang);
  const list = tags || [];
  const filtered = useMemo(() => list.filter((t) => (batch === 'all' || t.batchId === batch) && matchesSearch(q, t.tagId, t.code, t.batchId)), [list, batch, q]);
  const paged = usePaged(filtered, 50, `${batch}|${q}`);
  const sel = useSelection(list.map((t) => t.code));
  const selTags = list.filter((t) => sel.selected.has(t.code));
  const pageCodes = paged.shown.map((t) => t.code);
  const waits = list.map((t) => daysSince(t.releasedAt || t.stageChangedAt)).filter((d): d is number => d !== null);
  const avgWait = waits.length ? Math.round(waits.reduce((x, y) => x + y, 0) / waits.length) : null;
  const unprinted = list.filter((t) => !t.printed).length;

  const unrelease = (codes: string[]) => a.run(codes, 'unrelease', (n) => L(`${nf.format(n)} QR depoya geri alındı.`, `${n} returned to stock.`), sel.clear);
  const trash = (target: LTag[]) => a.setPending({
    title: L(`${nf.format(target.length)} QR çöpe atılsın mı?`, `Move ${target.length} to trash?`),
    body: <p className="m-0">{L('Çöp kutusundan geri yükleyebilirsiniz.', 'You can restore them from the trash.')}</p>,
    confirm: L('Çöpe at', 'Move to trash'), danger: true,
    run: () => a.run(target.map((t) => t.code), 'trash', (n) => L(`${nf.format(n)} QR çöp kutusuna taşındı.`, `${n} moved to trash.`), sel.clear),
  });

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader title={L('Satış Standı', 'On Sale')} sub={L("Satışa çıkarılmış, müşterinin bağlamasını bekleyen QR'lar", 'Released QR codes waiting for a customer')} />
      {error && <ErrorBox lang={lang} />}
      {!tags && !error && <div className="mt-10"><LoadingRows /></div>}
      {tags && (
        <>
          <section className="mt-11">
            <Kpis items={[
              { label: L('Satışta bekleyen', 'Waiting'), value: nf.format(list.length), sub: L(`${batchChips(list).length} partiden`, `from ${batchChips(list).length} batches`), dot: stageColor('on_sale', isDark) },
              { label: L('Ortalama bekleme', 'Average wait'), value: avgWait === null ? '—' : L(`${avgWait} gün`, `${avgWait} d`) },
              { label: L('En uzun bekleyen', 'Longest wait'), value: waits.length ? L(`${Math.max(...waits)} gün`, `${Math.max(...waits)} d`) : '—' },
              { label: L('Basıldı işareti olmayan', 'Not marked printed'), value: nf.format(unprinted), sub: unprinted ? L('Kontrol edin', 'Check these') : undefined },
            ]} />
          </section>
          <div className="mt-10"><Note tone="info">{L("Müşteri bir QR'ı okutup hesabına bağladığında QR buradan otomatik düşer ve QR Bankası'na geçer.", 'When a customer links a QR it moves to the QR bank automatically.')}</Note></div>

          {list.length === 0 ? (
            <div className="mt-8"><EmptyState icon="store" title={L('Standda QR yok', 'Nothing on sale')} text={L("QR Deposu'ndan bir parti açıp QR'ları seçerek satışa çıkarabilirsiniz.", 'Release QR codes from the stock page.')} /></div>
          ) : (
            <section className="mt-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-0.5">
                  <FilterChip on={batch === 'all'} onClick={() => setBatch('all')} count={list.length}>{L('Tümü', 'All')}</FilterChip>
                  {batchChips(list).map((b) => <FilterChip key={b.id} on={batch === b.id} onClick={() => setBatch(b.id)} count={b.n}>{shortBatch(b.id)}</FilterChip>)}
                </div>
                <SearchBox value={q} onChange={setQ} placeholder={L('Seri no ara', 'Search serial')} width={240} />
              </div>
              <TableWrap minWidth={760}>
                <thead><tr>
                  <Th w={28}><Checkbox checked={pageCodes.length > 0 && pageCodes.every((c) => sel.selected.has(c))} indeterminate={pageCodes.some((c) => sel.selected.has(c))} onChange={(v) => sel.setAll(pageCodes, v)} label={L('Tümünü seç', 'Select all')} /></Th>
                  <Th>{L('Seri no', 'Serial')}</Th><Th>{L('Parti', 'Batch')}</Th><Th>{L('Satışa çıktı', 'Released')}</Th><Th right>{L('Okutma', 'Scans')}</Th><Th>{L('Baskı', 'Print')}</Th><Th w={40} />
                </tr></thead>
                <tbody>
                  {paged.shown.map((t) => {
                    const on = sel.selected.has(t.code);
                    const wait = daysSince(t.releasedAt || t.stageChangedAt);
                    return (
                      <tr key={t.code} onClick={() => setPreview(t)} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)]" style={{ background: on ? 'var(--a-hover)' : undefined }}>
                        <Td w={28}><Checkbox checked={on} disabled={t.permanent} title={t.permanent ? L('Hesabı silinen müşterinin QR\'ı kalıcı olarak kapalıdır', 'Permanently closed') : undefined} onChange={(v) => sel.toggle(t.code, v)} label={t.tagId} /></Td>
                        <Td mono>{t.tagId}</Td>
                        <Td><BatchLink id={t.batchId} onOpen={onOpenBatch} /></Td>
                        <Td muted><span className="whitespace-nowrap">{fmtDate(t.releasedAt || t.stageChangedAt, lang)}{wait !== null && wait > 0 ? <span style={{ color: 'var(--a-faint)' }}> · {L(`${wait} gündür`, `${wait} d`)}</span> : ''}</span></Td>
                        <Td right>{t.scanCount || <Dash />}</Td>
                        <Td>{t.printed ? <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--a-text2)' }}><Icon name="print" size={14} />{L('Basıldı', 'Printed')}</span> : <span className="text-[12.5px]" style={{ color: '#E3A857' }}>{L('Basılmadı', 'Not printed')}</span>}</Td>
                        <Td w={40} right>
                          <RowMenu label={L(`${t.tagId} işlemleri`, 'Actions')} items={[
                            { label: L('QR\'ı görüntüle', 'View QR'), icon: 'qr', onClick: () => setPreview(t) },
                            { label: L('Depoya geri al', 'Return to stock'), icon: 'undo', hidden: !canDo(role, 'unrelease'), onClick: () => unrelease([t.code]).catch(() => undefined) },
                            { label: L('Basıldı olarak işaretle', 'Mark printed'), icon: 'print', hidden: t.printed || !canDo(role, 'mark_printed'), onClick: () => a.run([t.code], 'mark_printed', () => L('Basıldı olarak işaretlendi.', 'Marked printed.')).catch(() => undefined) },
                            { label: L('Partiyi aç', 'Open batch'), icon: 'box', onClick: () => onOpenBatch(t.batchId) },
                            { label: L('Çöpe at', 'Move to trash'), icon: 'trash', danger: true, hidden: !canDo(role, 'trash'), onClick: () => trash([t]) },
                          ]} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
              <PagedFooter lang={lang} total={filtered.length} shown={paged.shown.length} more={paged.more} onMore={paged.loadMore} />
            </section>
          )}
        </>
      )}
      <SelectionBar count={sel.selected.size} label={L(`${nf.format(sel.selected.size)} QR seçildi`, `${sel.selected.size} selected`)} onClear={sel.clear}>
        {canDo(role, 'unrelease') && <Btn icon="undo" disabled={a.busy} onClick={() => unrelease(selTags.map((t) => t.code)).catch(() => undefined)}>{L('Depoya geri al', 'Return to stock')}</Btn>}
        {canDo(role, 'trash') && <Btn icon="trash" variant="danger" disabled={a.busy} onClick={() => trash(selTags)}>{L('Çöpe at', 'Trash')}</Btn>}
      </SelectionBar>
      {a.dialog}
      {preview && <QrPreviewDialog tag={preview} lang={lang} isDark={isDark} onClose={() => setPreview(null)} />}
      {a.toasts.node}
    </div>
  );
};

const PagedFooter: React.FC<{ lang: AdminLang; total: number; shown: number; more: boolean; onMore: () => void }> = ({ lang, total, shown, more, onMore }) => {
  const nf = nfFor(lang);
  return (
    <div className="flex items-center justify-between mt-4 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
      <span>{lang === 'tr' ? `${nf.format(total)} QR'dan ${nf.format(shown)} tanesi gösteriliyor` : `Showing ${shown} of ${total}`}</span>
      {more && <button type="button" onClick={onMore} style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>{lang === 'tr' ? 'Daha fazla göster' : 'Show more'}</button>}
    </div>
  );
};

// =====================================================================
// QR BANKASI (müşteriye bağlı QR'lar)
// =====================================================================

export const AdminBankView: React.FC<BaseProps> = ({ lang, isDark, role, onOpenBatch }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const { tags, error } = useStageTags(['active']);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<LTag | null>(null);
  const [disableTarget, setDisableTarget] = useState<LTag[] | null>(null);
  const a = useActions(lang);
  const list = tags || [];
  const filtered = useMemo(() => list.filter((t) => matchesSearch(q, t.tagId, t.code, t.assignedPlate, t.assignedUserEmail, t.batchId)), [list, q]);
  const sorted = useMemo(() => [...filtered].sort((x, y) => (y.activatedAt?.getTime() || 0) - (x.activatedAt?.getTime() || 0)), [filtered]);
  const paged = usePaged(sorted, 50, q);
  const sel = useSelection(list.map((t) => t.code));
  const selTags = list.filter((t) => sel.selected.has(t.code));
  const pageCodes = paged.shown.map((t) => t.code);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = list.filter((t) => t.activatedAt && t.activatedAt >= monthStart).length;
  const neverScanned = list.filter((t) => !t.scanCount).length;
  const owners = new Set(list.map((t) => t.assignedUserEmail).filter(Boolean)).size;

  const reset = (t: LTag) => a.setPending({
    title: L('Eşleşme sıfırlansın mı?', 'Reset this QR?'),
    icon: 'undo',
    danger: true,
    body: (
      <>
        <p className="m-0">{L(`${t.tagId} müşterinin hesabından ve aracından ayrılır, QR depoya döner.`, `${t.tagId} will be removed from the customer and returned to stock.`)}</p>
        <p className="m-0 mt-2" style={{ color: 'var(--a-danger)' }}>{L('Müşterinin aracındaki QR çalışmayı bırakır. Tekrar satmak için depodan satışa çıkarmanız gerekir.', 'The QR on the vehicle stops working.')}</p>
      </>
    ),
    confirm: L('Evet, sıfırla', 'Yes, reset'),
    run: () => a.run([t.code], 'reset', () => L(`${t.tagId} depoya döndü.`, 'Returned to stock.')),
  });

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader title={L('QR Bankası', 'QR Bank')} sub={L("Müşterilerin hesabına bağlı, kullanımdaki QR'lar", 'QR codes linked to customer accounts')} />
      {error && <ErrorBox lang={lang} />}
      {!tags && !error && <div className="mt-10"><LoadingRows /></div>}
      {tags && (
        <>
          <section className="mt-11">
            <Kpis items={[
              { label: L('Bağlı QR', 'Linked QR codes'), value: nf.format(list.length), dot: stageColor('active', isDark), sub: L(`${owners} müşteri`, `${owners} customers`) },
              { label: L('Bu ay bağlanan', 'Linked this month'), value: nf.format(thisMonth) },
              { label: L('Toplam okutma', 'Total scans'), value: nf.format(list.reduce((x, t) => x + t.scanCount, 0)) },
              { label: L('Hiç okutulmamış', 'Never scanned'), value: nf.format(neverScanned) },
            ]} />
          </section>
          {list.length === 0 ? (
            <div className="mt-10"><EmptyState icon="qr" title={L('Henüz bağlı QR yok', 'No linked QR codes yet')} text={L("Müşteri standdaki bir QR'ı okutup hesabına bağladığında burada görünür.", 'Linked QR codes appear here.')} /></div>
          ) : (
            <section className="mt-12">
              <div className="flex justify-end mb-4"><SearchBox value={q} onChange={setQ} placeholder={L('Seri no, plaka veya e-posta', 'Serial, plate or email')} width={300} /></div>
              <TableWrap minWidth={880}>
                <thead><tr>
                  <Th w={28}><Checkbox checked={pageCodes.length > 0 && pageCodes.every((c) => sel.selected.has(c))} indeterminate={pageCodes.some((c) => sel.selected.has(c))} onChange={(v) => sel.setAll(pageCodes, v)} label={L('Tümünü seç', 'Select all')} /></Th>
                  <Th>{L('Seri no', 'Serial')}</Th><Th>{L('Araç', 'Vehicle')}</Th><Th>{L('Müşteri', 'Customer')}</Th><Th>{L('Bağlandı', 'Linked')}</Th><Th right>{L('Okutma', 'Scans')}</Th><Th>{L('Parti', 'Batch')}</Th><Th w={40} />
                </tr></thead>
                <tbody>
                  {paged.shown.map((t) => {
                    const on = sel.selected.has(t.code);
                    return (
                      <tr key={t.code} onClick={() => setPreview(t)} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)]" style={{ background: on ? 'var(--a-hover)' : undefined }}>
                        <Td w={28}><Checkbox checked={on} disabled={t.permanent} title={t.permanent ? L('Hesabı silinen müşterinin QR\'ı kalıcı olarak kapalıdır', 'Permanently closed') : undefined} onChange={(v) => sel.toggle(t.code, v)} label={t.tagId} /></Td>
                        <Td mono>{t.tagId}</Td>
                        <Td>{t.assignedPlate ? maskPlate(t.assignedPlate) : <span className="text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Araca bağlı değil', 'No vehicle')}</span>}</Td>
                        <Td muted><span className="truncate inline-block max-w-[220px] align-middle">{t.assignedUserEmail || '—'}</span></Td>
                        <Td muted>{fmtDate(t.activatedAt, lang)}</Td>
                        <Td right>{t.scanCount || <Dash />}</Td>
                        <Td><BatchLink id={t.batchId} onOpen={onOpenBatch} /></Td>
                        <Td w={40} right>
                          <RowMenu label={L(`${t.tagId} işlemleri`, 'Actions')} items={[
                            { label: L('QR\'ı görüntüle', 'View QR'), icon: 'qr', onClick: () => setPreview(t) },
                            { label: L('PNG indir', 'Download PNG'), icon: 'download', onClick: () => downloadSingleQr(t.code, t.tagId, 'png') },
                            { label: L('Devre dışı bırak', 'Disable'), icon: 'ban', hidden: !canDo(role, 'disable'), onClick: () => setDisableTarget([t]) },
                            { label: L('Süresini bitir', 'Mark expired'), icon: 'clock', hidden: !canDo(role, 'expire'),
                              onClick: () => a.setPending({
                                title: L('Hizmet süresi bitirilsin mi?', 'Mark as expired?'), icon: 'alert',
                                body: <p className="m-0">{L(`${t.tagId} "süresi doldu" olarak Devre Dışı sayfasına taşınır. Okutulduğunda ziyaretçi bildirim gönderemez.`, 'It will move to the disabled page.')}</p>,
                                confirm: L('Süresini bitir', 'Expire'),
                                run: () => a.run([t.code], 'expire', () => L(`${t.tagId} süresi doldu olarak işaretlendi.`, 'Marked expired.')),
                              }) },
                            { label: L('Eşleşmeyi sıfırla', 'Reset'), icon: 'undo', danger: true, hidden: !canDo(role, 'reset'), onClick: () => reset(t) },
                          ]} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
              <PagedFooter lang={lang} total={sorted.length} shown={paged.shown.length} more={paged.more} onMore={paged.loadMore} />
            </section>
          )}
        </>
      )}
      <SelectionBar count={sel.selected.size} label={L(`${nf.format(sel.selected.size)} QR seçildi`, `${sel.selected.size} selected`)} onClear={sel.clear}>
        {canDo(role, 'disable') && <Btn icon="ban" variant="danger" disabled={a.busy} onClick={() => setDisableTarget(selTags)}>{L('Devre dışı bırak', 'Disable')}</Btn>}
      </SelectionBar>
      {disableTarget && (
        <DisableDialog
          lang={lang}
          count={disableTarget.length}
          onClose={() => setDisableTarget(null)}
          onConfirm={async (note) => {
            await a.run(disableTarget.map((t) => t.code), 'disable', (n) => L(`${nf.format(n)} QR devre dışı bırakıldı.`, `${n} disabled.`), sel.clear, note || undefined).catch(() => undefined);
            setDisableTarget(null);
          }}
        />
      )}
      {a.dialog}
      {preview && <QrPreviewDialog tag={preview} lang={lang} isDark={isDark} onClose={() => setPreview(null)} />}
      {a.toasts.node}
    </div>
  );
};

const DisableDialog: React.FC<{ lang: AdminLang; count: number; onClose: () => void; onConfirm: (note: string) => Promise<void> }> = ({ lang, count, onClose, onConfirm }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={L(`${count} QR devre dışı bırakılsın mı?`, `Disable ${count} QR codes?`)}
      icon="ban"
      danger
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)]" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <Btn variant="dangerSolid" disabled={busy} onClick={async () => { setBusy(true); await onConfirm(note.trim()); setBusy(false); }}>{busy ? '…' : L('Devre dışı bırak', 'Disable')}</Btn>
        </>
      )}
    >
      <p className="m-0">{L('QR okutulduğunda ziyaretçi "kullanıma kapalı" mesajını görür ve bildirim gönderemez. Devre Dışı sayfasından yeniden açabilirsiniz.', 'Visitors will see that the QR is disabled. You can re-enable it later.')}</p>
      <label className="flex flex-col gap-1.5 mt-4 text-[12px]" style={{ color: 'var(--a-faint)' }}>
        {L('Sebep (isteğe bağlı, yalnızca yöneticiler görür)', 'Reason (optional)')}
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="h-10 px-3 rounded-lg text-[13.5px] outline-none" style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }} />
      </label>
    </Dialog>
  );
};

// =====================================================================
// DEVRE DIŞI
// =====================================================================

type Reason = 'all' | 'lost' | 'admin' | 'expired' | 'deleted';

export const AdminDisabledView: React.FC<BaseProps> = ({ lang, isDark, role, onOpenBatch }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const { tags, error } = useStageTags(['disabled', 'expired']);
  const [reason, setReason] = useState<Reason>('all');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<LTag | null>(null);
  const a = useActions(lang);
  const list = tags || [];
  const reasonOf = (t: LTag): Exclude<Reason, 'all'> => (t.permanent ? 'deleted' : t.stage === 'expired' || t.disabledReason === 'expired' ? 'expired' : t.disabledReason === 'lost' ? 'lost' : 'admin');
  const filtered = useMemo(() => list.filter((t) => (reason === 'all' || reasonOf(t) === reason) && matchesSearch(q, t.tagId, t.code, t.assignedPlate, t.assignedUserEmail)), [list, reason, q]);
  const sorted = useMemo(() => [...filtered].sort((x, y) => (y.disabledAt?.getTime() || 0) - (x.disabledAt?.getTime() || 0)), [filtered]);
  const paged = usePaged(sorted, 50, `${reason}|${q}`);
  // Hesabı silinen müşterinin QR'ları seçilemez (yeniden açılamaz, depoya dönemez).
  const sel = useSelection(list.filter((t) => !t.permanent).map((t) => t.code));
  const selTags = list.filter((t) => sel.selected.has(t.code) && !t.permanent);
  const pageCodes = paged.shown.filter((t) => !t.permanent).map((t) => t.code);
  const n = (r: Exclude<Reason, 'all'>) => list.filter((t) => reasonOf(t) === r).length;
  const REASON: Record<Exclude<Reason, 'all'>, { label: string; color: string }> = {
    lost: { label: L('Kayıp bildirimi', 'Reported lost'), color: isDark ? '#E8776C' : '#B42318' },
    admin: { label: L('Yönetici kapattı', 'Closed by admin'), color: stageColor('disabled', isDark) },
    expired: { label: L('Süre doldu', 'Expired'), color: isDark ? '#A1A1AA' : '#71717A' },
    deleted: { label: L('Hesap silindi', 'Account deleted'), color: isDark ? '#9D8FE8' : '#5B4BC4' },
  };
  const byWho = (t: LTag) => (reasonOf(t) === 'lost' ? L('Müşteri', 'Customer') : t.disabledBy ? t.disabledBy.split('@')[0] : L('Sistem', 'System'));
  const kpiItems = [
    { label: L('Toplam', 'Total'), value: nf.format(list.length) },
    ...(['lost', 'admin', 'expired', 'deleted'] as const).map((r) => ({ label: REASON[r].label, value: nf.format(n(r)), dot: REASON[r].color })),
  ];

  const enable = (target: LTag[]) => {
    const lost = target.filter((t) => reasonOf(t) === 'lost').length;
    const go = () => a.run(target.map((t) => t.code), 'enable', (k) => L(`${nf.format(k)} QR yeniden açıldı.`, `${k} re-enabled.`), sel.clear);
    if (!lost) { go().catch(() => undefined); return; }
    a.setPending({
      title: L('Kayıp bildirilen QR açılsın mı?', 'Re-enable a lost QR?'), icon: 'alert',
      body: <p className="m-0">{L(`Seçimdeki ${lost} QR müşteri tarafından kayıp bildirildi. Yeniden açmadan önce müşteriyle görüşmeniz önerilir; açılan QR tekrar müşterinin hesabına bağlı olur.`, 'These were reported lost by the customer. Talk to them first.')}</p>,
      confirm: L('Yine de aç', 'Re-enable anyway'),
      run: go,
    });
  };
  const reset = (target: LTag[]) => a.setPending({
    title: L(`${target.length} QR depoya döndürülsün mü?`, `Return ${target.length} to stock?`), icon: 'undo', danger: true,
    body: <p className="m-0">{L('Müşteri ve araç bağı silinir, QR depoya döner. Tekrar satmak için satışa çıkarmanız gerekir.', 'Customer and vehicle links are removed.')}</p>,
    confirm: L('Depoya döndür', 'Return to stock'),
    run: () => a.run(target.map((t) => t.code), 'reset', (k) => L(`${nf.format(k)} QR depoya döndü.`, `${k} returned to stock.`), sel.clear),
  });

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader title={L('Devre Dışı', 'Disabled')} sub={L("Kullanıma kapatılan QR'lar. Silinmezler; yeniden açıldıklarında önceki aşamalarına dönerler.", 'Disabled QR codes. Re-enabling returns them to where they were.')} />
      {error && <ErrorBox lang={lang} />}
      {!tags && !error && <div className="mt-10"><LoadingRows /></div>}
      {tags && (
        <>
          <section className="mt-11">
            <Kpis items={kpiItems} />
          </section>
          {list.length === 0 ? (
            <div className="mt-10"><EmptyState icon="ban" title={L('Devre dışı QR yok', 'No disabled QR codes')} /></div>
          ) : (
            <section className="mt-12">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-0.5">
                  <FilterChip on={reason === 'all'} onClick={() => setReason('all')} count={list.length}>{L('Tümü', 'All')}</FilterChip>
                  {(['lost', 'admin', 'expired', 'deleted'] as const).map((r) => <FilterChip key={r} on={reason === r} onClick={() => setReason(r)} count={n(r)} dot={REASON[r].color}>{REASON[r].label}</FilterChip>)}
                </div>
                <SearchBox value={q} onChange={setQ} placeholder={L('Seri no, plaka veya e-posta', 'Serial, plate or email')} width={280} />
              </div>
              <TableWrap minWidth={900}>
                <thead><tr>
                  <Th w={28}><Checkbox checked={pageCodes.length > 0 && pageCodes.every((c) => sel.selected.has(c))} indeterminate={pageCodes.some((c) => sel.selected.has(c))} disabled={pageCodes.length === 0} onChange={(v) => sel.setAll(pageCodes, v)} label={L('Tümünü seç', 'Select all')} /></Th>
                  <Th>{L('Seri no', 'Serial')}</Th><Th>{L('Sebep', 'Reason')}</Th><Th>{L('Araç / müşteri', 'Vehicle / customer')}</Th><Th>{L('Tarih', 'Date')}</Th><Th>{L('Kapatan', 'By')}</Th><Th w={150} />
                </tr></thead>
                <tbody>
                  {paged.shown.map((t) => {
                    const on = sel.selected.has(t.code);
                    const r = REASON[reasonOf(t)];
                    return (
                      <tr key={t.code} onClick={() => setPreview(t)} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)]" style={{ background: on ? 'var(--a-hover)' : undefined }}>
                        <Td w={28}><Checkbox checked={on} disabled={t.permanent} title={t.permanent ? L('Hesabı silinen müşterinin QR\'ı kalıcı olarak kapalıdır', 'Permanently closed') : undefined} onChange={(v) => sel.toggle(t.code, v)} label={t.tagId} /></Td>
                        <Td mono>{t.tagId}</Td>
                        <Td><span className="inline-flex items-center gap-[7px] text-[12.5px] whitespace-nowrap"><i className="w-[7px] h-[7px] rounded-full" style={{ background: r.color }} />{r.label}</span></Td>
                        <Td className="h-[60px]">
                          <div>{t.permanent ? <span style={{ color: 'var(--a-faint)' }}>{L('Plaka silindi', 'Plate removed')}</span> : t.assignedPlate ? maskPlate(t.assignedPlate) : <Dash />}</div>
                          {t.assignedUserEmail && <div className="text-[12px] mt-0.5 truncate max-w-[220px]" style={{ color: 'var(--a-faint)' }}>{t.assignedUserEmail}</div>}
                        </Td>
                        <Td muted>{fmtDate(t.disabledAt, lang)}</Td>
                        <Td muted>{byWho(t)}</Td>
                        <Td w={150} right>
                          <div className="inline-flex items-center gap-1">
                            {t.permanent
                              ? <span className="text-[12px] whitespace-nowrap px-1" style={{ color: 'var(--a-faint)' }}>{L('Kalıcı olarak kapalı', 'Permanently closed')}</span>
                              : canDo(role, 'enable') && <Btn small icon="undo" disabled={a.busy} onClick={() => enable([t])}>{L('Yeniden aç', 'Re-enable')}</Btn>}
                            <RowMenu label={L(`${t.tagId} işlemleri`, 'Actions')} items={[
                              { label: L('QR\'ı görüntüle', 'View QR'), icon: 'qr', onClick: () => setPreview(t) },
                              { label: L('Partiyi aç', 'Open batch'), icon: 'box', onClick: () => onOpenBatch(t.batchId) },
                              { label: L('Depoya döndür (eşleşmeyi sil)', 'Return to stock'), icon: 'undo', danger: true, hidden: !canDo(role, 'reset') || t.permanent, onClick: () => reset([t]) },
                            ]} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
              <PagedFooter lang={lang} total={sorted.length} shown={paged.shown.length} more={paged.more} onMore={paged.loadMore} />
              <div className="mt-5"><Note>{L('Okutulduğunda ziyaretçi "Bu etiket kullanıma kapalı" mesajını görür. Kayıp bildirilen QR yeniden açılmadan önce müşteriye sorulması önerilir. Hesabı silinen müşterinin QR\'ları etiket müşteride kaldığı için kalıcı olarak kapalıdır; yeniden açılamaz, depoya dönemez.', 'Visitors see that the QR is disabled. QR codes of deleted accounts stay closed permanently.')}</Note></div>
            </section>
          )}
        </>
      )}
      <SelectionBar count={sel.selected.size} label={L(`${nf.format(sel.selected.size)} QR seçildi`, `${sel.selected.size} selected`)} onClear={sel.clear}>
        {canDo(role, 'reset') && <Btn icon="undo" variant="danger" disabled={a.busy} onClick={() => reset(selTags)}>{L('Depoya döndür', 'Return to stock')}</Btn>}
        {canDo(role, 'enable') && <Btn icon="check" variant="primary" disabled={a.busy} onClick={() => enable(selTags)}>{L('Yeniden aç', 'Re-enable')}</Btn>}
      </SelectionBar>
      {a.dialog}
      {preview && <QrPreviewDialog tag={preview} lang={lang} isDark={isDark} onClose={() => setPreview(null)} />}
      {a.toasts.node}
    </div>
  );
};

// =====================================================================
// ÇÖP KUTUSU
// =====================================================================

export const AdminTrashView: React.FC<BaseProps> = ({ lang, isDark, role, onOpenBatch }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = nfFor(lang);
  const { tags, error } = useStageTags(['trashed']);
  const [q, setQ] = useState('');
  const [purgeTarget, setPurgeTarget] = useState<LTag[] | null>(null);
  const a = useActions(lang);
  const list = tags || [];
  const filtered = useMemo(() => list.filter((t) => matchesSearch(q, t.tagId, t.code, t.batchId)), [list, q]);
  const sorted = useMemo(() => [...filtered].sort((x, y) => (y.trashedAt?.getTime() || 0) - (x.trashedAt?.getTime() || 0)), [filtered]);
  const paged = usePaged(sorted, 50, q);
  const sel = useSelection(list.map((t) => t.code));
  const selTags = list.filter((t) => sel.selected.has(t.code));
  const pageCodes = paged.shown.map((t) => t.code);
  const canPurge = canDo(role, 'purge');

  const restore = (target: LTag[]) => a.run(target.map((t) => t.code), 'restore', (k) => L(`${nf.format(k)} QR geri yüklendi.`, `${k} restored.`), sel.clear).catch(() => undefined);

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader
        title={L('Çöp Kutusu', 'Trash')}
        sub={L("Silinen QR'lar burada bekler. Kalıcı silme yalnızca elle ve yetkili şifresiyle yapılır.", 'Deleted QR codes wait here. Permanent deletion is manual and needs your password.')}
        right={canPurge && list.length > 0 && <Btn icon="trash" variant="danger" onClick={() => setPurgeTarget(list)}>{L('Çöp kutusunu boşalt', 'Empty trash')}</Btn>}
      />
      {error && <ErrorBox lang={lang} />}
      {!tags && !error && <div className="mt-10"><LoadingRows /></div>}
      {tags && list.length === 0 && <div className="mt-11"><EmptyState icon="trash" title={L('Çöp kutusu boş', 'Trash is empty')} /></div>}
      {tags && list.length > 0 && (
        <section className="mt-11">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <span className="text-[13px]" style={{ color: 'var(--a-muted)' }}>{L(`${nf.format(list.length)} QR çöpte`, `${list.length} in trash`)}</span>
            <SearchBox value={q} onChange={setQ} placeholder={L('Seri no veya parti ara', 'Search serial or batch')} width={260} />
          </div>
          <TableWrap minWidth={860}>
            <thead><tr>
              <Th w={28}><Checkbox checked={pageCodes.length > 0 && pageCodes.every((c) => sel.selected.has(c))} indeterminate={pageCodes.some((c) => sel.selected.has(c))} onChange={(v) => sel.setAll(pageCodes, v)} label={L('Tümünü seç', 'Select all')} /></Th>
              <Th>{L('Seri no', 'Serial')}</Th><Th>{L('Parti', 'Batch')}</Th><Th>{L('Silinmeden önce', 'Was')}</Th><Th>{L('Silen', 'By')}</Th><Th>{L('Silinme tarihi', 'Deleted')}</Th><Th w={130} />
            </tr></thead>
            <tbody>
              {paged.shown.map((t) => {
                const on = sel.selected.has(t.code);
                const from = t.trashedFrom === 'on_sale' ? 'on_sale' : 'in_stock';
                return (
                  <tr key={t.code} style={{ background: on ? 'var(--a-hover)' : undefined }}>
                    <Td w={28}><Checkbox checked={on} onChange={(v) => sel.toggle(t.code, v)} label={t.tagId} /></Td>
                    <Td mono>{t.tagId}</Td>
                    <Td><BatchLink id={t.batchId} onOpen={onOpenBatch} /></Td>
                    <Td><StageBadge stage={from} isDark={isDark} lang={lang} label={from === 'on_sale' ? L('Standdaydı', 'Was on sale') : L('Depodaydı', 'Was in stock')} /></Td>
                    <Td muted>{t.trashedBy ? t.trashedBy.split('@')[0] : '—'}</Td>
                    <Td muted>{fmtDate(t.trashedAt, lang, true)}</Td>
                    <Td w={130} right>{canDo(role, 'restore') && <Btn small icon="undo" disabled={a.busy} onClick={() => restore([t])}>{L('Geri yükle', 'Restore')}</Btn>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          <PagedFooter lang={lang} total={sorted.length} shown={paged.shown.length} more={paged.more} onMore={paged.loadMore} />
          {!canPurge && <div className="mt-5"><Note>{L('Kalıcı silme yalnızca süper yöneticiye açıktır.', 'Only super admins can delete permanently.')}</Note></div>}
        </section>
      )}
      <SelectionBar count={sel.selected.size} label={L(`${nf.format(sel.selected.size)} QR seçildi`, `${sel.selected.size} selected`)} onClear={sel.clear}>
        {canPurge && <Btn icon="trash" variant="danger" disabled={a.busy} onClick={() => setPurgeTarget(selTags)}>{L('Kalıcı sil', 'Delete permanently')}</Btn>}
        {canDo(role, 'restore') && <Btn icon="undo" variant="primary" disabled={a.busy} onClick={() => restore(selTags)}>{L('Geri yükle', 'Restore')}</Btn>}
      </SelectionBar>
      {purgeTarget && (
        <PurgeDialog
          lang={lang}
          count={purgeTarget.length}
          onClose={() => setPurgeTarget(null)}
          onDone={(done, skipped) => {
            setPurgeTarget(null);
            sel.clear();
            const m = resultMessage({ done, skipped }, L(`${nf.format(done)} QR kalıcı olarak silindi.`, `${done} deleted permanently.`), lang);
            a.toasts.show(m.text, m.kind);
          }}
          codes={purgeTarget.map((t) => t.code)}
        />
      )}
      {a.dialog}
      {a.toasts.node}
    </div>
  );
};

const PurgeDialog: React.FC<{
  lang: AdminLang; count: number; codes: string[]; onClose: () => void;
  onDone: (done: number, skipped: { code: string; reason: string }[]) => void;
}> = ({ lang, count, codes, onClose, onDone }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const usePassword = hasPasswordProvider();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (busy || (usePassword && !password)) return;
    setBusy(true);
    setErr(null);
    try {
      await reauthenticate(usePassword ? password : undefined);
    } catch (e) {
      const code = (e as { code?: string }).code || '';
      setErr(code.includes('wrong-password') || code.includes('invalid-credential') ? L('Şifre hatalı.', 'Wrong password.')
        : code.includes('too-many-requests') ? L('Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.', 'Too many attempts. Try again later.')
          : code.includes('popup-closed') ? L('Doğrulama penceresi kapatıldı.', 'The sign-in window was closed.')
            : L('Kimlik doğrulanamadı.', 'Could not verify your identity.'));
      setBusy(false);
      return;
    }
    try {
      const r = await tagAction(codes, 'purge');
      onDone(r.done, r.skipped);
    } catch (e) {
      const msg = (e as { message?: string }).message || '';
      setErr(msg.includes('REAUTH_REQUIRED') ? L('Doğrulama süresi doldu, tekrar deneyin.', 'Verification expired, try again.') : errorText(e, lang));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={L(`${count} QR kalıcı olarak silinsin mi?`, `Delete ${count} QR codes permanently?`)}
      icon="trash"
      danger
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <Btn variant="dangerSolid" disabled={busy || (usePassword && !password)} onClick={submit}>
            {busy ? L('Siliniyor…', 'Deleting…') : usePassword ? L('Kalıcı olarak sil', 'Delete permanently') : L('Google ile doğrula ve sil', 'Verify with Google and delete')}
          </Btn>
        </>
      )}
    >
      <ul className="m-0 pl-[18px] leading-[1.75]">
        <li>{L('Bu işlem geri alınamaz.', 'This cannot be undone.')}</li>
        <li>{L('Bu kodlar bir daha üretilmez.', 'These codes will never be generated again.')}</li>
        <li>{L('Basılmış bir etiket okutulursa "Bu etiket kullanıma kapalı" görünür.', 'A printed label will show as disabled when scanned.')}</li>
      </ul>
      {usePassword ? (
        <label className="flex flex-col gap-1.5 mt-5 text-[12px]" style={{ color: 'var(--a-faint)' }}>
          {L('Onaylamak için yönetici şifrenizi girin', 'Enter your password to confirm')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="h-10 px-3 rounded-lg text-[14px] outline-none"
            style={{ background: 'var(--a-field)', border: `1px solid ${err ? 'var(--a-danger-line)' : 'var(--a-line3)'}`, color: 'var(--a-text)' }}
            autoFocus
          />
        </label>
      ) : (
        <p className="m-0 mt-5 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>{L('Hesabınızda şifre tanımlı değil; onay için Google hesabınızla yeniden giriş yapmanız istenecek. Profil ve Ayarlar › Güvenlik bölümünden şifre belirleyebilirsiniz.', 'Your account has no password; you will be asked to sign in with Google again.')}</p>
      )}
      {err && <p role="alert" className="m-0 mt-3 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
    </Dialog>
  );
};

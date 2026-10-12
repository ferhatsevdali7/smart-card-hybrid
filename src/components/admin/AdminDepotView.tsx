// Yönetici paneli › QR Deposu (parti listesi)

import React, { useMemo, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import {
  BatchCounts, EMPTY_COUNTS, LBatch, batchAction, batchDeletable, canDo, createBatch, downloadTagsZip, fetchBatchTags, liveCount,
} from '../../lib/lifecycleService';
import {
  Btn, Checkbox, ConfirmDialog, Dash, Dialog, EmptyState, FilterChip, Kpis, LoadingRows, Note, PageHeader, SearchBox,
  SelectionBar, StageBar, TableWrap, Td, Th, errorText, fmtDate, matchesSearch, resultMessage, stageColor, stageLabel, useSelection, useToasts,
} from './lifecycleUi';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  role: string;
  batches: LBatch[] | null;
  batchesError: boolean;
  onOpenBatch: (batchId: string) => void;
}

type Filter = 'all' | 'stock' | 'sale' | 'sold';

export const MAX_BATCH = 1000;

export function sumCounts(batches: LBatch[]): BatchCounts {
  return batches.reduce((acc, b) => {
    const c = b.counts || EMPTY_COUNTS;
    (Object.keys(acc) as (keyof BatchCounts)[]).forEach((k) => { acc[k] += c[k]; });
    return acc;
  }, { ...EMPTY_COUNTS });
}

export const AdminDepotView: React.FC<Props> = ({ lang, isDark, role, batches, batchesError, onOpenBatch }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB');
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const toasts = useToasts();

  const list = batches || [];
  const totals = useMemo(() => sumCounts(list), [list]);
  const live = liveCount(totals);

  const filtered = useMemo(() => list.filter((b) => {
    const c = b.counts || EMPTY_COUNTS;
    if (filter === 'stock' && c.in_stock === 0) return false;
    if (filter === 'sale' && c.on_sale === 0) return false;
    if (filter === 'sold' && !(c.in_stock + c.on_sale === 0 && c.active > 0)) return false;
    return matchesSearch(q, b.id, b.notes);
  }), [list, filter, q]);

  // Çöpe atma yetkisi varsa yalnızca silinebilir partiler seçilir; yalnızca ZIP yetkisi varsa hepsi seçilebilir.
  const canTrash = canDo(role, 'trash');
  const canZip = canDo(role, 'zip');
  const selectable = (b: LBatch) => (canTrash ? batchDeletable(b) : canZip);
  const deletableIds = filtered.filter(selectable).map((b) => b.id);
  const sel = useSelection(list.filter(selectable).map((b) => b.id));
  const selectedBatches = list.filter((b) => sel.selected.has(b.id));
  const selectedQr = selectedBatches.reduce((a, b) => a + (b.counts ? b.counts.in_stock + b.counts.on_sale : 0), 0);
  const allSelected = deletableIds.length > 0 && deletableIds.every((id) => sel.selected.has(id));

  const counts = (k: Filter) => list.filter((b) => {
    const c = b.counts || EMPTY_COUNTS;
    if (k === 'stock') return c.in_stock > 0;
    if (k === 'sale') return c.on_sale > 0;
    if (k === 'sold') return c.in_stock + c.on_sale === 0 && c.active > 0;
    return true;
  }).length;

  const downloadZip = async () => {
    try {
      setZipProgress(L('QR listesi alınıyor…', 'Loading QR list…'));
      const tags = (await fetchBatchTags(selectedBatches.map((b) => b.id))).filter((t) => t.stage === 'in_stock' || t.stage === 'on_sale');
      if (!tags.length) { toasts.show(L('İndirilecek QR yok.', 'Nothing to download.'), 'warn'); return; }
      const name = selectedBatches.length === 1 ? `${selectedBatches[0].id}.zip` : `QR_partiler_${new Date().toISOString().slice(0, 10)}.zip`;
      await downloadTagsZip(tags, name, (d, t) => setZipProgress(L(`ZIP hazırlanıyor ${d}/${t}`, `Preparing ZIP ${d}/${t}`)));
      toasts.show(L(`${nf.format(tags.length)} QR ZIP olarak indirildi. Basıldıysa parti sayfasından "Basıldı" olarak işaretleyin.`, `${tags.length} QR codes downloaded.`));
    } catch (e) {
      console.error('[depot] zip', e);
      toasts.show(errorText(e, lang), 'error');
    } finally {
      setZipProgress(null);
    }
  };

  const trashSelected = async () => {
    let done = 0;
    const skipped: { code: string; reason: string }[] = [];
    for (const b of selectedBatches) {
      try {
        const r = await batchAction(b.id, 'trash');
        done += r.done;
        skipped.push(...r.skipped);
      } catch (e) {
        toasts.show(`${b.id}: ${errorText(e, lang)}`, 'error');
      }
    }
    const m = resultMessage({ done, skipped }, L(`${nf.format(done)} QR çöp kutusuna taşındı.`, `${done} moved to trash.`), lang);
    if (done || skipped.length) toasts.show(m.text, m.kind);
    sel.clear();
    setConfirmTrash(false);
  };

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader
        title={L('QR Deposu', 'QR Stock')}
        sub={L("Üretilen bütün partiler ve içlerindeki QR'ların şu anki aşaması", 'All production batches and where each QR currently is')}
        right={canDo(role, 'batch_create') && (
          <Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>{L('Yeni parti üret', 'New batch')}</Btn>
        )}
      />

      {batchesError && (
        <div role="alert" className="mt-8 px-4 py-3 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
          {L('Partiler okunamadı. Sayfayı yenileyin.', 'Could not load batches. Refresh the page.')}
        </div>
      )}

      {!batches && !batchesError && <div className="mt-12"><LoadingRows /></div>}

      {batches && batches.length === 0 && (
        <div className="mt-12">
          <EmptyState
            icon="box"
            title={L('Henüz parti yok', 'No batches yet')}
            text={L('İlk partiyi ürettiğinizde QR\'lar burada depoda bekler. Satışa çıkarana kadar müşteriler bağlayamaz.', 'Produced QR codes wait here until you release them for sale.')}
            action={canDo(role, 'batch_create') && <Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>{L('Yeni parti üret', 'New batch')}</Btn>}
          />
        </div>
      )}

      {batches && batches.length > 0 && (
        <>
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-3 mb-5">
              <h2 className="m-0 text-[15px] font-medium">{L(`Toplam ${nf.format(live)} QR`, `${nf.format(live)} QR codes`)}</h2>
              <span className="text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
                {L(`${list.length} parti`, `${list.length} batches`)}{totals.deleted > 0 && L(` · ${totals.deleted} kalıcı silindi`, ` · ${totals.deleted} deleted`)}
              </span>
            </div>
            <Kpis items={[
              { label: stageLabel('in_stock', lang), value: nf.format(totals.in_stock), dot: stageColor('in_stock', isDark) },
              { label: stageLabel('on_sale', lang), value: nf.format(totals.on_sale), dot: stageColor('on_sale', isDark) },
              { label: stageLabel('active', lang), value: nf.format(totals.active), dot: stageColor('active', isDark) },
              { label: L('Devre dışı', 'Disabled'), value: nf.format(totals.disabled + totals.expired), dot: stageColor('disabled', isDark) },
              { label: stageLabel('trashed', lang), value: nf.format(totals.trashed), dot: stageColor('trashed', isDark) },
            ]} />
            <div className="mt-6">
              <StageBar isDark={isDark} height={8} parts={[['in_stock', totals.in_stock], ['on_sale', totals.on_sale], ['active', totals.active], ['disabled', totals.disabled + totals.expired], ['trashed', totals.trashed]]} />
            </div>
          </section>

          <section className="mt-14">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-0.5">
                <FilterChip on={filter === 'all'} onClick={() => setFilter('all')} count={counts('all')}>{L('Tüm partiler', 'All')}</FilterChip>
                <FilterChip on={filter === 'stock'} onClick={() => setFilter('stock')} count={counts('stock')}>{L("Depoda QR'ı olan", 'With stock')}</FilterChip>
                <FilterChip on={filter === 'sale'} onClick={() => setFilter('sale')} count={counts('sale')}>{L("Standda QR'ı olan", 'On sale')}</FilterChip>
                <FilterChip on={filter === 'sold'} onClick={() => setFilter('sold')} count={counts('sold')}>{L('Tamamı satılmış', 'Sold out')}</FilterChip>
              </div>
              <SearchBox value={q} onChange={setQ} placeholder={L('Parti veya not ara', 'Search batches')} width={280} />
            </div>

            {filtered.length === 0 ? (
              <p className="m-0 py-8 text-center text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu filtreyle eşleşen parti yok.', 'No batches match.')}</p>
            ) : (
              <TableWrap minWidth={900}>
                <thead>
                  <tr>
                    <Th w={28}>
                      {(canTrash || canZip) && (
                        <Checkbox
                          checked={allSelected}
                          indeterminate={deletableIds.some((id) => sel.selected.has(id))}
                          disabled={deletableIds.length === 0}
                          onChange={(v) => sel.setAll(deletableIds, v)}
                          label={L('Silinebilir partilerin tümünü seç', 'Select all deletable')}
                        />
                      )}
                    </Th>
                    <Th>{L('Parti', 'Batch')}</Th>
                    <Th right>{L('Toplam', 'Total')}</Th>
                    <Th right>{L('Depoda', 'Stock')}</Th>
                    <Th right>{L('Standda', 'On sale')}</Th>
                    <Th right>{L('Bankada', 'In bank')}</Th>
                    <Th right>{L('Devre dışı', 'Disabled')}</Th>
                    <Th right>{L('Çöpte', 'Trash')}</Th>
                    <Th w={210}><span className="pl-4">{L('Dağılım', 'Breakdown')}</span></Th>
                    <Th w={24} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const c = b.counts;
                    const deletable = selectable(b);
                    const n = (v: number) => (v ? nf.format(v) : <Dash />);
                    return (
                      <tr key={b.id} onClick={() => onOpenBatch(b.id)} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)]" style={{ background: sel.selected.has(b.id) ? 'var(--a-hover)' : undefined }}>
                        <Td w={28}>
                          {(canTrash || canZip) && (
                            <Checkbox
                              checked={sel.selected.has(b.id)}
                              disabled={!deletable}
                              onChange={(v) => sel.toggle(b.id, v)}
                              label={L(`${b.id} seç`, `Select ${b.id}`)}
                              title={deletable ? undefined : L("Bankada ya da devre dışında QR'ı olan parti silinemez", 'Batches with customer QR codes cannot be deleted')}
                            />
                          )}
                        </Td>
                        <Td className="h-[68px]">
                          <div style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5 }}>{b.id}</div>
                          <div className="text-[12px] mt-1 truncate max-w-[300px]" style={{ color: 'var(--a-faint)' }}>
                            {fmtDate(b.createdAt, lang)}{b.notes ? ` · ${b.notes}` : ''}
                          </div>
                        </Td>
                        {c ? (
                          <>
                            <Td right>{nf.format(liveCount(c))}</Td>
                            <Td right>{n(c.in_stock)}</Td>
                            <Td right>{n(c.on_sale)}</Td>
                            <Td right>{n(c.active)}</Td>
                            <Td right>{n(c.disabled + c.expired)}</Td>
                            <Td right>{n(c.trashed)}</Td>
                            <Td>
                              <div className="pl-4">
                                <StageBar isDark={isDark} parts={[['in_stock', c.in_stock], ['on_sale', c.on_sale], ['active', c.active], ['disabled', c.disabled + c.expired], ['trashed', c.trashed]]} />
                                <div className="text-[11.5px] mt-1.5" style={{ color: 'var(--a-faint)' }}>
                                  {L(`${nf.format(c.printed)} / ${nf.format(liveCount(c))} basıldı`, `${c.printed} / ${liveCount(c)} printed`)}
                                </div>
                              </div>
                            </Td>
                          </>
                        ) : (
                          <td colSpan={7} className="text-[12.5px] px-3" style={{ borderTop: '1px solid var(--a-line)', color: 'var(--a-faint)' }}>{L('Sayaçlar hazırlanıyor…', 'Preparing counts…')}</td>
                        )}
                        <Td w={24}><span style={{ color: 'var(--a-faint)' }}><Icon name="chevronRight" size={15} /></span></Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
            <div className="mt-4">
              <Note>{L('Yalnızca bankada ya da devre dışında QR\'ı olmayan partiler silinebilir. Silinen partinin QR\'ları önce çöp kutusuna gider.', 'Only batches without customer QR codes can be deleted; their QR codes go to the trash first.')}</Note>
            </div>
          </section>
        </>
      )}

      <SelectionBar
        count={sel.selected.size}
        label={L(`${selectedBatches.length} parti seçildi`, `${selectedBatches.length} selected`)}
        info={<span className="text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{zipProgress || L(`${nf.format(selectedQr)} QR (depoda ve standda)`, `${selectedQr} QR codes`)}</span>}
        onClear={sel.clear}
      >
        {canDo(role, 'zip') && <Btn icon="zip" onClick={downloadZip} disabled={!!zipProgress}>{L('ZIP indir', 'Download ZIP')}</Btn>}
        {canDo(role, 'trash') && <Btn icon="trash" variant="danger" onClick={() => setConfirmTrash(true)} disabled={!!zipProgress}>{L('Çöpe at', 'Move to trash')}</Btn>}
      </SelectionBar>

      {confirmTrash && (
        <ConfirmDialog
          title={L(`${selectedBatches.length} parti çöpe atılsın mı?`, `Move ${selectedBatches.length} batches to trash?`)}
          icon="trash"
          danger
          confirmLabel={L('Çöpe at', 'Move to trash')}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setConfirmTrash(false)}
          onConfirm={trashSelected}
        >
          <p className="m-0">{L(`Bu partilerdeki ${nf.format(selectedQr)} QR çöp kutusuna taşınacak. Çöp kutusundan geri yükleyebilirsiniz.`, `${selectedQr} QR codes will move to the trash. You can restore them later.`)}</p>
          <p className="m-0 mt-2" style={{ color: 'var(--a-faint)' }}>{selectedBatches.map((b) => b.id).join(', ')}</p>
        </ConfirmDialog>
      )}

      {showNew && (
        <NewBatchDialog
          lang={lang}
          onClose={() => setShowNew(false)}
          onCreated={(id, count) => {
            setShowNew(false);
            toasts.show(L(`${id} üretildi · ${nf.format(count)} QR depoya eklendi.`, `${id} created · ${count} QR codes added to stock.`));
            onOpenBatch(id);
          }}
        />
      )}
      {toasts.node}
    </div>
  );
};

// ------------------------------------------------------------------ yeni parti

const NewBatchDialog: React.FC<{ lang: AdminLang; onClose: () => void; onCreated: (id: string, count: number) => void }> = ({ lang, onClose, onCreated }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [count, setCount] = useState('100');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = Number(count);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_BATCH;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await createBatch(n, notes.trim());
      onCreated(r.batchId, r.count);
    } catch (e) {
      console.error('[depot] create', e);
      setErr(errorText(e, lang));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={L('Yeni parti üret', 'New batch')}
      icon="box"
      onClose={() => { if (!busy) onClose(); }}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="h-9 px-4 rounded-lg text-[13px] hover:bg-[var(--a-hover)] disabled:opacity-40" style={{ color: 'var(--a-text2)' }}>{L('Vazgeç', 'Cancel')}</button>
          <Btn variant="primary" onClick={submit} disabled={!valid || busy}>{busy ? L('Üretiliyor…', 'Creating…') : L('Üret', 'Create')}</Btn>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[12px]" style={{ color: 'var(--a-faint)' }}>
          {L('Adet', 'Quantity')}
          <input
            type="number"
            min={1}
            max={MAX_BATCH}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="h-10 px-3 rounded-lg text-[14px] outline-none"
            style={{ background: 'var(--a-field)', border: `1px solid ${valid || !count ? 'var(--a-line3)' : 'var(--a-danger-line)'}`, color: 'var(--a-text)' }}
            autoFocus
          />
          {!valid && count !== '' && <span style={{ color: 'var(--a-danger)' }}>{L(`1 ile ${MAX_BATCH} arasında bir sayı girin.`, `Enter 1–${MAX_BATCH}.`)}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-[12px]" style={{ color: 'var(--a-faint)' }}>
          {L('Not (isteğe bağlı)', 'Note (optional)')}
          <input
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={L('örn. 300 mikron UV baskı', 'e.g. print run details')}
            className="h-10 px-3 rounded-lg text-[13.5px] outline-none"
            style={{ background: 'var(--a-field)', border: '1px solid var(--a-line3)', color: 'var(--a-text)' }}
          />
        </label>
        <p className="m-0 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
          {L("Yeni QR'lar depoya düşer. Basıp satışa çıkarana kadar müşteriler bağlayamaz.", 'New QR codes go to stock. Customers cannot link them until released.')}
        </p>
        {err && <p role="alert" className="m-0 text-[12.5px]" style={{ color: 'var(--a-danger)' }}>{err}</p>}
      </div>
    </Dialog>
  );
};

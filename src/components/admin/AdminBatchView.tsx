// Yönetici paneli › QR Deposu › Parti detayı

import React, { useEffect, useMemo, useState } from 'react';
import { AdminLang, Icon } from './adminUi';
import {
  LBatch, LTag, Stage, TagAction, batchAction, batchDeletable, canDo, downloadTagsZip, listenBatchTags, maskPlate, tagAction,
} from '../../lib/lifecycleService';
import { formatCode } from '../../lib/functionsClient';
import { downloadSingleQr } from '../../lib/qrVectorEngine';
import {
  Btn, Checkbox, ConfirmDialog, Dash, EmptyState, FilterChip, LoadingRows, PageHeader, RowMenu, SearchBox, SelectionBar,
  StageBadge, StageBar, StageLegend, TableWrap, Td, Th, errorText, fmtDate, lastActionText, matchesSearch, resultMessage,
  stageColor, stageLabel, usePaged, useSelection, useToasts,
} from './lifecycleUi';
import { QrPreviewDialog } from './QrPreviewDialog';

interface Props {
  lang: AdminLang;
  isDark: boolean;
  role: string;
  batchId: string;
  batch: LBatch | undefined;
  onBack: () => void;
}

type StageFilter = 'all' | 'in_stock' | 'on_sale' | 'active' | 'off' | 'trashed';
const SELECTABLE: Stage[] = ['in_stock', 'on_sale'];

type Pending = { title: string; body: React.ReactNode; confirm: string; danger?: boolean; run: () => Promise<void> };

export const AdminBatchView: React.FC<Props> = ({ lang, isDark, role, batchId, batch, onBack }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const nf = new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-GB');
  const [tags, setTags] = useState<LTag[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<StageFilter>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [preview, setPreview] = useState<LTag | null>(null);
  const toasts = useToasts();

  useEffect(() => {
    setTags(null);
    setLoadError(false);
    return listenBatchTags(batchId, setTags, (e) => { console.error('[batch]', e); setLoadError(true); });
  }, [batchId]);

  const list = tags || [];
  const byStage = (s: StageFilter) => list.filter((t) => s === 'all' || (s === 'off' ? t.stage === 'disabled' || t.stage === 'expired' : t.stage === s));
  const filtered = useMemo(
    () => byStage(filter).filter((t) => matchesSearch(q, t.tagId, t.code, t.assignedPlate, t.assignedUserEmail)),
    [list, filter, q],
  );
  const paged = usePaged(filtered, 50, `${filter}|${q}`);

  const selectableCodes = list.filter((t) => SELECTABLE.includes(t.stage)).map((t) => t.code);
  const sel = useSelection(selectableCodes);
  const selTags = list.filter((t) => sel.selected.has(t.code));
  const selStock = selTags.filter((t) => t.stage === 'in_stock');
  const selSale = selTags.filter((t) => t.stage === 'on_sale');
  const selUnprinted = selTags.filter((t) => !t.printed);
  const pageSelectable = paged.shown.filter((t) => SELECTABLE.includes(t.stage)).map((t) => t.code);
  const pageAll = pageSelectable.length > 0 && pageSelectable.every((c) => sel.selected.has(c));

  const c = {
    in_stock: byStage('in_stock').length, on_sale: byStage('on_sale').length, active: byStage('active').length,
    off: byStage('off').length, trashed: byStage('trashed').length,
  };
  const live = list.length;
  const printed = list.filter((t) => t.printed).length;
  const printableUnprinted = list.filter((t) => SELECTABLE.includes(t.stage) && !t.printed).length;

  // ------------------------------------------------------------ işlemler

  const run = async (codes: string[], action: TagAction, doneText: (n: number) => string, clear = true) => {
    if (!codes.length) return;
    setBusy(action);
    try {
      const r = await tagAction(codes, action);
      const m = resultMessage(r, doneText(r.done), lang);
      toasts.show(m.text, m.kind);
      if (clear) sel.clear();
    } catch (e) {
      console.error('[batch] action', action, e);
      toasts.show(errorText(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  const release = (target: LTag[]) => {
    const stock = target.filter((t) => t.stage === 'in_stock');
    const unprinted = stock.filter((t) => !t.printed);
    const go = () => run(stock.map((t) => t.code), 'release', (n) => L(`${nf.format(n)} QR satışa çıkarıldı.`, `${n} released for sale.`));
    if (!unprinted.length) { go(); return; }
    setPending({
      title: L('Basılmamış QR var', 'Some QR codes are not printed'),
      body: (
        <p className="m-0">{L(
          `Satışa çıkaracağınız ${nf.format(stock.length)} QR'ın ${nf.format(unprinted.length)} tanesi henüz "basıldı" olarak işaretlenmedi. Yine de satışa çıkarılsın mı?`,
          `${unprinted.length} of ${stock.length} QR codes are not marked as printed. Release anyway?`,
        )}</p>
      ),
      confirm: L('Yine de satışa çıkar', 'Release anyway'),
      run: go,
    });
  };

  const trash = (target: LTag[]) => setPending({
    title: L(`${nf.format(target.length)} QR çöpe atılsın mı?`, `Move ${target.length} QR codes to trash?`),
    body: <p className="m-0">{L('Çöp kutusundan geri yükleyebilirsiniz. Çöpteki QR okutulursa "kullanıma kapalı" görünür.', 'You can restore them from the trash.')}</p>,
    confirm: L('Çöpe at', 'Move to trash'),
    danger: true,
    run: () => run(target.map((t) => t.code), 'trash', (n) => L(`${nf.format(n)} QR çöp kutusuna taşındı.`, `${n} moved to trash.`)),
  });

  const zip = async (target: LTag[], name: string) => {
    const printable = target.filter((t) => SELECTABLE.includes(t.stage));
    if (!printable.length) { toasts.show(L('İndirilecek QR yok.', 'Nothing to download.'), 'warn'); return; }
    setBusy('zip');
    try {
      await downloadTagsZip(printable, name, (d, t) => setBusy(`zip:${d}/${t}`));
      toasts.show(L(`${nf.format(printable.length)} QR ZIP olarak indirildi. Basıldığında "Basıldı olarak işaretle" deyin.`, `${printable.length} downloaded.`));
    } catch (e) {
      console.error('[batch] zip', e);
      toasts.show(errorText(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  const wholeBatch = async (action: 'release_all' | 'print_all' | 'trash') => {
    setBusy(action);
    try {
      const r = await batchAction(batchId, action);
      const text = action === 'release_all' ? L(`${nf.format(r.done)} QR satışa çıkarıldı.`, `${r.done} released.`)
        : action === 'print_all' ? L(`${nf.format(r.done)} QR basıldı olarak işaretlendi.`, `${r.done} marked printed.`)
          : L(`${nf.format(r.done)} QR çöp kutusuna taşındı.`, `${r.done} moved to trash.`);
      const m = resultMessage(r, text, lang);
      toasts.show(r.done || r.skipped.length ? m.text : L('Uygulanacak QR yoktu.', 'Nothing to apply.'), r.done ? m.kind : 'warn');
      sel.clear();
    } catch (e) {
      console.error('[batch] whole', action, e);
      toasts.show(errorText(e, lang), 'error');
    } finally {
      setBusy(null);
    }
  };

  const zipBusy = busy?.startsWith('zip');
  const busyText = busy?.startsWith('zip:') ? L(`ZIP hazırlanıyor ${busy.slice(4)}`, `Preparing ZIP ${busy.slice(4)}`) : null;

  // ------------------------------------------------------------ görünüm

  const sub = [
    L('Otomobil ön cam QR', 'Windshield QR'),
    batch ? L(`${nf.format(batch.totalCount)} adet üretildi`, `${batch.totalCount} produced`) : null,
    batch?.createdAt ? fmtDate(batch.createdAt, lang) : null,
    batch?.createdBy || null,
    batch?.notes ? `“${batch.notes}”` : null,
  ].filter(Boolean).join(' · ');

  const chip = (k: StageFilter, label: string, n: number, dot?: string) => (
    <FilterChip key={k} on={filter === k} onClick={() => setFilter(k)} count={n} dot={dot}>{label}</FilterChip>
  );

  return (
    <div className="max-w-[1180px] mx-auto pb-10" style={{ fontFeatureSettings: '"tnum" 1' }}>
      <PageHeader
        back={{ label: L('QR Deposu', 'QR Stock'), onClick: onBack }}
        title={<span style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 22, letterSpacing: 0 }}>{batchId}</span>}
        sub={sub}
        right={(
          <>
            <Btn icon="zip" onClick={() => zip(list, `${batchId}.zip`)} disabled={!!busy || !tags}>{L('Tümünü ZIP indir', 'Download all')}</Btn>
            <RowMenu
              label={L('Parti işlemleri', 'Batch actions')}
              items={[
                { label: L(`Depodakilerin tümünü satışa çıkar (${c.in_stock})`, `Release all in stock (${c.in_stock})`), icon: 'store', disabled: !c.in_stock || !!busy, hidden: !canDo(role, 'release'),
                  onClick: () => setPending({
                    title: L(`${nf.format(c.in_stock)} QR satışa çıkarılsın mı?`, `Release ${c.in_stock} QR codes?`),
                    body: <p className="m-0">{L(`Bu partide depoda bekleyen bütün QR'lar satış standına taşınır ve müşteriler bağlayabilir hale gelir.${list.some((t) => t.stage === 'in_stock' && !t.printed) ? ' Bunların bir kısmı henüz basıldı olarak işaretlenmedi.' : ''}`, 'All in-stock QR codes will go on sale.')}</p>,
                    confirm: L('Satışa çıkar', 'Release'),
                    run: () => wholeBatch('release_all'),
                  }) },
                { label: L(`Tümünü basıldı olarak işaretle (${printableUnprinted})`, `Mark all printed (${printableUnprinted})`), icon: 'print', disabled: !printableUnprinted || !!busy, hidden: !canDo(role, 'mark_printed'),
                  onClick: () => wholeBatch('print_all') },
                { label: L('Partiyi çöpe at', 'Move batch to trash'), icon: 'trash', danger: true, hidden: !canDo(role, 'trash'),
                  disabled: !batch || !batchDeletable(batch) || !!busy,
                  onClick: () => setPending({
                    title: L('Parti çöpe atılsın mı?', 'Move batch to trash?'),
                    body: <p className="m-0">{L(`Depodaki ve standdaki ${nf.format(c.in_stock + c.on_sale)} QR çöp kutusuna taşınır. Geri yükleyebilirsiniz.`, `${c.in_stock + c.on_sale} QR codes will move to trash.`)}</p>,
                    confirm: L('Çöpe at', 'Move to trash'),
                    danger: true,
                    run: () => wholeBatch('trash'),
                  }) },
              ]}
            />
          </>
        )}
      />

      {loadError && (
        <div role="alert" className="mt-8 px-4 py-3 rounded-lg text-[13px]" style={{ border: '1px solid var(--a-danger-line)', color: 'var(--a-danger)' }}>
          {L('Partinin QR\'ları okunamadı. Sayfayı yenileyin.', 'Could not load QR codes.')}
        </div>
      )}
      {!tags && !loadError && <div className="mt-10"><LoadingRows /></div>}

      {tags && tags.length === 0 && (
        <div className="mt-10"><EmptyState icon="box" title={L('Bu partide QR kalmadı', 'No QR codes left')} text={L('Partinin bütün QR\'ları kalıcı olarak silinmiş.', 'All QR codes of this batch were permanently deleted.')} /></div>
      )}

      {tags && tags.length > 0 && (
        <>
          <section className="mt-10">
            <StageBar isDark={isDark} height={8} parts={[['in_stock', c.in_stock], ['on_sale', c.on_sale], ['active', c.active], ['disabled', c.off], ['trashed', c.trashed]]} />
            <StageLegend isDark={isDark} lang={lang} parts={([['in_stock', c.in_stock], ['on_sale', c.on_sale], ['active', c.active], ['disabled', c.off], ['trashed', c.trashed]] as [Stage, number][]).filter(([, v]) => v > 0)} />
            <div className="text-[12px] mt-2.5" style={{ color: 'var(--a-faint)' }}>
              {L(`${nf.format(printed)} / ${nf.format(live)} basıldı`, `${printed} / ${live} printed`)}
              {printableUnprinted > 0 && L(` · depoda ve standda ${nf.format(printableUnprinted)} QR henüz basılmadı`, ` · ${printableUnprinted} not printed yet`)}
              {batch?.counts?.deleted ? L(` · ${batch.counts.deleted} kalıcı silindi`, ` · ${batch.counts.deleted} deleted`) : ''}
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-0.5">
                {chip('all', L('Tümü', 'All'), live)}
                {chip('in_stock', stageLabel('in_stock', lang, true), c.in_stock, stageColor('in_stock', isDark))}
                {chip('on_sale', stageLabel('on_sale', lang, true), c.on_sale, stageColor('on_sale', isDark))}
                {chip('active', stageLabel('active', lang, true), c.active, stageColor('active', isDark))}
                {chip('off', L('Devre dışı', 'Disabled'), c.off, stageColor('disabled', isDark))}
                {chip('trashed', stageLabel('trashed', lang, true), c.trashed, stageColor('trashed', isDark))}
              </div>
              <SearchBox value={q} onChange={setQ} placeholder={L('Seri no, kod veya plaka ara', 'Search serial, code or plate')} width={260} />
            </div>

            {filtered.length === 0 ? (
              <p className="m-0 py-8 text-center text-[13px]" style={{ color: 'var(--a-faint)' }}>{L('Bu filtreyle eşleşen QR yok.', 'No QR codes match.')}</p>
            ) : (
              <TableWrap minWidth={860}>
                <thead>
                  <tr>
                    <Th w={28}>
                      <Checkbox
                        checked={pageAll}
                        indeterminate={pageSelectable.some((x) => sel.selected.has(x))}
                        disabled={!pageSelectable.length}
                        onChange={(v) => sel.setAll(pageSelectable, v)}
                        label={L('Görünen seçilebilir QR\'ların tümünü seç', 'Select all visible')}
                      />
                    </Th>
                    <Th>{L('Seri no', 'Serial')}</Th>
                    <Th>{L('QR kodu', 'Code')}</Th>
                    <Th>{L('Durum', 'Status')}</Th>
                    <Th>{L('Baskı', 'Print')}</Th>
                    <Th>{L('Plaka', 'Plate')}</Th>
                    <Th>{L('Son işlem', 'Last action')}</Th>
                    <Th w={40} />
                  </tr>
                </thead>
                <tbody>
                  {paged.shown.map((t) => {
                    const selectable = SELECTABLE.includes(t.stage);
                    const on = sel.selected.has(t.code);
                    return (
                      <tr key={t.code} onClick={() => setPreview(t)} className="cursor-pointer transition-colors hover:bg-[var(--a-hover)]" style={{ background: on ? 'var(--a-hover)' : undefined }}>
                        <Td w={28}>
                          <Checkbox
                            checked={on}
                            disabled={!selectable}
                            onChange={(v) => sel.toggle(t.code, v)}
                            label={L(`${t.tagId} seç`, `Select ${t.tagId}`)}
                            title={selectable ? undefined : L('Müşterideki, devre dışı ya da çöpteki QR burada seçilemez', 'Only stock and on-sale QR codes can be selected here')}
                          />
                        </Td>
                        <Td mono>{t.tagId}</Td>
                        <Td mono muted>{formatCode(t.code)}</Td>
                        <Td><StageBadge stage={t.stage} isDark={isDark} lang={lang} /></Td>
                        <Td>{t.printed ? <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--a-text2)' }}><Icon name="print" size={14} />{L('Basıldı', 'Printed')}</span> : <Dash />}</Td>
                        <Td muted>{t.assignedPlate ? maskPlate(t.assignedPlate) : <Dash />}</Td>
                        <Td muted><span className="text-[12.5px] whitespace-nowrap">{lastActionText(t.lastAction, lang)} · {fmtDate(t.stageChangedAt, lang)}</span></Td>
                        <Td w={40} right>
                          <RowMenu
                            label={L(`${t.tagId} işlemleri`, `${t.tagId} actions`)}
                            items={[
                              { label: L('QR\'ı görüntüle', 'View QR'), icon: 'qr', onClick: () => setPreview(t) },
                              { label: L('PNG indir', 'Download PNG'), icon: 'download', onClick: () => downloadSingleQr(t.code, t.tagId, 'png') },
                              { label: L('Satışa çıkar', 'Release'), icon: 'store', hidden: t.stage !== 'in_stock' || !canDo(role, 'release'), onClick: () => release([t]) },
                              { label: L('Depoya geri al', 'Return to stock'), icon: 'undo', hidden: t.stage !== 'on_sale' || !canDo(role, 'unrelease'),
                                onClick: () => run([t.code], 'unrelease', () => L(`${t.tagId} depoya geri alındı.`, 'Returned to stock.'), false) },
                              { label: L('Basıldı olarak işaretle', 'Mark printed'), icon: 'print', hidden: !selectable || t.printed || !canDo(role, 'mark_printed'),
                                onClick: () => run([t.code], 'mark_printed', () => L(`${t.tagId} basıldı olarak işaretlendi.`, 'Marked printed.'), false) },
                              { label: L('Basılmadı olarak işaretle', 'Mark not printed'), icon: 'print', hidden: !selectable || !t.printed || !canDo(role, 'unmark_printed'),
                                onClick: () => run([t.code], 'unmark_printed', () => L(`${t.tagId} basılmadı olarak işaretlendi.`, 'Marked not printed.'), false) },
                              { label: L('Çöpe at', 'Move to trash'), icon: 'trash', danger: true, hidden: !selectable || !canDo(role, 'trash'), onClick: () => trash([t]) },
                            ]}
                          />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
            <div className="flex items-center justify-between mt-4 text-[12.5px]" style={{ color: 'var(--a-faint)' }}>
              <span>{L(`${nf.format(filtered.length)} QR'dan ${nf.format(paged.shown.length)} tanesi gösteriliyor`, `Showing ${paged.shown.length} of ${filtered.length}`)}</span>
              {paged.more && <button type="button" onClick={paged.loadMore} style={{ color: 'var(--a-text2)', borderBottom: '1px solid var(--a-line3)' }}>{L('Daha fazla göster', 'Show more')}</button>}
            </div>
          </section>
        </>
      )}

      <SelectionBar
        count={sel.selected.size}
        label={L(`${nf.format(sel.selected.size)} QR seçildi`, `${sel.selected.size} selected`)}
        info={busyText
          ? <span className="text-[12.5px]" style={{ color: 'var(--a-muted)' }}>{busyText}</span>
          : selUnprinted.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: '#E3A857' }}>
              <Icon name="alert" size={14} />{L(`${nf.format(selUnprinted.length)}'i henüz basılmadı`, `${selUnprinted.length} not printed`)}
            </span>
          )}
        onClear={sel.clear}
      >
        {canDo(role, 'mark_printed') && selUnprinted.length > 0 && (
          <Btn icon="print" disabled={!!busy} onClick={() => run(selUnprinted.map((t) => t.code), 'mark_printed', (n) => L(`${nf.format(n)} QR basıldı olarak işaretlendi.`, `${n} marked printed.`))}>
            {L('Basıldı olarak işaretle', 'Mark printed')}
          </Btn>
        )}
        <Btn icon="zip" disabled={!!busy || zipBusy} onClick={() => zip(selTags, `${batchId}_secili_${selTags.length}.zip`)}>{L('ZIP indir', 'Download ZIP')}</Btn>
        {canDo(role, 'trash') && <Btn icon="trash" variant="danger" disabled={!!busy} onClick={() => trash(selTags)}>{L('Çöpe at', 'Trash')}</Btn>}
        {canDo(role, 'unrelease') && selSale.length > 0 && (
          <Btn icon="undo" disabled={!!busy} onClick={() => run(selSale.map((t) => t.code), 'unrelease', (n) => L(`${nf.format(n)} QR depoya geri alındı.`, `${n} returned to stock.`))}>
            {L('Depoya geri al', 'Return to stock')}{selStock.length > 0 ? ` (${selSale.length})` : ''}
          </Btn>
        )}
        {canDo(role, 'release') && selStock.length > 0 && (
          <Btn icon="store" variant="primary" disabled={!!busy} onClick={() => release(selTags)}>
            {L('Satışa çıkar', 'Release')}{selSale.length > 0 ? ` (${selStock.length})` : ''}
          </Btn>
        )}
      </SelectionBar>

      {pending && (
        <ConfirmDialog
          title={pending.title}
          icon={pending.danger ? 'trash' : 'alert'}
          danger={pending.danger}
          confirmLabel={pending.confirm}
          cancelLabel={L('Vazgeç', 'Cancel')}
          onClose={() => setPending(null)}
          onConfirm={async () => { const p = pending; setPending(null); await p.run(); }}
        >
          {pending.body}
        </ConfirmDialog>
      )}
      {preview && <QrPreviewDialog tag={list.find((t) => t.code === preview.code) || preview} lang={lang} isDark={isDark} onClose={() => setPreview(null)} />}
      {toasts.node}
    </div>
  );
};

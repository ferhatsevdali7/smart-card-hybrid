// Tek bir QR'ın büyük görünümü ve indirme düğmeleri

import React, { useEffect, useState } from 'react';
import { AdminLang } from './adminUi';
import type { LTag } from '../../lib/lifecycleService';
import { maskPlate } from '../../lib/lifecycleService';
import { downloadSingleQr, generateLogodQrPng } from '../../lib/qrVectorEngine';
import { formatCode, tagUrl } from '../../lib/functionsClient';
import { Btn, Dialog, StageBadge, fmtDate, lastActionText } from './lifecycleUi';

export const QrPreviewDialog: React.FC<{ tag: LTag; lang: AdminLang; isDark: boolean; onClose: () => void }> = ({ tag, lang, isDark, onClose }) => {
  const L = (tr: string, en: string) => (lang === 'tr' ? tr : en);
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    generateLogodQrPng(tag.code, 480).then((u) => { if (alive) setImg(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [tag.code]);

  const rows: [string, React.ReactNode][] = [
    [L('Durum', 'Status'), <StageBadge stage={tag.stage} isDark={isDark} lang={lang} />],
    [L('QR altı kod', 'Code'), <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>{formatCode(tag.code)}</span>],
    [L('Baskı', 'Print'), tag.printed ? L('Basıldı', 'Printed') : L('Basılmadı', 'Not printed')],
    [L('Plaka', 'Plate'), tag.assignedPlate ? maskPlate(tag.assignedPlate) : '—'],
    [L('Okutma', 'Scans'), String(tag.scanCount)],
    [L('Son işlem', 'Last action'), `${lastActionText(tag.lastAction, lang)} · ${fmtDate(tag.stageChangedAt, lang, true)}`],
  ];

  return (
    <Dialog
      title={tag.tagId}
      onClose={onClose}
      width={520}
      footer={(
        <>
          <Btn icon="download" onClick={() => downloadSingleQr(tag.code, tag.tagId, 'svg')}>{L('SVG (matbaa)', 'SVG')}</Btn>
          <Btn icon="download" onClick={() => downloadSingleQr(tag.code, tag.tagId, 'png')}>PNG</Btn>
          <Btn variant="primary" onClick={onClose}>{L('Kapat', 'Close')}</Btn>
        </>
      )}
    >
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="w-[180px] h-[180px] shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center self-center">
          {img ? <img src={img} alt={tag.tagId} className="w-full h-full" /> : <span className="text-[12px] text-zinc-500">…</span>}
        </div>
        <dl className="m-0 flex-1 grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt style={{ color: 'var(--a-faint)' }}>{k}</dt>
              <dd className="m-0 min-w-0 break-words">{v}</dd>
            </React.Fragment>
          ))}
          <dt style={{ color: 'var(--a-faint)' }}>{L('Bağlantı', 'Link')}</dt>
          <dd className="m-0 min-w-0 break-all text-[12px]" style={{ color: 'var(--a-muted)' }}>{tagUrl(tag.code)}</dd>
        </dl>
      </div>
    </Dialog>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Download, 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  RefreshCw, 
  Tag, 
  Car, 
  Lock, 
  Filter,
  Check
} from 'lucide-react';
import { 
  createBatchQrTags, 
  listenToQrTags, 
  updateQrTagStatus, 
  resetQrTag, 
  exportToPrintCsv 
} from '../lib/qrBankService';
import { QrTagItem, QrTagStatus } from '../types/card';
import { getAdminLang } from '../lib/adminSessionService';
import { formatCode } from '../lib/functionsClient';

interface QrBankAdminViewProps {
  adminEmail: string;
}

export const QrBankAdminView: React.FC<QrBankAdminViewProps> = ({ adminEmail }) => {
  const [tags, setTags] = useState<QrTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Toplu Üretim State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCount, setBatchCount] = useState<number>(20);
  const [batchNote, setBatchNote] = useState<string>('Parti 1 Matbaa Basımı');
  const [generating, setGenerating] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // PIN Gizleme/Gösterme
  const [revealedPins, setRevealedPins] = useState<{ [tagId: string]: boolean }>({});

  const lang = getAdminLang();

  const t = {
    tr: {
      title: 'Merkezi QR & Çip Envanter Bankası',
      desc: 'Fiziksel matbaa üretimi, güvenlik anahtarları ve araç eşleşme durumlarının canlı kayıt kütüğü.',
      exportCsv: 'Matbaa CSV Dökümü',
      generateBatch: '+ Seri Üretim Yap',
      searchPlaceholder: 'Seri No (TAG ID), Eşleşen Plaka veya E-posta ile ara...',
      all: 'Tümü',
      unclaimed: 'Boşta / Satışta',
      active: 'Aktif Eşleşmiş',
      disabled: 'Pasif / İptal',
      colTagId: 'SERİ NO (TAG ID)',
      colPin: 'QR KODU',
      colStatus: 'DURUM',
      colPlate: 'EŞLEŞEN ARAÇ / PLAKA',
      colUser: 'KULLANICI HESABI',
      colBatch: 'PARTİ / NOT',
      colActions: 'İŞLEMLER',
      noRecords: 'Filtrelere uygun QR envanter kaydı bulunamadı.',
      totalTags: 'Toplam Envanter',
      activeTags: 'Aktif Eşleşen',
      unclaimedTags: 'Boşta (Stokta)',
      disabledTags: 'Devre Dışı',
      batchModalTitle: 'Yeni QR / Çip Serisi Üret',
      batchCountLabel: 'Üretilecek Adet (1 - 200):',
      batchNoteLabel: 'Parti Açıklaması / Matbaa Kodu:',
      generateBtn: 'Kayıtları Üret & Sisteme Ekle',
      cancelBtn: 'İptal',
      setStatus: 'Durumu Değiştir',
      unlink: 'Eşleşmeyi Sıfırla',
      unlinkConfirm: 'Bu etiketin araç eşleşmesini kaldırıp tekrar satış stok durumuna getirmek istiyor musunuz?'
    },
    en: {
      title: 'Central QR & Chip Inventory Bank',
      desc: 'Live registry of physical print production, security tokens, and vehicle pairing status.',
      exportCsv: 'Print CSV Export',
      generateBatch: '+ Generate Batch',
      searchPlaceholder: 'Search by Serial No (TAG ID), License Plate, or Email...',
      all: 'All',
      unclaimed: 'Unclaimed / In Stock',
      active: 'Active Paired',
      disabled: 'Disabled',
      colTagId: 'SERIAL NO (TAG ID)',
      colPin: 'QR CODE',
      colStatus: 'STATUS',
      colPlate: 'PAIRED VEHICLE / PLATE',
      colUser: 'USER ACCOUNT',
      colBatch: 'BATCH / NOTE',
      colActions: 'ACTIONS',
      noRecords: 'No QR inventory records found matching your filters.',
      totalTags: 'Total Inventory',
      activeTags: 'Active Paired',
      unclaimedTags: 'In Stock',
      disabledTags: 'Disabled',
      batchModalTitle: 'Generate New QR / Chip Batch',
      batchCountLabel: 'Quantity (1 - 200):',
      batchNoteLabel: 'Batch Note / Print Code:',
      generateBtn: 'Generate & Save to Registry',
      cancelBtn: 'Cancel',
      setStatus: 'Change Status',
      unlink: 'Reset Pairing',
      unlinkConfirm: 'Are you sure you want to decouple this tag and return it to unclaimed stock?'
    }
  }[lang];

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToQrTags((fetchedTags) => {
      setTags(fetchedTags);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchCount < 1 || batchCount > 200) return;
    setGenerating(true);
    try {
      const created = await createBatchQrTags(batchNote, batchCount);
      setBatchSuccessMsg(`${created.count} adet yeni seri numarası başarıyla üretildi.`);
      setTimeout(() => {
        setShowBatchModal(false);
        setBatchSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert(`Üretim hatası: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const togglePin = (tagId: string) => {
    setRevealedPins(prev => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  const handleStatusChange = async (tagId: string, currentStatus: QrTagStatus) => {
    const nextStatus: QrTagStatus = currentStatus === 'active' ? 'disabled' : currentStatus === 'disabled' ? 'active' : 'disabled';
    try {
      await updateQrTagStatus(tagId, nextStatus);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetTag = async (tagId: string) => {
    if (!window.confirm(t.unlinkConfirm)) return;
    try {
      await resetQrTag(tagId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtreleme
  const filteredTags = tags.filter(tag => {
    const matchesStatus = statusFilter === 'all' || tag.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      tag.tagId.toLowerCase().includes(q) ||
      tag.code.toLowerCase().includes(q.replace(/-/g, '')) ||
      (tag.assignedPlate && tag.assignedPlate.toLowerCase().includes(q)) ||
      (tag.assignedUserEmail && tag.assignedUserEmail.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  // Metrikler (Kartsız, düz metin/çizgi ızgarası)
  const totalCount = tags.length;
  const activeCount = tags.filter(t => t.status === 'active').length;
  const unclaimedCount = tags.filter(t => t.status === 'unclaimed').length;
  const disabledCount = tags.filter(t => t.status === 'disabled').length;

  return (
    <div className="space-y-6">
      {/* BAŞLIK & ANA AKSİYONLAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            {t.title}
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {t.desc}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToPrintCsv(tags)}
            disabled={tags.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t.generateBatch}</span>
          </button>
        </div>
      </div>

      {/* METRİK ŞERİDİ (KARTSIZ, DÜZ YATAY IZGARA) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2 border-b border-neutral-800/80 text-xs font-mono">
        <div className="flex flex-col">
          <span className="text-neutral-500 text-[11px] uppercase tracking-wider">{t.totalTags}</span>
          <span className="text-xl font-bold text-neutral-200 mt-0.5">{totalCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-emerald-500/80 text-[11px] uppercase tracking-wider">{t.activeTags}</span>
          <span className="text-xl font-bold text-emerald-400 mt-0.5">{activeCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-amber-500/80 text-[11px] uppercase tracking-wider">{t.unclaimedTags}</span>
          <span className="text-xl font-bold text-amber-400 mt-0.5">{unclaimedCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-rose-500/80 text-[11px] uppercase tracking-wider">{t.disabledTags}</span>
          <span className="text-xl font-bold text-rose-400 mt-0.5">{disabledCount}</span>
        </div>
      </div>

      {/* ARAMA & FİLTRE ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Arama Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 font-mono"
          />
        </div>

        {/* Durum Filtreleri (Düz Buton Şeridi) */}
        <div className="flex items-center gap-1 border border-neutral-800 p-0.5 rounded bg-neutral-900 self-stretch sm:self-auto">
          {[
            { key: 'all', label: t.all },
            { key: 'unclaimed', label: t.unclaimed },
            { key: 'active', label: t.active },
            { key: 'disabled', label: t.disabled },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === f.key 
                  ? 'bg-neutral-800 text-neutral-100 font-semibold shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLO (KARTSIZ, TAM GENİŞLİK KURUMSAL VERİ TABLOSU) */}
      <div className="border border-neutral-800 rounded overflow-x-auto bg-[#0d1117]">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4">{t.colTagId}</th>
              <th className="py-3 px-4">{t.colPin}</th>
              <th className="py-3 px-4">{t.colStatus}</th>
              <th className="py-3 px-4">{t.colPlate}</th>
              <th className="py-3 px-4">{t.colUser}</th>
              <th className="py-3 px-4">{t.colBatch}</th>
              <th className="py-3 px-4 text-right">{t.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                  Yükleniyor...
                </td>
              </tr>
            ) : filteredTags.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-500">
                  {t.noRecords}
                </td>
              </tr>
            ) : (
              filteredTags.map((item) => {
                const isPinVisible = !!revealedPins[item.tagId];
                return (
                  <tr key={item.tagId} className="hover:bg-neutral-800/40 transition-colors">
                    {/* SERİ NO */}
                    <td className="py-3 px-4 font-bold text-neutral-200">
                      {item.tagId}
                    </td>

                    {/* GÜVENLİK PIN */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono ${isPinVisible ? 'text-emerald-400 font-bold' : 'text-neutral-500'}`}>
                          {isPinVisible ? formatCode(item.code) : '••••-••••-••••'}
                        </span>
                        <button
                          onClick={() => togglePin(item.tagId)}
                          className="p-1 hover:text-white text-neutral-500 transition-colors"
                          title={isPinVisible ? 'Gizle' : 'Göster'}
                        >
                          {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>

                    {/* DURUM */}
                    <td className="py-3 px-4">
                      {item.status === 'active' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </span>
                      )}
                      {item.status === 'unclaimed' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-amber-950/60 border border-amber-800/50 text-amber-400">
                          <Tag className="w-3 h-3" />
                          Boşta (Stok)
                        </span>
                      )}
                      {item.status === 'disabled' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-rose-950/60 border border-rose-800/50 text-rose-400">
                          <XCircle className="w-3 h-3" />
                          Devre Dışı
                        </span>
                      )}
                    </td>

                    {/* PLAKA */}
                    <td className="py-3 px-4 text-neutral-300">
                      {item.assignedPlate ? (
                        <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded font-bold text-white">
                          {item.assignedPlate}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>

                    {/* KULLANICI */}
                    <td className="py-3 px-4 text-neutral-400">
                      {item.assignedUserEmail || <span className="text-neutral-600">—</span>}
                    </td>

                    {/* PARTİ / NOT */}
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      <div>{item.batchNumber || 'Parti 1'}</div>
                      <div className="text-neutral-600">{new Date(item.createdAt).toLocaleDateString('tr-TR')}</div>
                    </td>

                    {/* İŞLEMLER */}
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleStatusChange(item.code, item.status)}
                        className="px-2 py-1 text-[11px] border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                      >
                        {item.status === 'active' ? 'Durdur' : item.status === 'disabled' ? 'Aktifleştir' : 'Kilitle'}
                      </button>

                      {item.status === 'active' && (
                        <button
                          onClick={() => handleResetTag(item.code)}
                          className="px-2 py-1 text-[11px] border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded transition-colors"
                        >
                          {t.unlink}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TOPLU ÜRETİM MODALI */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans">
          <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] p-6 shadow-2xl rounded text-neutral-200">
            <h3 className="text-base font-bold mb-1 text-white">{t.batchModalTitle}</h3>
            <p className="text-xs text-neutral-400 mb-4">
              Güvenli kriptografik anahtarlarla seri numaraları anında oluşturulur.
            </p>

            {batchSuccessMsg ? (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded flex items-center gap-2">
                <Check className="w-4 h-4" />
                {batchSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    {t.batchCountLabel}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    {t.batchNoteLabel}
                  </label>
                  <input
                    type="text"
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    placeholder="Örn: 2026-Nisan UV Baskı"
                    className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                  >
                    {generating ? 'Üretiliyor...' : t.generateBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

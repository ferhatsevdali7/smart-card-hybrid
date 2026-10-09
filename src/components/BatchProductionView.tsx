import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Download, 
  Info, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  CheckSquare,
  Square,
  FileSpreadsheet,
  X,
  QrCode as QrIcon,
  Copy,
  ExternalLink
} from 'lucide-react';
import { 
  createProductionBatch, 
  listenToBatches, 
  fetchBatchTags, 
  updateBatchStatus, 
  exportBatchTechnicalData 
} from '../lib/batchService';
import { 
  generateLogodQrSvg, 
  generateLogodQrPng, 
  downloadSingleQr, 
  getTagActivationUrl 
} from '../lib/qrVectorEngine';
import { BatchItem, BatchStatus, BatchTagItem, ProductType } from '../types/batch';
import { getAdminLang } from '../lib/adminSessionService';

interface BatchProductionViewProps {
  adminEmail: string;
}

export const BatchProductionView: React.FC<BatchProductionViewProps> = ({ adminEmail }) => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Seçili Parti & Detay Görünümü
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [batchTags, setBatchTags] = useState<BatchTagItem[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Toplu Seçim State (Parti İçi)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // PIN Gizleme/Gösterme
  const [revealedPins, setRevealedPins] = useState<{ [tagId: string]: boolean }>({});

  // QR Canlı Önizleme Modalı
  const [previewTag, setPreviewTag] = useState<BatchTagItem | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Yeni Parti Oluşturma Modalı
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [productType, setProductType] = useState<ProductType>('OQ');
  const [count, setCount] = useState<number>(100);
  const [notes, setNotes] = useState<string>('300 Micron UV Ön Cam Baskı');
  const [creating, setCreating] = useState(false);

  // Seri No Mantığı Bilgilendirme Çekmecesi/Modalı
  const [showLogicInfo, setShowLogicInfo] = useState(false);

  const lang = getAdminLang();

  const STATUS_TEXT: Record<BatchStatus, { tr: string; en: string; style: string }> = {
    STATUS_CREATED: {
      tr: 'Oluşturuldu (Taslak)',
      en: 'Created (Draft)',
      style: 'border-neutral-700 bg-neutral-800 text-neutral-300'
    },
    STATUS_IN_PRODUCTION: {
      tr: 'Matbaada (Üretimde)',
      en: 'In Production (Print Shop)',
      style: 'border-sky-800 bg-sky-950/60 text-sky-400'
    },
    STATUS_IN_STOCK: {
      tr: 'Depoda (Satışa Hazır)',
      en: 'In Stock (Ready for Sale)',
      style: 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
    },
    STATUS_ARCHIVED: {
      tr: 'Arşivlendi (Tamamlandı)',
      en: 'Archived (Completed)',
      style: 'border-neutral-800 bg-neutral-900 text-neutral-500'
    },
    STATUS_REJECTED: {
      tr: 'Hatalı Baskı (İptal)',
      en: 'Rejected (Defective)',
      style: 'border-rose-800 bg-rose-950/60 text-rose-400'
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = listenToBatches((fetched) => {
      setBatches(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenBatchDetails = async (batch: BatchItem) => {
    setSelectedBatch(batch);
    setSelectedTagIds([]);
    setLoadingTags(true);
    try {
      const tags = await fetchBatchTags(batch.id);
      setBatchTags(tags);
    } catch (e: any) {
      alert('Etiketler yüklenemedi: ' + e.message);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleCreateBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createProductionBatch(productType, count, notes, adminEmail);
      setShowCreateModal(false);
    } catch (err: any) {
      alert('Üretim hatası: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (batchId: string, newStatus: BatchStatus) => {
    try {
      await updateBatchStatus(batchId, newStatus, adminEmail);
      if (selectedBatch && selectedBatch.id === batchId) {
        setSelectedBatch(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedTagIds.length === batchTags.length) {
      setSelectedTagIds([]);
    } else {
      setSelectedTagIds(batchTags.map(t => t.tagId));
    }
  };

  const toggleSelectTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const togglePin = (tagId: string) => {
    setRevealedPins(prev => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  // QR Canlı Önizlemesini Aç
  const handleOpenQrPreview = async (tag: BatchTagItem) => {
    setPreviewTag(tag);
    setCopiedUrl(false);
    setPreviewSvg(null);
    try {
      const pngData = await generateLogodQrPng(tag.tagId, tag.secretKey, 600);
      setPreviewSvg(pngData);
    } catch (e) {
      console.error('QR görseli üretilemedi:', e);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. ÜST BAŞLIK & REHBER BUTONU */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Seri Üretim & Parti (Batch) Yönetimi
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Matbaa baskı partileri, endüstriyel yaşam döngüsü ve seri numarası izlenebilirlik kütüğü.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* QR KODLAMA VE SERİ NO MANTIĞI BUTONU */}
          <button
            onClick={() => setShowLogicInfo(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
          >
            <Info className="w-4 h-4 text-sky-400" />
            <span>QR Kodlama Mantığı</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Yeni Parti Üret</span>
          </button>
        </div>
      </div>

      {/* 2. PARTİ DETAYI GÖRÜNÜMÜ VEYA ANA PARTİLER TABLOSU */}
      {selectedBatch ? (
        /* PARTİ İÇİ DETAY GÖRÜNÜMÜ */
        <div className="space-y-5">
          {/* Geri Dön ve Parti Başlığı */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-neutral-900/60 border border-neutral-800 rounded">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 transition-colors"
                title="Parti Listesine Geri Dön"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">{selectedBatch.id}</span>
                  <span className={`px-2 py-0.5 text-[11px] border font-mono rounded ${STATUS_TEXT[selectedBatch.status].style}`}>
                    {STATUS_TEXT[selectedBatch.status][lang]}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {selectedBatch.productName} • Toplam {selectedBatch.totalCount} Adet • Not: {selectedBatch.notes}
                </div>
              </div>
            </div>

            {/* Durum Değiştir & CSV İndir */}
            <div className="flex items-center gap-2">
              <select
                value={selectedBatch.status}
                onChange={(e) => handleStatusChange(selectedBatch.id, e.target.value as BatchStatus)}
                className="px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded text-neutral-200 focus:outline-none focus:border-emerald-500 font-mono"
              >
                <option value="STATUS_CREATED">1. Oluşturuldu (Taslak)</option>
                <option value="STATUS_IN_PRODUCTION">2. Matbaada (Üretimde)</option>
                <option value="STATUS_IN_STOCK">3. Depoda (Satışa Hazır)</option>
                <option value="STATUS_ARCHIVED">4. Arşivlendi (Tamamlandı)</option>
                <option value="STATUS_REJECTED">5. Hatalı Baskı (İptal)</option>
              </select>

              <button
                onClick={() => {
                  const toExport = selectedTagIds.length > 0 
                    ? batchTags.filter(t => selectedTagIds.includes(t.tagId))
                    : batchTags;
                  exportBatchTechnicalData(selectedBatch, toExport);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedTagIds.length > 0 ? `Seçilenleri İndir (${selectedTagIds.length})` : 'Tüm Partiyi İndir (CSV)'}</span>
              </button>
            </div>
          </div>

          {/* PARTİ İÇİ ETİKETLER TABLOSU */}
          <div className="border border-neutral-800 rounded overflow-x-auto bg-[#0d1117]">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <button onClick={toggleSelectAll} className="hover:text-white">
                      {selectedTagIds.length === batchTags.length && batchTags.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-600" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">SIRA</th>
                  <th className="py-3 px-4">SERİ NUMARASI (TAG ID)</th>
                  <th className="py-3 px-4">GÜVENLİK PIN</th>
                  <th className="py-3 px-4">DURUM</th>
                  <th className="py-3 px-4">EŞLEŞEN PLAKA</th>
                  <th className="py-3 px-4">KULLANICI</th>
                  <th className="py-3 px-4 text-right">QR ÖNİZLEME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {loadingTags ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                      Parti etiketleri yükleniyor...
                    </td>
                  </tr>
                ) : batchTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.tagId);
                  const isPinVisible = !!revealedPins[tag.tagId];

                  return (
                    <tr 
                      key={tag.tagId} 
                      className={`hover:bg-neutral-800/40 transition-colors ${isSelected ? 'bg-emerald-950/20' : ''}`}
                    >
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => toggleSelectTag(tag.tagId)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-neutral-600" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-neutral-500 font-bold">
                        #{tag.sequenceNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-neutral-200">
                        {tag.tagId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className={isPinVisible ? 'text-emerald-400 font-bold' : 'text-neutral-500'}>
                            {isPinVisible ? tag.secretKey : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePin(tag.tagId)}
                            className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] border ${
                          tag.status === 'active' 
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400' 
                            : tag.status === 'disabled' 
                            ? 'bg-rose-950/60 border-rose-800 text-rose-400' 
                            : 'bg-amber-950/60 border-amber-800 text-amber-400'
                        }`}>
                          {tag.status === 'active' ? 'Aktif Eşleşmiş' : tag.status === 'disabled' ? 'Pasif / İptal' : 'Boşta (Stok)'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {tag.assignedPlate ? (
                          <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-white font-bold">
                            {tag.assignedPlate}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {tag.assignedUserEmail || <span className="text-neutral-600">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenQrPreview(tag)}
                          className="px-2.5 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-emerald-400 hover:text-emerald-300 rounded transition-colors inline-flex items-center gap-1.5"
                        >
                          <QrIcon className="w-3.5 h-3.5" />
                          <span>QR Gör</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ANA PARTİ LİSTESİ TABLOSU */
        <div className="border border-neutral-800 rounded overflow-x-auto bg-[#0d1117]">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/80 text-neutral-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">PARTİ KODU</th>
                <th className="py-3 px-4">ÜRÜN TİPİ</th>
                <th className="py-3 px-4">ADET</th>
                <th className="py-3 px-4">YAŞAM DÖNGÜSÜ DURUMU</th>
                <th className="py-3 px-4">MATBAA NOTU</th>
                <th className="py-3 px-4">OLUŞTURULMA TARİHİ</th>
                <th className="py-3 px-4 text-right">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 opacity-50" />
                    Üretim partileri listeleniyor...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-500">
                    Henüz oluşturulmuş bir üretim partisi bulunmuyor. Sağ üstteki "+ Yeni Parti Üret" butonunu kullanın.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-neutral-100">
                      {b.id}
                    </td>
                    <td className="py-3 px-4 text-neutral-300">
                      {b.productName}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {b.totalCount} Adet
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] border rounded ${STATUS_TEXT[b.status].style}`}>
                        {STATUS_TEXT[b.status][lang]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-400">
                      {b.notes}
                    </td>
                    <td className="py-3 px-4 text-neutral-400 text-[11px]">
                      {new Date(b.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenBatchDetails(b)}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-[11px] border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
                      >
                        <span>Partiyi İncele</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. YENİ PARTİ ÜRETİM MODALI */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] p-6 shadow-2xl rounded text-neutral-200">
            <h3 className="text-base font-bold mb-1 text-white">Yeni Endüstriyel Seri Üretim Partisi</h3>
            <p className="text-xs text-neutral-400 mb-4 font-mono">
              Standart: HF-[Ürün]-[YYMM]-[BXX]-[SıraNo]
            </p>

            <form onSubmit={handleCreateBatchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-mono">
                  ÜRÜN TİPİ
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value as ProductType)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="OQ">OQ - Otomobil Ön Cam QR Etiketi</option>
                  <option value="MQ">MQ - Medikal Acil SOS QR Etiketi</option>
                  <option value="KQ">KQ - Kişisel Dijital Kartvizit QR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-mono">
                  ÜRETİM ADEDİ (1 - 1000)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-emerald-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-mono">
                  MATBAA & BASKI NOTU
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Örn: 300 Micron UV Ön Cam Baskı"
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors disabled:opacity-50"
                >
                  {creating ? 'Parti Üretiliyor...' : 'Partiyi Başlat & Üret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. QR KODLAMA VE SERİ NO MANTIĞI MODALI (TEKNİK REHBER) */}
      {showLogicInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
          <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] p-6 shadow-2xl rounded text-neutral-200 relative">
            <button
              onClick={() => setShowLogicInfo(false)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">HF Endüstriyel QR Kodlama & Seri No Mantığı</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-neutral-300">
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded font-mono text-center text-sm font-bold text-emerald-400">
                HF - OQ - 2604 - B01 - 0001
              </div>

              <div className="space-y-2 font-mono">
                <div className="p-2 bg-neutral-900/50 rounded border border-neutral-800">
                  <span className="text-emerald-400 font-bold">1. Segment (HF):</span> Kurumsal İsim & Marka Kodu (Haşim & Ferhat).
                </div>
                <div className="p-2 bg-neutral-900/50 rounded border border-neutral-800">
                  <span className="text-sky-400 font-bold">2. Segment (OQ):</span> Ürün Tipi (OQ: Otomobil Ön Cam QR, MQ: Medikal SOS, KQ: Kartvizit).
                </div>
                <div className="p-2 bg-neutral-900/50 rounded border border-neutral-800">
                  <span className="text-amber-400 font-bold">3. Segment (2604):</span> Üretim Yılı ve Ayı (26 = 2026, 04 = Nisan Ayı).
                </div>
                <div className="p-2 bg-neutral-900/50 rounded border border-neutral-800">
                  <span className="text-indigo-400 font-bold">4. Segment (B01):</span> Matbaa Üretim Parti Numarası (Batch 01).
                </div>
                <div className="p-2 bg-neutral-900/50 rounded border border-neutral-800">
                  <span className="text-rose-400 font-bold">5. Segment (0001):</span> Partideki Sıra Numarası (1 ile 1000 arası ardışık numara).
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
                Bu mimari sayesinde depoda veya sahada bir etikete bakıldığı an hangi ürün olduğu, ne zaman ve hangi partide üretildiği tek bakışta anlaşılır.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. H****F LOGOLU QR BÜYÜK ÖNİZLEME & İNDİRME MODALI */}
      {previewTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm font-sans">
          <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] p-6 shadow-2xl rounded text-neutral-200 relative text-center">
            <button
              onClick={() => setPreviewTag(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-1">
              Vektörel QR & H****F Logolu Önizleme
            </h3>
            <p className="text-xs text-neutral-400 mb-4 font-mono">
              Seri No: <span className="text-emerald-400 font-bold">{previewTag.tagId}</span>
            </p>

            {/* QR Görsel Kutusu */}
            <div className="p-4 bg-white rounded-lg inline-block shadow-inner mb-4">
              {previewSvg ? (
                <img 
                  src={previewSvg} 
                  alt="QR Code" 
                  className="w-64 h-64 object-contain rounded"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-neutral-400">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>

            {/* Güvenlik PIN ve Link Bilgisi */}
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded text-left font-mono text-xs space-y-1.5 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Güvenlik PIN:</span>
                <span className="text-emerald-400 font-bold tracking-wider">{previewTag.secretKey}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                <span className="text-neutral-500">Hata Toleransı:</span>
                <span className="text-neutral-300 font-bold">Level H (%30 Reed-Solomon)</span>
              </div>
            </div>

            {/* İndirme Butonları */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => downloadSingleQr(previewTag.tagId, previewTag.secretKey, 'svg')}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors font-mono"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Vektörel SVG İndir</span>
              </button>
              <button
                onClick={() => downloadSingleQr(previewTag.tagId, previewTag.secretKey, 'png')}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors font-mono"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baskı PNG İndir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

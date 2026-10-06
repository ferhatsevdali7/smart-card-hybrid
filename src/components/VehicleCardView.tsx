import React, { useState } from 'react';
import { 
  CarFront, Phone, AlertTriangle, ShieldCheck, 
  MessageSquare, Clock, Copy, Check, Edit3, X, Save 
} from 'lucide-react';
import { VehicleInfo } from '../types/card';
import { Language, ThemeMode } from '../lib/i18n';

interface VehicleCardViewProps {
  cardId?: string;
  vehicle?: VehicleInfo;
  lang?: Language;
  theme?: ThemeMode;
  isPublicScan?: boolean;
  onOpenAuth?: () => void;
  onUpdateVehicle?: (updated: VehicleInfo) => void;
  isOwner?: boolean;
}

const DEFAULT_VEHICLE: VehicleInfo = {
  plateNumber: '34 ABC 789',
  brandModel: 'Hibrit Akıllı Araç',
  ownerName: 'Kart Sahibi',
  ownerPhone: '+90 5XX XXX XX XX',
  emergencyContact: '+90 5XX XXX XX XX',
  parkingNote: 'Aracım hatalı park durumundaysa veya acil bir durum varsa lütfen hemen aşağıdaki butondan beni arayın.',
  insuranceStatus: 'Aktif Kasko & Trafik Sigortası'
};

export const VehicleCardView: React.FC<VehicleCardViewProps> = ({
  cardId = 'DEMO-749123',
  vehicle = DEFAULT_VEHICLE,
  lang = 'tr',
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth,
  onUpdateVehicle,
  isOwner = false
}) => {
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<VehicleInfo>(vehicle);

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(vehicle.ownerPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateVehicle) {
      onUpdateVehicle(editForm);
    }
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      
      {/* Owner Quick Edit Action Bar */}
      {isOwner && onUpdateVehicle && (
        <div className="flex items-center justify-between bg-amber-500/15 border border-amber-500/30 p-3 rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{lang === 'tr' ? 'Araç Kartı Yönetimi' : 'Vehicle Card Management'}</span>
          </div>
          <button
            onClick={() => { setEditForm(vehicle); setIsEditing(true); }}
            className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{lang === 'tr' ? 'Aracı Düzenle' : 'Edit Vehicle'}</span>
          </button>
        </div>
      )}

      {/* Top Status Header */}
      <div className={`${isDark ? 'bg-amber-950/30 border-amber-800/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'} border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <CarFront className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-mono font-bold text-amber-400">
              {lang === 'tr' ? 'Dijital Araç Kartı & Park Bildirimi' : 'Digital Vehicle Card & Parking ID'}
            </div>
            <div className="text-sm font-bold">
              {lang === 'tr' ? 'Araç Sahibi İletişim ve Acil Durum Profili' : 'Vehicle Owner Contact & Emergency Profile'}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-amber-300">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{cardId}</span>
        </div>
      </div>

      {/* Main Vehicle Plate Badge */}
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'} border rounded-3xl p-6 sm:p-8 space-y-6 text-center relative overflow-hidden`}>
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600"></div>

        {/* Turkish License Plate Realistic Badge */}
        <div className="inline-flex items-center border-4 border-slate-900 bg-white text-slate-900 rounded-2xl px-6 py-3 shadow-2xl font-mono tracking-widest font-black text-2xl sm:text-4xl gap-4 select-none">
          <div className="bg-blue-700 text-white text-xs px-2 py-1.5 rounded flex flex-col items-center justify-center font-bold -ml-3">
            <span>TR</span>
          </div>
          <span className="text-slate-950 uppercase">{vehicle.plateNumber}</span>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-bold">{vehicle.brandModel}</h2>
          <p className="text-xs text-slate-400">{lang === 'tr' ? 'Kayıtlı Araç Sahibi:' : 'Registered Owner:'} <span className="font-semibold text-white">{vehicle.ownerName}</span></p>
        </div>

        {/* Quick Driver Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <a
            href={`tel:${vehicle.ownerPhone}`}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
          >
            <Phone className="w-5 h-5" />
            <span>{lang === 'tr' ? 'Araç Sahibini Ara' : 'Call Vehicle Owner'}</span>
          </a>

          <a
            href={`https://wa.me/${vehicle.ownerPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Merhaba, ' + vehicle.plateNumber + ' plakalı aracınız hakkında size ulaşıyorum.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            <span>{lang === 'tr' ? 'WhatsApp Mesaj Gönder' : 'Send WhatsApp Message'}</span>
          </a>
        </div>
      </div>

      {/* Driver / Parking Message Card */}
      <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-6 space-y-4`}>
        <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span>{lang === 'tr' ? 'Sürücü / Park Notu' : 'Driver / Parking Notice'}</span>
        </div>
        <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} leading-relaxed bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60`}>
          "{vehicle.parkingNote}"
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'tr' ? '7/24 Aktif İletişim Hattı' : '24/7 Active Contact'}</span>
          </div>
          <button
            onClick={handleCopyPhone}
            className="inline-flex items-center gap-1 text-xs text-[#509BEC] hover:underline"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (lang === 'tr' ? 'Kopyalandı' : 'Copied') : (lang === 'tr' ? 'Numarayı Kopyala' : 'Copy Number')}</span>
          </button>
        </div>
      </div>

      {/* Footer Info / Edit CTA for Card Owner */}
      {isPublicScan && onOpenAuth && (
        <div className="text-center pt-4">
          <button
            onClick={onOpenAuth}
            className="text-xs text-slate-400 hover:text-white underline transition-colors"
          >
            {lang === 'tr' ? 'Araç sahibi misiniz? Giriş yapıp araç bilgilerinizi düzenleyin' : 'Are you the vehicle owner? Sign in to edit'}
          </button>
        </div>
      )}

      {/* In-Page Vehicle Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsEditing(false)} className="fixed inset-0 bg-black/65 backdrop-blur-sm" />
          <div className={`relative w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-3xl p-6 shadow-2xl z-10 space-y-4 max-h-[90vh] overflow-y-auto`}>
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">{lang === 'tr' ? 'Araç Kartı Bilgilerini Düzenle' : 'Edit Vehicle Card Info'}</h3>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Araç Plakası' : 'License Plate'}</label>
                  <input
                    type="text"
                    value={editForm.plateNumber}
                    onChange={(e) => setEditForm({ ...editForm, plateNumber: e.target.value.toUpperCase() })}
                    placeholder="34 ABC 789"
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none font-mono font-bold uppercase`}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Marka & Model' : 'Brand & Model'}</label>
                  <input
                    type="text"
                    value={editForm.brandModel}
                    onChange={(e) => setEditForm({ ...editForm, brandModel: e.target.value })}
                    placeholder="Örn: Toyota Corolla Hibrit"
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Araç Sahibi Adı' : 'Owner Name'}</label>
                  <input
                    type="text"
                    value={editForm.ownerName}
                    onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'İletişim Telefonu' : 'Contact Phone'}</label>
                  <input
                    type="text"
                    value={editForm.ownerPhone}
                    onChange={(e) => setEditForm({ ...editForm, ownerPhone: e.target.value })}
                    placeholder="+90 5XX..."
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none font-mono`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-amber-400 uppercase tracking-wider">{lang === 'tr' ? 'Park & Sürücü Notu' : 'Parking Note'}</label>
                <textarea
                  value={editForm.parkingNote}
                  onChange={(e) => setEditForm({ ...editForm, parkingNote: e.target.value })}
                  rows={3}
                  placeholder={lang === 'tr' ? 'Hatalı park durumunda lütfen arayın...' : 'Please call if parked inappropriately...'}
                  className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none leading-relaxed`}
                  required
                />
              </div>

              {/* Save / Cancel Buttons */}
              <div className="flex gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className={`flex-1 py-3 rounded-xl border font-bold ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'}`}
                >
                  {lang === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'tr' ? 'Kaydet & Canlıya Al' : 'Save & Publish'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

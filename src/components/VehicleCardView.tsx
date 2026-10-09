import React, { useState } from 'react';
import { 
  CarFront, Phone, ShieldCheck, 
  MessageSquare, Copy, Check, Save,
  QrCode, Printer, Lock, Eye, Shield,
  Lightbulb, AlertOctagon, Compass, CheckCircle2,
  Smartphone, X, Wifi, Battery
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  subTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
}

const DEFAULT_VEHICLE: VehicleInfo = {
  plateNumber: '34 ABC 789',
  brandModel: 'Hibrit Akıllı Araç',
  ownerName: 'Kart Sahibi',
  ownerPhone: '+90 532 000 00 00',
  emergencyContact: '+90 532 000 00 00',
  parkingNote: 'Aracım hatalı park durumundaysa veya acil bir durum varsa lütfen bildirin.',
  insuranceStatus: 'Aktif Kasko & Trafik Sigortası',
  hidePhone: true,
  allowDirectCall: false, // Default to ultra safe mode
  allowWhatsApp: true
};

export type SubTab = 'details' | 'qr';

interface QuickNoticeOption {
  id: string;
  labelTr: string;
  labelEn: string;
  messageTr: string;
  messageEn: string;
  icon: React.ReactNode;
}

const QUICK_NOTICES: QuickNoticeOption[] = [
  {
    id: 'blocking',
    icon: <CarFront className="w-4 h-4 text-amber-500" />,
    labelTr: 'Yolu Kapatıyor',
    labelEn: 'Blocking Road',
    messageTr: 'Merhaba, {PLATE} plakalı aracınız çıkışımı engelliyor. Müsait olduğunuzda rica etsem çekebilir misiniz?',
    messageEn: 'Hello, your vehicle {PLATE} is blocking my exit. Could you please move it when possible?'
  },
  {
    id: 'lights',
    icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
    labelTr: 'Farlar Açık',
    labelEn: 'Lights On',
    messageTr: 'Merhaba, {PLATE} plakalı aracınızın farları açık kalmış. Akünüzün bitmemesi için haber vermek istedim.',
    messageEn: 'Hello, your vehicle {PLATE} has its lights left on.'
  },
  {
    id: 'window',
    icon: <Compass className="w-4 h-4 text-amber-500" />,
    labelTr: 'Cam / Kapı Açık',
    labelEn: 'Window / Door Open',
    messageTr: 'Merhaba, {PLATE} plakalı aracınızın camı veya kapısı açık kalmış görünüyor.',
    messageEn: 'Hello, your vehicle {PLATE} appears to have an open window or door.'
  },
  {
    id: 'alarm_accident',
    icon: <AlertOctagon className="w-4 h-4 text-rose-500" />,
    labelTr: 'Alarm / Temas',
    labelEn: 'Alarm / Impact',
    messageTr: 'Merhaba, {PLATE} plakalı aracınızın alarmı çalıyor veya bir temas durumu oldu, kontrol etmeniz rica olunur.',
    messageEn: 'Hello, your vehicle {PLATE} alarm was triggered or had an impact.'
  }
];

// Helper to auto format Turkish License Plate
const formatTurkishPlate = (input: string) => {
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length <= 2) return clean;
  
  // Extract province code (first 2 digits)
  const province = clean.slice(0, 2);
  const rest = clean.slice(2);
  
  // Extract letters
  const lettersMatch = rest.match(/^[A-Z]+/);
  if (!lettersMatch) return `${province} ${rest}`;
  
  const letters = lettersMatch[0].slice(0, 3);
  const digits = rest.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 4);
  
  if (digits) {
    return `${province} ${letters} ${digits}`;
  } else if (letters) {
    return `${province} ${letters}`;
  }
  return province;
};

export const VehicleCardView: React.FC<VehicleCardViewProps> = ({
  cardId = 'DEMO-749123',
  vehicle = DEFAULT_VEHICLE,
  lang = 'tr',
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth,
  onUpdateVehicle,
  isOwner = false,
  subTab = 'details',
  onSubTabChange
}) => {
  const isDark = theme === 'dark';
  const [internalSubTab, setInternalSubTab] = useState<SubTab>(subTab);

  React.useEffect(() => {
    if (subTab) {
      setInternalSubTab(subTab);
    }
  }, [subTab]);

  const activeSubTab = subTab || internalSubTab;
  const handleSelectSubTab = (tab: SubTab) => {
    setInternalSubTab(tab);
    if (onSubTabChange) {
      onSubTabChange(tab);
    }
  };

  // Form State for Owner Editing
  const [formData, setFormData] = useState<VehicleInfo>({
    hidePhone: true,
    allowDirectCall: false,
    allowWhatsApp: true,
    ...vehicle
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPhoneSimulator, setShowPhoneSimulator] = useState(false);

  // Visitor Quick Notice Selection
  const [selectedNotice, setSelectedNotice] = useState<string>('blocking');
  const [customNote, setCustomNote] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  React.useEffect(() => {
    setFormData({
      hidePhone: true,
      allowDirectCall: false,
      allowWhatsApp: true,
      ...vehicle
    });
  }, [vehicle]);

  const vehicleUrl = `${window.location.origin}?view=vehicle&id=${cardId}`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateVehicle) {
      onUpdateVehicle(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(vehicleUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Dedicated clean print trigger
  const handlePrintDecal = () => {
    window.print();
  };

  // Build visitor message
  const currentNoticeObj = QUICK_NOTICES.find(n => n.id === selectedNotice) || QUICK_NOTICES[0];
  const activeTemplate = lang === 'tr' ? currentNoticeObj.messageTr : currentNoticeObj.messageEn;
  const resolvedTemplate = activeTemplate.replace('{PLATE}', (isOwner ? formData.plateNumber : vehicle.plateNumber) || 'Araç');
  const finalMessage = customNote.trim() ? `${resolvedTemplate}\n\nNot: ${customNote.trim()}` : resolvedTemplate;
  const targetPhone = isOwner ? formData.ownerPhone : vehicle.ownerPhone;
  const rawPhoneDigits = (targetPhone || '').replace(/[^0-9]/g, '');
  const whatsAppUrl = `https://wa.me/${rawPhoneDigits}?text=${encodeURIComponent(finalMessage)}`;

  // COMPONENT: VISITOR VIEW CONTENT (Shared between Public Scan and Phone Simulator)
  const VisitorExperience = ({ isInsideSimulator = false }: { isInsideSimulator?: boolean }) => {
    const currentVehicle = isInsideSimulator ? formData : vehicle;
    return (
      <div className={`space-y-4 text-center ${isInsideSimulator ? 'p-4 text-slate-900' : 'max-w-md mx-auto pt-2'}`}>
        
        {/* Protected Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <Shield className="w-3 h-3" />
          <span>{lang === 'tr' ? 'Gizli & Korumalı Sürücü Hattı' : 'Encrypted Driver Contact'}</span>
        </div>

        {/* Turkish License Plate Badge */}
        <div className="pt-1">
          <div className="inline-flex items-center bg-white text-slate-950 rounded-xl px-5 py-2 shadow-lg border-2 border-slate-900 select-none">
            <div className="bg-[#003399] text-white text-[9px] font-bold px-1.5 py-1 rounded flex flex-col items-center justify-center leading-none mr-2.5 select-none">
              <span className="opacity-70 text-[6px]">★</span>
              <span>TR</span>
            </div>
            <span className="font-mono tracking-wider font-black text-xl sm:text-2xl uppercase text-slate-950">
              {currentVehicle.plateNumber || '34 ABC 789'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            {currentVehicle.brandModel || 'Araç Sahibi'}
          </div>
        </div>

        {/* Driver Parking Note */}
        {currentVehicle.parkingNote && (
          <div className="p-3 rounded-2xl text-[11px] leading-relaxed bg-slate-100/90 border border-slate-200 text-slate-700 text-left">
            <div className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">
              {lang === 'tr' ? 'Sürücü Notu' : 'Driver Note'}
            </div>
            "{currentVehicle.parkingNote}"
          </div>
        )}

        {/* Quick Notice Selection */}
        <div className="space-y-2 text-left">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {lang === 'tr' ? 'Hızlı Durum Seçin' : 'Select Quick Status'}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {QUICK_NOTICES.map((notice) => {
              const isSelected = selectedNotice === notice.id;
              return (
                <button
                  key={notice.id}
                  type="button"
                  onClick={() => setSelectedNotice(notice.id)}
                  className={`p-2.5 rounded-xl text-left transition-all border flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-amber-50 border-amber-500 text-slate-950 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {notice.icon}
                    <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-500' : 'bg-transparent'}`} />
                  </div>
                  <div className="text-[11px] font-bold">
                    {lang === 'tr' ? notice.labelTr : notice.labelEn}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Optional Note */}
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder={lang === 'tr' ? 'İsteğe bağlı ek not...' : 'Optional note...'}
            className="w-full px-3 py-2 rounded-xl text-[11px] outline-none border bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500"
          />
        </div>

        {/* Real Functioning Actions (Works in Simulator as well) */}
        <div className="space-y-2 pt-1">
          {currentVehicle.allowWhatsApp !== false && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-current" />
              <span>{lang === 'tr' ? 'Sürücüye WhatsApp ile Bildir' : 'Send WhatsApp Notice'}</span>
            </a>
          )}

          {currentVehicle.allowDirectCall && (
            <a
              href={`tel:${currentVehicle.ownerPhone}`}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-[11px] flex items-center justify-center gap-1.5 border bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-sm transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>{lang === 'tr' ? 'Arama Başlat (GSM)' : 'Direct Call'}</span>
            </a>
          )}
        </div>

      </div>
    );
  };

  // IF PUBLIC SCAN FROM STRANGER'S PHONE
  if (isPublicScan && !isOwner) {
    return (
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        <VisitorExperience isInsideSimulator={false} />
        {onOpenAuth && (
          <div className="text-center pt-6">
            <button
              onClick={onOpenAuth}
              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
            >
              {lang === 'tr' ? 'Bu aracın sahibi misiniz? Giriş yapıp yönetin' : 'Vehicle owner? Sign in to manage'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // OWNER DASHBOARD VIEW
  return (
    <div className="max-w-xl mx-auto px-3 sm:px-4 space-y-6 pb-28 pt-1">

      {/* Print-Only Pure Windshield Decal Container */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[99999]">
        <div className="max-w-xs mx-auto border-4 border-black p-6 rounded-3xl text-center space-y-4">
          <div className="text-base font-black tracking-widest uppercase border-b-2 border-black pb-2">
            AKILLI ARAÇ BİLDİRİMİ
          </div>
          <div className="text-xl font-mono font-black border-2 border-black py-1 px-3 rounded-lg inline-block">
            {formData.plateNumber || '34 ABC 789'}
          </div>
          <div className="py-2 flex justify-center">
            <QRCodeSVG value={vehicleUrl} size={200} level="H" includeMargin={false} />
          </div>
          <div className="text-xs font-bold uppercase">
            Hatalı Park / Acil Durumda Okutunuz
          </div>
          <div className="text-[10px] text-gray-600">
            Güvenli ve Gizli İletişim Hattı • smart-card-hybrid.web.app
          </div>
        </div>
      </div>

      {/* Floating Segmented Navigation */}
      <div className="flex justify-center print:hidden">
        <div className={`inline-flex p-1 rounded-full backdrop-blur-xl border transition-all ${
          isDark 
            ? 'bg-slate-900/60 border-slate-800/80 shadow-xl' 
            : 'bg-white/80 border-slate-200 shadow-md'
        }`}>
          <button
            onClick={() => handleSelectSubTab('details')}
            className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 ${
              activeSubTab === 'details'
                ? isDark ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-white font-bold'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <CarFront className="w-3.5 h-3.5" />
            <span>{lang === 'tr' ? 'araç kartı bilgileri/ düzele' : 'Vehicle Info / Edit'}</span>
          </button>

          <button
            onClick={() => handleSelectSubTab('qr')}
            className={`px-5 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 ${
              activeSubTab === 'qr'
                ? isDark ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-white font-bold'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{lang === 'tr' ? 'araç kart QR' : 'Vehicle QR'}</span>
          </button>
        </div>
      </div>

      {/* ----------------- SUB-TAB 1: OWNER EDIT & SETTINGS FORM ----------------- */}
      {activeSubTab === 'details' && (
        <form onSubmit={handleSave} className="space-y-6 print:hidden">

          {/* Section 1: Header */}
          <div className="space-y-1">
            <h2 className="text-base font-bold tracking-tight">
              {lang === 'tr' ? 'Araç & Park İletişim Bilgileri' : 'Vehicle & Parking Profile'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'tr' 
                ? 'Aracınızın camına yapıştıracağınız QR okutulduğunda kullanılacak bilgileri ve gizlilik tercihlerinizi belirleyin.' 
                : 'Configure vehicle details and privacy settings for your windshield QR sticker.'}
            </p>
          </div>

          {/* Plate & Model Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {lang === 'tr' ? 'Araç Plakası' : 'License Plate'}
              </label>
              <input
                type="text"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: formatTurkishPlate(e.target.value) })}
                placeholder="34 ABC 789"
                maxLength={11}
                className={`w-full px-3.5 py-3 rounded-2xl border text-sm font-mono font-bold uppercase outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-white focus:border-amber-500/50' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
                }`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {lang === 'tr' ? 'Marka & Model' : 'Brand & Model'}
              </label>
              <input
                type="text"
                value={formData.brandModel}
                onChange={(e) => setFormData({ ...formData, brandModel: e.target.value })}
                placeholder="Örn: BMW 320i, Renault Clio"
                className={`w-full px-3.5 py-3 rounded-2xl border text-xs font-medium outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-white focus:border-amber-500/50' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
                }`}
                required
              />
            </div>
          </div>

          {/* Owner Phone & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {lang === 'tr' ? 'Sürücü Adı' : 'Driver Name'}
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className={`w-full px-3.5 py-3 rounded-2xl border text-xs font-medium outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-white focus:border-amber-500/50' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
                }`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {lang === 'tr' ? 'İletişim Telefonu' : 'Contact Phone'}
              </label>
              <input
                type="text"
                value={formData.ownerPhone}
                onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                placeholder="+90 532 000 00 00"
                className={`w-full px-3.5 py-3 rounded-2xl border text-xs font-mono font-medium outline-none transition-all ${
                  isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-white focus:border-amber-500/50' 
                    : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
                }`}
                required
              />
            </div>
          </div>

          {/* Privacy & Anti-Harassment Controls (Apple Settings Style List) */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {lang === 'tr' ? 'Gizlilik ve Taciz Kalkanı' : 'Privacy & Security Filters'}
            </div>

            <div className={`rounded-2xl border divide-y overflow-hidden transition-all ${
              isDark 
                ? 'bg-slate-900/40 border-slate-800 divide-slate-800/60' 
                : 'bg-white border-slate-200 divide-slate-100 shadow-sm'
            }`}>
              
              {/* Toggle 1: WhatsApp Quick Notice */}
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-500/5 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-semibold flex items-center gap-1.5 text-emerald-500">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{lang === 'tr' ? 'WhatsApp Hızlı Durum Butonları (Önerilen)' : 'WhatsApp Quick Notices (Recommended)'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {lang === 'tr' 
                      ? 'Karşı taraf tek tıkla hazır şablon mesaj atar. Numaranızı açıkça arama ekranında ele geçiremez.' 
                      : 'Send 1-tap quick status message without exposing your phone to their dialer.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowWhatsApp !== false}
                  onChange={(e) => setFormData({ ...formData, allowWhatsApp: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>

              {/* Toggle 2: Direct Call (GSM Warning) */}
              <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-500/5 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>{lang === 'tr' ? 'Doğrudan GSM Aramasına İzin Ver' : 'Allow Direct GSM Calling'}</span>
                  </div>
                  <div className="text-[11px] text-amber-500/80 leading-relaxed">
                    {lang === 'tr' 
                      ? '⚠️ Dikkat: Açıldığında arayan kişinin telefon arama ekranında numaranız açıkça görünecektir.' 
                      : '⚠️ Warning: When enabled, your phone number will be displayed on caller dialer screen.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowDirectCall === true}
                  onChange={(e) => setFormData({ ...formData, allowDirectCall: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </label>

            </div>
          </div>

          {/* Driver Custom Parking Note */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {lang === 'tr' ? 'Varsayılan Park & Sürücü Notu' : 'Default Parking Note'}
            </label>
            <textarea
              value={formData.parkingNote}
              onChange={(e) => setFormData({ ...formData, parkingNote: e.target.value })}
              rows={2}
              placeholder={lang === 'tr' ? 'Örn: Hatalı park durumunda lütfen bildirin, hemen geliyorum.' : 'Please notify if parked inappropriately...'}
              className={`w-full px-3.5 py-3 rounded-2xl border text-xs outline-none leading-relaxed transition-all ${
                isDark 
                  ? 'bg-slate-900/60 border-slate-800 text-white focus:border-amber-500/50' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-slate-400'
              }`}
            />
          </div>

          {/* Action Row: Live Simulator & Save */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPhoneSimulator(true)}
              className={`flex-1 py-3.5 px-4 rounded-2xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                isDark 
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm'
              }`}
            >
              <Smartphone className="w-4 h-4 text-amber-500" />
              <span>{lang === 'tr' ? 'Telefon Simülatöründe Gör' : 'Preview in Phone Simulator'}</span>
            </button>

            <button
              type="submit"
              className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
            >
              {saveSuccess ? <CheckCircle2 className="w-4 h-4 text-slate-950" /> : <Save className="w-4 h-4" />}
              <span>{saveSuccess ? (lang === 'tr' ? 'Kaydedildi!' : 'Saved!') : (lang === 'tr' ? 'Değişiklikleri Kaydet' : 'Save Changes')}</span>
            </button>
          </div>

        </form>
      )}

      {/* ----------------- SUB-TAB 2: WINDSHIELD QR STICKER ----------------- */}
      {activeSubTab === 'qr' && (
        <div className="space-y-6 text-center print:hidden">

          <div className="space-y-1">
            <h2 className="text-base font-bold">{lang === 'tr' ? 'Araç Ön Camı & Torpido QR Etiketi' : 'Windshield Smart QR Sticker'}</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {lang === 'tr' 
                ? 'Aracınızın camına yapıştırın. Numaranızı açıkça yazmadan acil bildirimleri güvenle alın.' 
                : 'Print and place on your windshield. Receive instant notices without exposing your private phone number.'}
            </p>
          </div>

          {/* Modern Windshield Decal Preview */}
          <div className="inline-block relative">
            <div className={`p-6 sm:p-7 rounded-3xl border text-center space-y-4 max-w-xs mx-auto shadow-2xl ${
              isDark 
                ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-slate-800 text-white' 
                : 'bg-white border-slate-200 text-slate-900'
            }`}>
              
              {/* Sticker Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black tracking-wider text-amber-500 uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>AKILLI ARAÇ</span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {formData.plateNumber || '34 ABC 789'}
                </span>
              </div>

              {/* QR Render */}
              <div className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mx-auto">
                <QRCodeSVG 
                  id="vehicle-qr" 
                  value={vehicleUrl} 
                  size={160} 
                  level="H" 
                  includeMargin={false}
                />
              </div>

              {/* Footer Instruction */}
              <div className="space-y-0.5 pt-1">
                <div className="text-xs font-black uppercase tracking-wider text-amber-500">
                  {lang === 'tr' ? 'Hatalı Park & Acil Bildirim' : 'Parking & Urgent Notice'}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {lang === 'tr' ? 'Kameranız ile QR kodu okutunuz' : 'Scan QR code with your camera'}
                </div>
                <div className="pt-2 flex items-center justify-center gap-1 text-[9px] text-slate-500 font-mono">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>{lang === 'tr' ? 'Gizli & Maskelenmiş İletişim' : 'Protected Channel'}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row gap-2.5 max-w-sm mx-auto pt-2">
            <button
              onClick={handleCopyLink}
              className={`flex-1 py-3 px-4 rounded-2xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                copiedLink 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Linki Kopyala' : 'Copy Link')}</span>
            </button>

            <button
              onClick={handlePrintDecal}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{lang === 'tr' ? 'Cam Etiketi Yazdır' : 'Print Sticker'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ----------------- REALISTIC MOBILE PHONE SIMULATOR MODAL ----------------- */}
      {showPhoneSimulator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 print:hidden">
          <div onClick={() => setShowPhoneSimulator(false)} className="fixed inset-0 bg-black/85 backdrop-blur-md" />
          
          <div className="relative z-10 flex flex-col items-center max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            
            {/* Top Close Bar */}
            <div className="w-full flex items-center justify-between pb-3 text-white px-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Smartphone className="w-4 h-4 text-amber-500" />
                <span>{lang === 'tr' ? 'Ziyaretçi Telefon Ekranı' : 'Visitor Phone Display'}</span>
              </div>
              <button 
                onClick={() => setShowPhoneSimulator(false)}
                className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Realistic iPhone Bezel Container */}
            <div className="w-[320px] sm:w-[350px] bg-slate-950 rounded-[48px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-white/10 relative">
              
              {/* iPhone Screen Area */}
              <div className="bg-slate-50 rounded-[38px] overflow-hidden text-slate-900 relative shadow-inner">
                
                {/* Status Bar & Dynamic Island */}
                <div className="pt-2 px-5 flex items-center justify-between text-slate-800 text-[10px] font-semibold select-none">
                  <span>9:41</span>
                  {/* Dynamic Island */}
                  <div className="w-20 h-4 bg-black rounded-full mx-auto -mt-0.5" />
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3" />
                    <Battery className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Simulated Screen Content (Fully Functional) */}
                <div className="py-2 px-1">
                  <VisitorExperience isInsideSimulator={true} />
                </div>

                {/* Home Indicator Bar */}
                <div className="pb-2 pt-1 flex justify-center">
                  <div className="w-24 h-1 bg-slate-400 rounded-full" />
                </div>

              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              {lang === 'tr' ? 'Simülatördeki butonlara tıklayarak WhatsApp mesajını veya aramayı canlı test edebilirsiniz.' : 'You can click buttons in the simulator to test real WhatsApp notifications.'}
            </p>

          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Heart, AlertTriangle, Phone, ShieldCheck, Pill, 
  Activity, CheckCircle2, User, Copy, Check, Info, FileText, 
  ArrowRight, Edit3, X, Plus, Trash2, Save, QrCode, Wifi, Smartphone, Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { MedicalInfo, BloodType, EmergencyContact } from '../types/card';
import { generateNdefTextPayload } from '../lib/nfc';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface MedicalSOSViewProps {
  medical: MedicalInfo;
  cardId: string;
  lang?: Language;
  theme?: ThemeMode;
  isPublicScan?: boolean;
  onOpenAuth?: () => void;
  onUpdateMedical?: (updated: MedicalInfo) => void;
  isOwner?: boolean;
  subTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
}

const BLOOD_TYPES: BloodType[] = [
  '0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'
];

export type SubTab = 'details' | 'qr' | 'nfc';

export const MedicalSOSView: React.FC<MedicalSOSViewProps> = ({ 
  medical, 
  cardId, 
  lang = 'tr', 
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth,
  onUpdateMedical,
  isOwner = false,
  subTab = 'details',
  onSubTabChange
}) => {
  const [internalSubTab, setInternalSubTab] = useState<SubTab>(subTab);

  useEffect(() => {
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
  const [copied, setCopied] = useState(false);
  const [copiedNfc, setCopiedNfc] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<MedicalInfo>(medical);
  const [newDisease, setNewDisease] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const t = translations[lang].sos;
  const isDark = theme === 'dark';

  const nfcPayload = generateNdefTextPayload(medical);
  const nfcByteCount = new Blob([nfcPayload]).size;
  const sosUrl = `${window.location.origin}?view=sos&id=${cardId}`;

  const handleCopySummary = () => {
    navigator.clipboard.writeText(nfcPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyNfc = () => {
    navigator.clipboard.writeText(nfcPayload);
    setCopiedNfc(true);
    setTimeout(() => setCopiedNfc(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sosUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateMedical) {
      onUpdateMedical(editForm);
    }
    setIsEditing(false);
  };

  const age = new Date().getFullYear() - medical.birthYear;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 selection:bg-[#509BEC] selection:text-white transition-colors`}>
      {/* Top Banner - Serene & Trustworthy Deep Teal */}
      <div className="bg-gradient-to-r from-[#14798D] via-[#0E6476] to-[#14798D] text-white px-4 py-3 shadow-lg shadow-[#14798D]/20 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-[#D1C8B9]" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[#D1C8B9]">{t.title}</div>
              <div className="text-xs font-black tracking-wide text-white">{t.subtitle}</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-[#D1C8B9] block font-semibold">{cardId}</span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              {t.openActive}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Responsive Sub-Tabs Navigation */}
        <div className={`flex p-1.5 rounded-2xl border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} gap-1 text-xs font-bold`}>
          <button
            onClick={() => handleSelectSubTab('details')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'details'
                ? 'bg-[#14798D] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{lang === 'tr' ? 'sağlık kartı bilgisi /düzenle' : 'Health Card Info / Edit'}</span>
          </button>

          <button
            onClick={() => handleSelectSubTab('qr')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'qr'
                ? 'bg-[#14798D] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{lang === 'tr' ? 'sağlık kartı QR' : 'Health Card QR'}</span>
          </button>

          <button
            onClick={() => handleSelectSubTab('nfc')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'nfc'
                ? 'bg-[#14798D] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-4 h-4 rotate-90" />
            <span>{lang === 'tr' ? 'sağlık kartı NFC' : 'Health Card NFC'}</span>
          </button>
        </div>

        {/* ----------------- SUB-TAB 1: DETAILS & EDIT ----------------- */}
        {activeSubTab === 'details' && (
          <div className="space-y-4">
            {/* Owner Quick Edit Action Bar */}
            {isOwner && onUpdateMedical && (
              <div className="flex items-center justify-between bg-[#14798D]/15 border border-[#14798D]/30 p-3 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-[#14798D] dark:text-[#509BEC]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{lang === 'tr' ? 'Sağlık Kartı Sahibi Modu' : 'Health Card Owner Mode'}</span>
                </div>
                <button
                  onClick={() => { setEditForm(medical); setIsEditing(true); }}
                  className="bg-[#14798D] hover:bg-[#0E6476] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{lang === 'tr' ? 'Bilgileri Düzenle' : 'Edit Info'}</span>
                </button>
              </div>
            )}

            {/* Critical Rescue Hero: Blood Type & Patient Info */}
            <section className={`${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-5 relative overflow-hidden transition-colors`}>
              <div className="absolute top-0 right-0 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
              
              <div className="flex items-center justify-between relative z-10 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#14798D] dark:text-[#509BEC]">
                    <User className="w-3.5 h-3.5" />
                    <span>{lang === 'tr' ? 'Medikal Profil' : 'Medical Profile'}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">{medical.fullName}</h1>
                  <p className="text-xs text-slate-400 font-medium">
                    {medical.birthYear} ({age} {t.yearsOld})
                  </p>
                </div>

                {/* Blood Group Badge */}
                <div className="shrink-0 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-rose-600 text-white flex flex-col items-center justify-center shadow-lg shadow-rose-600/30 border-2 border-white/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-200">{t.bloodType}</span>
                    <span className="text-xl sm:text-2xl font-black tracking-tighter leading-none">{medical.bloodType}</span>
                  </div>
                </div>
              </div>

              {/* Badges: Organ Donor & Implant */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/60">
                {medical.organDonor && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.organDonor}
                  </span>
                )}
                {medical.hasImplant && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Activity className="w-3.5 h-3.5" />
                    {medical.implantDetails || (lang === 'tr' ? 'Protez / Medikal Cihaz Var' : 'Medical Implant')}
                  </span>
                )}
              </div>
            </section>

            {/* Direct Call ICE Contacts */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t.iceTitle}</span>
                </h2>
                <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  {t.tapToCall}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {medical.emergencyContacts.map((contact, idx) => (
                  <a
                    key={contact.id || idx}
                    href={`tel:${contact.phone}`}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all active:scale-98 ${
                      isDark 
                        ? 'bg-slate-900/90 border-slate-800 hover:border-rose-500/50 hover:bg-slate-850' 
                        : 'bg-white border-slate-200 hover:border-rose-400 shadow-sm'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold">{contact.name}</div>
                      <div className="text-[11px] text-slate-400">{contact.relation}</div>
                      <div className="text-xs font-mono font-bold text-rose-400">{contact.phone}</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/30 shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Critical Allergies & Chronic Diseases */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Allergies */}
              <section className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-4 space-y-2.5`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t.allergies}</span>
                </div>
                {medical.allergies && medical.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {medical.allergies.map((allergy, idx) => (
                      <span key={idx} className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-xl text-xs font-bold">
                        ⚠️ {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">{t.noAllergies}</p>
                )}
              </section>

              {/* Chronic Conditions */}
              <section className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-4 space-y-2.5`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#14798D] dark:text-[#509BEC] uppercase tracking-wider">
                  <Activity className="w-4 h-4" />
                  <span>{t.chronic}</span>
                </div>
                {medical.chronicDiseases && medical.chronicDiseases.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {medical.chronicDiseases.map((disease, idx) => (
                      <span key={idx} className="bg-[#14798D]/15 text-[#14798D] dark:text-[#509BEC] border border-[#14798D]/30 px-2.5 py-1 rounded-xl text-xs font-bold">
                        🩺 {disease}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">{lang === 'tr' ? 'Kronik rahatsızlık kaydı yok' : 'No chronic diseases'}</p>
                )}
              </section>
            </div>

            {/* Daily Medications */}
            {medical.medications && medical.medications.length > 0 && (
              <section className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-4 space-y-2.5`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#509BEC] uppercase tracking-wider">
                  <Pill className="w-4 h-4" />
                  <span>{t.medications}</span>
                </div>
                <div className="space-y-1.5">
                  {medical.medications.map((med, idx) => (
                    <div key={idx} className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="font-bold">{med.name}</div>
                      <div className="text-slate-400 font-mono">{med.dosage}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Doctor & Rescue Note */}
            {medical.doctorNote && (
              <section className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-4 space-y-2`}>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t.doctorNotes}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-300 italic bg-[#14798D]/10 border border-[#14798D]/20 p-3 rounded-2xl">
                  "{medical.doctorNote}"
                </p>
              </section>
            )}

            {/* Fast Copy Full Summary Button */}
            <button
              onClick={handleCopySummary}
              className={`w-full py-3.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                copied 
                  ? 'bg-emerald-600 text-white border-emerald-500' 
                  : isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t.copiedSummary : t.copySummary}</span>
            </button>
          </div>
        )}

        {/* ----------------- SUB-TAB 2: HEALTH CARD QR ----------------- */}
        {activeSubTab === 'qr' && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-6 space-y-6 text-center transition-colors`}>
            <div>
              <h2 className="text-base font-bold flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-rose-500" />
                <span>{lang === 'tr' ? 'Sağlık Kartı QR Kodu' : 'Health Card QR Code'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'tr' ? 'Fiziksel kartınızın ön yüzü veya acil durum bilekliği için doğrudan taranabilir QR kod' : 'Direct emergency QR code for physical card front or medical ID bracelet'}
              </p>
            </div>

            {/* The QR Container */}
            <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl mx-auto border-4 border-rose-500/30">
              <QRCodeSVG id="health-sos-qr" value={sosUrl} size={180} level="H" includeMargin />
            </div>

            {/* Quick Summary under QR */}
            <div className="space-y-1">
              <div className="text-sm font-bold">{medical.fullName}</div>
              <div className="text-xs font-mono font-bold text-rose-500">
                {t.bloodType}: {medical.bloodType} • ID: {cardId}
              </div>
              <div className="text-[11px] text-slate-400 font-mono break-all pt-1 max-w-sm mx-auto">
                {sosUrl}
              </div>
            </div>

            {/* Actions: Copy Link & Print */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={handleCopyLink}
                className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  copiedLink 
                    ? 'bg-emerald-600 text-white border-emerald-500' 
                    : isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                }`}
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? (lang === 'tr' ? 'Bağlantı Kopyalandı!' : 'Link Copied!') : (lang === 'tr' ? 'Doğrudan SOS Linkini Kopyala' : 'Copy Direct SOS Link')}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#14798D] hover:bg-[#0E6476] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'tr' ? 'Karekod Kartını Yazdır / PDF' : 'Print QR Card / PDF'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- SUB-TAB 3: HEALTH CARD NFC ----------------- */}
        {activeSubTab === 'nfc' && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-6 space-y-5 transition-colors`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <Wifi className="w-5 h-5 rotate-90" />
                </div>
                <div>
                  <h2 className="text-base font-bold">{lang === 'tr' ? 'Sağlık Kartı NFC Yükü' : 'Health Card NFC Payload'}</h2>
                  <p className="text-xs text-slate-400">{lang === 'tr' ? 'İnternetsiz ortamda NTAG216 çipinden okunacak hayat kurtarma verisi' : 'Offline rescue payload encoded onto NTAG216 chip'}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-400 block">{nfcByteCount} / 888 Byte</span>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  NTAG216
                </span>
              </div>
            </div>

            {/* Raw Payload Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{lang === 'tr' ? 'NFC Çipine Yazılacak Ham Metin:' : 'Raw Text Payload to Write:'}</span>
                <button
                  onClick={handleCopyNfc}
                  className="text-xs font-semibold text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1"
                >
                  {copiedNfc ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNfc ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Metni Kopyala' : 'Copy Text')}</span>
                </button>
              </div>

              <pre className={`${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'} border p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed`}>
                {nfcPayload}
              </pre>
            </div>

            {/* 3 Step NFC Write Guide */}
            <div className={`${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-4 space-y-3`}>
              <h3 className="text-xs font-bold flex items-center gap-2 text-rose-400">
                <Smartphone className="w-4 h-4" />
                <span>{lang === 'tr' ? 'Telefondan Akıllı Karta Nasıl Yazılır? (3 Adım)' : 'How to Write to Card via Phone (3 Steps)'}</span>
              </h3>

              <ol className="text-xs text-slate-400 space-y-2 pl-4 list-decimal">
                <li>
                  {lang === 'tr' ? 'App Store veya Google Play\'den ücretsiz "NFC Tools" uygulamasını indirin.' : 'Download free "NFC Tools" from App Store or Google Play.'}
                </li>
                <li>
                  {lang === 'tr' ? 'Uygulamada "Yaz (Write)" → "Kayıt Ekle (Add a record)" → "Metin (Text)" seçin.' : 'Select "Write" → "Add a record" → "Text" in the app.'}
                </li>
                <li>
                  {lang === 'tr' ? 'Yukarıdaki kopyaladığınız metni yapıştırıp fiziksel kartınızı telefonun arkasına dokundurun!' : 'Paste the copied text and tap your NFC card to the back of your phone!'}
                </li>
              </ol>
            </div>
          </div>
        )}

      </div>

      {/* In-Page Owner Edit Modal */}
      {isOwner && isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsEditing(false)} 
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          />

          <div className={`relative w-full max-w-lg ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto space-y-5`}>
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#14798D]" />
                <h3 className="font-bold text-base">{lang === 'tr' ? 'Sağlık Kartı Bilgilerini Düzenle' : 'Edit Health Card Info'}</h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className={`p-1.5 rounded-xl border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Full Name & Birth Year */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Ad Soyad' : 'Full Name'}</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    required
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Doğum Yılı' : 'Birth Year'}</label>
                  <input
                    type="number"
                    value={editForm.birthYear}
                    onChange={(e) => setEditForm({ ...editForm, birthYear: parseInt(e.target.value) || 1990 })}
                    required
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                </div>
              </div>

              {/* Blood Type */}
              <div className="space-y-1">
                <label className="font-bold text-rose-400 uppercase tracking-wider">{t.bloodType}</label>
                <select
                  value={editForm.bloodType}
                  onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value as BloodType })}
                  className={`w-full p-2.5 rounded-xl border font-bold ${isDark ? 'bg-slate-950 border-slate-800 text-rose-400' : 'bg-slate-50 border-slate-300 text-rose-600'} outline-none`}
                >
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              {/* Allergies Management */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-amber-400 uppercase tracking-wider">{t.allergies}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAllergy}
                    onChange={(e) => setNewAllergy(e.target.value)}
                    placeholder={lang === 'tr' ? 'Örn: Penisilin, Fıstık' : 'e.g. Penicillin, Peanuts'}
                    className={`flex-1 p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAllergy.trim()) {
                        setEditForm({ ...editForm, allergies: [...editForm.allergies, newAllergy.trim()] });
                        setNewAllergy('');
                      }
                    }}
                    className="bg-[#14798D] text-white px-3 rounded-xl font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {editForm.allergies.map((all, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1.5 font-medium">
                      {all}
                      <Trash2 
                        className="w-3 h-3 text-rose-400 cursor-pointer hover:scale-110" 
                        onClick={() => setEditForm({ ...editForm, allergies: editForm.allergies.filter((_, i) => i !== idx) })}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {/* Chronic Diseases */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-[#509BEC] uppercase tracking-wider">{t.chronic}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDisease}
                    onChange={(e) => setNewDisease(e.target.value)}
                    placeholder={lang === 'tr' ? 'Örn: Tip 1 Diyabet' : 'e.g. Type 1 Diabetes'}
                    className={`flex-1 p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDisease.trim()) {
                        setEditForm({ ...editForm, chronicDiseases: [...editForm.chronicDiseases, newDisease.trim()] });
                        setNewDisease('');
                      }
                    }}
                    className="bg-[#14798D] text-white px-3 rounded-xl font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {editForm.chronicDiseases.map((dis, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0.5 rounded-lg flex items-center gap-1.5 font-medium">
                      {dis}
                      <Trash2 
                        className="w-3 h-3 text-rose-400 cursor-pointer hover:scale-110" 
                        onClick={() => setEditForm({ ...editForm, chronicDiseases: editForm.chronicDiseases.filter((_, i) => i !== idx) })}
                      />
                    </span>
                  ))}
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-rose-400 uppercase tracking-wider">{t.iceTitle}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder={lang === 'tr' ? 'İsim Soyisim' : 'Name'}
                    className={`p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <input
                    type="text"
                    value={newContactRelation}
                    onChange={(e) => setNewContactRelation(e.target.value)}
                    placeholder={lang === 'tr' ? 'Yakınlık (Eş, Anne vb.)' : 'Relation'}
                    className={`p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="+90 5XX..."
                      className={`flex-1 p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newContactName.trim() && newContactPhone.trim()) {
                          const contact: EmergencyContact = {
                            id: Date.now().toString(),
                            name: newContactName.trim(),
                            relation: newContactRelation.trim() || 'Yakını',
                            phone: newContactPhone.trim()
                          };
                          setEditForm({ ...editForm, emergencyContacts: [...editForm.emergencyContacts, contact] });
                          setNewContactName('');
                          setNewContactRelation('');
                          setNewContactPhone('');
                        }
                      }}
                      className="bg-rose-600 text-white px-3 rounded-xl font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {editForm.emergencyContacts.map((cnt, idx) => (
                    <div key={cnt.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                      <div>
                        <strong>{cnt.name}</strong> ({cnt.relation}): <span className="font-mono">{cnt.phone}</span>
                      </div>
                      <Trash2 
                        className="w-3.5 h-3.5 text-rose-400 cursor-pointer hover:scale-110" 
                        onClick={() => setEditForm({ ...editForm, emergencyContacts: editForm.emergencyContacts.filter((_, i) => i !== idx) })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor Note */}
              <div className="space-y-1 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-slate-400 uppercase tracking-wider">{t.doctorNotes}</label>
                <textarea
                  value={editForm.doctorNote || ''}
                  onChange={(e) => setEditForm({ ...editForm, doctorNote: e.target.value })}
                  rows={2}
                  className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.organDonor}
                    onChange={(e) => setEditForm({ ...editForm, organDonor: e.target.checked })}
                    className="rounded accent-[#14798D]"
                  />
                  <span>{t.organDonor}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.hasImplant}
                    onChange={(e) => setEditForm({ ...editForm, hasImplant: e.target.checked })}
                    className="rounded accent-[#14798D]"
                  />
                  <span>{lang === 'tr' ? 'Protez / Medikal Cihaz Var' : 'Has Implant / Device'}</span>
                </label>
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
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#14798D] to-[#509BEC] text-white font-bold flex items-center justify-center gap-2 shadow-lg"
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

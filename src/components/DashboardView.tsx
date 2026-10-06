import React, { useState } from 'react';
import { 
  Save, RotateCcw, Plus, Trash2, Heart, CreditCard, 
  User as UserIcon, ShieldAlert, Phone, Building2, CheckCircle2, 
  AlertTriangle, Pill, Camera, KeyRound, LogOut, ShieldCheck, FileText 
} from 'lucide-react';
import { SmartCard, BloodType } from '../types/card';
import { resetCardData } from '../lib/storage';
import { saveCardToFirestore } from '../lib/firestoreService';
import { OcrMedicineScanner } from './OcrMedicineScanner';
import { User } from 'firebase/auth';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface DashboardProps { 
  card: SmartCard; 
  onUpdate: (u: SmartCard) => void; 
  lang?: Language;
  theme?: ThemeMode;
  user?: User | null;
  onLogout?: () => void;
}

const BLOOD_TYPES: BloodType[] = ['0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'];

export const DashboardView: React.FC<DashboardProps> = ({ 
  card, 
  onUpdate, 
  lang = 'tr', 
  theme = 'dark',
  user,
  onLogout 
}) => {
  const [data, setData] = useState<SmartCard>(card);
  const [tab, setTab] = useState<'med' | 'per' | 'kvkk'>('med');
  const [saved, setSaved] = useState(false);
  const [allergy, setAllergy] = useState('');
  const [disease, setDisease] = useState('');
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [showOcrScanner, setShowOcrScanner] = useState(false);

  const t = translations[lang].dashboard;
  const isDark = theme === 'dark';

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    saveCardToFirestore(data);
    onUpdate(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddOcrMedicine = (name: string, dosage: string) => {
    setData(prev => ({
      ...prev,
      medical: {
        ...prev.medical,
        medications: [...prev.medical.medications, { name, dosage }]
      }
    }));
    setShowOcrScanner(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl shadow-xl transition-colors`}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.title}</h1>
            <span className="text-xs font-mono bg-[#14798D]/10 text-[#14798D] dark:text-[#509BEC] px-2 py-0.5 rounded border border-[#14798D]/30">{data.cardId}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.desc}</p>
            {user && (
              <span className="text-[11px] font-semibold text-[#509BEC] bg-[#509BEC]/10 px-2 py-0.5 rounded-full border border-[#509BEC]/20">
                👤 {user.email || user.displayName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {user && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              title="Çıkış Yap"
            >
              <LogOut className="w-3.5 h-3.5" /> Çıkış
            </button>
          )}
          <button 
            type="button" 
            onClick={() => { if(confirm(t.resetConfirm)) { const d = resetCardData(); setData(d); onUpdate(d); } }} 
            className={`${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'} text-xs font-semibold py-2.5 px-3.5 rounded-xl border flex items-center gap-1.5 transition-all`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t.resetBtn}
          </button>
          <button 
            onClick={save} 
            className="bg-[#14798D] hover:bg-[#0E6476] text-white text-xs font-bold py-2.5 px-5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#14798D]/20 active:scale-98 transition-all"
          >
            <Save className="w-4 h-4" /> {t.saveBtn}
          </button>
        </div>
      </div>

      {saved && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t.savedMsg}
        </div>
      )}

      {/* OCR Modal */}
      {showOcrScanner && (
        <OcrMedicineScanner 
          onAddMedicine={handleAddOcrMedicine} 
          onClose={() => setShowOcrScanner(false)} 
        />
      )}

      <div className={`flex border-b overflow-x-auto ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <button 
          onClick={() => setTab('med')} 
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            tab === 'med' 
              ? 'border-[#14798D] text-[#14798D] dark:text-[#509BEC] bg-[#14798D]/10' 
              : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#509BEC]" /> {t.medTab}
        </button>
        <button 
          onClick={() => setTab('per')} 
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            tab === 'per' 
              ? 'border-[#509BEC] text-[#509BEC] bg-[#509BEC]/10' 
              : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[#D1C8B9]" /> {t.perTab}
        </button>
        <button 
          onClick={() => setTab('kvkk')} 
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 transition-all whitespace-nowrap ${
            tab === 'kvkk' 
              ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' 
              : isDark ? 'border-transparent text-slate-400 hover:text-white' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> {t.kvkkTab}
        </button>
      </div>

      <form onSubmit={save} className="space-y-6">
        {tab === 'med' ? (
          <div className="space-y-6">
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <h2 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                <UserIcon className="w-4 h-4 text-[#14798D]" /> {t.fullName} &amp; {t.bloodType}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.fullName}</label>
                  <input type="text" value={data.medical.fullName} onChange={e => setData({...data, medical: {...data.medical, fullName: e.target.value}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} required />
                </div>
                <div>
                  <label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.birthYear}</label>
                  <input type="number" value={data.medical.birthYear} onChange={e => setData({...data, medical: {...data.medical, birthYear: parseInt(e.target.value)||1990}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} />
                </div>
                <div>
                  <label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.bloodType}</label>
                  <select value={data.medical.bloodType} onChange={e => setData({...data, medical: {...data.medical, bloodType: e.target.value as BloodType}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-[#509BEC]' : 'bg-slate-50 border-slate-200 text-[#14798D]'} border rounded-xl px-3 py-2 text-xs font-bold`}>
                    {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'} cursor-pointer`}>
                  <input type="checkbox" checked={data.medical.organDonor} onChange={e => setData({...data, medical: {...data.medical, organDonor: e.target.checked}})} className="rounded bg-slate-950 border-slate-800 text-[#14798D]" /> 
                  {t.organDonor}
                </label>
              </div>
            </div>

            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                  <Phone className="w-4 h-4 text-[#509BEC]" /> {t.iceContacts}
                </h2>
                <button type="button" onClick={() => setData({...data, medical: {...data.medical, emergencyContacts: [...data.medical.emergencyContacts, { id: Date.now().toString(), name: '', relation: '', phone: '' }]}})} className="text-xs text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1 font-semibold">
                  <Plus className="w-3.5 h-3.5" /> {t.addContact}
                </button>
              </div>
              <div className="space-y-2">
                {data.medical.emergencyContacts.map((c, idx) => (
                  <div key={c.id} className={`grid grid-cols-1 sm:grid-cols-7 gap-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border p-2.5 rounded-xl items-center`}>
                    <input type="text" placeholder={t.contactNamePlaceholder} value={c.name} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].name = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className={`sm:col-span-3 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-lg px-2.5 py-1.5 text-xs`} />
                    <input type="text" placeholder={t.contactRelationPlaceholder} value={c.relation} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].relation = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className={`sm:col-span-2 ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-lg px-2.5 py-1.5 text-xs`} />
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input type="text" placeholder={t.contactPhonePlaceholder} value={c.phone} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].phone = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className={`w-full ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-lg px-2.5 py-1.5 text-xs font-mono`} />
                      <button type="button" onClick={() => setData({...data, medical: {...data.medical, emergencyContacts: data.medical.emergencyContacts.filter((_, i) => i !== idx)}})} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-5 rounded-3xl space-y-3`}>
                <h2 className="text-xs font-bold text-amber-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {t.allergies}</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder={t.addAllergy} value={allergy} onChange={e => setAllergy(e.target.value)} className={`flex-1 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-1.5 text-xs`} />
                  <button type="button" onClick={() => { if(allergy.trim()){ setData({...data, medical: {...data.medical, allergies: [...data.medical.allergies, allergy.trim()]}}); setAllergy(''); }}} className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">{t.addContact}</button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.medical.allergies.map((a, i) => (
                    <span key={i} className={`bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-300' : 'text-amber-700'} text-xs px-2 py-0.5 rounded-md flex items-center gap-1`}>
                      {a} <button type="button" onClick={() => setData({...data, medical: {...data.medical, allergies: data.medical.allergies.filter((_, idx) => idx !== i)}})}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-5 rounded-3xl space-y-3`}>
                <h2 className={`text-xs font-bold ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} flex items-center gap-2`}><Heart className="w-4 h-4 text-[#14798D]" /> {t.chronic}</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder={t.addChronic} value={disease} onChange={e => setDisease(e.target.value)} className={`flex-1 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-1.5 text-xs`} />
                  <button type="button" onClick={() => { if(disease.trim()){ setData({...data, medical: {...data.medical, chronicDiseases: [...data.medical.chronicDiseases, disease.trim()]}}); setDisease(''); }}} className="bg-[#14798D] hover:bg-[#0E6476] text-white text-xs px-3 py-1.5 rounded-xl font-semibold">{t.addContact}</button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.medical.chronicDiseases.map((d, i) => (
                    <span key={i} className={`bg-[#14798D]/10 border border-[#14798D]/30 ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} text-xs px-2 py-0.5 rounded-md flex items-center gap-1`}>
                      {d} <button type="button" onClick={() => setData({...data, medical: {...data.medical, chronicDiseases: data.medical.chronicDiseases.filter((_, idx) => idx !== i)}})}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Medications with OCR Scanner Trigger */}
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#509BEC] flex items-center gap-2"><Pill className="w-4 h-4 text-[#509BEC]" /> {t.medications}</h2>
                <button
                  type="button"
                  onClick={() => setShowOcrScanner(true)}
                  className="bg-[#14798D]/20 hover:bg-[#14798D] text-[#14798D] dark:text-[#509BEC] hover:text-white border border-[#14798D]/30 text-xs font-semibold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t.ocrBtn}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder={t.medNamePlaceholder} value={medName} onChange={e => setMedName(e.target.value)} className={`flex-1 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} />
                <input type="text" placeholder={t.medDosePlaceholder} value={medDose} onChange={e => setMedDose(e.target.value)} className={`flex-1 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} />
                <button type="button" onClick={() => { if(medName.trim()){ setData({...data, medical: {...data.medical, medications: [...data.medical.medications, { name: medName.trim(), dosage: medDose.trim() || 'Belirtilmedi' }]}}); setMedName(''); setMedDose(''); }}} className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs px-4 py-2 rounded-xl font-semibold">{t.addMedBtn}</button>
              </div>
              <div className="space-y-1.5 pt-1">
                {data.medical.medications.map((m, i) => (
                  <div key={i} className={`flex items-center justify-between ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border p-2 rounded-lg text-xs`}>
                    <span className={`${isDark ? 'text-white' : 'text-slate-900'} font-medium`}>{m.name} <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>({m.dosage})</span></span>
                    <button type="button" onClick={() => setData({...data, medical: {...data.medical, medications: data.medical.medications.filter((_, idx) => idx !== i)}})} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Doctor note */}
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-2`}>
              <h2 className={`text-sm font-bold ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'}`}>{t.doctorNotes}</h2>
              <textarea 
                rows={3} 
                value={data.medical.doctorNote || ''} 
                onChange={e => setData({...data, medical: {...data.medical, doctorNote: e.target.value}})} 
                className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl p-3 text-xs`} 
              />
            </div>
          </div>
        ) : tab === 'per' ? (
          <div className="space-y-6">
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <h2 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                <UserIcon className="w-4 h-4 text-[#509BEC]" /> {t.fullName} &amp; {t.phone}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.fullName}</label><input type="text" value={data.personal.fullName} onChange={e => setData({...data, personal: {...data.personal, fullName: e.target.value}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} /></div>
                <div><label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.titleLabel}</label><input type="text" value={data.personal.title||''} onChange={e => setData({...data, personal: {...data.personal, title: e.target.value}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} /></div>
                <div><label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.phone}</label><input type="text" value={data.personal.phone} onChange={e => setData({...data, personal: {...data.personal, phone: e.target.value}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs font-mono`} /></div>
                <div><label className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{t.email}</label><input type="email" value={data.personal.email} onChange={e => setData({...data, personal: {...data.personal, email: e.target.value}})} className={`w-full ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs`} /></div>
              </div>
            </div>

            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                  <Building2 className="w-4 h-4 text-[#509BEC]" /> {t.bankAccounts}
                </h2>
                <button type="button" onClick={() => setData({...data, personal: {...data.personal, bankAccounts: [...data.personal.bankAccounts, { id: Date.now().toString(), bankName: '', accountHolder: data.personal.fullName, iban: 'TR', currency: 'TRY' }]}})} className="text-xs text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1 font-semibold">
                  <Plus className="w-3.5 h-3.5" /> {t.addBankBtn}
                </button>
              </div>
              <div className="space-y-3">
                {data.personal.bankAccounts.map((acc, idx) => (
                  <div key={acc.id} className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border p-3.5 rounded-2xl space-y-2`}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" placeholder={t.bankNamePlaceholder} value={acc.bankName} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].bankName = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className={`bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white`} />
                      <input type="text" placeholder={t.accountHolderPlaceholder} value={acc.accountHolder} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].accountHolder = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className={`bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white`} />
                      <div className="flex items-center gap-2">
                        <select value={acc.currency} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].currency = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className={`w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white`}>
                          <option value="TRY">TRY</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </select>
                        <button type="button" onClick={() => setData({...data, personal: {...data.personal, bankAccounts: data.personal.bankAccounts.filter((_, i) => i !== idx)}})} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <input type="text" placeholder={t.ibanPlaceholder} value={acc.iban} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].iban = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className={`w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-semibold`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* KVKK & Privacy Section */
          <div className="space-y-6">
            <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border p-6 rounded-3xl space-y-4`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {lang === 'tr' ? 'KVKK ve Veri Güvenliği Aydınlatma Metni' : 'GDPR & Data Protection Statement'}
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {lang === 'tr' ? '6698 Sayılı Kişisel Verilerin Korunması Kanunu ve GDPR Kapsamında Bilgilendirme' : 'Information in accordance with Personal Data Protection & GDPR'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className={`${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'} p-4 rounded-2xl border space-y-2`}>
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    {lang === 'tr' ? 'Özel Nitelikli Sağlık Verileri (Ön Yüz)' : 'Special Category Medical Data (Front)'}
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {lang === 'tr' 
                      ? 'Kan grubu, kritik alerjiler ve acil durum kişileri gibi hayati bilgiler; yalnızca kaza, bayılma ve acil tıbbi müdahale anında ilk yardım ekipleri veya üçüncü şahıslar tarafından hızla görülebilmesi (ICE) amacıyla açık profilde tutulur.' 
                      : 'Vital information such as blood type, critical allergies, and emergency contacts are kept publicly accessible strictly for immediate first-responder / ICE intervention during emergencies.'}
                  </p>
                </div>

                <div className={`${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'} p-4 rounded-2xl border space-y-2`}>
                  <div className="flex items-center gap-2 text-[#509BEC] font-semibold text-xs">
                    <CreditCard className="w-4 h-4" />
                    {lang === 'tr' ? 'Kişisel & Finansal Veriler (Arka Yüz)' : 'Personal & Financial Data (Back)'}
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {lang === 'tr' 
                      ? 'Kartvizit, telefon ve IBAN gibi bilgileriniz 60 saniyelik zaman aşımı korumalı oturumla sunulur. IBAN kopyalandığında güvenlik amacıyla cihaz panosu 30 saniye sonra otomatik temizlenir.' 
                      : 'Business contacts, phone, and IBAN numbers are protected by a 60-second timed session. Copied IBANs trigger a 30-second automated clipboard wipe for security.'}
                  </p>
                </div>

                <div className={`${isDark ? 'bg-slate-950/60 border-slate-800/80' : 'bg-slate-50 border-slate-200'} p-4 rounded-2xl border space-y-2 md:col-span-2`}>
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                    <KeyRound className="w-4 h-4" />
                    {lang === 'tr' ? 'Sıfır Bilgi Kriptografi (Zero-Knowledge Client Vault)' : 'Zero-Knowledge Client-Side Encryption'}
                  </div>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {lang === 'tr' 
                      ? 'Kasa sekmesindeki şifreleme işlemi tamamen tarayıcınızda PBKDF2 (100.000 iterasyon) ve AES-GCM 256-bit standartlarında gerçekleştirilir. Şifreleme anahtarınız veya PIN kodunuz sunucuya ASLA iletilmez ve saklanmaz.' 
                      : 'Vault encryption runs entirely in your browser using PBKDF2 (100,000 iterations) and AES-GCM 256-bit. Your encryption key or PIN is NEVER sent to or stored on any server.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};


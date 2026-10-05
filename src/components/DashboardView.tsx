import React, { useState } from 'react';
import { 
  Save, RotateCcw, Plus, Trash2, Heart, CreditCard, 
  User, ShieldAlert, Phone, Building2, CheckCircle2, 
  AlertTriangle, Pill, Camera, KeyRound 
} from 'lucide-react';
import { SmartCard, BloodType } from '../types/card';
import { resetCardData } from '../lib/storage';
import { saveCardToFirestore } from '../lib/firestoreService';
import { OcrMedicineScanner } from './OcrMedicineScanner';

interface DashboardProps { 
  card: SmartCard; 
  onUpdate: (u: SmartCard) => void; 
}

const BLOOD_TYPES: BloodType[] = ['0 Rh+', '0 Rh-', 'A Rh+', 'A Rh-', 'B Rh+', 'B Rh-', 'AB Rh+', 'AB Rh-'];

export const DashboardView: React.FC<DashboardProps> = ({ card, onUpdate }) => {
  const [data, setData] = useState<SmartCard>(card);
  const [tab, setTab] = useState<'med' | 'per'>('med');
  const [saved, setSaved] = useState(false);
  const [allergy, setAllergy] = useState('');
  const [disease, setDisease] = useState('');
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [showOcrScanner, setShowOcrScanner] = useState(false);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Akıllı Kart Yönetim Paneli</h1>
            <span className="text-xs font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">{data.cardId}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Ön (Sağlık) ve arka (Kişisel) yüz bilgilerini buradan güncelleyin.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => { if(confirm('Sıfırlansın mı?')) { const d = resetCardData(); setData(d); onUpdate(d); } }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 px-3.5 rounded-xl border border-slate-700 flex items-center gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Sıfırla</button>
          <button onClick={save} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-900/20 active:scale-98"><Save className="w-4 h-4" /> Değişiklikleri Kaydet</button>
        </div>
      </div>

      {saved && <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-3 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-lg"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Bilgiler kaydedildi!</div>}

      {/* OCR Modal */}
      {showOcrScanner && (
        <OcrMedicineScanner 
          onAddMedicine={handleAddOcrMedicine} 
          onClose={() => setShowOcrScanner(false)} 
        />
      )}

      <div className="flex border-b border-slate-800">
        <button onClick={() => setTab('med')} className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 ${tab === 'med' ? 'border-red-500 text-red-400 bg-red-950/20' : 'border-transparent text-slate-400'}`}><ShieldAlert className="w-4 h-4" /> Ön Yüz: Medikal Bilgiler</button>
        <button onClick={() => setTab('per')} className={`flex items-center gap-2 px-6 py-3 font-semibold text-xs border-b-2 ${tab === 'per' ? 'border-blue-500 text-blue-400 bg-blue-950/20' : 'border-transparent text-slate-400'}`}><CreditCard className="w-4 h-4" /> Arka Yüz: Kişisel &amp; IBAN</button>
      </div>

      <form onSubmit={save} className="space-y-6">
        {tab === 'med' ? (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><User className="w-4 h-4 text-red-500" /> Temel Sağlık &amp; Kan Grubu</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="block text-xs text-slate-400 mb-1">Ad Soyad</label><input type="text" value={data.medical.fullName} onChange={e => setData({...data, medical: {...data.medical, fullName: e.target.value}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" required /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Doğum Yılı</label><input type="number" value={data.medical.birthYear} onChange={e => setData({...data, medical: {...data.medical, birthYear: parseInt(e.target.value)||1990}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Kan Grubu</label><select value={data.medical.bloodType} onChange={e => setData({...data, medical: {...data.medical, bloodType: e.target.value as BloodType}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-red-400 font-bold">{BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={data.medical.organDonor} onChange={e => setData({...data, medical: {...data.medical, organDonor: e.target.checked}})} className="rounded bg-slate-950 border-slate-800 text-red-600" /> Organ Bağışçısıyım</label>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Phone className="w-4 h-4 text-red-500" /> Acil Durum Kişileri (ICE)</h2>
                <button type="button" onClick={() => setData({...data, medical: {...data.medical, emergencyContacts: [...data.medical.emergencyContacts, { id: Date.now().toString(), name: '', relation: '', phone: '' }]}})} className="text-xs text-red-400 flex items-center gap-1 font-semibold"><Plus className="w-3.5 h-3.5" /> Ekle</button>
              </div>
              <div className="space-y-2">
                {data.medical.emergencyContacts.map((c, idx) => (
                  <div key={c.id} className="grid grid-cols-1 sm:grid-cols-7 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 items-center">
                    <input type="text" placeholder="Ad Soyad" value={c.name} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].name = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className="sm:col-span-3 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                    <input type="text" placeholder="Yakınlık (Eş, Kardeş)" value={c.relation} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].relation = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className="sm:col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white" />
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input type="text" placeholder="+905..." value={c.phone} onChange={e => { const list = [...data.medical.emergencyContacts]; list[idx].phone = e.target.value; setData({...data, medical: {...data.medical, emergencyContacts: list}}); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono" />
                      <button type="button" onClick={() => setData({...data, medical: {...data.medical, emergencyContacts: data.medical.emergencyContacts.filter((_, i) => i !== idx)}})} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
                <h2 className="text-xs font-bold text-amber-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Alerjiler</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Alerji ekle" value={allergy} onChange={e => setAllergy(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white" />
                  <button type="button" onClick={() => { if(allergy.trim()){ setData({...data, medical: {...data.medical, allergies: [...data.medical.allergies, allergy.trim()]}}); setAllergy(''); }}} className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">Ekle</button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.medical.allergies.map((a, i) => (
                    <span key={i} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-2 py-0.5 rounded-md flex items-center gap-1">{a} <button type="button" onClick={() => setData({...data, medical: {...data.medical, allergies: data.medical.allergies.filter((_, idx) => idx !== i)}})}>×</button></span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
                <h2 className="text-xs font-bold text-rose-400 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-500" /> Kronik Hastalıklar</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Hastalık ekle" value={disease} onChange={e => setDisease(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white" />
                  <button type="button" onClick={() => { if(disease.trim()){ setData({...data, medical: {...data.medical, chronicDiseases: [...data.medical.chronicDiseases, disease.trim()]}}); setDisease(''); }}} className="bg-rose-600 text-white text-xs px-3 py-1.5 rounded-xl font-semibold">Ekle</button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {data.medical.chronicDiseases.map((d, i) => (
                    <span key={i} className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-2 py-0.5 rounded-md flex items-center gap-1">{d} <button type="button" onClick={() => setData({...data, medical: {...data.medical, chronicDiseases: data.medical.chronicDiseases.filter((_, idx) => idx !== i)}})}>×</button></span>
                  ))}
                </div>
              </div>
            </div>

            {/* Medications with OCR Scanner Trigger */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-blue-400 flex items-center gap-2"><Pill className="w-4 h-4 text-blue-400" /> Sürekli Kullanılan İlaçlar</h2>
                <button
                  type="button"
                  onClick={() => setShowOcrScanner(true)}
                  className="bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>📷 İlaç / Reçete Tara (OCR)</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input type="text" placeholder="İlaç Adı" value={medName} onChange={e => setMedName(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                <input type="text" placeholder="Dozaj" value={medDose} onChange={e => setMedDose(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" />
                <button type="button" onClick={() => { if(medName.trim()){ setData({...data, medical: {...data.medical, medications: [...data.medical.medications, { name: medName.trim(), dosage: medDose.trim() || 'Belirtilmedi' }]}}); setMedName(''); setMedDose(''); }}} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl font-semibold">İlaç Ekle</button>
              </div>
              <div className="space-y-1.5 pt-1">
                {data.medical.medications.map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 rounded-lg text-xs">
                    <span className="text-white font-medium">{m.name} <span className="text-slate-400 text-[11px]">({m.dosage})</span></span>
                    <button type="button" onClick={() => setData({...data, medical: {...data.medical, medications: data.medical.medications.filter((_, idx) => idx !== i)}})} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><User className="w-4 h-4 text-blue-500" /> Kişisel Profil &amp; İletişim</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs text-slate-400 mb-1">Ad Soyad</label><input type="text" value={data.personal.fullName} onChange={e => setData({...data, personal: {...data.personal, fullName: e.target.value}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Meslek / Unvan</label><input type="text" value={data.personal.title||''} onChange={e => setData({...data, personal: {...data.personal, title: e.target.value}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Telefon</label><input type="text" value={data.personal.phone} onChange={e => setData({...data, personal: {...data.personal, phone: e.target.value}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">E-posta</label><input type="email" value={data.personal.email} onChange={e => setData({...data, personal: {...data.personal, email: e.target.value}})} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white" /></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-500" /> Banka ve IBAN Hesapları</h2>
                <button type="button" onClick={() => setData({...data, personal: {...data.personal, bankAccounts: [...data.personal.bankAccounts, { id: Date.now().toString(), bankName: '', accountHolder: data.personal.fullName, iban: 'TR', currency: 'TRY' }]}})} className="text-xs text-blue-400 flex items-center gap-1 font-semibold"><Plus className="w-3.5 h-3.5" /> Hesap Ekle</button>
              </div>
              <div className="space-y-3">
                {data.personal.bankAccounts.map((acc, idx) => (
                  <div key={acc.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input type="text" placeholder="Banka Adı" value={acc.bankName} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].bankName = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white" />
                      <input type="text" placeholder="Hesap Sahibi" value={acc.accountHolder} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].accountHolder = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white" />
                      <div className="flex items-center gap-2">
                        <select value={acc.currency} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].currency = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"><option value="TRY">TRY</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
                        <button type="button" onClick={() => setData({...data, personal: {...data.personal, bankAccounts: data.personal.bankAccounts.filter((_, i) => i !== idx)}})} className="text-rose-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <input type="text" placeholder="TR..." value={acc.iban} onChange={e => { const list = [...data.personal.bankAccounts]; list[idx].iban = e.target.value; setData({...data, personal: {...data.personal, bankAccounts: list}}); }} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono font-semibold" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};


import React, { useState } from 'react';
import { 
  Heart, AlertTriangle, Phone, ShieldAlert, Pill, 
  Activity, CheckCircle2, User, Copy, Check, Info, FileText 
} from 'lucide-react';
import { MedicalInfo } from '../types/card';
import { generateNdefTextPayload } from '../lib/nfc';

interface MedicalSOSViewProps {
  medical: MedicalInfo;
  cardId: string;
}

export const MedicalSOSView: React.FC<MedicalSOSViewProps> = ({ medical, cardId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    const text = generateNdefTextPayload(medical);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-950 via-slate-950 to-slate-950 text-slate-100 pb-16">
      {/* Top Emergency Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-3 shadow-lg shadow-red-950/40 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white text-red-600 p-1.5 rounded-full animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wider uppercase text-red-100">Acil Durum Medikal Profili</div>
              <div className="text-sm font-black flex items-center gap-1.5">
                <span>HAYATİ SAĞLIK BİLGİLERİ</span>
                <span className="bg-red-800/80 text-[10px] px-1.5 py-0.5 rounded font-mono">ŞİFRESİZ / AÇIK</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-mono text-red-200 block">KOD: {cardId}</span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Aktif
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Profile Card & Blood Type Spotlight */}
        <div className="bg-slate-900/90 border-2 border-red-500/30 rounded-2xl p-5 backdrop-blur-md shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {medical.avatarUrl ? (
                  <img 
                    src={medical.avatarUrl} 
                    alt={medical.fullName} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-red-500/40 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 border-2 border-slate-900">
                  <Activity className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">{medical.fullName}</h1>
                <p className="text-sm text-slate-400">
                  Doğum Yılı: <span className="font-semibold text-slate-200">{medical.birthYear}</span> 
                  {' '}({new Date().getFullYear() - medical.birthYear} Yaşında)
                </p>
                {medical.organDonor && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Organ Bağışçısı
                  </span>
                )}
              </div>
            </div>

            {/* Huge Blood Type Badge */}
            <div className="bg-gradient-to-br from-red-600 to-rose-700 text-white rounded-2xl p-3 text-center shadow-lg shadow-red-900/40 min-w-[76px] border border-red-400/30">
              <div className="text-[9px] font-bold uppercase tracking-wider text-red-200">KAN GRUBU</div>
              <div className="text-2xl font-black tracking-tight leading-none mt-1">{medical.bloodType}</div>
            </div>
          </div>
        </div>

        {/* Emergency Contacts (ICE) - Call to Action */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Phone className="w-4 h-4 text-red-500" />
              Acil Aranacak Kişiler (ICE)
            </h2>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Dokunarak Ara</span>
          </div>

          <div className="space-y-2">
            {medical.emergencyContacts.map((contact) => (
              <a
                key={contact.id}
                href={`tel:${contact.phone}`}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-red-950/40 border border-slate-700/60 hover:border-red-500/50 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30 group-hover:scale-105 transition-transform">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white group-hover:text-red-300 transition-colors">
                      {contact.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      Yakınlık: <span className="text-slate-300 font-medium">{contact.relation}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-semibold bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <span>ARA</span>
                  <Phone className="w-3 h-3" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Critical Allergies */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alerjiler ve Hassasiyetler
          </h2>
          {medical.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {medical.allergies.map((allergy, index) => (
                <span 
                  key={index}
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 shadow-sm"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Bilinen kritik alerji kaydı bulunmamaktadır.</p>
          )}
        </div>

        {/* Chronic Conditions & Medications */}
        <div className="grid grid-cols-1 gap-3">
          {/* Chronic */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              Kronik Rahatsızlıklar
            </h2>
            <div className="space-y-1.5">
              {medical.chronicDiseases.map((disease, idx) => (
                <div key={idx} className="text-xs bg-slate-800/60 border border-slate-700/40 px-3 py-2 rounded-lg text-slate-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  {disease}
                </div>
              ))}
            </div>
          </div>

          {/* Medications */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-400" />
              Sürekli Kullanılan İlaçlar
            </h2>
            <div className="space-y-2">
              {medical.medications.map((med, idx) => (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/40 p-2.5 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{med.name}</div>
                    <div className="text-[11px] text-slate-400">{med.dosage}</div>
                  </div>
                  <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                    Düzenli
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor Note & Implants */}
        {(medical.doctorNote || medical.hasImplant) && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              Tıbbi Notlar &amp; Uyarılar
            </h2>
            {medical.hasImplant && (
              <div className="bg-indigo-950/40 border border-indigo-500/30 p-2.5 rounded-lg text-xs text-indigo-200">
                <span className="font-semibold text-indigo-300">⚠️ Tıbbi Cihaz / İmplant:</span> {medical.implantDetails}
              </div>
            )}
            {medical.doctorNote && (
              <p className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-lg border border-slate-700/40 italic leading-relaxed">
                "{medical.doctorNote}"
              </p>
            )}
          </div>
        )}

        {/* Fast Action Buttons */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Metin Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>İlk Yardım Metnini Kopyala</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center pt-3 pb-6 text-slate-500 text-[11px] flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>Bu profil acil tıbbi müdahale ve hayat kurtarma amacıyla açıktır.</span>
        </div>
      </main>
    </div>
  );
};

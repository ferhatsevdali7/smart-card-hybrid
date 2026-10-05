import React, { useState } from 'react';
import { 
  Heart, AlertTriangle, Phone, ShieldCheck, Pill, 
  Activity, CheckCircle2, User, Copy, Check, Info, FileText, ArrowRight 
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
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-[#509BEC] selection:text-white">
      {/* Top Banner - Serene & Trustworthy Deep Teal */}
      <div className="bg-gradient-to-r from-[#14798D] via-[#0E6476] to-[#14798D] text-white px-4 py-3 shadow-lg shadow-[#14798D]/20 sticky top-0 z-50">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-[#D1C8B9]" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[#D1C8B9]">Medikal Sağlık Profili</div>
              <div className="text-xs font-black tracking-wide text-white">HAYAT KURTARAN DİJİTAL KİMLİK</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-[#D1C8B9] block font-semibold">{cardId}</span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Açık / Aktif
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Profile Card & Blood Type Spotlight */}
        <div className="bg-gradient-to-br from-[#14798D]/25 via-slate-900 to-slate-950 border border-[#14798D]/40 rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-36 h-36 bg-[#509BEC]/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {medical.avatarUrl ? (
                  <img 
                    src={medical.avatarUrl} 
                    alt={medical.fullName} 
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#509BEC]/60 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 bg-[#14798D] text-white rounded-full p-1 border-2 border-slate-950">
                  <Activity className="w-3.5 h-3.5 text-[#D1C8B9]" />
                </div>
              </div>

              <div>
                <h1 className="text-lg font-black text-white tracking-tight">{medical.fullName}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Doğum Yılı: <span className="font-bold text-[#D1C8B9]">{medical.birthYear}</span> 
                  {' '}({new Date().getFullYear() - medical.birthYear} Yaşında)
                </p>
                {medical.organDonor && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Organ Bağışçısı
                  </span>
                )}
              </div>
            </div>

            {/* Blood Type Badge in Deep Teal & Linen */}
            <div className="bg-gradient-to-br from-[#14798D] to-[#0E6476] text-white rounded-2xl p-3 text-center shadow-lg min-w-[76px] border border-[#509BEC]/40">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#D1C8B9]">KAN GRUBU</div>
              <div className="text-2xl font-black tracking-tight leading-none mt-1">{medical.bloodType}</div>
            </div>
          </div>
        </div>

        {/* Emergency Contacts (ICE) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#509BEC]" />
              Acil Durumda Aranacak Kişiler (ICE)
            </h2>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-medium">Tek Dokunuşla Ara</span>
          </div>

          <div className="space-y-2">
            {medical.emergencyContacts.map((contact) => (
              <a
                key={contact.id}
                href={`tel:${contact.phone}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-[#14798D]/20 border border-slate-700/60 hover:border-[#14798D]/60 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#509BEC]/20 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30 group-hover:scale-105 transition-transform">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white group-hover:text-[#509BEC] transition-colors">
                      {contact.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      Yakınlık: <span className="text-[#D1C8B9] font-medium">{contact.relation}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md group-hover:scale-105 transition-all">
                  <span>ARA</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Allergies & Sensitivities */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2.5 shadow-lg">
          <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alerjiler ve Hassasiyetler
          </h2>
          {medical.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {medical.allergies.map((allergy, index) => (
                <span 
                  key={index}
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5"
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-lg">
            <h2 className="text-xs font-bold text-[#D1C8B9] uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-[#14798D]" />
              Kronik Rahatsızlıklar
            </h2>
            <div className="space-y-1.5">
              {medical.chronicDiseases.map((disease, idx) => (
                <div key={idx} className="text-xs bg-slate-800/60 border border-slate-700/40 px-3 py-2 rounded-xl text-slate-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#509BEC]"></div>
                  {disease}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-lg">
            <h2 className="text-xs font-bold text-[#509BEC] uppercase tracking-wider flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#509BEC]" />
              Sürekli Kullanılan İlaçlar
            </h2>
            <div className="space-y-2">
              {medical.medications.map((med, idx) => (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/40 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">{med.name}</div>
                    <div className="text-[11px] text-slate-400">{med.dosage}</div>
                  </div>
                  <span className="text-[10px] bg-[#509BEC]/10 text-[#509BEC] px-2 py-0.5 rounded-md border border-[#509BEC]/20 font-medium">
                    Düzenli
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor Note */}
        {medical.doctorNote && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-lg">
            <h2 className="text-xs font-bold text-[#D1C8B9] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#14798D]" />
              Tıbbi Notlar &amp; İlk Yardım Açıklaması
            </h2>
            <p className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-xl border border-slate-700/40 italic leading-relaxed">
              "{medical.doctorNote}"
            </p>
          </div>
        )}

        {/* Copy summary action */}
        <div className="pt-2">
          <button
            onClick={handleCopySummary}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-bold">İlk Yardım Metni Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#509BEC]" />
                <span>İlk Yardım Metnini Kopyala</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center pt-2 pb-6 text-slate-500 text-[11px] flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500" />
          <span>Bu profil acil tıbbi müdahale ve hayat kurtarma amacıyla açık tutulmaktadır.</span>
        </div>
      </main>
    </div>
  );
};

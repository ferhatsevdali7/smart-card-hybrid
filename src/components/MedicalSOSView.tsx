import React, { useState } from 'react';
import { 
  Heart, AlertTriangle, Phone, ShieldCheck, Pill, 
  Activity, CheckCircle2, User, Copy, Check, Info, FileText, ArrowRight 
} from 'lucide-react';
import { MedicalInfo } from '../types/card';
import { generateNdefTextPayload } from '../lib/nfc';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface MedicalSOSViewProps {
  medical: MedicalInfo;
  cardId: string;
  lang?: Language;
  theme?: ThemeMode;
  isPublicScan?: boolean;
  onOpenAuth?: () => void;
}

export const MedicalSOSView: React.FC<MedicalSOSViewProps> = ({ 
  medical, 
  cardId, 
  lang = 'tr', 
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth 
}) => {
  const [copied, setCopied] = useState(false);
  const t = translations[lang].sos;
  const isDark = theme === 'dark';

  const handleCopySummary = () => {
    const text = generateNdefTextPayload(medical);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const age = new Date().getFullYear() - medical.birthYear;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-20 selection:bg-[#509BEC] selection:text-white transition-colors`}>
      {/* Top Banner - Serene & Trustworthy Deep Teal */}
      <div className="bg-gradient-to-r from-[#14798D] via-[#0E6476] to-[#14798D] text-white px-4 py-3 shadow-lg shadow-[#14798D]/20 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex items-center justify-between">
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

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Profile Card & Blood Type Spotlight */}
        <div className={`bg-gradient-to-br ${isDark ? 'from-[#14798D]/25 via-slate-900 to-slate-950 border-[#14798D]/40' : 'from-[#14798D]/10 via-white to-slate-50 border-[#14798D]/30'} border rounded-3xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md`}>
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
                  <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-200 border-slate-300 text-slate-600'} border flex items-center justify-center`}>
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 bg-[#14798D] text-white rounded-full p-1 border-2 ${isDark ? 'border-slate-950' : 'border-white'}`}>
                  <Activity className="w-3.5 h-3.5 text-[#D1C8B9]" />
                </div>
              </div>

              <div>
                <h1 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>{medical.fullName}</h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-0.5`}>
                  {t.birthYear}: <span className="font-bold text-[#14798D] dark:text-[#D1C8B9]">{medical.birthYear}</span> 
                  {' '}({age} {t.yearsOld})
                </p>
                {medical.organDonor && (
                  <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold ${isDark ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-300'} px-2 py-0.5 rounded-md border`}>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {t.organDonor}
                  </span>
                )}
              </div>
            </div>

            {/* Blood Type Badge in Deep Teal & Linen */}
            <div className="bg-gradient-to-br from-[#14798D] to-[#0E6476] text-white rounded-2xl p-3 text-center shadow-lg min-w-[76px] border border-[#509BEC]/40">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#D1C8B9]">{t.bloodType}</div>
              <div className="text-2xl font-black tracking-tight leading-none mt-1">{medical.bloodType}</div>
            </div>
          </div>
        </div>

        {/* Emergency Contacts (ICE) */}
        <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-3 shadow-lg`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} uppercase tracking-wider flex items-center gap-2`}>
              <Phone className="w-4 h-4 text-[#509BEC]" />
              {t.iceTitle}
            </h2>
            <span className={`text-[10px] ${isDark ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-slate-100'} px-2 py-0.5 rounded font-medium`}>{t.tapToCall}</span>
          </div>

          <div className="space-y-2">
            {medical.emergencyContacts.map((contact) => (
              <a
                key={contact.id}
                href={`tel:${contact.phone}`}
                className={`flex items-center justify-between p-3.5 rounded-2xl ${isDark ? 'bg-slate-800/80 hover:bg-[#14798D]/20 border-slate-700/60 hover:border-[#14798D]/60' : 'bg-slate-50 hover:bg-[#14798D]/10 border-slate-200 hover:border-[#14798D]/40'} border transition-all duration-200 group`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#509BEC]/20 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30 group-hover:scale-105 transition-transform">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${isDark ? 'text-white group-hover:text-[#509BEC]' : 'text-slate-900 group-hover:text-[#14798D]'} transition-colors`}>
                      {contact.name}
                    </div>
                    <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.relation}: <span className="text-[#14798D] dark:text-[#D1C8B9] font-medium">{contact.relation}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md group-hover:scale-105 transition-all">
                  <span>{t.callBtn}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Allergies & Sensitivities */}
        <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-2.5 shadow-lg`}>
          <h2 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {t.allergies}
          </h2>
          {medical.allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {medical.allergies.map((allergy, index) => (
                <span 
                  key={index}
                  className={`bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-300' : 'text-amber-700'} text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  {allergy}
                </span>
              ))}
            </div>
          ) : (
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.noAllergies}</p>
          )}
        </div>

        {/* Chronic Conditions & Medications */}
        <div className="grid grid-cols-1 gap-3">
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-2 shadow-lg`}>
            <h2 className={`text-xs font-bold ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} uppercase tracking-wider flex items-center gap-2`}>
              <Heart className="w-4 h-4 text-[#14798D]" />
              {t.chronic}
            </h2>
            <div className="space-y-1.5">
              {medical.chronicDiseases.map((disease, idx) => (
                <div key={idx} className={`text-xs ${isDark ? 'bg-slate-800/60 border-slate-700/40 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'} border px-3 py-2 rounded-xl flex items-center gap-2`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#509BEC]"></div>
                  {disease}
                </div>
              ))}
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-2 shadow-lg`}>
            <h2 className="text-xs font-bold text-[#509BEC] uppercase tracking-wider flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#509BEC]" />
              {t.medications}
            </h2>
            <div className="space-y-2">
              {medical.medications.map((med, idx) => (
                <div key={idx} className={`${isDark ? 'bg-slate-800/60 border-slate-700/40' : 'bg-slate-50 border-slate-200'} border p-2.5 rounded-xl flex items-center justify-between`}>
                  <div>
                    <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{med.name}</div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{med.dosage}</div>
                  </div>
                  <span className="text-[10px] bg-[#509BEC]/10 text-[#509BEC] px-2 py-0.5 rounded-md border border-[#509BEC]/20 font-medium">
                    {t.regular}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Doctor Note */}
        {medical.doctorNote && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-2 shadow-lg`}>
            <h2 className={`text-xs font-bold ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} uppercase tracking-wider flex items-center gap-2`}>
              <FileText className="w-4 h-4 text-[#14798D]" />
              {t.doctorNotes}
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-300 bg-slate-800/60 border-slate-700/40' : 'text-slate-700 bg-slate-50 border-slate-200'} p-3 rounded-xl border italic leading-relaxed`}>
              "{medical.doctorNote}"
            </p>
          </div>
        )}

        {/* Copy summary action */}
        <div className="pt-2">
          <button
            onClick={handleCopySummary}
            className={`w-full ${isDark ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800 shadow-sm'} border text-xs font-semibold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-500 font-bold">{t.copiedSummary}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#509BEC]" />
                <span>{t.copySummary}</span>
              </>
            )}
          </button>
        </div>

        <div className={`text-center pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} text-[11px] flex items-center justify-center gap-1.5`}>
          <Info className="w-3.5 h-3.5" />
          <span>{t.disclaimer}</span>
        </div>

        {isPublicScan && onOpenAuth && (
          <div className="text-center pt-3 pb-6">
            <button
              onClick={onOpenAuth}
              className={`text-xs ${isDark ? 'text-slate-400 hover:text-white bg-slate-900 border-slate-800' : 'text-slate-600 hover:text-slate-900 bg-white border-slate-200'} border px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm`}
            >
              <User className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>{lang === 'tr' ? 'Kart Sahibi misiniz? Giriş Yapın & Düzenleyin' : 'Card Owner? Sign In & Edit'}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

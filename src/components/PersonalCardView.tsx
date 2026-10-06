import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Copy, Check, Clock, ShieldCheck, 
  Download, MessageSquare, Phone, Mail, 
  ExternalLink, Lock, RotateCcw, AlertCircle, Building2, Sparkles 
} from 'lucide-react';
import { PersonalInfo } from '../types/card';
import { downloadVCardFile } from '../lib/vcard';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface PersonalCardViewProps {
  personal: PersonalInfo;
  cardId: string;
  lang?: Language;
  theme?: ThemeMode;
  isPublicScan?: boolean;
  onOpenAuth?: () => void;
}

const SESSION_DURATION = 60;

export const PersonalCardView: React.FC<PersonalCardViewProps> = ({ 
  personal, 
  cardId, 
  lang = 'tr', 
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [copiedIbanId, setCopiedIbanId] = useState<string | null>(null);
  const [clipboardTimer, setClipboardTimer] = useState<number | null>(null);

  const t = translations[lang].personal;
  const isDark = theme === 'dark';

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsLocked(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isLocked]);

  useEffect(() => {
    if (clipboardTimer === null) return;
    if (clipboardTimer <= 0) {
      setClipboardTimer(null);
      return;
    }

    const interval = setInterval(() => {
      setClipboardTimer(prev => (prev && prev > 1 ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [clipboardTimer]);

  const handleCopyIban = (id: string, iban: string) => {
    navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
    setCopiedIbanId(id);
    setClipboardTimer(30);

    setTimeout(() => {
      setCopiedIbanId(null);
    }, 3000);
  };

  const handleResetSession = () => {
    setIsLocked(false);
    setTimeLeft(SESSION_DURATION);
  };

  if (isLocked) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex items-center justify-center p-4 transition-colors`}>
        <div className={`max-w-md w-full ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xl'} border rounded-3xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden`}>
          <div className="w-16 h-16 bg-[#14798D]/20 text-[#509BEC] rounded-2xl flex items-center justify-center mx-auto border border-[#14798D]/30">
            <Lock className="w-8 h-8 text-[#14798D] dark:text-[#509BEC]" />
          </div>

          <div className="space-y-2">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.sessionExpiredTitle}</h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {t.sessionExpiredDesc}
            </p>
          </div>

          <div className={`${isDark ? 'bg-slate-950 border-slate-800 text-[#D1C8B9]' : 'bg-slate-100 border-slate-200 text-slate-700'} border rounded-xl p-3 text-xs font-mono font-bold`}>
            ID: {cardId}
          </div>

          <button
            onClick={handleResetSession}
            className="w-full bg-gradient-to-r from-[#14798D] to-[#509BEC] hover:from-[#0E6476] hover:to-[#4085d4] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-lg shadow-[#14798D]/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.reScanBtn}</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = (timeLeft / SESSION_DURATION) * 100;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-20 select-none selection:bg-[#509BEC] transition-colors`}>
      {/* Top Security Session Bar */}
      <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'} border-b sticky top-0 z-40 backdrop-blur-md px-4 py-2.5 shadow-md`}>
        <div className="max-w-md mx-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#14798D] dark:text-[#509BEC]">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>{t.secureSession}</span>
            </div>
            <div className={`flex items-center gap-1.5 font-mono ${isDark ? 'text-[#D1C8B9] bg-slate-950 border-slate-800' : 'text-slate-800 bg-slate-100 border-slate-200'} font-bold px-2 py-0.5 rounded-md border`}>
              <Clock className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
            </div>
          </div>

          <div className={`w-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'} h-1.5 rounded-full overflow-hidden`}>
            <div 
              className={`h-full transition-all duration-1000 rounded-full ${
                timeLeft < 15 ? 'bg-amber-500' : 'bg-gradient-to-r from-[#14798D] to-[#509BEC]'
              }`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Profile Card Header */}
        <div className={`bg-gradient-to-br ${isDark ? 'from-slate-900 via-slate-900 to-[#14798D]/15 border-slate-800' : 'from-white via-white to-[#14798D]/10 border-slate-200 shadow-md'} border rounded-3xl p-5 shadow-xl relative overflow-hidden`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>{personal.fullName}</h1>
              {personal.title && (
                <p className="text-xs font-bold text-[#509BEC] mt-0.5">{personal.title}</p>
              )}
              {personal.company && (
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1 mt-0.5`}>
                  <Building2 className="w-3 h-3 text-[#14798D]" />
                  {personal.company}
                </p>
              )}
              {personal.city && (
                <p className={`text-[11px] ${isDark ? 'text-[#D1C8B9]' : 'text-slate-500'} mt-1`}>{personal.city}</p>
              )}
            </div>

            <span className={`text-[10px] font-mono ${isDark ? 'bg-slate-950 text-[#D1C8B9] border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200'} px-2.5 py-1 rounded-xl border font-bold`}>
              {cardId}
            </span>
          </div>

          {personal.bio && (
            <p className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-700'} text-xs leading-relaxed`}>
              {personal.bio}
            </p>
          )}

          {/* Action Row */}
          <div className={`mt-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} flex items-center gap-2`}>
            <button
              onClick={() => downloadVCardFile(personal)}
              className="flex-1 bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#509BEC]/20 active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>{t.saveVCard}</span>
            </button>
            <a
              href={`https://wa.me/${personal.phone.replace(/[^0-9]/g, '')}?text=Merhaba%20${encodeURIComponent(personal.fullName)},%20akıllı%20kartınız%20üzerinden%20ulaşıyorum.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/20 active:scale-98"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t.whatsapp}</span>
            </a>
          </div>
        </div>

        {/* Bank & IBAN Accounts */}
        <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-3 shadow-lg`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider flex items-center gap-2`}>
              <CreditCard className="w-4 h-4 text-[#509BEC]" />
              {t.bankInfo}
            </h2>
            <span className={`text-[10px] ${isDark ? 'text-slate-400 bg-slate-800' : 'text-slate-600 bg-slate-100'} px-2 py-0.5 rounded font-medium`}>{t.oneClickCopy}</span>
          </div>

          <div className="space-y-3">
            {personal.bankAccounts.map((account) => {
              const isCopied = copiedIbanId === account.id;
              return (
                <div 
                  key={account.id}
                  className={`${isDark ? 'bg-slate-950 border-slate-800 hover:border-[#14798D]/50' : 'bg-slate-50 border-slate-200 hover:border-[#14798D]/40'} border rounded-2xl p-3.5 space-y-2.5 transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#14798D]/20 text-[#509BEC] flex items-center justify-center font-bold text-xs border border-[#14798D]/30">
                        {account.bankName.charAt(0)}
                      </div>
                      <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{account.bankName}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${isDark ? 'bg-slate-900 text-[#D1C8B9] border-slate-800' : 'bg-white text-slate-700 border-slate-200'} px-2 py-0.5 rounded border font-bold`}>
                      {account.currency}
                    </span>
                  </div>

                  <div className={`${isDark ? 'bg-slate-900/80 border-slate-800/80' : 'bg-white border-slate-200'} border rounded-xl p-2.5 flex items-center justify-between gap-2`}>
                    <div className={`font-mono text-xs ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} tracking-wider break-all font-bold`}>
                      {account.iban}
                    </div>
                    <button
                      onClick={() => handleCopyIban(account.id, account.iban)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                        isCopied 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-[#509BEC] hover:bg-[#4085d4] text-white active:scale-98'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t.copiedBtn}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t.copyBtn}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.accountHolder}: <span className={`${isDark ? 'text-slate-200' : 'text-slate-800'} font-semibold`}>{account.accountHolder}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {clipboardTimer !== null && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{t.clipboardAlert} (<strong>{clipboardTimer}s</strong>)</span>
            </div>
          )}
        </div>

        {/* Quick Contact & Socials */}
        <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-3 shadow-lg`}>
          <h2 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} uppercase tracking-wider flex items-center gap-2`}>
            <Sparkles className="w-4 h-4 text-[#509BEC]" />
            {t.contacts}
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${personal.phone}`}
              className={`${isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border rounded-2xl p-3 flex items-center gap-2.5 transition-colors`}
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase font-semibold`}>{t.phone}</div>
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate`}>{personal.phone}</div>
              </div>
            </a>

            <a
              href={`mailto:${personal.email}`}
              className={`${isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} border rounded-2xl p-3 flex items-center gap-2.5 transition-colors`}
            >
              <div className="w-8 h-8 rounded-xl bg-[#509BEC]/10 text-[#509BEC] flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} uppercase font-semibold`}>{t.email}</div>
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'} truncate`}>{personal.email}</div>
              </div>
            </a>
          </div>

          <div className="space-y-2 pt-1">
            {personal.socialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between p-3 ${isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 hover:border-[#14798D]/40 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-[#14798D]/40 text-slate-700'} border rounded-2xl text-xs transition-colors group`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <ExternalLink className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400 group-hover:text-[#509BEC]' : 'text-slate-500 group-hover:text-[#14798D]'}`} />
                  <span>{link.title}</span>
                </div>
                <span className={`text-[11px] ${isDark ? 'text-slate-500 group-hover:text-[#509BEC]' : 'text-slate-500 group-hover:text-[#14798D]'} font-mono`}>{t.visit} &rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {personal.customNotes && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-4 space-y-1.5 shadow-lg`}>
            <h3 className={`text-xs font-bold ${isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]'} uppercase`}>{t.customNotes}</h3>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed`}>{personal.customNotes}</p>
          </div>
        )}

        <div className={`text-center pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} text-[11px] flex items-center justify-center gap-1.5`}>
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{t.disclaimer}</span>
        </div>

        {isPublicScan && onOpenAuth && (
          <div className="text-center pt-3 pb-6">
            <button
              onClick={onOpenAuth}
              className={`text-xs ${isDark ? 'text-slate-400 hover:text-white bg-slate-900 border-slate-800' : 'text-slate-600 hover:text-slate-900 bg-white border-slate-200'} border px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-sm`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>{lang === 'tr' ? 'Kart Sahibi misiniz? Giriş Yapın & Düzenleyin' : 'Card Owner? Sign In & Edit'}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

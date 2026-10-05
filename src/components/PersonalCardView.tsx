import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Copy, Check, Clock, ShieldCheck, 
  Share2, Download, MessageSquare, Phone, Mail, 
  ExternalLink, Lock, RotateCcw, AlertCircle, Building2 
} from 'lucide-react';
import { PersonalInfo } from '../types/card';
import { downloadVCardFile } from '../lib/vcard';

interface PersonalCardViewProps {
  personal: PersonalInfo;
  cardId: string;
}

const SESSION_DURATION = 60; // 60 seconds auto-lock

export const PersonalCardView: React.FC<PersonalCardViewProps> = ({ personal, cardId }) => {
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [copiedIbanId, setCopiedIbanId] = useState<string | null>(null);
  const [clipboardTimer, setClipboardTimer] = useState<number | null>(null);

  // Auto-lock countdown timer
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

  // Clipboard auto-clear countdown simulation
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
    setClipboardTimer(30); // 30s auto clear notification

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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Güvenlik Nedeniyle Oturum Sonlandı</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kişisel ve finansal verilerinizin güvenliği için 60 saniyelik görüntüleme süresi dolmuştur.
            </p>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-xs text-slate-300 font-mono">
            Kart ID: {cardId}
          </div>

          <button
            onClick={handleResetSession}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-lg shadow-blue-900/30"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Kartı Yeniden Okut (Simülasyon)</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = (timeLeft / SESSION_DURATION) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 pb-16 select-none">
      {/* Top Security Session Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-50 backdrop-blur-md px-4 py-2.5 shadow-md">
        <div className="max-w-md mx-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Güvenli Oturum</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-slate-300 font-bold bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 rounded-full ${
                timeLeft < 15 ? 'bg-rose-500' : timeLeft < 30 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Profile Card Header */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">{personal.fullName}</h1>
              {personal.title && (
                <p className="text-sm font-medium text-blue-400 mt-0.5">{personal.title}</p>
              )}
              {personal.company && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 text-slate-500" />
                  {personal.company}
                </p>
              )}
              {personal.city && (
                <p className="text-[11px] text-slate-500 mt-1">{personal.city}</p>
              )}
            </div>

            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded-lg border border-slate-700">
              {cardId}
            </span>
          </div>

          {personal.bio && (
            <p className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
              {personal.bio}
            </p>
          )}

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
            <button
              onClick={() => downloadVCardFile(personal)}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md shadow-blue-900/20"
            >
              <Download className="w-4 h-4" />
              <span>Rehbere Kaydet</span>
            </button>
            <a
              href={`https://wa.me/${personal.phone.replace(/[^0-9]/g, '')}?text=Merhaba%20Ahmet%20Bey,%20akıllı%20kartınız%20üzerinden%20ulaşıyorum.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md shadow-emerald-900/20"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Bank & IBAN Accounts */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-400" />
              Banka ve IBAN Bilgileri
            </h2>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Tek Tıkla Kopyala</span>
          </div>

          <div className="space-y-3">
            {personal.bankAccounts.map((account) => {
              const isCopied = copiedIbanId === account.id;
              return (
                <div 
                  key={account.id}
                  className="bg-gradient-to-br from-slate-800/90 to-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-2.5 hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                        {account.bankName.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-200">{account.bankName}</span>
                    </div>
                    <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-800">
                      {account.currency}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                    <div className="font-mono text-xs text-slate-200 tracking-wider break-all font-semibold">
                      {account.iban}
                    </div>
                    <button
                      onClick={() => handleCopyIban(account.id, account.iban)}
                      className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isCopied 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Kopyala</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Alıcı: <span className="text-slate-300 font-medium">{account.accountHolder}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clipboard Clear Notification Toast */}
          {clipboardTimer !== null && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-300 animate-fadeIn">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>IBAN kopyalandı! Güvenlik için pano <strong>{clipboardTimer} sn</strong> sonra temizlenecektir.</span>
            </div>
          )}
        </div>

        {/* Quick Contact & Socials */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-400" />
            İletişim ve Bağlantılar
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${personal.phone}`}
              className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl p-3 flex items-center gap-2.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Telefon</div>
                <div className="text-xs font-semibold text-white truncate">{personal.phone}</div>
              </div>
            </a>

            <a
              href={`mailto:${personal.email}`}
              className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-xl p-3 flex items-center gap-2.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">E-posta</div>
                <div className="text-xs font-semibold text-white truncate">{personal.email}</div>
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
                className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 hover:border-slate-600 rounded-xl text-xs text-slate-200 transition-colors group"
              >
                <div className="flex items-center gap-2 font-medium">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                  <span>{link.title}</span>
                </div>
                <span className="text-[11px] text-slate-500 group-hover:text-slate-400 font-mono">Ziyaret Et &rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {/* Custom Notes */}
        {personal.customNotes && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Özel Not</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{personal.customNotes}</p>
          </div>
        )}

        {/* Footer Security Notice */}
        <div className="text-center pt-2 pb-6 text-slate-500 text-[11px] flex items-center justify-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>Bu profil süreli ve gizlilik korumalı olarak sunulmaktadır.</span>
        </div>
      </main>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Copy, Check, Clock, ShieldCheck, 
  Download, MessageSquare, Phone, Mail, 
  ExternalLink, Lock, RotateCcw, AlertCircle, Building2, 
  Sparkles, Edit3, X, Plus, Trash2, Save, QrCode, Wifi, Smartphone, Printer
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PersonalInfo, BankAccount, SocialLink } from '../types/card';
import { downloadVCardFile } from '../lib/vcard';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface PersonalCardViewProps {
  personal: PersonalInfo;
  cardId: string;
  lang?: Language;
  theme?: ThemeMode;
  isPublicScan?: boolean;
  onOpenAuth?: () => void;
  onUpdatePersonal?: (updated: PersonalInfo) => void;
  isOwner?: boolean;
  subTab?: SubTab;
  onSubTabChange?: (tab: SubTab) => void;
}

const SESSION_DURATION = 60;
export type SubTab = 'details' | 'qr' | 'nfc';

export const PersonalCardView: React.FC<PersonalCardViewProps> = ({ 
  personal, 
  cardId, 
  lang = 'tr', 
  theme = 'dark',
  isPublicScan = false,
  onOpenAuth,
  onUpdatePersonal,
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
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [copiedIbanId, setCopiedIbanId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedNfc, setCopiedNfc] = useState(false);
  const [clipboardTimer, setClipboardTimer] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<PersonalInfo>(personal);
  const [newBankName, setNewBankName] = useState('');
  const [newIban, setNewIban] = useState('');
  const [newSocialTitle, setNewSocialTitle] = useState('');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  const t = translations[lang].personal;
  const isDark = theme === 'dark';
  const personalUrl = `${window.location.origin}?view=personal&id=${cardId}`;
  
  // Prepare vCard text for NFC NDEF text payload
  const nfcVCardPayload = `BEGIN:VCARD\nVERSION:3.0\nFN:${personal.fullName}\nTITLE:${personal.title}\nORG:${personal.company}\nTEL:${personal.phone}\nEMAIL:${personal.email}\nURL:${personalUrl}\nEND:VCARD`;
  const nfcByteCount = new Blob([nfcVCardPayload]).size;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdatePersonal) {
      onUpdatePersonal(editForm);
    }
    setIsEditing(false);
  };

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
      navigator.clipboard.writeText('').catch(() => {});
      setClipboardTimer(null);
      return;
    }

    const interval = setInterval(() => {
      setClipboardTimer(prev => {
        if (prev && prev <= 1) {
          navigator.clipboard.writeText('').catch(() => {});
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [clipboardTimer]);

  const handleCopyIban = (id: string, iban: string) => {
    navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
    setCopiedIbanId(id);
    setClipboardTimer(30);
    setTimeout(() => setCopiedIbanId(null), 3000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(personalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyNfc = () => {
    navigator.clipboard.writeText(nfcVCardPayload);
    setCopiedNfc(true);
    setTimeout(() => setCopiedNfc(false), 2000);
  };

  const handleResetSession = () => {
    setTimeLeft(SESSION_DURATION);
    setIsLocked(false);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} pb-24 selection:bg-[#14798D] selection:text-white transition-colors`}>
      {/* Top Banner - Serene Modern Navy Teal */}
      <div className="bg-gradient-to-r from-[#509BEC] via-[#14798D] to-[#509BEC] text-white px-4 py-3 shadow-lg shadow-[#509BEC]/20 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center backdrop-blur-sm">
              <CreditCard className="w-5 h-5 text-[#D1C8B9]" />
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[#D1C8B9]">{lang === 'tr' ? 'Sosyal Kartvizit Profili' : 'Social Business Profile'}</div>
              <div className="text-xs font-black tracking-wide text-white">{lang === 'tr' ? 'GÜVENLİ DİJİTAL KARTVİZİT & IBAN' : 'SECURE DIGITAL BUSINESS CARD & IBAN'}</div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-[#D1C8B9] block font-semibold">{cardId}</span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              {t.secureSession}
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
                ? 'bg-[#509BEC] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>{lang === 'tr' ? 'sosyal kart bilgileri/ düzenle' : 'Social Card Info / Edit'}</span>
          </button>

          <button
            onClick={() => handleSelectSubTab('qr')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'qr'
                ? 'bg-[#509BEC] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>{lang === 'tr' ? 'sosyal kart QR' : 'Social Card QR'}</span>
          </button>

          <button
            onClick={() => handleSelectSubTab('nfc')}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeSubTab === 'nfc'
                ? 'bg-[#509BEC] text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wifi className="w-4 h-4 rotate-90" />
            <span>{lang === 'tr' ? 'sosyal kart NFC' : 'Social Card NFC'}</span>
          </button>
        </div>

        {/* ----------------- SUB-TAB 1: SOCIAL CARD DETAILS & EDIT ----------------- */}
        {activeSubTab === 'details' && (
          <div className="space-y-4">
            {/* Owner Quick Edit Action Bar */}
            {isOwner && onUpdatePersonal && (
              <div className="flex items-center justify-between bg-[#509BEC]/15 border border-[#509BEC]/30 p-3 rounded-2xl">
                <div className="flex items-center gap-2 text-xs font-bold text-[#509BEC]">
                  <Sparkles className="w-4 h-4" />
                  <span>{lang === 'tr' ? 'Sosyal Kart Sahibi Modu' : 'Social Card Owner Mode'}</span>
                </div>
                <button
                  onClick={() => { setEditForm(personal); setIsEditing(true); }}
                  className="bg-[#509BEC] hover:bg-[#3b85d9] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{lang === 'tr' ? 'Kartı Düzenle' : 'Edit Card'}</span>
                </button>
              </div>
            )}

            {/* Timed Session Bar with Ephemeral Clipboard Warning */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
              isLocked 
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-300' 
                : timeLeft < 15
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-300 animate-pulse'
                  : isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
            }`}>
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <Clock className={`w-4 h-4 ${isLocked ? 'text-rose-400' : 'text-[#509BEC]'}`} />
                <span>
                  {isLocked 
                    ? t.sessionExpiredTitle
                    : `${lang === 'tr' ? 'Gizlilik Sayacı' : 'Privacy Timer'}: ${timeLeft}s`}
                </span>
              </div>

              {isLocked ? (
                <button
                  onClick={handleResetSession}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'tr' ? 'Oturumu Aç' : 'Unlock Session'}</span>
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono">
                  {clipboardTimer ? `✂️ Pano ${clipboardTimer}s sonra silinecek` : '🛡️ Pano Güvenliği Aktif'}
                </span>
              )}
            </div>

            {/* Locked State Notification */}
            {isLocked ? (
              <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-8 text-center space-y-4`}>
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold">{t.sessionExpiredTitle}</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {t.sessionExpiredDesc}
                  </p>
                </div>
                <button
                  onClick={handleResetSession}
                  className="bg-[#509BEC] hover:bg-[#3b85d9] text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all"
                >
                  {lang === 'tr' ? 'Oturumu Aç' : 'Unlock Session'}
                </button>
              </div>
            ) : (
              <>
                {/* Digital Card Profile Header */}
                <section className={`${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-6 relative overflow-hidden transition-colors`}>
                  <div className="absolute top-0 right-0 w-36 h-36 bg-[#509BEC]/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>
                  
                  <div className="space-y-4 relative z-10">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#509BEC]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{lang === 'tr' ? 'Dijital Kartvizit' : 'Digital Business Card'}</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight">{personal.fullName}</h1>
                        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                          <span>{personal.title}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-[#14798D] dark:text-[#509BEC]">
                            <Building2 className="w-3 h-3" />
                            {personal.company}
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => downloadVCardFile(personal)}
                        className="shrink-0 bg-gradient-to-tr from-[#14798D] to-[#509BEC] hover:opacity-90 text-white p-3 rounded-2xl shadow-lg shadow-[#509BEC]/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
                        title={t.saveVCard}
                      >
                        <Download className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{t.saveVCard}</span>
                      </button>
                    </div>

                    {personal.bio && (
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'} border-t border-slate-800/60 pt-3`}>
                        {personal.bio}
                      </p>
                    )}

                    {/* Quick Action Contact Pills */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {personal.phone && (
                        <a
                          href={`tel:${personal.phone}`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isDark ? 'bg-slate-950 border-slate-800 hover:border-[#509BEC] text-slate-200' : 'bg-slate-50 border-slate-200 hover:border-[#14798D] text-slate-800'
                          }`}
                        >
                          <Phone className="w-3.5 h-3.5 text-[#509BEC]" />
                          <span>{personal.phone}</span>
                        </a>
                      )}
                      {personal.email && (
                        <a
                          href={`mailto:${personal.email}`}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isDark ? 'bg-slate-950 border-slate-800 hover:border-[#509BEC] text-slate-200' : 'bg-slate-50 border-slate-200 hover:border-[#14798D] text-slate-800'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5 text-[#14798D]" />
                          <span>{personal.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* Bank Accounts & IBAN Safe Vault */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.bankInfo}</span>
                    </h2>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {t.oneClickCopy} (30s Pano Korumalı)
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {personal.bankAccounts.map((bank, idx) => (
                      <div
                        key={bank.id || idx}
                        className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-2xl p-4 flex items-center justify-between gap-3 transition-all`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{bank.bankName}</span>
                            <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded">{bank.currency || 'TRY'}</span>
                          </div>
                          <div className="text-xs font-mono font-semibold text-[#509BEC] tracking-wide break-all">
                            {bank.iban}
                          </div>
                        </div>

                        <button
                          onClick={() => handleCopyIban(bank.id || idx.toString(), bank.iban)}
                          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all ${
                            copiedIbanId === (bank.id || idx.toString())
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                              : isDark ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          {copiedIbanId === (bank.id || idx.toString()) ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span className="hidden sm:inline">
                            {copiedIbanId === (bank.id || idx.toString()) ? t.copiedBtn : t.copyBtn}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Social Media & Website Links */}
                {personal.socialLinks && personal.socialLinks.length > 0 && (
                  <section className="space-y-2.5">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-[#509BEC]" />
                      <span>{t.contacts}</span>
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {personal.socialLinks.map((link, idx) => (
                        <a
                          key={link.id || idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                            isDark ? 'bg-slate-900/90 border-slate-800 hover:border-[#509BEC] text-slate-200' : 'bg-white border-slate-200 hover:border-[#14798D] text-slate-800 shadow-sm'
                          }`}
                        >
                          <span className="text-xs font-bold">{link.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* ----------------- SUB-TAB 2: SOCIAL CARD QR ----------------- */}
        {activeSubTab === 'qr' && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-6 space-y-6 text-center transition-colors`}>
            <div>
              <h2 className="text-base font-bold flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-[#509BEC]" />
                <span>{lang === 'tr' ? 'Sosyal Kartvizit QR Kodu' : 'Social Card QR Code'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {lang === 'tr' ? 'Kartınızın arka yüzü, e-posta imzası veya sunumlar için dijital kartvizit QR kodu' : 'Digital business card QR for card back, email signatures or presentations'}
              </p>
            </div>

            {/* The QR Container */}
            <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl mx-auto border-4 border-[#509BEC]/30">
              <QRCodeSVG id="social-card-qr" value={personalUrl} size={180} level="H" includeMargin />
            </div>

            {/* Quick Summary under QR */}
            <div className="space-y-1">
              <div className="text-sm font-bold">{personal.fullName}</div>
              <div className="text-xs font-mono font-bold text-[#509BEC]">
                {personal.title} • {personal.company}
              </div>
              <div className="text-[11px] text-slate-400 font-mono break-all pt-1 max-w-sm mx-auto">
                {personalUrl}
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
                <span>{copiedLink ? (lang === 'tr' ? 'Bağlantı Kopyalandı!' : 'Link Copied!') : (lang === 'tr' ? 'Kartvizit Linkini Kopyala' : 'Copy Business Card Link')}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl bg-[#509BEC] hover:bg-[#3b85d9] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'tr' ? 'Kartvizit Yazdır / PDF' : 'Print Card / PDF'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ----------------- SUB-TAB 3: SOCIAL CARD NFC ----------------- */}
        {activeSubTab === 'nfc' && (
          <div className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-sm'} border rounded-3xl p-6 space-y-5 transition-colors`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#509BEC]/15 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30">
                  <Wifi className="w-5 h-5 rotate-90" />
                </div>
                <div>
                  <h2 className="text-base font-bold">{lang === 'tr' ? 'Sosyal Kart NFC Yükü' : 'Social Card NFC Payload'}</h2>
                  <p className="text-xs text-slate-400">{lang === 'tr' ? 'NFC dokunuşuyla rehbere ekleme ve kartvizit açma yükü' : 'NFC tap-to-save vCard & profile URL payload'}</p>
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
                <span>{lang === 'tr' ? 'NFC Çipine Yazılacak vCard / Metin:' : 'vCard / Text Payload for NFC:'}</span>
                <button
                  onClick={handleCopyNfc}
                  className="text-xs font-semibold text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1"
                >
                  {copiedNfc ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedNfc ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Metni Kopyala' : 'Copy Text')}</span>
                </button>
              </div>

              <pre className={`${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'} border p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed`}>
                {nfcVCardPayload}
              </pre>
            </div>

            {/* 3 Step NFC Write Guide */}
            <div className={`${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-4 space-y-3`}>
              <h3 className="text-xs font-bold flex items-center gap-2 text-[#509BEC]">
                <Smartphone className="w-4 h-4" />
                <span>{lang === 'tr' ? 'NFC Kartvizit Olarak Nasıl Kodlanır?' : 'How to Encode as NFC Business Card?'}</span>
              </h3>

              <ol className="text-xs text-slate-400 space-y-2 pl-4 list-decimal">
                <li>
                  {lang === 'tr' ? 'Telefonunuzda "NFC Tools" uygulamasını açın.' : 'Open "NFC Tools" app on your smartphone.'}
                </li>
                <li>
                  {lang === 'tr' ? '"Yaz (Write)" → "Kayıt Ekle (Add a record)" → "URL veya vCard" seçin.' : 'Select "Write" → "Add a record" → "URL or vCard".'}
                </li>
                <li>
                  {lang === 'tr' ? 'İster yukarıdaki vCard metnini ister kartvizit bağlantınızı yapıştırıp kartınıza dokundurun!' : 'Paste the vCard or profile link above and tap your card!'}
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
                <Edit3 className="w-5 h-5 text-[#509BEC]" />
                <h3 className="font-bold text-base">{lang === 'tr' ? 'Sosyal Kart Bilgilerini Düzenle' : 'Edit Social Card Info'}</h3>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className={`p-1.5 rounded-xl border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Full Name & Title */}
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
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Unvan / Pozisyon' : 'Title'}</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                </div>
              </div>

              {/* Company & Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Şirket / Marka' : 'Company'}</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Telefon Numarası' : 'Phone'}</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+90 5XX..."
                    className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                </div>
              </div>

              {/* Email & Bio */}
              <div className="space-y-1">
                <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'E-posta Adresi' : 'Email'}</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 uppercase tracking-wider">{lang === 'tr' ? 'Hakkımda / Biyografi' : 'Bio'}</label>
                <textarea
                  value={editForm.bio || ''}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={2}
                  className={`w-full p-2.5 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                />
              </div>

              {/* Bank Accounts */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-emerald-400 uppercase tracking-wider">{lang === 'tr' ? 'Banka Hesapları (IBAN)' : 'Bank Accounts (IBAN)'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    placeholder={lang === 'tr' ? 'Banka Adı (Örn: Ziraat)' : 'Bank Name'}
                    className={`p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      type="text"
                      value={newIban}
                      onChange={(e) => setNewIban(e.target.value)}
                      placeholder="TR00 0000 0000..."
                      className={`flex-1 p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newBankName.trim() && newIban.trim()) {
                          const bank: BankAccount = {
                            id: Date.now().toString(),
                            bankName: newBankName.trim(),
                            accountHolder: editForm.fullName,
                            iban: newIban.trim(),
                            currency: 'TRY'
                          };
                          setEditForm({ ...editForm, bankAccounts: [...editForm.bankAccounts, bank] });
                          setNewBankName('');
                          setNewIban('');
                        }
                      }}
                      className="bg-emerald-600 text-white px-3 rounded-xl font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {editForm.bankAccounts.map((b, idx) => (
                    <div key={b.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <div>
                        <strong>{b.bankName}</strong>: <span className="font-mono">{b.iban}</span>
                      </div>
                      <Trash2 
                        className="w-3.5 h-3.5 text-rose-400 cursor-pointer hover:scale-110" 
                        onClick={() => setEditForm({ ...editForm, bankAccounts: editForm.bankAccounts.filter((_, i) => i !== idx) })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="font-bold text-[#509BEC] uppercase tracking-wider">{lang === 'tr' ? 'Sosyal Medya & Linkler' : 'Social Links'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newSocialTitle}
                    onChange={(e) => setNewSocialTitle(e.target.value)}
                    placeholder={lang === 'tr' ? 'Başlık (Örn: LinkedIn)' : 'Title'}
                    className={`p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                  />
                  <div className="sm:col-span-2 flex gap-2">
                    <input
                      type="text"
                      value={newSocialUrl}
                      onChange={(e) => setNewSocialUrl(e.target.value)}
                      placeholder="https://..."
                      className={`flex-1 p-2 rounded-xl border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'} outline-none`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSocialTitle.trim() && newSocialUrl.trim()) {
                          const link: SocialLink = {
                            id: Date.now().toString(),
                            platform: 'website',
                            title: newSocialTitle.trim(),
                            url: newSocialUrl.trim()
                          };
                          setEditForm({ ...editForm, socialLinks: [...editForm.socialLinks, link] });
                          setNewSocialTitle('');
                          setNewSocialUrl('');
                        }
                      }}
                      className="bg-[#509BEC] text-white px-3 rounded-xl font-bold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {editForm.socialLinks.map((s, idx) => (
                    <div key={s.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
                      <div>
                        <strong>{s.title}</strong>: <span className="opacity-70 truncate max-w-[200px] inline-block">{s.url}</span>
                      </div>
                      <Trash2 
                        className="w-3.5 h-3.5 text-rose-400 cursor-pointer hover:scale-110" 
                        onClick={() => setEditForm({ ...editForm, socialLinks: editForm.socialLinks.filter((_, i) => i !== idx) })}
                      />
                    </div>
                  ))}
                </div>
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

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, Key, FileCode, CheckCircle2, 
  AlertCircle, RefreshCw, Copy, Check, Eye, EyeOff, Cloud, UploadCloud 
} from 'lucide-react';
import { SmartCard } from '../types/card';
import { encryptData, decryptData, EncryptedPayload } from '../lib/crypto';
import { saveVaultToFirestore, fetchVaultFromFirestore } from '../lib/firestoreService';
import { User } from 'firebase/auth';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface CryptoVaultViewProps {
  card: SmartCard;
  lang?: Language;
  theme?: ThemeMode;
  user?: User | null;
}

export const CryptoVaultView: React.FC<CryptoVaultViewProps> = ({ 
  card, 
  lang = 'tr', 
  theme = 'dark',
  user 
}) => {
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptedPayload, setEncryptedPayload] = useState<EncryptedPayload | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<any | null>(null);
  const [decryptPinInput, setDecryptPinInput] = useState('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudSavedMsg, setCloudSavedMsg] = useState<string | null>(null);

  const t = translations[lang].vault;
  const isDark = theme === 'dark';

  // Auto encrypt initial demo on mount
  useEffect(() => {
    handleRunEncryption();
  }, [card]);

  const handleRunEncryption = async () => {
    setIsEncrypting(true);
    setDecryptError(null);
    setDecryptedResult(null);
    try {
      const payloadToEncrypt = {
        medical: {
          fullName: card.medical.fullName,
          bloodType: card.medical.bloodType,
          chronicDiseases: card.medical.chronicDiseases,
          medications: card.medical.medications,
          allergies: card.medical.allergies,
          doctorNote: card.medical.doctorNote,
          emergencyContacts: card.medical.emergencyContacts
        },
        personal: {
          bankAccounts: card.personal.bankAccounts,
          customNotes: card.personal.customNotes
        }
      };

      const result = await encryptData(payloadToEncrypt, pin);
      setEncryptedPayload(result);
      setDecryptPinInput(pin);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleRunDecryption = async () => {
    if (!encryptedPayload) return;
    setDecryptError(null);
    try {
      const decrypted = await decryptData(encryptedPayload, decryptPinInput);
      setDecryptedResult(decrypted);
    } catch (e: any) {
      setDecryptError(e.message || 'Hatalı PIN Kodu!');
      setDecryptedResult(null);
    }
  };

  const handleCopyCiphertext = () => {
    if (!encryptedPayload) return;
    navigator.clipboard.writeText(JSON.stringify(encryptedPayload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleSaveToCloud = async () => {
    if (!encryptedPayload || !user) return;
    setCloudSaving(true);
    try {
      await saveVaultToFirestore(encryptedPayload, user.uid);
      setCloudSavedMsg(lang === 'tr' ? 'Şifreli kasa buluta başarıyla yedeklendi!' : 'Encrypted vault backed up to cloud!');
      setTimeout(() => setCloudSavedMsg(null), 3000);
    } catch (e: any) {
      alert(lang === 'tr' ? 'Yedekleme başarısız oldu.' : 'Backup failed.');
    } finally {
      setCloudSaving(false);
    }
  };

  const handleLoadFromCloud = async () => {
    if (!user) return;
    setCloudSaving(true);
    try {
      const remoteVault = await fetchVaultFromFirestore(user.uid);
      if (remoteVault) {
        setEncryptedPayload(remoteVault);
        setCloudSavedMsg(lang === 'tr' ? 'Buluttaki şifreli kasa yüklendi! Çözmek için PIN girin.' : 'Cloud vault loaded! Enter PIN to decrypt.');
        setTimeout(() => setCloudSavedMsg(null), 3500);
      } else {
        alert(lang === 'tr' ? 'Bulutta kayıtlı kasa bulunamadı.' : 'No cloud vault backup found.');
      }
    } catch (e: any) {
      alert(lang === 'tr' ? 'Yükleme başarısız oldu.' : 'Load failed.');
    } finally {
      setCloudSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* Cloud Notification */}
      {cloudSavedMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{cloudSavedMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className={`bg-gradient-to-br ${isDark ? 'from-[#14798D]/25 via-slate-900 to-slate-950 border-[#14798D]/40' : 'from-[#14798D]/10 via-white to-slate-50 border-[#14798D]/30 shadow-md'} border p-6 rounded-3xl shadow-xl space-y-3`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#14798D]/20 text-[#509BEC] flex items-center justify-center border border-[#14798D]/30 shadow-md">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.title}</h1>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  AES-GCM 256-BIT
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} mt-0.5`}>
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {user && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSaveToCloud}
                  disabled={cloudSaving || !encryptedPayload}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Buluta Yedekle"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{lang === 'tr' ? 'Buluta Yedekle' : 'Backup to Cloud'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadFromCloud}
                  disabled={cloudSaving}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                  title="Buluttan Yükle"
                >
                  <Cloud className="w-3.5 h-3.5 text-[#509BEC]" />
                  <span className="hidden sm:inline">{lang === 'tr' ? 'Buluttan Getir' : 'Load from Cloud'}</span>
                </button>
              </div>
            )}

            <div className={`flex items-center gap-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'} p-1.5 rounded-2xl border flex-1 sm:flex-initial`}>
              <div className="relative flex-1 sm:w-32">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder={t.pinPlaceholder}
                  className={`w-full bg-transparent px-3 py-1.5 text-xs ${isDark ? 'text-white' : 'text-slate-900'} font-mono tracking-widest focus:outline-none`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#509BEC]" />}
                </button>
              </div>

              <button
                onClick={handleRunEncryption}
                disabled={isEncrypting || !pin}
                className="bg-[#14798D] hover:bg-[#0E6476] text-white text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isEncrypting ? 'animate-spin' : ''}`} />
                <span>{t.reEncrypt}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Encrypted Payload vs Decryption Test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: AES-GCM Ciphertext Output */}
        <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-5 space-y-4 flex flex-col justify-between`}>
          <div>
            <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.ciphertextTitle}</h2>
              </div>
              <button
                onClick={handleCopyCiphertext}
                className="text-xs text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1 font-semibold"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPayload ? t.copiedJson : t.copyJson}</span>
              </button>
            </div>

            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
              {lang === 'tr' 
                ? 'Veritabanına gönderilen ham veri aşağıdaki gibidir. Doğru PIN olmadan hiçbir insan veya sunucu bu veriyi çözemez:' 
                : 'The raw data sent to the cloud is encrypted below. Without the client PIN, no party can decrypt this payload:'}
            </p>

            {encryptedPayload ? (
              <div className="mt-3 space-y-2">
                <div className={`${isDark ? 'bg-slate-950 border-slate-800 text-emerald-300/90' : 'bg-slate-50 border-slate-200 text-emerald-700'} border rounded-2xl p-3 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1`}>
                  <div><span className="text-slate-400">Algorithm:</span> {encryptedPayload.algorithm}</div>
                  <div><span className="text-slate-400">Salt (16B):</span> {encryptedPayload.salt.slice(0, 18)}...</div>
                  <div><span className="text-slate-400">IV (12B):</span> {encryptedPayload.iv}</div>
                  <div className="break-all pt-1"><span className="text-slate-400">Cipher:</span> {encryptedPayload.cipherText}</div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Timestamp: {encryptedPayload.timestamp}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">...</div>
            )}
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-[11px] text-emerald-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Zero-Knowledge: {lang === 'tr' ? 'Şifreleme anahtarı yalnızca cihazınızın RAM belleğinde üretilir.' : 'Encryption key generated purely in device memory.'}</span>
          </div>
        </div>

        {/* RIGHT: Decryption & Verification Simulator */}
        <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-5 space-y-4 flex flex-col justify-between`}>
          <div>
            <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-[#509BEC]" />
                <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.decryptTitle}</h2>
              </div>
            </div>

            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-2`}>
              {lang === 'tr' 
                ? 'Kullanıcı veya doktor PIN kodunu girdiğinde verilerin istemcide anında çözülmesini test edin:' 
                : 'Test immediate client-side zero-knowledge decryption with secret PIN:'}
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={decryptPinInput}
                onChange={e => setDecryptPinInput(e.target.value)}
                placeholder={t.decryptPinPlaceholder}
                className={`flex-1 ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'} border rounded-xl px-3 py-2 text-xs font-mono tracking-wider focus:outline-none focus:border-[#509BEC]`}
              />
              <button
                onClick={handleRunDecryption}
                className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-98"
              >
                {t.decryptBtn}
              </button>
            </div>

            {/* Error state */}
            {decryptError && (
              <div className="mt-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-2xl flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{decryptError}</span>
              </div>
            )}

            {/* Success Decrypted State */}
            {decryptedResult && (
              <div className={`mt-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.decryptSuccess}</span>
                </div>
                <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'} space-y-1`}>
                  <div><strong>{lang === 'tr' ? 'Hasta' : 'Patient'}:</strong> {decryptedResult.medical?.fullName} ({decryptedResult.medical?.bloodType})</div>
                  <div><strong>{lang === 'tr' ? 'Kronik' : 'Chronic'}:</strong> {decryptedResult.medical?.chronicDiseases?.join(', ') || 'None'}</div>
                  <div><strong>{lang === 'tr' ? 'Alerjiler' : 'Allergies'}:</strong> {decryptedResult.medical?.allergies?.join(', ') || 'None'}</div>
                  <div><strong>{lang === 'tr' ? 'Banka' : 'Bank'}:</strong> {decryptedResult.personal?.bankAccounts?.[0]?.bankName} - {decryptedResult.personal?.bankAccounts?.[0]?.iban}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#14798D]/10 border border-[#14798D]/20 p-3 rounded-2xl text-[11px] text-[#14798D] dark:text-[#509BEC] flex items-center gap-2">
            <FileCode className="w-4 h-4 shrink-0 text-[#509BEC]" />
            <span>Standard: W3C Web Cryptography API (PBKDF2 + AES-GCM 256-bit).</span>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, Key, FileCode, CheckCircle2, 
  AlertCircle, RefreshCw, Copy, Check, Eye, EyeOff 
} from 'lucide-react';
import { SmartCard } from '../types/card';
import { encryptData, decryptData, EncryptedPayload } from '../lib/crypto';

interface CryptoVaultViewProps {
  card: SmartCard;
}

export const CryptoVaultView: React.FC<CryptoVaultViewProps> = ({ card }) => {
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptedPayload, setEncryptedPayload] = useState<EncryptedPayload | null>(null);
  const [decryptedResult, setDecryptedResult] = useState<any | null>(null);
  const [decryptPinInput, setDecryptPinInput] = useState('');
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

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

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 rounded-3xl shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-md">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">İstemci Taraflı Kriptografik Kasa</h1>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  AES-GCM 256-BIT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Sağlık ve finansal verileriniz sunucuya gitmeden önce tarayıcınızda <strong>PBKDF2 (100.000 iterasyon)</strong> ile şifrelenir.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <div className="relative flex-1 sm:w-32">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Gizli PIN"
                className="w-full bg-transparent px-3 py-1.5 text-xs text-white font-mono tracking-widest focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              onClick={handleRunEncryption}
              disabled={isEncrypting || !pin}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEncrypting ? 'animate-spin' : ''}`} />
              <span>Yeniden Şifrele</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Encrypted Payload vs Decryption Test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: AES-GCM Ciphertext Output */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Şifrelenmiş Çıktı (Ciphertext)</h2>
              </div>
              <button
                onClick={handleCopyCiphertext}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
              >
                {copiedPayload ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPayload ? 'Kopyalandı!' : 'JSON Kopyala'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Veritabanına gönderilen ham veri aşağıdaki gibidir. Doğru PIN olmadan hiçbir insan veya sunucu bu veriyi çözemez:
            </p>

            {encryptedPayload ? (
              <div className="mt-3 space-y-2">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-[11px] text-emerald-300/90 max-h-48 overflow-y-auto space-y-1">
                  <div><span className="text-slate-500">Algorithm:</span> {encryptedPayload.algorithm}</div>
                  <div><span className="text-slate-500">Salt (16B):</span> {encryptedPayload.salt.slice(0, 18)}...</div>
                  <div><span className="text-slate-500">IV (12B):</span> {encryptedPayload.iv}</div>
                  <div className="break-all pt-1"><span className="text-slate-500">Cipher:</span> {encryptedPayload.cipherText}</div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Timestamp: {encryptedPayload.timestamp}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">Şifreleniyor...</div>
            )}
          </div>

          <div className="bg-emerald-950/40 border border-emerald-500/20 p-3 rounded-2xl text-[11px] text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Zero-Knowledge: Şifreleme anahtarı yalnızca cihazınızın RAM belleğinde üretilir.</span>
          </div>
        </div>

        {/* RIGHT: Decryption & Verification Simulator */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">Şifre Çözme ve Doğrulama Testi</h2>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-2">
              Kullanıcı veya doktor PIN kodunu girdiğinde verilerin istemcide anında çözülmesini test edin:
            </p>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={decryptPinInput}
                onChange={e => setDecryptPinInput(e.target.value)}
                placeholder="Çözmek için PIN girin"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleRunDecryption}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-98"
              >
                Şifreyi Çöz
              </button>
            </div>

            {/* Error state */}
            {decryptError && (
              <div className="mt-3 bg-rose-950/80 border border-rose-500/40 text-rose-300 p-3 rounded-2xl flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{decryptError} (AES-GCM kimlik doğrulama etiketi eşleşmedi).</span>
              </div>
            )}

            {/* Success Decrypted State */}
            {decryptedResult && (
              <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Şifre Başarıyla Çözüldü!</span>
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div><strong>Hasta:</strong> {decryptedResult.medical?.fullName} ({decryptedResult.medical?.bloodType})</div>
                  <div><strong>Kronik:</strong> {decryptedResult.medical?.chronicDiseases?.join(', ') || 'Yok'}</div>
                  <div><strong>Alerjiler:</strong> {decryptedResult.medical?.allergies?.join(', ') || 'Yok'}</div>
                  <div><strong>Banka:</strong> {decryptedResult.personal?.bankAccounts?.[0]?.bankName} - {decryptedResult.personal?.bankAccounts?.[0]?.iban}</div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-blue-950/40 border border-blue-500/20 p-3 rounded-2xl text-[11px] text-blue-300 flex items-center gap-2">
            <FileCode className="w-4 h-4 shrink-0 text-blue-400" />
            <span>Standard: W3C Web Cryptography API (Donanım seviyesinde güvenli).</span>
          </div>
        </div>
      </div>
    </div>
  );
};

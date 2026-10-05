import React, { useState } from 'react';
import { Wifi, Copy, Check, Info, Smartphone, Cpu } from 'lucide-react';
import { MedicalInfo } from '../types/card';
import { generateNdefTextPayload } from '../lib/nfc';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface NfcPayloadHelperProps {
  medical: MedicalInfo;
  cardId: string;
  lang?: Language;
  theme?: ThemeMode;
}

export const NfcPayloadHelper: React.FC<NfcPayloadHelperProps> = ({ medical, cardId, lang = 'tr', theme = 'dark' }) => {
  const [copied, setCopied] = useState(false);
  const payload = generateNdefTextPayload(medical);
  const byteCount = new Blob([payload]).size;
  const isDark = theme === 'dark';

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-6 space-y-5 shadow-xl max-w-2xl mx-auto transition-colors`}>
      <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#14798D]/20 text-[#509BEC] flex items-center justify-center border border-[#14798D]/30">
            <Wifi className="w-5 h-5 rotate-90" />
          </div>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'İnternetsiz NFC NDEF Metin Şablonu' : 'Offline NFC NDEF Text Template'}
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'tr' ? 'NTAG216 çipine doğrudan yazılacak hayat kurtarma verisi' : 'Life-saving records directly encoded onto NTAG216 chip'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'} block`}>{byteCount} / 888 Byte</span>
          <span className="text-[10px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            NTAG216
          </span>
        </div>
      </div>

      {/* Raw Payload Preview Box */}
      <div className="space-y-2">
        <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span>{lang === 'tr' ? 'Çipe Yazılacak Metin İçeriği:' : 'Payload to Write onto NFC:'}</span>
          <button
            onClick={handleCopy}
            className="text-xs font-semibold text-[#509BEC] hover:text-[#4085d4] flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Metni Kopyala' : 'Copy Text')}</span>
          </button>
        </div>

        <pre className={`${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'} border p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed`}>
          {payload}
        </pre>
      </div>

      {/* Instructions Accordion / Steps */}
      <div className={`${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'} border rounded-2xl p-4 space-y-3`}>
        <h3 className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
          <Smartphone className="w-4 h-4 text-[#509BEC]" />
          {lang === 'tr' ? 'Telefondan Karta Nasıl Yazılır? (3 Adım)' : 'How to Write to Card via Smartphone (3 Steps)'}
        </h3>

        <ol className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} space-y-2 pl-4 list-decimal`}>
          <li>
            {lang === 'tr' ? 'App Store veya Google Play\'den ücretsiz "NFC Tools" uygulamasını indirin.' : 'Download free "NFC Tools" from the App Store or Google Play.'}
          </li>
          <li>
            {lang === 'tr' ? 'Uygulamada "Yaz (Write)" → "Kayıt Ekle (Add a record)" → "Metin (Text)" seçin.' : 'Select "Write" → "Add a record" → "Text" in the application.'}
          </li>
          <li>
            {lang === 'tr' ? 'Yukarıdaki kopyaladığınız metni yapıştırıp kartınızı telefonun arkasına dokundurun!' : 'Paste the copied payload and tap your NFC card to your phone!'}
          </li>
        </ol>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Wifi, Copy, Check, Info, Smartphone, Cpu } from 'lucide-react';
import { MedicalInfo } from '../types/card';
import { generateNdefTextPayload } from '../lib/nfc';

interface NfcPayloadHelperProps {
  medical: MedicalInfo;
  cardId: string;
}

export const NfcPayloadHelper: React.FC<NfcPayloadHelperProps> = ({ medical, cardId }) => {
  const [copied, setCopied] = useState(false);
  const payload = generateNdefTextPayload(medical);
  const byteCount = new Blob([payload]).size;

  const handleCopy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20">
            <Wifi className="w-5 h-5 rotate-90" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">İnternetsiz NFC NDEF Metin Şablonu</h2>
            <p className="text-xs text-slate-400">NTAG216 çipine doğrudan yazılacak hayat kurtarma verisi</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400 block">{byteCount} / 888 Byte</span>
          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">
            NTAG216 Uyumlu
          </span>
        </div>
      </div>

      {/* Raw Payload Preview Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Çipe Yazılacak Metin İçeriği:</span>
          <button
            onClick={handleCopy}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Kopyalandı!' : 'Metni Kopyala'}</span>
          </button>
        </div>

        <pre className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
          {payload}
        </pre>
      </div>

      {/* Instructions Accordion / Steps */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-blue-400" />
          Telefondan Karta Nasıl Yazılır? (3 Adım)
        </h3>

        <ol className="text-xs text-slate-400 space-y-2 pl-4 list-decimal">
          <li>
            App Store veya Google Play'den ücretsiz <strong>"NFC Tools"</strong> uygulamasını indirin.
          </li>
          <li>
            Uygulamada <strong>"Yaz (Write)" &rarr; "Kayıt Ekle (Add a record)" &rarr; "Metin (Text)"</strong> seçin.
          </li>
          <li>
            Yukarıdaki kopyaladığınız metni yapıştırıp kartınızı telefonun arkasına dokundurun!
          </li>
        </ol>
      </div>
    </div>
  );
};

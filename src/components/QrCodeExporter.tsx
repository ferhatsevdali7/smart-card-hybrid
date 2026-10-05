import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, ShieldAlert, CreditCard } from 'lucide-react';
import { SmartCard } from '../types/card';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface QrCodeExporterProps {
  card: SmartCard;
  lang?: Language;
  theme?: ThemeMode;
}

export const QrCodeExporter: React.FC<QrCodeExporterProps> = ({ card, lang = 'tr', theme = 'dark' }) => {
  const sosUrl = `${window.location.origin}?view=sos&id=${card.cardId}`;
  const personalUrl = `${window.location.origin}?view=personal&id=${card.cardId}`;
  const t = translations[lang].print;
  const isDark = theme === 'dark';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-3xl p-6 space-y-6 shadow-xl max-w-2xl mx-auto transition-colors`}>
      <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-4`}>
        <div>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
            <Printer className="w-5 h-5 text-[#509BEC]" />
            {t.qrTitle}
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
            {t.qrDesc}
          </p>
        </div>

        <button
          onClick={handlePrint}
          className={`${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'} text-xs font-semibold py-2 px-3 rounded-xl border flex items-center gap-1.5 transition-all`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{lang === 'tr' ? 'Yazdır / PDF' : 'Print / PDF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FRONT QR: HEALTH */}
        <div className={`${isDark ? 'bg-slate-950 border-[#14798D]/40' : 'bg-slate-50 border-[#14798D]/30'} border-2 rounded-2xl p-5 text-center space-y-3`}>
          <div className="flex items-center justify-center gap-1.5 text-[#14798D] dark:text-[#509BEC] font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>{lang === 'tr' ? 'Ön Yüz: Medikal SOS QR' : 'Front: Medical SOS QR'}</span>
          </div>

          <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto border border-slate-200">
            <QRCodeSVG id="qr-sos" value={sosUrl} size={150} level="H" includeMargin />
          </div>

          <div className="space-y-1">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.medical.fullName}</div>
            <div className="text-[11px] font-mono text-[#14798D] dark:text-[#D1C8B9]">{translations[lang].sos.bloodType}: {card.medical.bloodType}</div>
            <div className="text-[10px] text-slate-400 font-mono break-all pt-1">
              {sosUrl}
            </div>
          </div>
        </div>

        {/* BACK QR: PERSONAL */}
        <div className={`${isDark ? 'bg-slate-950 border-[#509BEC]/40' : 'bg-slate-50 border-[#509BEC]/30'} border-2 rounded-2xl p-5 text-center space-y-3`}>
          <div className="flex items-center justify-center gap-1.5 text-[#509BEC] font-bold text-xs uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>{lang === 'tr' ? 'Arka Yüz: Kişisel / IBAN QR' : 'Back: Personal / IBAN QR'}</span>
          </div>

          <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto border border-slate-200">
            <QRCodeSVG id="qr-personal" value={personalUrl} size={150} level="H" includeMargin />
          </div>

          <div className="space-y-1">
            <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{card.personal.fullName}</div>
            <div className="text-[11px] font-mono text-[#509BEC]">ID: {card.cardId}</div>
            <div className="text-[10px] text-slate-400 font-mono break-all pt-1">
              {personalUrl}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#14798D]/10 border border-[#14798D]/20 rounded-2xl p-4 text-xs text-[#14798D] dark:text-[#D1C8B9] leading-relaxed space-y-1.5">
        <div className="font-bold text-[#14798D] dark:text-[#509BEC]">🖨️ {lang === 'tr' ? 'Matbaa Baskı Notu:' : 'Printing Guide:'}</div>
        <div>
          {lang === 'tr'
            ? 'Karekodlar vektörel (SVG) formatında olup CR-80 (85.6mm x 53.98mm) PVC kart üzerine en az 15mm x 15mm boyutunda basılmalıdır.'
            : 'QR codes are scalable SVG vectors. For standard CR-80 PVC cards, print at minimum 15mm x 15mm size.'}
        </div>
      </div>
    </div>
  );
};

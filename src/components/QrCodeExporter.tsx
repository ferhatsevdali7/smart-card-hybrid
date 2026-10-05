import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, ShieldAlert, CreditCard } from 'lucide-react';
import { SmartCard } from '../types/card';

interface QrCodeExporterProps {
  card: SmartCard;
}

export const QrCodeExporter: React.FC<QrCodeExporterProps> = ({ card }) => {
  const sosUrl = `${window.location.origin}?view=sos&id=${card.cardId}`;
  const personalUrl = `${window.location.origin}?view=personal&id=${card.cardId}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl max-w-2xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-400" />
            Fiziksel Kart Baskı ve QR Kod Çıktıları
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Matbaaya / PVC baskı merkezine iletilecek yüksek çözünürlüklü dinamik karekodlar.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-3 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Yazdır / PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FRONT QR: HEALTH */}
        <div className="bg-slate-950 border-2 border-red-500/40 rounded-2xl p-5 text-center space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-red-400 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Ön Yüz: Acil Sağlık QR</span>
          </div>

          <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
            <QRCodeSVG id="qr-sos" value={sosUrl} size={150} level="H" includeMargin />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-white">{card.medical.fullName}</div>
            <div className="text-[11px] font-mono text-red-300">Kan Grubu: {card.medical.bloodType}</div>
            <div className="text-[10px] text-slate-500 font-mono break-all pt-1">
              Hedef: {sosUrl}
            </div>
          </div>
        </div>

        {/* BACK QR: PERSONAL */}
        <div className="bg-slate-950 border-2 border-blue-500/40 rounded-2xl p-5 text-center space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <CreditCard className="w-4 h-4" />
            <span>Arka Yüz: Kişisel / IBAN QR</span>
          </div>

          <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
            <QRCodeSVG id="qr-personal" value={personalUrl} size={150} level="H" includeMargin />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-bold text-white">{card.personal.fullName}</div>
            <div className="text-[11px] font-mono text-blue-300">Kart ID: {card.cardId}</div>
            <div className="text-[10px] text-slate-500 font-mono break-all pt-1">
              Hedef: {personalUrl}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 text-xs text-blue-200 leading-relaxed space-y-1.5">
        <div className="font-bold text-blue-300">🖨️ Matbaa Baskı Notu:</div>
        <div>
          Karekodlar vektörel (SVG) formatında olup CR-80 (85.6mm x 53.98mm) PVC kart üzerine en az <strong>15mm x 15mm</strong> boyutunda basılmalıdır.
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RotateCw, ShieldCheck, CreditCard, Wifi, Heart, User, CheckCircle2 } from 'lucide-react';
import { SmartCard } from '../types/card';

interface CardPreview3DProps {
  card: SmartCard;
  onOpenSOS?: () => void;
  onOpenPersonal?: () => void;
}

export const CardPreview3D: React.FC<CardPreview3DProps> = ({ card, onOpenSOS, onOpenPersonal }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const sosUrl = `${window.location.origin}?view=sos&id=${card.cardId}`;
  const personalUrl = `${window.location.origin}?view=personal&id=${card.cardId}`;

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-6">
      {/* 3D Card Container */}
      <div 
        className="w-full max-w-[380px] h-[230px] perspective-1000 cursor-pointer select-none group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div 
          className={`relative w-full h-full duration-700 transform-style-3d transition-transform rounded-3xl shadow-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT FACE: SAĞLIK & ACİL DURUM (SERENE DEEP TEAL & LINEN) */}
          <div className="absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-br from-[#14798D] via-[#0E6476] to-slate-950 p-4 text-white border-2 border-[#509BEC]/40 shadow-xl backface-hidden flex flex-col justify-between overflow-hidden">
            {/* Background Texture & Glow */}
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-[#509BEC]/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Top Bar */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5 font-black text-xs tracking-wider uppercase text-white">
                <div className="bg-white/20 text-[#D1C8B9] p-1 rounded-full backdrop-blur-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>ACİL SAĞLIK KARTI</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-[#D1C8B9] bg-black/30 px-2 py-0.5 rounded border border-[#509BEC]/30 font-bold">
                  ÖN YÜZ
                </span>
                <Wifi className="w-4 h-4 text-[#D1C8B9] rotate-90" />
              </div>
            </div>

            {/* Middle Content */}
            <div className="flex items-center justify-between gap-3 relative z-10 my-auto">
              <div className="flex items-center gap-3">
                {card.medical.avatarUrl ? (
                  <img 
                    src={card.medical.avatarUrl} 
                    alt="Fotoğraf" 
                    className="w-13 h-13 rounded-2xl object-cover border-2 border-[#509BEC] shadow-md"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-black/30 border border-[#509BEC]/40 flex items-center justify-center text-[#D1C8B9]">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-white leading-tight">{card.medical.fullName}</div>
                  <div className="text-[10px] text-[#D1C8B9] mt-0.5">
                    D. Yılı: {card.medical.birthYear} ({new Date().getFullYear() - card.medical.birthYear} Yaş)
                  </div>
                  <div className="text-[10px] text-[#D1C8B9] font-mono mt-0.5 font-semibold">
                    ICE: {card.medical.emergencyContacts[0]?.phone || 'Belirtilmedi'}
                  </div>
                </div>
              </div>

              {/* QR Code & Blood Type */}
              <div className="flex items-center gap-2 bg-white/95 p-1.5 rounded-2xl shadow-lg border border-[#D1C8B9]">
                <QRCodeSVG value={sosUrl} size={54} level="M" />
                <div className="text-center px-1">
                  <div className="text-[7px] font-bold text-slate-500 uppercase">KAN</div>
                  <div className="text-base font-black text-[#14798D] leading-tight">{card.medical.bloodType}</div>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between text-[9px] text-[#D1C8B9] border-t border-white/15 pt-1.5 relative z-10 font-medium">
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-[#509BEC] fill-[#509BEC]" />
                <span>İnternetsiz NDEF &amp; QR Destekli</span>
              </div>
              <div className="font-mono font-bold text-white tracking-widest">{card.cardId}</div>
            </div>
          </div>

          {/* BACK FACE: KİŞİSEL & GÜNLÜK KARTVİZİT (DARK / CYBER SLEEK) */}
          <div className="absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 text-white border-2 border-slate-700 shadow-xl backface-hidden rotate-y-180 flex flex-col justify-between overflow-hidden">
            {/* Subtle Metallic Line */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#14798D] via-[#509BEC] to-[#D1C8B9]"></div>

            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <div className="w-5 h-5 rounded-md bg-[#509BEC]/20 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30">
                  <CreditCard className="w-3 h-3" />
                </div>
                <span>DİJİTAL KARTVİZİT &amp; IBAN</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  ARKA YÜZ
                </span>
                <Wifi className="w-4 h-4 text-[#509BEC] rotate-90" />
              </div>
            </div>

            {/* Middle Content */}
            <div className="flex items-center justify-between gap-3 my-auto">
              <div>
                <div className="font-extrabold text-sm text-white">{card.personal.fullName}</div>
                {card.personal.title && (
                  <div className="text-[11px] font-medium text-[#509BEC]">{card.personal.title}</div>
                )}
                <div className="text-[10px] text-[#D1C8B9] font-mono mt-1">
                  {card.personal.bankAccounts[0]?.bankName || 'Banka'}: {card.personal.bankAccounts[0]?.iban.slice(0, 14)}...
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white p-1.5 rounded-2xl shadow-lg border border-slate-700">
                <QRCodeSVG value={personalUrl} size={54} level="M" />
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800 pt-1.5">
              <div className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>60 Sn Süreli Güvenli Giriş</span>
              </div>
              <div className="font-mono font-bold text-[#D1C8B9] tracking-wider">PIN KORUMALI</div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-md">
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 border border-slate-700 transition-all active:scale-98 shadow-md"
        >
          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
          <span>{isFlipped ? 'Ön Yüze Çevir (Sağlık)' : 'Arka Yüze Çevir (Kişisel)'}</span>
        </button>

        {onOpenSOS && (
          <button
            onClick={onOpenSOS}
            className="bg-[#14798D]/20 hover:bg-[#14798D] text-[#D1C8B9] hover:text-white border border-[#14798D]/40 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all"
          >
            🛡️ Ön Yüzü Aç (SOS)
          </button>
        )}

        {onOpenPersonal && (
          <button
            onClick={onOpenPersonal}
            className="bg-[#509BEC]/20 hover:bg-[#509BEC] text-[#509BEC] hover:text-white border border-[#509BEC]/40 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all"
          >
            🔒 Arka Yüzü Aç (Kişisel)
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        💡 Karta dokunarak veya "Kartı Çevir" butonuna basarak ön/arka yüzü inceleyebilirsiniz.
      </p>
    </div>
  );
};

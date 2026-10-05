import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RotateCw, ShieldAlert, CreditCard, Wifi, Heart, User, CheckCircle2 } from 'lucide-react';
import { SmartCard } from '../types/card';

interface CardPreview3DProps {
  card: SmartCard;
  onOpenSOS?: () => void;
  onOpenPersonal?: () => void;
}

export const CardPreview3D: React.FC<CardPreview3DProps> = ({ card, onOpenSOS, onOpenPersonal }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // In a real deployed app, this would be the actual domain URL
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
          className={`relative w-full h-full duration-700 transform-style-3d transition-transform rounded-2xl shadow-2xl ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* FRONT FACE: SAĞLIK & ACİL DURUM (RED / MEDICAL) */}
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-red-700 via-rose-900 to-slate-950 p-4 text-white border-2 border-red-500/40 shadow-xl backface-hidden flex flex-col justify-between overflow-hidden">
            {/* Background Texture & Glow */}
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-red-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-rose-600/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Top Bar */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5 font-black text-xs tracking-wider uppercase text-red-200">
                <div className="bg-white text-red-700 p-1 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <span>ACİL SAĞLIK KARTI</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-red-200 bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                  ÖN YÜZ
                </span>
                <Wifi className="w-4 h-4 text-red-300 rotate-90" />
              </div>
            </div>

            {/* Middle Content */}
            <div className="flex items-center justify-between gap-3 relative z-10 my-auto">
              <div className="flex items-center gap-3">
                {card.medical.avatarUrl ? (
                  <img 
                    src={card.medical.avatarUrl} 
                    alt="Fotoğraf" 
                    className="w-13 h-13 rounded-xl object-cover border-2 border-red-400/50 shadow-md"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-xl bg-red-950/60 border border-red-400/40 flex items-center justify-center text-red-300">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-white leading-tight">{card.medical.fullName}</div>
                  <div className="text-[10px] text-red-200 mt-0.5">
                    D. Yılı: {card.medical.birthYear} ({new Date().getFullYear() - card.medical.birthYear} Yaş)
                  </div>
                  <div className="text-[10px] text-red-300 font-mono mt-0.5">
                    ICE: {card.medical.emergencyContacts[0]?.phone || 'Belirtilmedi'}
                  </div>
                </div>
              </div>

              {/* QR Code & Blood Type */}
              <div className="flex items-center gap-2 bg-white/95 p-1.5 rounded-xl shadow-lg border border-red-300">
                <QRCodeSVG value={sosUrl} size={54} level="M" />
                <div className="text-center px-1">
                  <div className="text-[7px] font-bold text-slate-500 uppercase">KAN</div>
                  <div className="text-base font-black text-red-700 leading-tight">{card.medical.bloodType}</div>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between text-[9px] text-red-200 border-t border-red-500/30 pt-1.5 relative z-10">
              <div className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400 fill-red-400" />
                <span>İnternetsiz NDEF &amp; QR Destekli</span>
              </div>
              <div className="font-mono font-bold text-white tracking-widest">{card.cardId}</div>
            </div>
          </div>

          {/* BACK FACE: KİŞİSEL & GÜNLÜK KARTVİZİT (DARK / CYBER SLEEK) */}
          <div className="absolute inset-0 w-full h-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 text-white border-2 border-slate-700 shadow-xl backface-hidden rotate-y-180 flex flex-col justify-between overflow-hidden">
            {/* Subtle Metallic Line */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400"></div>

            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <div className="w-5 h-5 rounded-md bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <CreditCard className="w-3 h-3" />
                </div>
                <span>DİJİTAL KARTVİZİT &amp; IBAN</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  ARKA YÜZ
                </span>
                <Wifi className="w-4 h-4 text-blue-400 rotate-90" />
              </div>
            </div>

            {/* Middle Content */}
            <div className="flex items-center justify-between gap-3 my-auto">
              <div>
                <div className="font-extrabold text-sm text-white">{card.personal.fullName}</div>
                {card.personal.title && (
                  <div className="text-[11px] font-medium text-blue-400">{card.personal.title}</div>
                )}
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  {card.personal.bankAccounts[0]?.bankName || 'Banka'}: {card.personal.bankAccounts[0]?.iban.slice(0, 14)}...
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white p-1.5 rounded-xl shadow-lg border border-slate-700">
                <QRCodeSVG value={personalUrl} size={54} level="M" />
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800 pt-1.5">
              <div className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>60 Sn Süreli Güvenli Giriş</span>
              </div>
              <div className="font-mono font-bold text-slate-300 tracking-wider">PIN KORUMALI</div>
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
            className="bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all"
          >
            🚨 Ön Yüzü Aç (SOS)
          </button>
        )}

        {onOpenPersonal && (
          <button
            onClick={onOpenPersonal}
            className="bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all"
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

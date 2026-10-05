import React, { useState } from 'react';
import { Smartphone, Wifi, ShieldAlert, CreditCard, Sparkles } from 'lucide-react';
import { SmartCard } from '../types/card';
import { ThreeDCardCanvas } from './ThreeDCardCanvas';

interface CardSimulatorViewProps {
  card: SmartCard;
  onOpenSOS: () => void;
  onOpenPersonal: () => void;
}

export const CardSimulatorView: React.FC<CardSimulatorViewProps> = ({ card, onOpenSOS, onOpenPersonal }) => {
  const [scanSide, setScanSide] = useState<'front' | 'back'>('front');
  const [isScanning, setIsScanning] = useState(false);

  const simulateScan = (side: 'front' | 'back') => {
    setIsScanning(true);
    setScanSide(side);
    setTimeout(() => {
      setIsScanning(false);
      if (side === 'front') {
        onOpenSOS();
      } else {
        onOpenPersonal();
      }
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Three.js / WebGL Donanım Hızlandırmalı 3D Kart</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">3D Kart ve Test Laboratuvarı</h1>
        <p className="text-xs text-slate-400">
          Gerçekçi ışık yansımalı 3D kartı fare ile hareket ettirin, telefonun NFC ile okutulmasını simüle edin.
        </p>
      </div>

      {/* Three.js 3D WebGL Canvas Component */}
      <ThreeDCardCanvas 
        card={card} 
        onOpenSOS={onOpenSOS} 
        onOpenPersonal={onOpenPersonal} 
      />

      {/* Simulator Device Dock */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg mx-auto space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Akıllı Telefon NFC / QR Simülatörü</h2>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
            iOS / Android
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => simulateScan('front')}
            disabled={isScanning}
            className="bg-gradient-to-br from-red-950/80 to-slate-900 hover:from-red-900/90 border border-red-500/40 p-4 rounded-2xl text-left space-y-2 transition-all active:scale-98 group disabled:opacity-50 shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <Wifi className="w-4 h-4 text-red-400 rotate-90 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Ön Yüzü Okut (NFC/QR)</div>
              <div className="text-[10px] text-red-300 mt-0.5">Acil Durum Medikal SOS</div>
            </div>
          </button>

          <button
            onClick={() => simulateScan('back')}
            disabled={isScanning}
            className="bg-gradient-to-br from-blue-950/80 to-slate-900 hover:from-blue-900/90 border border-blue-500/40 p-4 rounded-2xl text-left space-y-2 transition-all active:scale-98 group disabled:opacity-50 shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <Wifi className="w-4 h-4 text-blue-400 rotate-90 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Arka Yüzü Okut (NFC/QR)</div>
              <div className="text-[10px] text-blue-300 mt-0.5">Güvenli IBAN &amp; Kartvizit</div>
            </div>
          </button>
        </div>

        {isScanning && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center space-y-2 animate-pulse">
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-400">
              <Wifi className="w-4 h-4 animate-spin" />
              <span>NFC Çipi Algılandı... Yönlendiriliyor</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {scanSide === 'front' ? '🚨 Acil Sağlık Profili Yükleniyor' : '🔒 Güvenli Kişisel Profil Yükleniyor'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

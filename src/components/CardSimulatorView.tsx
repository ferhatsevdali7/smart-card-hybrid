import React, { useState } from 'react';
import { Smartphone, Wifi, ShieldAlert, CreditCard, Sparkles } from 'lucide-react';
import { SmartCard } from '../types/card';
import { ThreeDCardCanvas } from './ThreeDCardCanvas';
import { Language, ThemeMode, translations } from '../lib/i18n';

interface CardSimulatorViewProps {
  card: SmartCard;
  onOpenSOS: () => void;
  onOpenPersonal: () => void;
  lang?: Language;
  theme?: ThemeMode;
}

export const CardSimulatorView: React.FC<CardSimulatorViewProps> = ({ 
  card, 
  onOpenSOS, 
  onOpenPersonal,
  lang = 'tr',
  theme = 'dark'
}) => {
  const [scanSide, setScanSide] = useState<'front' | 'back'>('front');
  const [isScanning, setIsScanning] = useState(false);

  const t = translations[lang].simulator;
  const isDark = theme === 'dark';

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
        <div className={`inline-flex items-center gap-1.5 ${isDark ? 'bg-[#14798D]/20 text-[#509BEC] border-[#14798D]/40' : 'bg-[#14798D]/10 text-[#14798D] border-[#14798D]/30'} border px-3 py-1 rounded-full text-xs font-semibold`}>
          <Sparkles className="w-3.5 h-3.5 text-[#509BEC]" />
          <span>{t.badge}</span>
        </div>
        <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>{t.title}</h1>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t.desc}
        </p>
      </div>

      {/* Three.js 3D WebGL Canvas Component */}
      <ThreeDCardCanvas 
        card={card} 
        onOpenSOS={onOpenSOS} 
        onOpenPersonal={onOpenPersonal} 
      />

      {/* Simulator Device Dock */}
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl'} border rounded-3xl p-6 shadow-2xl max-w-lg mx-auto space-y-5 transition-colors`}>
        <div className={`flex items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-200'} pb-3`}>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#14798D] dark:text-[#509BEC]" />
            <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.dockTitle}</h2>
          </div>
          <span className={`text-[10px] ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'} px-2 py-0.5 rounded font-mono`}>
            iOS / Android
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => simulateScan('front')}
            disabled={isScanning}
            className={`bg-gradient-to-br ${isDark ? 'from-[#14798D]/30 via-slate-900 to-slate-950 hover:from-[#14798D]/50 border-[#14798D]/50' : 'from-[#14798D]/10 via-slate-50 to-white hover:from-[#14798D]/20 border-[#14798D]/30 shadow-sm'} border p-4 rounded-2xl text-left space-y-2 transition-all active:scale-98 group disabled:opacity-50 shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#14798D] text-white flex items-center justify-center shadow-sm">
                <ShieldAlert className="w-4 h-4 text-[#D1C8B9]" />
              </div>
              <Wifi className="w-4 h-4 text-[#509BEC] rotate-90 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.scanFrontTitle}</div>
              <div className="text-[10px] text-[#14798D] dark:text-[#D1C8B9] mt-0.5">{t.scanFrontSubtitle}</div>
            </div>
          </button>

          <button
            onClick={() => simulateScan('back')}
            disabled={isScanning}
            className={`bg-gradient-to-br ${isDark ? 'from-[#509BEC]/20 via-slate-900 to-slate-950 hover:from-[#509BEC]/30 border-[#509BEC]/40' : 'from-[#509BEC]/10 via-slate-50 to-white hover:from-[#509BEC]/20 border-[#509BEC]/30 shadow-sm'} border p-4 rounded-2xl text-left space-y-2 transition-all active:scale-98 group disabled:opacity-50 shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#509BEC] text-white flex items-center justify-center shadow-sm">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <Wifi className="w-4 h-4 text-[#509BEC] rotate-90 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.scanBackTitle}</div>
              <div className="text-[10px] text-[#509BEC] mt-0.5">{t.scanBackSubtitle}</div>
            </div>
          </button>
        </div>

        {isScanning && (
          <div className={`${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} border p-4 rounded-2xl text-center space-y-2 animate-pulse`}>
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#509BEC]">
              <Wifi className="w-4 h-4 animate-spin" />
              <span>{t.scanningNfc}</span>
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {scanSide === 'front' ? '🛡️ ' + t.scanFrontSubtitle : '🔒 ' + t.scanBackSubtitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { 
  ShieldAlert, CreditCard, KeyRound, Smartphone, 
  ArrowRight, Sparkles, LogIn, UserPlus 
} from 'lucide-react';
import { Language, ThemeMode } from '../lib/i18n';
import { ThreeDCardCanvas } from './ThreeDCardCanvas';
import { SmartCard } from '../types/card';

interface LandingHeroProps {
  card: SmartCard;
  lang?: Language;
  theme?: ThemeMode;
  onOpenAuth: () => void;
  onOpenSimulator: () => void;
  onOpenDemoSOS: () => void;
  onOpenDemoPersonal: () => void;
}

export const LandingHeroView: React.FC<LandingHeroProps> = ({
  card,
  lang = 'tr',
  theme = 'dark',
  onOpenAuth,
  onOpenSimulator,
  onOpenDemoSOS,
  onOpenDemoPersonal
}) => {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-16 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-12 px-4">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#14798D]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-[#509BEC]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-[#14798D]/10 border-[#14798D]/30 text-[#14798D] dark:text-[#509BEC] text-xs font-bold tracking-wide shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'tr' ? "Yeni Nesil 2'si 1 Arada Hibrit Akıllı Kart" : 'Next-Gen 2-in-1 Hybrid Smart Card'}</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            {lang === 'tr' ? (
              <>
                Hayat Kurtaran <span className="bg-gradient-to-r from-[#14798D] via-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Medikal Kimlik</span> &amp; Güvenli <span className="bg-gradient-to-r from-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Kartvizit</span>
              </>
            ) : (
              <>
                Life-Saving <span className="bg-gradient-to-r from-[#14798D] via-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Medical ID</span> &amp; Secure <span className="bg-gradient-to-r from-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Smart Card</span>
              </>
            )}
          </h1>

          {/* Subheadline */}
          <p className={`text-sm sm:text-base ${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-2xl mx-auto leading-relaxed`}>
            {lang === 'tr'
              ? 'Fiziksel NFC çipi ve dinamik QR teknolojisiyle donatılmış; ön yüzünde acil durum sağlık verileri, arka yüzünde süreli güvenli kartvizit ve sıfır bilgi istemci şifreleme sunan profesyonel akıllı kart platformu.'
              : 'Equipped with physical NFC chip and dynamic QR technology; featuring emergency medical SOS on the front, timed secure business card on the back, and zero-knowledge client encryption.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={onOpenAuth}
              className="bg-gradient-to-r from-[#14798D] to-[#509BEC] hover:from-[#0E6476] hover:to-[#4085d4] text-white text-sm font-bold py-3.5 px-7 rounded-2xl flex items-center gap-2 shadow-xl shadow-[#14798D]/25 active:scale-98 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>{lang === 'tr' ? 'Kendi Kartını Şimdi Oluştur' : 'Create Your Smart Card'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSimulator}
              className={`${isDark ? 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-white' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'} border text-sm font-bold py-3.5 px-6 rounded-2xl flex items-center gap-2 transition-all shadow-md active:scale-98`}
            >
              <Smartphone className="w-4 h-4 text-[#509BEC]" />
              <span>{lang === 'tr' ? '3D Simülatörde Canlı Dene' : 'Try 3D Simulator'}</span>
            </button>
          </div>

          {/* Demo Previews Pills */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium mr-1`}>
              {lang === 'tr' ? 'Örnek Okutma Profilleri:' : 'Sample Profiles:'}
            </span>
            <button
              onClick={onOpenDemoSOS}
              className="bg-[#14798D]/15 hover:bg-[#14798D]/25 text-[#14798D] dark:text-[#509BEC] border border-[#14798D]/30 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'Örnek Medikal SOS Profili' : 'Sample Medical SOS'}</span>
            </button>
            <button
              onClick={onOpenDemoPersonal}
              className="bg-[#509BEC]/15 hover:bg-[#509BEC]/25 text-[#509BEC] border border-[#509BEC]/30 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'Örnek Kartvizit / IBAN Profili' : 'Sample Business Card'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3D Interactive Card Showcase Container */}
      <section className="max-w-4xl mx-auto px-4">
        <div className={`${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/90 border-slate-200 shadow-xl'} border rounded-3xl p-6 sm:p-8 backdrop-blur-md`}>
          <div className="text-center space-y-1 mb-6">
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? '3 Boyutlu Donanım Hızlandırmalı Kart Deneyimi' : '3D Hardware-Accelerated Card Experience'}
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {lang === 'tr' ? 'Farenizi hareket ettirerek ışığı yansıtın • Karta tıklayarak ön ve arka yüz arasında çevirin' : 'Move mouse to reflect lighting • Click card to flip between front and back'}
            </p>
          </div>

          <ThreeDCardCanvas 
            card={card} 
            onOpenSOS={onOpenDemoSOS} 
            onOpenPersonal={onOpenDemoPersonal} 
          />
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {lang === 'tr' ? 'Neden Hibrit Akıllı Kart?' : 'Why Hybrid Smart Card?'}
          </h2>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} max-w-xl mx-auto`}>
            {lang === 'tr' ? 'Tek bir fiziksel kartla hem hayati güvenliğinizi hem de profesyonel dijital varlığınızı kusursuzca yönetin.' : 'Manage both your life-saving safety and professional digital identity seamlessly.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-[#14798D]/50' : 'bg-white border-slate-200 shadow-md hover:border-[#14798D]/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-[#14798D]/20 text-[#14798D] dark:text-[#509BEC] flex items-center justify-center border border-[#14798D]/30 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Ön Yüz: Hayat Kurtaran Medikal SOS' : 'Front: Life-Saving Medical SOS'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'Kan grubu, kritik alerjiler, acil durum ICE yakınları ve ilaçlar kaza anında ambulans ekipleri için tek dokunuşla hazır.'
                : 'Blood type, critical allergies, emergency ICE contacts and medication accessible in one tap for first responders.'}
            </p>
          </div>

          {/* Feature 2 */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-[#509BEC]/50' : 'bg-white border-slate-200 shadow-md hover:border-[#509BEC]/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-[#509BEC]/20 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30 group-hover:scale-105 transition-transform">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Arka Yüz: Süreli Güvenli Kartvizit' : 'Back: Timed Secure Business Card'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'IBAN ve iletişim bilgileri 60 saniyelik zaman aşımı koruması ve 30 saniyelik otomatik pano temizleme ile güvende.'
                : 'IBANs and business contacts protected by 60s session expiration and 30s automated clipboard wipe.'}
            </p>
          </div>

          {/* Feature 3 */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-emerald-500/50' : 'bg-white border-slate-200 shadow-md hover:border-emerald-500/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 group-hover:scale-105 transition-transform">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Sıfır Bilgi Kriptografik Kasa (AES-GCM)' : 'Zero-Knowledge Crypto Vault'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'Hassas verileriniz tarayıcınızda PBKDF2 (100.000 iterasyon) ile şifrelenir; PIN kodunuz sunucuya asla gitmez.'
                : 'Sensitive notes encrypted locally in your browser with PBKDF2 + AES-GCM 256-bit; secret PIN never leaves your device.'}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-r from-[#14798D] via-[#0E6476] to-[#509BEC] text-white rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-center space-y-4">
          <div className="relative z-10 max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {lang === 'tr' ? 'Kendi Akıllı Kartınızı Yönetmeye Başlayın' : 'Start Managing Your Smart Card Today'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
              {lang === 'tr'
                ? 'Google veya e-postanızla saniyeler içinde giriş yapın, sağlık ve kartvizit bilgilerinizi anında canlıya alın.'
                : 'Sign in with Google or Email in seconds, publish your medical SOS and digital cardvizit instantly.'}
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenAuth}
                className="bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold py-3.5 px-8 rounded-2xl inline-flex items-center gap-2 shadow-xl active:scale-98 transition-all"
              >
                <LogIn className="w-4 h-4 text-[#14798D]" />
                <span>{lang === 'tr' ? 'Ücretsiz Başla / Giriş Yap' : 'Get Started / Sign In'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};


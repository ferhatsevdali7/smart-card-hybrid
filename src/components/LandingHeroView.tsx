import React from 'react';
import { 
  ShieldAlert, CreditCard, KeyRound, 
  ArrowRight, Sparkles, LogIn, UserPlus, CarFront
} from 'lucide-react';
import { Language, ThemeMode } from '../lib/i18n';
import { SmartCard } from '../types/card';

interface LandingHeroProps {
  card: SmartCard;
  lang?: Language;
  theme?: ThemeMode;
  onOpenAuth: () => void;
  onOpenDemoSOS: () => void;
  onOpenDemoPersonal: () => void;
}

export const LandingHeroView: React.FC<LandingHeroProps> = ({
  lang = 'tr',
  theme = 'dark',
  onOpenAuth,
  onOpenDemoSOS,
  onOpenDemoPersonal
}) => {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-16 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-14 px-4">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#14798D]/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/3 right-10 w-72 h-72 bg-[#509BEC]/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-[#14798D]/10 border-[#14798D]/30 text-[#14798D] dark:text-[#509BEC] text-xs font-bold tracking-wide shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>{lang === 'tr' ? "Yeni Nesil Hibrit Akıllı Kart Ekosistemi" : 'Next-Gen Hybrid Smart Card Ecosystem'}</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto">
            {lang === 'tr' ? (
              <>
                Hayat Kurtaran <span className="bg-gradient-to-r from-[#14798D] via-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Sağlık Kartı</span>, <span className="bg-gradient-to-r from-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Sosyal Kart</span> &amp; <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Araç Kartı</span>
              </>
            ) : (
              <>
                Life-Saving <span className="bg-gradient-to-r from-[#14798D] via-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Health Card</span>, <span className="bg-gradient-to-r from-[#509BEC] to-[#D1C8B9] bg-clip-text text-transparent">Social Card</span> &amp; <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Vehicle Card</span>
              </>
            )}
          </h1>

          {/* Subheadline */}
          <p className={`text-sm sm:text-base ${isDark ? 'text-slate-300' : 'text-slate-600'} max-w-2xl mx-auto leading-relaxed`}>
            {lang === 'tr'
              ? 'Fiziksel NFC çipi ve dinamik QR teknolojisiyle donatılmış; acil durum sağlık verileri, süreli güvenli sosyal kartvizit, araç bildirim sistemi ve sıfır bilgi şifreli kasa sunan profesyonel akıllı kart platformu.'
              : 'Equipped with physical NFC chip and dynamic QR technology; featuring emergency health records, timed secure social business card, vehicle notification system and zero-knowledge crypto vault.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={onOpenAuth}
              className="bg-gradient-to-r from-[#14798D] to-[#509BEC] hover:from-[#0E6476] hover:to-[#4085d4] text-white text-sm font-bold py-3.5 px-8 rounded-2xl flex items-center gap-2 shadow-xl shadow-[#14798D]/25 active:scale-98 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>{lang === 'tr' ? 'Kendi Kartını Şimdi Oluştur' : 'Create Your Smart Card'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Demo Previews Pills */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium mr-1`}>
              {lang === 'tr' ? 'Örnek Kart Görünümleri:' : 'Sample Card Views:'}
            </span>
            <button
              onClick={onOpenDemoSOS}
              className="bg-[#14798D]/15 hover:bg-[#14798D]/25 text-[#14798D] dark:text-[#509BEC] border border-[#14798D]/30 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'Örnek Sağlık Kartı' : 'Sample Health Card'}</span>
            </button>
            <button
              onClick={onOpenDemoPersonal}
              className="bg-[#509BEC]/15 hover:bg-[#509BEC]/25 text-[#509BEC] border border-[#509BEC]/30 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'Örnek Sosyal Kart' : 'Sample Social Card'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-5xl mx-auto px-4 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {lang === 'tr' ? 'Kart Ekosistemi Çözümleri' : 'Smart Card Ecosystem Solutions'}
          </h2>
          <p className={`text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'} max-w-xl mx-auto`}>
            {lang === 'tr' ? 'Tek bir akıllı kartla hem hayati güvenliğinizi, hem profesyonel sosyal ağınızı hem de araç güvenliğinizi yönetin.' : 'Manage your health safety, professional social identity and vehicle security with one smart card.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Feature 1 - Sağlık Kartı */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-[#14798D]/50' : 'bg-white border-slate-200 shadow-md hover:border-[#14798D]/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-[#14798D]/20 text-[#14798D] dark:text-[#509BEC] flex items-center justify-center border border-[#14798D]/30 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Sağlık Kartı (Medikal ID)' : 'Health Card (Medical ID)'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'Kan grubu, kritik alerjiler, acil durum ICE yakınları ve kronik ilaç bilgileri kaza anında ilk yardım ekipleri için hazır.'
                : 'Blood type, critical allergies, emergency ICE contacts and medication accessible for first responders.'}
            </p>
          </div>

          {/* Feature 2 - Sosyal Kart */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-[#509BEC]/50' : 'bg-white border-slate-200 shadow-md hover:border-[#509BEC]/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-[#509BEC]/20 text-[#509BEC] flex items-center justify-center border border-[#509BEC]/30 group-hover:scale-105 transition-transform">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Sosyal Kart (Dijital Kartvizit)' : 'Social Card (Digital Card)'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'IBAN, telefon, sosyal medya hesapları ve iletişim bilgileri 30 saniyelik otomatik pano temizleme güvenliği ile paylaşılır.'
                : 'IBANs, social media links and contacts protected with automated clipboard wipe security.'}
            </p>
          </div>

          {/* Feature 3 - Araç Kartı & Kasa */}
          <div className={`${isDark ? 'bg-slate-900/70 border-slate-800 hover:border-amber-500/50' : 'bg-white border-slate-200 shadow-md hover:border-amber-500/40'} border rounded-3xl p-6 space-y-3 transition-all group`}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 group-hover:scale-105 transition-transform">
              <CarFront className="w-6 h-6" />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {lang === 'tr' ? 'Araç Kartı & Güvenli Kasa' : 'Vehicle Card & Secure Vault'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              {lang === 'tr'
                ? 'Hatalı park/acil durum araç bildirimleri ve AES-256 sıfır bilgi şifrelemeyle korunan güvenli not kasası.'
                : 'Vehicle notification system and zero-knowledge AES-256 encrypted private notes.'}
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
                ? 'Google veya e-postanızla saniyeler içinde giriş yapın, sağlık, sosyal ve araç kartı bilgilerinizi anında yönetin.'
                : 'Sign in with Google or Email in seconds, manage your health, social and vehicle card data instantly.'}
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



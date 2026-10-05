import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CreditCard, LayoutDashboard, QrCode, Smartphone, KeyRound, 
  Globe, Sun, Moon 
} from 'lucide-react';
import { SmartCard } from './types/card';
import { getStoredCardData } from './lib/storage';
import { MedicalSOSView } from './components/MedicalSOSView';
import { PersonalCardView } from './components/PersonalCardView';
import { DashboardView } from './components/DashboardView';
import { CardSimulatorView } from './components/CardSimulatorView';
import { QrCodeExporter } from './components/QrCodeExporter';
import { NfcPayloadHelper } from './components/NfcPayloadHelper';
import { CryptoVaultView } from './components/CryptoVaultView';
import { Language, ThemeMode, translations } from './lib/i18n';

type AppTab = 'simulator' | 'sos' | 'personal' | 'dashboard' | 'vault' | 'print_nfc';

export function App() {
  const [card, setCard] = useState<SmartCard>(getStoredCardData());
  const [activeTab, setActiveTab] = useState<AppTab>('simulator');
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('smart_card_lang') as Language) || 'tr';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('smart_card_theme') as ThemeMode) || 'dark';
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'sos') {
      setActiveTab('sos');
    } else if (view === 'personal') {
      setActiveTab('personal');
    }
  }, []);

  const toggleLanguage = () => {
    const nextLang: Language = language === 'tr' ? 'en' : 'tr';
    setLanguage(nextLang);
    localStorage.setItem('smart_card_lang', nextLang);
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('smart_card_theme', nextTheme);
  };

  const t = translations[language];
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200`}>
      {/* Top Navbar */}
      <header className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'} border-b sticky top-0 z-40 backdrop-blur-md transition-colors`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div 
            onClick={() => setActiveTab('simulator')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#14798D] via-[#509BEC] to-[#D1C8B9] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight flex items-center gap-1.5">
                <span className={isDark ? 'text-white' : 'text-slate-900'}>{t.appName}</span>
                <span className="text-[10px] bg-[#14798D]/20 text-[#14798D] dark:text-[#509BEC] border border-[#14798D]/40 px-1.5 py-0.2 rounded font-mono font-bold">
                  {t.versionBadge}
                </span>
              </div>
              <div className={`text-[10px] ${isDark ? 'text-[#D1C8B9]' : 'text-slate-500'} font-medium`}>
                {t.appSubtitle}
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className={`hidden md:flex items-center gap-1 ${isDark ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100/90 border-slate-200'} p-1 rounded-2xl border`}>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-[#14798D] text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.tabs.simulator}</span>
            </button>

            <button
              onClick={() => setActiveTab('sos')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'sos'
                  ? 'bg-[#14798D] text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>{t.tabs.sos}</span>
            </button>

            <button
              onClick={() => setActiveTab('personal')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'personal'
                  ? 'bg-[#509BEC] text-white shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#D1C8B9]" />
              <span>{t.tabs.personal}</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'vault'
                  ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm border border-slate-200')
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#14798D]" />
              <span>{t.tabs.vault}</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm border border-slate-200')
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t.tabs.dashboard}</span>
            </button>

            <button
              onClick={() => setActiveTab('print_nfc')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'print_nfc'
                  ? (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900 shadow-sm border border-slate-200')
                  : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>{t.tabs.print}</span>
            </button>
          </nav>

          {/* Top Right Controls: Language & Theme Switchers */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              title={language === 'tr' ? 'Switch to English' : 'Türkçe\'ye Geç'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-[#509BEC] hover:text-white' 
                  : 'bg-white border-slate-200 text-slate-700 hover:border-[#14798D] hover:text-[#14798D] shadow-sm'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-[#509BEC]" />
              <span className="uppercase tracking-wider">{language === 'tr' ? 'TR | EN' : 'EN | TR'}</span>
            </button>

            {/* Dark / Light Theme Switcher */}
            <button
              onClick={toggleTheme}
              title={isDark ? t.themeToggleLight : t.themeToggleDark}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:border-amber-400' 
                  : 'bg-white border-slate-200 text-[#14798D] hover:bg-slate-100 hover:border-[#14798D] shadow-sm'
              }`}
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-[#14798D]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-1">
        {activeTab === 'simulator' && (
          <CardSimulatorView 
            card={card} 
            onOpenSOS={() => setActiveTab('sos')}
            onOpenPersonal={() => setActiveTab('personal')}
            lang={language}
            theme={theme}
          />
        )}

        {activeTab === 'sos' && (
          <MedicalSOSView 
            medical={card.medical} 
            cardId={card.cardId} 
            lang={language}
            theme={theme}
          />
        )}

        {activeTab === 'personal' && (
          <PersonalCardView 
            personal={card.personal} 
            cardId={card.cardId} 
            lang={language}
            theme={theme}
          />
        )}

        {activeTab === 'vault' && (
          <CryptoVaultView 
            card={card} 
            lang={language}
            theme={theme}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView 
            card={card} 
            onUpdate={(updated) => setCard(updated)} 
            lang={language}
            theme={theme}
          />
        )}

        {activeTab === 'print_nfc' && (
          <div className="max-w-4xl mx-auto p-4 space-y-8 pb-20">
            <QrCodeExporter card={card} lang={language} theme={theme} />
            <NfcPayloadHelper medical={card.medical} cardId={card.cardId} lang={language} theme={theme} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className={`md:hidden fixed bottom-0 inset-x-0 ${isDark ? 'bg-slate-900/95 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'} border-t backdrop-blur-md px-2 py-1.5 z-50 flex items-center justify-around`}>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'simulator' ? 'text-[#14798D]' : ''
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>3D</span>
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'sos' ? 'text-[#509BEC]' : ''
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>SOS</span>
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'personal' ? (isDark ? 'text-[#D1C8B9]' : 'text-[#14798D]') : ''
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{language === 'tr' ? 'Kişisel' : 'Card'}</span>
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'vault' ? 'text-[#14798D]' : ''
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>{language === 'tr' ? 'Kasa' : 'Vault'}</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'dashboard' ? (isDark ? 'text-white' : 'text-slate-900 font-bold') : ''
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>{language === 'tr' ? 'Panel' : 'Admin'}</span>
        </button>
      </div>
    </div>
  );
}

export default App;

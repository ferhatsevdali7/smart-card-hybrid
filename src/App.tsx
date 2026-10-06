import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CreditCard, LayoutDashboard, QrCode, KeyRound, 
  Globe, Sun, Moon, LogIn, LogOut, User as UserIcon, Home, Menu, X, CarFront,
  HelpCircle, FileText, ChevronDown, ChevronUp, ChevronRight, Wifi, Sparkles, Edit3,
  Download, Smartphone, AlertCircle
} from 'lucide-react';
import { SmartCard, MedicalInfo, PersonalInfo, VehicleInfo } from './types/card';
import { getStoredCardData, saveStoredCardData, clearStoredCardData, DEMO_CARD_DATA } from './lib/storage';
import { LandingHeroView } from './components/LandingHeroView';
import { MedicalSOSView } from './components/MedicalSOSView';
import { PersonalCardView } from './components/PersonalCardView';
import { VehicleCardView } from './components/VehicleCardView';
import { DashboardView } from './components/DashboardView';
import { QrCodeExporter } from './components/QrCodeExporter';
import { NfcPayloadHelper } from './components/NfcPayloadHelper';
import { CryptoVaultView } from './components/CryptoVaultView';
import { AuthModal } from './components/AuthModal';
import { AccountProfileModal } from './components/AccountProfileModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { subscribeToAuth, logoutUser } from './lib/authService';
import { fetchCardFromFirestore, fetchUserCard, saveCardToFirestore, listenToCardUpdates } from './lib/firestoreService';
import { User } from 'firebase/auth';
import { Language, ThemeMode, translations } from './lib/i18n';

type AppTab = 'home' | 'sos' | 'personal' | 'vehicle' | 'dashboard' | 'vault' | 'print_nfc';
type SosSubTab = 'details' | 'qr' | 'nfc';
type PersonalSubTab = 'details' | 'qr' | 'nfc';
type VehicleSubTab = 'details' | 'qr';

export function App() {
  const [card, setCard] = useState<SmartCard>(() => {
    return getStoredCardData() || DEMO_CARD_DATA;
  });
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [sosSubTab, setSosSubTab] = useState<SosSubTab>('details');
  const [personalSubTab, setPersonalSubTab] = useState<PersonalSubTab>('details');
  const [vehicleSubTab, setVehicleSubTab] = useState<VehicleSubTab>('details');
  const [expandedMenuCard, setExpandedMenuCard] = useState<'sos' | 'personal' | 'vehicle' | null>('sos');

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const [isPublicScan, setIsPublicScan] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('smart_card_lang') as Language) || 'tr';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('smart_card_theme') as ThemeMode) || 'dark';
  });

  // Track Network Online/Offline & PWA Install Prompt
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Track Firebase Auth State & Bind User Cards with Local Cache Persistence
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load user's own card if available
        const userCard = await fetchUserCard(currentUser.uid);
        if (userCard) {
          setCard(userCard);
          saveStoredCardData(userCard);
        } else {
          // Initialize user's card if none exists
          const customId = `CARD-${currentUser.uid.slice(0, 6).toUpperCase()}`;
          const initialUserCard: SmartCard = {
            ...DEMO_CARD_DATA,
            cardId: customId,
            medical: {
              ...DEMO_CARD_DATA.medical,
              fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Kart Sahibi',
            },
            personal: {
              ...DEMO_CARD_DATA.personal,
              fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Kart Sahibi',
              email: currentUser.email || '',
            },
            vehicle: DEMO_CARD_DATA.vehicle
          };
          await saveCardToFirestore(initialUserCard, currentUser.uid);
          setCard(initialUserCard);
          saveStoredCardData(initialUserCard);
        }
      } else {
        // When not logged in and no ?id in URL, reset to safe demo
        const params = new URLSearchParams(window.location.search);
        if (!params.get('id') && navigator.onLine) {
          setCard(DEMO_CARD_DATA);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle URL Query Routing (?view=sos, ?view=personal, ?view=vehicle, ?id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const id = params.get('id');

    if (view === 'sos') {
      setActiveTab('sos');
      setIsPublicScan(true);
    } else if (view === 'personal') {
      setActiveTab('personal');
      setIsPublicScan(true);
    } else if (view === 'vehicle') {
      setActiveTab('vehicle');
      setIsPublicScan(true);
    }

    if (id) {
      fetchCardFromFirestore(id).then((loadedCard) => {
        if (loadedCard) {
          setCard(loadedCard);
          saveStoredCardData(loadedCard);
        }
      });

      const unsubscribeCard = listenToCardUpdates(id, (updatedCard) => {
        setCard(updatedCard);
        saveStoredCardData(updatedCard);
      });

      return () => {
        unsubscribeCard();
      };
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

  const handleNavigate = (tab: AppTab) => {
    if (!user && !isPublicScan && tab !== 'home') {
      setIsAuthModalOpen(true);
      setIsDrawerOpen(false);
      return;
    }
    setIsPublicScan(false);
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  const handleNavigateToSubTab = (tab: 'sos' | 'personal' | 'vehicle', sub: string) => {
    if (!user && !isPublicScan) {
      setIsAuthModalOpen(true);
      setIsDrawerOpen(false);
      return;
    }
    setIsPublicScan(false);
    setActiveTab(tab);
    if (tab === 'sos') setSosSubTab(sub as SosSubTab);
    if (tab === 'personal') setPersonalSubTab(sub as PersonalSubTab);
    if (tab === 'vehicle') setVehicleSubTab(sub as VehicleSubTab);
    setIsDrawerOpen(false);
  };

  const handleLogout = async () => {
    await logoutUser();
    clearStoredCardData();
    setCard(DEMO_CARD_DATA);
    setActiveTab('home');
    setIsPublicScan(false);
    setIsDrawerOpen(false);
    setIsAccountModalOpen(false);
  };

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choiceResult = await installPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    } else {
      alert(language === 'tr' 
        ? 'iOS (iPhone) için: Safari alt menüsündeki "Paylaş" butonuna basıp "Ana Ekrana Ekle"yi seçiniz.' 
        : 'For iOS (iPhone): Tap "Share" icon in Safari and select "Add to Home Screen".'
      );
    }
  };

  // Decentralized in-page update handlers with offline local storage sync
  const handleUpdateMedical = async (updatedMed: MedicalInfo) => {
    const updated = { ...card, medical: updatedMed };
    setCard(updated);
    saveStoredCardData(updated);
    if (user && navigator.onLine) {
      await saveCardToFirestore(updated, user.uid);
    }
  };

  const handleUpdatePersonal = async (updatedPers: PersonalInfo) => {
    const updated = { ...card, personal: updatedPers };
    setCard(updated);
    saveStoredCardData(updated);
    if (user && navigator.onLine) {
      await saveCardToFirestore(updated, user.uid);
    }
  };

  const handleUpdateVehicle = async (updatedVeh: VehicleInfo) => {
    const updated = { ...card, vehicle: updatedVeh };
    setCard(updated);
    saveStoredCardData(updated);
    if (user && navigator.onLine) {
      await saveCardToFirestore(updated, user.uid);
    }
  };

  const toggleExpandCard = (cardType: 'sos' | 'personal' | 'vehicle') => {
    setExpandedMenuCard(prev => prev === cardType ? null : cardType);
  };

  const t = translations[language];
  const isDark = theme === 'dark';
  const userName = user?.displayName || user?.email?.split('@')[0] || (language === 'tr' ? 'Kullanıcı' : 'User');

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200 relative`}>
      
      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-300 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 backdrop-blur-md sticky top-0 z-50">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>{language === 'tr' ? '⚡ Çevrimdışı Acil Durum Modu (İnternetsiz Cihaz Hafızasından Yüklendi)' : '⚡ Offline Emergency Mode (Loaded from Device Cache)'}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className={`${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-sm'} border-b sticky top-0 z-40 backdrop-blur-md transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          {/* Sol Taraf: Logo ve Marka Adı */}
          <div 
            onClick={() => { setIsPublicScan(false); setActiveTab('home'); }}
            className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#14798D] via-[#509BEC] to-[#D1C8B9] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight flex items-center gap-2">
                <span className={isDark ? 'text-white' : 'text-slate-900'}>{t.appName}</span>
                <span className="text-[10px] bg-[#14798D]/20 text-[#14798D] dark:text-[#509BEC] border border-[#14798D]/40 px-1.5 py-0.5 rounded font-mono font-bold">
                  {t.versionBadge}
                </span>
              </div>
              <div className={`text-xs ${isDark ? 'text-[#D1C8B9]' : 'text-slate-500'} font-medium`}>
                {t.appSubtitle}
              </div>
            </div>
          </div>

          {/* Orta Kısım: Tamamen Boş */}
          <div className="flex-1" />

          {/* Sağ Taraf: Sırasıyla Ana Sayfa -> Giriş/Çıkış -> Dil -> Tema -> "=" Menü (Sadece Giriş Yapıldığında) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* 1. Ana Sayfa Butonu */}
            <button
              onClick={() => handleNavigate('home')}
              title={language === 'tr' ? 'Ana Sayfa' : 'Home'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                activeTab === 'home' && !isPublicScan
                  ? 'bg-[#14798D] text-white border-[#14798D] shadow-sm'
                  : isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'tr' ? 'Ana Sayfa' : 'Home'}</span>
            </button>

            {/* 2. Giriş Yap / Güvenli Çıkış Yap Butonu */}
            {user ? (
              <button
                onClick={handleLogout}
                title={language === 'tr' ? 'Güvenli Çıkış Yap' : 'Sign Out'}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isDark 
                    ? 'bg-rose-950/30 border-rose-800/60 text-rose-400 hover:bg-rose-900/40' 
                    : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 shadow-sm'
                }`}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Güvenli Çıkış' : 'Sign Out'}</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                title={language === 'tr' ? 'Giriş Yap' : 'Sign In'}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  isDark 
                    ? 'bg-[#14798D]/20 border-[#14798D]/40 text-[#509BEC] hover:bg-[#14798D]/30' 
                    : 'bg-[#14798D]/10 border-[#14798D]/30 text-[#14798D] hover:bg-[#14798D]/20 shadow-sm'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'tr' ? 'Giriş Yap' : 'Sign In'}</span>
              </button>
            )}

            {/* 3. TR / EN Dil Değiştirici */}
            <button
              onClick={toggleLanguage}
              title={language === 'tr' ? 'Switch to English' : 'Türkçe\'ye Geç'}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-[#509BEC] hover:text-white' 
                  : 'bg-white border-slate-200 text-slate-700 hover:border-[#14798D] hover:text-[#14798D] shadow-sm'
              }`}
            >
              <Globe className="w-4 h-4 text-[#509BEC]" />
              <span className="uppercase font-mono">{language === 'tr' ? 'TR' : 'EN'}</span>
            </button>

            {/* 4. Açık / Kapalı Tema Butonu */}
            <button
              onClick={toggleTheme}
              title={isDark ? t.themeToggleLight : t.themeToggleDark}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                isDark 
                  ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:border-amber-400' 
                  : 'bg-white border-slate-200 text-[#14798D] hover:bg-slate-100 hover:border-[#14798D] shadow-sm'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-[#14798D]" />}
            </button>

            {/* 5. "=" Menü Butonu (YALNIZCA KULLANICI GİRİŞ YAPTIĞINDA GÖRÜNÜR) */}
            {user && (
              <button
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                title={language === 'tr' ? 'Menü' : 'Menu'}
                className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                  isDrawerOpen
                    ? 'bg-[#14798D] border-[#14798D] text-white shadow-md scale-105'
                    : isDark 
                      ? 'bg-slate-800 border-slate-700 text-slate-100 hover:border-[#14798D]' 
                      : 'bg-white border-slate-300 text-slate-800 hover:border-[#14798D] shadow-sm'
                }`}
              >
                {isDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Sağdan Kayan Menü Paneli (Drawer) - YALNIZCA GİRİŞ YAPAN KART SAHİBİ İÇİN */}
      {user && isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Arka plan karartması */}
          <div 
            onClick={() => setIsDrawerOpen(false)} 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Menü Kutusu */}
          <div className={`relative w-full max-w-sm ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border-l shadow-2xl p-6 flex flex-col justify-between z-10 overflow-y-auto`}>
            
            <div>
              {/* Menü Başlığı ve Kapat Butonu */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-700/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#14798D] flex items-center justify-center text-white font-black text-sm">
                    ☰
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{language === 'tr' ? 'Kart Sahibi Menüsü' : 'Card Owner Menu'}</h3>
                    <p className="text-[11px] text-slate-400">{userName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className={`p-2 rounded-lg border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Başlıklar / Sekmeler Listesi */}
              <div className="mt-6 space-y-4">
                
                {/* KARTLARIM Bölümü */}
                <div>
                  <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 px-3 pb-2">
                    {language === 'tr' ? 'Kartlarım' : 'My Cards'}
                  </div>

                  <div className="space-y-1">
                    {/* 1. Sağlık Kartı */}
                    <div>
                      <div
                        onClick={() => toggleExpandCard('sos')}
                        className={`w-full flex items-center justify-between p-2.5 rounded-2xl cursor-pointer select-none transition-all ${
                          activeTab === 'sos'
                            ? (isDark ? 'bg-slate-800/80 text-white' : 'bg-slate-100 text-slate-900 font-bold')
                            : (isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{language === 'tr' ? 'Sağlık Kartı' : 'Health Card'}</span>
                              <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.2 rounded font-mono">112</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{language === 'tr' ? 'Kan grubu, alerji ve acil aramalar' : 'Blood type, allergies & ICE'}</div>
                          </div>
                        </div>
                        <div className="text-slate-400 px-1">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenuCard === 'sos' ? 'rotate-180 text-[#14798D]' : ''}`} />
                        </div>
                      </div>

                      {/* Sağlık Kartı Alt Başlıkları */}
                      {expandedMenuCard === 'sos' && (
                        <div className="pl-4 ml-4 my-1.5 border-l-2 border-rose-500/20 space-y-1">
                          <button
                            onClick={() => handleNavigateToSubTab('sos', 'details')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'sos' && sosSubTab === 'details'
                                ? 'bg-[#14798D] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{language === 'tr' ? 'sağlık kartı bilgisi /düzenle' : 'Health Card Info / Edit'}</span>
                          </button>

                          <button
                            onClick={() => handleNavigateToSubTab('sos', 'qr')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'sos' && sosSubTab === 'qr'
                                ? 'bg-[#14798D] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{language === 'tr' ? 'sağlık kartı QR' : 'Health Card QR'}</span>
                          </button>

                          <button
                            onClick={() => handleNavigateToSubTab('sos', 'nfc')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'sos' && sosSubTab === 'nfc'
                                ? 'bg-[#14798D] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Wifi className="w-3.5 h-3.5 text-rose-400 rotate-90 shrink-0" />
                            <span>{language === 'tr' ? 'sağlık kartı NFC' : 'Health Card NFC'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 2. Sosyal Kart */}
                    <div>
                      <div
                        onClick={() => toggleExpandCard('personal')}
                        className={`w-full flex items-center justify-between p-2.5 rounded-2xl cursor-pointer select-none transition-all ${
                          activeTab === 'personal'
                            ? (isDark ? 'bg-slate-800/80 text-white' : 'bg-slate-100 text-slate-900 font-bold')
                            : (isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-[#509BEC]/15 text-[#509BEC] flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-xs">{language === 'tr' ? 'Sosyal Kart' : 'Social Card'}</div>
                            <div className="text-[10px] text-slate-400">{language === 'tr' ? '30 sn süreli güvenli pano & kartvizit' : 'Timed clipboard & business card'}</div>
                          </div>
                        </div>
                        <div className="text-slate-400 px-1">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenuCard === 'personal' ? 'rotate-180 text-[#509BEC]' : ''}`} />
                        </div>
                      </div>

                      {/* Sosyal Kart Alt Başlıkları */}
                      {expandedMenuCard === 'personal' && (
                        <div className="pl-4 ml-4 my-1.5 border-l-2 border-[#509BEC]/20 space-y-1">
                          <button
                            onClick={() => handleNavigateToSubTab('personal', 'details')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'personal' && personalSubTab === 'details'
                                ? 'bg-[#509BEC] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5 text-[#509BEC] shrink-0" />
                            <span>{language === 'tr' ? 'sosyal kart bilgileri/ düzenle' : 'Social Card Info / Edit'}</span>
                          </button>

                          <button
                            onClick={() => handleNavigateToSubTab('personal', 'qr')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'personal' && personalSubTab === 'qr'
                                ? 'bg-[#509BEC] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#509BEC] shrink-0" />
                            <span>{language === 'tr' ? 'sosyal kart QR' : 'Social Card QR'}</span>
                          </button>

                          <button
                            onClick={() => handleNavigateToSubTab('personal', 'nfc')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'personal' && personalSubTab === 'nfc'
                                ? 'bg-[#509BEC] text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Wifi className="w-3.5 h-3.5 text-[#509BEC] rotate-90 shrink-0" />
                            <span>{language === 'tr' ? 'sosyal kart NFC' : 'Social Card NFC'}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3. Araç Kartı */}
                    <div>
                      <div
                        onClick={() => toggleExpandCard('vehicle')}
                        className={`w-full flex items-center justify-between p-2.5 rounded-2xl cursor-pointer select-none transition-all ${
                          activeTab === 'vehicle'
                            ? (isDark ? 'bg-slate-800/80 text-white' : 'bg-slate-100 text-slate-900 font-bold')
                            : (isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                            <CarFront className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs">{language === 'tr' ? 'Araç Kartı' : 'Vehicle Card'}</span>
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">🚗</span>
                            </div>
                            <div className="text-[10px] text-slate-400">{language === 'tr' ? 'Plaka, park notu ve sürücü bildirimi' : 'Plate number, parking ID & contacts'}</div>
                          </div>
                        </div>
                        <div className="text-slate-400 px-1">
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expandedMenuCard === 'vehicle' ? 'rotate-180 text-amber-400' : ''}`} />
                        </div>
                      </div>

                      {/* Araç Kartı Alt Başlıkları */}
                      {expandedMenuCard === 'vehicle' && (
                        <div className="pl-4 ml-4 my-1.5 border-l-2 border-amber-500/20 space-y-1">
                          <button
                            onClick={() => handleNavigateToSubTab('vehicle', 'details')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'vehicle' && vehicleSubTab === 'details'
                                ? 'bg-amber-600 text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <CarFront className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{language === 'tr' ? 'araç kartı bilgileri/ düzele' : 'Vehicle Card Info / Edit'}</span>
                          </button>

                          <button
                            onClick={() => handleNavigateToSubTab('vehicle', 'qr')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left ${
                              activeTab === 'vehicle' && vehicleSubTab === 'qr'
                                ? 'bg-amber-600 text-white font-bold shadow-sm'
                                : isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{language === 'tr' ? 'araç kart QR' : 'Vehicle Card QR'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* DESTEK, YASAL & PWA YÜKLE Bölümü */}
                <div className="pt-2">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400 px-3 pb-2">
                    {language === 'tr' ? 'Destek & Yasal' : 'Support & Legal'}
                  </div>

                  <div className="space-y-1">
                    {/* PWA Ana Ekrana Yükle Butonu */}
                    <button
                      onClick={handleInstallApp}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-xs font-semibold transition-all text-left ${
                        isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold">{language === 'tr' ? 'Ana Ekrana Ekle / Yükle' : 'Add to Home Screen (PWA)'}</div>
                        <div className="text-[10px] text-slate-400">{language === 'tr' ? 'İnternetsiz tam ekran mobil uygulama' : 'Offline full-screen mobile app'}</div>
                      </div>
                    </button>

                    {/* 4. Yardım & SSS */}
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setIsHelpModalOpen(true);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-xs font-semibold transition-all text-left ${
                        isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                        <HelpCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold">{language === 'tr' ? 'Yardım & SSS' : 'Help & FAQ'}</div>
                        <div className="text-[10px] text-slate-400">{language === 'tr' ? 'NFC kullanımı, SOS ve sık sorulanlar' : 'NFC guide, emergency & questions'}</div>
                      </div>
                    </button>

                    {/* 5. Gizlilik & KVKK */}
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setIsPrivacyModalOpen(true);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-2xl text-xs font-semibold transition-all text-left ${
                        isDark ? 'hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold">{language === 'tr' ? 'Gizlilik & KVKK' : 'Privacy & KVKK'}</div>
                        <div className="text-[10px] text-slate-400">{language === 'tr' ? 'Veri güvenliği ve aydınlatma metni' : 'Data protection & user rights'}</div>
                      </div>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Menü Altı Bilgi & Sürüm */}
            <div className="pt-6 border-t border-slate-700/40 text-center">
              <p className="text-xs text-slate-400">
                {language === 'tr' ? 'Smart Hybrid Card v2.5 • PWA Çevrimdışı Korumalı' : 'Smart Hybrid Card v2.5 • PWA Offline Protected'}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Sol Alt Köşe Profil Kartı (Kullanıcı Giriş Yaptığında Otomatik Görünür - Tıklayınca Profil/Hesap Modalı Açılır) */}
      {user && (
        <div 
          onClick={() => setIsAccountModalOpen(true)}
          className={`fixed bottom-5 left-5 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-xl backdrop-blur-lg hover:scale-105 ${
            isDark 
              ? 'bg-slate-900/90 border-slate-700/80 text-white hover:border-[#14798D]' 
              : 'bg-white/95 border-slate-300 text-slate-900 hover:border-[#14798D]'
          }`}
          title={language === 'tr' ? 'Hesap ve Profil Ayarları (Şifre, E-posta, Profil Bilgileri)' : 'Account & Profile Settings (Password, Email, Info)'}
        >
          {/* Profil Avatarı */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#14798D] to-[#509BEC] flex items-center justify-center text-white font-bold shadow">
            {user.photoURL ? (
              <img src={user.photoURL} alt={userName} className="w-full h-full rounded-xl object-cover" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
          {/* Profil İsmi & Rolü */}
          <div>
            <div className="text-xs font-bold leading-tight max-w-[140px] truncate">{userName}</div>
            <div className="text-[10px] text-[#14798D] dark:text-[#509BEC] font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {language === 'tr' ? 'Hesap & Profil' : 'Account & Profile'}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Render */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <LandingHeroView
            card={DEMO_CARD_DATA}
            lang={language}
            theme={theme}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenDemoSOS={() => { setIsPublicScan(false); setActiveTab('sos'); }}
            onOpenDemoPersonal={() => { setIsPublicScan(false); setActiveTab('personal'); }}
          />
        )}

        {activeTab === 'sos' && (
          <MedicalSOSView 
            medical={(user || isPublicScan || isOffline) ? card.medical : DEMO_CARD_DATA.medical} 
            cardId={(user || isPublicScan || isOffline) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            isOwner={!!user}
            subTab={sosSubTab}
            onSubTabChange={(s) => setSosSubTab(s)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onUpdateMedical={handleUpdateMedical}
          />
        )}

        {activeTab === 'personal' && (
          <PersonalCardView 
            personal={(user || isPublicScan || isOffline) ? card.personal : DEMO_CARD_DATA.personal} 
            cardId={(user || isPublicScan || isOffline) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            isOwner={!!user}
            subTab={personalSubTab}
            onSubTabChange={(s) => setPersonalSubTab(s)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onUpdatePersonal={handleUpdatePersonal}
          />
        )}

        {activeTab === 'vehicle' && (
          <VehicleCardView 
            vehicle={(user || isPublicScan || isOffline) ? (card.vehicle || DEMO_CARD_DATA.vehicle) : DEMO_CARD_DATA.vehicle}
            cardId={(user || isPublicScan || isOffline) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            isOwner={!!user}
            subTab={vehicleSubTab}
            onSubTabChange={(s) => setVehicleSubTab(s)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onUpdateVehicle={handleUpdateVehicle}
          />
        )}

        {activeTab === 'vault' && (
          <CryptoVaultView 
            card={card} 
            lang={language}
            theme={theme}
            user={user}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView 
            card={card} 
            onUpdate={(updated) => {
              setCard(updated);
              saveStoredCardData(updated);
            }} 
            lang={language}
            theme={theme}
            user={user}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'print_nfc' && (
          <div className="max-w-4xl mx-auto p-4 space-y-8 pb-20">
            <QrCodeExporter card={card} lang={language} theme={theme} />
            <NfcPayloadHelper medical={card.medical} cardId={card.cardId} lang={language} theme={theme} />
          </div>
        )}
      </main>

      {/* Auth Modal for Card Owner */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          setIsPublicScan(false);
          setActiveTab('home');
        }}
        lang={language}
        theme={theme}
      />

      {/* Account / Profile Settings Modal (Triggered by Bottom-Left Badge) */}
      <AccountProfileModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        lang={language}
        theme={theme}
      />

      {/* Help & Support FAQ Modal */}
      <HelpSupportModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        lang={language}
        theme={theme}
      />

      {/* Privacy Policy & KVKK Modal */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        lang={language}
        theme={theme}
      />
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CreditCard, LayoutDashboard, QrCode, KeyRound, 
  Globe, Sun, Moon, LogIn, LogOut, User as UserIcon, Home, Menu, X, CarFront 
} from 'lucide-react';
import { SmartCard } from './types/card';
import { getStoredCardData, clearStoredCardData, DEMO_CARD_DATA } from './lib/storage';
import { LandingHeroView } from './components/LandingHeroView';
import { MedicalSOSView } from './components/MedicalSOSView';
import { PersonalCardView } from './components/PersonalCardView';
import { VehicleCardView } from './components/VehicleCardView';
import { DashboardView } from './components/DashboardView';
import { QrCodeExporter } from './components/QrCodeExporter';
import { NfcPayloadHelper } from './components/NfcPayloadHelper';
import { CryptoVaultView } from './components/CryptoVaultView';
import { AuthModal } from './components/AuthModal';
import { subscribeToAuth, logoutUser } from './lib/authService';
import { fetchCardFromFirestore, fetchUserCard, saveCardToFirestore, listenToCardUpdates } from './lib/firestoreService';
import { User } from 'firebase/auth';
import { Language, ThemeMode, translations } from './lib/i18n';

type AppTab = 'home' | 'sos' | 'personal' | 'vehicle' | 'dashboard' | 'vault' | 'print_nfc';

export function App() {
  const [card, setCard] = useState<SmartCard>(DEMO_CARD_DATA);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isPublicScan, setIsPublicScan] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('smart_card_lang') as Language) || 'tr';
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('smart_card_theme') as ThemeMode) || 'dark';
  });

  // Track Firebase Auth State & Bind User Cards
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load user's own card if available
        const userCard = await fetchUserCard(currentUser.uid);
        if (userCard) {
          setCard(userCard);
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
            }
          };
          await saveCardToFirestore(initialUserCard, currentUser.uid);
          setCard(initialUserCard);
        }
      } else {
        // When not logged in and no ?id in URL, reset to safe demo
        const params = new URLSearchParams(window.location.search);
        if (!params.get('id')) {
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
        }
      });

      const unsubscribeCard = listenToCardUpdates(id, (updatedCard) => {
        setCard(updatedCard);
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

  const handleLogout = async () => {
    await logoutUser();
    clearStoredCardData();
    setCard(DEMO_CARD_DATA);
    setActiveTab('home');
    setIsPublicScan(false);
    setIsDrawerOpen(false);
  };

  const t = translations[language];
  const isDark = theme === 'dark';
  const userName = user?.displayName || user?.email?.split('@')[0] || (language === 'tr' ? 'Kullanıcı' : 'User');

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200 relative`}>
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
              <div className="mt-6 space-y-2">
                
                {/* 1. Sağlık Kartı */}
                <button
                  onClick={() => handleNavigate('sos')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'sos'
                      ? 'bg-[#14798D] text-white shadow-md'
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{language === 'tr' ? 'Sağlık Kartı' : 'Health Card'}</span>
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono">112</span>
                    </div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? 'Kan grubu, alerji ve acil aramalar' : 'Blood type, allergies & ICE'}</div>
                  </div>
                </button>

                {/* 2. Sosyal Kart */}
                <button
                  onClick={() => handleNavigate('personal')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'personal'
                      ? 'bg-[#509BEC] text-white shadow-md'
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <CreditCard className="w-5 h-5 text-[#D1C8B9]" />
                  <div>
                    <div>{language === 'tr' ? 'Sosyal Kart' : 'Social Card'}</div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? '30 sn süreli güvenli pano & kartvizit' : 'Timed clipboard & business card'}</div>
                  </div>
                </button>

                {/* 3. Araç Kartı (YENİ) */}
                <button
                  onClick={() => handleNavigate('vehicle')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'vehicle'
                      ? 'bg-amber-600 text-white shadow-md'
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <CarFront className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{language === 'tr' ? 'Araç Kartı' : 'Vehicle Card'}</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">🚗</span>
                    </div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? 'Plaka, park notu ve sürücü bildirimi' : 'Plate number, parking ID & contacts'}</div>
                  </div>
                </button>

                {/* 4. Kripto Kasa */}
                <button
                  onClick={() => handleNavigate('vault')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'vault'
                      ? (isDark ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900')
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <KeyRound className="w-5 h-5 text-amber-400" />
                  <div>
                    <div>{language === 'tr' ? 'Kripto Kasa' : 'Crypto Vault'}</div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? 'AES-256 sıfır bilgi şifreli kasa' : 'Zero-knowledge encrypted storage'}</div>
                  </div>
                </button>

                {/* 5. Yönetim Paneli */}
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'dashboard'
                      ? (isDark ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900')
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5 text-[#14798D]" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{language === 'tr' ? 'Yönetim Paneli' : 'Admin Dashboard'}</span>
                    </div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? 'Kart bilgileri ve sağlık kaydı düzenle' : 'Edit medical and card data'}</div>
                  </div>
                </button>

                {/* 6. QR & NFC Baskı Merkezi */}
                <button
                  onClick={() => handleNavigate('print_nfc')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all text-left ${
                    activeTab === 'print_nfc'
                      ? (isDark ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-900')
                      : isDark ? 'hover:bg-slate-800/80 text-slate-200' : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <QrCode className="w-5 h-5 text-[#509BEC]" />
                  <div>
                    <div>{language === 'tr' ? 'QR & NFC Baskı Merkezi' : 'QR & NFC Print Center'}</div>
                    <div className="text-[11px] opacity-70">{language === 'tr' ? 'Fiziksel karta aktarım ve QR baskı' : 'Export QR codes & NFC payloads'}</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Menü Altı Bilgi & Sürüm */}
            <div className="pt-6 border-t border-slate-700/40 text-center">
              <p className="text-xs text-slate-400">
                {language === 'tr' ? 'Smart Hybrid Card v2.4 • Güvenli Ekosistem' : 'Smart Hybrid Card v2.4 • Secure Ecosystem'}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* Sol Alt Köşe Profil Kartı (Kullanıcı Giriş Yaptığında Otomatik Görünür) */}
      {user && (
        <div 
          onClick={() => handleNavigate('dashboard')}
          className={`fixed bottom-5 left-5 z-40 flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border cursor-pointer transition-all duration-300 shadow-xl backdrop-blur-lg hover:scale-105 ${
            isDark 
              ? 'bg-slate-900/90 border-slate-700/80 text-white hover:border-[#14798D]' 
              : 'bg-white/95 border-slate-300 text-slate-900 hover:border-[#14798D]'
          }`}
          title={language === 'tr' ? 'Kullanıcı Profili ve Bilgileri (Düzenlemek İçin Tıklayın)' : 'User Profile & Settings (Click to manage)'}
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
              {language === 'tr' ? 'Kullanıcı Profili' : 'User Profile'}
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
            medical={(user || isPublicScan) ? card.medical : DEMO_CARD_DATA.medical} 
            cardId={(user || isPublicScan) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'personal' && (
          <PersonalCardView 
            personal={(user || isPublicScan) ? card.personal : DEMO_CARD_DATA.personal} 
            cardId={(user || isPublicScan) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'vehicle' && (
          <VehicleCardView 
            cardId={(user || isPublicScan) ? card.cardId : DEMO_CARD_DATA.cardId} 
            lang={language}
            theme={theme}
            isPublicScan={isPublicScan}
            onOpenAuth={() => setIsAuthModalOpen(true)}
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
            onUpdate={(updated) => setCard(updated)} 
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
          setActiveTab('dashboard');
        }}
        lang={language}
        theme={theme}
      />
    </div>
  );
}

export default App;




import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CreditCard, LayoutDashboard, QrCode, Smartphone, KeyRound, Palette 
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
import { ThemePreviewView } from './components/ThemePreviewView';

type AppTab = 'palette' | 'simulator' | 'sos' | 'personal' | 'dashboard' | 'vault' | 'print_nfc';

export function App() {
  const [card, setCard] = useState<SmartCard>(getStoredCardData());
  const [activeTab, setActiveTab] = useState<AppTab>('palette');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'sos') {
      setActiveTab('sos');
    } else if (view === 'personal') {
      setActiveTab('personal');
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div 
            onClick={() => setActiveTab('palette')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#14798D] via-[#509BEC] to-[#D1C8B9] flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
              <Palette className="w-5 h-5 text-slate-900" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>HİBRİT AKILLI KART</span>
                <span className="text-[10px] bg-[#14798D]/30 text-[#509BEC] border border-[#14798D]/50 px-1.5 py-0.2 rounded font-mono">v1.2</span>
              </div>
              <div className="text-[10px] text-[#D1C8B9] font-medium">Lüks Teal &amp; Azure Paleti</div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/70 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('palette')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'palette'
                  ? 'bg-gradient-to-r from-[#14798D] to-[#509BEC] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-[#D1C8B9]" />
              <span>🎨 Renk Paleti (Açık/Kapalı)</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'simulator'
                  ? 'bg-[#14798D] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>3D Kart &amp; Simülatör</span>
            </button>

            <button
              onClick={() => setActiveTab('sos')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'sos'
                  ? 'bg-[#14798D] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>Ön Yüz (SOS)</span>
            </button>

            <button
              onClick={() => setActiveTab('personal')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'personal'
                  ? 'bg-[#509BEC] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-[#D1C8B9]" />
              <span>Arka Yüz (Kişisel)</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'vault'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Kasa (AES)</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Yönetim Paneli</span>
            </button>

            <button
              onClick={() => setActiveTab('print_nfc')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'print_nfc'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 text-[#509BEC]" />
              <span>Baskı/NFC</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Render */}
      <main className="flex-1">
        {activeTab === 'palette' && (
          <ThemePreviewView 
            card={card} 
          />
        )}

        {activeTab === 'simulator' && (
          <CardSimulatorView 
            card={card} 
            onOpenSOS={() => setActiveTab('sos')}
            onOpenPersonal={() => setActiveTab('personal')}
          />
        )}

        {activeTab === 'sos' && (
          <MedicalSOSView 
            medical={card.medical} 
            cardId={card.cardId} 
          />
        )}

        {activeTab === 'personal' && (
          <PersonalCardView 
            personal={card.personal} 
            cardId={card.cardId} 
          />
        )}

        {activeTab === 'vault' && (
          <CryptoVaultView 
            card={card} 
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView 
            card={card} 
            onUpdate={(updated) => setCard(updated)} 
          />
        )}

        {activeTab === 'print_nfc' && (
          <div className="max-w-4xl mx-auto p-4 space-y-8 pb-20">
            <QrCodeExporter card={card} />
            <NfcPayloadHelper medical={card.medical} cardId={card.cardId} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-2 py-1.5 z-50 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('palette')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'palette' ? 'text-[#509BEC]' : 'text-slate-400'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Palet</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'simulator' ? 'text-[#14798D]' : 'text-slate-400'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>3D Kart</span>
        </button>

        <button
          onClick={() => setActiveTab('sos')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'sos' ? 'text-[#509BEC]' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Sağlık</span>
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'personal' ? 'text-[#D1C8B9]' : 'text-slate-400'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Kişisel</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-semibold ${
            activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Panel</span>
        </button>
      </div>
    </div>
  );
}

export default App;

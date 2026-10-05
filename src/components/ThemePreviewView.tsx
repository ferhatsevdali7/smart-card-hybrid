import React, { useState } from 'react';
import { 
  Sun, Moon, ShieldCheck, Heart, CreditCard, User, 
  Phone, Sparkles, Copy, Check, Droplet, ArrowRight 
} from 'lucide-react';
import { SmartCard } from '../types/card';

interface ThemePreviewViewProps {
  card: SmartCard;
}

export const ThemePreviewView: React.FC<ThemePreviewViewProps> = ({ card }) => {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [copiedIban, setCopiedIban] = useState(false);

  const colors = [
    { name: 'Canlı Azure Mavisi', hex: '#509BEC', rgb: '80, 155, 236', usage: 'Aksiyon butonları, vurgular ve canlı ikonlar' },
    { name: 'Derin Petrol / Teal', hex: '#14798D', rgb: '20, 121, 141', usage: 'Kart gövdeleri, huzurlu medikal zeminler, kurumsal başlıklar' },
    { name: 'Lüks Kum / Keten Beji', hex: '#D1C8B9', rgb: '209, 200, 185', usage: 'Yumuşak açık zeminler, çip/metalik hatlar, prestijli rozetler' }
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-8 pb-24">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#509BEC]"></span>
            <span className="w-3 h-3 rounded-full bg-[#14798D]"></span>
            <span className="w-3 h-3 rounded-full bg-[#D1C8B9]"></span>
            <h1 className="text-xl font-bold text-white ml-1">Lüks &amp; Sakin Renk Paleti Vitrini</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Kırmızı alarm yerine; güven veren petrol yeşili, canlı mavi ve keten beji ile premium tasarım.
          </p>
        </div>

        {/* Theme Switcher Toggle */}
        <div className="bg-slate-950 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-1">
          <button
            onClick={() => setThemeMode('dark')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              themeMode === 'dark'
                ? 'bg-[#14798D] text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Karanlık Tema</span>
          </button>

          <button
            onClick={() => setThemeMode('light')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              themeMode === 'light'
                ? 'bg-[#D1C8B9] text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Açık Tema</span>
          </button>
        </div>
      </div>

      {/* Color Palette Swatches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {colors.map((c, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-lg">
            <div 
              className="w-full h-20 rounded-xl shadow-inner border border-white/10 flex items-end p-2.5"
              style={{ backgroundColor: c.hex }}
            >
              <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                c.hex === '#D1C8B9' ? 'bg-slate-900/80 text-white' : 'bg-black/30 text-white'
              }`}>
                {c.hex}
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{c.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">RGB: {c.rgb}</div>
              <div className="text-[11px] text-slate-300 mt-1">{c.usage}</div>
            </div>
          </div>
        ))}
      </div>

      {/* LIVE THEME DEMO PREVIEW (DARK OR LIGHT) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#509BEC]" />
            <span>Canlı Arayüz Önizlemesi ({themeMode === 'dark' ? 'Karanlık Tema' : 'Açık Tema'})</span>
          </h2>
          <span className="text-xs text-slate-400">Paniksiz, prestijli ve güven verici medikal tasarım</span>
        </div>

        {/* Dynamic Container depending on themeMode */}
        <div className={`rounded-3xl p-6 transition-colors duration-500 border ${
          themeMode === 'dark' 
            ? 'bg-[#0A0E17] text-slate-100 border-slate-800 shadow-2xl' 
            : 'bg-[#F9F7F4] text-slate-900 border-[#E2DDD5] shadow-2xl'
        }`}>
          
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Top Tranquil Header */}
            <div className={`p-4 rounded-2xl flex items-center justify-between border ${
              themeMode === 'dark' 
                ? 'bg-[#14798D]/20 border-[#14798D]/40 text-white' 
                : 'bg-[#14798D]/10 border-[#14798D]/20 text-[#14798D]'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#14798D] text-white flex items-center justify-center shadow-md">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider">Medikal &amp; Kişisel Sağlık Profili</div>
                  <div className={`text-sm font-extrabold ${themeMode === 'dark' ? 'text-[#D1C8B9]' : 'text-[#14798D]'}`}>
                    HAYAT KURTARAN DİJİTAL KİMLİK
                  </div>
                </div>
              </div>

              <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                themeMode === 'dark' 
                  ? 'bg-slate-900/80 text-[#D1C8B9] border-slate-700' 
                  : 'bg-white text-[#14798D] border-[#D1C8B9]'
              }`}>
                {card.cardId}
              </span>
            </div>

            {/* Main Medical Profile Box (Teal + Linen Accent, NO RED PANIC) */}
            <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
              themeMode === 'dark'
                ? 'bg-gradient-to-br from-[#14798D]/30 via-slate-900 to-slate-950 border-[#14798D]/40'
                : 'bg-white border-[#E2DDD5]'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={card.medical.avatarUrl} 
                      alt="Profil" 
                      className={`w-16 h-16 rounded-2xl object-cover border-2 shadow-md ${
                        themeMode === 'dark' ? 'border-[#509BEC]' : 'border-[#14798D]'
                      }`}
                    />
                    <div className="absolute -bottom-1 -right-1 bg-[#14798D] text-white rounded-full p-1 border-2 border-white">
                      <Heart className="w-3 h-3 fill-current" />
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-lg font-bold tracking-tight ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {card.medical.fullName}
                    </h3>
                    <p className={`text-xs ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                      Doğum Yılı: <strong className={themeMode === 'dark' ? 'text-[#D1C8B9]' : 'text-[#14798D]'}>{card.medical.birthYear}</strong> (34 Yaşında)
                    </p>
                    <span className={`inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      themeMode === 'dark'
                        ? 'bg-[#14798D]/20 text-[#D1C8B9] border-[#14798D]/30'
                        : 'bg-[#14798D]/10 text-[#14798D] border-[#14798D]/20'
                    }`}>
                      Organ Bağışçısı
                    </span>
                  </div>
                </div>

                {/* Blood Type Badge in Deep Teal & Sand Linen */}
                <div className="bg-[#14798D] text-white rounded-2xl p-3 text-center shadow-lg min-w-[80px] border border-[#509BEC]/30">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#D1C8B9]">KAN GRUBU</div>
                  <div className="text-2xl font-black tracking-tight leading-none mt-1">{card.medical.bloodType}</div>
                </div>
              </div>

              {/* Relaxed Badges: Allergies & Chronic */}
              <div className="mt-5 pt-4 border-t border-slate-700/30 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-2xl border ${
                  themeMode === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-[#F9F7F4] border-[#E2DDD5]'
                }`}>
                  <div className="text-[11px] font-bold text-[#509BEC] uppercase mb-1">Alerjiler</div>
                  <div className="flex flex-wrap gap-1.5">
                    {card.medical.allergies.map((a, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                        themeMode === 'dark' ? 'bg-[#509BEC]/10 text-[#509BEC] border border-[#509BEC]/20' : 'bg-[#509BEC]/15 text-[#14798D]'
                      }`}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border ${
                  themeMode === 'dark' ? 'bg-slate-950/60 border-slate-800' : 'bg-[#F9F7F4] border-[#E2DDD5]'
                }`}>
                  <div className={`text-[11px] font-bold uppercase mb-1 ${
                    themeMode === 'dark' ? 'text-[#D1C8B9]' : 'text-[#14798D]'
                  }`}>
                    Kronik Durumlar
                  </div>
                  <div className={`text-xs ${themeMode === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {card.medical.chronicDiseases.join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* ICE Emergency Call Buttons (Calm Azure Blue `#509BEC`) */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Acil Durumda Aranacak Kişiler (ICE)
              </div>

              {card.medical.emergencyContacts.map(c => (
                <a
                  key={c.id}
                  href={`tel:${c.phone}`}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 group ${
                    themeMode === 'dark'
                      ? 'bg-slate-900/80 hover:bg-[#14798D]/20 border-slate-800 hover:border-[#14798D]/50 text-white'
                      : 'bg-white hover:bg-[#14798D]/5 border-[#E2DDD5] hover:border-[#14798D]/30 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#509BEC] text-white flex items-center justify-center shadow-md">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{c.name}</div>
                      <div className="text-xs text-slate-400">Yakınlık: <span className="font-semibold text-[#14798D]">{c.relation}</span></div>
                    </div>
                  </div>

                  <div className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md">
                    <span>ARA</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </a>
              ))}
            </div>

            {/* IBAN & Bank Card Preview (Deep Teal `#14798D` & Sand `#D1C8B9`) */}
            <div className={`p-5 rounded-3xl border shadow-lg space-y-3 ${
              themeMode === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-[#E2DDD5]'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-[#14798D]">
                  <CreditCard className="w-4 h-4" />
                  <span>Banka &amp; IBAN Bilgisi</span>
                </div>
                <span className="text-[10px] font-mono bg-[#D1C8B9]/30 text-[#14798D] px-2 py-0.5 rounded font-bold">
                  TRY (₺)
                </span>
              </div>

              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                themeMode === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-[#F9F7F4] border-[#E2DDD5]'
              }`}>
                <div className={`font-mono text-xs font-bold tracking-wider ${themeMode === 'dark' ? 'text-[#D1C8B9]' : 'text-slate-900'}`}>
                  TR33 0006 2000 0001 2345 6789 01
                </div>

                <button
                  onClick={() => {
                    setCopiedIban(true);
                    setTimeout(() => setCopiedIban(false), 2000);
                  }}
                  className="bg-[#509BEC] hover:bg-[#4085d4] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md transition-all active:scale-98"
                >
                  {copiedIban ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIban ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

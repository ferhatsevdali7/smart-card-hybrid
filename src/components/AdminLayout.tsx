import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Layers, 
  QrCode, 
  Car, 
  Users, 
  Activity, 
  LogOut, 
  Sun, 
  Moon, 
  Globe, 
  ChevronRight,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { AdminSession, clearAdminSession, getAdminTheme, setAdminTheme, getAdminLang, setAdminLang } from '../lib/adminSessionService';

interface AdminLayoutProps {
  session: AdminSession;
  activeSection: string;
  onSelectSection: (section: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  session,
  activeSection,
  onSelectSection,
  onLogout,
  children
}) => {
  const [theme, setThemeState] = useState<'dark' | 'light'>(getAdminTheme());
  const [lang, setLangState] = useState<'tr' | 'en'>(getAdminLang());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(nextTheme);
    setAdminTheme(nextTheme);
  };

  const toggleLang = () => {
    const nextLang = lang === 'tr' ? 'en' : 'tr';
    setLangState(nextLang);
    setAdminLang(nextLang);
  };

  const t = {
    tr: {
      brand: 'MERKEZİ YÖNETİM SİSTEMİ',
      portalBadge: 'Super Admin Konsolu',
      menuOverview: 'Genel Bakış & Metrikler',
      menuBatches: 'Seri Üretim & Partiler',
      menuQrBank: 'Merkezi QR & Çip Envanteri',
      menuVehicles: 'Bağlı Araçlar & Garajlar',
      menuUsers: 'Kullanıcı & Müşteri Dizini',
      menuAudit: 'Güvenlik & Denetim Logları',
      adminProfile: 'Yönetici Hesabı',
      roleSuper: 'Süper Yönetici',
      logout: 'Oturumu Kapat',
      logoutTitle: 'Yönetici Oturumunu Kapat',
      logoutDesc: 'Yönetim konsolundan çıkmak istediğinize emin misiniz? Yapılan kaydedilmemiş işlemler kaybolabilir.',
      cancel: 'Vazgeç',
      confirmLogout: 'Evet, Çıkış Yap',
      sysStatus: 'Sistem Durumu: Aktif',
      dbLive: 'Firestore Canlı Bağlantı',
    },
    en: {
      brand: 'CENTRAL CONTROL SYSTEM',
      portalBadge: 'Super Admin Console',
      menuOverview: 'Overview & Metrics',
      menuBatches: 'Batch Production & Runs',
      menuQrBank: 'Central QR & Chip Inventory',
      menuVehicles: 'Linked Vehicles & Garages',
      menuUsers: 'User & Customer Directory',
      menuAudit: 'Security & Audit Logs',
      adminProfile: 'Admin Account',
      roleSuper: 'Super Administrator',
      logout: 'Sign Out',
      logoutTitle: 'Sign Out Administrator',
      logoutDesc: 'Are you sure you want to end your administrative session?',
      cancel: 'Cancel',
      confirmLogout: 'Yes, Sign Out',
      sysStatus: 'System Status: Active',
      dbLive: 'Firestore Live Sync',
    }
  }[lang];

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen w-full flex flex-col font-sans selection:bg-neutral-700 selection:text-white ${
      isDark ? 'bg-[#090b0e] text-[#e1e4e8]' : 'bg-[#f4f6f8] text-[#1f2328]'
    }`}>
      {/* ÜST KURUMSAL HEADER (KARTSIZ, DÜZ ÇİZGİ AYRIMLI) */}
      <header className={`h-14 border-b flex items-center justify-between px-6 shrink-0 ${
        isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-white border-[#d0d7de]'
      }`}>
        {/* Sol Logo & Marka */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-black border border-white flex items-center justify-center text-white font-black text-[10px] tracking-tight shrink-0 shadow-sm">
            H***F
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-widest uppercase">
              {t.brand}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              v2.5.0 • {t.portalBadge}
            </span>
          </div>
        </div>

        {/* Sağ Kontroller & Profil */}
        <div className="flex items-center gap-4">
          {/* Dil Seçici */}
          <button
            onClick={toggleLang}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium border rounded transition-colors ${
              isDark 
                ? 'bg-[#161b22] border-[#30363d] text-neutral-300 hover:bg-[#21262d]' 
                : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
            }`}
            title="Dili Değiştir / Change Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang.toUpperCase()}</span>
          </button>

          {/* Tema Seçici */}
          <button
            onClick={toggleTheme}
            className={`p-1.5 border rounded transition-colors ${
              isDark 
                ? 'bg-[#161b22] border-[#30363d] text-neutral-300 hover:bg-[#21262d]' 
                : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
            }`}
            title={isDark ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          <div className="h-4 w-px bg-neutral-700/50" />

          {/* Yönetici Profil Bilgisi */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${
              isDark ? 'bg-neutral-800 border-neutral-700 text-emerald-400' : 'bg-neutral-200 border-neutral-300 text-neutral-800'
            }`}>
              {session.email.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight">{session.email}</span>
              <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t.roleSuper}
              </span>
            </div>
          </div>

          {/* Çıkış Butonu */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded transition-colors ${
              isDark 
                ? 'bg-rose-950/30 border-rose-900/50 text-rose-300 hover:bg-rose-900/50' 
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.logout}</span>
          </button>
        </div>
      </header>

      {/* ANA GÖVDE (SIDEBAR + İÇERİK ALANI) */}
      <div className="flex-1 flex overflow-hidden">
        {/* SOL YÖNETİM MENÜSÜ (SIDEBAR) */}
        <aside className={`w-64 border-r flex flex-col justify-between p-3 shrink-0 select-none ${
          isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-white border-[#d0d7de]'
        }`}>
          <div className="space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
              Envanter & Operasyon
            </div>

            <button
              onClick={() => onSelectSection('batches')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                activeSection === 'batches'
                  ? isDark ? 'bg-neutral-800 text-white font-semibold' : 'bg-neutral-200 text-neutral-900 font-semibold'
                  : isDark ? 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>{t.menuBatches}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <button
              onClick={() => onSelectSection('qr_bank')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                activeSection === 'qr_bank'
                  ? isDark ? 'bg-neutral-800 text-white font-semibold' : 'bg-neutral-200 text-neutral-900 font-semibold'
                  : isDark ? 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-4 h-4 text-sky-400" />
                <span>{t.menuQrBank}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <button
              onClick={() => onSelectSection('vehicles')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                activeSection === 'vehicles'
                  ? isDark ? 'bg-neutral-800 text-white font-semibold' : 'bg-neutral-200 text-neutral-900 font-semibold'
                  : isDark ? 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Car className="w-4 h-4 text-sky-400" />
                <span>{t.menuVehicles}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <button
              onClick={() => onSelectSection('users')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                activeSection === 'users'
                  ? isDark ? 'bg-neutral-800 text-white font-semibold' : 'bg-neutral-200 text-neutral-900 font-semibold'
                  : isDark ? 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{t.menuUsers}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>

            <div className="pt-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono">
              Güvenlik & Sistem
            </div>

            <button
              onClick={() => onSelectSection('audit')}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-colors text-left ${
                activeSection === 'audit'
                  ? isDark ? 'bg-neutral-800 text-white font-semibold' : 'bg-neutral-200 text-neutral-900 font-semibold'
                  : isDark ? 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>{t.menuAudit}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-50" />
            </button>
          </div>

          {/* Alt Bilgi */}
          <div className={`p-3 rounded border text-[11px] font-mono ${
            isDark ? 'bg-[#161b22] border-[#30363d] text-neutral-400' : 'bg-neutral-50 border-neutral-200 text-neutral-600'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold text-neutral-300">{t.sysStatus}</span>
            </div>
            <div>{t.dbLive}</div>
          </div>
        </aside>

        {/* SAĞ İÇERİK ALANI (TABLOLAR & VERİ AKIŞI) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* ÇIKIŞ ONAY MODALI */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-md border p-6 shadow-2xl rounded ${
            isDark ? 'bg-[#161b22] border-[#30363d] text-[#e1e4e8]' : 'bg-white border-neutral-300 text-neutral-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">{t.logoutTitle}</h3>
                <p className="text-xs text-neutral-400">{session.email}</p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              {t.logoutDesc}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className={`px-4 py-2 text-xs font-medium border rounded transition-colors ${
                  isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700' : 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  clearAdminSession();
                  onLogout();
                }}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded transition-colors"
              >
                {t.confirmLogout}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

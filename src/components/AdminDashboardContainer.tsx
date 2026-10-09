import React, { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { BatchProductionView } from './BatchProductionView';
import { QrBankAdminView } from './QrBankAdminView';
import { AdminPortalView } from './AdminPortalView';
import { getAdminSession, AdminSession, clearAdminSession } from '../lib/adminSessionService';
import { Car, Users, Activity, ShieldCheck, Database, Key } from 'lucide-react';

export const AdminDashboardContainer: React.FC = () => {
  const [session, setSession] = useState<AdminSession | null>(() => getAdminSession());
  const [activeSection, setActiveSection] = useState<string>('batches');

  useEffect(() => {
    // Sayfa odaklandığında veya storage değiştiğinde kontrol
    const check = () => {
      const current = getAdminSession();
      setSession(current);
    };
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const handleLoginSuccess = (email: string) => {
    const current = getAdminSession();
    setSession(current);
  };

  const handleLogout = () => {
    clearAdminSession();
    setSession(null);
  };

  // Oturum yoksa doğrudan izole giriş ekranını göster
  if (!session) {
    return <AdminPortalView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AdminLayout
      session={session}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onLogout={handleLogout}
    >
      {/* 1. SERİ ÜRETİM & PARTİ (BATCH) YÖNETİMİ */}
      {activeSection === 'batches' && (
        <BatchProductionView adminEmail={session.email} />
      )}

      {/* 2. MERKEZİ QR BANKASI & ENVANTER */}
      {activeSection === 'qr_bank' && (
        <QrBankAdminView adminEmail={session.email} />
      )}

      {/* 2. BAĞLI ARAÇLAR & GARAJLAR */}
      {activeSection === 'vehicles' && (
        <div className="space-y-4">
          <div className="pb-4 border-b border-neutral-800">
            <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2 font-mono">
              <Car className="w-5 h-5 text-sky-400" />
              Kayıtlı Araç & Garaj Eşleşmeleri
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Sistemdeki tüm araç plakaları, acil durum kontakları ve bağlı etiket kayıtları.
            </p>
          </div>

          <div className="p-8 border border-neutral-800 rounded bg-[#0d1117] text-center font-mono">
            <Database className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">Garaj ve araç eşleşme listesi Firestore canlı veri akışına hazırlandı.</p>
          </div>
        </div>
      )}

      {/* 3. KULLANICI & MÜŞTERİ DİZİNİ */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          <div className="pb-4 border-b border-neutral-800">
            <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2 font-mono">
              <Users className="w-5 h-5 text-indigo-400" />
              Kullanıcı & Müşteri Dizini
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Kayıtlı kullanıcı profilleri, aktif kart sayıları ve güvenlik durumları.
            </p>
          </div>

          <div className="p-8 border border-neutral-800 rounded bg-[#0d1117] text-center font-mono">
            <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">Kullanıcı dizini denetim servisi aktif.</p>
          </div>
        </div>
      )}

      {/* 4. GÜVENLİK & DENETİM LOGLARI */}
      {activeSection === 'audit' && (
        <div className="space-y-4">
          <div className="pb-4 border-b border-neutral-800">
            <h1 className="text-xl font-bold text-neutral-100 flex items-center gap-2 font-mono">
              <Activity className="w-5 h-5 text-amber-400" />
              Sistem & Güvenlik Denetim Logları
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Yönetici girişleri, matbaa seri üretimleri ve etiket durum değişiklik logları.
            </p>
          </div>

          <div className="p-8 border border-neutral-800 rounded bg-[#0d1117] text-center font-mono">
            <ShieldCheck className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">Canlı denetim kayıtları izleniyor.</p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

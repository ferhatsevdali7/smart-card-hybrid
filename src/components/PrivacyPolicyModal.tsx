import React from 'react';
import { Shield, Lock, FileText, CheckCircle2, X } from 'lucide-react';
import { Language, ThemeMode } from '../lib/i18n';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  theme?: ThemeMode;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  lang = 'tr',
  theme = 'dark'
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
      />

      <div className={`relative w-full max-w-xl ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#14798D] to-[#509BEC] flex items-center justify-center text-white font-bold shadow">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">{lang === 'tr' ? 'Gizlilik & KVKK Aydınlatma Metni' : 'Privacy Policy & Data Security'}</h3>
              <p className="text-xs text-slate-400">{lang === 'tr' ? '6698 Sayılı KVKK ve GDPR Uyumluluğu' : 'KVKK & GDPR Compliance'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 text-xs sm:text-xs leading-relaxed opacity-90">
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
            <h4 className="font-bold text-sm text-[#509BEC] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#14798D]" />
              {lang === 'tr' ? '1. Sıfır Bilgi (Zero-Knowledge) Taahhüdü' : '1. Zero-Knowledge Architecture'}
            </h4>
            <p>
              {lang === 'tr'
                ? 'Kullanıcılarımızın Kripto Kasa içerisine kaydettiği şifreli notlar ve PIN kodları istemci tarafında (tarayıcınızda) PBKDF2 ve AES-GCM 256-bit ile şifrelenir. Platform yöneticileri dahil hiç kimse şifrenizi çözemez.'
                : 'All confidential notes in the Crypto Vault are client-side encrypted using PBKDF2 + AES-GCM 256-bit. Even platform administrators cannot decrypt your secrets.'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
            <h4 className="font-bold text-sm text-[#509BEC] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#14798D]" />
              {lang === 'tr' ? '2. Sağlık ve Kişisel Verilerin Korunması' : '2. Medical & Personal Data Protection'}
            </h4>
            <p>
              {lang === 'tr'
                ? 'Sağlık Kartınızdaki kan grubu, alerji ve acil durum telefon numaraları yalnızca fiziksel kartınızın QR/NFC ile taranması halinde ilk yardım ekiplerine gösterilmek üzere saklanır. Bu veriler üçüncü taraf reklam ağlarıyla asla paylaşılmaz.'
                : 'Medical records (blood type, allergies, ICE contacts) are stored solely to assist first responders when your physical smart card is scanned. Data is never shared with third-party advertisers.'}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
            <h4 className="font-bold text-sm text-[#509BEC] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {lang === 'tr' ? '3. Kullanıcı Hakları ve Veri Silme' : '3. User Rights & Data Deletion'}
            </h4>
            <p>
              {lang === 'tr'
                ? 'Kullanıcı dilediği zaman profilindeki sağlık, sosyal veya araç verilerini güncelleyebilir, sıfırlayabilir veya hesabını tamamen sistemden silebilir.'
                : 'Users maintain full rights to update, wipe, or permanently delete their smart card profiles at any time.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="bg-[#14798D] hover:bg-[#0E6476] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all"
          >
            {lang === 'tr' ? 'Okudum & Onaylıyorum' : 'Acknowledge & Close'}
          </button>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Shield, Key, LogOut, X, 
  Calendar, Check, AlertCircle, RefreshCw 
} from 'lucide-react';
import { User as FirebaseUser, updateProfile } from 'firebase/auth';
import { resetPassword } from '../lib/authService';
import { Language, ThemeMode } from '../lib/i18n';

interface AccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: FirebaseUser | null;
  onLogout: () => void;
  lang?: Language;
  theme?: ThemeMode;
}

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
  lang = 'tr',
  theme = 'dark'
}) => {
  if (!isOpen || !user) return null;

  const isDark = theme === 'dark';
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      setStatusMessage({ 
        text: lang === 'tr' ? 'Profil adı başarıyla güncellendi!' : 'Profile name updated successfully!', 
        type: 'success' 
      });
    } catch (err: any) {
      setStatusMessage({ 
        text: err.message || (lang === 'tr' ? 'Güncelleme başarısız.' : 'Update failed.'), 
        type: 'error' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user.email) return;
    setStatusMessage(null);
    try {
      await resetPassword(user.email);
      setStatusMessage({ 
        text: lang === 'tr' ? `Şifre sıfırlama bağlantısı ${user.email} adresine gönderildi!` : `Password reset link sent to ${user.email}!`, 
        type: 'success' 
      });
    } catch (err: any) {
      setStatusMessage({ 
        text: err.message || (lang === 'tr' ? 'Şifre sıfırlama e-postası gönderilemedi.' : 'Failed to send password reset email.'), 
        type: 'error' 
      });
    }
  };

  const getCreationDate = () => {
    try {
      if (!user.metadata?.creationTime) return '-';
      const d = new Date(user.metadata.creationTime);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US');
    } catch {
      return '-';
    }
  };

  const getLastSignIn = () => {
    try {
      if (!user.metadata?.lastSignInTime) return '-';
      const d = new Date(user.metadata.lastSignInTime);
      return isNaN(d.getTime()) ? '-' : d.toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
    } catch {
      return '-';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className={`relative w-full max-w-md ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'} border rounded-3xl p-6 sm:p-7 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto`}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#14798D] to-[#509BEC] flex items-center justify-center text-white font-bold shadow">
              {user.photoURL ? (
                <img src={user.photoURL} alt={displayName || 'User'} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base">{lang === 'tr' ? 'Hesap & Profil Ayarları' : 'Account & Profile Settings'}</h3>
              <p className="text-xs text-slate-400">{user.email || (lang === 'tr' ? 'Giriş Yapıldı' : 'Signed In')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl border ${isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-100'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60' 
              : 'bg-rose-950/40 text-rose-300 border border-rose-800/60'
          }`}>
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Update Display Name Form */}
        <form onSubmit={handleUpdateName} className="space-y-3">
          <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
            {lang === 'tr' ? 'Kart Sahibi Adı Soyadı' : 'Card Owner Full Name'}
          </label>
          <div className="flex gap-2">
            <input 
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={lang === 'tr' ? 'Adınız Soyadınız' : 'Your Full Name'}
              className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-semibold ${
                isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-[#509BEC]' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-[#14798D]'
              } outline-none`}
            />
            <button
              type="submit"
              disabled={isUpdating}
              className="bg-[#14798D] hover:bg-[#0E6476] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : (lang === 'tr' ? 'Kaydet' : 'Save')}
            </button>
          </div>
        </form>

        {/* Security & Password Reset Action */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
            {lang === 'tr' ? 'Güvenlik & Şifre' : 'Security & Password'}
          </label>
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold">{lang === 'tr' ? 'Hesap Şifresi' : 'Account Password'}</span>
              </div>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                className="text-xs text-[#509BEC] hover:underline font-bold"
              >
                {lang === 'tr' ? 'Şifremi Sıfırla' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>

        {/* Session Metadata Info */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
            {lang === 'tr' ? 'Oturum Bilgileri' : 'Session Details'}
          </label>
          <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'} text-xs space-y-2 font-mono`}>
            <div className="flex items-center justify-between">
              <span>{lang === 'tr' ? 'Kullanıcı UID:' : 'User UID:'}</span>
              <span className="font-bold text-slate-300">{user.uid.slice(0, 10)}...</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{lang === 'tr' ? 'Kayıt Tarihi:' : 'Joined:'}</span>
              <span className="text-slate-300">{getCreationDate()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>{lang === 'tr' ? 'Son Oturum:' : 'Last Sign-in:'}</span>
              <span className="text-slate-300">{getLastSignIn()}</span>
            </div>
          </div>
        </div>

        {/* Logout Action */}
        <div className="pt-2">
          <button
            onClick={() => { onClose(); onLogout(); }}
            className="w-full bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-800/60 font-bold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'tr' ? 'Güvenli Çıkış Yap' : 'Sign Out'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

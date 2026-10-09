import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { verifyStaffCredentials, checkRateLimit, recordFailedAttempt, resetRateLimit, checkUserStaffRole } from '../lib/staffAuthService';
import { setAdminSession } from '../lib/adminSessionService';
import { loginWithGoogle, resetPassword } from '../lib/authService';

interface AdminPortalViewProps {
  onLoginSuccess: (email: string) => void;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // 1. Google ile Yetkili Giriş
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle();
      if (!user || !user.email) {
        throw new Error('Google girişi tamamlanamadı.');
      }

      const cleanEmail = user.email.toLowerCase().trim();
      const staff = await checkUserStaffRole(cleanEmail);

      if (!staff || !staff.isActive) {
        throw new Error(`Yetkisiz Hesap (403): "${cleanEmail}" adresi Super Admin veya yetkili personel listesinde kayıtlı değil.`);
      }

      resetRateLimit(cleanEmail);
      setAdminSession(staff.email, staff.role);
      onLoginSuccess(staff.email);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google ile giriş başarısız oldu.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 2. E-posta / Şifre ile Giriş
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSent(false);

    const targetEmail = email.toLowerCase().trim();

    // Brute-force koruması
    const rateCheck = checkRateLimit(targetEmail);
    if (rateCheck.locked) {
      setErrorMsg(`Güvenlik kilidi: Çok fazla hatalı deneme yapıldı. Lütfen ${rateCheck.remainingMinutes} dakika sonra tekrar deneyin.`);
      return;
    }

    setLoading(true);
    try {
      const staff = await verifyStaffCredentials(targetEmail, password);
      resetRateLimit(targetEmail);
      
      // İzole Admin Oturumunu kaydet (F5 koruması)
      setAdminSession(staff.email, staff.role);

      onLoginSuccess(staff.email);
    } catch (err: any) {
      recordFailedAttempt(targetEmail);
      setErrorMsg(err.message || 'Yetkilendirme başarısız. Yetkili değilsiniz veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Şifre Sıfırlama / Belirleme Maili Gönder
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg('Lütfen önce şifre sıfırlama linki gönderilecek yetkili e-posta adresinizi yazın.');
      return;
    }
    try {
      await resetPassword(email.trim());
      setResetSent(true);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(`Şifre sıfırlama hatası: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#090b0e] text-[#e1e4e8] flex items-center justify-center p-4 font-sans selection:bg-neutral-800">
      <div className="w-full max-w-md border border-[#21262d] bg-[#0d1117] p-8 rounded shadow-2xl">
        {/* Üst Logo ve Başlık */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-black border-2 border-white flex items-center justify-center text-white font-black text-sm tracking-tight mb-3 shadow-lg">
            H***F
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white uppercase font-mono">
            Yönetim Konsolu Girişi
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Merkezi kontrol ve envanter yönetim paneli
          </p>
        </div>

        {/* Hata Mesajı */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Şifre Sıfırlama Bildirimi */}
        {resetSent && (
          <div className="mb-5 p-3 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">Şifre belirleme/sıfırlama bağlantısı <b>{email}</b> adresine gönderildi. Gelen kutunuzu kontrol edin.</span>
          </div>
        )}

        {/* 1. SEÇENEK: YETKİLİ GOOGLE HESABI İLE GİRİŞ */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-white text-xs font-semibold rounded transition-all flex items-center justify-center gap-3 disabled:opacity-50 tracking-wide font-mono mb-4 shadow-sm"
        >
          {googleLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Google ile Doğrulanıyor...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Yetkili Google ile Tek Tıkla Giriş</span>
            </>
          )}
        </button>

        {/* AYIRICI ÇİZGİ */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-neutral-800 w-full" />
          <span className="bg-[#0d1117] px-3 text-[11px] text-neutral-500 font-mono uppercase">veya şifre ile</span>
          <div className="border-t border-neutral-800 w-full" />
        </div>

        {/* 2. SEÇENEK: E-POSTA VE ŞİFRE FORMU */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1 font-mono uppercase tracking-wider">
              Yetkili E-posta
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sirketiniz.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-neutral-300 font-mono uppercase tracking-wider">
                Yönetici Şifresi
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[11px] text-neutral-400 hover:text-emerald-400 transition-colors font-mono underline"
              >
                Şifre Belirle / Sıfırla
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-900 border border-neutral-700 rounded text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 tracking-wider uppercase font-mono"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Doğrulanıyor...</span>
              </>
            ) : (
              <>
                <span>Sisteme Giriş Yap</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-neutral-800/80 text-center">
          <p className="text-[10px] text-neutral-500 font-mono">
            Uçtan uca şifreli oturum • IP & Oturum Denetimi Aktif
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { 
  Lock, Mail, KeyRound, AlertCircle, X, CheckCircle2, 
  LogIn, UserPlus, Eye, EyeOff, ArrowLeft, Send, Sparkles 
} from 'lucide-react';
import { 
  loginWithGoogle, 
  loginWithEmail, 
  registerWithEmail, 
  resetPassword, 
  getAuthErrorMessage 
} from '../lib/authService';
import { markCustomerLoggedIn } from '../lib/customerSessionService';
import { Language, ThemeMode } from '../lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user?: any) => void;
  lang?: Language;
  theme?: ThemeMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = 'tr',
  theme = 'dark'
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const resetFormState = () => {
    setError(null);
    setResetSent(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    resetFormState();
    try {
      const user = await loginWithGoogle();
      markCustomerLoggedIn();
      onSuccess(user || null);
      onClose();
    } catch (err: any) {
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!email.trim()) {
      setError(lang === 'tr' ? 'Lütfen e-posta adresinizi giriniz.' : 'Please enter your email.');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(email);
        setResetSent(true);
      } catch (err: any) {
        setError(getAuthErrorMessage(err, lang));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setError(lang === 'tr' ? 'Lütfen şifrenizi giriniz.' : 'Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setError(lang === 'tr' ? 'Şifre en az 6 karakter uzunluğunda olmalıdır.' : 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError(lang === 'tr' ? 'Şifreler birbiriyle uyuşmuyor.' : 'Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      let loggedUser = null;
      if (mode === 'login') {
        loggedUser = await loginWithEmail(email, password);
      } else {
        loggedUser = await registerWithEmail(email, password);
      }
      markCustomerLoggedIn();
      onSuccess(loggedUser || null);
      onClose();
    } catch (err: any) {
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className={`relative w-full max-w-md ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-2xl'} border rounded-3xl p-6 shadow-2xl space-y-5 transition-all`}>
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-5 right-5 p-2 rounded-xl ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'} transition-colors`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5 pt-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-black border-2 border-white flex items-center justify-center text-white font-black text-xs tracking-tight shadow-md">
            H***F
          </div>
          <h2 className="text-lg font-black tracking-tight">
            {mode === 'forgot'
              ? (lang === 'tr' ? 'Şifre Sıfırlama' : 'Reset Password')
              : mode === 'register'
                ? (lang === 'tr' ? 'Yeni Hesap Oluştur' : 'Create New Account')
                : (lang === 'tr' ? 'Kart Sahibi Girişi' : 'Card Owner Access')}
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} max-w-xs mx-auto`}>
            {mode === 'forgot'
              ? (lang === 'tr' ? 'Kayıtlı e-posta adresinize sıfırlama bağlantısı gönderilecektir.' : 'We will send a password reset link to your email.')
              : mode === 'register'
                ? (lang === 'tr' ? 'Kendi akıllı kartınızı oluşturmak ve yönetmek için kaydolun.' : 'Sign up to create and manage your own smart cards.')
                : (lang === 'tr' ? 'Yönetim paneline erişmek ve kartınızı düzenlemek için oturum açın.' : 'Sign in to access your dashboard and manage card records.')}
          </p>
        </div>

        {mode !== 'forgot' && (
          <>
            {/* Google Fast Sign-In */}
            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className={`w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs border transition-all shadow-sm active:scale-98 ${
                  isDark 
                    ? 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-white' 
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"/>
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/>
                </svg>
                <span>{lang === 'tr' ? 'Google ile Hızlı Giriş Yap' : 'Continue with Google'}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
              <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase font-semibold`}>
                {lang === 'tr' ? 'veya E-posta ile' : 'or with Email'}
              </span>
              <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className={`grid grid-cols-2 p-1 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                type="button"
                onClick={() => { setMode('login'); resetFormState(); }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-[#14798D] text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'tr' ? 'Giriş Yap' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); resetFormState(); }}
                className={`py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'register'
                    ? 'bg-[#509BEC] text-white shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'tr' ? 'Yeni Kayıt' : 'Sign Up'}
              </button>
            </div>
          </>
        )}

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-2xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Reset Success */}
        {resetSent && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {lang === 'tr'
                ? 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.'
                : 'Password reset link sent to your email. Please check your inbox.'}
            </span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-1`}>
              {lang === 'tr' ? 'E-posta Adresi' : 'Email Address'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                className={`w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-[#509BEC] transition-colors ${
                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {lang === 'tr' ? 'Şifre' : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); resetFormState(); }}
                    className="text-[11px] text-[#509BEC] hover:underline font-semibold"
                  >
                    {lang === 'tr' ? 'Şifremi Unuttum?' : 'Forgot Password?'}
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-[#509BEC] transition-colors ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'} mb-1`}>
                {lang === 'tr' ? 'Şifre Tekrar' : 'Confirm Password'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-[#509BEC] transition-colors ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#14798D] to-[#509BEC] hover:from-[#0E6476] hover:to-[#4085d4] text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-md shadow-[#14798D]/20 disabled:opacity-50 mt-3"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : mode === 'forgot' ? (
              <Send className="w-4 h-4" />
            ) : mode === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>
              {loading 
                ? (lang === 'tr' ? 'Lütfen Bekleyin...' : 'Please Wait...') 
                : mode === 'forgot'
                  ? (lang === 'tr' ? 'Sıfırlama Bağlantısı Gönder' : 'Send Reset Link')
                  : mode === 'login' 
                    ? (lang === 'tr' ? 'Oturum Aç' : 'Sign In') 
                    : (lang === 'tr' ? 'Kayıt Ol ve Kartını Oluştur' : 'Create Account')}
            </span>
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); resetFormState(); }}
              className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 pt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'tr' ? 'Giriş Ekranına Geri Dön' : 'Back to Sign In'}</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return result.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string): Promise<User> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    return result.user;
  } catch (error: any) {
    console.error('Registration Error:', error);
    throw error;
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: any) {
    console.error('Password Reset Error:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout Error:', error);
    throw error;
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Translates Firebase Auth error codes into clear, user-friendly messages in TR / EN
 */
export function getAuthErrorMessage(error: any, lang: 'tr' | 'en' = 'tr'): string {
  if (!error) return '';
  const code = error.code || '';

  const messages: Record<string, { tr: string; en: string }> = {
    'auth/invalid-email': {
      tr: 'Lütfen geçerli bir e-posta adresi giriniz.',
      en: 'Please enter a valid email address.'
    },
    'auth/user-disabled': {
      tr: 'Bu kullanıcı hesabı devre dışı bırakılmıştır.',
      en: 'This user account has been disabled.'
    },
    'auth/user-not-found': {
      tr: 'Bu e-posta adresine ait bir hesap bulunamadı.',
      en: 'No account found with this email address.'
    },
    'auth/wrong-password': {
      tr: 'Girdiğiniz şifre hatalı. Lütfen tekrar deneyiniz.',
      en: 'Incorrect password. Please try again.'
    },
    'auth/invalid-credential': {
      tr: 'E-posta adresi veya şifre hatalı. Lütfen kontrol ediniz.',
      en: 'Invalid credentials. Please check your email and password.'
    },
    'auth/email-already-in-use': {
      tr: 'Bu e-posta adresi zaten başka bir hesap tarafından kullanılıyor.',
      en: 'This email is already in use by another account.'
    },
    'auth/weak-password': {
      tr: 'Şifreniz çok zayıf. En az 6 karakter olmalıdır.',
      en: 'Password is too weak. Must be at least 6 characters.'
    },
    'auth/operation-not-allowed': {
      tr: 'Bu giriş yöntemi henüz Firebase Console üzerinden etkinleştirilmedi.',
      en: 'This sign-in provider is not enabled in Firebase Console.'
    },
    'auth/popup-closed-by-user': {
      tr: 'Google giriş penceresi işlem tamamlanmadan kapatıldı.',
      en: 'The Google sign-in window was closed before completion.'
    },
    'auth/popup-blocked': {
      tr: 'Tarayıcınız açılır pencereyi engelledi. Lütfen izin veriniz.',
      en: 'The sign-in popup was blocked by your browser.'
    },
    'auth/too-many-requests': {
      tr: 'Çok fazla başarısız deneme yapıldı. Lütfen biraz sonra tekrar deneyiniz.',
      en: 'Too many unsuccessful attempts. Please try again later.'
    },
    'auth/network-request-failed': {
      tr: 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol ediniz.',
      en: 'Network error. Please check your internet connection.'
    }
  };

  if (messages[code]) {
    return messages[code][lang];
  }

  return error.message || (lang === 'tr' ? 'Bir hata oluştu. Lütfen tekrar deneyiniz.' : 'An error occurred. Please try again.');
}


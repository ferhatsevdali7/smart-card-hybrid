// src/lib/adminSessionService.ts
// Bağımsız Admin Oturum Yönetimi & F5 Yenileme Koruması (sessionStorage ile sadece aktif sekmede kalıcı)
import { StaffRole } from '../types/card';

export interface AdminSession {
  email: string;
  role: StaffRole;
  token: string;
  loginTime: number;
}

const ADMIN_SESSION_KEY = 'hyb_adm_sess_v2';
const ADMIN_THEME_KEY = 'hyb_adm_theme';
const ADMIN_LANG_KEY = 'hyb_adm_lang';

export function setAdminSession(email: string, role: StaffRole): void {
  const session: AdminSession = {
    email: email.toLowerCase().trim(),
    role,
    token: `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    loginTime: Date.now()
  };
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Session storage error:', e);
  }
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    // 8 saatlik oturum süresi kontrolü
    if (Date.now() - session.loginTime > 8 * 60 * 60 * 1000) {
      clearAdminSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY); // Eski kalıntıları da temizle
  } catch (e) {
    console.error('Session clear error:', e);
  }
}

export function getAdminTheme(): 'dark' | 'light' {
  try {
    return (localStorage.getItem(ADMIN_THEME_KEY) as 'dark' | 'light') || 'dark';
  } catch {
    return 'dark';
  }
}

export function setAdminTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(ADMIN_THEME_KEY, theme);
  } catch (e) {
    console.error('Theme save error:', e);
  }
}

export function getAdminLang(): 'tr' | 'en' {
  try {
    return (localStorage.getItem(ADMIN_LANG_KEY) as 'tr' | 'en') || 'tr';
  } catch {
    return 'tr';
  }
}

export function setAdminLang(lang: 'tr' | 'en'): void {
  try {
    localStorage.setItem(ADMIN_LANG_KEY, lang);
  } catch (e) {
    console.error('Lang save error:', e);
  }
}

// Müşteri sitesi: sayfalar arası paylaşılan durum ve gezinme.

import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { Vehicle } from '../types/vehicle';
import type { PushState } from '../lib/pushService';
import type { Lang, ThemeName } from './ui';

export type Route =
  | 'welcome' | 'signin'
  | 'vehicles' | 'vehicleAdd' | 'linkQr' | 'claim'
  | 'notices' | 'support'
  | 'profile' | 'profileName' | 'profilePhone' | 'profilePassword' | 'deleteAccount'
  | 'setup' | 'help' | 'privacy';

export interface RouteState { route: Route; id?: string | null; code?: string | null; ticket?: string | null; next?: string | null }

export const PUBLIC_ROUTES: Route[] = ['welcome', 'signin', 'help', 'privacy'];
export const TAB_ROUTES: Route[] = ['vehicles', 'notices', 'support', 'profile'];

/** Alt sayfaların geri gideceği yer ve başlığı */
export const PARENT: Partial<Record<Route, { to: Route; tr: string; en: string }>> = {
  vehicleAdd: { to: 'vehicles', tr: 'Araçlarım', en: 'My vehicles' },
  linkQr: { to: 'vehicles', tr: 'Araçlarım', en: 'My vehicles' },
  claim: { to: 'vehicles', tr: 'Araçlarım', en: 'My vehicles' },
  profileName: { to: 'profile', tr: 'Profil', en: 'Profile' },
  profilePhone: { to: 'profile', tr: 'Profil', en: 'Profile' },
  profilePassword: { to: 'profile', tr: 'Profil', en: 'Profile' },
  deleteAccount: { to: 'profile', tr: 'Profil', en: 'Profile' },
  setup: { to: 'vehicles', tr: 'Geri', en: 'Back' },
  help: { to: 'profile', tr: 'Geri', en: 'Back' },
  privacy: { to: 'profile', tr: 'Geri', en: 'Back' },
  signin: { to: 'welcome', tr: 'Geri', en: 'Back' },
};

export interface SetupInfo {
  steps: { key: 'account' | 'vehicle' | 'qr' | 'push'; done: boolean; available: boolean }[];
  done: number; total: number; pct: number; complete: boolean;
  homeScreen: boolean;
  next: 'vehicle' | 'qr' | 'push' | null;
}

export interface CustomerCtxValue {
  user: User;
  displayName: string;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  vehiclesError: boolean;
  push: PushState | 'loading';
  refreshPush: () => Promise<void>;
  enablePushNow: () => Promise<void>;
  setup: SetupInfo;
  standalone: boolean;
  canInstall: boolean;
  install: () => Promise<boolean>;
  go: (to: Route, params?: Omit<RouteState, 'route'>) => void;
  back: () => void;
  toast: (text: string, tone?: 'ok' | 'danger' | 'info') => void;
  theme: ThemeName; setTheme: (t: ThemeName) => void;
  lang: Lang; setLang: (l: Lang) => void;
  logout: () => Promise<void>;
  refreshUser: () => void;
}

export const CustomerCtx = createContext<CustomerCtxValue | null>(null);
export function useCustomer(): CustomerCtxValue {
  const v = useContext(CustomerCtx);
  if (!v) throw new Error('CustomerCtx yok');
  return v;
}

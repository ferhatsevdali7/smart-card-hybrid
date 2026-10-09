// src/lib/customerSessionService.ts
// Son Kullanıcı Oturum İzolasyonu (Admin Oturumundan Tam Bağımsız)

const CUSTOMER_SESSION_FLAG = 'hyb_cust_active_session';

export function markCustomerLoggedIn(): void {
  try {
    localStorage.setItem(CUSTOMER_SESSION_FLAG, 'true');
  } catch (e) {
    console.error('Customer session mark error:', e);
  }
}

export function isCustomerLoggedIn(): boolean {
  try {
    return localStorage.getItem(CUSTOMER_SESSION_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function clearCustomerSession(): void {
  try {
    localStorage.removeItem(CUSTOMER_SESSION_FLAG);
  } catch (e) {
    console.error('Customer session clear error:', e);
  }
}

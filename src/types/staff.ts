// Yönetim paneli oturum rolü. Yetkiler lib/access içinde.
/** Panel oturumu: 'super_admin' ya da 'staff' (eski kayıtlarda üretim/destek/depo da görülebilir). */
export type StaffRole = 'super_admin' | 'staff' | 'production' | 'support' | 'warehouse';

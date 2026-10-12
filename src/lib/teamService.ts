// Ekip ve Yetkiler sayfasının veri tipleri ve çağrıları (yalnızca süper yönetici; sunucuda korunur)

import {
  adminLiftLimitFn, adminMyQuotaFn, adminTeamAddMemberFn, adminTeamDeletePositionFn, adminTeamMemberFn, adminTeamOverviewFn,
  adminTeamRemoveMemberFn, adminTeamRevokeSessionsFn, adminTeamSavePositionFn, adminTeamUpdateMemberFn,
} from './functionsClient';

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface TeamMemberRow {
  email: string; name: string; superAdmin: boolean; positionId: string | null; positionName: string | null;
  status: MemberStatus; lastLoginAt: number | null; sessions: number; invitedAt: number | null;
}
export interface PositionRow {
  id: string; name: string; description: string; perms: string[]; builtin: boolean; critical: string[];
  members: { email: string; name: string }[]; updatedAt: number | null;
}
export interface TeamOverview { members: TeamMemberRow[]; positions: PositionRow[]; limits: { user_delete: number; purge: number } }
export interface MemberDetail {
  email: string; name: string; superAdmin: boolean; status: MemberStatus; positionId: string | null; positionName: string | null;
  perms: string[]; invitedBy: string | null; invitedAt: number | null; lastLoginAt: number | null;
  sessions: { id: string; device: string; createdAt: number | null; lastActiveAt: number | null }[];
  quota: { kind: 'user_delete' | 'purge'; allowed: boolean; used: number; limit: number; lifted: boolean }[];
  activity: { at: number | null; kind: string; detail: string }[];
}

export const teamOverview = () => adminTeamOverviewFn({});
export const teamMember = (email: string) => adminTeamMemberFn({ email });
export const addMember = (email: string, positionId: string) => adminTeamAddMemberFn({ email, positionId });
export const setMemberPosition = (email: string, positionId: string) => adminTeamUpdateMemberFn({ email, positionId });
export const setMemberStatus = (email: string, status: 'active' | 'suspended') => adminTeamUpdateMemberFn({ email, status });
export const removeMember = (email: string) => adminTeamRemoveMemberFn({ email });
export const revokeMemberSessions = (email: string, sessionId?: string) => adminTeamRevokeSessionsFn({ email, sessionId });
export const savePosition = (p: { id?: string; name: string; description: string; perms: string[] }) => adminTeamSavePositionFn(p);
export const deletePosition = (id: string) => adminTeamDeletePositionFn({ id });
export const liftLimit = (email: string, kind: 'user_delete' | 'purge') => adminLiftLimitFn({ email, kind });
/** Oturum açan kişinin bugünkü kritik işlem hakkı */
export const myQuota = (kind: 'user_delete' | 'purge') => adminMyQuotaFn({ kind });

const ACTIVITY: Record<string, { tr: string; en: string }> = {
  claimed: { tr: 'QR bağladı', en: 'Linked a QR' },
  tags_released: { tr: 'Satışa çıkardı', en: 'Released for sale' },
  tags_unreleased: { tr: 'Depoya geri aldı', en: 'Returned to stock' },
  tags_printed: { tr: 'Basıldı işaretledi', en: 'Marked printed' },
  tags_unprinted: { tr: 'Basılmadı yaptı', en: 'Marked unprinted' },
  tags_trashed: { tr: 'Çöpe attı', en: 'Moved to trash' },
  tags_restored: { tr: 'Geri yükledi', en: 'Restored' },
  tags_purged: { tr: 'Kalıcı olarak sildi', en: 'Deleted permanently' },
  admin_disable: { tr: 'QR kapattı', en: 'Disabled a QR' },
  admin_enable: { tr: 'QR açtı', en: 'Re-enabled a QR' },
  admin_expire: { tr: 'QR süresini bitirdi', en: 'Expired a QR' },
  admin_reset: { tr: 'QR eşleşmesini sıfırladı', en: 'Reset a QR' },
  batch_created: { tr: 'Parti üretti', en: 'Created a batch' },
  user_deleted: { tr: 'Müşteri hesabını sildi', en: 'Deleted a customer account' },
  qr_purged: { tr: 'QR kalıcı olarak sildi', en: 'Deleted QR codes permanently' },
  team_member_added: { tr: 'Ekibe üye ekledi', en: 'Added a member' },
  team_member_updated: { tr: 'Üyenin pozisyonunu değiştirdi', en: 'Changed a member' },
  team_member_suspended: { tr: 'Üyeyi askıya aldı', en: 'Suspended a member' },
  team_member_reactivated: { tr: 'Üyeyi yeniden açtı', en: 'Reactivated a member' },
  team_member_removed: { tr: 'Üyeyi ekipten çıkardı', en: 'Removed a member' },
  team_position_created: { tr: 'Pozisyon oluşturdu', en: 'Created a position' },
  team_position_updated: { tr: 'Pozisyonu düzenledi', en: 'Edited a position' },
  team_position_deleted: { tr: 'Pozisyonu sildi', en: 'Deleted a position' },
  team_sessions_revoked: { tr: 'Oturum kapattı', en: 'Closed sessions' },
  critical_limit_lifted: { tr: 'Günlük kısıtı kaldırdı', en: 'Lifted a daily limit' },
  viewed_user: { tr: 'Kullanıcı kaydını açtı', en: 'Opened a customer record' },
  viewed_vehicle: { tr: 'Araç kaydını açtı', en: 'Opened a vehicle record' },
};

export function memberActivityText(kind: string, tr: boolean): string {
  const a = ACTIVITY[kind];
  return a ? (tr ? a.tr : a.en) : kind;
}

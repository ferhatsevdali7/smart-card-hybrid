export type BloodType = '0 Rh+' | '0 Rh-' | 'A Rh+' | 'A Rh-' | 'B Rh+' | 'B Rh-' | 'AB Rh+' | 'AB Rh-';

export interface EmergencyContact {
  id: string;
  name: string;
  relation: string; // Eş, Anne, Baba, Kardeş, Arkadaş vb.
  phone: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  iban: string;
  currency: string;
}

export interface SocialLink {
  id: string;
  platform: 'instagram' | 'linkedin' | 'x' | 'github' | 'website' | 'whatsapp' | 'email';
  title: string;
  url: string;
}

export interface MedicalInfo {
  fullName: string;
  birthYear: number;
  bloodType: BloodType;
  avatarUrl?: string;
  chronicDiseases: string[];
  medications: { name: string; dosage: string }[];
  allergies: string[];
  emergencyContacts: EmergencyContact[];
  doctorNote?: string;
  organDonor: boolean;
  hasImplant: boolean;
  implantDetails?: string; // örn: Kalp Pili
}

export interface PersonalInfo {
  fullName: string;
  title?: string;
  company?: string;
  phone: string;
  email: string;
  city?: string;
  bio?: string;
  bankAccounts: BankAccount[];
  socialLinks: SocialLink[];
  customNotes?: string;
}

export interface VehicleInfo {
  id?: string; // Benzersiz araç id
  plateNumber: string;
  brandModel: string;
  ownerName: string;
  ownerPhone: string;
  emergencyContact?: string;
  parkingNote: string;
  insuranceStatus?: string;
  hidePhone?: boolean; // Numarayı yabancılara maskeli göster
  allowDirectCall?: boolean; // Doğrudan aramaya izin ver
  allowWhatsApp?: boolean; // WhatsApp hazır mesajına izin ver
  tagId?: string; // Bağlı fiziksel QR etiket seri no
}

// ---------------- QR BANK / TAG REGISTRY TYPES ----------------
export type QrTagStatus = 'unclaimed' | 'active' | 'disabled' | 'expired';

export interface QrTagItem {
  tagId: string; // örn: AK-2026-0001
  secretKey: string; // Kripto doğrulama tokenı örn: 8a9f21
  status: QrTagStatus;
  batchNumber: string; // BATCH-2026-01
  assignedUserId?: string | null;
  assignedUserEmail?: string | null;
  assignedPlate?: string | null;
  assignedCardId?: string | null;
  createdAt: string;
  activatedAt?: string | null;
  notes?: string;
}

// ---------------- ADMIN & STAFF RBAC TYPES ----------------
export type StaffRole = 'super_admin' | 'production' | 'support' | 'warehouse';

export interface StaffMember {
  uid?: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  invitedBy: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface SmartCard {
  cardId: string; // örn: MED-749123
  pinCode?: string;
  medical: MedicalInfo;
  personal: PersonalInfo;
  vehicle?: VehicleInfo;
  vehicles?: VehicleInfo[]; // Çoklu Araç Garaj Desteği
  createdAt: string;
  updatedAt: string;
}

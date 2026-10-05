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

export interface SmartCard {
  cardId: string; // örn: MED-749123
  pinCode?: string;
  medical: MedicalInfo;
  personal: PersonalInfo;
  createdAt: string;
  updatedAt: string;
}

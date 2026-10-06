import { SmartCard } from '../types/card';

export const DEMO_CARD_DATA: SmartCard = {
  cardId: 'DEMO-749123',
  pinCode: '0000',
  medical: {
    fullName: 'Örnek Kart Sahibi',
    birthYear: 1995,
    bloodType: 'A Rh+',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    chronicDiseases: [
      'Belirtilmemiş (Örnek Kayıt)',
    ],
    medications: [
      { name: 'Örnek İlaç Bilgisi', dosage: 'Günde 1 Doz' }
    ],
    allergies: [
      'Penisilin (Örnek Alerji Uyarısı)'
    ],
    emergencyContacts: [
      { id: '1', name: 'Acil Yakını (Örnek)', relation: 'Aile', phone: '+90 5XX XXX XX XX' },
      { id: '2', name: 'İkincil Yakın (Örnek)', relation: 'Yakını', phone: '+90 5XX XXX XX XX' }
    ],
    doctorNote: 'Acil durumlarda sağlık ekipleri için doktor veya hasta notu buraya girilir.',
    organDonor: true,
    hasImplant: false,
    implantDetails: ''
  },
  personal: {
    fullName: 'Örnek Kart Sahibi',
    title: 'Dijital Kartvizit Sahibi',
    company: 'Şirket / Organizasyon',
    phone: '+90 5XX XXX XX XX',
    email: 'kullanici@ornek.com',
    city: 'İstanbul / Türkiye',
    bio: 'Akıllı hibrit kart ile güvenli dijital kartvizit ve acil durum medikal kimlik profili.',
    bankAccounts: [
      {
        id: '1',
        bankName: 'Örnek Banka A.Ş.',
        accountHolder: 'Örnek Kart Sahibi',
        iban: 'TR00 0000 0000 0000 0000 0000 00',
        currency: 'TRY'
      }
    ],
    socialLinks: [
      { id: '1', platform: 'whatsapp', title: 'WhatsApp', url: 'https://wa.me/' },
      { id: '2', platform: 'linkedin', title: 'LinkedIn', url: 'https://linkedin.com' },
      { id: '3', platform: 'github', title: 'GitHub', url: 'https://github.com' }
    ],
    customNotes: 'Kart sahibi iletişim notları burada güvenli şekilde paylaşılır.'
  },
  vehicle: {
    plateNumber: '34 ABC 789',
    brandModel: 'Hibrit Akıllı Araç',
    ownerName: 'Örnek Kart Sahibi',
    ownerPhone: '+90 5XX XXX XX XX',
    emergencyContact: '+90 5XX XXX XX XX',
    parkingNote: 'Aracım hatalı park durumundaysa veya acil bir durum varsa lütfen hemen aşağıdaki butondan beni arayın.',
    insuranceStatus: 'Aktif Kasko & Trafik Sigortası'
  },
  createdAt: '2026-10-06',
  updatedAt: '2026-10-06'
};

export const DEFAULT_CARD_DATA: SmartCard = DEMO_CARD_DATA;

const STORAGE_KEY = 'smart_card_data_v1';

export function getStoredCardData(): SmartCard {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Storage read error:', e);
  }
  return DEMO_CARD_DATA;
}

export function saveStoredCardData(card: SmartCard): void {
  try {
    card.updatedAt = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

export function clearStoredCardData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Storage clear error:', e);
  }
}

export function resetCardData(): SmartCard {
  clearStoredCardData();
  return DEMO_CARD_DATA;
}


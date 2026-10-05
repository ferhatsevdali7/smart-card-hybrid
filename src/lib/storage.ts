import { SmartCard } from '../types/card';

export const DEFAULT_CARD_DATA: SmartCard = {
  cardId: 'MED-749123',
  pinCode: '1234',
  medical: {
    fullName: 'Ahmet Yılmaz',
    birthYear: 1992,
    bloodType: '0 Rh+',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80',
    chronicDiseases: [
      'Tip 1 Diyabet (Şeker)',
      'Hafif Astım'
    ],
    medications: [
      { name: 'Lantus İnsülin', dosage: 'Günde 1 doz (Gece 22:00)' },
      { name: 'Ventolin Sprey', dosage: 'Kriz anında 2 fıs' }
    ],
    allergies: [
      'Penisilin (Yüksek Risk)',
      'Arı Zehri'
    ],
    emergencyContacts: [
      { id: '1', name: 'Ayşe Yılmaz', relation: 'Eşi', phone: '+905329998877' },
      { id: '2', name: 'Mehmet Yılmaz', relation: 'Kardeşi', phone: '+905421112233' }
    ],
    doctorNote: 'Hastada kalp pili veya protez bulunmamaktadır. Hipoglisemi atağında şekerli su verilebilir.',
    organDonor: true,
    hasImplant: false,
    implantDetails: ''
  },
  personal: {
    fullName: 'Ahmet Yılmaz',
    title: 'Kıdemli Yazılım Mühendisi',
    company: 'Teknoloji A.Ş.',
    phone: '+905321234567',
    email: 'ahmet.yilmaz@ornek.com',
    city: 'İstanbul / Türkiye',
    bio: 'Teknoloji ve mobil uygulama geliştirme tutkunu. Cüzdanımda akıllı kartımla her an güvendeyim.',
    bankAccounts: [
      {
        id: '1',
        bankName: 'Garanti BBVA',
        accountHolder: 'Ahmet Yılmaz',
        iban: 'TR33 0006 2000 0001 2345 6789 01',
        currency: 'TRY'
      },
      {
        id: '2',
        bankName: 'İş Bankası',
        accountHolder: 'Ahmet Yılmaz',
        iban: 'TR12 0006 4000 0011 9876 5432 10',
        currency: 'TRY'
      }
    ],
    socialLinks: [
      { id: '1', platform: 'whatsapp', title: 'WhatsApp Mesaj', url: 'https://wa.me/905321234567' },
      { id: '2', platform: 'linkedin', title: 'LinkedIn Profili', url: 'https://linkedin.com' },
      { id: '3', platform: 'github', title: 'GitHub Portfolyo', url: 'https://github.com' },
      { id: '4', platform: 'instagram', title: 'Instagram', url: 'https://instagram.com' }
    ],
    customNotes: 'Toplantı ve danışmanlık talepleri için WhatsApp üzerinden hızlıca ulaşabilirsiniz.'
  },
  createdAt: '2026-10-02',
  updatedAt: '2026-10-05'
};

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
  return DEFAULT_CARD_DATA;
}

export function saveStoredCardData(card: SmartCard): void {
  try {
    card.updatedAt = new Date().toISOString().split('T')[0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
  } catch (e) {
    console.error('Storage save error:', e);
  }
}

export function resetCardData(): SmartCard {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Storage reset error:', e);
  }
  return DEFAULT_CARD_DATA;
}

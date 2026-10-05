import { MedicalInfo } from '../types/card';

export function generateNdefTextPayload(medical: MedicalInfo): string {
  const allergies = medical.allergies.length > 0 ? medical.allergies.join(', ') : 'Bilinen alerji yok';
  const chronic = medical.chronicDiseases.length > 0 ? medical.chronicDiseases.join(', ') : 'Bilinen kronik hastalık yok';
  const medications = medical.medications.length > 0 
    ? medical.medications.map(m => `${m.name} (${m.dosage})`).join('; ') 
    : 'Düzenli ilaç yok';
  
  const contacts = medical.emergencyContacts
    .map(c => `${c.name} [${c.relation}]: ${c.phone}`)
    .join(' | ');

  return `[🚨 ACİL DURUM SAĞLIK BİLGİSİ 🚨]
AD-SOYAD: ${medical.fullName} (${medical.birthYear})
KAN GRUBU: ${medical.bloodType}
ALERJİLER: ${allergies}
KRONİK HASTALIKLAR: ${chronic}
KULLANILAN İLAÇLAR: ${medications}
ACİL İLETİŞİM: ${contacts || 'Belirtilmedi'}
${medical.doctorNote ? `DOKTOR NOTU: ${medical.doctorNote}` : ''}
${medical.hasImplant ? `TIBBİ İMPLANT: ${medical.implantDetails}` : ''}
${medical.organDonor ? 'ORGAN BAĞIŞÇISI: EVET' : ''}`.trim();
}

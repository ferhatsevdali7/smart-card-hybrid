import { PersonalInfo } from '../types/card';

export function generateVCard(info: PersonalInfo): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${info.fullName}`,
    `N:${info.fullName};;;;`,
    info.title ? `TITLE:${info.title}` : '',
    info.company ? `ORG:${info.company}` : '',
    info.phone ? `TEL;TYPE=CELL:${info.phone}` : '',
    info.email ? `EMAIL;TYPE=INTERNET:${info.email}` : '',
    info.city ? `ADR;TYPE=WORK:;;;${info.city};;;` : '',
    info.bio ? `NOTE:${info.bio}` : '',
    'END:VCARD'
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadVCardFile(info: PersonalInfo) {
  const vcardString = generateVCard(info);
  const blob = new Blob([vcardString], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${info.fullName.replace(/\s+/g, '_')}_kartvizit.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

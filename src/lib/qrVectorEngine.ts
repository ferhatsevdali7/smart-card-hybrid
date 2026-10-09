// src/lib/qrVectorEngine.ts
// Endüstriyel Seviye Vektörel QR Motoru (Level H %30 + Siyah Zeminli H***F Rozeti)

import QRCode from 'qrcode';
import { tagUrl } from './functionsClient';

/**
 * QR'a gömülecek bağlantı: https://smart-card-hybrid.web.app/t/{KOD}
 * İçinde gizli anahtar veya sıralı numara YOKTUR.
 */
export function getTagUrl(code: string): string {
  return tagUrl(code);
}

/**
 * Yüksek Çözünürlüklü ve Kusursuz Oranlanmış Logolu QR PNG Data URL Üretir
 */
export async function generateLogodQrPng(code: string, size = 800): Promise<string> {
  const url = getTagUrl(code);

  // 1. Level H (High %30) Hata Toleranslı Temel Canvas Oluştur
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'H', // %30 Hata Toleransı
    margin: 2,
    width: size,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');

  const center = size / 2;
  // Optimum logo yarıçapı (QR genişliğinin tam %15'i)
  const logoRadius = size * 0.155;

  // 2. Dış İnce Beyaz Güvenlik Halkası (Quiet Zone - 4px)
  ctx.beginPath();
  ctx.arc(center, center, logoRadius + (size * 0.008), 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // 3. Rozetin Saf Siyah Dairesel Gövdesi
  ctx.beginPath();
  ctx.arc(center, center, logoRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // 4. Siyah Dairenin İnce Beyaz Çerçevesi
  ctx.lineWidth = Math.max(3, size * 0.008);
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // 5. Tam Beyaz H***F Tipografisi (Kusursuz Merkezli)
  const fontSize = Math.round(logoRadius * 0.62);
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Arial Black", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '1px';
  // Dikey merkez hizalama
  ctx.fillText('H***F', center, center + 1);

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Matbaa İçin Vektörel SVG Çıktısı Üretir
 */
export async function generateLogodQrSvg(code: string, size = 800): Promise<string> {
  const url = getTagUrl(code);

  // Ham SVG çıktısı al
  const rawSvg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  // SVG viewBox boyutlarını bul
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  const svgEl = doc.documentElement;
  
  const viewBoxAttr = svgEl.getAttribute('viewBox') || '0 0 45 45';
  const parts = viewBoxAttr.split(' ').map(Number);
  const vbWidth = parts[2] || 45;

  const center = vbWidth / 2;
  const logoRadius = vbWidth * 0.155;

  // Siyah Rozet Grubu
  const badgeSvg = `
    <g id="hf-black-badge">
      <!-- Dış Beyaz Koruma Halkası -->
      <circle cx="${center}" cy="${center}" r="${logoRadius + 0.4}" fill="#FFFFFF" />
      <!-- Siyah Dairesel Gövde -->
      <circle cx="${center}" cy="${center}" r="${logoRadius}" fill="#000000" stroke="#FFFFFF" stroke-width="0.35" />
      <!-- Beyaz H***F Tipografisi -->
      <text x="${center}" y="${center + (logoRadius * 0.28)}" 
            font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', sans-serif" 
            font-size="${logoRadius * 0.62}" 
            font-weight="900" 
            fill="#FFFFFF" 
            text-anchor="middle" 
            letter-spacing="0.1">
        H***F
      </text>
    </g>
  `;

  svgEl.setAttribute('width', String(size));
  svgEl.setAttribute('height', String(size));
  
  return new XMLSerializer().serializeToString(svgEl).replace('</svg>', `${badgeSvg}</svg>`);
}

/**
 * Tek Bir QR Görselini Dosya Olarak İndirir (SVG veya PNG)
 */
export async function downloadSingleQr(code: string, tagId: string, format: 'svg' | 'png' = 'png'): Promise<void> {
  if (format === 'svg') {
    const svgContent = await generateLogodQrSvg(code, 1000);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tagId}_HF_QR.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    const pngUrl = await generateLogodQrPng(code, 1200);
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${tagId}_HF_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

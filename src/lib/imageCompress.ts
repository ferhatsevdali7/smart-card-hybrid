// Talep görselleri: telefonda çekilen fotoğraf yüklemeden önce küçültülür ve JPEG'e çevrilir.
// Tuvale yeniden çizildiği için EXIF (konum, cihaz) bilgisi de düşer; sunucu ayrıca temizler.

export const MAX_INPUT_BYTES = 5 * 1024 * 1024; // kullanıcıya söylenen sınır (özgün dosya)
const MAX_EDGE = 1600;
const THUMB_EDGE = 240;
const MAX_OUTPUT_CHARS = 700_000; // sunucudaki sınırın altında (base64)
const MAX_THUMB_CHARS = 44_000;

export interface PreparedImage { data: string; thumb: string; w: number; h: number; previewUrl: string }

export class ImageError extends Error {
  constructor(public code: 'too_big' | 'not_image' | 'decode', message: string) { super(message); }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function encode(img: HTMLImageElement, edge: number, maxChars: number): { b64: string; w: number; h: number } {
  const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  let w = Math.max(1, Math.round(img.naturalWidth * scale));
  let h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('decode', 'Görsel işlenemedi.');
  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = w; canvas.height = h;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', q);
      const b64 = url.slice(url.indexOf(',') + 1);
      if (b64.length <= maxChars) return { b64, w, h };
    }
    w = Math.round(w * 0.8); h = Math.round(h * 0.8);
  }
  throw new ImageError('too_big', 'Görsel küçültülemedi.');
}

/** Dosyayı yüklemeye hazırlar (küçültülmüş JPEG + önizleme). */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_INPUT_BYTES) throw new ImageError('too_big', 'Her görsel en fazla 5 MB olabilir.');
  if (file.type && !file.type.startsWith('image/')) throw new ImageError('not_image', 'Yalnızca görsel dosyaları eklenebilir.');
  let img: HTMLImageElement;
  try { img = await loadImage(file); } catch {
    throw new ImageError('decode', 'Bu görsel açılamadı. Lütfen JPG veya PNG biçiminde bir görsel seçiniz.');
  }
  const full = encode(img, MAX_EDGE, MAX_OUTPUT_CHARS);
  const thumb = encode(img, THUMB_EDGE, MAX_THUMB_CHARS);
  return { data: full.b64, thumb: thumb.b64, w: full.w, h: full.h, previewUrl: `data:image/jpeg;base64,${thumb.b64}` };
}

export const jpegUrl = (b64: string) => `data:image/jpeg;base64,${b64}`;

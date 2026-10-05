// Web Crypto API (AES-GCM 256-bit + PBKDF2) - Native browser & hardware accelerated

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  salt: string;
  algorithm: string;
  timestamp: string;
}

function str2ab(str: string): ArrayBuffer {
  const enc = new TextEncoder();
  return enc.encode(str).buffer as ArrayBuffer;
}

function ab2str(buf: ArrayBuffer): string {
  const dec = new TextDecoder();
  return dec.decode(buf);
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

async function deriveKey(pin: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const pinBuffer = str2ab(pin);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: any, pin: string): Promise<EncryptedPayload> {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  const dataBuffer = str2ab(jsonStr);

  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));

  const salt = saltBytes.buffer as ArrayBuffer;
  const iv = ivBytes.buffer as ArrayBuffer;

  const key = await deriveKey(pin, salt);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBuffer
  );

  return {
    cipherText: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    algorithm: 'AES-GCM-256',
    timestamp: new Date().toISOString()
  };
}

export async function decryptData<T = any>(payload: EncryptedPayload, pin: string): Promise<T> {
  try {
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const cipherText = base64ToBuffer(payload.cipherText);

    const key = await deriveKey(pin, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      cipherText
    );

    const decryptedStr = ab2str(decryptedBuffer);
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr as unknown as T;
    }
  } catch (error) {
    throw new Error('Geçersiz PIN Kodu veya bozulmuş şifreli veri!');
  }
}

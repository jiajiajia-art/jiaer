import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, utf8ToBytes } from '@noble/ciphers/utils.js';
import { randomBytes } from '@noble/ciphers/webcrypto.js';

const ALG = 'AES-GCM';
const IV_LEN = 12;
const KEY_LEN = 32;

/** 与后端 CREATOR_PROFILE_AES_KEY_B64 对齐的前端密钥（传输层加密，非登录凭证） */
const ENV_KEY = 'XAUsK4arGWhokvYqzKpRybIB+wNoMbTN2FdAE5zcYCg=';

/** 单测用：强制走 noble，模拟 HTTP 非安全上下文下 crypto.subtle 缺失 */
export const profileCryptoTestHooks = {
  forceNobleFallback: false,
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getRawKeyBytes(): Uint8Array {
  if (!ENV_KEY) throw new Error('缺少前端密钥配置: VITE_CREATOR_PROFILE_AES_KEY_B64');
  const raw = b64ToBytes(ENV_KEY);
  if (raw.length !== KEY_LEN) {
    throw new Error(`CREATOR_PROFILE_AES_KEY_B64 must decode to ${KEY_LEN} bytes`);
  }
  return raw;
}

/**
 * 功能注释：非 localhost 的 HTTP（如局域网 Vite）下 crypto.subtle 为 undefined，
 * 不能直接 .importKey；有 subtle 用原生，否则退回 noble AES-GCM。
 */
function canUseSubtle(): boolean {
  if (profileCryptoTestHooks.forceNobleFallback) return false;
  const subtle = globalThis.crypto?.subtle;
  return typeof subtle?.importKey === 'function'
    && typeof subtle.encrypt === 'function'
    && typeof subtle.decrypt === 'function';
}

function createIv(): Uint8Array {
  const iv = new Uint8Array(IV_LEN);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(iv);
    return iv;
  }
  return randomBytes(IV_LEN);
}

async function getSubtleKey(): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const raw = getRawKeyBytes();
  return subtle.importKey('raw', toArrayBuffer(raw), { name: ALG }, false, ['encrypt', 'decrypt']);
}

async function encryptWithSubtle(data: unknown): Promise<string> {
  const iv = createIv();
  const key = await getSubtleKey();
  const plain = new TextEncoder().encode(JSON.stringify(data ?? {}));
  const cipherBuffer = await globalThis.crypto.subtle.encrypt(
    { name: ALG, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plain)
  );
  return `${bytesToB64(iv)}.${bytesToB64(new Uint8Array(cipherBuffer))}`;
}

async function decryptWithSubtle(iv: Uint8Array, cipher: Uint8Array): Promise<unknown> {
  const key = await getSubtleKey();
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: ALG, iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(cipher)
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

function encryptWithNoble(data: unknown): string {
  const iv = createIv();
  const aes = gcm(getRawKeyBytes(), iv);
  const cipher = aes.encrypt(utf8ToBytes(JSON.stringify(data ?? {})));
  return `${bytesToB64(iv)}.${bytesToB64(cipher)}`;
}

function decryptWithNoble(iv: Uint8Array, cipher: Uint8Array): unknown {
  const aes = gcm(getRawKeyBytes(), iv);
  return JSON.parse(bytesToUtf8(aes.decrypt(cipher)));
}

export async function encryptProfilePayload(data: unknown): Promise<string> {
  if (canUseSubtle()) return encryptWithSubtle(data);
  return encryptWithNoble(data);
}

export async function decryptProfilePayload(payload: string): Promise<unknown> {
  const [ivB64, cipherB64] = String(payload).split('.');
  if (!ivB64 || !cipherB64) {
    throw new Error('加密数据格式错误');
  }
  const iv = b64ToBytes(ivB64);
  const cipher = b64ToBytes(cipherB64);
  if (iv.length !== IV_LEN) {
    throw new Error('加密数据 IV 无效');
  }
  if (canUseSubtle()) return decryptWithSubtle(iv, cipher);
  return decryptWithNoble(iv, cipher);
}

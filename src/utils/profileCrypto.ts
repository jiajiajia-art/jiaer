const ALG = 'AES-GCM';
const IV_LEN = 12;

const ENV_KEY = 'XAUsK4arGWhokvYqzKpRybIB+wNoMbTN2FdAE5zcYCg=';

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

async function getKey(): Promise<CryptoKey> {
    if (!ENV_KEY) throw new Error('缺少前端密钥配置: VITE_CREATOR_PROFILE_AES_KEY_B64');
    const raw = b64ToBytes(ENV_KEY);
    return crypto.subtle.importKey('raw', toArrayBuffer(raw), { name: ALG }, false, ['encrypt', 'decrypt']);
}

export async function encryptProfilePayload(data: unknown): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await getKey();
    const plain = new TextEncoder().encode(JSON.stringify(data ?? {}));
    const cipherBuffer = await crypto.subtle.encrypt({ name: ALG, iv: toArrayBuffer(iv) }, key, toArrayBuffer(plain));
    const cipher = new Uint8Array(cipherBuffer);
    return `${bytesToB64(iv)}.${bytesToB64(cipher)}`;
}

export async function decryptProfilePayload(payload: string): Promise<unknown> {
    const [ivB64, cipherB64] = String(payload).split('.');
    if (!ivB64 || !cipherB64) {
        throw new Error('加密数据格式错误');
    }
    const iv = b64ToBytes(ivB64);
    const cipher = b64ToBytes(cipherB64);
    const key = await getKey();
    const plain = await crypto.subtle.decrypt({ name: ALG, iv: toArrayBuffer(iv) }, key, toArrayBuffer(cipher));
    return JSON.parse(new TextDecoder().decode(plain));
}

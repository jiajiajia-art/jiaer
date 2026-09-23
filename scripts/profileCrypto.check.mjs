/**
 * creator profile AES-GCM：安全上下文用 subtle，非安全上下文（无 importKey）走 noble
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/utils/profileCrypto.ts'), 'utf8');

test('profileCrypto_源码在无subtle时有noble回退且禁止裸crypto.subtle.importKey', () => {
  assert.match(src, /@noble\/ciphers\/aes\.js/);
  assert.match(src, /canUseSubtle/);
  assert.match(src, /forceNobleFallback/);
  assert.match(src, /encryptWithNoble|decryptWithNoble/);
  assert.doesNotMatch(src, /^\s*return crypto\.subtle\.importKey/m);
});

test('profileCrypto_subtle与noble往返及交叉解密一致', async () => {
  const mod = await import(pathToFileURL(join(root, 'src/utils/profileCrypto.ts')).href);
  const {
    encryptProfilePayload,
    decryptProfilePayload,
    profileCryptoTestHooks,
  } = mod;

  const sample = { realName: '测', phone: '13800138000', nested: { ok: true } };

  const subtleCipher = await encryptProfilePayload(sample);
  assert.match(subtleCipher, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  assert.deepEqual(await decryptProfilePayload(subtleCipher), sample);

  profileCryptoTestHooks.forceNobleFallback = true;
  try {
    const nobleCipher = await encryptProfilePayload(sample);
    assert.deepEqual(await decryptProfilePayload(nobleCipher), sample);

    // subtle 加密、noble 解密（模拟：服务端有 subtle，客户端无 subtle）
    profileCryptoTestHooks.forceNobleFallback = false;
    const fromSubtle = await encryptProfilePayload(sample);
    profileCryptoTestHooks.forceNobleFallback = true;
    assert.deepEqual(await decryptProfilePayload(fromSubtle), sample);

    // noble 加密、subtle 解密
    const fromNoble = await encryptProfilePayload({ x: 1 });
    profileCryptoTestHooks.forceNobleFallback = false;
    assert.deepEqual(await decryptProfilePayload(fromNoble), { x: 1 });
  } finally {
    profileCryptoTestHooks.forceNobleFallback = false;
  }
});

test('profileCrypto_非法payload应抛错', async () => {
  const { decryptProfilePayload } = await import(
    pathToFileURL(join(root, 'src/utils/profileCrypto.ts')).href
  );
  await assert.rejects(() => decryptProfilePayload('not-valid'), /加密数据格式错误/);
});

/**
 * 功能注释：国内 Aliyun 站关闭 Google / Firebase，避免 apis.google.com 超时。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isGoogleAuthEnabled } from '../src/lib/googleAuthPolicy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('isGoogleAuthEnabled_国内域名与aliyun应为false', () => {
  assert.equal(isGoogleAuthEnabled('', 'aliyun', 'localhost'), false);
  assert.equal(isGoogleAuthEnabled('', '', 'gogo.kurangames.cn'), false);
  assert.equal(isGoogleAuthEnabled('', '', 'kurangames.cn'), false);
  assert.equal(isGoogleAuthEnabled('https://kurangames.cn', '', 'localhost'), false);
});

test('isGoogleAuthEnabled_海外CF应为true', () => {
  assert.equal(isGoogleAuthEnabled('https://api.kurangames.com', '', 'play.kurangames.com'), true);
  assert.equal(isGoogleAuthEnabled('https://api-overseas.kurangames.com', 'cf', 'overseas.kurangames.com'), true);
  assert.equal(isGoogleAuthEnabled('', '', 'localhost'), true);
});

test('main_国内应条件加载bootstrap且不静态导入firebase', () => {
  const main = read('src/main.tsx');
  assert.match(main, /isGoogleAuthEnabled\(\)/);
  assert.match(main, /import\('\.\/bootstrapGoogleAuth'\)/);
  assert.doesNotMatch(main, /from ['"]firebase\/auth['"]/);
  assert.doesNotMatch(main, /from ['"]\.\/config\/firebase['"]/);
});

test('useGoogleAuth_应动态import且先判国内关闭', () => {
  const hook = read('src/hooks/useGoogleAuth.ts');
  assert.match(hook, /isGoogleAuthEnabled\(\)/);
  assert.match(hook, /import\('firebase\/auth'\)/);
  assert.match(hook, /GOOGLE_AUTH_DISABLED/);
  assert.doesNotMatch(hook, /from ['"]firebase\/auth['"]/);
  assert.doesNotMatch(hook, /from ['"]\.\.\/config\/firebase['"]/);
});

test('AuthModal_国内不得Google-only', () => {
  const auth = read('src/components/AuthModal.tsx');
  assert.match(auth, /isGoogleAuthEnabled/);
  assert.match(auth, /googleAuthEnabled/);
  assert.match(auth, /isGoogleOnly = googleAuthEnabled/);
});

test('firebase_应懒初始化且受策略门控', () => {
  const firebase = read('src/config/firebase.ts');
  assert.match(firebase, /ensureFirebaseAuth/);
  assert.match(firebase, /isGoogleAuthEnabled\(\)/);
  assert.doesNotMatch(firebase, /export const auth = getAuth/);
  assert.doesNotMatch(firebase, /export const app = initializeApp/);
});

test('vite_开发联调cn预设应注入aliyun运行时', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /startsWith\('cn-'\)/);
  assert.match(vite, /import\.meta\.env\.VITE_RUNTIME/);
  assert.match(vite, /aliyun/);
});

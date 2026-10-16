import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  REGISTRATION_AGREEMENT_VERSION,
  resolveRegistrationAgreementUrl,
} from '../src/lib/registrationAgreement.ts';
import {
  REGISTRATION_CODE_REQUEST_TIMEOUT_MS,
  REGISTRATION_SUBMIT_TIMEOUT_MS,
  isRegistrationRequestTimeout,
} from '../src/lib/registrationRequest.ts';

test('registration legal links stay inside the active Vite base path', () => {
  assert.equal(REGISTRATION_AGREEMENT_VERSION, '2026-10-20');
  assert.equal(
    resolveRegistrationAgreementUrl('user-agreement', {
      origin: 'https://cn-neo.funloom.ai/',
      base: '/funloom-test/',
    }),
    'https://cn-neo.funloom.ai/funloom-test/legal/user-agreement',
  );
  assert.equal(
    resolveRegistrationAgreementUrl('privacy-policy', {
      origin: '',
      base: '/',
    }),
    '/legal/privacy-policy',
  );
});

test('phone registration requests have bounded, distinguishable timeouts', () => {
  assert.equal(REGISTRATION_CODE_REQUEST_TIMEOUT_MS, 15_000);
  assert.equal(REGISTRATION_SUBMIT_TIMEOUT_MS, 20_000);
  assert.equal(isRegistrationRequestTimeout({ code: 'ECONNABORTED' }), true);
  assert.equal(isRegistrationRequestTimeout({ code: 'ETIMEDOUT' }), true);
  assert.equal(isRegistrationRequestTimeout({ message: 'timeout of 15000ms exceeded' }), true);
  assert.equal(isRegistrationRequestTimeout({ response: { status: 500 } }), false);
});

test('Chinese legal documents and their public routes are present', async () => {
  const [agreement, privacy, appSource, authApiSource] = await Promise.all([
    readFile(new URL('../src/content/legal/user-agreement-zh.md', import.meta.url), 'utf8'),
    readFile(new URL('../src/content/legal/privacy-policy-zh.md', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/api/account/authApi.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(agreement, /2026年10月20日/);
  assert.match(privacy, /2026年10月20日/);
  assert.match(appSource, /\/legal\/user-agreement/);
  assert.match(appSource, /\/legal\/privacy-policy/);
  assert.match(authApiSource, /REGISTRATION_CODE_REQUEST_TIMEOUT_MS/);
  assert.match(authApiSource, /REGISTRATION_SUBMIT_TIMEOUT_MS/);
});

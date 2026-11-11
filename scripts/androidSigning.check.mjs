/**
 * Android release 签名注入与 properties 生成单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_KEY_ALIAS,
  DEFAULT_STORE_FILE_RELATIVE,
  FUNLOOM_SIGNING_BEGIN,
  buildKeystorePropertiesContent,
  generateKeystorePassword,
  injectReleaseSigningIntoAppBuildGradle,
} from './androidSigning.mjs';

const SAMPLE_GRADLE = `apply plugin: 'com.android.application'

android {
    namespace "com.funloom.interactivefiction"
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
`;

test('generateKeystorePassword_应产出足够长的非空口令', () => {
  const a = generateKeystorePassword();
  const b = generateKeystorePassword();
  assert.ok(a.length >= 16);
  assert.notEqual(a, b);
});

test('buildKeystorePropertiesContent_应包含alias与相对storeFile', () => {
  const text = buildKeystorePropertiesContent({
    storePassword: 'sp',
    keyPassword: 'kp',
  });
  assert.match(text, /storePassword=sp/);
  assert.match(text, /keyPassword=kp/);
  assert.match(text, new RegExp(`keyAlias=${DEFAULT_KEY_ALIAS}`));
  assert.match(text, new RegExp(`storeFile=${DEFAULT_STORE_FILE_RELATIVE.replace(/\./g, '\\.')}`));
});

test('injectReleaseSigningIntoAppBuildGradle_应注入signingConfigs且幂等', () => {
  const first = injectReleaseSigningIntoAppBuildGradle(SAMPLE_GRADLE);
  assert.equal(first.changed, true);
  assert.match(first.next, new RegExp(FUNLOOM_SIGNING_BEGIN));
  assert.match(first.next, /signingConfigs\s*\{/);
  assert.match(first.next, /signingConfig\s+signingConfigs\.release/);
  assert.match(first.next, /keystore\.properties/);

  const second = injectReleaseSigningIntoAppBuildGradle(first.next);
  assert.equal(second.changed, false);
  assert.equal(second.next, first.next);
});

test('injectReleaseSigningIntoAppBuildGradle_缺少android块应抛错', () => {
  assert.throws(
    () => injectReleaseSigningIntoAppBuildGradle('apply plugin: x'),
    /无法注入签名/,
  );
});

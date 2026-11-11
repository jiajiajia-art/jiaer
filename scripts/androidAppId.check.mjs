/**
 * Play applicationId 对齐单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAY_APPLICATION_ID,
  PLAY_TARGET_SDK_VERSION,
  applyPlayAdIdPermissionToAndroidManifest,
  applyPlayApplicationIdToAppBuildGradle,
  applyPlayApplicationIdToStringsXml,
  applyPlayTargetSdkToVariablesGradle,
} from './androidAppId.mjs';

test('PLAY_APPLICATION_ID_必须与Play控制台一致含大写F', () => {
  assert.equal(PLAY_APPLICATION_ID, 'com.Funloom.myapp');
});

test('PLAY_TARGET_SDK_VERSION_不得低于36', () => {
  assert.equal(PLAY_TARGET_SDK_VERSION, 36);
});

test('applyPlayApplicationIdToAppBuildGradle_应替换applicationId且幂等', () => {
  const src = `
android {
    namespace "com.funloom.interactivefiction"
    defaultConfig {
        applicationId "com.funloom.interactivefiction"
    }
}
`;
  const first = applyPlayApplicationIdToAppBuildGradle(src);
  assert.equal(first.changed, true);
  assert.match(first.next, /applicationId "com\.Funloom\.myapp"/);
  assert.match(first.next, /namespace "com\.funloom\.interactivefiction"/);

  const second = applyPlayApplicationIdToAppBuildGradle(first.next);
  assert.equal(second.changed, false);
});

test('applyPlayApplicationIdToAppBuildGradle_缺少字段应抛错', () => {
  assert.throws(
    () => applyPlayApplicationIdToAppBuildGradle('android {}'),
    /缺少 applicationId/,
  );
});

test('applyPlayApplicationIdToStringsXml_应同步package与scheme', () => {
  const xml = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="package_name">com.funloom.interactivefiction</string>
    <string name="custom_url_scheme">com.funloom.interactivefiction</string>
</resources>
`;
  const { next, changed } = applyPlayApplicationIdToStringsXml(xml);
  assert.equal(changed, true);
  assert.match(next, /package_name">com\.Funloom\.myapp</);
  assert.match(next, /custom_url_scheme">com\.Funloom\.myapp</);
});

test('applyPlayTargetSdkToVariablesGradle_应将35提升到36且幂等', () => {
  const src = `ext {
    minSdkVersion = 23
    compileSdkVersion = 35
    targetSdkVersion = 35
}
`;
  const first = applyPlayTargetSdkToVariablesGradle(src);
  assert.equal(first.changed, true);
  assert.match(first.next, /compileSdkVersion = 36/);
  assert.match(first.next, /targetSdkVersion = 36/);
  const second = applyPlayTargetSdkToVariablesGradle(first.next);
  assert.equal(second.changed, false);
});

test('applyPlayAdIdPermissionToAndroidManifest_应注入AD_ID且幂等', () => {
  const src = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:label="@string/app_name" />
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
`;
  const first = applyPlayAdIdPermissionToAndroidManifest(src);
  assert.equal(first.changed, true);
  assert.match(
    first.next,
    /com\.google\.android\.gms\.permission\.AD_ID/,
  );
  const second = applyPlayAdIdPermissionToAndroidManifest(first.next);
  assert.equal(second.changed, false);
});

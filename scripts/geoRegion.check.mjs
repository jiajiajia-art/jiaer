/**
 * IP 区域 → 语言 / 默认支付：纯策略 + 启动强制语言接线
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calcOverseasCustomDiamonds,
  calcWechatCustomDiamonds,
  mapCountryToRegion,
} from '../src/lib/geoRegionPolicy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('mapCountryToRegion_CN应为简体微信', () => {
  assert.deepEqual(mapCountryToRegion('CN'), {
    country: 'CN',
    language: 'zh',
    payRegion: 'greaterChina',
    defaultPayMethod: 'wechat',
  });
});

test('mapCountryToRegion_港澳台应为繁体微信', () => {
  for (const code of ['HK', 'TW', 'MO']) {
    const region = mapCountryToRegion(code);
    assert.equal(region.language, 'zh-TW');
    assert.equal(region.defaultPayMethod, 'wechat');
  }
});

test('mapCountryToRegion_其它与空应为英文海外', () => {
  assert.equal(mapCountryToRegion('US').language, 'en');
  assert.equal(mapCountryToRegion('US').defaultPayMethod, 'overseas');
  assert.equal(mapCountryToRegion('').language, 'en');
  assert.equal(mapCountryToRegion(null).defaultPayMethod, 'overseas');
});

test('calcOverseasCustomDiamonds_最低一钻', () => {
  assert.equal(calcOverseasCustomDiamonds(0.01), 1);
  assert.equal(calcOverseasCustomDiamonds(1), 10);
  assert.equal(calcWechatCustomDiamonds(1), 10);
});

test('App_启动应hydrateFromIp强制语言', () => {
  const app = read('src/App.tsx');
  const store = read('src/store/useGeoRegionStore.ts');
  assert.match(app, /hydrateFromIp/);
  assert.match(store, /applyAppLanguage\(region\.language/);
  assert.match(store, /fetchGeoRegion/);
});

test('AuthModal_应按运行时语言决定Google-only', () => {
  const auth = read('src/components/AuthModal.tsx');
  assert.match(auth, /i18n\.language/);
  assert.doesNotMatch(auth, /config\.LANGUAGE/);
  assert.doesNotMatch(auth, /import\s*\{[^}]*LANGUAGE[^}]*\}\s*from\s*['"].*config/);
});

test('geoRegion_应请求geo_region接口', () => {
  const src = read('src/lib/geoRegion.ts');
  assert.match(src, /\/geo\/region/);
});

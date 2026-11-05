import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  formatSessionProfileCharge,
  getSessionProfileBillingPreview,
  resolveSessionProfileBalancePatch,
} from '../src/lib/sessionProfileBilling.ts';

test('creator test preview uses points while published play uses KK', () => {
  assert.deepEqual(getSessionProfileBillingPreview('?testMode=creator', 3), {
    currency: 'points',
    chargedUnits: 3,
  });
  assert.deepEqual(getSessionProfileBillingPreview('', 3), {
    currency: 'kk',
    chargedUnits: 3,
  });
});

test('trusted session price overrides URL inference for avatar billing', () => {
  assert.deepEqual(getSessionProfileBillingPreview('?testMode=creator', 0, {
    currency: 'kk',
    estimatedUnits: 2.5,
  }), {
    currency: 'kk',
    chargedUnits: 2.5,
  });
  assert.deepEqual(getSessionProfileBillingPreview('', 9, {
    currency: 'points',
    estimatedUnits: 0,
  }), {
    currency: 'points',
    chargedUnits: 0,
  });
});

test('session avatar price request includes the current session id', () => {
  const api = fs.readFileSync('src/api/imageBusinessPricingApi.ts', 'utf8');
  const form = fs.readFileSync('src/components/Galgame/panels/CharacterProfileForm.tsx', 'utf8');
  const archive = fs.readFileSync('src/components/Galgame/panels/PlayerArchiveSection.tsx', 'utf8');
  assert.match(api, /sessionId\?: string \| null/);
  assert.match(api, /sessionId: params\?\.sessionId \|\| undefined/);
  assert.match(form, /useImageBusinessPrice\('session_avatar_control',\s*undefined,\s*sessionId\)/);
  assert.match(archive, /useImageBusinessPrice\('session_avatar_control',\s*undefined,\s*sessionId\)/);
});

test('server billing controls the local balance field and charge label', () => {
  assert.deepEqual(resolveSessionProfileBalancePatch({
    currency: 'kk',
    chargedUnits: 0.85,
    remainingBalance: 9.15,
  }), { diamonds: 9.15 });
  assert.equal(formatSessionProfileCharge({
    currency: 'kk',
    chargedUnits: 0.85,
    remainingBalance: 9.15,
  }), '0.85 KK币');

  assert.deepEqual(resolveSessionProfileBalancePatch({
    currency: 'points',
    chargedUnits: 1,
    remainingBalance: 9,
  }), { points: 9 });
  assert.equal(formatSessionProfileCharge({
    currency: 'points',
    chargedUnits: 1,
    remainingBalance: 9,
  }), '1 织梦豆');
});

test('invalid server billing cannot mutate a cached user balance', () => {
  assert.equal(resolveSessionProfileBalancePatch(null), null);
  assert.equal(resolveSessionProfileBalancePatch({
    currency: 'kk',
    chargedUnits: 1,
    remainingBalance: Number.NaN,
  }), null);
});

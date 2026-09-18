import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExternalReturnUrl,
  getRechargeDisplayState,
  getRechargePlanOptions,
  parseDeveloperCliAuthorizeParams,
  parseExternalAuthorizeParams,
  parseExternalRechargeParams,
} from '../src/utils/externalSdkPages.ts';

test('parseExternalAuthorizeParams requires appId and redirectUri while preserving state', () => {
  const params = new URLSearchParams({
    appId: 'app_123',
    redirectUri: 'https://game.example.com/callback',
    externalUserId: 'player-1',
    state: 'state-1',
  });

  assert.deepEqual(parseExternalAuthorizeParams(params), {
    appId: 'app_123',
    redirectUri: 'https://game.example.com/callback',
    externalUserId: 'player-1',
    state: 'state-1',
    valid: true,
    error: '',
  });

  assert.equal(parseExternalAuthorizeParams(new URLSearchParams()).valid, false);
});

test('parseExternalRechargeParams requires sessionId', () => {
  assert.deepEqual(parseExternalRechargeParams(new URLSearchParams('sessionId=ers_abc')), {
    sessionId: 'ers_abc',
    valid: true,
    error: '',
  });

  assert.equal(parseExternalRechargeParams(new URLSearchParams()).valid, false);
});

test('parseDeveloperCliAuthorizeParams requires redirectUri, state, and codeChallenge', () => {
  const params = new URLSearchParams({
    redirectUri: 'http://127.0.0.1:48151/callback',
    state: 'state-cli',
    codeChallenge: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
  });

  assert.deepEqual(parseDeveloperCliAuthorizeParams(params), {
    redirectUri: 'http://127.0.0.1:48151/callback',
    state: 'state-cli',
    codeChallenge: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
    valid: true,
    error: '',
  });

  assert.equal(parseDeveloperCliAuthorizeParams(new URLSearchParams()).valid, false);
});

test('getRechargeDisplayState maps session and payment status to user-facing steps', () => {
  assert.equal(getRechargeDisplayState(null), 'missing');
  assert.equal(getRechargeDisplayState({ status: 'paid' }), 'paid');
  assert.equal(getRechargeDisplayState({ status: 'expired' }), 'expired');
  assert.equal(getRechargeDisplayState({ status: 'created' }), 'ready');
  assert.equal(getRechargeDisplayState({ status: 'pending', payment: { status: 'pending' } }), 'paying');
  assert.equal(getRechargeDisplayState({ status: 'created', expiresAt: '2026-01-01T00:00:00.000Z' }, new Date('2026-01-01T00:01:00.000Z')), 'expired');
});

test('getRechargePlanOptions exposes plan picker options and keeps legacy single-plan sessions usable', () => {
  assert.deepEqual(
    getRechargePlanOptions({
      status: 'created',
      plan: null,
      plans: [
        { id: 'dr_6', price: 6, diamonds: 60, label: '6元档', currency: 'CNY' },
        { id: 'dr_24', price: 24, diamonds: 240, label: '24元档', currency: 'CNY' },
      ],
    }).map((plan) => plan.id),
    ['dr_6', 'dr_24'],
  );

  assert.deepEqual(
    getRechargePlanOptions({
      status: 'created',
      plan: { id: 'dr_6', price: 6, diamonds: 60, label: '6元档', currency: 'CNY' },
    }).map((plan) => plan.id),
    ['dr_6'],
  );
});

test('buildExternalReturnUrl appends sdk status without dropping existing query', () => {
  assert.equal(
    buildExternalReturnUrl('https://game.example.com/shop?from=funloom', {
      sessionId: 'ers_abc',
      status: 'paid',
      outTradeNo: '202609140001',
    }),
    'https://game.example.com/shop?from=funloom&funloomSessionId=ers_abc&funloomStatus=paid&funloomOutTradeNo=202609140001',
  );

  assert.equal(buildExternalReturnUrl('', { sessionId: 'ers_abc', status: 'paid' }), '');
});

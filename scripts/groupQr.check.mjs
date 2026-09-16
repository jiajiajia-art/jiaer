import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getQqGroupQrSrc,
  QQ_GROUP_QR_FEMALE_PATH,
  QQ_GROUP_QR_MALE_PATH,
} from '../src/utils/groupQr.ts';

test('selects female QQ group QR for female users', () => {
  assert.equal(getQqGroupQrSrc('female', '/app/'), '/app/data/assets/group/qr_qq_female.png');
  assert.equal(QQ_GROUP_QR_FEMALE_PATH, 'data/assets/group/qr_qq_female.png');
});

test('selects male QQ group QR for male, missing, or unsupported gender', () => {
  assert.equal(getQqGroupQrSrc('male', '/app/'), '/app/data/assets/group/qr_qq_male.png');
  assert.equal(getQqGroupQrSrc(null, '/app/'), '/app/data/assets/group/qr_qq_male.png');
  assert.equal(getQqGroupQrSrc('unknown', '/app/'), '/app/data/assets/group/qr_qq_male.png');
  assert.equal(QQ_GROUP_QR_MALE_PATH, 'data/assets/group/qr_qq_male.png');
});


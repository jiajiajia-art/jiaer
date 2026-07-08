import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUserRole,
  isCreatorRole,
  isOperatorRole,
  isVerifiedCreatorRole,
  USER_ROLES,
} from '../src/utils/userRoles.ts';

test('normalizeUserRole maps legacy user to creator', () => {
  assert.equal(normalizeUserRole('user'), USER_ROLES.CREATOR);
  assert.equal(normalizeUserRole('creator_verified'), USER_ROLES.CREATOR_VERIFIED);
});

test('role helpers identify creator and operator access', () => {
  assert.equal(isCreatorRole('creator'), true);
  assert.equal(isCreatorRole('operator'), false);
  assert.equal(isOperatorRole('operator'), true);
  assert.equal(isOperatorRole('admin'), true);
  assert.equal(isVerifiedCreatorRole('creator_verified'), true);
});

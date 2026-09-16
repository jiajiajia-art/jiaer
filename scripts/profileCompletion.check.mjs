import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canSubmitProfilePreference,
  getGenderSymbol,
  isUserProfileComplete,
  normalizePreferenceTagIds,
  shouldLoadProfilePreferenceTags,
  togglePreferenceTagId,
} from '../src/utils/profileCompletion.ts';

test('detects whether a user profile has gender and at least two preferred tags', () => {
  assert.equal(isUserProfileComplete({ gender: 'male', preferredTagIds: [1, 2] }), true);
  assert.equal(isUserProfileComplete({ gender: 'female', preferredTagIds: [1] }), false);
  assert.equal(isUserProfileComplete({ gender: '', preferredTagIds: [1, 2] }), false);
});

test('maps supported gender values to display symbols', () => {
  assert.equal(getGenderSymbol('male'), '♂');
  assert.equal(getGenderSymbol('female'), '♀');
  assert.equal(getGenderSymbol(null), '');
});

test('normalizes and toggles preference tag ids', () => {
  assert.deepEqual(normalizePreferenceTagIds([2, '3', 3, 0, 'x']), [2, 3]);
  assert.deepEqual(togglePreferenceTagId([2, 3], 3), [2]);
  assert.deepEqual(togglePreferenceTagId([2], 4), [2, 4]);
});

test('submit is enabled only when both required profile fields are ready', () => {
  assert.equal(canSubmitProfilePreference('male', [1, 2]), true);
  assert.equal(canSubmitProfilePreference('male', [1]), false);
  assert.equal(canSubmitProfilePreference(undefined, [1, 2]), false);
});

test('theme tags load once until the user explicitly retries after failure', () => {
  assert.equal(shouldLoadProfilePreferenceTags({
    isOpen: true,
    themeTagCount: 0,
    isLoadingTags: false,
    hasRequestedTags: false,
  }), true);
  assert.equal(shouldLoadProfilePreferenceTags({
    isOpen: true,
    themeTagCount: 0,
    isLoadingTags: false,
    hasRequestedTags: true,
  }), false);
  assert.equal(shouldLoadProfilePreferenceTags({
    isOpen: true,
    themeTagCount: 0,
    isLoadingTags: false,
    hasRequestedTags: false,
  }), true);
});

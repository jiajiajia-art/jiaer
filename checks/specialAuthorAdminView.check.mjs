import test from 'node:test';
import assert from 'node:assert/strict';

const viewModule = await import('../src/lib/specialAuthorAdminView.ts').catch(() => ({}));

test('special author add flow disables users already assigned contracted or invited type', () => {
  assert.equal(typeof viewModule.isExistingSpecialAuthor, 'function');
  assert.equal(viewModule.isExistingSpecialAuthor({ benefits: { authorType: 'regular' } }), false);
  assert.equal(viewModule.isExistingSpecialAuthor({ benefits: { authorType: 'contracted' } }), true);
  assert.equal(viewModule.isExistingSpecialAuthor({ benefits: { authorType: 'special' } }), true);
});

test('author list page stays within available pages after a save removes the last row', () => {
  assert.equal(typeof viewModule.clampAuthorPage, 'function');
  assert.equal(viewModule.clampAuthorPage(3, 2), 2);
  assert.equal(viewModule.clampAuthorPage(1, 1), 1);
});

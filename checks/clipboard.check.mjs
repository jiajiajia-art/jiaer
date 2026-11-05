import assert from 'node:assert/strict';
import test from 'node:test';

import { copyTextToClipboard } from '../src/utils/clipboard.ts';

function createFallbackDocument({ copyResult = true } = {}) {
  const state = {
    appended: false,
    removed: false,
    focused: false,
    selected: false,
    value: '',
    readOnly: '',
  };
  const textArea = {
    style: {},
    set value(value) {
      state.value = value;
    },
    setAttribute(name, value) {
      if (name === 'readonly') state.readOnly = value;
    },
    focus() {
      state.focused = true;
    },
    select() {
      state.selected = true;
    },
  };
  const documentRef = {
    body: {
      appendChild(node) {
        assert.equal(node, textArea);
        state.appended = true;
      },
      removeChild(node) {
        assert.equal(node, textArea);
        state.removed = true;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, 'textarea');
      return textArea;
    },
    execCommand(command) {
      assert.equal(command, 'copy');
      return copyResult;
    },
  };
  return { documentRef, state };
}

test('uses the native Clipboard API without touching the fallback DOM', async () => {
  const writes = [];
  await copyTextToClipboard('invite-123', {
    clipboard: { writeText: async (text) => writes.push(text) },
    document: {
      createElement() {
        throw new Error('fallback should not run');
      },
    },
  });

  assert.deepEqual(writes, ['invite-123']);
});

test('falls back to execCommand when Clipboard API is unavailable on HTTP', async () => {
  const { documentRef, state } = createFallbackDocument();

  await copyTextToClipboard('invite-456', { clipboard: null, document: documentRef });

  assert.equal(state.value, 'invite-456');
  assert.equal(state.readOnly, '');
  assert.equal(state.appended, true);
  assert.equal(state.focused, true);
  assert.equal(state.selected, true);
  assert.equal(state.removed, true);
});

test('falls back when the native Clipboard API rejects the request', async () => {
  const { documentRef, state } = createFallbackDocument();

  await copyTextToClipboard('invite-789', {
    clipboard: { writeText: async () => { throw new Error('denied'); } },
    document: documentRef,
  });

  assert.equal(state.value, 'invite-789');
  assert.equal(state.removed, true);
});

test('rejects when neither native nor fallback copying succeeds', async () => {
  const { documentRef, state } = createFallbackDocument({ copyResult: false });

  await assert.rejects(
    copyTextToClipboard('invite-failed', { clipboard: null, document: documentRef }),
    /copy text/i,
  );
  assert.equal(state.removed, true);
});

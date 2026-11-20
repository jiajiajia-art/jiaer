/**
 * 本机草稿：与已保存相同不弹窗；cursor 只随草稿；peek/discard 供入口先问再开表单。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('peekDraft_相同则清键返回null_不同则带cursor', async () => {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      mem.set(k, String(v));
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const d = await import(pathToFileURL(join(romance, 'lib/useDraft.ts')).href);
  const id = 'mod.new';
  const key = d.draftStorageKey(id);
  const saved = { id: 'w1', name: '雾港来信', content: {} };
  const baseline = JSON.stringify(saved);

  assert.equal(d.peekDraft(id, baseline), null);

  mem.set(
    key,
    JSON.stringify({
      at: 1,
      base: baseline,
      value: saved,
      cursor: { group: 'story', scrollY: 120 },
    }),
  );
  // 与已保存完全一样 → 不弹窗，并清掉键
  assert.equal(d.peekDraft(id, baseline), null);
  assert.equal(mem.has(key), false);

  const dirty = { ...saved, name: '草稿雾港' };
  mem.set(
    key,
    JSON.stringify({
      at: 2,
      base: 'old',
      value: dirty,
      cursor: { group: 'cast', scrollY: 80 },
    }),
  );
  const pending = d.peekDraft(id, baseline);
  assert.ok(pending);
  assert.equal(pending.value.name, '草稿雾港');
  assert.equal(pending.cursor.group, 'cast');
  assert.equal(d.isDraftSameAsBaseline(pending, baseline), false);

  d.discardDraftById(id);
  assert.equal(mem.has(key), false);
});

test('ModEditorPanel_草稿文案与入口选定契约', async () => {
  const { readFileSync } = await import('node:fs');
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const choice = readFileSync(join(romance, 'components/DraftConflictChoice.tsx'), 'utf8');
  // 选定文案在 DraftConflictChoice：用这份继续 / 用这份开始
  assert.match(panel, /DraftConflictChoice/);
  assert.match(choice, /用这份继续/);
  assert.match(choice, /用这份开始/);
  assert.match(choice, /已保存版本/);
  assert.doesNotMatch(choice, />恢复草稿</);
  assert.doesNotMatch(choice, />使用已保存版本</);
  assert.doesNotMatch(choice, /从已保存版本开始/);
  assert.match(panel, /resumeDraftChoice/);
  assert.match(panel, /选完版本前不打开表单/);
  assert.match(panel, /onCommitted/);
});

test('useDraft_卸载和pagehide补写仍在防抖的草稿', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(join(romance, 'lib/useDraft.ts'), 'utf8');
  assert.match(source, /window\.addEventListener\("pagehide", flush\)/);
  assert.match(source, /window\.removeEventListener\("pagehide", flush\);\s*flush\(\);/);
  assert.match(source, /clear: \(\) => \{\s*pendingWrite\.current = null;\s*flush\(\);\s*removeGlobal\(key\);/);
});

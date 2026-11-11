/**
 * 历史记录展示：禁止 processGameTags 剥空后空白
 */
import test from 'node:test';
import assert from 'node:assert/strict';

async function load() {
  return import('../src/utils/textUtils.ts');
}

test('formatHistoryAssistantContent_标签正文可读', async () => {
  const { formatHistoryAssistantContent } = await load();
  const out = formatHistoryAssistantContent(
    '[NARRATION: 巷子里很静。]\n[DIALOGUE: npc_1,波丽姆,"别怕。"]',
  );
  assert.match(out, /巷子里很静/);
  assert.match(out, /波丽姆/);
});

test('formatHistoryAssistantContent_剥空时回退原文', async () => {
  const { formatHistoryAssistantContent } = await load();
  const plain = '这是已经落库的真实旁白，没有协议标签。';
  assert.equal(formatHistoryAssistantContent(plain), plain);
});

test('GalgameHistoryModal_使用formatHistoryAssistantContent', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(
    join(root, 'src/components/Galgame/GalgameHistoryModal.tsx'),
    'utf8',
  );
  assert.match(src, /formatHistoryAssistantContent/);
  assert.doesNotMatch(src, /processGameTags\(/);
});

/**
 * 回归：人物编辑三处——
 * 1) AI 生成线路/人物须填姓名年龄性别与按配额短小传（全选瘦身，禁止项项打满 300 字）
 * 2) 人物标签 = 平台 50 内置勾选 + 自定义
 * 3) 代表作仅演艺玩法显示；势力在①基础，人物只选所属
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('npcTags_平台内置恰好50且可清洗自定义', async () => {
  const tags = await import(pathToFileURL(join(romance, 'lib/npcTags.ts')).href);
  assert.equal(tags.PLATFORM_NPC_TAGS.length, 50);
  assert.equal(new Set(tags.PLATFORM_NPC_TAGS).size, 50);
  assert.equal(tags.isPlatformNpcTag('温柔'), true);
  assert.equal(tags.isPlatformNpcTag('自定义野标签'), false);
  assert.deepEqual(tags.normalizeNpcTags([' 温柔 ', '温柔', '自定义', '']), ['温柔', '自定义']);
  assert.deepEqual(tags.toggleNpcTag(['温柔'], '护短', true), ['温柔', '护短']);
  assert.deepEqual(tags.toggleNpcTag(['温柔', '护短'], '温柔', false), ['护短']);
  assert.match(tags.platformNpcTagsPromptLine(), /温柔/);
  assert.match(tags.platformNpcTagsPromptLine(), /tags\[\]/);
});

test('npcEditor_标签选择器与代表作按玩法显示', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const picker = readFileSync(join(romance, 'components/NpcTagsPicker.tsx'), 'utf8');
  assert.match(panel, /NpcTagsPicker/);
  assert.match(panel, /showCareerNpcFields/);
  assert.match(panel, /\{showCareerNpcFields && \(/);
  assert.doesNotMatch(panel, /placeholder="人物标签，用顿号或逗号分隔/);
  assert.match(picker, /PLATFORM_NPC_TAGS\.map/);
  assert.match(picker, /自定义标签/);
  // 功能注释：地点页已撤势力整块；人物仍可读所属势力字段
  assert.doesNotMatch(panel, /title="势力"/);
  assert.match(panel, /所属势力/);
  assert.match(panel, /factionId/);
  assert.match(panel, /onMergeNpcs/);
});

test('npcEditor_线路AI须回写人物资料', () => {
  const paths = readFileSync(join(romance, 'components/ModPathsEditor.tsx'), 'utf8');
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(paths, /onMergeNpcs/);
  assert.match(paths, /约300字/);
  assert.match(paths, /platformNpcTagsPromptLine/);
  assert.match(paths, /"npcs"/);
  assert.doesNotMatch(paths, /开局势力（玩家勾选加入）/);
  assert.doesNotMatch(panel, /① 基础 → 势力/);
});

test('npcEditor_世界生成人物契约含完整资料校验', () => {
  const gen = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  const detail = readFileSync(join(romance, 'lib/worldGenProgressDetail.ts'), 'utf8');
  assert.match(gen, /按配额短小传|npcBioChars/);
  assert.match(gen, /人物缺少姓名|人物「\$\{name\}」缺少性别|小传过短/);
  assert.match(gen, /platformNpcTagsPromptLine/);
  assert.match(gen, /bio\.length < 40/);
  assert.match(detail, /npcBioChars:\s*120/);
  assert.doesNotMatch(gen, /约 300 字 bio/);
});

test('npcEditor_PersonContent含factionId', () => {
  const content = readFileSync(join(romance, 'worlds/star2005/content.ts'), 'utf8');
  assert.match(content, /factionId\?:/);
});

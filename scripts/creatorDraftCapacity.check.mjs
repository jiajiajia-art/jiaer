/**
 * 回归：创作入口草稿上限以服务端 capacity 为准（产品 30 部），已满文案必须带 count/limit。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CREATOR_DRAFT_LIMIT,
  formatDraftLimitReachedMessage,
  isDraftCapacityFull,
} from '../src/utils/creatorDraftCapacity.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('草稿容量工具_上限30且已满文案含分数', () => {
  assert.equal(CREATOR_DRAFT_LIMIT, 30);
  assert.equal(formatDraftLimitReachedMessage(30, 30), '草稿已满（30/30），先发布或删除一部');
  assert.equal(isDraftCapacityFull({ canCreate: false, count: 30, limit: 30 }), true);
  assert.equal(isDraftCapacityFull({ canCreate: true, count: 29, limit: 30 }), false);
  assert.equal(isDraftCapacityFull({ count: 30, limit: 30 }), true);
  assert.equal(isDraftCapacityFull(null), false);
});

test('创作入口_草稿已满仅依赖服务端canCreate_文案带来自capacity的分数', () => {
  const createType = readFileSync(join(root, 'src/page/CreateType.tsx'), 'utf8');
  const api = readFileSync(join(root, 'src/api/creator/creatorDraftApi.ts'), 'utf8');
  const panel = readFileSync(join(root, 'src/components/Create/CreatorWorksPanel.tsx'), 'utf8');

  assert.match(api, /getCapacity:\s*\(\)\s*=>/);
  assert.match(api, /\/auth\/games\/drafts\/capacity/);
  assert.match(createType, /creatorDraftApi\.getCapacity\(\)/);
  assert.match(createType, /formatDraftLimitReachedMessage\(capacity\.count,\s*capacity\.limit\)/);
  assert.doesNotMatch(createType, /toast\.error\('草稿已满，先发布或删除一部'\)/);
  assert.doesNotMatch(createType, /limit\s*[:=]\s*10\b/);
  assert.match(panel, /formatDraftLimitReachedMessage\(draftCapacity\.count,\s*draftCapacity\.limit/);
  assert.match(panel, /getUserData\(\{\s*limit:\s*200\s*\}\)/);
});

test('创作入口_已满时跳转书架全部且禁止再选类型', () => {
  const createType = readFileSync(join(root, 'src/page/CreateType.tsx'), 'utf8');
  assert.match(createType, /setDraftLimitReached\(true\)/);
  assert.match(createType, /navigate\('\/bookshelf\?tab=all'/);
  assert.match(createType, /if \(draftLimitReached\)/);
  assert.match(createType, /disabled=\{createBlocked \|\| draftLimitReached\}/);
});

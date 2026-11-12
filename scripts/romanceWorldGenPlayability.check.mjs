/** 生成世界 · 可玩性检查：兜底条件过多 / 无结局 / 规则全空 / 事件全无后果 时给出整改意见 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const romance = join(dirname(fileURLToPath(import.meta.url)), '..', 'Romance', 'src');
const load = (p) => import(pathToFileURL(join(romance, p)).href);
const ctx = { content: { customAttrs: [{ id: 'insight', label: '洞察' }] }, settingText: '' };

test('playability_主线条件大多靠兜底时打回', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const { auditWorldGenPlayability } = await load('lib/worldGenPlayability.ts');
  const raw = {
    storylines: [{ id: 'm', name: '主线', nodes: [
      { id: 'a', name: '入住', desc: '办理入住', conds: [{ kind: 'metric', key: 'fame', op: 'gte', value: 1 }] },
      { id: 'b', name: '察觉', desc: '发现异常', conds: [] },
      { id: 'c', name: '面对', desc: '正面对峙', conds: [{ kind: 'metric', key: 'insight', op: 'gte', value: 30 }] },
    ] }],
    endings: [{ id: 'good', name: '好结局' }],
  };
  const patch = gen.sanitizeWorldGenBatchPatch(['storylines'], raw, ctx);
  const issues = auditWorldGenPlayability(['storylines'], patch, raw);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /入住、察觉/);
});

test('playability_条件有效且有结局时通过', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const { auditWorldGenPlayability } = await load('lib/worldGenPlayability.ts');
  const raw = {
    storylines: [{ id: 'm', name: '主线', nodes: [
      { id: 'a', name: '入住', desc: '办理入住', conds: [{ kind: 'metric', key: 'insight', op: 'gte', value: 5 }] },
      { id: 'b', name: '察觉', desc: '发现异常', conds: [{ kind: 'stat', key: '洞察', op: 'gte', value: 20 }] },
    ] }],
    endings: [{ id: 'good', name: '好结局' }],
  };
  const patch = gen.sanitizeWorldGenBatchPatch(['storylines'], raw, ctx);
  assert.deepEqual(auditWorldGenPlayability(['storylines'], patch, raw), []);
});

test('playability_无结局与规则全空', async () => {
  const gen = await load('lib/worldGenGenerate.ts');
  const { auditWorldGenPlayability } = await load('lib/worldGenPlayability.ts');
  const raw = { gameRules: [{ id: 'r1', name: '空规则', when: 'week', branches: [{ conds: [] }] }] };
  const patch = gen.sanitizeWorldGenBatchPatch(['gameRules'], raw, ctx);
  assert.equal(patch.gameRules, undefined);
  assert.match(auditWorldGenPlayability(['gameRules'], patch, raw)[0], /玩法规则全部/);
  assert.match(auditWorldGenPlayability(['storylines'], { storylines: [] }, {}).join(), /缺少主线.*缺少结局/);
});

test('playability_固定事件全无后果时打回', async () => {
  const { auditWorldGenPlayability } = await load('lib/worldGenPlayability.ts');
  const evs = { fixedEvents: [{ id: 'e1', name: 'a' }, { id: 'e2', name: 'b' }] };
  assert.match(auditWorldGenPlayability(['fixedEvents'], evs)[0], /固定事件全部/);
  evs.fixedEvents[0].effects = [{ kind: 'metric', key: 'c:insight', delta: 1 }];
  assert.deepEqual(auditWorldGenPlayability(['fixedEvents'], evs), []);
});

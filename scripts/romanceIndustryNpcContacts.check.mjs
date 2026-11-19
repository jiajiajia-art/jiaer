/**
 * 无娱乐圈/行业内容时：开局不捏造随机艺人；人脉列表不并入「新人 · 自由艺人」花名册。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('generateIndustry_无公司内容池时返回空花名册', () => {
  const logic = read('Romance/src/game/logic.ts');
  assert.match(logic, /function generateIndustry/);
  assert.match(logic, /COMPANIES\.length === 0\) return \{ companies: \[\], npcs: \[\] \}/);
  assert.doesNotMatch(logic, /COMPANIES\.length > 0 \? COMPANIES\.length : rng\(5,\s*8\)/);
});

test('NpcTab_无人行业公司时不并入sim\.npcs花名册', () => {
  const npc = read('Romance/src/components/NpcTab.tsx');
  assert.match(npc, /COMPANIES\.length > 0/);
  // 无行业公司时 poolKnown 为 []，不把 sim.npcs 并进友好度分组
  assert.match(npc, /const poolKnown/);
  assert.match(npc, /COMPANIES\.length > 0\s*\?[\s\S]*?:\s*\[\]/);
  // 仍保留已结识的作品人物列表
  assert.match(npc, /game\.npcs\.filter\(\(n\) => metSet\.has\(n\.id\)/);
});

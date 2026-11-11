/**
 * 玩法 Mod 工坊：PLAY_STEPS 与 PLAY_STEP_KEY 必须等长，否则最后一步渲染读 undefined[1] 崩页。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workshop = readFileSync(join(root, 'Romance/src/components/ModWorkshop.tsx'), 'utf8');
const stepsLib = readFileSync(join(root, 'Romance/src/lib/modWorkshopSteps.ts'), 'utf8');

test('PLAY_STEPS_与PLAY_STEP_KEY等长_禁止缺引擎平衡下标', () => {
  const playBlock = workshop.match(/const PLAY_STEPS = \[([\s\S]*?)\];/)?.[1];
  assert.ok(playBlock, '找不到 PLAY_STEPS');
  const stepCount = [...playBlock.matchAll(/\{\s*label:/g)].length;
  assert.equal(stepCount, 8, `PLAY_STEPS 应为 8 步（含引擎平衡），实际 ${stepCount}`);

  assert.match(stepsLib, /PLAY_STEP_KEY\s*=\s*\[0,\s*1,\s*2,\s*3,\s*4,\s*5,\s*6,\s*7\]/);
  assert.match(workshop, /from ["']\.\.\/lib\/modWorkshopSteps["']/);
  assert.match(workshop, /stepDoneFlag\(done,\s*stepKey\[i\]\)/);
  assert.doesNotMatch(workshop, /done\[stepKey\[i\]\]\[1\]/);
  // 禁止再写回只有 7 项的旧 play key（缺第 8 步）
  assert.doesNotMatch(workshop, /play\s*\?\s*\[\s*0,\s*1,\s*2,\s*3,\s*4,\s*5,\s*6\s*\]/);
});

test('stepDoneFlag_缺下标或缺行时不抛_有值才算完成', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/modWorkshopSteps.ts')).href);
  const done = [
    ['属性', 0],
    ['头衔', 2],
  ];
  assert.equal(mod.stepDoneFlag(done, 0), false);
  assert.equal(mod.stepDoneFlag(done, 1), true);
  assert.equal(mod.stepDoneFlag(done, 7), false);
  assert.equal(mod.stepDoneFlag(done, undefined), false);
  assert.equal(mod.stepDoneFlag(done, Number.NaN), false);
});

test('WORLD_STEP_KEY_长度对齐STEPS', () => {
  const worldBlock = workshop.match(/const STEPS = \[([\s\S]*?)\];/)?.[1];
  assert.ok(worldBlock, '找不到 STEPS');
  const stepCount = [...worldBlock.matchAll(/\{\s*label:/g)].length;
  assert.match(stepsLib, /WORLD_STEP_KEY\s*=\s*\[0,\s*1,\s*2,\s*3,\s*4,\s*6\]/);
  const keyCount = (stepsLib.match(/WORLD_STEP_KEY\s*=\s*\[([^\]]+)\]/)?.[1] ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean).length;
  assert.equal(keyCount, stepCount);
});

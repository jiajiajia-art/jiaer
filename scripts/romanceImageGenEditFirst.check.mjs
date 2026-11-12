/**
 * 生图弹窗：打开先编辑 → 点「开始生成」→ 结果页；参考图最多 2 张。
 * 禁止有预填词时默认 autoRun / autoApply（旧行为：一点「生图」就进生成中）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');

test('normalizeClientReferenceImages_源码契约最多两张', () => {
  // 功能注释：不动态 import platformImageGen（依赖链缺扩展名会挂）；锁实现契约
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /export function normalizeClientReferenceImages/);
  assert.match(src, /\.slice\(0, 2\)/);
  assert.match(src, /data:image/);
  assert.match(src, /https\?:/);
});

test('AiImageGen_三态文案与参考图上限', () => {
  const gen = read('components/AiImageGen.tsx');
  assert.match(gen, /phase === "busy"/);
  assert.match(gen, /开始生成/);
  assert.match(gen, /生成中…/);
  assert.match(gen, /取消生成/);
  assert.match(gen, /重新生成/);
  assert.match(gen, /使用这张图/);
  assert.match(gen, /生成结果/);
  assert.match(gen, /MAX_REFS = 2/);
  assert.match(gen, /autoRun = false/);
  assert.match(gen, /autoApply = false/);
  // 功能注释：默认不得写成 autoRun = true
  assert.doesNotMatch(gen, /autoRun = true/);
});

test('ImagePicker_打开不得因预填词自动开跑', () => {
  const picker = read('components/ImagePicker.tsx');
  // 功能注释：旧逻辑 autoRun !== false && initialPrompt → 一点生图就进生成中；必须禁止
  assert.doesNotMatch(picker, /autoRun=\{genOpts\.autoRun !== false/);
  assert.doesNotMatch(picker, /autoApply=\{genOpts\.autoApply !== false/);
  assert.match(picker, /autoRun=\{genOpts\.autoRun === true\}/);
  assert.match(picker, /autoApply=\{genOpts\.autoApply === true\}/);
  assert.match(picker, /locked=\{genPhase === "busy"\}/);
  assert.match(picker, /title="生图"/);
});

test('platformImageGen_请求体可带referenceImages', () => {
  const src = read('lib/platformImageGen.ts');
  assert.match(src, /referenceImages/);
  assert.match(src, /normalizeClientReferenceImages/);
  // 功能注释：外层取消经 options.signal 并入 localAc；fetch 用 localAc.signal + 客户端超时
  assert.match(src, /options\.signal/);
  assert.match(src, /signal: localAc\.signal/);
  assert.match(src, /CLIENT_TIMEOUT_MS/);
});

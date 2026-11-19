/**
 * 对话生成玩法：嵌入壳必须走 Codex 对话壳 + 真实玩法 SDK（apply_mod_patch），
 * 不得再堆步骤 chip / 双栏草稿卡当主界面。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workshop = readFileSync(join(root, 'Romance/src/components/ModWorkshop.tsx'), 'utf8');
const shell = readFileSync(join(root, 'Romance/src/components/PlayModCreateShell.tsx'), 'utf8');

test('玩法对话页不叠创建世界', () => {
  const app = readFileSync(join(root, 'Romance/src/App.tsx'), 'utf8');
  assert.match(app, /!shouldOpenPlayModCreate\(\) && \(shouldOpenWorldGenWizard\(\) \|\| shouldResumeWorldGenSession\(\)\)/);
  assert.match(app, /worldGenOpen && !playModCreateOpen/);
  assert.match(app, /clearWorldGenQuery\(\)/);
});

test('PlayModCreateShell_引导文案点明平台玩法SDK与对话生成', () => {
  assert.match(shell, /平台玩法 SDK/);
  assert.match(shell, /对话生成玩法/);
  assert.match(shell, /不会改人物和地点/);
});

test('ModWorkshop_嵌入壳使用CodexChat组件', () => {
  assert.match(workshop, /from "\.\/CodexChat"/);
  assert.match(workshop, /ViewSwitch/);
  assert.match(workshop, /ChatThread/);
  assert.match(workshop, /Composer/);
  assert.match(workshop, /Suggestions/);
  assert.match(workshop, /ChangeCard/);
  assert.match(workshop, /embedInShell/);
  assert.match(workshop, /玩法助手/);
});

test('ModWorkshop_玩法对话仍走apply_mod_patch与SDK版本', () => {
  assert.match(workshop, /apply_mod_patch/);
  assert.match(workshop, /completeWithTools/);
  assert.match(workshop, /PLAY_MOD_SDK_VERSION/);
  assert.match(workshop, /stripForbiddenPlayFields/);
});

/**
 * ① 基础 · 简介 200 / 剧本基调（系统提示词）4000：
 * 超限标红、拦截保存；作者态不展示作品 ID 与三栏合并说明。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');

test('modBasicInfoLimits_字数闸门', async () => {
  const lim = await import(pathToFileURL(join(romance, 'lib/modBasicInfoLimits.ts')).href);
  assert.equal(lim.MOD_DESC_MAX, 200);
  assert.equal(lim.SCRIPT_TONE_MAX, 4000);
  assert.equal(lim.isModDescOverLimit('字'.repeat(200)), false);
  assert.equal(lim.isModDescOverLimit('字'.repeat(201)), true);
  assert.equal(lim.isScriptToneOverLimit('字'.repeat(4000)), false);
  assert.equal(lim.isScriptToneOverLimit('字'.repeat(4001)), true);
  assert.equal(lim.validateModBasicInfoLimits({ description: '短', scriptTone: '短' }), null);
  assert.equal(
    lim.validateModBasicInfoLimits({ description: '字'.repeat(201), scriptTone: '短' }),
    '简介最多 200 字',
  );
  assert.equal(
    lim.validateModBasicInfoLimits({ description: '短', scriptTone: '字'.repeat(4001) }),
    '剧本基调最多 4000 字',
  );
});

test('ModEditorPanel_简介与基调计数标红并拦截保存', () => {
  assert.match(panel, /validateModBasicInfoLimits/);
  assert.match(panel, /MOD_DESC_MAX/);
  assert.match(panel, /SCRIPT_TONE_MAX/);
  assert.match(panel, /descOver \? "text-coral"/);
  assert.match(panel, /toneOver \? "text-coral"/);
  assert.match(panel, /max-h-\[9\.5rem\]/);
  assert.match(panel, /剧本基调（系统提示词）/);
  assert.match(panel, /rows=\{3\}/);
  assert.doesNotMatch(panel, /rows=\{8\}/);
});

test('ModEditorPanel_作者态删除作品ID与合并说明', () => {
  const simplifyBranch = panel.slice(
    panel.indexOf('authorSimplify ? ('),
    panel.indexOf(') : (', panel.indexOf('authorSimplify ? (')),
  );
  assert.match(simplifyBranch, /简介/);
  assert.match(simplifyBranch, /剧本基调（系统提示词）/);
  assert.doesNotMatch(simplifyBranch, /作品 ID/);
  assert.doesNotMatch(simplifyBranch, /保存时自动生成/);
  assert.doesNotMatch(simplifyBranch, /GM 开场白/);
  assert.doesNotMatch(simplifyBranch, /世界观设定 \/ 叙事口吻/);
  assert.doesNotMatch(simplifyBranch, /由原「GM/);
  assert.match(panel, /名称 · 简介 · 剧本基调/);
  assert.doesNotMatch(panel, /名称 · 简介 · 作品 ID/);
});

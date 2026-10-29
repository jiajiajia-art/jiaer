/**
 * 配置生效审计（静态证据）：草稿/预览/selection/applied 加载入口
 * 不声称浏览器实测；用源码断言固定「看起来全表单失效」的高危路径。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('审计_作者预览只改applied不改selection_建角会commitSelection覆盖', () => {
  const reg = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');
  const create = readFileSync(join(romance, 'components/CharacterCreate.tsx'), 'utf8');
  const begin = reg.slice(reg.indexOf('export function beginAuthorPreviewMod'), reg.indexOf('export function endAuthorPreviewMod'));
  // 预览只写 applied + authorPreviewMod，不调用 selectWorld / 不改 selection
  assert.match(begin, /authorPreviewMod\s*=\s*mod/);
  assert.match(begin, /applied\s*=/);
  assert.doesNotMatch(begin, /selectWorld|selection\s*=/);
  // 建角页无条件 commitSelection → 会把 applied 打回当前 selection（常为 ent）
  assert.match(create, /useEffect\(\(\)\s*=>\s*\{\s*commitSelection\(\);\s*\},\s*\[modSel\.world/);
  assert.match(create, /commitSelection\(\);\s*\/\/\s*所选世界观/);
  assert.doesNotMatch(create, /isAuthorPreview/);
});

test('审计_编辑器保存只写userMods不自动选中世界观', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  const saveBlock = panel.slice(panel.indexOf('const save = '), panel.indexOf('const cancel ='));
  assert.match(saveBlock, /importModJson/);
  assert.doesNotMatch(saveBlock, /selectWorld|commitSelection|activateWorld/);
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  assert.doesNotMatch(wiz, /selectWorld\(|commitSelection\(/);
});

test('审计_开局资金与手机预装有真实读取点_且仅新开局', () => {
  const data = readFileSync(join(romance, 'game/data.ts'), 'utf8');
  const logic = readFileSync(join(romance, 'game/logic.ts'), 'utf8');
  const phone = readFileSync(join(romance, 'components/Phone.tsx'), 'utf8');
  const cfg = readFileSync(join(romance, 'lib/phoneAppsConfig.ts'), 'utf8');
  assert.match(data, /export const startMoney[\s\S]*slot\("startMoney"/);
  assert.match(logic, /money = startMoney\(\)/);
  assert.match(cfg, /export function preinstallIds/);
  assert.match(phone, /defaultInstalled = \(\) => preinstallIds\(worldPhoneAppsCfg\(\)/);
  // 有存档 installed 时不重算预装
  assert.match(phone, /Array\.isArray\(raw\.installed\) \? raw\.installed : defaultInstalled\(\)/);
});

test('审计_功能开关受内容槽约束_仅开开关不够', () => {
  const reg = readFileSync(join(romance, 'mods/registry.ts'), 'utf8');
  assert.match(reg, /FEATURE_NEEDS/);
  assert.match(reg, /industryTab:\s*\(\)\s*=>\s*hasSlot\("industry"\)/);
  assert.match(reg, /career:\s*\(w\)\s*=>\s*w\.content\.gigs\.length\s*>\s*0\s*\|\|\s*hasSlot\("projects"\)/);
  assert.match(reg, /pregnancy:\s*\(w\)\s*=>\s*w\.content\.features\.pregnancy\s*===\s*true/);
  assert.match(reg, /if \(w\.content\.features\[k\] === false\) return false/);
});

test('审计_开场白与事件结算有读取点', () => {
  const opening = readFileSync(join(romance, 'components/Opening.tsx'), 'utf8');
  const fixed = readFileSync(join(romance, 'game/fixedEvents.ts'), 'utf8');
  const gctx = readFileSync(join(romance, 'store/GameContext.tsx'), 'utf8');
  assert.match(opening, /getWorldSlot\("opening"\)/);
  assert.match(fixed, /applyEffectList/);
  assert.match(fixed, /next\.bag\.push/);
  assert.match(gctx, /opts\?\.fx/);
  assert.match(gctx, /m\.money/);
});

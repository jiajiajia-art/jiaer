/**
 * 封面叠字标题样式：示例预设 + 提示词优先覆盖；黄油体 Vite 打包。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePosterTitleStyleFromPrompt,
  promptHasTitleStyleRequest,
  resolveEffectivePosterTitleStyle,
  resolvePosterTitleStyle,
} from '../src/lib/galgame/posterTitleStyle.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('resolvePosterTitleStyle_经典白字与黄字蓝描边', () => {
  assert.equal(resolvePosterTitleStyle('classic').fill, '#ffffff');
  assert.equal(resolvePosterTitleStyle('classic').stroke, null);
  const neon = resolvePosterTitleStyle('cheeseNeon');
  assert.equal(neon.fill, '#FFE566');
  assert.equal(neon.stroke, '#2B6CFF');
  assert.ok(neon.shadowBlurRatio <= 0.32, '示例外发光应收敛避免 WordArt');
  assert.equal(resolvePosterTitleStyle('unknown').id, 'classic');
});

test('promptHasTitleStyleRequest_画面词不算标题样式', () => {
  assert.equal(promptHasTitleStyleRequest('雨夜霓虹、外卖骑手'), false);
  assert.equal(promptHasTitleStyleRequest('标题用黄字蓝描边'), true);
  assert.equal(promptHasTitleStyleRequest('艺术黄油体外发光'), true);
});

test('resolveEffectivePosterTitleStyle_提示词覆盖示例预设', () => {
  const fromPreset = resolveEffectivePosterTitleStyle({
    presetId: 'classic',
    prompt: '冷色调、顶部留白',
  });
  assert.equal(fromPreset.id, 'classic');
  assert.equal(fromPreset.fill, '#ffffff');

  const fromPrompt = resolveEffectivePosterTitleStyle({
    presetId: 'classic',
    prompt: '标题帮我按艺术奶酪体，颜色黄色外发光，蓝色描边',
  });
  assert.equal(fromPrompt.fromPrompt, true);
  assert.equal(fromPrompt.fill, '#FFE566');
  assert.equal(fromPrompt.stroke, '#2B6CFF');
  assert.match(fromPrompt.fontFamily, /PingFang|Microsoft YaHei/);
});

test('parsePosterTitleStyleFromPrompt_红字无描边', () => {
  const parsed = parsePosterTitleStyleFromPrompt('标题红字，不要描边');
  assert.ok(parsed);
  assert.equal(parsed.fill, '#FF6B8A');
  assert.equal(parsed.stroke, null);
});

test('parsePosterTitleStyleFromPrompt_字体白色与红色描边', () => {
  const parsed = parsePosterTitleStyleFromPrompt('红色描边、字体白色,艺术奶酪体');
  assert.ok(parsed);
  assert.equal(parsed.fill, '#FFFFFF');
  assert.equal(parsed.stroke, '#FF6B8A');
  assert.match(parsed.fontFamily, /PingFang|Microsoft YaHei/);
});

test('parsePosterTitleStyleFromPrompt_海报风格收敛发光', () => {
  const parsed = parsePosterTitleStyleFromPrompt('艺术奶酪体，海报风格，黄字蓝描边');
  assert.ok(parsed);
  assert.ok(parsed.shadowBlurRatio <= 0.2);
});

test('封面主路径模型画字_不再托管黄油体文件', () => {
  assert.equal(existsSync(join(root, 'public/font/ZCOOLQingKeHuangYou-Regular.woff2')), false);
  assert.equal(existsSync(join(root, 'public/font/ZCOOLQingKeHuangYou-Regular.woff')), false);
  assert.equal(existsSync(join(root, 'src/lib/galgame/posterTitleFonts.ts')), false);
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.doesNotMatch(tsx, /ensureCheesePosterFontLoaded/);
  assert.doesNotMatch(tsx, /posterTitleFonts/);
  const css = read('src/components/GameSettingEditor/WorldPanel/WorldPanel.module.css');
  assert.doesNotMatch(css, /ZCOOL QingKe HuangYou/);
});

test('CoverUpload_示例写入AI提示词', () => {
  const tsx = read('src/components/GameSettingEditor/WorldPanel/CoverUpload.tsx');
  assert.match(tsx, /buildCoverAiCreativePrompt/);
  assert.match(tsx, /abArm:\s*'control'/);
  assert.doesNotMatch(tsx, /titleStyleId|POSTER_TITLE_STYLE_ORDER/);
});

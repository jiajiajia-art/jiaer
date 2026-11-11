/**
 * 开场剧情 + 编辑器 AI 对话统一：实时预览 / AI 对话切换、计费文案可读、粘贴 HTML 保留、删固定事件脚注。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('CodexChat_ViewSwitch与计费徽章为统一入口', () => {
  const src = read('Romance/src/components/CodexChat.tsx');
  assert.match(src, /export function ViewSwitch/);
  assert.match(src, /preview:\s*"实时预览"/);
  assert.match(src, /chat:\s*"AI 对话"/);
  assert.match(src, /export function AiModelBillingBadge/);
  assert.match(src, /使用你接入的模型 · 按接口计费/);
  assert.match(src, /使用平台文案模型 · 按积分计费/);
  assert.match(src, /mode === "platform"/);
  // 功能注释：计费须清晰可读，禁止缩成 10.5px 小字
  assert.match(src, /text-\[12\.5px\] font-bold/);
  assert.doesNotMatch(src, /AiModelBillingBadge[\s\S]{0,200}text-\[10\.5px\]/);
});

test('OpeningStyleStudio_预览对话切换_计费清晰_可粘贴HTML', () => {
  const src = read('Romance/src/components/OpeningStyleStudio.tsx');
  assert.match(src, /ViewSwitch/);
  assert.match(src, /AiModelBillingBadge mode="platform"/);
  assert.match(src, /completeViaPlatform/);
  assert.match(src, /moduleId: "opening-style"/);
  assert.doesNotMatch(src, /loadConfig|streamChat|isConfigured/);
  assert.doesNotMatch(src, /菜单「AI 配置」|需要先在菜单/);
  assert.match(src, /直接粘贴 HTML/);
  assert.match(src, /setPaste\(""\)/);
  assert.match(src, /粘贴代码/);
  assert.doesNotMatch(src, /text-\[10\.5px\][\s\S]{0,40}按接口计费/);
  // 功能注释：自定义开场页样式不再套一层圆角卡片大框，内容直接排在开场剧情下
  assert.doesNotMatch(src, /rounded-2xl border border-line bg-paper\/50 p-3/);
  assert.match(src, /不再套一层圆角卡片大框/);
});

test('ModEditorPanel_开场剧情删掉固定事件脚注', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const openingAt = panel.indexOf('title="开场剧情"');
  const nextAt = panel.indexOf('title="剧情美化"', openingAt);
  assert.ok(openingAt >= 0 && nextAt > openingAt);
  const sec = panel.slice(openingAt, nextAt);
  assert.match(sec, /OpeningStyleStudio/);
  assert.doesNotMatch(sec, /首次\s*\/\s*开局可触发事件/);
  assert.doesNotMatch(sec, /④ 剧情 → 固定事件/);
});

test('CoverDiy_默认与all均走ViewSwitch_禁止预览页夹AI页签', () => {
  const panel = read('Romance/src/components/CoverDiyPanel.tsx');
  assert.match(panel, /AiModelBillingBadge/);
  assert.match(panel, /ViewSwitch/);
  assert.match(panel, /mode = "switch"/);
  // CoverDiyEditor：除 live/chat 内部态外一律顶栏切换
  assert.match(panel, /mode === "live" \|\| mode === "chat"/);
  assert.match(panel, /mode \?\? "switch"/);
  // 作品展示封面只留背景：live + bgOnly；作者入口不得再挂整页自定义块
  const cover = read('Romance/src/components/ModOpeningEditor.tsx');
  assert.match(cover, /mode="live"/);
  assert.match(cover, /bgOnly/);
  assert.doesNotMatch(cover, /HtmlCover|整页自己写|沙箱全屏/);
});

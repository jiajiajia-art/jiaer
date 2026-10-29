/**
 * 开幕页：自定义 page 优先，否则内置排版读旧 opening 字段；与 AI 开局剧情分离。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('Opening_只渲染编辑器开场白_禁止手记时间地点与AI正文', () => {
  const opening = readFileSync(join(romance, 'components/Opening.tsx'), 'utf8');
  assert.match(opening, /data-opening-editor-only/);
  assert.doesNotMatch(opening, /的手记/);
  assert.doesNotMatch(opening, /故事，就从/);
  assert.doesNotMatch(opening, /此刻 ·/);
  assert.doesNotMatch(opening, /aiMode/);
  assert.doesNotMatch(opening, /firstAi/);
  assert.doesNotMatch(opening, /opening-note/);
  assert.match(opening, /copy\.paragraphs/);
  // 功能注释：无自定义页时仍走内置排版字段
  assert.match(opening, /copy\.page/);
  assert.match(opening, /旧模组字段仍由此处读取/);
});

test('App_开幕期间不得挂载GameShell', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  assert.match(app, /screen === "opening".*Opening/s);
  // 禁止 opening 与 GameShell 同屏
  assert.doesNotMatch(app, /screen === "opening" \|\| screen === "game"/);
  assert.match(app, /screen === "game".*GameShell/s);
});

test('GameContext_开局剧情应延后到进入game', () => {
  const ctx = readFileSync(join(romance, 'store/GameContext.tsx'), 'utf8');
  assert.match(ctx, /pendingOpeningPromptRef/);
  assert.match(ctx, /flushOpeningPlot/);
  assert.match(ctx, /setScreen\("opening"\)/);
  // startNew 内不得在 opening 阶段立刻 runTurn 开局
  const startIdx = ctx.indexOf('const startNew = useCallback');
  const flushIdx = ctx.indexOf('const flushOpeningPlot = useCallback');
  assert.ok(startIdx >= 0 && flushIdx > startIdx);
  const startBlock = ctx.slice(startIdx, flushIdx);
  assert.match(startBlock, /pendingOpeningPromptRef\.current\s*=/);
  assert.doesNotMatch(startBlock, /void runTurn\(/);
});

test('ModEditorPanel_开场只留外观工作室_禁止开场白表单', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(panel, /OpeningStyleStudio/);
  assert.doesNotMatch(panel, /<ModOpeningEditor/);
  assert.doesNotMatch(panel, /ui-label border-t[\s\S]{0,80}开场白/);
  // 改 page 时须展开保留旧 opening 字段
  assert.match(panel, /\.\.\.\(c\.opening \?\? \{\}\),\s*page/);
  // ModOpeningEditor 文件可留作 Cover 导出，但面板不得再挂整套输入
  const ed = readFileSync(join(romance, 'components/ModOpeningEditor.tsx'), 'utf8');
  assert.match(ed, /export default function ModOpeningEditor/);
  assert.doesNotMatch(ed, /开幕正文来源/);
});

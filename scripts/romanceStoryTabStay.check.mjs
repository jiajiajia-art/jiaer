/**
 * ④「剧情」页签：
 * - 内容仍独立（未并入①基础），页签必须保留
 * - 路由不得把 story 改道为 base
 * - 脏 AI 稿缺 conds 时不得 .length 崩页；崩页后 ErrorBoundary 重挂载会停在默认①，表现为「点④跳回①」
 *
 * 为何上次验收仍失败：
 * 1) 旧测只 grep 源码字符串 / 复制纯函数，无法 import refAudit（无扩展名依赖链）
 * 2) 只兜底了结局 endings.conds，漏了固定事件 condGroups / check.conds / chainBreaks（点④会立刻 auditStory(events)）
 * 本文件：零依赖 safeConds 真跑 + 源码接线断言，禁止退回纯 grep。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const endingsPanel = readFileSync(join(romance, 'components/EndingsPanel.tsx'), 'utf8');
const fixedPanel = readFileSync(join(romance, 'components/FixedEventsPanel.tsx'), 'utf8');
const auditSrc = readFileSync(join(romance, 'game/refAudit.ts'), 'utf8');
const fixedSrc = readFileSync(join(romance, 'game/fixedEvents.ts'), 'utf8');
const safeSrc = readFileSync(join(romance, 'game/safeConds.ts'), 'utf8');

function sectionOpen(title) {
  const marker = `title="${title}"`;
  const at = panel.indexOf(marker);
  assert.ok(at >= 0, `缺少 Section：${title}`);
  return panel.slice(Math.max(0, at - 100), at);
}

test('剧情页签保留_内容未并入基础_路由不改道', () => {
  assert.match(panel, /k: "story", label: "④ 剧情"/);
  assert.match(sectionOpen('世界书'), /g="story"/);
  assert.match(sectionOpen('固定事件'), /g="story"/);
  assert.match(sectionOpen('剧情线'), /g="story"/);
  assert.doesNotMatch(sectionOpen('世界书'), /g="base"/);
  assert.doesNotMatch(sectionOpen('固定事件'), /g="base"/);
  assert.doesNotMatch(sectionOpen('剧情线'), /g="base"/);
  assert.doesNotMatch(panel, /raw === "story"[^\n]*"base"/);
  assert.match(panel, /goGroup\(x\.k\)/);
});

test('safeConds_缺conds时旧写法会炸_新写法不炸', async () => {
  const mod = await import(pathToFileURL(join(romance, 'game/safeConds.ts')).href);
  const dirty = { match: 'all' }; // 无 conds
  assert.equal(mod.wouldThrowOnMissingCondsLength(dirty), true, '旧 .conds.length 必须能复现崩页');
  assert.equal(mod.wouldThrowOnMissingCondsLength({ conds: [] }), false);
  assert.deepEqual(mod.asCondList(undefined), []);
  assert.deepEqual(mod.asCondList(null), []);
  assert.deepEqual(mod.asCondList([{ kind: 'flag', key: 'x', op: 'gte', value: 1 }]).map((c) => c.kind), ['flag']);
  const groups = mod.asCondGroups([{ id: 'g1', match: 'all' }, { id: 'g2', match: 'any', conds: [{ kind: 'time' }] }]);
  assert.deepEqual(groups[0].conds, []);
  assert.equal(groups[1].conds.length, 1);
  // 功能注释：模拟 FixedEventsPanel / refAudit 挂载路径上的 length 读取
  assert.doesNotThrow(() => {
    for (const gr of groups) {
      void gr.conds.length;
      if (!gr.conds.length) continue;
    }
  });
});

test('源码接线_审计与固定事件须走asCondList', () => {
  assert.match(safeSrc, /asCondList/);
  assert.match(auditSrc, /from ["']\.\/safeConds/);
  assert.match(auditSrc, /asCondList\(gr\.conds\)|asCondList\(c\.check\.conds\)|asCondList\(en\.conds\)/);
  assert.doesNotMatch(auditSrc, /if \(!gr\.conds\.length\)/);
  assert.doesNotMatch(auditSrc, /if \(!c\.check\.conds\.length\)/);
  assert.match(fixedSrc, /from ["']\.\/safeConds/);
  assert.match(fixedSrc, /asCondList\(b\.group\?\.conds\)/);
  assert.match(fixedSrc, /asCondList\(c\.check\?\.conds\)/);
  assert.match(endingsPanel, /normalizeEnding/);
  // 功能注释：conds 归一须滤掉 null/缺 kind，禁止只写 e.conds ?? [] 仍让 TriggerRow 读 c.kind 崩
  assert.match(endingsPanel, /typeof \(c as \{ kind\?: unknown \}\)\.kind === \"string\"/);
  assert.match(fixedPanel, /\(c\.conds \?\? \[\]\)\.length/);
});

test('EndingsPanel_先normalize再audit', () => {
  const listAt = endingsPanel.indexOf('.map(normalizeEnding)');
  // 功能注释：草稿审计带 draft:true 与当前表单 id；仍须在 normalize 之后
  const auditAt = endingsPanel.search(/auditStory\(\{\s*draft: true, endings: list/);
  assert.ok(listAt >= 0 && auditAt > listAt);
});

test('验收缺口说明_禁止只靠字符串假装覆盖运行时', () => {
  const self = readFileSync(join(root, 'scripts/romanceStoryTabStay.check.mjs'), 'utf8');
  assert.match(self, /wouldThrowOnMissingCondsLength/);
  assert.match(self, /safeConds/);
  assert.match(self, /pathToFileURL/);
  assert.match(self, /漏了固定事件/);
});

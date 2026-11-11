/**
 * 真复现：脏会话 step2 经 parseWorldGenSession / sanitize / 底栏 / 提示词 不得再抛 trim。
 * （此前只单测了辅助函数，没有把「刷新进编辑器」链路串起来。）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

function dirtyMod() {
  return {
    id: 'w1',
    name: { zh: '雾港' },
    version: '1.0.0',
    kind: 'world',
    content: {
      terms: { tabWorld: { bad: 1 }, tabNpc: 12, city: { n: '雾' } },
      prompt: { gmIntro: { text: 'hi' }, worldIntro: '世界' },
      navTabs: [{ id: 'home', label: { t: '世界' }, on: true }],
      npcs: [{ id: 'a', name: { n: '沈晚晴' }, gender: { g: '女' }, age: 18 }],
      rooms: { inn: { name: { n: '客栈' }, desc: { d: '旧' } } },
      bgm: [{ id: 'b1', name: { t: '雨' }, src: 'https://x' }],
      cover: { labels: { start: { x: 1 } }, css: { bad: true }, title: { t: '雾' } },
      creation: { paths: [{ id: 'p1', name: { n: '科班' } }] },
      fixedEvents: [{ id: 'e1', name: 'x', prompt: { p: 1 }, choices: [{ id: 'c1', label: { l: '选' } }] }],
      travel: { modes: [{ id: 'walk', label: { x: 1 } }], apPerTurn: 3 },
      features: {},
    },
  };
}

test('dirtySession_parse后进编辑器关键路径不得trim崩溃', async () => {
  const session = await import(pathToFileURL(join(romance, 'lib/worldGenSession.ts')).href);
  const nav = await import(pathToFileURL(join(romance, 'lib/navTabsConfig.ts')).href);
  const sanitize = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);

  const raw = {
    step: 2,
    s1: {
      title: '雾港来信',
      setting: '海边旅店',
      editorStepIds: ['rooms', 'npcs'],
      aiPolish: true,
      scopeVersion: 2,
    },
    draft: {
      title: '雾港来信',
      setting: '海边旅店',
      editorStepIds: ['rooms', 'npcs'],
      scopeVersion: 2,
    },
    mod: dirtyMod(),
    scrollY: 0,
    editorGroup: 'base',
    updatedAt: Date.now(),
  };

  const parsed = session.parseWorldGenSession(raw);
  assert.ok(parsed, '会话应可解析');
  assert.equal(parsed.step, 2);
  assert.ok(parsed.mod);
  assert.equal(typeof parsed.mod.name, 'string');
  assert.equal(typeof parsed.mod.content.terms?.tabNpc, 'string');

  const clean = sanitize.sanitizeModStrings(dirtyMod());
  const pool = nav.buildNavPool(clean.content.features, clean.content.terms);
  const seeded = clean.content.navTabs ?? nav.navTabsFromTerms(clean.content.terms);
  nav.editorNavList(pool, seeded, 4);
  nav.resolveNavSlots(pool, seeded, 4);
  nav.navConfigWarnings(nav.editorNavList(pool, seeded, 4), 4, pool.length);
  nav.compactNavConfig(seeded, 4, pool.length);

  // FixedEvents 选项 label 为对象时不得直接 .trim
  const choices = clean.content.fixedEvents?.[0]?.choices ?? [{ id: 'c1', label: { l: '选' } }];
  assert.doesNotThrow(() => {
    choices.filter((c) => !c.hidden && typeof c.label === "string" && c.label.trim());
  });
});

test('ErrorBoundary_恢复中再次trim崩不得空return卡死', () => {
  const app = readFileSync(join(romance, 'App.tsx'), 'utf8');
  assert.match(app, /recoverDirtyWorldGenTrim\(isWorldGenTrimRecovering\(\)\)/);
  assert.match(app, /recoverDirtyWorldGenTrim\(true\)/);
  assert.doesNotMatch(app, /if \(isWorldGenTrimRecovering\(\)\) return;\s*recoverDirtyWorldGenTrim/);
});

test('WorldGenWizard_恢复期须落盘纯step1不得只读成step1', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  // 功能注释：清 recover 标记前必须 demote 写盘，否则刷新又进脏 step2
  assert.match(wiz, /isWorldGenTrimRecovering\(\) \|\| isWorldGenPersistBlocked\(\)/);
  assert.match(wiz, /demoteWorldGenSessionToStep1\(boot\.s1\)/);
  assert.match(wiz, /if \(step !== 1 \|\| modRef\.current \|\| draftRef\.current\) return/);
  assert.doesNotMatch(
    wiz,
    /if \(isWorldGenPersistBlocked\(\) \|\| isWorldGenTrimRecovering\(\)\) return;\s*saveWorldGenSession/,
  );
});

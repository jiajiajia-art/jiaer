/**
 * 生成世界 · 进度明细与瘦身：进行中展示具体产出、完成后可看摘要、全选禁灌满长文。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');

test('worldGenProgressDetail_进行中文案须具体到婚姻条目线路', async () => {
  const d = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);
  assert.match(d.worldGenStepRunningDetail('hub:rules'), /婚姻.*姓氏.*生育/);
  assert.match(d.worldGenStepRunningDetail('hub:book'), /条目名/);
  assert.match(d.worldGenStepRunningDetail('hub:paths'), /线路名/);
  assert.match(
    d.worldGenStepRunningDetail('hub:book', { names: ['雾港潮汐', '旅店规矩'] }),
    /正在写条目：雾港潮汐、旅店规矩/,
  );
  assert.match(
    d.worldGenStepRunningDetail('hub:paths', { names: ['旅店继承人'], phase: 'enrich' }),
    /正在补线路细节：旅店继承人/,
  );
  assert.doesNotMatch(d.worldGenStepRunningDetail('hub:rules'), /^进行中$/);
});

test('worldGenProgressDetail_完成后摘要可点开内容', async () => {
  const d = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);
  assert.match(
    d.worldGenStepResultSummary('hub:rules', {
      worldRules: [{ id: 'm', name: '婚姻' }, { id: 's', name: '姓氏' }],
    }),
    /世界规则 2 条/,
  );
  assert.match(
    d.worldGenStepResultSummary('hub:book', {
      worldBook: [{ id: 'a', title: '雾港潮汐' }, { id: 'b', title: '旅店规矩' }],
    }),
    /世界书 2 条.*雾港潮汐/,
  );
  assert.match(
    d.worldGenStepResultSummary('hub:paths', {
      creation: { paths: [{ id: 'p1', name: '旅店继承人' }] },
    }),
    /人物线路：旅店继承人/,
  );
});

test('worldGenProgressDetail_全选须瘦身条数且骨架优先', async () => {
  const d = await import(pathToFileURL(join(romance, 'lib/worldGenProgressDetail.ts')).href);
  const lean = d.worldGenLeanLimits(11);
  const few = d.worldGenLeanLimits(3);
  assert.ok(lean.worldBookEntries <= 3);
  assert.ok(lean.npcs <= 3);
  assert.ok(lean.paths <= 2);
  assert.ok(lean.scriptToneChars < 1200);
  assert.ok(lean.npcBioChars <= 120);
  assert.ok(few.npcs >= lean.npcs);
  assert.ok(few.scriptToneChars >= lean.scriptToneChars);
  assert.equal(d.worldGenBatchNeedsEnrich(['travelTime']), false);
  assert.equal(d.worldGenBatchNeedsEnrich(['hub:book', 'prompt']), true);
  assert.match(d.worldGenLeanPromptBlock(lean, 'skeleton'), /骨架优先|禁止灌满长文/);
  assert.match(d.worldGenLeanPromptBlock(lean, 'enrich'), /补长文|禁止新增/);
});

test('worldGenGenerate_进度按细项展示且同类仍合并请求', async () => {
  const gen = await import(pathToFileURL(join(romance, 'lib/worldGenGenerate.ts')).href);
  const wiz = await import(pathToFileURL(join(romance, 'lib/worldGenWizard.ts')).href);

  const init = gen.makeInitialProgress(['hub:rules', 'hub:book', 'hub:paths', 'npcs']);
  assert.deepEqual(
    init.modules.map((m) => m.id).sort(),
    ['hub:book', 'hub:paths', 'hub:rules', 'npcs'].sort(),
  );
  assert.ok(init.modules.every((m) => m.batchId));
  assert.equal(new Set(init.modules.map((m) => m.batchId)).size, 2, '规则书合并世界规则；人物线路与人物合并');

  const draft = {
    ...wiz.defaultWorldGenStep1(),
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    editorStepIds: ['hub:rules', 'hub:book', 'hub:paths', 'npcs'],
    contentIds: wiz.contentIdsFromEditorSteps(['hub:rules', 'hub:book', 'hub:paths', 'npcs']),
  };
  const seed = wiz.draftModFromWorldGen(draft);
  const { meta: _m, ...seedMod } = seed;
  void _m;

  const details = [];
  let calls = 0;
  const result = await gen.runWorldGenModules({
    draft,
    seedMod,
    moduleIds: draft.editorStepIds,
    onProgress: (p) => {
      for (const m of p.modules) {
        if (m.status === 'running' && m.detail) details.push(`${m.id}:${m.detail}`);
      }
    },
    completeFn: async (_cfg, messages) => {
      calls += 1;
      const last = String(messages[messages.length - 1].content);
      // 功能注释：瘦身提示里也有「世界书」字样，只能用「当前大类」标题分流
      if (last.includes('当前大类：「世界规则」')) {
        return JSON.stringify({
          content: {
            worldRules: [
              { id: 'marriage', name: '婚姻' },
              { id: 'surname', name: '姓氏' },
              { id: 'birth', name: '生育' },
            ],
            worldBook: [
              { id: 'tide', title: '雾港潮汐', keywords: ['潮汐'], content: '海边潮汐决定码头作息。' },
            ],
          },
        });
      }
      if (!last.includes('当前大类：「人物与线路」')) {
        throw new Error(`意外大类提示: ${last.slice(0, 120)}`);
      }
      return JSON.stringify({
        content: {
          npcs: [{
            id: 'n1',
            name: '阿宁',
            gender: '女',
            age: 28,
            bio: '阿宁是雾港海边旅店的店主，性格温柔，擅长照顾客人并记住每位常客的口味与心事。她从小在码头长大，熟悉潮汐与渔汛，也会在风雨夜里把灯火留得更亮一些。',
          }],
          creation: { paths: [{ id: 'p1', name: '旅店继承人' }] },
        },
      });
    },
    cfg: { baseUrl: 'https://example.test/v1', apiKey: 'k', model: 'm' },
  });

  assert.ok(calls >= 2 && calls <= 6, `同类合并后应为 2 大类×骨架/补文（含重试余量），实际 ${calls}`);
  assert.equal(result.progress.doneCount, 4);
  assert.ok(details.some((x) => /hub:rules:.*婚姻/.test(x)), `须出现世界规则明细，实际=${details.slice(0, 8).join('|')}`);
  assert.ok(
    result.progress.modules.every((m) => m.status !== 'done' || (m.summary && m.summary.length > 0)),
    '完成项须带可点开摘要',
  );
  const book = result.progress.modules.find((m) => m.id === 'hub:book');
  assert.match(book?.summary || '', /雾港潮汐|世界书/);
  const path = result.progress.modules.find((m) => m.id === 'hub:paths');
  assert.match(path?.summary || '', /旅店继承人/);
  assert.ok(result.mod.content.worldBook?.some((e) => e.title === '雾港潮汐'));
  assert.ok(result.mod.content.creation?.paths?.some((p) => p.name === '旅店继承人'));
});

test('worldGenWizard_进度UI须展示明细与摘要展开', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const gen = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(wiz, /world-gen-mod-detail/);
  assert.match(wiz, /查看生成摘要|收起生成摘要/);
  assert.match(wiz, /expandedSummaryIds/);
  assert.match(wiz, /worldGenBatchProgressCounts/);
  assert.doesNotMatch(wiz, /if \(status === "running"\) return "进行中"/);
  assert.match(gen, /worldGenStepRunningDetail|onBatchProgress/);
  assert.match(gen, /worldGenLeanLimits|骨架阶段|补长文/);
  assert.doesNotMatch(gen, /setInterval/);
});

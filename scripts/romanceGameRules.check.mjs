/**
 * 玩法规则缺 branches 时不得再 reading 'map'。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('normalizeRuleBranches_缺分支或单条对象都收成数组', async () => {
  const { normalizeRuleBranches } = await import(pathToFileURL(join(romance, 'lib/gameRuleShape.ts')).href);
  assert.deepEqual(normalizeRuleBranches(undefined), []);
  assert.equal(normalizeRuleBranches({ conds: [{ kind: 'metric' }], effects: [{ kind: 'metric' }] }).length, 1);
  const wrapped = normalizeRuleBranches({ list: [{ conds: [], effects: [{ kind: 'flag' }] }] });
  assert.deepEqual(wrapped[0].effects, [{ kind: 'flag' }]);
  assert.deepEqual(normalizeRuleBranches([{ notice: '热度' }])[0].conds, []);
});

test('sanitizeModStrings_玩法规则缺branches须补成空数组', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      gameRules: [
        { id: 'r1', name: '过劳', when: 'day' },
        { id: 'r2', name: '单支', when: 'week', branches: { conds: [{ kind: 'metric', key: 'energy' }], effects: [{ kind: 'metric', key: 'stress', delta: 1 }] } },
      ],
    },
  });
  assert.deepEqual(clean.content.gameRules[0].branches, []);
  assert.equal(clean.content.gameRules[1].branches.length, 1);
  assert.equal(Array.isArray(clean.content.gameRules[1].branches[0].conds), true);
  assert.equal(clean.content.gameRules[1].branches[0].effects[0].key, 'stress');
  const editor = readFileSync(join(romance, 'components/GameRulesEditor.tsx'), 'utf8');
  assert.match(editor, /normalizeRuleBranches\(raw\.branches\)/);
  assert.doesNotMatch(editor, /r\.branches\.map/);
});

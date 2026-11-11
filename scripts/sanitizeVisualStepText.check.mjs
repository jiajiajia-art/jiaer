/**
 * sanitizeVisualStepText：场景切换控制指令不得泄漏到读者文案
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  processGameTags,
  sanitizeVisualStepText,
  stripPlayStepChoiceLeakage,
} from '../src/utils/textUtils.ts';

test('processGameTags_SCENE_CHANGE应静默丢弃不拼场景切换文案', () => {
  const out = processGameTags('[SCENE_CHANGE: folk_shelter_in_alley]\n[NARRATION: 巷子里很静。]');
  assert.doesNotMatch(out, /场景切换/);
  assert.doesNotMatch(out, /folk_shelter_in_alley/);
  assert.match(out, /巷子里很静/);
});

test('sanitizeVisualStepText_应剥已泄漏的场景切换sceneId行', () => {
  const out = sanitizeVisualStepText(
    '场景切换：folk_shelter_in_alley\n你钻进窄巷，两侧都是低矮的棚屋。',
  );
  assert.doesNotMatch(out, /场景切换/);
  assert.doesNotMatch(out, /folk_shelter/);
  assert.match(out, /窄巷/);
});

test('sanitizeVisualStepText_游玩步不得把OPTION拼进正文选项列表', () => {
  const out = sanitizeVisualStepText([
    '[DIALOGUE: npc_1, 凤仪皇后, "水声里有异动。"]',
    '[CHOICE: 抉择]',
    '[OPTION: 苏小婉重新蘸了香膏]',
    '[OPTION: 苏小婉先轻声问皇后]',
    '[END_CHOICE]',
  ].join('\n'));
  assert.doesNotMatch(out, /选项[：:]/);
  assert.doesNotMatch(out, /重新蘸了香膏/);
  assert.match(out, /异动|凤仪皇后/);
});

test('stripPlayStepChoiceLeakage_应去掉已泄漏的编号选项列表', () => {
  const out = stripPlayStepChoiceLeakage(
    '唯一的机会接住。\n\n选项：\n1. 苏小婉重新蘸了香膏\n2. 苏小婉先轻声问皇后\n3. 苏小婉将软刷上多余香膏',
  );
  assert.doesNotMatch(out, /选项/);
  assert.doesNotMatch(out, /重新蘸了香膏/);
  assert.match(out, /唯一的机会接住/);
});

test('stripPlayStepChoiceLeakage_须剥接下来怎么办与粘连编号勿画成假选项', () => {
  const out = stripPlayStepChoiceLeakage([
    '檐继续推车穿过黑沉沉的小巷。',
    '【接下来怎么办？】',
    '2. 林檐在巷尾的一盏独灯下再停一下',
    '3. 林檐加快脚步，不再耽搁',
  ].join('\n'));
  assert.match(out, /推车穿过黑沉沉的小巷/);
  assert.doesNotMatch(out, /接下来怎么办|林檐在巷尾|林檐加快脚步/);
  const glued = stripPlayStepChoiceLeakage(
    '檐把车把上的铃铛轻轻按住。 2. 林檐走到巷尾那盏独灯下，特意低头看了看地上。',
  );
  assert.equal(glued, '檐把车把上的铃铛轻轻按住。');
});

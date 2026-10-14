/**
 * raw_text → 按句上屏 / 追加
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceRawTextBridgePage,
  appendRawTextBridge,
  applyRawTextBridgeDialoguePortrait,
  buildRawTextBridgeCanvasContent,
  createEmptyRawTextBridgePage,
  filterFormalStepsAfterRawAppend,
  flushRawTextBridge,
  hasRawTextBridgePagePending,
  ingestRawTextBridgePageSegments,
  isRawTextBridgeStep,
  joinRawTextBridgeSentences,
  mergeRawTextBridgeAppend,
  pickLatestDialogueStep,
  pickLatestSceneChangeStep,
  protocolTagsToVisible,
  RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT,
  shouldShowRawTextBridgeNextButton,
  splitHoldIncompleteProtocol,
  splitOpenProtocolTail,
  takeCompletedRawTextSegments,
  toRawTextBridgeDisplayStep,
  visibleRawTextBridgeUnfinished,
} from '../src/lib/story/rawTextStepBridge.ts';

test('takeCompletedRawTextSegments_应按句号切开并保留半句', () => {
  const { segments, rest } = takeCompletedRawTextSegments('你缓缓退到墙角。夜色很沉，远处');
  assert.deepEqual(segments, ['你缓缓退到墙角。']);
  assert.equal(rest, '夜色很沉，远处');
});

test('stripChoiceLeakageInline_须剥接下来怎么办与编号选项勿画成假选项UI', async () => {
  const { stripChoiceLeakageInline } = await import('../src/lib/story/rawTextStepBridge.ts');
  const dirty = [
    '檐继续推车穿过黑沉沉的小巷。',
    '【接下来怎么办？】',
    '2. 林檐在巷尾的一盏独灯下再停一下',
    '3. 林檐加快脚步，不再耽搁',
  ].join('\n');
  const cleaned = stripChoiceLeakageInline(dirty);
  assert.match(cleaned, /推车穿过黑沉沉的小巷/);
  assert.doesNotMatch(cleaned, /接下来怎么办|林檐在巷尾|林檐加快脚步/);
  const mixed = '檐把车把上的铃铛轻轻按住。 2. 林檐走到巷尾那盏独灯下，特意低头看了看地上。';
  assert.equal(stripChoiceLeakageInline(mixed), '檐把车把上的铃铛轻轻按住。');
});

test('appendRawTextBridge_多片追加后产出旁白step', () => {
  let buffer = '';
  let steps = [];
  ({ buffer, steps } = appendRawTextBridge(buffer, '月光落在青石板上'));
  assert.equal(steps.length, 0);
  ({ buffer, steps } = appendRawTextBridge(buffer, '。风从巷口灌进来。'));
  assert.equal(steps.length, 2);
  assert.equal(steps[0].type, 'narration');
  assert.equal(steps[0]._fromRawText, true);
  assert.match(steps[0].content, /月光/);
  assert.match(steps[1].content, /风从巷口/);
});

test('flushRawTextBridge_结束时应冲刷剩余', () => {
  const { steps, buffer } = flushRawTextBridge('尚未完句的尾段');
  assert.equal(buffer, '');
  assert.equal(steps.length, 1);
  assert.equal(steps[0].content, '尚未完句的尾段');
  assert.equal(isRawTextBridgeStep(steps[0]), true);
});

test('appendRawTextBridge_句号落在下一片chunk时也应立刻产出', () => {
  let buffer = '';
  let steps = [];
  ({ buffer, steps } = appendRawTextBridge(buffer, '九又四分之三站台的蒸汽像一锅煮沸的牛奶，从猩红色机车的烟囱'));
  assert.equal(steps.length, 0);
  ({ buffer, steps } = appendRawTextBridge(buffer, '。如同是无数不绝地喷出来'));
  assert.equal(steps.length, 1);
  assert.match(steps[0].content, /烟囱。$/);
  assert.match(buffer, /^如同是/);
});

test('splitHoldIncompleteProtocol_半截SCENE标签必须挂起', () => {
  const held = splitHoldIncompleteProtocol('前文[SCENE_');
  assert.equal(held.ready, '前文');
  assert.equal(held.hold, '[SCENE_');
});

test('protocolTagsToVisible_SCENE_CHANGE不得泄漏sceneId', () => {
  const out = protocolTagsToVisible(
    '[SCENE_CHANGE: queensstreetlab]\n[NARRATION: 皇后区的地下实验室像一颗被撬开的牡蛎，内脏散得到处都是。]',
  );
  assert.doesNotMatch(out, /queensstreetlab|SCENE_CHANGE|NARRATION|ANGE|ATION/);
  assert.match(out, /皇后区的地下实验室/);
});

test('未闭合NARRATION_遇句号应立刻产出不必等右括号', () => {
  const open = splitOpenProtocolTail('[NARRATION: 实验室里冷得像是有人忘了关掉一台不存在的空调。你蹲在');
  assert.equal(open.open.kind, 'narration');
  const { segments, rest } = takeCompletedRawTextSegments(
    '[SCENE_CHANGE: queensstreetlab]\n[NARRATION: 实验室里冷得像是有人忘了关掉一台不存在的空调。你蹲在',
  );
  assert.equal(segments.length, 1);
  assert.match(segments[0], /不存在的空调。$/);
  assert.doesNotMatch(segments[0], /queensstreetlab|SCENE|NARRATION/);
  assert.match(rest, /^\[NARRATION:/i);
  assert.match(rest, /你蹲在$/);
});

test('appendRawTextBridge_标签跨chunk拆开不得泄漏ANGE_ATION', () => {
  let buffer = '';
  let steps = [];
  const chunks = [
    '[SCENE_',
    'CHANGE: queensstreetlab]\n',
    '[NARR',
    'ATION: 皇后区的地下实验室像一颗被撬开的牡蛎，内脏散得到处都是。]',
  ];
  const all = [];
  for (const chunk of chunks) {
    ({ buffer, steps } = appendRawTextBridge(buffer, chunk));
    all.push(...steps.map((s) => s.content));
  }
  ({ buffer, steps } = flushRawTextBridge(buffer));
  all.push(...steps.map((s) => s.content));
  const joined = all.join('\n');
  assert.doesNotMatch(joined, /ANGE\s*:|ATION\s*:|CHANGE\s*:|queensstreetlab|SCENE_CHANGE|NARRATION/);
  assert.match(joined, /皇后区的地下实验室/);
});

test('mergeRawTextBridgeAppend_第二句应追加而非覆盖', () => {
  const first = mergeRawTextBridgeAppend(null, ['实验室里冷得像是有人忘了关掉一台不存在的空调。']);
  const second = mergeRawTextBridgeAppend(first, [
    '你蹲在一张翻倒的金属工作台旁边，指尖蹭过地面上一道淡金色的痕迹。',
  ]);
  assert.match(second.content, /^实验室里冷得像是/);
  assert.match(second.content, /淡金色的痕迹。$/);
});

test('mergeRawTextBridgeAppend_更长前缀块应直接采用不重复拼接', () => {
  const first = mergeRawTextBridgeAppend(null, ['第一句。']);
  const second = mergeRawTextBridgeAppend(first, ['第一句。第二句。']);
  assert.equal(second.content, '第一句。第二句。');
});

test('ingestRawTextBridgePageSegments_最多三句上屏其余进pending', () => {
  assert.equal(RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT, 3);
  let page = createEmptyRawTextBridgePage();
  let result = ingestRawTextBridgePageSegments(page, ['一句。', '二句。']);
  assert.equal(result.displayChanged, true);
  assert.deepEqual(result.state.displayed, ['一句。', '二句。']);
  assert.deepEqual(result.state.pending, []);
  page = result.state;

  result = ingestRawTextBridgePageSegments(page, ['三句。', '四句。', '五句。']);
  assert.equal(result.displayChanged, true);
  assert.equal(result.state.displayed.length, 3);
  assert.deepEqual(result.state.displayed, ['一句。', '二句。', '三句。']);
  assert.deepEqual(result.state.pending, ['四句。', '五句。']);
  assert.equal(hasRawTextBridgePagePending(result.state), true);
  assert.ok(result.state.displayed.length <= RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT);
  assert.match(joinRawTextBridgeSentences(result.state.displayed), /三句。$/);
});

test('advanceRawTextBridgePage_下一步应整页替换不超过三句', () => {
  let page = createEmptyRawTextBridgePage();
  page = ingestRawTextBridgePageSegments(page, [
    '一。', '二。', '三。', '四。', '五。', '六。', '七。',
  ]).state;
  assert.deepEqual(page.displayed, ['一。', '二。', '三。']);
  assert.deepEqual(page.pending, ['四。', '五。', '六。', '七。']);

  let advanced = advanceRawTextBridgePage(page);
  assert.equal(advanced.advanced, true);
  assert.equal(advanced.step?.content, '四。五。六。');
  assert.deepEqual(advanced.state.displayed, ['四。', '五。', '六。']);
  assert.deepEqual(advanced.state.pending, ['七。']);
  // 替换后内容不得仍含上一页句子
  assert.doesNotMatch(advanced.step?.content || '', /一。|二。|三。/);

  advanced = advanceRawTextBridgePage(advanced.state);
  assert.equal(advanced.advanced, true);
  assert.equal(advanced.step?.content, '七。');
  assert.deepEqual(advanced.state.pending, []);
  assert.equal(hasRawTextBridgePagePending(advanced.state), false);

  const noop = advanceRawTextBridgePage(advanced.state);
  assert.equal(noop.advanced, false);
  assert.equal(noop.step, null);
});

test('toRawTextBridgeDisplayStep_空句返回null', () => {
  assert.equal(toRawTextBridgeDisplayStep([]), null);
  assert.equal(toRawTextBridgeDisplayStep(['  ']), null);
  assert.equal(toRawTextBridgeDisplayStep(['有字。'])?.content, '有字。');
});

test('shouldShowRawTextBridgeNextButton_有pending或队列才显示', () => {
  assert.equal(shouldShowRawTextBridgeNextButton({ pendingCount: 0, stepQueueLength: 0 }), false);
  assert.equal(shouldShowRawTextBridgeNextButton({ pendingCount: 2, stepQueueLength: 0 }), true);
  assert.equal(shouldShowRawTextBridgeNextButton({ pendingCount: 0, stepQueueLength: 1 }), true);
});

test('shouldShowRawTextBridgeNextButton_流式中仅pending可点下一步', () => {
  assert.equal(
    shouldShowRawTextBridgeNextButton({ pendingCount: 0, stepQueueLength: 1, streamLoading: true }),
    false,
  );
  assert.equal(
    shouldShowRawTextBridgeNextButton({ pendingCount: 2, stepQueueLength: 1, streamLoading: true }),
    true,
  );
  assert.equal(
    shouldShowRawTextBridgeNextButton({ pendingCount: 0, stepQueueLength: 1, streamLoading: false }),
    true,
  );
});

test('buildRawTextBridgeCanvasContent_未满三句可带未完句预览满页后截断', () => {
  assert.equal(
    buildRawTextBridgeCanvasContent({ displayed: ['一句。'], unfinished: '未完' }),
    '一句。未完',
  );
  assert.equal(
    buildRawTextBridgeCanvasContent({
      displayed: ['一。', '二。', '三。'],
      unfinished: '不该出现',
    }),
    '一。二。三。',
  );
  assert.equal(RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT, 3);
  assert.equal(visibleRawTextBridgeUnfinished('[SCENE_CHANGE: x'), '');
  assert.match(visibleRawTextBridgeUnfinished('[NARRATION: 半句'), /半句/);
});

test('filterFormalStepsAfterRawAppend_应丢掉旁白场景保留choice', () => {
  const out = filterFormalStepsAfterRawAppend(
    [
      { type: 'narration', content: 'a' },
      { type: 'dialogue', content: 'b' },
      { type: 'choice', options: ['x'] },
      { type: 'scene_change', sceneId: 'lab' },
    ],
    { rawAppendActive: true },
  );
  // scene_change 改由旁路立刻切背景，不再入队堵开场
  assert.deepEqual(out.map((s) => s.type), ['choice']);
});

test('pickLatestSceneChangeStep_应取最后一次场景切换', () => {
  assert.equal(pickLatestSceneChangeStep([]), null);
  const latest = pickLatestSceneChangeStep([
    { type: 'scene_change', sceneId: 'street' },
    { type: 'dialogue', speakerName: '阿九' },
    { type: 'scene_change', sceneId: 'teahouse', sceneImage: '/tea.webp' },
    { type: 'choice', options: ['x'] },
  ]);
  assert.equal(latest?.sceneId, 'teahouse');
  assert.equal(latest?.sceneImage, '/tea.webp');
});

test('pickLatestDialogueStep_应取最后一条对白', () => {
  assert.equal(pickLatestDialogueStep([]), null);
  const latest = pickLatestDialogueStep([
    { type: 'narration', content: 'a' },
    { type: 'dialogue', speakerName: '关雎尔', speakerId: 'npc_a' },
    { type: 'dialogue', speakerName: '林晚', speakerId: 'player', isPlayer: true },
    { type: 'choice', options: ['x'] },
  ]);
  assert.equal(latest?.speakerName, '林晚');
});

test('applyRawTextBridgeDialoguePortrait_应保留分页正文并挂立绘字段', () => {
  const page = toRawTextBridgeDisplayStep(['门开了一条缝。', '眼睛还红着。']);
  const withPortrait = applyRawTextBridgeDialoguePortrait(page, {
    type: 'dialogue',
    speakerId: 'npc_guan',
    speakerName: '关雎尔',
    activeImage: '/npc/guan.webp',
  });
  assert.equal(withPortrait.type, 'dialogue');
  assert.equal(withPortrait.content, '门开了一条缝。眼睛还红着。');
  assert.equal(withPortrait.speakerName, '关雎尔');
  assert.equal(withPortrait.activeImage, '/npc/guan.webp');
  assert.equal(withPortrait._fromRawText, true);
  assert.equal(withPortrait._portraitFromRawBridge, true);

  const ignored = applyRawTextBridgeDialoguePortrait(
    { type: 'narration', content: '正式旁白' },
    { type: 'dialogue', speakerName: 'x' },
  );
  assert.equal(ignored.type, 'narration');
  assert.equal(ignored.content, '正式旁白');
});

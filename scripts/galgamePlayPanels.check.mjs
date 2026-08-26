/**
 * Galgame 四面板纯逻辑单测（完整覆盖主路径 + 边界）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  togglePlayBottomPanel,
  isPlayBottomPanelOpen,
} from '../src/lib/galgame/playBottomPanel.ts';
import { buildSystemPanelItems } from '../src/lib/galgame/systemPanelFromMorePromptForms.ts';
import {
  collectNpcIdsFromSteps,
  collectNpcIdsFromSceneChange,
  mergeEncounteredIds,
  matchNpcIdsBySpeakerNames,
  buildCharacterPanelItems,
  pickNpcAvatarPath,
  resolveEncounteredCharacterIds,
} from '../src/lib/galgame/encounteredCharacters.ts';
import {
  normalizeQuestItem,
  normalizeQuests,
  mergeQuests,
  getTrackedQuest,
  getQuestTrackerLabel,
  formatQuestDeadlineDisplay,
  shouldSkipQuestAutoRefresh,
} from '../src/lib/galgame/quests.ts';
import {
  shouldRestartQuestTrackerTypewriter,
  sliceQuestTrackerTypewriterText,
  nextQuestTrackerTypewriterCount,
} from '../src/lib/galgame/questTrackerTypewriter.ts';
import {
  buildLocationNameTypewriterVars,
  countLocationTypewriterSteps,
} from '../src/lib/galgame/locationNameTypewriter.ts';
import {
  parseAttributeValueCards,
  normalizeAttributePanels,
  pickAttributeCardsFromPanels,
  hasNonEmptyPanelText,
  shouldSkipAttributeAutoRefresh,
  resolveAttributePanelLoadMode,
  isAbortError,
  extractJsonFromStreamText,
} from '../src/lib/galgame/attributePanelValues.ts';

test('togglePlayBottomPanel_应在同Tab再次点击时关闭', () => {
  assert.equal(togglePlayBottomPanel(null, 'attrs'), 'attrs');
  assert.equal(togglePlayBottomPanel('attrs', 'attrs'), null);
  assert.equal(togglePlayBottomPanel('attrs', 'quests'), 'quests');
  assert.equal(togglePlayBottomPanel('quests', null), null);
  assert.equal(isPlayBottomPanelOpen('systems', 'systems'), true);
  assert.equal(isPlayBottomPanelOpen('systems', 'attrs'), false);
});

test('buildSystemPanelItems_应过滤disabled并按order排序且拆关键词', () => {
  const items = buildSystemPanelItems([
    {
      id: 'b',
      title: '晚自习,校规',
      description: '校规系统',
      content: '违反校规将扣分',
      order: 2,
      constant: false,
      enabled: true,
    },
    {
      id: 'a',
      title: '常驻',
      description: '氛围',
      content: '保持神秘',
      order: 1,
      constant: true,
      enabled: true,
    },
    {
      id: 'x',
      title: '隐藏',
      description: '不应出现',
      content: 'x',
      enabled: false,
    },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'a');
  assert.equal(items[0].constant, true);
  assert.equal(items[1].name, '校规系统');
  assert.deepEqual(items[1].keywords, ['晚自习', '校规']);
});

test('buildSystemPanelItems_非法输入应返回空数组', () => {
  assert.deepEqual(buildSystemPanelItems(null), []);
  assert.deepEqual(buildSystemPanelItems({}), []);
});

test('buildSystemPanelItems_无description时用title作名称', () => {
  const items = buildSystemPanelItems([{ id: '1', title: '战斗,护甲', content: '进入战斗' }]);
  assert.equal(items[0].name, '战斗,护甲');
  assert.deepEqual(items[0].keywords, ['战斗', '护甲']);
});

test('collectNpcIdsFromSteps_应忽略玩家与narrator', () => {
  const ids = collectNpcIdsFromSteps([
    { type: 'dialogue', npcId: 'npc_01', speakerName: '露娜' },
    { type: 'dialogue', isPlayer: true, speakerId: 'player', speakerName: '我' },
    { type: 'dialogue', speakerId: 'narrator' },
    { type: 'scene_change', sceneId: 's1' },
    { type: 'dialogue', npcId: 'npc_01' },
  ]);
  assert.deepEqual(ids, ['npc_01']);
});

test('collectNpcIdsFromSceneChange_并入场景NPC名单', () => {
  const ids = collectNpcIdsFromSceneChange(
    [{ type: 'scene_change', sceneId: 'north' }],
    [{ id: 'north', npcs: ['npc_a', 'npc_b', 'npc_a'] }]
  );
  assert.deepEqual(ids, ['npc_a', 'npc_b']);
});

test('mergeEncounteredIds_保序去重', () => {
  assert.deepEqual(mergeEncounteredIds(['a', 'b'], ['b', 'c'], null, ['a']), ['a', 'b', 'c']);
});

test('matchNpcIdsBySpeakerNames_无id与错误id均可按姓名回退', () => {
  const ids = matchNpcIdsBySpeakerNames(
    [
      { type: 'dialogue', speakerName: '露娜' },
      { type: 'dialogue', npcId: 'npc_x', speakerName: '亚修' },
    ],
    [
      { id: 'npc_luna', name: '露娜' },
      { id: 'npc_ashe', name: '亚修' },
    ]
  );
  assert.deepEqual(ids, ['npc_luna', 'npc_ashe']);
});

test('matchNpcIdsBySpeakerNames_玩家台词姓名可命中NPC表', () => {
  const ids = matchNpcIdsBySpeakerNames(
    [{ type: 'dialogue', isPlayer: true, speakerId: 'player', speakerName: '赵墨' }],
    [{ id: 'npc_zhao', name: '赵墨' }]
  );
  assert.deepEqual(ids, ['npc_zhao']);
});

test('resolveEncounteredCharacterIds_应收录主角与新出场NPC', () => {
  const ids = resolveEncounteredCharacterIds(
    [
      { type: 'dialogue', isPlayer: true, speakerId: 'player', speakerName: '赵墨' },
      { type: 'dialogue', npcId: 'lin_mu', speakerName: '林牧' },
      { type: 'dialogue', speakerId: 'ghost_id', speakerName: '秦军斥候' },
    ],
    [],
    [
      { id: 'lin_mu', name: '林牧' },
      { id: 'zhao_mo', name: '赵墨' },
    ],
    { name: '赵墨' },
    []
  );
  assert.ok(ids.includes('zhao_mo'));
  assert.ok(ids.includes('lin_mu'));
  assert.ok(ids.includes('name:秦军斥候'));
});

test('buildCharacterPanelItems_姓名身份必做性格记忆可空', () => {
  const items = buildCharacterPanelItems(['npc_1', 'missing'], [
    {
      id: 'npc_1',
      name: '露娜',
      job: '月庭书记官',
      description: '追查结界',
      personality: '稳重',
      dialogue: ['十六岁解密残片'],
      images: { base: 'https://x/luna.png' },
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '露娜');
  assert.equal(items[0].identity, '月庭书记官');
  assert.equal(items[0].personality, '稳重');
  assert.deepEqual(items[0].memories, ['十六岁解密残片']);
  assert.equal(items[0].avatarUrl, 'https://x/luna.png');

  const bare = buildCharacterPanelItems(['npc_2'], [{ id: 'npc_2', name: '亚修' }]);
  assert.equal(bare[0].identity, '');
  assert.equal(bare[0].personality, '');
  assert.deepEqual(bare[0].memories, []);
});

test('buildCharacterPanelItems_应展示player与name占位', () => {
  const items = buildCharacterPanelItems(
    ['player', 'name:路人甲'],
    [],
    undefined,
    { name: '赵墨', job: '城防民兵', description: '邯郸少年', images: { base: '/p.png' } }
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].name, '赵墨');
  assert.equal(items[0].identity, '城防民兵');
  assert.equal(items[1].name, '路人甲');
});

test('pickNpcAvatarPath_优先portrait并支持resolveUrl', () => {
  assert.equal(
    pickNpcAvatarPath({ portrait: '/p.png', base: '/b.png' }),
    '/p.png'
  );
  assert.equal(pickNpcAvatarPath({ base: '/b.png' }), '/b.png');
  const resolved = buildCharacterPanelItems(
    ['n1'],
    [{ id: 'n1', name: 'A', images: { base: '/raw.png' } }],
    (path) => `https://cdn${path}`
  );
  assert.equal(resolved[0].avatarUrl, 'https://cdn/raw.png');
});

test('normalizeQuests_丢弃无标题并映射进行中', () => {
  assert.equal(normalizeQuestItem({ title: '' }), null);
  const list = normalizeQuests([
    { id: 'q1', title: '北廊', status: '进行中', type: 'main', tracked: true, goalText: '午夜前抵达' },
    { title: '徽章', status: '可选', type: 'side' },
    { foo: 1 },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].status, 'active');
  assert.equal(list[1].status, 'optional');
});

test('mergeQuests_同id覆盖且仅保留一个tracked', () => {
  const merged = mergeQuests(
    [{ id: 'q1', title: '旧', type: 'main', status: 'active', description: '', goalText: '', tracked: true }],
    [
      { id: 'q1', title: '新北廊', tracked: true, goalText: '确认封印' },
      { id: 'q2', title: '支线', tracked: true, status: 'optional' },
    ]
  );
  assert.equal(merged.find((q) => q.id === 'q1')?.title, '新北廊');
  assert.equal(merged.filter((q) => q.tracked).length, 1);
  assert.equal(merged.find((q) => q.tracked)?.id, 'q2');
});

test('mergeQuests_已完成任务不得被降级且保留deadline', () => {
  const merged = mergeQuests(
    [{
      id: 'q-green',
      title: '更换绿色衣服',
      type: 'main',
      status: 'completed',
      description: '',
      goalText: '已换好',
      tracked: false,
      deadlineAt: '18:00',
      deadlineText: '下午六点前',
    }],
    [{
      id: 'q-green',
      title: '更换绿色衣服',
      type: 'main',
      status: 'active',
      description: '',
      goalText: '现在去换',
      tracked: true,
    }],
  );
  assert.equal(merged[0].status, 'completed');
  assert.equal(merged[0].tracked, false);
  assert.equal(merged[0].deadlineAt, '18:00');
});

test('formatQuestDeadlineDisplay_应优先展示原话与标准时间', () => {
  const text = formatQuestDeadlineDisplay({
    id: 'q1',
    title: '汉堡',
    type: 'side',
    status: 'active',
    description: '',
    goalText: '',
    tracked: false,
    deadlineText: '下午六点前',
    deadlineAt: '18:00',
  });
  assert.match(text, /下午六点前/);
  assert.match(text, /18:00/);
});

test('shouldSkipQuestAutoRefresh_流中或短间隔应跳过', () => {
  assert.equal(shouldSkipQuestAutoRefresh({ isStreaming: true, lastStartedAt: null, now: 1000 }), true);
  assert.equal(
    shouldSkipQuestAutoRefresh({ isStreaming: false, lastStartedAt: 1000, now: 2000, minIntervalMs: 2500 }),
    true,
  );
  assert.equal(
    shouldSkipQuestAutoRefresh({ isStreaming: false, lastStartedAt: 1000, now: 4000, minIntervalMs: 2500 }),
    false,
  );
});

test('getQuestTrackerLabel_应附带deadline', () => {
  const label = getQuestTrackerLabel({
    id: 'q1',
    title: '汉堡',
    type: 'main',
    status: 'active',
    description: '',
    goalText: '买到汉堡',
    tracked: true,
    deadlineText: '下午六点前',
    deadlineAt: '18:00',
  });
  assert.match(label, /买到汉堡/);
  assert.match(label, /18:00/);
});

test('resolveQuestsPanelRefreshPlan_有缓存不阻塞loader仍跑LLM', async () => {
  const { resolveQuestsPanelRefreshPlan } = await import('../src/lib/galgame/quests.ts');
  const withCache = resolveQuestsPanelRefreshPlan([
    { id: 'q1', title: '主线', type: 'main', status: 'active', description: '', goalText: 'g', tracked: true },
  ]);
  assert.equal(withCache.hasCache, true);
  assert.equal(withCache.blockingLoader, false);
  assert.equal(withCache.runLlmAsync, true);
  const empty = resolveQuestsPanelRefreshPlan([]);
  assert.equal(empty.hasCache, false);
  assert.equal(empty.blockingLoader, true);
  assert.equal(empty.runLlmAsync, true);
});

test('QuestsPanel_有列表时loading不藏内容', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/components/Galgame/panels/QuestsPanel.tsx'), 'utf8');
  assert.match(src, /showBlockingLoader/);
  assert.match(src, /refreshing/);
  assert.match(src, /!showBlockingLoader/);
});

test('Galgame_任务面板缓存优先异步LLM', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../src/page/Galgame.tsx'), 'utf8');
  assert.match(src, /fetchCachedQuests/);
  assert.match(src, /resolveQuestsPanelRefreshPlan/);
  assert.match(src, /refreshQuests\(\{ background: plan\.hasCache \}\)/);
  assert.match(src, /refreshQuests\(\{ background: true \}\)/);
  assert.match(src, /shouldSkipQuestAutoRefresh/);
  assert.doesNotMatch(
    src,
    /if \(questsRef\.current\.length > 0\) return;/,
    '有缓存时仍应异步跑 LLM，禁止直接 return',
  );
});

test('getTrackedQuest_优先tracked否则主线active', () => {
  assert.equal(getTrackedQuest([]), null);
  const tracked = getTrackedQuest([
    { id: 'a', title: 'A', type: 'main', status: 'active', description: '', goalText: 'g', tracked: false },
    { id: 'b', title: 'B', type: 'side', status: 'active', description: '', goalText: 'x', tracked: true },
  ]);
  assert.equal(tracked?.id, 'b');
  assert.equal(getQuestTrackerLabel(tracked), 'x');
  const fallback = getTrackedQuest([
    { id: 'a', title: '主线', type: 'main', status: 'active', description: 'd', goalText: '', tracked: false },
  ]);
  assert.equal(getQuestTrackerLabel(fallback), 'd');
});

test('shouldRestartQuestTrackerTypewriter_新文案才重开打字机', () => {
  assert.equal(shouldRestartQuestTrackerTypewriter('', '新任务'), true);
  assert.equal(shouldRestartQuestTrackerTypewriter('旧', '新'), true);
  assert.equal(shouldRestartQuestTrackerTypewriter('同', '同'), false);
  assert.equal(shouldRestartQuestTrackerTypewriter('有', ''), false);
});

test('sliceQuestTrackerTypewriterText_与nextCount推进切片', () => {
  assert.equal(sliceQuestTrackerTypewriterText('任务目标', 0), '');
  assert.equal(sliceQuestTrackerTypewriterText('任务目标', 2), '任务');
  assert.equal(sliceQuestTrackerTypewriterText('任务目标', 99), '任务目标');
  assert.equal(nextQuestTrackerTypewriterCount(0, 4), 1);
  assert.equal(nextQuestTrackerTypewriterCount(4, 4), 4);
});

test('countLocationTypewriterSteps_按码点计字', () => {
  assert.equal(countLocationTypewriterSteps(''), 0);
  assert.equal(countLocationTypewriterSteps('  '), 0);
  assert.equal(countLocationTypewriterSteps('檀香山港突袭战'), 7);
});

test('buildLocationNameTypewriterVars_空名不播_有名按时长封顶', () => {
  assert.equal(buildLocationNameTypewriterVars(''), null);
  const short = buildLocationNameTypewriterVars('港');
  assert.ok(short);
  assert.equal(short.steps, 1);
  assert.equal(short.durationMs, 450);
  const mid = buildLocationNameTypewriterVars('檀香山港突袭战');
  assert.ok(mid);
  assert.equal(mid.steps, 7);
  assert.equal(mid.durationMs, 450);
  const long = buildLocationNameTypewriterVars('甲'.repeat(60));
  assert.ok(long);
  assert.equal(long.steps, 60);
  assert.equal(long.durationMs, 2000);
});

test('parseAttributeValueCards_解析冒号数值行并跳过非法行', () => {
  const cards = parseAttributeValueCards('😍容貌：90\n战斗力: 126\n随便聊聊\n防御力：89');
  assert.equal(cards.length, 3);
  assert.equal(cards[0].label, '容貌');
  assert.equal(cards[0].value, 90);
  assert.equal(cards[1].label, '战斗力');
  assert.equal(cards[2].value, 89);
});

test('parseAttributeValueCards_兼容百分制与括注', () => {
  const cards = parseAttributeValueCards(
    '容貌：70/100（中上之姿，眉目温婉耐看）\n才艺：65/100\n圣宠：0/100（尚未面圣）\n子嗣：无',
  );
  assert.equal(cards.length, 3);
  assert.equal(cards[0].label, '容貌');
  assert.equal(cards[0].value, 70);
  assert.equal(cards[1].value, 65);
  assert.equal(cards[2].value, 0);
});

test('normalizeAttributePanels_保留百分制属性行', () => {
  assert.deepEqual(
    normalizeAttributePanels({
      属性: '容貌：70/100（中上之姿）\n心机：80/100\n周念：↑↑↑',
    }),
    {
      属性: '容貌：70/100（中上之姿）\n心机：80/100',
    },
  );
});

test('pickAttributeCardsFromPanels_优先属性tab', () => {
  const picked = pickAttributeCardsFromPanels({
    任务: '主线：去北廊',
    属性: '敏捷：74\n洞察：112',
  });
  assert.equal(picked.sourceKey, '属性');
  assert.equal(picked.cards.length, 2);
});

test('pickAttributeCardsFromPanels_禁止回落到好感NPC行', () => {
  const picked = pickAttributeCardsFromPanels({
    好感: '萧因：-30',
    道具: '令牌',
  });
  assert.equal(picked.cards.length, 0);
});

test('pickAttributeCardsFromPanels_剔除属性面板中的NPC名', () => {
  const picked = pickAttributeCardsFromPanels(
    {
      属性: '体力：72\n萧因：-30\n武力：55',
    },
    { npcNames: ['萧因'] },
  );
  assert.deepEqual(
    picked.cards.map((c) => c.label),
    ['体力', '武力'],
  );
});

test('normalizeAttributePanels_NPC行从属性挪到好感', () => {
  assert.deepEqual(
    normalizeAttributePanels(
      {
        属性: '体力：72\n萧因：-30',
        好感: '皇后：10',
      },
      { npcNames: ['萧因'] },
    ),
    {
      属性: '体力：72',
      好感: '皇后：10\n萧因：-30',
    },
  );
});

test('normalizeAttributePanels_属性tab只保留数字行', () => {
  assert.deepEqual(
    normalizeAttributePanels({
      属性: '周念：↑↑↑↑↑\n体力：72\n心情：+5\n咳嗽更轻了',
      好感: '周念：↑↑↑↑↑',
    }),
    {
      属性: '体力：72\n心情：+5',
      好感: '周念：↑↑↑↑↑',
    }
  );
  assert.deepEqual(normalizeAttributePanels({ 属性: '周念：↑↑↑↑↑' }), {});
});

test('hasNonEmptyPanelText_自由文本也应视为有数据可展示', () => {
  assert.equal(hasNonEmptyPanelText({ 道具: '干粮、地图' }), true);
  assert.equal(hasNonEmptyPanelText({ 属性: '   ' }), false);
  assert.equal(hasNonEmptyPanelText({}), false);
  // 自由文本无「标签：数字」→ 数值卡为空，但原文不应被当成暂无
  const free = pickAttributeCardsFromPanels({ 状态: '你仍扶着林母，包里有种子与炒面。' });
  assert.equal(free.cards.length, 0);
  assert.equal(hasNonEmptyPanelText({ 状态: '你仍扶着林母，包里有种子与炒面。' }), true);
});

test('shouldSkipAttributeAutoRefresh_流中或短间隔应跳过', () => {
  assert.equal(shouldSkipAttributeAutoRefresh({ isStreaming: true, lastStartedAt: null, now: 1000 }), true);
  assert.equal(
    shouldSkipAttributeAutoRefresh({ isStreaming: false, lastStartedAt: 1000, now: 2000, minIntervalMs: 2500 }),
    true
  );
  assert.equal(
    shouldSkipAttributeAutoRefresh({ isStreaming: false, lastStartedAt: 1000, now: 4000, minIntervalMs: 2500 }),
    false
  );
});

test('resolveAttributePanelLoadMode_有缓存手动只读_空缓存手动重算_回合后重算', () => {
  assert.equal(resolveAttributePanelLoadMode('manual-refresh'), 'cache');
  assert.equal(resolveAttributePanelLoadMode('manual-refresh', { hasCachedPanels: true }), 'cache');
  assert.equal(resolveAttributePanelLoadMode('manual-refresh', { hasCachedPanels: false }), 'regenerate');
  assert.equal(resolveAttributePanelLoadMode('open'), 'cache');
  assert.equal(resolveAttributePanelLoadMode('auto-turn'), 'regenerate');
});

test('isAbortError_应识别AbortController取消', () => {
  assert.equal(isAbortError(new DOMException('signal is aborted without reason', 'AbortError')), true);
  assert.equal(isAbortError({ name: 'AbortError', message: 'Aborted' }), true);
  assert.equal(isAbortError(new Error('INVALID_JSON')), false);
  assert.equal(isAbortError(null), false);
});

test('extractJsonFromStreamText_应解析fence与杂质文本', () => {
  assert.equal(
    extractJsonFromStreamText('```json\n{"panels":{"属性":"力：1"}}\n```').panels['属性'],
    '力：1'
  );
  assert.equal(extractJsonFromStreamText(''), null);
});

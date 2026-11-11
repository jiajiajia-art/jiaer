/**
 * 书架：纯逻辑（续玩决策 / 时间 / 状态 / 回滚 / 视图恢复）+ 页面接线门禁
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatShelfPlayedAt,
  formatShelfSaveTime,
  mergeShelfPage,
  normalizeShelfKeyword,
  parseShelfViewState,
  removeShelfItems,
  resolveShelfContinuePlan,
  restoreShelfItems,
  shelfBlockedReason,
  shelfFirstPageSize,
  shelfProgressLine,
  shelfSaveProgressLabel,
  shelfStatusLabel,
  shelfSupportsSaveSlots,
  toggleShelfSelection,
} from '../src/lib/bookshelf.ts';
import {
  buildShelfResumeState,
  consumeShelfResumeOnce,
  readShelfResume,
} from '../src/utils/gameDetailNavigation.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const baseItem = {
  fileId: 'g1', title: '雾港来信', author: '林夕', coverUrl: '', portraitCoverUrl: '',
  gameMode: 'TXT', status: 'available', canPlay: true, isFavorited: false, favoritedAt: null,
  hasPlayRecord: true, lastPlayedAt: '2026-10-05T00:00:00.000Z', lastAction: 'save', lastSaveId: 's2',
  playerName: '沈砚', gameDate: '天启三年春', isPaidGame: false, purchased: false,
};
const okSave = (saveId, createdAt, extra = {}) => ({ saveId, status: 'ok', createdAt, summaryPreview: `摘要${saveId}`, ...extra });

test('resolveShelfContinuePlan_不可游玩时阻止并给出原因', () => {
  const plan = resolveShelfContinuePlan({ ...baseItem, canPlay: false, status: 'offline' }, null);
  assert.deepEqual(plan, { kind: 'blocked', reason: '该剧本已下架，暂不可游玩' });
});

test('resolveShelfContinuePlan_非TXT直接续上唯一进度', () => {
  assert.deepEqual(resolveShelfContinuePlan({ ...baseItem, gameMode: 'AVG' }, null), { kind: 'resume', saveId: null });
});

test('resolveShelfContinuePlan_TXT只有一个存档时直接读该存档', () => {
  const plan = resolveShelfContinuePlan(baseItem, [okSave('s2', 10)]);
  assert.deepEqual(plan, { kind: 'resume', saveId: 's2' });
});

test('resolveShelfContinuePlan_多存档弹选择且默认选中最近实际游玩的存档', () => {
  const plan = resolveShelfContinuePlan(baseItem, [okSave('s3', 30), okSave('s2', 20)]);
  assert.equal(plan.kind, 'choose');
  assert.equal(plan.defaultKey, 'save:s2');
  assert.deepEqual(plan.options.map((o) => o.saveId), ['s3', 's2']);
});

test('resolveShelfContinuePlan_最近一次是续玩时自动进度排第一并默认选中', () => {
  const plan = resolveShelfContinuePlan({ ...baseItem, lastAction: 'session', lastSaveId: null }, [okSave('s1', 5)]);
  assert.equal(plan.kind, 'choose');
  assert.equal(plan.defaultKey, 'session');
  assert.equal(plan.options[0].kind, 'session');
  assert.equal(plan.options[0].playerName, '沈砚');
});

test('resolveShelfContinuePlan_坏档不进可选项且只有坏档时不自动重开', () => {
  const corrupted = { saveId: 'bad', status: 'corrupted', reason: '存档文件损坏，无法读取', createdAt: 0 };
  const onlyBad = resolveShelfContinuePlan({ ...baseItem, lastAction: 'save', lastSaveId: 'bad' }, [corrupted]);
  assert.equal(onlyBad.kind, 'noValidSave');
  assert.equal(onlyBad.invalid[0].reason, '存档文件损坏，无法读取');
  const mixed = resolveShelfContinuePlan(baseItem, [okSave('s2', 3), corrupted]);
  assert.equal(mixed.kind, 'choose');
  assert.deepEqual(mixed.options.map((o) => o.saveId), ['s2']);
  assert.equal(mixed.invalid.length, 1);
});

test('resolveShelfContinuePlan_存档被删后回落自动进度', () => {
  const plan = resolveShelfContinuePlan({ ...baseItem, lastAction: 'save', lastSaveId: null }, []);
  assert.deepEqual(plan, { kind: 'resume', saveId: null });
});

test('formatShelfPlayedAt_相对时间与非法输入', () => {
  const now = new Date(2026, 9, 30, 12, 0, 0).getTime();
  assert.equal(formatShelfPlayedAt(now - 10_000, now), '刚刚');
  assert.equal(formatShelfPlayedAt(now - 5 * 60_000, now), '5分钟前');
  assert.equal(formatShelfPlayedAt(new Date(2026, 9, 30, 8, 0).getTime(), now), '4小时前');
  assert.equal(formatShelfPlayedAt(new Date(2026, 9, 29, 23, 0).getTime(), now), '昨天');
  assert.equal(formatShelfPlayedAt(new Date(2026, 9, 26, 9, 0).getTime(), now), '4天前');
  assert.equal(formatShelfPlayedAt(new Date(2026, 2, 3).getTime(), now), '03-03');
  assert.equal(formatShelfPlayedAt(new Date(2025, 11, 1).getTime(), now), '2025-12-01');
  assert.equal(formatShelfPlayedAt('not-a-date', now), '');
  assert.equal(formatShelfPlayedAt(null, now), '');
});

test('shelf文案_进度与状态不编造', () => {
  assert.equal(shelfProgressLine({ playerName: '沈砚', gameDate: '天启三年春' }), '沈砚 · 天启三年春');
  assert.equal(shelfProgressLine({ playerName: null, gameDate: '第3天' }), '第3天');
  assert.equal(shelfProgressLine({ playerName: null, gameDate: null }), '');
  assert.equal(shelfSaveProgressLabel({ gameDate: null, turnCount: 12 }), '第 12 回合');
  assert.equal(shelfSaveProgressLabel({ gameDate: null, turnCount: 0 }), '');
  assert.equal(shelfStatusLabel('available'), '');
  assert.equal(shelfStatusLabel('private'), '已设为私密');
  assert.equal(shelfBlockedReason({ status: 'deleted', canPlay: false }), '该剧本已被作者删除');
  assert.equal(shelfBlockedReason({ status: 'offline', canPlay: true }), '');
  assert.equal(formatShelfSaveTime(0), '');
  assert.match(formatShelfSaveTime(new Date(2026, 0, 2, 3, 4).getTime()), /^2026-01-02 03:04$/);
  assert.equal(shelfSupportsSaveSlots('txt'), true);
  assert.equal(shelfSupportsSaveSlots('IVG'), false);
});

test('removeShelfItems_失败回滚保持原顺序', () => {
  const items = ['a', 'b', 'c', 'd'].map((fileId) => ({ ...baseItem, fileId }));
  const { next, removed } = removeShelfItems(items, ['b', 'd']);
  assert.deepEqual(next.map((i) => i.fileId), ['a', 'c']);
  assert.deepEqual(restoreShelfItems(next, removed).map((i) => i.fileId), ['a', 'b', 'c', 'd']);
  assert.deepEqual(removeShelfItems(items, []).next.length, 4);
});

test('mergeShelfPage_翻页去重', () => {
  const a = { ...baseItem, fileId: 'a' };
  const b = { ...baseItem, fileId: 'b' };
  assert.deepEqual(mergeShelfPage([a], [a, b, b]).map((i) => i.fileId), ['a', 'b']);
});

test('toggleShelfSelection_重复点击取消', () => {
  assert.deepEqual(toggleShelfSelection([], 'a'), ['a']);
  assert.deepEqual(toggleShelfSelection(['a', 'b'], 'a'), ['b']);
});

test('parseShelfViewState_恢复页签滚动且脏数据回落默认', () => {
  assert.deepEqual(parseShelfViewState('{"tab":"favorites","scrollY":420.7,"loaded":33}'), { tab: 'favorites', scrollY: 420, loaded: 33 });
  assert.deepEqual(parseShelfViewState('{"tab":"x","scrollY":-1}'), { tab: 'recent', scrollY: 0, loaded: 0 });
  assert.deepEqual(parseShelfViewState('{bad'), { tab: 'recent', scrollY: 0, loaded: 0 });
  assert.deepEqual(parseShelfViewState(null), { tab: 'recent', scrollY: 0, loaded: 0 });
  assert.equal(shelfFirstPageSize(0), 20);
  assert.equal(shelfFirstPageSize(33), 33);
  assert.equal(shelfFirstPageSize(500), 50);
  assert.equal(normalizeShelfKeyword(`  ${'字'.repeat(60)} `).length, 50);
});

test('readShelfResume_fileId不匹配时不触发读档', () => {
  const state = buildShelfResumeState('g1', 's2');
  assert.deepEqual(readShelfResume(state, 'g1'), { fileId: 'g1', saveId: 's2' });
  assert.equal(readShelfResume(state, 'g2'), null);
  assert.equal(readShelfResume({ source: 'favorites' }, 'g1'), null);
  assert.deepEqual(readShelfResume(buildShelfResumeState('g1', null), 'g1'), { fileId: 'g1', saveId: null });
});

test('consumeShelfResumeOnce_同一历史条目只自动续玩一次', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(consumeShelfResumeOnce('key1', storage), true);
  assert.equal(consumeShelfResumeOnce('key1', storage), false);
  assert.equal(consumeShelfResumeOnce('key2', storage), true);
  assert.equal(consumeShelfResumeOnce('', storage), false);
  const broken = { getItem: () => '{bad', setItem: () => { throw new Error('quota'); } };
  assert.equal(consumeShelfResumeOnce('key3', broken), true);
});

test('书架页接线_路由底栏真实接口且无原生弹窗与mock', () => {
  const app = read('src/App.tsx');
  assert.match(app, /<Route path="\/bookshelf" element={<CreateWorks \/>} \/>/);
  const unifiedWorks = read('src/components/Create/CreatorWorksPanel.tsx');
  assert.match(unifiedWorks, /'all' \| 'published' \| 'favorites'/);
  assert.doesNotMatch(unifiedWorks, /worksTab === 'drafts'/);
  assert.match(unifiedWorks, /create\.manage/);
  assert.match(unifiedWorks, /normalizeWorksTabKey/);
  const nav = read('src/components/Layout/MobileBottomNav.tsx');
  assert.match(nav, /key: 'bookshelf'/);
  assert.match(nav, /navigate\('\/bookshelf'\)/);
  const page = read('src/page/Bookshelf.tsx');
  const api = read('src/api/bookshelf/bookshelfApi.ts');
  assert.match(api, /'\/auth\/bookshelf\/recent'/);
  assert.match(api, /'\/auth\/bookshelf\/favorites\/remove'/);
  assert.match(api, /includeInvalid: 1/);
  assert.doesNotMatch(api, /userId/);
  for (const src of [page, read('src/components/Bookshelf/ShelfSavePicker.tsx'), read('src/components/Bookshelf/ShelfSaveManager.tsx')]) {
    assert.doesNotMatch(src, /\b(window\.)?(alert|confirm|prompt)\(/);
    assert.doesNotMatch(src, /mock/i);
  }
  assert.match(page, /去发现剧本/);
  assert.match(page, /setIsAuthModalOpen\(true\)/);
  assert.match(page, /加载失败/);
  assert.match(page, /restoreShelfItems/);
  assert.match(page, /AppPageShell/);
  assert.match(page, /data-app-page-main/);
  // 存档删除只在独立的存档管理里，且先确认
  assert.doesNotMatch(page, /savesApi\.remove/);
  const manager = read('src/components/Bookshelf/ShelfSaveManager.tsx');
  assert.match(manager, /<ConfirmModal/);
  assert.match(manager, /savesApi\.remove\(pendingDelete\.saveId, activeGame\.fileId\)/);
});

test('GameDetail_书架续玩复用详情页流程且读档失败改选不清档', () => {
  const detail = read('src/page/GameDetail.tsx');
  assert.match(detail, /readShelfResume\(location\.state, fileIdParam\)/);
  assert.match(detail, /consumeShelfResumeOnce\(location\.key\)/);
  assert.match(detail, /handleLoadSave\(intent\.saveId, \{ silent: true \}\)/);
  assert.match(detail, /setIsLoadSaveOpen\(true\)/);
  assert.match(detail, /await handleStartGame\(\)/);
  const shelfBlock = detail.slice(detail.indexOf('readShelfResume(location.state'), detail.indexOf('readShelfResume(location.state') + 900);
  assert.doesNotMatch(shelfBlock, /restart: true|handleStartNewGame/);
});

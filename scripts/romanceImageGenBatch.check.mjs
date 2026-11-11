/**
 * C1.1 批量生图：范围选择 / 任务组装 / 回写补丁 / 队列行为 / UI 接线
 * 纯逻辑走 imageGenBatchPlan（不碰网络）；队列行为用 runImageGenBatch 的 abort 与跳过路径（不发请求）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (p) => readFileSync(join(romance, p), 'utf8');
const load = (p) => import(pathToFileURL(join(romance, p)).href);

const rooms = {
  a: { name: '大厅', scenePrompt: '挑高穹顶', mapId: 'm1' },
  b: { name: '后院', bg: 'data:image/png;base64,AAA', mapId: 'm1' },
  c: { name: '码头', mapId: 'm2' },
  d: { name: '', mapId: 'm1' }, // 无名无描述：提示词主体仍有构图句，但仍应能入队
};
const maps = [
  { id: 'm1', name: '旅馆', desc: '雾色旅馆' },
  { id: 'm2', name: '港口', bg: 'https://x/map2.png' },
];

test('pickBatchRoomIds_当前大地图只含无图地点_全部范围跨图_勾选范围忽略不存在的id', async () => {
  const { pickBatchRoomIds } = await load('lib/imageGenBatchPlan.ts');
  assert.deepEqual(pickBatchRoomIds({ scope: 'map-empty', rooms, curMapId: 'm1' }).sort(), ['a', 'd']);
  assert.deepEqual(pickBatchRoomIds({ scope: 'all-empty', rooms, curMapId: 'm1' }).sort(), ['a', 'c', 'd']);
  // 勾选范围：有图的也保留（是否跳过由 fillEmptyOnly 决定）；不存在的 id、重复 id 被剔除
  assert.deepEqual(pickBatchRoomIds({ scope: 'selected', rooms, curMapId: 'm1', selectedIds: ['b', 'zzz', 'b', 'c'] }), ['b', 'c']);
  assert.deepEqual(pickBatchRoomIds({ scope: 'selected', rooms, curMapId: 'm1' }), []);
});

test('buildBatchJobs_地点任务带竖图尺寸与existingUrl_大地图任务排在前面且按范围取图', async () => {
  const { buildBatchJobs, BATCH_ROOM_PREFIX, BATCH_MAP_PREFIX } = await load('lib/imageGenBatchPlan.ts');
  const prompts = await load('lib/editorImagePrompts.ts');
  const cur = buildBatchJobs({ scope: 'selected', rooms, maps, curMapId: 'm1', selectedIds: ['a', 'b'], includeMapImages: true });
  assert.equal(cur.jobs[0].id, `${BATCH_MAP_PREFIX}m1`);
  assert.equal(cur.jobs[0].size, prompts.WORLD_MAP_GEN_SIZE);
  assert.match(cur.jobs[0].prompt, /旅馆/);
  assert.match(cur.jobs[0].prompt, /大厅/); // 地点列表进了大地图提示词
  const roomJobs = cur.jobs.filter((j) => j.id.startsWith(BATCH_ROOM_PREFIX));
  assert.deepEqual(roomJobs.map((j) => j.id), ['room:a', 'room:b']);
  assert.equal(roomJobs[0].size, prompts.LOCATION_SCENE_GEN_SIZE);
  assert.match(roomJobs[0].prompt, /挑高穹顶/);
  assert.equal(roomJobs[1].existingUrl, rooms.b.bg);
  assert.ok(roomJobs[0].negativePrompt, '负面词走单独字段');
  assert.doesNotMatch(roomJobs[0].prompt, /负面词/);

  // 全部范围：只补没图的大地图（m2 已有图则不入队），m1 入队
  const all = buildBatchJobs({ scope: 'all-empty', rooms, maps, curMapId: 'm1', includeMapImages: true });
  assert.deepEqual(all.jobs.filter((j) => j.id.startsWith(BATCH_MAP_PREFIX)).map((j) => j.id), ['map:m1']);
  // 不含大地图
  const noMap = buildBatchJobs({ scope: 'map-empty', rooms, maps, curMapId: 'm1', includeMapImages: false });
  assert.ok(noMap.jobs.every((j) => j.id.startsWith(BATCH_ROOM_PREFIX)));
});

test('buildBatchJobs_作品画风进提示词_缺主体项计入skippedNoPrompt', async () => {
  const { buildBatchJobs } = await load('lib/imageGenBatchPlan.ts');
  const styled = buildBatchJobs({
    scope: 'map-empty', rooms, maps, curMapId: 'm1', includeMapImages: false,
    settings: { workStyle: '水墨国风' },
  });
  assert.ok(styled.jobs.length >= 1);
  assert.ok(styled.jobs.every((j) => /水墨国风/.test(j.prompt)));
  const empty = buildBatchJobs({ scope: 'selected', rooms: {}, maps: [], curMapId: 'x', selectedIds: ['nope'], includeMapImages: false });
  assert.equal(empty.jobs.length, 0);
});

test('collectBatchApplyPatch_只收done且有url_applyBatchPatch写room_bg与map_bg并忽略已删地点', async () => {
  const { collectBatchApplyPatch, applyBatchPatch } = await load('lib/imageGenBatchPlan.ts');
  const patch = collectBatchApplyPatch([
    { id: 'room:a', label: 'a', prompt: 'p', status: 'done', url: 'U1' },
    { id: 'room:c', label: 'c', prompt: 'p', status: 'failed', error: 'x' },
    { id: 'room:ghost', label: 'g', prompt: 'p', status: 'done', url: 'U2' },
    { id: 'map:m1', label: 'm', prompt: 'p', status: 'done', url: 'U3' },
    { id: 'room:b', label: 'b', prompt: 'p', status: 'skipped' },
    { id: 'room:d', label: 'd', prompt: 'p', status: 'done' }, // 无 url
  ]);
  assert.deepEqual(patch, { roomBg: { a: 'U1', ghost: 'U2' }, mapBg: { m1: 'U3' } });
  const out = applyBatchPatch(rooms, maps, patch);
  assert.equal(out.rooms.a.bg, 'U1');
  assert.equal(out.rooms.ghost, undefined, '已删地点不得被补丁复活');
  assert.equal(out.rooms.b.bg, rooms.b.bg, '未在补丁里的地点保持不变');
  assert.equal(out.maps.find((m) => m.id === 'm1').bg, 'U3');
  assert.equal(out.changed, 2);
  assert.equal(rooms.a.bg, undefined, '不可变更新：原对象不被修改');
});

test('summarizeBatch_统计各状态', async () => {
  const { summarizeBatch } = await load('lib/imageGenBatchPlan.ts');
  const s = summarizeBatch([
    { id: '1', status: 'done' }, { id: '2', status: 'failed' }, { id: '3', status: 'failed' },
    { id: '4', status: 'skipped' }, { id: '5', status: 'pending' }, { id: '6', status: 'aborted' },
  ]);
  assert.deepEqual(s, { total: 6, pending: 1, running: 0, done: 1, failed: 2, skipped: 1, aborted: 1 });
});

test('runBatchWith_默认跳过已有图_单张失败不打断_可中止_重试只重跑失败项', async () => {
  const { runBatchWith, retryFailedBatchWith } = await load('lib/imageGenBatchCore.ts');
  const calls = [];
  let failB = true;
  const gen = async (_cfg, prompt, size, o) => {
    calls.push(prompt);
    if (prompt === 'B' && failB) throw new Error('网关 500');
    return `url:${prompt}:${size}:${o.negativePrompt ?? ''}`;
  };
  const jobs = [
    { id: 'room:a', label: 'a', prompt: 'A', size: '1080x1920', negativePrompt: 'n', existingUrl: 'https://x/a.png' },
    { id: 'room:b', label: 'b', prompt: 'B', size: '1080x1920' },
    { id: 'room:c', label: 'c', prompt: 'C', size: '1080x1920', negativePrompt: 'n2' },
  ];
  const seen = [];
  const res = await runBatchWith(gen, { cfg: {}, jobs, onProgress: (r) => seen.push(r.map((x) => x.status).join(',')) });
  assert.deepEqual(res.map((r) => r.status), ['skipped', 'failed', 'done']);
  assert.deepEqual(calls, ['B', 'C'], '有图项不发请求');
  assert.equal(res[1].error, '网关 500');
  assert.equal(res[2].url, 'url:C:1080x1920:n2');
  assert.ok(seen.some((x) => x.includes('running')), '进度回调含 running');

  // 重试：只重跑失败项，其它结果保持
  failB = false;
  calls.length = 0;
  const again = await retryFailedBatchWith(gen, { cfg: {}, jobs: [], previous: res });
  assert.deepEqual(calls, ['B']);
  assert.deepEqual(again.map((r) => r.status), ['skipped', 'done', 'done']);
  // 无失败项原样返回
  assert.equal(await retryFailedBatchWith(gen, { cfg: {}, jobs: [], previous: again }), again);

  // fillEmptyOnly=false：覆盖重绘有图项
  calls.length = 0;
  const forced = await runBatchWith(gen, { cfg: {}, jobs: [jobs[0]], fillEmptyOnly: false });
  assert.equal(forced[0].status, 'done');
  assert.deepEqual(calls, ['A']);
});

test('runBatchWith_中止后剩余标aborted_进行中的失败也记aborted', async () => {
  const { runBatchWith } = await load('lib/imageGenBatchCore.ts');
  const ac = new AbortController();
  const gen = async (_c, prompt) => {
    if (prompt === 'A') { ac.abort(); throw new Error('AbortError'); }
    return 'u';
  };
  const res = await runBatchWith(gen, {
    cfg: {}, signal: ac.signal,
    jobs: [{ id: '1', label: 'a', prompt: 'A' }, { id: '2', label: 'b', prompt: 'B' }, { id: '3', label: 'c', prompt: 'C' }],
  });
  assert.deepEqual(res.map((r) => r.status), ['aborted', 'aborted', 'aborted']);
  // 预先 abort：一张都不发
  let n = 0;
  const pre = new AbortController();
  pre.abort();
  const res2 = await runBatchWith(async () => { n += 1; return 'u'; }, { cfg: {}, signal: pre.signal, jobs: [{ id: '1', label: 'a', prompt: 'A' }] });
  assert.equal(n, 0);
  assert.equal(res2[0].status, 'aborted');
});

test('imageGenBatch_对外入口仍绑定平台生图网关', () => {
  const src = read('lib/imageGenBatch.ts');
  assert.match(src, /runBatchWith\(generatePlatformImage/);
  assert.match(src, /retryFailedBatchWith\(generatePlatformImage/);
});

test('ModBatchImageGen_UI接线_data属性_中止重试_复用批量库与素材库', () => {
  const ui = read('components/ModBatchImageGen.tsx');
  for (const attr of [
    'data-batch-image-gen', 'data-batch-scope', 'data-batch-start', 'data-batch-abort',
    'data-batch-retry', 'data-batch-progress', 'data-batch-status', 'data-batch-fill-empty-only', 'data-batch-room',
  ]) assert.ok(ui.includes(attr), `缺少 ${attr}`);
  assert.match(ui, /runImageGenBatch/);
  assert.match(ui, /retryFailedImageGenBatch/);
  assert.match(ui, /fillEmptyOnly/);
  assert.match(ui, /rememberImageAsset/);
  assert.match(ui, /rasterToScenePortraitDataUrl/);
  assert.match(ui, /signal: ac\.signal/);
  assert.doesNotMatch(ui, /\b(?:window\.)?(?:alert|confirm|prompt)\(/);
  // 状态文案齐全
  const plan = read('lib/imageGenBatchPlan.ts');
  for (const label of ['等待', '生成中', '完成', '失败', '已跳过']) assert.ok(plan.includes(label));
});

test('ModRoomTreeEditor_挂载批量生图并一次commit回写', () => {
  const src = read('components/ModRoomTreeEditor.tsx');
  assert.match(src, /import ModBatchImageGen from "\.\/ModBatchImageGen"/);
  assert.match(src, /<ModBatchImageGen[^>]*imageGen=\{imageGen\}/);
  assert.match(src, /applyBatchPatch\(allRooms, maps, patch\)/);
  assert.equal((src.match(/\{batchPanel\}/g) ?? []).length, 2, '空态与正常态都要挂');
});

test('ImagePicker与批量共用rememberImageAsset_不再各写一份素材库逻辑', () => {
  const picker = read('components/ImagePicker.tsx');
  const fs = read('lib/freeStyle.ts');
  assert.match(fs, /export function rememberImageAsset/);
  assert.match(picker, /rememberImageAsset/);
  assert.doesNotMatch(picker, /saveAssets\(/);
});

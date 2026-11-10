/**
 * 模组音乐：一份列表，存储仍分 bgm / audioRefs / platformAudioRefs。
 * 平台曲只记 platform: id，关模组后仍在曲库里。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
const editor = readFileSync(join(romance, 'components/ModBgmEditor.tsx'), 'utf8');
const lib = await import(pathToFileURL(join(romance, 'lib/modMusic.ts')).href);
const plat = await import(pathToFileURL(join(romance, 'game/platformAudio.ts')).href);
const sanitize = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
const audioSrc = readFileSync(join(romance, 'game/audioLib.ts'), 'utf8');

const look = {
  author: [{ id: 'au_1', name: '钢琴', src: 'idb:au_1' }],
  platform: plat.PLATFORM_AUDIO,
};

test('基础里只有一块音乐_不再挂美化也不叠两个折叠区', () => {
  // 功能注释：C1.2 音乐进①基础，⑤美化不得再有音乐区块
  assert.match(panel, /g="base" title="音乐"/);
  assert.doesNotMatch(panel, /g="look" title="音乐"/);
  assert.match(panel, /hint: "作品封面、名称与简介、剧本基调、时间与推进、头像、建角、人物线路、地点、音乐、已添加的玩法"/);
  assert.match(panel, /hint: "手机外观、皮肤美化、开场页外观、剧情美化、底栏样式"/);
  assert.equal(panel.includes('title="内置音乐"'), false);
  assert.equal(panel.includes('title="引用音频库"'), false);
  assert.match(editor, /作品音频库还是空的/);
  assert.match(editor, /PLATFORM_AUDIO/);
  assert.doesNotMatch(editor, /alert\(/);
});

test('上传音乐走弹窗三tab_禁止独立平台曲库按钮', () => {
  assert.match(editor, /＋ 上传音乐/);
  assert.match(editor, /setPickerOpen\(true\)/);
  assert.match(editor, /Modal title="添加音乐"/);
  assert.match(editor, /本地上传/);
  assert.match(editor, /平台音乐素材库/);
  assert.match(editor, /作品音频库/);
  assert.match(editor, /role="tablist"/);
  assert.match(editor, /aria-label="添加音乐来源"/);
  assert.doesNotMatch(editor, /aria-label="从平台曲库选"/);
  assert.doesNotMatch(editor, /从平台曲库选…/);
  assert.doesNotMatch(editor, /从本机音乐库选…/);
  assert.doesNotMatch(editor, /从作品音频库引用…/);
});

test('旧模组打开后合成一份列表_保存仍写回原字段', () => {
  const content = {
    bgm: [
      { id: 't1', name: '雨', src: 'data:audio/mpeg;base64,xx', autoplay: true },
      { id: 't2', name: '街', src: 'local:abc' },
      { id: 't3', name: '网', src: 'https://cdn.example/a.mp3' },
    ],
    audioRefs: ['au_1', 'missing'],
  };
  const rows = lib.musicRows(content, look);
  assert.deepEqual(rows.map((r) => r.source), ['embed', 'local', 'link', 'ref', 'ref']);
  assert.equal(rows[3].name, '钢琴');
  assert.equal(rows[3].nameLocked, true);
  assert.equal(rows[3].autoplay, false);
  assert.equal(rows[4].missing, true);
  assert.equal(rows[0].autoplay, true);
  const back = lib.applyMusicRows(rows);
  assert.equal(back.bgm[0].src.startsWith('data:'), true);
  assert.equal(back.bgm[0].autoplay, true);
  assert.equal(back.bgm[1].src, 'local:abc');
  assert.equal(back.bgm[2].src, 'https://cdn.example/a.mp3');
  assert.deepEqual(back.audioRefs, ['au_1', 'missing']);
  assert.equal(back.platformAudioRefs, undefined);
  assert.equal(JSON.stringify(back.bgm).includes('au_1'), false);
  assert.equal(JSON.stringify(back.bgm).includes('platform:'), false);
});

test('平台曲只把id写入平台引用_不进bgm或audioRefs', () => {
  const rows = lib.musicRows({ platformAudioRefs: ['platform:cc0-bed', 'platform:gone'] }, look);
  assert.equal(rows[0].source, 'platform');
  assert.equal(rows[0].name, '短循环示例');
  assert.equal(rows[0].nameLocked, true);
  assert.equal(rows[0].missing, false);
  assert.equal(rows[1].missing, true);
  const back = lib.applyMusicRows(rows);
  assert.deepEqual(back.platformAudioRefs, ['platform:cc0-bed', 'platform:gone']);
  assert.equal(back.bgm, undefined);
  assert.equal(back.audioRefs, undefined);
  assert.equal(back.platformAudioRefs.every((id) => id.startsWith('platform:') || id === 'platform:gone'), true);
});

test('上移下移只改顺序键_曲目仍分三个字段', () => {
  const rows = lib.musicRows({
    bgm: [{ id: 't1', name: '雨', src: 'https://a.mp3' }],
    audioRefs: ['au_1'],
    platformAudioRefs: ['platform:cc0-bed'],
  }, look);
  const moved = [rows[2], rows[0], rows[1]];
  const back = lib.applyMusicRows(moved);
  const again = lib.musicRows(back, look);
  assert.deepEqual(again.map((r) => r.id), ['platform:cc0-bed', 't1', 'au_1']);
  assert.deepEqual(back.bgm.map((t) => t.id), ['t1']);
  assert.equal(back.bgm[0].src, 'https://a.mp3');
  assert.deepEqual(back.audioRefs, ['au_1']);
  assert.deepEqual(back.platformAudioRefs, ['platform:cc0-bed']);
});

test('自动播放全列表只一首_引用不能勾_失效平台不能勾上', () => {
  const rows = lib.musicRows({
    bgm: [{ id: 't1', name: '雨', src: 'https://a.mp3', autoplay: true }],
    audioRefs: ['au_1'],
    platformAudioRefs: ['platform:cc0-bed', 'platform:gone'],
    platformAutoplay: 'platform:cc0-bed',
  }, look);
  assert.equal(rows.filter((r) => r.autoplay).length, 1);
  assert.equal(rows.find((r) => r.source === 'ref').autoplay, false);
  const forced = rows.map((r) => ({ ...r, autoplay: r.id === 'platform:cc0-bed' }));
  const back = lib.applyMusicRows(forced);
  assert.equal(back.bgm[0].autoplay, undefined);
  assert.equal(back.platformAutoplay, 'platform:cc0-bed');
  const gone = lib.applyMusicRows(rows.map((r) => ({ ...r, autoplay: r.id === 'platform:gone' })));
  assert.equal(gone.platformAutoplay, undefined);
});

test('地点下拉直接含平台曲_引用名后带引用_未加入列表也能选', () => {
  const opts = lib.locationBgmOptions({
    bgm: [{ id: 't1', name: '雨', src: 'https://a.mp3' }],
    audio: [{ id: 'pack', name: '包内', kind: 'bgm' }],
    audioRefs: ['missing'],
  }, look);
  assert.ok(opts.some((o) => o.id === 't1' && o.name === '雨'));
  assert.ok(opts.some((o) => o.id === 'pack'));
  assert.ok(opts.some((o) => o.id === 'missing' && o.name.endsWith('（引用）')));
  assert.ok(opts.some((o) => o.id === 'platform:cc0-bed' && o.name.endsWith('（平台）')));
  assert.ok(opts.some((o) => o.id === 'platform:cc0-roar' && o.name.endsWith('（平台）')));
});

test('缺失与下架只警告_脏数据不抛', () => {
  const warnings = lib.musicHealthWarnings({
    audioRefs: ['nope'],
    platformAudioRefs: ['platform:gone'],
    rooms: { inn: { bgm: 'platform:nope' } },
    events: [{ bgm: 'platform:cc0-bed' }],
  }, look);
  assert.ok(warnings.some((t) => t.includes('nope') && t.includes('作品音频库')));
  assert.ok(warnings.some((t) => t.includes('platform:gone')));
  assert.ok(warnings.some((t) => t.includes('platform:nope')));
  assert.equal(warnings.some((t) => t.includes('platform:cc0-bed')), false);
  assert.doesNotThrow(() => lib.musicRows({ bgm: [null, { src: 1 }, 'x'], audioRefs: 'nope', platformAudioRefs: { id: 'x' } }, { author: [], platform: [] }));
});

test('平台曲id带前缀且分类齐全_背景音乐默认循环', () => {
  const ids = plat.PLATFORM_AUDIO.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of plat.PLATFORM_AUDIO) assert.match(t.id, /^platform:/);
  assert.deepEqual(plat.PLATFORM_AUDIO.map((t) => t.kind).sort(), ['amb', 'bgm', 'sfx']);
  const assets = plat.platformAudioAssets();
  assert.equal(assets.find((a) => a.kind === 'bgm').loop, true);
  assert.equal(assets.find((a) => a.kind === 'sfx').loop, false);
  assert.equal(assets.every((a) => a._mod == null), true);
  assert.equal(plat.platformTrack('platform:gone'), undefined);
});

test('平台曲盖住同id且不带_mod_模组注入不收平台引用', () => {
  const libMap = new Map([['platform:cc0-bed', { id: 'platform:cc0-bed', name: '假的', kind: 'bgm', src: 'data:fake', _mod: 'm' }]]);
  plat.overlayPlatformAudio(libMap);
  const bed = libMap.get('platform:cc0-bed');
  assert.equal(bed.name, '短循环示例');
  assert.equal(bed._mod, undefined);
  assert.equal(bed.src, plat.platformTrack('platform:cc0-bed').src);
  assert.equal(libMap.has('platform:gone'), false);
  assert.match(audioSrc, /overlayPlatformAudio\(m\)/);
  assert.match(audioSrc, /startsWith\("platform:"\) \? "（平台）"/);
  const fn = audioSrc.slice(audioSrc.indexOf('export function modAudio'), audioSrc.indexOf('export function authorTracks'));
  assert.match(fn, /return \[\.\.\.own, \.\.\.legacy\]/);
  assert.doesNotMatch(fn, /platformAudioRefs\s*\?\?/);
});

test('清洗后平台id仍是字符串_内嵌曲目不被收成只剩id', () => {
  const mod = sanitize.sanitizeModStrings({
    id: 'm', name: '曲', version: '1', kind: 'world', dependencies: [],
    content: {
      bgm: { id: 't1', name: '雨', src: 'https://cdn.example/a.mp3' },
      audioRefs: ['au_x'],
      platformAudioRefs: { id: 'platform:cc0-bed' },
      platformAutoplay: { id: 'platform:cc0-bed' },
      musicOrder: ['b:t1', 'platform:cc0-bed'],
    },
  });
  assert.equal(Array.isArray(mod.content.bgm), true);
  assert.equal(mod.content.bgm[0].id, 't1');
  assert.equal(mod.content.bgm[0].name, '雨');
  assert.equal(mod.content.bgm[0].src, 'https://cdn.example/a.mp3');
  assert.deepEqual(mod.content.audioRefs, ['au_x']);
  assert.deepEqual(mod.content.platformAudioRefs, ['platform:cc0-bed']);
  assert.equal(mod.content.platformAutoplay, 'platform:cc0-bed');
  assert.deepEqual(mod.content.musicOrder, ['b:t1', 'platform:cc0-bed']);
});

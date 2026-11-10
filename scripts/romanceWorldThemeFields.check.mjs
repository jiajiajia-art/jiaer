/**
 * C0.2 / P4.1：世界题材可写（编辑器字段）+ 平台题材合并 + 绿信品牌串接线
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

test('applyPlatformThemeToMod_只补缺_不覆盖创作者已写', async () => {
  const { applyPlatformThemeToMod } = await load('lib/worldTheme.ts');
  const platform = { themeTagIds: [7, 9], themeTagNames: ['古代仙侠', '玄幻'], themeTagCodes: ['ancient', 'fantasy'] };
  const empty = { kind: 'world', name: 'w' };
  assert.deepEqual(applyPlatformThemeToMod(empty, platform), {
    kind: 'world', name: 'w', themeTagId: 7, themeLabel: '古代仙侠', themeCode: 'ancient',
  });
  // 已有字段不覆盖，只补缺的
  const partial = { kind: 'world', name: 'w', themeLabel: '现代都市', themeTagId: 3 };
  const merged = applyPlatformThemeToMod(partial, platform);
  assert.equal(merged.themeLabel, '现代都市');
  assert.equal(merged.themeTagId, 3);
  assert.equal(merged.themeCode, 'ancient');
  // 清单齐全 / 平台无题材 → 同一引用（调用方据此判断是否有变化）
  const full = { kind: 'world', name: 'w', themeLabel: 'x', themeTagId: 1, themeCode: 'y' };
  assert.equal(applyPlatformThemeToMod(full, platform), full);
  assert.equal(applyPlatformThemeToMod(empty, { themeTagIds: [], themeTagNames: [] }), empty);
  assert.equal(applyPlatformThemeToMod(empty, null), empty);
  // 非法 id 丢弃，仍可用名称
  const byName = applyPlatformThemeToMod(empty, { themeTagIds: [NaN], themeTagNames: ['仙侠'] });
  assert.equal(byName.themeLabel, '仙侠');
  assert.equal(byName.themeTagId, undefined);
});

test('applyPlatformThemeToMod_补入的题材驱动传讯换皮', async () => {
  const { applyPlatformThemeToMod, resolveWorldCommsBrand } = await load('lib/worldTheme.ts');
  const mod = applyPlatformThemeToMod({ kind: 'world', name: '某某世界' }, { themeTagIds: [1], themeTagNames: ['古代宫斗'] });
  assert.equal(resolveWorldCommsBrand([mod]).skin, 'letter');
});

test('patchWorldTheme_空串落undefined_commsSkin只认modern或letter_id只认正数', async () => {
  const { patchWorldTheme } = await load('lib/worldTheme.ts');
  const base = { kind: 'world', name: 'w', themeLabel: '旧', themeCode: 'old', commsSkin: 'modern', themeTagId: 5 };
  const cleared = patchWorldTheme(base, { themeLabel: '  ', themeCode: '', commsSkin: '', themeTagId: null });
  assert.equal(cleared.themeLabel, undefined);
  assert.equal(cleared.themeCode, undefined);
  assert.equal(cleared.commsSkin, undefined);
  assert.equal(cleared.themeTagId, undefined);
  const set = patchWorldTheme(base, { themeLabel: ' 古代 ', commsSkin: 'LETTER', themeTagId: 12 });
  assert.equal(set.themeLabel, '古代');
  assert.equal(set.commsSkin, 'letter');
  assert.equal(set.themeTagId, 12);
  assert.equal(set.themeCode, 'old'); // 未传的字段不动
  assert.equal(patchWorldTheme(base, { commsSkin: 'weird' }).commsSkin, undefined);
  assert.equal(patchWorldTheme(base, { themeTagId: -3 }).themeTagId, undefined);
  assert.equal(patchWorldTheme(base, { themeTagId: Number.NaN }).themeTagId, undefined);
});

test('flattenThemeTagTree_取叶子_去重_丢非法节点', async () => {
  const { flattenThemeTagTree, parseGameThemeFromInfo } = await load('lib/platformThemeTags.ts');
  const tree = [
    { id: 1, name: '言情', code: 'romance', children: [{ id: 11, name: '现代都市', code: 'modern' }, { id: 12, name: '古代宫斗', code: 'ancient' }, { id: 11, name: '重复', code: 'dup' }] },
    { id: 2, name: '无子级', code: 'solo' },
    { id: 'x', name: '坏' },
    null,
  ];
  assert.deepEqual(flattenThemeTagTree(tree).map((t) => t.id), [11, 12, 2]);
  assert.deepEqual(flattenThemeTagTree(undefined), []);
  assert.deepEqual(parseGameThemeFromInfo({ theme_tag_ids: [3, 'a', 4], theme_tag_names: ['甲', '乙'] }), { themeTagIds: [3, 4], themeTagNames: ['甲', '乙'] });
  assert.equal(parseGameThemeFromInfo({}), null);
  assert.equal(parseGameThemeFromInfo(null), null);
});

test('ModEditorPanel_基本信息两条路径都挂世界题材字段_并向玩法商店和手机应用传enabledThemeTags', () => {
  const panel = read('components/ModEditorPanel.tsx');
  assert.equal((panel.match(/<WorldThemeFields /g) || []).length, 2, 'authorSimplify 与完整路径各一处');
  assert.match(panel, /patchWorldTheme\(m, patch\)/);
  assert.equal((panel.match(/enabledThemeTags=\{enabledThemeTags\}/g) || []).length, 2, 'AddPlayModModal + PhoneAppsEditor');
  assert.match(panel, /fetchPlatformThemeTags\(\)/);
  assert.match(panel, /applyPlatformThemeToMod\(latest, theme\)/);
  const fields = read('components/WorldThemeFields.tsx');
  assert.match(fields, /data-world-theme-fields/);
  for (const k of ['data-world-theme-label', 'data-world-theme-code', 'data-world-theme-comms-skin', 'data-world-theme-tag']) {
    assert.ok(fields.includes(k), `缺少 ${k}`);
  }
  assert.match(fields, /COMMS_SKIN_OPTIONS/);
});

test('PlayerPlayBootstrap_进局前补平台题材_失败不阻断', () => {
  const src = read('components/PlayerPlayBootstrap.tsx');
  assert.match(src, /fetchPlatformGameTheme\(fileId\)/);
  assert.match(src, /applyPlatformThemeToMod\(mod, theme\)/);
  assert.match(src, /requestAuthorPreview\(playMod,/);
  const lib = read('lib/platformThemeTags.ts');
  assert.match(lib, /\/api\/auth\/games\/info\?fileId=/);
  assert.match(lib, /gameThemeInflight/);
  assert.match(lib, /\/api\/auth\/game-tags\/tree/);
});

test('chat_IncomingCall_PeekApp_绿信串走brand_不再写死', () => {
  const chat = read('components/phone/chat.tsx');
  assert.match(chat, /useCommsBrand\(\)/);
  assert.match(chat, /`\$\{brand\.appName\}\$\{video \? "视频" : "语音"\}`/);
  assert.match(chat, /\{brand\.appName\}\{red \? "红包" : "转账"\}/);
  assert.match(chat, /app: brand\.appName/);
  assert.doesNotMatch(chat, /"绿信视频"|"绿信语音"|"绿信红包"|"绿信转账"/);
  assert.doesNotMatch(chat, /app: "绿信"/);

  const call = read('components/phone/IncomingCall.tsx');
  assert.match(call, /useCommsBrand\(\)/);
  assert.match(call, /`\$\{brand\.appName\}\$\{r\.video \? "视频" : "语音"\}`/);
  assert.doesNotMatch(call, /app: "绿信"|"绿信视频"|"绿信语音"/);

  const peek = read('components/phone/PeekApp.tsx');
  assert.match(peek, /useCommsBrand\(\)/);
  assert.match(peek, /brand\.appName/);
  assert.match(peek, /appLabel\(a\)/);
  assert.doesNotMatch(peek, /`绿信 · /);
  assert.doesNotMatch(peek, /还没在绿信上聊过/);
});

test('fetchPlatformGameTheme_同fileId并发只发一次请求_失败返回null', async () => {
  const { fetchPlatformGameTheme } = await load('lib/platformThemeTags.ts');
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /\/api\/auth\/games\/info\?fileId=g1$/);
    return { ok: true, json: async () => ({ success: true, data: { theme_tag_ids: [5], theme_tag_names: ['古代'] } }) };
  };
  try {
    const [a, b] = await Promise.all([fetchPlatformGameTheme('g1'), fetchPlatformGameTheme('g1')]);
    assert.equal(calls, 1);
    assert.deepEqual(a, { themeTagIds: [5], themeTagNames: ['古代'] });
    assert.deepEqual(b, a);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal(await fetchPlatformGameTheme('g2'), null);
    assert.equal(await fetchPlatformGameTheme(''), null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

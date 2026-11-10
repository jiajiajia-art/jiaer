/**
 * P4.1 绿信 ↔ 传讯：按世界题材换皮的纯逻辑 + Phone / WeChatApp 接线
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

test('resolveCommsBrand_现代默认绿信_古代仙侠传讯_无题材不猜时代', async () => {
  const { resolveCommsBrand, resolveCommsSkin } = await load('lib/commsSkin.ts');
  assert.equal(resolveCommsBrand().appName, '绿信');
  assert.equal(resolveCommsBrand({ themeLabel: '现代都市' }).skin, 'modern');
  for (const label of ['古代宫斗', '仙侠', '玄幻', '武侠']) {
    const b = resolveCommsBrand({ themeLabel: label });
    assert.equal(b.skin, 'letter', label);
    assert.equal(b.appName, '传讯');
    assert.equal(b.accountLabel, '传讯号');
    assert.equal(b.aboutTitle, '关于传讯');
    assert.equal(b.safetyCenter, '传讯安全中心');
  }
  assert.equal(resolveCommsSkin({ themeCode: 'ancient' }), 'letter');
  assert.equal(resolveCommsSkin({ themeLabel: '', themeCode: '' }), 'modern');
  // 显式覆盖优先于题材
  assert.equal(resolveCommsSkin({ themeLabel: '古代', override: 'modern' }), 'modern');
  assert.equal(resolveCommsSkin({ themeLabel: '现代', override: 'letter' }), 'letter');
});

test('applyCommsBrandText_letter按长词优先替换_modern原样', async () => {
  const { resolveCommsBrand, applyCommsBrandText } = await load('lib/commsSkin.ts');
  const letter = resolveCommsBrand({ themeLabel: '仙侠' });
  assert.equal(applyCommsBrandText('绿信安全中心', letter), '传讯安全中心');
  assert.equal(applyCommsBrandText('关于绿信 · 绿信号 · 绿信', letter), '关于传讯 · 传讯号 · 传讯');
  assert.doesNotMatch(applyCommsBrandText('打开绿信看看', letter), /绿信/);
  const modern = resolveCommsBrand({ themeLabel: '现代' });
  assert.equal(applyCommsBrandText('绿信号', modern), '绿信号');
  assert.equal(applyCommsBrandText('', letter), '');
});

test('worldTheme_读清单题材字段_链上后者覆盖_世界名兜底只在无显式题材时用', async () => {
  const { readWorldThemeHint, resolveWorldCommsBrand } = await load('lib/worldTheme.ts');
  assert.deepEqual(readWorldThemeHint(null), { themeTagId: null, themeLabel: '', themeCode: '', commsSkin: '' });
  const h = readWorldThemeHint([
    { kind: 'world', themeTagId: 3, themeLabel: '现代都市' },
    { kind: 'addon', themeLabel: ' 古代 ', commsSkin: 'letter' },
  ]);
  assert.equal(h.themeTagId, 3);
  assert.equal(h.themeLabel, '古代');
  assert.equal(h.commsSkin, 'letter');

  // 显式题材 > 世界名
  assert.equal(resolveWorldCommsBrand([{ kind: 'world', name: '古代宫廷', themeLabel: '现代都市' }]).skin, 'modern');
  // 无题材字段：世界名兜底
  assert.equal(resolveWorldCommsBrand([{ kind: 'world', name: '仙侠世界' }]).skin, 'letter');
  assert.equal(resolveWorldCommsBrand([{ kind: 'world', name: '娱乐圈 2005' }]).skin, 'modern');
  assert.equal(resolveWorldCommsBrand(null).skin, 'modern');
  assert.equal(resolveWorldCommsBrand([{ kind: 'world', name: '现代', commsSkin: 'letter' }]).appName, '传讯');
});

test('Phone桌面_绿信名走commsBrand_锁屏通知用brand_appName', () => {
  const src = read('components/Phone.tsx');
  assert.match(src, /useCommsBrand\(\)/);
  assert.match(src, /brandAppName\(id, /);
  assert.match(src, /\["wechat", commsBrand\.appName, unreadTotal/);
  assert.doesNotMatch(src, /\["wechat", "绿信", unreadTotal/);
  // 应用名统一经 brandAppName（含平台表 name），避免平台表仍叫「绿信」
  assert.match(src, /label = brandAppName\(a, /);
});

test('WeChatApp_品牌串全部走brand_外壳带data-comms-skin_letter隐藏现代社交入口', () => {
  const src = read('components/phone/WeChatApp.tsx');
  assert.match(src, /data-comms-skin=\{brand\.skin\}/);
  assert.match(src, /useCommsBrand\(\)/);
  for (const k of ['brand.accountLabel', 'brand.safetyCenter', 'brand.aboutTitle', 'brand.appName']) {
    assert.ok(src.includes(k), `缺少 ${k}`);
  }
  // JSX / 标题里不得再写死这些品牌串（注释与 AI 提示外）
  assert.doesNotMatch(src, /label="绿信号"/);
  assert.doesNotMatch(src, /label="绿信安全中心"/);
  assert.doesNotMatch(src, /title="关于绿信"/);
  assert.doesNotMatch(src, /label: "绿信"/);
  // 书信风隐藏朋友圈 / 视频号 / 摇一摇
  assert.match(src, /letterSkin = useCommsBrand\(\)\.skin === "letter"/);
  assert.match(src, /!letterSkin && .*label="朋友圈"/s);
  assert.match(src, /!letterSkin && \(\s*<div>\s*<Item.*?label="视频号"/s);
  assert.match(src, /!letterSkin && \(\s*<div>\s*<Item.*?label="摇一摇"/s);
});

test('index_css_letter皮肤_纸笺背景_不改modern', () => {
  const css = read('index.css');
  assert.match(css, /\[data-comms-skin="letter"\]/);
  assert.match(css, /\[data-wx-chat-bg="default"\]/);
  // 所有传讯规则都必须挂在 letter 选择器下，避免污染 modern
  const block = css.slice(css.indexOf('P4.1 传讯'));
  for (const line of block.split('\n').filter((l) => /\{\s*$|^\[/.test(l) && l.includes('[data-'))) {
    assert.match(line, /data-comms-skin="letter"/);
  }
  const chat = read('components/phone/chat.tsx');
  assert.match(chat, /data-wx-chat-bg=/);
});

test('useCommsBrand_读世界合并链', () => {
  const src = read('components/phone/commsBrand.ts');
  assert.match(src, /resolveWorldCommsBrand\(getWorld\(\)\.chain\)/);
});

test('chat_绿信语音视频红包转账串走brand_不写死', () => {
  const chat = read('components/phone/chat.tsx');
  assert.match(chat, /useCommsBrand\(\)/);
  assert.match(chat, /\$\{brand\.appName\}\$\{video \? "视频" : "语音"\}/);
  assert.match(chat, /\{brand\.appName\}\{red \? "红包" : "转账"\}/);
  assert.doesNotMatch(chat, /"绿信红包"|"绿信转账"|"绿信视频"|"绿信语音"|app: "绿信"/);
});

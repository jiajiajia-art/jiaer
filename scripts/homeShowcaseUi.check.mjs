/**
 * 首页公告条 / 精选胶囊 / 分区标题对齐效果图。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('Home_公告条应使用公告标签与箭头而非喇叭图标', () => {
  const tsx = read('src/page/Home.tsx');
  const css = read('src/page/Home.module.css');
  assert.match(tsx, /homeTickerBadge/);
  assert.match(tsx, /home\.announcementBadge/);
  assert.match(tsx, /homeTickerDivider/);
  assert.doesNotMatch(tsx, /homeTickerIcon/);
  assert.match(css, /\.homeTickerBadge/);
  assert.match(css, /\.homeTickerDivider/);
  assert.match(css, /\.homeTickerAction::before/);
});

test('Home_精选区标题应为固定挑选文案且无红色方标', () => {
  const tsx = read('src/page/Home.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /home\.showcasePickTitle/);
  assert.doesNotMatch(tsx, /themeShowcaseTitleMarker/);
  assert.match(zh, /"showcasePickTitle":\s*"为您挑选最值得一看的互动剧情"/);
});

test('Home_主题胶囊应为大号酒红选中态', () => {
  const css = read('src/page/Home.module.css');
  assert.match(css, /\.themeShowcaseItem\s*\{[^}]*min-height:\s*40px/);
  assert.match(css, /\.themeShowcaseItemActive[\s\S]*background:\s*#8E2135/);
  assert.match(css, /\.themeShowcase\s*\{[^}]*background:\s*transparent/);
});

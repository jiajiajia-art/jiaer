import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/**
 * 功能注释：页脚必须落在页面最底部（纵向堆叠），禁止再做成右侧栏；
 * 覆盖首页 / 书架 / 分类 / 创作 / 仓库 / 排行榜与壳层。
 * 移动端仅法律一行，隐藏 Logo/口号/关注/加入/联系完整站脚。
 */
test('FooterArea_应作为全宽底部页脚且手机端可见', () => {
  const css = read('src/components/Layout/FooterArea.module.css');
  const tsx = read('src/components/Layout/FooterArea.tsx');
  assert.match(tsx, /<footer\b/);
  assert.match(tsx, /data-site-footer="1"/);
  assert.match(tsx, /data-footer-mobile-compact="1"/);
  assert.match(css, /\.footer\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.footer\s*\{[\s\S]*?flex:\s*0\s+0\s+auto/);
  assert.match(css, /\.container\s*\{[\s\S]*?width:\s*min\(var\(--app-desktop-shell-max\)/);
  const mobile = css.slice(css.indexOf('@media screen and (max-width: 768px)'));
  // 功能注释：页脚本体须可见；子块（logo/linkCols）可 display:none，勿用过宽正则误判
  assert.match(mobile, /\.footer\s*\{[^}]*display:\s*flex/);
  assert.doesNotMatch(mobile, /\.footer\s*\{[^}]*display:\s*none/);
});

test('FooterArea_移动端应隐藏完整站脚只留法律行', () => {
  const css = read('src/components/Layout/FooterArea.module.css');
  const tsx = read('src/components/Layout/FooterArea.tsx');
  const mobile = css.slice(css.indexOf('@media screen and (max-width: 768px)'));
  assert.match(mobile, /\.logo[\s\S]*?display:\s*none/);
  assert.match(mobile, /\.tagline[\s\S]*?display:\s*none/);
  assert.match(mobile, /\.linkCols[\s\S]*?display:\s*none/);
  assert.match(tsx, /styles\.legal/);
  assert.match(tsx, /footer\.copyright/);
  assert.match(tsx, /footer\.privacyPolicy/);
  assert.match(tsx, /footer\.userAgreement/);
  // PC 仍保留商务/反馈入口；移动端不靠这块页脚
  assert.match(tsx, /data-footer-desktop-links="1"/);
  assert.match(tsx, /setBusinessOpen\(true\)/);
  assert.match(tsx, /setFeedbackOpen\(true\)/);
});

test('AppPageShell_主滚动区应纵向堆叠以便页脚落底', () => {
  const css = read('src/components/Layout/AppPageShell.module.css');
  assert.match(css, /\.main\s*\{[\s\S]*?display:\s*flex/);
  assert.match(css, /\.main\s*\{[\s\S]*?flex-direction:\s*column/);
});

const COLUMN_LAYOUT_PAGES = [
  'src/page/Home.module.css',
  'src/page/Create.module.css',
  'src/page/WareHouse.module.css',
  'src/page/Favorites.module.css',
  'src/page/Categories.module.css',
  'src/page/Library.module.css',
];

test('关键列表页_mainContent应纵向布局且无右侧栏预留大 margin', () => {
  for (const rel of COLUMN_LAYOUT_PAGES) {
    const css = read(rel);
    assert.match(
      css,
      /\.mainContent\s*\{[\s\S]*?flex-direction:\s*column/,
      `${rel} 缺少 flex-direction: column`,
    );
    assert.doesNotMatch(
      css,
      /\.mainContent\s*\{[^}]*margin-bottom:\s*2\d{2}px/,
      `${rel} 仍保留右侧栏预留 margin-bottom`,
    );
  }
});

test('分类与排行榜_手机端也应渲染FooterArea', () => {
  const categories = read('src/page/Categories.tsx');
  const rankings = read('src/page/Rankings.tsx');
  assert.match(categories, /<FooterArea\s*\/>/);
  assert.match(rankings, /<FooterArea\s*\/>/);
  assert.doesNotMatch(categories, /!isMobilePage\s*&&\s*<FooterArea/);
  assert.doesNotMatch(rankings, /!isMobilePage\s*&&\s*<FooterArea/);
});

test('目标路由页_均挂载FooterArea', () => {
  const pages = [
    'src/page/Home.tsx',
    'src/page/CreateWorks.tsx',
    'src/page/Categories.tsx',
    'src/page/Create.tsx',
    'src/page/WareHouse.tsx',
    'src/page/warehouse/WarehouseHub.tsx',
    'src/page/Rankings.tsx',
  ];
  for (const rel of pages) {
    const src = read(rel);
    assert.match(src, /FooterArea/, `${rel} 未引用 FooterArea`);
    assert.match(src, /<FooterArea\b/, `${rel} 未渲染 FooterArea`);
  }
});

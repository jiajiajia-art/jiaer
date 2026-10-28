/**
 * Romance 嵌入 funloom：同端口路由契约
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('App_应懒加载RomanceHost并挂romance路由', () => {
  const app = read('src/App.tsx');
  assert.match(app, /lazy\(\(\) => import\('\.\/page\/RomanceHost'\)\)/);
  assert.match(app, /path="\/romance\/\*"/);
  assert.match(app, /<RomanceHost\s*\/>/);
});

test('RomanceHost_应经virtual模块嵌入并清理html主题class', () => {
  const host = read('src/page/RomanceHost.tsx');
  assert.match(host, /virtual:romance-app/);
  assert.match(host, /virtual:romance-css/);
  assert.match(host, /clearRomanceHtmlClasses|data-romance/);
  // 功能注释：进页须剥离主站 dark，否则 Romance 浅色纸面被主站深色壳盖成深紫底
  assert.match(host, /hostThemeClasses/);
  assert.match(host, /setAttribute\(\s*['"]data-romance['"]/);
});

test('Romance_css_主题令牌应限制在data-romance避免污染主站', () => {
  const css = read('Romance/src/index.css');
  assert.match(css, /html\[data-romance\]\s*\{/);
  assert.match(css, /html\[data-romance\]\.dark\s*\{/);
  assert.match(css, /html\[data-romance\] body/);
  assert.doesNotMatch(css, /(^|\n)\.dark\s*\{/);
});

test('Worker_应将短链romance重定向到funloomromance', () => {
  const worker = read('src/index.js');
  assert.match(worker, /path === '\/romance'/);
  assert.match(worker, /\/funloom\/romance/);
});

test('vite_应启用tailwind与romance_virtual模块', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /@tailwindcss\/vite/);
  assert.match(vite, /romance-virtual-modules|romanceVirtualModules/);
  assert.match(vite, /romance-short-link-redirect|romanceShortLinkRedirect/);
});

test('vite_应将react去重到主站node_modules避免双实例', () => {
  const vite = read('vite.config.ts');
  assert.match(vite, /dedupe:\s*\[[^\]]*['"]react['"]/);
  assert.match(vite, /react:\s*resolve\(__dirname,\s*['"]node_modules\/react['"]\)/);
  assert.match(vite, /['"]react-dom['"]:\s*resolve\(__dirname,\s*['"]node_modules\/react-dom['"]\)/);
});

test('Romance_css_嵌入时盖住主站黑壳且不整包preflight', () => {
  const css = read('Romance/src/index.css');
  // 功能注释：嵌入禁止 @import 'tailwindcss' 整包；必须 !important 盖掉主站 #root 黑底
  assert.doesNotMatch(css, /@import\s+['"]tailwindcss['"]\s*;/);
  assert.match(css, /tailwindcss\/utilities/);
  assert.match(css, /html\[data-romance\] #root/);
  assert.match(css, /background:\s*var\(--paper\)\s*!important/);
});

test('主站index_css_全局padding重置须在layer_base以免压过Romance的px工具类', () => {
  const css = read('src/index.css');
  // 功能注释：非 layer 的 *{padding:0} 会让 Modal 的 px-4 失效，路径单选/详情贴边被裁
  assert.match(css, /@layer\s+base\s*\{[\s\S]*?\*\s*\{[\s\S]*?padding:\s*0/);
  assert.doesNotMatch(css, /(?:^|\n)\*\s*\{\s*margin:\s*0;\s*padding:\s*0/);
});

test('Romance_css_须在layer_base重置fieldset默认边框', () => {
  const css = read('Romance/src/index.css');
  // 功能注释：建角「姓名/性别/身份」包在 fieldset 里；无 preflight 时浏览器默认灰框会露出来
  assert.match(css, /@layer\s+base\s*\{[\s\S]*:where\(fieldset\)[\s\S]*border:\s*0/);
  assert.match(css, /html\[data-romance\][^{]*:where\(\s*select\s*\)/);
});

/** 功能注释：去掉指定 @layer 块，用于断言「危险重置」不得落在 layer 外 */
function stripAtLayer(css, layerName) {
  const open = new RegExp(`@layer\\s+${layerName}\\s*\\{`);
  let out = css;
  for (;;) {
    const m = open.exec(out);
    if (!m) break;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < out.length && depth > 0) {
      if (out[i] === '{') depth += 1;
      else if (out[i] === '}') depth -= 1;
      i += 1;
    }
    out = `${out.slice(0, m.index)}${out.slice(i)}`;
    open.lastIndex = 0;
  }
  return out;
}

test('Romance_css_须在layer_base透明化button以免UA白底透出', () => {
  const css = read('Romance/src/index.css');
  // 功能注释：场景点位 / 地图钉 / 手机图标等都是无 bg 的 <button>；缺 preflight 时 UA buttonface 成白方块
  assert.match(
    css,
    /@layer\s+base\s*\{[\s\S]*?html\[data-romance\]\s*:where\(button[\s\S]*?background-color:\s*transparent[\s\S]*?background-image:\s*none/,
  );
  // 功能注释：曾用非 @layer 的 background-image:none 把封面渐变按钮打成白底无字
  assert.doesNotMatch(
    stripAtLayer(css, 'base'),
    /html\[data-romance\][^{]*:where\(button[^}]*background-image:\s*none/,
  );
  assert.doesNotMatch(
    css,
    /html\[data-romance\][^\n]*\.romance-host[^{]*\{[^}]*color:\s*var\(--ink\)\s*!important/,
  );
});

test('Romance_css_须在layer_base清掉ul默认disc圆点', () => {
  const css = read('Romance/src/index.css');
  assert.match(
    css,
    /@layer\s+base\s*\{[\s\S]*?html\[data-romance\]\s*:where\(ul,\s*ol,\s*menu\)[\s\S]*?list-style:\s*none/,
  );
  const create = read('Romance/src/components/CharacterCreate.tsx');
  // 功能注释：文案前缀已是「· 」；依赖 base 去掉 UA 圆点，避免双重要点
  assert.match(create, /<ul className="space-y-0\.5 text-ink-soft">\{choose\.map/);
  assert.match(create, /<li key=\{`\$\{ci\}-\$\{c\}`\}>· /);
  // 自设页不再重复展示「人物线路选择」摘要（线路已在上一步选定）
  assert.match(create, /自设页不再重复展示/);
  assert.doesNotMatch(create, /pathBonus && <p className="mt-0\.5 text-\[11\.5px\]/);
});

test('Romance_css_须在layer_base清掉input默认inset边框', () => {
  const css = read('Romance/src/index.css');
  // 功能注释：行动胶囊里的 input 只有 bg-transparent，依赖 base 去掉 UA inset 灰框
  assert.match(
    css,
    /@layer\s+base\s*\{[\s\S]*?html\[data-romance\]\s*:where\(\s*input:not\([\s\S]*?background-color:\s*transparent[\s\S]*?border-width:\s*0/,
  );
  const home = read('Romance/src/components/HomeTab.tsx');
  assert.match(home, /placeholder="写下你的行动，或说一句台词/);
  assert.match(home, /className="w-full bg-transparent[^"]*outline-none"/);
});

test('SceneSpot_点位按钮本身不设白底依赖base透明', () => {
  const tsx = read('Romance/src/components/HomeTab.tsx');
  // 功能注释：点位是 flex button 包 spot-mark + 深色胶囊；按钮自身不得写死 bg-white / bg-paper
  assert.match(tsx, /export function SceneSpot/);
  const spotFn = tsx.slice(tsx.indexOf('export function SceneSpot'), tsx.indexOf('function PersonCard'));
  assert.match(spotFn, /className="group pointer-events-auto flex/);
  assert.doesNotMatch(spotFn, /className="group pointer-events-auto flex[^"]*\bbg-(?:white|paper)/);
});

/**
 * 功能注释：国内站禁止拉取外链字体（googleapis / loli / figma static 会超时或不可用）。
 * examples/ 示例页除外；正式入口 index.html、src/、Romance/src/、public/fonts 必须干净。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'Romance', 'src'), join(ROOT, 'public', 'fonts')];
const EXT = new Set(['.css', '.scss', '.tsx', '.ts', '.jsx', '.js', '.html']);
const FORBIDDEN = /fonts\.googleapis\.com|fonts\.gstatic\.com|fonts\.loli\.net|gstatic\.loli\.net|static\.figma\.com\/font/i;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(p, out);
    } else {
      const dot = name.lastIndexOf('.');
      if (dot >= 0 && EXT.has(name.slice(dot))) out.push(p);
    }
  }
  return out;
}

function collectHits(file) {
  const text = readFileSync(file, 'utf8');
  const hits = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!FORBIDDEN.test(line)) return;
    // 功能注释：注释里写「禁止 xxx」不算违规；只拦真实 URL / href / @import
    if (/功能注释|禁止|ERR_CONNECTION/.test(line) && !/@import\s+url|href\s*=|src:\s*url\(https?:/.test(line)) return;
    hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
  });
  return hits;
}

test('noGoogleFontsImport_src与Romance禁止外链字体', () => {
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) hits.push(...collectHits(file));
  }
  hits.push(...collectHits(join(ROOT, 'index.html')));
  assert.equal(hits.length, 0, `发现外链字体:\n${hits.join('\n')}`);
});

test('index.html_字体走本地BASE_URL包', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /%BASE_URL%fonts\/game\/fonts\.css/);
  assert.doesNotMatch(html, /href\s*=\s*["']https?:\/\/fonts\./i);
  assert.doesNotMatch(html, /preconnect[^>]+fonts\./i);
});

test('本地游戏字体包存在且无外链', () => {
  const cssPath = join(ROOT, 'public/fonts/game/fonts.css');
  assert.equal(existsSync(cssPath), true);
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /ZCOOL KuaiLe/);
  assert.match(css, /Ma Shan Zheng/);
  assert.match(css, /Pixelify Sans/);
  assert.match(css, /Baloo 2/);
  assert.doesNotMatch(css, /https?:\/\//);
  for (const name of [
    'ZCOOLKuaiLe-Regular.woff',
    'ZCOOLXiaoWei-Regular.woff',
    'MaShanZheng-Regular.woff',
    'LongCang-Regular.woff',
    'ZhiMangXing-Regular.woff',
    'PixelifySans-Regular.woff',
    'VT323-Regular.woff',
    'Baloo2-Bold.woff',
    'Baloo2-ExtraBold.woff',
  ]) {
    assert.equal(existsSync(join(ROOT, 'public/fonts/game', name)), true, `缺少 ${name}`);
  }
});

/**
 * 功能注释：国内站禁止 CSS/HTML 拉取 fonts.googleapis.com（会 ERR_CONNECTION_TIMED_OUT）。
 * examples/ 示例页除外；正式入口 src/ 与 Romance/src/ 必须干净。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = [join(ROOT, 'src'), join(ROOT, 'Romance', 'src')];
const EXT = new Set(['.css', '.scss', '.tsx', '.ts', '.jsx', '.js', '.html']);
const FORBIDDEN = /fonts\.googleapis\.com|fonts\.gstatic\.com/i;

function walk(dir, out = []) {
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

test('noGoogleFontsImport_src与Romance禁止外链Google字体', () => {
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const text = readFileSync(file, 'utf8');
      // 功能注释：注释里写「禁止 fonts.googleapis」不算违规；只拦真实 URL 引用
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!FORBIDDEN.test(line)) return;
        if (/功能注释|禁止|ERR_CONNECTION/.test(line) && !/@import\s+url|href\s*=/.test(line)) return;
        hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      });
    }
  }
  assert.equal(hits.length, 0, `发现 Google Fonts 外链:\n${hits.join('\n')}`);
});

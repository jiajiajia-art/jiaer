/**
 * 自定义 ZIP：须用打包 fflate，禁止 jsDelivr CDN（Aliyun 国内常失败）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { unzipCustomZipBytes } from '../src/lib/unzipCustomZip.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('CustomIFCreate_禁止jsdelivr加载fflate', () => {
  const src = readFileSync(join(root, 'src/page/CustomIFCreate.tsx'), 'utf8');
  assert.doesNotMatch(src, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(src, /ensureZipLib/);
  assert.doesNotMatch(src, /window as any\)\.fflate/);
  assert.match(src, /unzipCustomZipBytes/);
  assert.match(src, /import\('\.\.\/lib\/unzipCustomZip'\)/);
});

test('unzipCustomZipBytes_应解出index\.html', async () => {
  // 最小合法 ZIP：空压缩存储一条 index.html
  const files = {
    'index.html': new TextEncoder().encode('<!doctype html><title>t</title>'),
  };
  // 功能注释：用 fflate.zipSync 造包再解，验证我们的包装层可用
  const { zipSync } = await import('fflate');
  const zipped = zipSync(files);
  const out = await unzipCustomZipBytes(zipped);
  assert.ok(out['index.html']);
  assert.match(new TextDecoder().decode(out['index.html']), /doctype html/i);
  // 直接 unzipSync 对照，避免包装层静默丢文件
  const direct = unzipSync(zipped);
  assert.equal(Object.keys(out).sort().join(','), Object.keys(direct).sort().join(','));
});

test('package.json_须声明fflate依赖', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies?.fflate || pkg.devDependencies?.fflate);
});

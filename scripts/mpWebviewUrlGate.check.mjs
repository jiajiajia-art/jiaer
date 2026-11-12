/**
 * 小程序 web-view：禁止把 CustomIF /public entry 当成顶层地址。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// 小程序仓库 ../mp-native 不在本机（只拉了前端）时整文件跳过，在本机照常校验
const mpRoot = join(root, '../mp-native');
const skipNoMp = existsSync(mpRoot) ? false : '小程序仓库 mp-native 不在本机，跳过';
const { isAllowedMiniProgramWebViewUrl } = skipNoMp
  ? { isAllowedMiniProgramWebViewUrl: () => false }
  : require(join(mpRoot, 'utils/webviewUrlGate.js'));

const BASE = 'https://kurangames.cn/funloom';

test('isAllowedMiniProgramWebViewUrl_允许funloom业务路径', { skip: skipNoMp }, () => {
  assert.equal(isAllowedMiniProgramWebViewUrl('/home', BASE), true);
  assert.equal(isAllowedMiniProgramWebViewUrl('/game/abc', BASE), true);
  assert.equal(isAllowedMiniProgramWebViewUrl('/customif/abc', BASE), true);
  assert.equal(
    isAllowedMiniProgramWebViewUrl('https://kurangames.cn/funloom/customif/536f9246', BASE),
    true,
  );
});

test('isAllowedMiniProgramWebViewUrl_拒绝public静态包与跨域', { skip: skipNoMp }, () => {
  assert.equal(
    isAllowedMiniProgramWebViewUrl(
      'https://kurangames.cn/public/custom/apps/536f9246/ui/1.0.18/GalGame-funloom/index.html',
      BASE,
    ),
    false,
  );
  assert.equal(isAllowedMiniProgramWebViewUrl('/public/custom/apps/x/index.html', BASE), false);
  assert.equal(
    isAllowedMiniProgramWebViewUrl('https://kurangames.cn/funloom/public/custom/apps/x/index.html', BASE),
    false,
  );
  assert.equal(
    isAllowedMiniProgramWebViewUrl('https://gogo.kurangames.com/funloom/home', BASE),
    false,
  );
});

test('mp-native_index须接入webviewUrlGate', { skip: skipNoMp }, () => {
  const src = readFileSync(join(root, '../mp-native/pages/index/index.js'), 'utf8');
  assert.match(src, /webviewUrlGate/);
  assert.match(src, /isAllowedMiniProgramWebViewUrl/);
  assert.match(src, /ignore non-SPA load src/);
});

test('CustomIF_小程序须同源拼public入口', { skip: skipNoMp }, () => {
  const src = readFileSync(join(root, 'src/page/CustomIF.tsx'), 'utf8');
  assert.match(src, /isMiniProgramEnv/);
  assert.match(src, /window\.location\.origin/);
  assert.match(src, /ASSET_HOST_ADDRESS/);
});

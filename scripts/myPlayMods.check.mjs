/**
 * C2.3「我的玩法 Mod」：分组/过滤/kkmod 解析 + 入口与禁止运营列表断言。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const lib = await import(pathToFileURL(join(root, 'src/lib/myPlayMods.ts')).href);

test('myPlayMods_groupMyPlayMods_三组且剔除官方与非玩法类', () => {
  const g = lib.groupMyPlayMods([
    { id: 'a', name: '甲', status: 'draft', componentKind: 'gameplay', origin: 'creator' },
    { id: 'b', name: '乙', status: 'private_test', componentKind: 'gameplay', origin: 'creator' },
    { id: 'c', name: '丙', status: 'pending', componentKind: 'gameplay', origin: 'creator' },
    { id: 'd', name: '丁', status: 'listed', componentKind: 'gameplay', origin: 'creator' },
    { id: 'e', name: '官方', status: 'listed', componentKind: 'gameplay', origin: 'official' },
    { id: 'f', name: '应用', status: 'draft', componentKind: 'phone_app', origin: 'creator' },
    { id: '', name: '无id', status: 'draft' },
  ]);
  assert.deepEqual(g.draft.map((x) => x.id), ['a']);
  assert.deepEqual(g.private.map((x) => x.id), ['b', 'c']);
  assert.deepEqual(g.published.map((x) => x.id), ['d']);
});

test('myPlayMods_status_下架停用归私有便于改后重提', () => {
  assert.equal(lib.groupKeyOfPlayModStatus('delisted'), 'private');
  assert.equal(lib.groupKeyOfPlayModStatus('disabled'), 'private');
  assert.equal(lib.groupKeyOfPlayModStatus('listed'), 'published');
});

test('myPlayMods_parseKkmodFileText_合法包与非法输入', () => {
  const ok = lib.parseKkmodFileText(JSON.stringify({ manifest: { slug: 'my-mod', name: 'x' }, payload: {} }), 'a.kkmod');
  assert.equal(ok.ok, true);
  assert.equal(ok.filename, 'my-mod.kkmod');
  assert.equal(lib.parseKkmodFileText('not json').ok, false);
  assert.equal(lib.parseKkmodFileText('[1]').ok, false);
  const noManifest = lib.parseKkmodFileText('{"payload":{}}');
  assert.equal(noManifest.ok, false);
  assert.match(noManifest.message, /manifest/);
});

test('MyPlayMods_页面只调本人列表_不出现运营API', () => {
  const tsx = read('src/page/MyPlayMods.tsx');
  assert.match(tsx, /playModStoreApi\.listMine/);
  assert.match(tsx, /playModStoreApi\.uploadKkmod/);
  assert.match(tsx, /editComponent=/);
  assert.doesNotMatch(tsx, /playModAdminApi|\/api\/admin\//);
  assert.doesNotMatch(tsx, /\balert\(|window\.confirm/);
  const api = read('src/api/playMod/playModApi.ts');
  assert.match(api, /\/api\/components\/mine/);
});

test('CreateType_不再单独展示我的玩法Mod入口', () => {
  const create = read('src/page/CreateType.tsx');
  assert.doesNotMatch(create, /title="我的玩法 Mod"/);
});

test('PlayModCreateShell_继续编辑只读本人mine列表', () => {
  const shell = read('Romance/src/components/PlayModCreateShell.tsx');
  assert.match(shell, /\/api\/components\/mine/);
  assert.match(shell, /target=\{editTarget/);
  assert.doesNotMatch(shell, /\/api\/admin\//);
  const q = read('Romance/src/lib/playModCreate.ts');
  assert.match(q, /editComponent/);
});

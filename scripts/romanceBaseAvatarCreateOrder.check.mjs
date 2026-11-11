/**
 * ①基础页 IA：三块头像合并为「头像」；建角 → 人物线路 → 地点。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('基础页_头像合并单块_建角在地点之上', () => {
  const panel = read('Romance/src/components/ModEditorPanel.tsx');
  const pools = read('Romance/src/components/ModAvatarPoolsEditor.tsx');
  const wizard = read('Romance/src/lib/worldGenWizard.ts');

  assert.match(panel, /<Section[\s\S]{0,60}g="base"[\s\S]{0,40}title="头像"/);
  assert.match(panel, /<Section[\s\S]{0,60}g="base"[\s\S]{0,40}title="建角"/);
  assert.match(panel, /g="base" title="人物线路"/);
  assert.match(panel, /<Section g="base" title="地点"/);
  assert.doesNotMatch(panel, /title="头像库与匹配优先级"/);
  assert.doesNotMatch(panel, /g="role"[\s\S]{0,80}title="头像"|g="role"[\s\S]{0,80}title="建角"/);

  const timeAt = panel.indexOf('title="时间与推进"');
  const avatarAt = panel.indexOf('title="头像"');
  const createAt = panel.indexOf('title="建角"');
  const pathAt = panel.indexOf('title="人物线路"');
  const locAt = panel.indexOf('title="地点"');
  assert.ok(timeAt >= 0 && avatarAt > timeAt && createAt > avatarAt && pathAt > createAt && locAt > pathAt, '顺序：时间与推进→头像→建角→人物线路→地点');

  // 功能注释：私库/公库/分类同在一块里配，禁止拆成三个 Section 级大标题；创作者不看变量名长说明
  assert.match(pools, /单块/);
  assert.match(pools, /匹配优先级/);
  assert.match(pools, /我的头像池/);
  assert.match(pools, /平台公共分类/);
  assert.doesNotMatch(pools, /私库、公库与分类都在本块配置/);
  assert.doesNotMatch(pools, /池名即 avatarVariant/);
  assert.doesNotMatch(pools, /aria-label="池名（即 avatarVariant）"/);
  assert.doesNotMatch(pools, /text-\[13px\] font-bold text-ink">(?:匹配优先级|我的头像池|平台公共头像分类)</);

  assert.match(wizard, /id:\s*"avatars",\s*group:\s*"① 基础",\s*name:\s*"头像"/);
  assert.match(wizard, /id:\s*"creation",\s*group:\s*"① 基础"/);
  assert.match(panel, /hint: "作品封面、名称与简介、剧本基调、时间与推进、头像、建角、人物线路、地点、音乐、已添加的玩法"/);
});

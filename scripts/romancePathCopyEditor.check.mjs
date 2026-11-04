/**
 * 人物线路不再编辑页面文案，也不再载入娱乐圈默认路径。
 * 建角字段不再提供娱乐圈选项一键载入。已保存的文案字段仍留在数据里，建角页默认句不改。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const paths = readFileSync(join(romance, 'components/ModPathsEditor.tsx'), 'utf8');
const fields = readFileSync(join(romance, 'components/ModCreationFieldsEditor.tsx'), 'utf8');
const create = readFileSync(join(romance, 'components/CharacterCreate.tsx'), 'utf8');

test('人物线路去掉页面文案和娱乐圈默认路径_路径与AI生成仍在', () => {
  assert.doesNotMatch(paths, /页面文案/);
  assert.doesNotMatch(paths, /路径页 · 标题/);
  assert.doesNotMatch(paths, /自设页 · 标题/);
  assert.doesNotMatch(paths, /路径页 · 引导语/);
  assert.doesNotMatch(paths, /自设页 · 引导语/);
  assert.doesNotMatch(paths, /身份字段 · 名称/);
  assert.doesNotMatch(paths, /固定年龄/);
  assert.doesNotMatch(paths, /双亲卡 · 说明/);
  assert.doesNotMatch(paths, /人物描述 · 初始值/);
  assert.doesNotMatch(paths, /选这条路径后的自设页引导语/);
  assert.doesNotMatch(paths, /CREATION_VARS/);
  assert.doesNotMatch(paths, /先点一个文案框/);
  assert.doesNotMatch(paths, /载入娱乐圈默认路径/);
  assert.doesNotMatch(paths, /将沿用依赖模组的默认路径/);
  assert.doesNotMatch(paths, /loadDefault/);
  assert.doesNotMatch(paths, /pathTitle:/);
  assert.match(paths, /还没有路径。用上面的 AI 生成，或在下面添加路径。/);
  assert.match(paths, /AI 生成/);
  assert.match(paths, /＋ 添加路径/);
  assert.match(paths, /commit\(np, ni\)/);
  // 功能注释：开局弹窗/展示块开关已下线，改由路径条数决定
  assert.doesNotMatch(paths, /开局弹窗 · 玩家自选/);
  assert.doesNotMatch(paths, />卡片显示</);
});

test('建角字段去掉娱乐圈载入_系统字段只能改名', () => {
  assert.doesNotMatch(fields, /载入娱乐圈默认选项与联动/);
  assert.doesNotMatch(fields, /loadDefault/);
  assert.doesNotMatch(fields, /RAW_CREATION/);
  assert.match(fields, /显示名称/);
  assert.match(fields, /系统字段/);
  // 功能注释：系统规则长说明不下页面；只留字段名与徽标
  assert.doesNotMatch(fields, /始终必填、不可隐藏或删除/);
  assert.doesNotMatch(fields, /建角要填的项都在这里|系统固定项/);
  assert.doesNotMatch(fields, /锁定（玩家不可改）/);
  assert.doesNotMatch(fields, /在建角页隐藏/);
});

test('建角人设页不展示formIntro与作品简介_路径标题仍可用', () => {
  // 功能注释：人设步只留表单；地点/季节引导与生成提示词禁止出现在 who 页
  assert.doesNotMatch(create, /path\?\.formIntro \|\| cc\.formIntro/);
  assert.doesNotMatch(create, /一页定型——锁住满意的/);
  assert.doesNotMatch(create, /selWorld\?\.description &&/);
  assert.match(create, /fillText\(cc\.pathTitle, tv\) \|\| "选择开局"/);
});

/**
 * Romance 作者预览/发布必填契约：只拦名称/基调/地点/开局地点。
 * 开局日期、开局资金、作品封面、开场不进补全弹窗。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const read = (rel) => readFileSync(join(romance, rel), 'utf8');
const { assessAuthorRequiredFields } = await import(join(romance, 'lib/authorPreview.ts'));

const completeMod = (patch = {}) => {
  const { content, ...manifest } = patch;
  return {
    id: 'required-world',
    name: '雾色旅馆',
    version: '1.0.0',
    kind: 'world',
    ...manifest,
    content: {
      prompt: { scriptTone: '这是一座永远停在雨夜的旅馆。' },
      rooms: { lobby: { name: '大厅', desc: '雨声落在窗外。', exits: {} } },
      startRoom: 'lobby',
      ...(content ?? {}),
    },
  };
};

test('authorRequiredFields_完整作品_无封面无开场无日期资金也允许预览', () => {
  assert.deepEqual(assessAuthorRequiredFields(completeMod({
    content: {
      startDate: undefined,
      startMoney: undefined,
      moneyLabel: '',
      cover: {},
      opening: {},
    },
  })), []);
});

test('authorRequiredFields_空作品_只返回名称基调地点开局地点', () => {
  const issues = assessAuthorRequiredFields({
    id: 'empty-world',
    name: ' ',
    version: '1.0.0',
    kind: 'world',
    content: {},
  });
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ['name', 'scriptTone', 'rooms', 'startRoom'],
  );
  assert.ok(!issues.some((i) => ['startDate', 'startMoney', 'cover', 'opening'].includes(i.field)));
  assert.ok(issues.every((issue) => issue.group && issue.target));
});

test('authorRequiredFields_旧三栏只认世界观正文_悬空开局地点仍阻断', () => {
  const issues = assessAuthorRequiredFields(completeMod({
    content: {
      prompt: {
        gmIntro: '你是一款中文沉浸式养成模拟器的游戏主持',
        narratorPersona: '文风细腻',
      },
      startRoom: 'apartment',
    },
  }));
  assert.ok(issues.some((issue) => issue.field === 'scriptTone'));
  assert.ok(issues.some((issue) => issue.field === 'startRoom'));
});

test('authorRequiredFields_封面开场日期资金均不进补全清单', () => {
  const src = read('lib/authorPreview.ts');
  assert.doesNotMatch(src, /field: "cover"/);
  assert.doesNotMatch(src, /field: "opening"/);
  assert.doesNotMatch(src, /field: "startDate"/);
  assert.doesNotMatch(src, /field: "startMoney"/);
  assert.doesNotMatch(src, /作品封面（列表/);
  assert.doesNotMatch(src, /开场（自定义开场页或开场白）/);
  const issues = assessAuthorRequiredFields(completeMod({
    content: {
      cover: {},
      opening: { title: '序章' },
      startMoney: undefined,
      moneyLabel: '',
    },
  }));
  assert.deepEqual(issues, []);
});

test('authorGate_预览发布共用弹窗且不再显示测试配置警告', () => {
  const editor = read('components/ModEditorPanel.tsx');
  const chrome = read('components/AuthorPreviewChrome.tsx');
  const cover = read('components/Cover.tsx');
  const registry = read('mods/registry.ts');
  const ai = read('lib/ai.ts');
  assert.match(editor, /blockIfRequiredMissing\("预览"\)/);
  // 功能注释：离开编辑器只是保存草稿，平台上架走提交发布审核（B6）
  assert.match(editor, /blockIfRequiredMissing\("保存并离开"\)/);
  assert.doesNotMatch(editor, /blockIfRequiredMissing\("发布"\)/);
  assert.match(editor, /requiredGate\.issues\.map/);
  assert.match(editor, /goRequiredIssue/);
  assert.doesNotMatch(chrome, /测试配置不完整/);
  assert.match(cover, /isAuthorPreview\(\) \? undefined : look\.cover/);
  assert.doesNotMatch(registry, /return "apartment"/);
  assert.doesNotMatch(registry, /Object\.keys\(c\.rooms\)\[0\]/);
  assert.doesNotMatch(ai, /你是一款中文沉浸式养成模拟器的游戏主持/);
});

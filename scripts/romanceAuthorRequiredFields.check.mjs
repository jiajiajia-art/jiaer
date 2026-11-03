/**
 * Romance 作者预览/发布必填契约：同一清单硬拦截，允许 0 元，不允许地点/封面/基调默认兜底。
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
      startDate: '2026.10.30',
      startMoney: 0,
      moneyLabel: '元',
      rooms: { lobby: { name: '大厅', desc: '雨声落在窗外。', exits: {} } },
      startRoom: 'lobby',
      cover: { image: 'data:image/png;base64,cover', title: '雾色旅馆' },
      opening: { paragraphs: ['门铃响了一声。'] },
      ...(content ?? {}),
    },
  };
};

test('authorRequiredFields_完整作品且资金为0_允许预览发布', () => {
  assert.deepEqual(assessAuthorRequiredFields(completeMod()), []);
});

test('authorRequiredFields_空作品_一次返回全部八项并带定位目标', () => {
  const issues = assessAuthorRequiredFields({
    id: 'empty-world',
    name: ' ',
    version: '1.0.0',
    kind: 'world',
    content: {},
  });
  assert.deepEqual(
    issues.map((issue) => issue.field),
    ['name', 'scriptTone', 'startDate', 'startMoney', 'rooms', 'startRoom', 'cover', 'opening'],
  );
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

test('authorRequiredFields_平台默认和账号皮肤不能代替作品封面_标题装饰不能代替开场白', () => {
  const issues = assessAuthorRequiredFields(completeMod({
    content: {
      cover: {},
      opening: { title: '序章', image: 'https://example.com/opening.jpg' },
    },
  }));
  assert.ok(issues.some((issue) => issue.field === 'cover'));
  assert.ok(issues.some((issue) => issue.field === 'opening'));
  const withBg = assessAuthorRequiredFields(completeMod({
    content: {
      cover: { image: 'https://example.com/work-cover.jpg' },
      opening: { paragraphs: ['开场白一段'] },
    },
  }));
  assert.ok(!withBg.some((issue) => issue.field === 'cover'));
  const coverIssue = assessAuthorRequiredFields(completeMod({ content: { cover: {} } })).find((i) => i.field === 'cover');
  assert.equal(coverIssue?.group, 'base');
  assert.match(coverIssue?.label ?? '', /作品封面/);
});

test('authorGate_预览发布共用弹窗且不再显示测试配置警告', () => {
  const editor = read('components/ModEditorPanel.tsx');
  const chrome = read('components/AuthorPreviewChrome.tsx');
  const cover = read('components/Cover.tsx');
  const registry = read('mods/registry.ts');
  const ai = read('lib/ai.ts');
  assert.match(editor, /blockIfRequiredMissing\("预览"\)/);
  assert.match(editor, /blockIfRequiredMissing\("发布"\)/);
  assert.match(editor, /requiredGate\.issues\.map/);
  assert.match(editor, /goRequiredIssue/);
  assert.doesNotMatch(chrome, /测试配置不完整/);
  assert.match(cover, /isAuthorPreview\(\) \? undefined : look\.cover/);
  assert.doesNotMatch(registry, /return "apartment"/);
  assert.doesNotMatch(registry, /Object\.keys\(c\.rooms\)\[0\]/);
  assert.doesNotMatch(ai, /你是一款中文沉浸式养成模拟器的游戏主持/);
});

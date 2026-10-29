/**
 * 场景图布局：竖版比例完整显示、左右贴边；正文在图下；图上无毛玻璃旁白框，只留「外出」。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const home = readFileSync(join(root, 'Romance/src/components/HomeTab.tsx'), 'utf8');

/** 从 HomeTab 抽出 LocationHero 函数体，避免误匹配页内其它圆角卡 */
function locationHeroSrc() {
  const m = home.match(/function LocationHero\([\s\S]*?\n\}\n\n\/\* 人物档案卡/);
  assert.ok(m, '找不到 LocationHero');
  return m[0];
}

test('LocationHero_图按比例完整显示_不用object-cover裁封面', () => {
  const hero = locationHeroSrc();
  assert.match(hero, /object-contain/);
  assert.doesNotMatch(hero, /object-cover/);
  assert.match(hero, /scene-img/);
  assert.match(hero, /外出/);
  // 外层容器不得再包圆角卡裁切场景图
  assert.match(hero, /relative w-full bg-ink\/5/);
  assert.doesNotMatch(hero, /overflow-hidden rounded/);
});

test('LocationHero_无毛玻璃旁白框_无narration入参', () => {
  const hero = locationHeroSrc();
  assert.doesNotMatch(hero, /backdrop-blur/);
  assert.doesNotMatch(hero, /\bnarration\b/);
  assert.doesNotMatch(hero, /\bnovelKey\b/);
});

test('HomeTab_正文在图下_图上不传overlay人物条', () => {
  assert.match(home, /正文在图下方/);
  assert.match(home, /novelProse \|\| descText/);
  assert.doesNotMatch(home, /overlay=\{peopleStrip/);
  assert.match(home, /peopleStrip\(false\)/);
  assert.match(home, /-mx-4 w-\[calc\(100%\+2rem\)\]/);
});

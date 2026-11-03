/**
 * 场景图布局：固定 9:16 竖框 object-cover 铺满；正文在图下累积；图上只留「外出」与可点位置。
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

test('LocationHero_9比16框object-cover铺满_不成横条', () => {
  const hero = locationHeroSrc();
  assert.match(hero, /aspect-\[9\/16\]/);
  assert.match(hero, /object-cover/);
  assert.doesNotMatch(hero, /object-contain/);
  assert.match(hero, /scene-img/);
  assert.match(hero, /外出/);
  assert.match(hero, /overflow-hidden/);
});

test('LocationHero_无毛玻璃旁白框_无narration入参', () => {
  const hero = locationHeroSrc();
  assert.doesNotMatch(hero, /backdrop-blur/);
  assert.doesNotMatch(hero, /\bnarration\b/);
  assert.doesNotMatch(hero, /\bnovelKey\b/);
});

test('HomeTab_正文在图下累积留屏_图上不传overlay人物条', () => {
  assert.match(home, /data-tour="scene-prose"/);
  assert.match(home, /正文在图下累积/);
  assert.doesNotMatch(home, /overlay=\{peopleStrip/);
  assert.match(home, /peopleStrip\(false\)/);
  assert.match(home, /-mx-4 w-\[calc\(100%\+2rem\)\]/);
  assert.doesNotMatch(home, /function GalPlayer/);
});

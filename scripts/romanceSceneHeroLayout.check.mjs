/**
 * 场景图布局：游戏模式矮横幅（约 16:10）object-cover；小说模式 fill 铺满可视区；
 * 正文叠在图上；图上留「外出」与可点位置。
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

test('LocationHero_矮横幅object-cover_正文叠图上', () => {
  const hero = locationHeroSrc();
  assert.match(hero, /aspect-\[16\/10\]/);
  assert.match(hero, /max-h-\[38vh\]/);
  assert.match(hero, /object-cover/);
  assert.doesNotMatch(hero, /object-contain/);
  assert.doesNotMatch(hero, /aspect-\[9\/16\]/);
  assert.match(hero, /scene-img/);
  assert.match(hero, /外出/);
  assert.match(hero, /overflow-hidden/);
  assert.match(hero, /data-tour="scene-prose"/);
  assert.match(hero, /prose/);
  assert.match(hero, /data-scene-layout="banner"/);
});

test('LocationHero_小说fill_竖屏铺满_内容卡用皮肤圆角', () => {
  const hero = locationHeroSrc();
  assert.match(hero, /data-scene-layout="fill"/);
  assert.match(hero, /data-novel-card="1"/);
  assert.match(hero, /novel-read-card/);
  assert.match(hero, /object-cover/);
  assert.doesNotMatch(hero, /object-contain/);
  // 小说内容卡：皮肤变量圆角，不是 mock 粉色矮卡；banner 的 max-w-md 不得进 novelCard 分支
  const cardBlock = hero.match(/if \(fill && novelCard\) \{[\s\S]*?return \([\s\S]*?\);\s*\}/);
  assert.ok(cardBlock, '找不到 novelCard 分支');
  assert.doesNotMatch(cardBlock[0], /max-w-md/);
  assert.doesNotMatch(cardBlock[0], /aspect-\[16\/10\]/);
  assert.match(cardBlock[0], /rounded-\[var\(--radius-ui-lg\)\]/);
  // 功能注释：内容卡底色由 novel-read-card + --story-panel-a 驱动，不再写死 bg-paper
  assert.match(cardBlock[0], /novel-read-card/);
  assert.doesNotMatch(cardBlock[0], /bg-paper/);
  // 功能注释：阅读弹层高度 = 预览/场景区 85%，勿 flex-1 顶满
  assert.match(cardBlock[0], /h-\[85%\]/);
  assert.match(cardBlock[0], /max-h-\[85%\]/);
  assert.match(cardBlock[0], /justify-center/);
  assert.doesNotMatch(cardBlock[0], /novel-read-card[^>]*flex-1/);
  // 功能注释：左右各 20px（px-5）露出场景，禁止贴边的 px-3
  assert.match(cardBlock[0], /justify-center px-5 py-2/);
  assert.doesNotMatch(cardBlock[0], /justify-center px-3 py-2/);
  assert.match(cardBlock[0], /\{mapBtn\}/);
  assert.match(hero, /外出/);
});

test('LocationHero_无narration入参_无novelKey', () => {
  const hero = locationHeroSrc();
  assert.doesNotMatch(hero, /\bnarration\b/);
  assert.doesNotMatch(hero, /\bnovelKey\b/);
});

test('HomeTab_小说模式启用fill与内容卡_游戏模式矮横幅', () => {
  assert.match(home, /playPrefs\.mode === "novel"/);
  assert.match(home, /isAuthorPreview\(\)/);
  assert.match(home, /fill=\{novelFill\}/);
  assert.match(home, /novelCard=\{isNovel\}/);
  assert.match(home, /novelFill \? "absolute inset-0"/);
  assert.match(home, /data-tour="scene-prose"/);
  assert.match(home, /场景铺满 \+ 内容卡|小说模式铺满|矮场景图 \+ 正文叠在图上/);
  assert.doesNotMatch(home, /overlay=\{peopleStrip/);
  assert.match(home, /peopleStrip\(false\)/);
  assert.match(home, /-mx-4 w-\[calc\(100%\+2rem\)\]/);
  assert.doesNotMatch(home, /function GalPlayer/);
  assert.doesNotMatch(home, /正文在图下累积/);
});

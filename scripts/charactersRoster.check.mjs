/**
 * 角色列表对齐效果图：雾化立绘卡、酒红/青灰光晕、标题卡拼合生成胶囊
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('CharactersSidebar_角色卡应为雾化立绘加酒红或青灰光晕', () => {
  const css = read('src/components/GameSettingEditor/CharactersPanel/CharactersSidebar.module.css');
  const tsx = read('src/components/GameSettingEditor/CharactersPanel/CharactersSidebar.tsx');
  assert.match(css, /\.characterRow\s*\{[\s\S]*?grid-template-columns:\s*134px/);
  assert.match(css, /\.characterRow\s*\{[\s\S]*?min-height:\s*112px/);
  assert.match(css, /\.thumbFade\s*\{[\s\S]*?linear-gradient\(90deg/);
  assert.match(css, /\.rowNpc\s*\{[\s\S]*?(?:rgba\(90,\s*120,\s*155|var\(--|color-mix\()/);
  assert.match(css, /\.rowPlayer[\s\S]{0,180}(?:rgba\(142,\s*33,\s*53|var\(--|color-mix\()/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?background:\s*(?:#8E2135|var\(--|color-mix\()/);
  assert.match(tsx, /thumbFade/);
  assert.match(tsx, /rowPlayer/);
  assert.match(tsx, /rowNpc/);
  assert.match(tsx, /addBtn/);
});

test('CharactersPanel_标题卡居中且底部为拼合织梦豆生成胶囊', () => {
  const css = read('src/components/GameSettingEditor/CharactersPanel/CharactersPanel.module.css');
  const tsx = read('src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx');
  const barCss = read('src/components/GameSettingEditor/GenerationActionBar.module.css');
  const barTsx = read('src/components/GameSettingEditor/GenerationActionBar.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?background:\s*(?:#1C1C1E|var\(--|color-mix\()/);
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?border-radius:\s*22px/);
  assert.match(css, /\.panelHeader h2\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(css, /\.panelHeader \.generateButton\s*\{[\s\S]*?background:\s*(?:#A8283C|var\(--|color-mix\()/);
  assert.match(css, /\.generateButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.generateIconWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.match(css, /\.tag\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(tsx, /layout="hero"/);
  assert.match(tsx, /FaMagic/);
  assert.match(tsx, /generateIconWrap/);
  assert.match(tsx, /characterProfileTip',\s*\{\s*cost:/);
  assert.doesNotMatch(tsx, /gameEditor\.step3/);
  assert.doesNotMatch(tsx, /buttonSubText/);
  assert.match(barCss, /\.actionBarHero\s*\{[\s\S]*?background:\s*(?:#2A2A2C|var\(--|color-mix\()/);
  assert.match(barCss, /\.actionBarHero\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(barCss, /\.pointsHero\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(barCss, /\.actionBarHero \.pointsValue[\s\S]*?(?:#A8283C|var\(--|color-mix\()/);
  assert.doesNotMatch(barCss, /\.actionBarHero \.pointsValue[\s\S]*?#8E2135/);
  assert.match(barTsx, /layout === 'hero'/);
  assert.match(zh, /"generateAllCharacterPortraits":\s*"一键生成所有角色立绘"/);
  assert.match(zh, /"characterProfileTip":\s*"[^"]*\{\{cost\}\}织梦豆\/张/);
  assert.doesNotMatch(css, /\.tag\s*\{[\s\S]*?border-radius:\s*5px/);
});

test('CreationCircleNav_胶囊炭黑内高光_当前莓红白标', () => {
  const css = read('src/components/GameSettingEditor/CreationCircleNav.module.css');
  const tsx = read('src/components/GameSettingEditor/CreationCircleNav.tsx');
  assert.match(tsx, /itemDone/);
  assert.match(tsx, /MdAssignmentTurnedIn/);
  assert.match(tsx, /circle_nav_character\.webp/);
  assert.match(tsx, /circle_nav_character_active\.webp/);
  assert.match(tsx, /circle_nav_scene\.webp/);
  assert.match(tsx, /circle_nav_scene_active\.webp/);
  assert.match(tsx, /circle_nav_publish\.webp/);
  assert.match(tsx, /circle_nav_publish_active\.webp/);
  assert.match(tsx, /kind:\s*'asset'/);
  assert.doesNotMatch(tsx, /MdBeachAccess/);
  assert.doesNotMatch(tsx, /MdRecordVoiceOver/);
  assert.doesNotMatch(tsx, /MdSend/);
  assert.match(css, /--circle-nav-idle-bg:\s*(?:#1a1a1a|var\(--|color-mix\()/i);
  assert.match(css, /--circle-nav-accent:\s*(?:#d8315b|var\(--|color-mix\()/i);
  assert.match(css, /\.iconWrap\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.iconWrap\s*\{[\s\S]*?box-shadow:\s*var\(--circle-nav-rim\)/);
  assert.match(css, /\.itemDone \.iconWrap\s*\{[\s\S]*?color:\s*(?:#ffffff|var\(--|color-mix\()/);
  assert.match(css, /\.itemActive \.iconWrap\s*\{[\s\S]*?background:\s*var\(--circle-nav-accent\)/);
  assert.match(css, /\.assetIcon\s*,\s*\.sceneIcon\s*\{|\.assetIcon\s*\{/);
  assert.doesNotMatch(css, /\.itemActive \.iconWrap\s*\{[\s\S]*?box-shadow:\s*0 6px 18px/);
  assert.doesNotMatch(css, /\.iconWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.doesNotMatch(css, /\.iconWrap\s*\{[\s\S]*?color:\s*#9A9A9E/);
});

test('CreationCircleNav_角色场景发布步进切图文件存在', () => {
  const files = [
    'public/data/assetsv2/create/circle_nav_scene.webp',
    'public/data/assetsv2/create/circle_nav_scene_active.webp',
    'public/data/assetsv2/create/circle_nav_character.webp',
    'public/data/assetsv2/create/circle_nav_character_active.webp',
    'public/data/assetsv2/create/circle_nav_publish.webp',
    'public/data/assetsv2/create/circle_nav_publish_active.webp',
  ];
  for (const rel of files) {
    assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
  }
});

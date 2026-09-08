/**
 * 角色列表对齐效果图：雾化立绘卡、酒红/青灰光晕、标题卡拼合生成胶囊
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.match(css, /\.rowNpc\s*\{[\s\S]*?rgba\(90,\s*120,\s*155/);
  assert.match(css, /\.rowPlayer[\s\S]{0,180}rgba\(142,\s*33,\s*53/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.deleteButton\s*\{[\s\S]*?background:\s*#8E2135/);
  assert.match(tsx, /thumbFade/);
  assert.match(tsx, /rowPlayer/);
  assert.match(tsx, /rowNpc/);
  assert.match(tsx, /addBtn/);
});

test('CharactersPanel_标题卡居中且底部为拼合积分生成胶囊', () => {
  const css = read('src/components/GameSettingEditor/CharactersPanel/CharactersPanel.module.css');
  const tsx = read('src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx');
  const barCss = read('src/components/GameSettingEditor/GenerationActionBar.module.css');
  const barTsx = read('src/components/GameSettingEditor/GenerationActionBar.tsx');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?background:\s*#1C1C1E/);
  assert.match(css, /\.panelHeader\s*\{[\s\S]*?border-radius:\s*22px/);
  assert.match(css, /\.panelHeader h2\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(css, /\.panelHeader \.generateButton\s*\{[\s\S]*?background:\s*#A8283C/);
  assert.match(css, /\.generateButton\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(css, /\.generateIconWrap\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.match(css, /\.tag\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(tsx, /layout="hero"/);
  assert.match(tsx, /FaMagic/);
  assert.match(tsx, /generateIconWrap/);
  assert.match(tsx, /characterProfileTip',\s*\{\s*cost:/);
  assert.doesNotMatch(tsx, /gameEditor\.step3/);
  assert.doesNotMatch(tsx, /buttonSubText/);
  assert.match(barCss, /\.actionBarHero\s*\{[\s\S]*?background:\s*#2A2A2C/);
  assert.match(barCss, /\.actionBarHero\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(barCss, /\.pointsHero\s*\{[\s\S]*?flex-direction:\s*row/);
  assert.match(barCss, /\.actionBarHero \.pointsValue[\s\S]*?#A8283C/);
  assert.doesNotMatch(barCss, /\.actionBarHero \.pointsValue[\s\S]*?#8E2135/);
  assert.match(barTsx, /layout === 'hero'/);
  assert.match(zh, /"generateAllCharacterPortraits":\s*"一键生成所有角色立绘"/);
  assert.match(zh, /"characterProfileTip":\s*"[^"]*\{\{cost\}\}积分\/张/);
  assert.doesNotMatch(css, /\.tag\s*\{[\s\S]*?border-radius:\s*5px/);
});

test('CreationCircleNav_已完成酒红_当前亮红_未到灰底红标', () => {
  const css = read('src/components/GameSettingEditor/CreationCircleNav.module.css');
  const tsx = read('src/components/GameSettingEditor/CreationCircleNav.tsx');
  assert.match(tsx, /itemDone/);
  assert.match(tsx, /MdAssignmentTurnedIn/);
  assert.match(tsx, /MdRecordVoiceOver/);
  assert.match(tsx, /MdBeachAccess/);
  assert.match(tsx, /MdSend/);
  assert.match(css, /\.iconWrap\s*\{[\s\S]*?background:\s*#1C1C1E/);
  assert.match(css, /\.iconWrap\s*\{[\s\S]*?color:\s*#A8283C/);
  assert.match(css, /\.itemDone \.iconWrap\s*\{[\s\S]*?background:\s*#8E2135/);
  assert.match(css, /\.itemDone \.iconWrap\s*\{[\s\S]*?color:\s*#ffffff/);
  assert.match(css, /\.itemActive \.iconWrap\s*\{[\s\S]*?background:\s*#A8283C/);
  assert.doesNotMatch(css, /\.iconWrap\s*\{[\s\S]*?color:\s*#9A9A9E/);
  assert.doesNotMatch(css, /\.iconWrap\s*\{[\s\S]*?color:\s*#C23A50/);
});

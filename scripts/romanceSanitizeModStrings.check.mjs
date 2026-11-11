/**
 * 会话脏 mod 进编辑器前必须可安全渲染（禁止 .trim is not a function）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const romance = join(dirname(fileURLToPath(import.meta.url)), '../Romance/src');

test('sanitizeModStrings_对象型label_terms_prompt_须收成字符串', async () => {
  const mod = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const dirty = {
    id: 'w1',
    name: { zh: '雾港' },
    version: '1.0.0',
    kind: 'world',
    content: {
      terms: { city: { n: '雾港' }, tabHome: ' 首页 ' },
      prompt: { gmIntro: { text: 'hi' }, worldIntro: ' 世界 ' },
      navTabs: [{ id: 'home', label: { t: '日程' }, on: true }],
      npcs: [{ id: 'a', name: 9, gender: { g: '女' } }],
      rooms: { inn: { name: { n: '客栈' }, desc: 12 } },
      bgm: [{ id: 'b1', name: { t: '雨声' }, src: 'https://x' }],
      startMet: { 0: 'a' },
      travel: { modes: [{ id: 'walk', label: { zh: '步行' }, cost: 0 }] },
      stats: { labels: { meili: { n: '魅力' }, caiyi: ' 才艺 ' } },
      opening: { paragraphs: ['a', { t: 'b' }, 3] },
    },
  };
  const clean = mod.sanitizeModStrings(dirty);
  assert.equal(clean.name, '雾港');
  assert.deepEqual(clean.content.terms, { city: '雾港', tabHome: '首页' });
  assert.equal(clean.content.prompt.worldIntro, '世界');
  assert.equal(clean.content.prompt.gmIntro, 'hi');
  assert.equal(clean.content.navTabs[0].label, '日程');
  assert.equal(clean.content.npcs[0].name, '9');
  assert.equal(clean.content.npcs[0].gender, '女');
  assert.equal(clean.content.rooms.inn.name, '客栈');
  assert.equal(clean.content.rooms.inn.desc, '12');
  assert.equal(clean.content.bgm[0].name, '雨声');
  assert.deepEqual(clean.content.startMet, ['a']);
  assert.equal(clean.content.travel.modes[0].label, '步行');
  assert.deepEqual(clean.content.stats.labels, { meili: '魅力', caiyi: '才艺' });
  assert.deepEqual(clean.content.opening.paragraphs, ['a', 'b', '3']);
});

test('worldGenSession_parse时须sanitize_mod', () => {
  const sessionSrc = readFileSync(join(romance, 'lib/worldGenSession.ts'), 'utf8');
  assert.match(sessionSrc, /sanitizeModStrings/);
  assert.match(sessionSrc, /parseWorldGenSession/);
  assert.match(sessionSrc, /demoteWorldGenSessionToStep1/);
  assert.match(sessionSrc, /WORLD_GEN_PERSIST_BLOCK_KEY|isWorldGenPersistBlocked/);
  assert.match(sessionSrc, /isWorldGenTrimRecovering/);
});

test('WorldGenWizard与ModEditorPanel_须在加载会话时sanitize', () => {
  const wiz = readFileSync(join(romance, 'components/WorldGenWizard.tsx'), 'utf8');
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.match(wiz, /sanitizeModStrings/);
  assert.match(panel, /sanitizeModStrings\(structuredClone\(initial\)\)|sanitizeModStrings\(initial\)/);
  assert.doesNotMatch(readFileSync(join(romance, 'components/NavTabsModEditor.tsx'), 'utf8'), /row\.label\.trim\(\)/);
});

test('sanitizeModStrings_星座月日数组须保留且时段from仍是字符串', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      zodiacs: [{ id: 'aries', name: '白羊座', from: [3, 21], to: [4, 19], bonus: '冲' }],
      fixedEvents: [{ id: 'e1', name: '夜', trigger: { kind: 'clock', from: '22:00', to: '06:00' } }],
    },
  });
  assert.deepEqual(clean.content.zodiacs[0].from, [3, 21]);
  assert.deepEqual(clean.content.zodiacs[0].to, [4, 19]);
  assert.equal(clean.content.fixedEvents[0].trigger.from, '22:00');
  assert.equal(clean.content.fixedEvents[0].trigger.to, '06:00');
  const pools = readFileSync(join(romance, 'components/ModPoolsEditor.tsx'), 'utf8');
  assert.match(pools, /Array\.isArray\(z\.from\)/);
  assert.doesNotMatch(pools, /z\.from\.join/);
});

test('sanitizeModStrings_人物时间线非数组须收成条目数组', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      npcs: [
        { id: 'a', name: '甲', timeline: '大学时断了联系' },
        { id: 'b', name: '乙', timeline: { when: '2003年', text: '室友' } },
        { id: 'c', name: '丙', timeline: { entries: [{ id: 't1', when: { zh: '童年' }, text: '搬家' }] } },
      ],
    },
  });
  assert.deepEqual(clean.content.npcs[0].timeline, [{ id: 'tl_0', when: '', text: '大学时断了联系' }]);
  assert.equal(clean.content.npcs[1].timeline[0].when, '2003年');
  assert.equal(clean.content.npcs[1].timeline[0].text, '室友');
  assert.equal(Array.isArray(clean.content.npcs[1].timeline), true);
  assert.equal(clean.content.npcs[2].timeline[0].when, '童年');
  assert.equal(clean.content.npcs[2].timeline[0].text, '搬家');
  const editor = readFileSync(join(romance, 'components/TimelineEditor.tsx'), 'utf8');
  assert.match(editor, /function timelineRows/);
  assert.doesNotMatch(editor, /const list = value \?\? \[\]/);
  assert.doesNotMatch(editor, /e\.when\.trim\(\)/);
});

test('sanitizeModStrings_母校与父母职业对象须显示成名称', async () => {
  const { sanitizeModStrings } = await import(pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href);
  const clean = sanitizeModStrings({
    id: 'w1',
    name: '雾港',
    version: '1.0.0',
    kind: 'world',
    content: {
      school: [{ name: '雾港一中' }, { name: '南岸中学' }, { label: '港务学校' }],
      parentJobs: [{ name: '中学语文教师', desc: '家教严' }, { label: '港务调度' }, '渔船船长'],
      creation: { identityOpts: [{ name: '素人' }, { text: '科班' }] },
    },
  });
  assert.equal(clean.content.school, '雾港一中、南岸中学、港务学校');
  assert.deepEqual(clean.content.parentJobs, ['中学语文教师', '港务调度', '渔船船长']);
  assert.deepEqual(clean.content.creation.identityOpts, ['素人', '科班']);
  // 功能注释：母校 / 父母职业仅作旧稿 sanitize，编辑器不再提供对应输入控件
  const pools = readFileSync(join(romance, 'components/ModPoolsEditor.tsx'), 'utf8');
  assert.doesNotMatch(pools, /母校/);
  assert.doesNotMatch(pools, /父母职业池/);
  assert.doesNotMatch(pools, /parentJobs/);
});

test('healModRoomRefs_悬空引用须清除且不得猜测开局地点', async () => {
  const { healModRoomRefs, sanitizeModStrings } = await import(
    pathToFileURL(join(romance, 'lib/sanitizeModStrings.ts')).href
  );
  const content = {
    rooms: {
      living_room: { name: '客厅', desc: '宽敞', exits: {} },
      kitchen: { name: '厨房', desc: '灶台', exits: {} },
    },
    startRoom: 'kid_bedroom',
    npcs: [{ id: 'mom', name: '妈妈', home: 'kid_bedroom' }],
  };
  const fixes = healModRoomRefs(content);
  assert.equal(content.startRoom, undefined);
  assert.equal(content.npcs[0].home, undefined);
  assert.ok(fixes.some((f) => /kid_bedroom/.test(f)));

  const sanitized = sanitizeModStrings({
    id: 'w1',
    name: '家',
    version: '1.0.0',
    kind: 'world',
    content: {
      rooms: { start: { name: '起点', desc: '', exits: {} } },
      startRoom: 'nowhere',
    },
  });
  assert.equal(sanitized.content.startRoom, undefined);

  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /healModRoomRefs/);
  const gen = readFileSync(join(romance, 'lib/worldGenGenerate.ts'), 'utf8');
  assert.match(gen, /healModRoomRefs/);
});

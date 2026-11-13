/**
 * 周结算：周记末尾为每个相关人物输出一句 TA 视角的周记忆，解析后写进人物记忆；日记正文不含这段。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const body = '这一周过得很慢。'.repeat(40);
const raw = `雨夜小记\n\n${body}\n\n【人物周记】\n沈晚晴：他总算肯陪我去山脊看雾了，我想记住这一天。\n- 林晚舟（老板）：账本又亏了，可那个客人说下周还来。\n路人甲：不该出现\n沈晚晴：重复的不要`;

test('parseWeekDiary_正文不含人物周记', async () => {
  const mod = await import(join(root, 'Romance/src/lib/weekReview.ts'));
  const d = mod.parseWeekDiary(raw);
  assert.equal(d.title, '雨夜小记');
  assert.doesNotMatch(d.text, /人物周记|沈晚晴/);
  assert.doesNotMatch(mod.splitWeekDiary(raw).body, /人物周记/);
});

test('parseNpcWeekMemories_按名单每人一句', async () => {
  const mod = await import(join(root, 'Romance/src/lib/weekReview.ts'));
  const mems = mod.parseNpcWeekMemories(raw, ['沈晚晴', '林晚舟']);
  assert.deepEqual(mems.map((m) => m.name), ['沈晚晴', '林晚舟']);
  assert.match(mems[0].text, /山脊看雾/);
});

test('buildWeekDiaryMessages_同一次请求输出两块_人物周记以人物自己为中心', async () => {
  const mod = await import(join(root, 'Romance/src/lib/weekReview.ts'));
  const msgs = mod.buildWeekDiaryMessages({
    worldName: 'w', playerName: '我', report: { week: 3, events: [], warnings: [], settle: [], gains: [] }, changes: [], money: String,
    npcs: [
      { name: '沈晚晴', identity: '旅伴', mood: '平静', self: ['去镇上买了药'], withPlayer: ['一起看雾'] },
      { name: '林晚舟', self: [], withPlayer: [] },
    ],
  });
  const sys = msgs[0].content;
  assert.match(sys, /约 800 字/);
  assert.match(sys, /主角周记写完后，在同一份输出里/);
  assert.match(sys, /【人物周记】/);
  assert.match(sys, /写 TA 自己这一周/);
  assert.match(sys, /不要以主角为中心/);
  assert.match(sys, /不超过 40 字/);
  assert.match(sys, /不要写成想念或惦记主角/);
  assert.match(sys, /不要互相转述/);
  assert.doesNotMatch(sys, /惦念/);
  assert.match(msgs[1].content, /沈晚晴（旅伴）｜近况心情：平静｜自己的事：去镇上买了药｜与主角：一起看雾/);
  assert.match(msgs[1].content, /林晚舟｜自己的事：无记录｜与主角：本周无往来/);
  const ctx = readFileSync(join(root, 'Romance/src/store/GameContext.tsx'), 'utf8');
  assert.match(ctx, /parseNpcWeekMemories\(full/);
  assert.match(ctx, /remember\(next, npc\.id, "self"/);
});

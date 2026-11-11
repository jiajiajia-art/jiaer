import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rankingsPage = readFileSync(join(root, 'src/page/Rankings.tsx'), 'utf8');
const rankingsApi = readFileSync(join(root, 'src/api/rankings/getRankings.ts'), 'utf8');
const rankingsType = readFileSync(join(root, 'src/api/rankings/getRankings.type.ts'), 'utf8');
const statsApi = readFileSync(join(root, 'src/api/stats/creatorStatsApi.ts'), 'utf8');
const statsOverview = readFileSync(join(root, 'src/components/stats/StatsOverviewSection.tsx'), 'utf8');
const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');

test('排行榜在互动榜右侧配置作者榜 Tab', () => {
  assert.match(rankingsPage, /labelZh:\s*'互动榜'/);
  assert.match(rankingsPage, /labelZh:\s*'作者榜'/);
  const romanceIdx = rankingsPage.indexOf("labelZh: '互动榜'");
  const authorsIdx = rankingsPage.indexOf("labelZh: '作者榜'");
  assert.ok(romanceIdx >= 0 && authorsIdx > romanceIdx, '作者榜应出现在互动榜之后');
  assert.match(rankingsPage, /key:\s*'authors'/);
  assert.match(rankingsPage, /getAuthorRankings/);
  assert.match(rankingsPage, /游玩轮次/);
});

test('作者榜 API 使用 type=authors 且类型含 play_rounds', () => {
  assert.match(rankingsApi, /type:\s*'authors'/);
  assert.match(rankingsApi, /getAuthorRankings/);
  assert.match(rankingsType, /authors/);
  assert.match(rankingsType, /play_rounds/);
  assert.match(rankingsType, /RankingsAuthorItem/);
});

test('创作者中心展示游玩轮次字段且与作者榜同口径文案', () => {
  assert.match(statsApi, /playRounds/);
  assert.match(statsOverview, /creatorStats\.playRounds/);
  assert.match(zh, /"playRounds":\s*"游玩轮次"/);
  assert.doesNotMatch(rankingsPage, /total_pv_count.*authors|authors.*interaction_score/);
});

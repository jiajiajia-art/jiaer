/**
 * 活跃时间段标题 tip：文案与组件接入校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('creatorStats.activeHoursTip exists in zh/en with plain-language wording', () => {
  const zh = JSON.parse(readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8'));
  const en = JSON.parse(readFileSync(join(root, 'src/i18n/locales/en.json'), 'utf8'));

  const zhTip = zh.creatorStats.activeHoursTip;
  const enTip = en.creatorStats.activeHoursTip;

  assert.equal(typeof zhTip, 'string');
  assert.equal(typeof enTip, 'string');
  assert.match(zhTip, /25\s*秒/);
  assert.match(zhTip, /不等于游玩人数/);
  assert.match(zhTip, /北京时间/);
  assert.match(enTip, /25\s*seconds/i);
  assert.match(enTip, /not unique players/i);
  assert.match(enTip, /Beijing/i);
});

test('CreatorWorkDetailSections wires MetricTitleTip for active hours', () => {
  const source = readFileSync(
    join(root, 'src/components/stats/CreatorWorkDetailSections.tsx'),
    'utf8',
  );
  assert.match(source, /MetricTitleTip/);
  assert.match(source, /creatorStats\.activeHoursTip/);
  assert.match(source, /creatorStats\.activeHours/);
});

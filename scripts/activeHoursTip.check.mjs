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

test('MetricTitleTip_说明应为通栏展开避免窄屏裁切', () => {
  const tsx = readFileSync(join(root, 'src/components/stats/MetricTitleTip.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/components/stats/MetricTitleTip.module.css'), 'utf8');
  assert.match(tsx, /aria-expanded/);
  assert.match(tsx, /setOpen/);
  assert.match(css, /\.tipBubble\s*\{[\s\S]*?flex:\s*1 1 100%/);
  assert.match(css, /\.tipBubble\s*\{[\s\S]*?width:\s*100%/);
  assert.match(css, /\.tipBubble\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(css, /\.tipBubble\s*\{[\s\S]*?transform:\s*translate\(-50%/);
  assert.doesNotMatch(css, /\.tipBubble\s*\{[\s\S]*?left:\s*50%/);
});

test('CreatorWorkDetailSections_活跃时段应对齐 funloom 暗色热力格', () => {
  const css = readFileSync(
    join(root, 'src/components/stats/CreatorWorkDetailSections.module.css'),
    'utf8',
  );
  /* 功能注释：禁止 #f5f5f5/#f7f7f7 白底灰字；墨黑卡 + 酒红高峰 */
  assert.match(css, /--stat-surface:\s*#1C1C1E/);
  assert.match(css, /--stat-accent:\s*#A8283C/);
  assert.match(css, /\.hourCell\s*\{[\s\S]*?background:\s*var\(--stat-surface\)/);
  assert.match(css, /\.hourCellTop\s*\{[\s\S]*?rgba\(168,\s*40,\s*60/);
  assert.match(css, /\.emptyState\s*\{[\s\S]*?background:\s*var\(--stat-surface-soft\)/);
  assert.doesNotMatch(css, /#f5f5f5|#f7f7f7|#fb4655/);
  assert.doesNotMatch(css, /\.sectionTitle\s*\{[^}]*color:\s*#222/);
});

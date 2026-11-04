/**
 * 人物档案：上下两块 + 皮肤变量；资料能力只读作品配置；情感三列 + 三张经营卡。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const data = read('Romance/src/game/data.ts');
const fields = read('Romance/src/components/personFields.tsx');
const profile = read('Romance/src/components/PersonProfile.tsx');
const npcTab = read('Romance/src/components/NpcTab.tsx');

test('dossierStatKeys_配了order就不补未声明八维', () => {
  assert.match(data, /export const dossierStatKeys/);
  assert.match(data, /if \(ordered\.length\) return ordered/);
  assert.doesNotMatch(
    data.slice(data.indexOf('dossierStatKeys'), data.indexOf('dossierStatKeys') + 600),
    /RAW_STAT_ORDER\.filter\(\(k\) => !o\.includes/,
  );
});

test('StatBars_读dossierStatKeys_不写死容貌演技歌艺套', () => {
  assert.match(fields, /dossierStatKeys\(\)/);
  assert.match(fields, /个人能力两列卡/);
  const bars = fields.slice(fields.indexOf('export function StatBars'), fields.indexOf('export function BondMeterRow'));
  assert.doesNotMatch(bars, /\["容貌"/);
  assert.doesNotMatch(bars, /npcLooksFromStats/);
  assert.doesNotMatch(bars, /STAT_ORDER/);
  assert.match(bars, /grid-cols-2/);
  assert.match(bars, /bg-coral/);
});

test('情感关系_三列现任伴侣父母子女', () => {
  assert.match(fields, /现任伴侣/);
  assert.match(fields, /grid-cols-3/);
  assert.match(fields, /暂无记录/);
  assert.match(fields, /未知/);
  const rel = fields.slice(fields.indexOf('export function ProfileRelations'), fields.indexOf('export function relationRefsOf'));
  assert.doesNotMatch(rel, /grid-cols-2/);
});

test('页签选中色与圆角读皮肤变量', () => {
  assert.match(fields, /bg-coral text-paper/);
  assert.match(fields, /rounded-\[var\(--radius-ui\)\]/);
  assert.match(fields, /rounded-\[var\(--radius-ui-sm\)\]/);
});

test('PersonProfile_上下两块_资料情感_三经营卡', () => {
  assert.match(profile, /label: "资料"/);
  assert.match(profile, /label: "情感"/);
  assert.match(profile, /title="个人能力"/);
  assert.match(profile, /可攻略/);
  assert.match(profile, /BondMeterRow/);
  assert.match(profile, /私下联系/);
  assert.match(profile, /title="履历"/);
  assert.match(profile, /title="表白"/);
  assert.match(profile, /var\(--radius-ui-lg\)|rounded-\[var\(--radius-ui-lg\)\]/);
  assert.match(profile, /border-line/);
  assert.match(profile, /bg-paper/);
});

test('NpcTab_人物档案同布局_不硬编码粉金渐变卡', () => {
  assert.match(npcTab, /label: "资料"/);
  assert.match(npcTab, /label: "情感"/);
  assert.match(npcTab, /title="个人能力"/);
  assert.match(npcTab, /BondMeterRow/);
  assert.match(npcTab, /compact/);
  assert.match(npcTab, /title="履历"/);
  assert.match(npcTab, /title="表白"/);
  assert.match(npcTab, /约 TA 单独见面聊聊/);
  assert.doesNotMatch(npcTab, /资料 · 能力/);
  assert.doesNotMatch(npcTab, /情感 · 互动/);
  assert.doesNotMatch(npcTab, /#ff5f96/);
});

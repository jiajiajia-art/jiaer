/**
 * 消息中心列表展示辅助回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatMessageListTime,
  resolveMessageListSection,
  truncateMessagePreview,
} from '../src/lib/messageCenterView.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('formatMessageListTime_今天昨天与月日', () => {
  const now = new Date('2026-09-04T15:00:00+08:00');
  assert.match(formatMessageListTime('2026-09-04T10:42:00+08:00', now), /上午10:42|上午10:42/);
  assert.equal(formatMessageListTime('2026-09-03T10:42:00+08:00', now), '昨天');
  assert.equal(formatMessageListTime('2026-08-12T10:42:00+08:00', now), '8月12日');
});

test('truncateMessagePreview_应截断过长预览', () => {
  assert.equal(truncateMessagePreview('短'), '短');
  assert.ok(truncateMessagePreview('字'.repeat(40)).endsWith('…'));
});

test('resolveMessageListSection_应按类型归入三区', () => {
  assert.equal(resolveMessageListSection('announcement'), 'system');
  assert.equal(resolveMessageListSection('promotion'), 'activity');
  assert.equal(resolveMessageListSection('promotion_submission_status'), 'activity');
  assert.equal(resolveMessageListSection('favorite_game_updated'), 'interaction');
});

test('Messages_应对齐效果图会话列表结构', () => {
  const tsx = read('src/page/Messages.tsx');
  const css = read('src/page/Messages.module.css');
  const zh = read('src/i18n/locales/zh.json');
  assert.match(tsx, /messages\.listTitle/);
  assert.match(tsx, /messages\.backToHome/);
  assert.match(tsx, /styles\.backButton/);
  assert.match(tsx, /M15 6L9 12L15 18/);
  assert.match(tsx, /messages\.sectionSystem/);
  assert.match(css, /\.backButton\s*\{[^}]*left:\s*0/);
  assert.match(zh, /"backToHome":\s*"返回首页"/);
  assert.match(tsx, /messages\.sectionActivity/);
  assert.match(tsx, /messages\.sectionInteraction/);
  assert.match(tsx, /styles\.sectionCard/);
  assert.match(tsx, /styles\.messageRow/);
  assert.match(tsx, /styles\.avatarFrame/);
  assert.match(tsx, /formatMessageListTime/);
  assert.doesNotMatch(tsx, /viewNotifications|refreshList/);
  assert.doesNotMatch(tsx, /promotionCover/);
  assert.match(css, /\.sectionCard\s*\{[^}]*background:\s*#1C1C1E|var\(--messages-card\)/);
  assert.match(css, /\.avatarFrame\s*\{[\s\S]*?border:\s*1\.5px dashed/);
  assert.match(zh, /"listTitle":\s*"消息"/);
  assert.match(zh, /"markAllRead":\s*"全部已读"/);
  assert.match(zh, /"sectionSystem":\s*"系统消息"/);
});

test('Messages_移动端隐藏全局顶部栏与底部导航并释放占位', () => {
  const tsx = read('src/page/Messages.tsx');
  const css = read('src/page/Messages.module.css');

  assert.match(tsx, /className=\{styles\.desktopChrome\}><Navbar\s*\/>/);
  assert.match(tsx, /className=\{styles\.desktopChrome\}><MobileBottomNav\s*\/>/);
  assert.match(css, /\.desktopChrome\s*\{[\s\S]*?display:\s*contents/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.desktopChrome\s*\{[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.pageBody\s*\{[\s\S]*?padding-top:\s*calc\([^;]*safe-area-inset-top[^;]*\)[\s\S]*?padding-bottom:\s*calc\([^;]*safe-area-inset-bottom[^;]*\)/);
});

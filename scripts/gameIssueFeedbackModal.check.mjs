/**
 * 作品故障反馈弹窗：效果图结构（描述 + 联系方式，无类型/截图）接线回归。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('GameIssueFeedbackModal_应按效果图仅描述与联系方式', () => {
  const tsx = read('src/components/GameDetail/GameDetailExtraModals.tsx');
  const css = read('src/components/GameDetail/GameDetailModals.module.css');
  const zh = read('src/i18n/locales/zh.json');
  const api = read('src/api/gameDetailExtrasApi.ts');
  assert.match(tsx, /export const GameIssueFeedbackModal/);
  assert.match(tsx, /issueContentPlaceholder/);
  assert.match(tsx, /issueContactLabel/);
  assert.match(tsx, /issueContactPlaceholder/);
  assert.match(tsx, /issueType:\s*'other'/);
  assert.match(tsx, /contact:\s*contact\.trim\(\)/);
  assert.match(tsx, /styles\.issueIcon/);
  assert.match(tsx, /styles\.issueSubmitBtn/);
  assert.doesNotMatch(tsx, /issueTypeLabel|ISSUE_TYPES|uploadIssueScreenshot|setShots|issueScreenshotsLabel/);
  assert.match(css, /\.issuePanel[\s\S]*background:\s*(?:#1c1c1e|var\(--|color-mix\()/);
  assert.match(css, /\.issueIcon[\s\S]*background:\s*(?:#E91E63|var\(--|color-mix\()/);
  assert.match(css, /\.issueSubmitBtn[\s\S]*width:\s*100%/);
  assert.match(css, /\.issueSubmitBtn[\s\S]*background:\s*(?:#E91E63|var\(--|color-mix\()/);
  assert.match(zh, /"issueModalTitle":\s*"故障反馈"/);
  assert.match(zh, /"issueContentLabel":\s*"问题描述"/);
  assert.match(zh, /"issueContactLabel":\s*"联系方式（可选）"/);
  assert.match(api, /contact\?:/);
  assert.match(api, /issueType\?:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** 功能注释：新页脚使用的 i18n 键（旧分享区字段仍保留在 locales 供兼容） */
const FOOTER_KEYS = [
  'tagline',
  'copyright',
  'privacyPolicy',
  'userAgreement',
  'douyin',
  'xiaohongshu',
  'followUs',
  'joinUs',
  'socialRecruit',
  'campusRecruit',
  'contactUs',
  'businessCoop',
  'feedbackEntry',
];

test('FooterArea_应使用footer i18n键且无硬编码中文标题', () => {
  const tsx = fs.readFileSync(
    path.join(root, 'src/components/Layout/FooterArea.tsx'),
    'utf8',
  );
  assert.match(tsx, /useTranslation/);
  for (const key of FOOTER_KEYS) {
    assert.match(tsx, new RegExp(`t\\('footer\\.${key}'\\)`));
  }
  // 功能注释：禁止 JSX/字符串硬编码中文标题；注释里的中文说明允许
  assert.doesNotMatch(tsx, /['"`]让每一个世界都可以被游玩['"`]/);
  assert.doesNotMatch(tsx, />\s*关注我们\s*</);
  assert.doesNotMatch(tsx, />\s*意见反馈\s*</);
  assert.match(tsx, /FeedbackModal|BusinessCoopModal/);
  assert.match(tsx, /douyin\.com/);
  assert.match(tsx, /xhslink\.cn|xiaohongshu/);
  assert.match(tsx, /zhipin\.com/);
});

test('i18n_footer中英键齐全且英文非中文', () => {
  const zh = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/zh.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
  assert.ok(zh.footer);
  assert.ok(en.footer);
  for (const key of FOOTER_KEYS) {
    assert.equal(typeof zh.footer[key], 'string');
    assert.equal(typeof en.footer[key], 'string');
    assert.ok(zh.footer[key].length > 0);
    assert.ok(en.footer[key].length > 0);
  }
  assert.equal(zh.footer.feedbackEntry, '意见反馈');
  assert.equal(zh.footer.businessCoop, '业务合作');
  assert.doesNotMatch(en.footer.tagline, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.followUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.joinUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.contactUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.feedbackEntry, /[\u4e00-\u9fff]/);
  assert.ok(zh.customerService?.feedback?.types?.bug);
  assert.ok(en.customerService?.business?.types?.brand);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FOOTER_KEYS = [
  'shareTo',
  'wechat',
  'weibo',
  'qq',
  'douyin',
  'xiaohongshu',
  'followUs',
  'joinUs',
  'socialRecruit',
  'campusRecruit',
  'intlRecruit',
  'contactUs',
  'customerService',
  'businessCoop',
  'procurement',
  'feedback',
  'optimization',
  'improvement',
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
  assert.doesNotMatch(tsx, /分享到：|关注我们|加入我们|联系我们|发表建议|社会招聘|优化建议/);
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
  assert.equal(zh.footer.shareTo, '分享到：');
  assert.equal(en.footer.shareTo, 'Share to:');
  assert.equal(zh.footer.feedback, '发表建议');
  assert.equal(en.footer.feedback, 'Feedback');
  assert.doesNotMatch(en.footer.shareTo, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.followUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.joinUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.contactUs, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(en.footer.feedback, /[\u4e00-\u9fff]/);
});

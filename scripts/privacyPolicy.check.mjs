/**
 * 外置隐私政策 URL / 注册勾选校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRIVACY_POLICY_PATH,
  isPrivacyAgreementAccepted,
  resolvePrivacyPolicyUrl,
} from '../src/lib/privacyPolicy.ts';

const privacyHtmlPath = join(import.meta.dirname, '../public/privacyPolicy/index.html');
const authModalPath = join(import.meta.dirname, '../src/components/AuthModal.tsx');

test('privacyPolicy_静态页存在且含标题', () => {
  assert.equal(existsSync(privacyHtmlPath), true);
  const html = readFileSync(privacyHtmlPath, 'utf8');
  assert.match(html, /FunLoom Privacy Policy/);
  assert.match(html, /company@funloom\.ai/);
  assert.doesNotMatch(html, /展开/);
});

test('resolvePrivacyPolicyUrl_拼接base与dark参数', () => {
  assert.equal(PRIVACY_POLICY_PATH, 'privacyPolicy/index.html');
  assert.equal(
    resolvePrivacyPolicyUrl({ origin: 'https://example.com', base: '/funloom/' }),
    'https://example.com/funloom/privacyPolicy/index.html',
  );
  assert.equal(
    resolvePrivacyPolicyUrl({
      origin: 'https://example.com',
      base: '/funloom/',
      darkMode: true,
    }),
    'https://example.com/funloom/privacyPolicy/index.html?darkmode=1&darkStyle=1',
  );
});

test('isPrivacyAgreementAccepted_仅true可通过', () => {
  assert.equal(isPrivacyAgreementAccepted(true), true);
  assert.equal(isPrivacyAgreementAccepted(false), false);
  assert.equal(isPrivacyAgreementAccepted(undefined), false);
  assert.equal(isPrivacyAgreementAccepted(null), false);
});

test('AuthModal_注册与Google登录须校验隐私勾选', () => {
  const src = readFileSync(authModalPath, 'utf8');
  assert.match(src, /isPrivacyAgreementAccepted\(privacyAgreed\)/);
  assert.match(src, /resolvePrivacyPolicyUrl\(\{\s*darkMode:\s*true\s*\}\)/);
  assert.match(src, /mode === 'register'/);
  assert.match(src, /privacyPolicyUrl/);
});

test('Create_作品Tab栏应使用与其他模块一致的圆角', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/page/Create.module.css'), 'utf8');
  const block = css.match(/\.worksTabBar\s*\{[\s\S]*?\n\}/);
  assert.ok(block, 'worksTabBar block missing');
  assert.match(block[0], /border-radius:\s*var\(--creator-radius\)/);
  assert.doesNotMatch(block[0], /border-radius:\s*0/);
  assert.doesNotMatch(block[0], /width:\s*calc\(100% \+ 40px\)/);
  assert.doesNotMatch(block[0], /overflow:\s*hidden/);
});

test('Create_移动端草稿管理展开时Tab不应负位移裁切', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/page/Create.module.css'), 'utf8');
  assert.doesNotMatch(css, /worksTabs[\s\S]{0,400}translateX\(-30px\)/);
  assert.match(css, /\.draftManageActionsExpanded\s*\{[\s\S]*?flex:\s*1 0 100%/);
});

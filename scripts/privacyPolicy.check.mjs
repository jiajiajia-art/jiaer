/**
 * 外置隐私政策 URL / 注册勾选校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  isPrivacyAgreementAccepted,
} from '../src/lib/privacyPolicy.ts';
import { resolveRegistrationAgreementUrl } from '../src/lib/registrationAgreement.ts';

const privacyHtmlPath = join(import.meta.dirname, '../public/privacyPolicy/index.html');
const authModalPath = join(import.meta.dirname, '../src/components/AuthModal.tsx');
const legalDocumentPath = join(import.meta.dirname, '../src/page/LegalDocument.tsx');
const authStorePath = join(import.meta.dirname, '../src/store/useAuthStore.ts');

test('legacy privacy URL redirects to the locale-aware Markdown route without duplicate policy content', () => {
  assert.equal(existsSync(privacyHtmlPath), true);
  const html = readFileSync(privacyHtmlPath, 'utf8');
  assert.match(html, /\.\.\/legal\/privacy-policy\?lang=en/);
  assert.doesNotMatch(html, /<h1>|<h2>/);
  assert.equal(
    resolveRegistrationAgreementUrl('privacy-policy', { origin: 'https://example.com', base: '/funloom/' }),
    'https://example.com/funloom/legal/privacy-policy',
  );
  const source = readFileSync(legalDocumentPath, 'utf8');
  assert.match(source, /terms-of-service-en\.md\?raw/);
  assert.match(source, /privacy-policy-en\.md\?raw/);
  assert.match(source, /window\.close\(\)/);
  assert.match(source, /miniProgram\?\.miniProgram|miniProgram\?\.navigateBack|navigateBack/);
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
  assert.match(src, /resolveRegistrationAgreementUrl\('privacy-policy'\)/);
  assert.match(src, /useNavigate/);
  assert.match(src, /matchMedia\('\(max-width: 767px\)'\)/);
  assert.match(src, /navigate\(`\/legal\/\$\{document\}`\)/);
  assert.match(src, /mode === 'register'/);
  assert.match(src, /privacyPolicyUrl/);
});

test('移动端协议返回应保留进入前的注册弹窗模式', () => {
  const authSource = readFileSync(authModalPath, 'utf8');
  const authStoreSource = readFileSync(authStorePath, 'utf8');
  assert.match(authStoreSource, /authModalMode/);
  assert.match(authStoreSource, /setAuthModalMode/);
  assert.match(authSource, /authModalStore/);
  assert.match(authSource, /setAuthModalMode\(mode\)/);
});

test('AuthModal_拖选输入框内容时不应被遮罩点击关闭', () => {
  const src = readFileSync(authModalPath, 'utf8');
  assert.match(src, /const handleOverlayClick =/);
  assert.match(src, /event\.target !== event\.currentTarget/);
  assert.match(src, /overlayPointerRef/);
  assert.match(src, /addEventListener\('pointerdown'/);
  assert.match(src, /addEventListener\('pointermove'/);
  assert.match(src, /moved/);
  assert.match(src, /selectionStart/);
  assert.match(src, /selectionEnd/);
  assert.match(src, /window\.getSelection\(\)/);
});

test('Create_作品Tab栏应使用与其他模块一致的圆角', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/page/Create.module.css'), 'utf8');
  const block = css.match(/\.worksTabBar\s*\{[\s\S]*?\n\}/);
  assert.ok(block, 'worksTabBar block missing');
  assert.match(block[0], /border-radius:\s*(10px|var\(--creator-radius\))/);
  assert.doesNotMatch(block[0], /border-radius:\s*0/);
  assert.doesNotMatch(block[0], /width:\s*calc\(100% \+ 40px\)/);
  assert.doesNotMatch(block[0], /overflow:\s*hidden/);
});

test('Create_草稿管理展开时仍靠右同排不另起一行', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/page/Create.module.css'), 'utf8');
  assert.doesNotMatch(css, /worksTabs[\s\S]{0,400}translateX\(-30px\)/);
  const expanded = css.match(/\.draftManageActions\.draftManageActionsExpanded\s*\{[\s\S]*?\n\}/);
  assert.ok(expanded, 'draftManageActionsExpanded block missing');
  assert.match(expanded[0], /justify-content:\s*flex-end/);
  assert.doesNotMatch(expanded[0], /grid-row:\s*2/);
  assert.doesNotMatch(expanded[0], /flex:\s*1 0 100%/);
  assert.doesNotMatch(expanded[0], /position:\s*absolute/);
});

test('Create_草稿管理模式不应用绝对定位叠层', () => {
  const css = readFileSync(join(import.meta.dirname, '../src/page/Create.module.css'), 'utf8');
  const manageBlocks = [...css.matchAll(/\.draftManageActions(?:\.draftManageActionsExpanded)?\s*\{[\s\S]*?\n\}/g)];
  assert.ok(manageBlocks.length >= 1, 'draftManageActions rules missing');
  for (const block of manageBlocks) {
    assert.doesNotMatch(block[0], /position:\s*absolute/);
  }
  const panel = readFileSync(join(import.meta.dirname, '../src/components/Create/CreatorWorksPanel.tsx'), 'utf8');
  assert.match(panel, /worksTabBarManaging/);
  assert.match(panel, /!isDraftManageMode && !isVisitor/);
});

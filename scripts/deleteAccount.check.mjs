import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('ProfileFunctionPanel_应提供注销账户两步确认入口', () => {
  const panel = fs.readFileSync(
    path.join(root, 'src/components/Profile/ProfileFunctionPanel.tsx'),
    'utf8',
  );
  assert.match(panel, /DeleteAccountModal/);
  assert.match(panel, /profile\.deleteAccount\.title/);
  assert.match(panel, /setIsDeleteAccountFirstOpen\(true\)/);
  assert.match(panel, /setIsDeleteAccountWarningOpen\(true\)/);
  assert.match(panel, /auth\.deleteAccount/);
  assert.doesNotMatch(panel, /\balert\s*\(/);
  assert.doesNotMatch(panel, /\bwindow\.confirm\s*\(/);
});

test('DeleteAccountModal_应对齐重要提醒与双按钮文案键', () => {
  const modal = fs.readFileSync(
    path.join(root, 'src/components/Profile/DeleteAccountModal.tsx'),
    'utf8',
  );
  const css = fs.readFileSync(
    path.join(root, 'src/components/Profile/DeleteAccountModal.module.css'),
    'utf8',
  );
  assert.match(modal, /profile\.deleteAccount\.warningTitle/);
  assert.match(modal, /profile\.deleteAccount\.confirmDelete/);
  assert.match(modal, /profile\.deleteAccount\.thinkAgain/);
  assert.match(modal, /profile\.deleteAccount\.consequences/);
  assert.match(css, /\.warningIcon\s*\{[\s\S]*?place-items:\s*center/);
  assert.match(css, /\.actions\s*\{[\s\S]*?display:\s*flex/);
});

test('authApi_应暴露deleteAccount接口', () => {
  const api = fs.readFileSync(path.join(root, 'src/api/account/authApi.ts'), 'utf8');
  assert.match(api, /deleteAccount:\s*\(\)\s*=>/);
  assert.match(api, /\/auth\/user\/delete-account/);
});

test('i18n_注销文案中英齐全', () => {
  const zh = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/zh.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
  assert.equal(zh.profile.deleteAccount.title, '注销账户');
  assert.equal(zh.profile.deleteAccount.confirmDelete, '确认注销');
  assert.equal(Array.isArray(zh.profile.deleteAccount.consequences), true);
  assert.equal(zh.profile.deleteAccount.consequences.length, 8);
  assert.equal(en.profile.deleteAccount.title, 'Delete Account');
  assert.equal(en.profile.deleteAccount.consequences.length, 8);
});

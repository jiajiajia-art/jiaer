/**
 * 冲突草稿只在进入编辑器时弹一次必须二选一的对话框。
 * 遮罩、Esc、关闭钮不能关掉，也不能替用户选版本。分区切换不再弹。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const modal = readFileSync(join(root, 'Romance/src/components/ui.tsx'), 'utf8');
const PAGE = process.env.ROMANCE_STEP_URL || 'http://39.106.250.199/funloom/romance/?createWorld=1';

test('草稿冲突_改成锁定对话框且文案不变', () => {
  assert.match(panel, /<Modal title="发现本机未保存的草稿" locked /);
  assert.match(panel, /这个模组在浏览器里有一份自动保存的草稿（\{fmtDraftTime\(draft\.pending\.at\)\}），与已保存的版本不一致。请选择要加载的版本。/);
  assert.match(panel, /注意：草稿生成之后，已保存的版本又被修改过，恢复草稿会覆盖那些修改。/);
  assert.match(panel, />恢复草稿</);
  assert.match(panel, />使用已保存版本</);
  assert.match(panel, /草稿已存本机/);
  assert.doesNotMatch(panel, /aria-label="发现本机未保存草稿"/);
  assert.doesNotMatch(panel, /border-gold\/50 bg-gold\/10 p-3\.5/);
  assert.match(modal, /if \(lockedRef\.current\) return/);
  assert.match(modal, /onClick=\{locked \? undefined : onClose\}/);
  assert.match(modal, /locked \? null : \(/);
});

function sessionAndDraft() {
  const s1 = {
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['rooms'],
    scopeVersion: 2,
  };
  const mod = {
    id: 'ai-steps',
    name: '雾港来信',
    version: '0.1.0',
    kind: 'world',
    dependencies: [],
    content: {
      rooms: { inn: { name: '旅店', desc: '海边旅店' } },
      startRoom: 'inn',
    },
  };
  const session = {
    step: 2,
    s1,
    draft: { ...s1 },
    mod,
    scrollY: 0,
    editorGroup: 'base',
    updatedAt: Date.now(),
  };
  const conflict = {
    at: Date.now() - 86_400_000,
    base: 'older-than-saved',
    value: { ...mod, name: '草稿雾港' },
  };
  return { session, conflict };
}

test('进入编辑器_冲突草稿必须二选一且再次进入会再问', { timeout: 90_000 }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const payload = sessionAndDraft();
  const dialog = () => page.getByRole('alertdialog', { name: '发现本机未保存的草稿' });
  const nameBox = () => page.getByPlaceholder('如：雾色旅馆');
  try {
    await page.addInitScript((raw) => {
      sessionStorage.removeItem('star:wgTrimRecover');
      sessionStorage.removeItem('star:wgPersistBlock');
      localStorage.setItem('star:worldGenSession.v2', raw.session);
      if (!sessionStorage.getItem('draftConflictSeeded')) {
        localStorage.setItem('star2005.draft.mod.new', raw.conflict);
        sessionStorage.setItem('draftConflictSeeded', '1');
      }
    }, { session: JSON.stringify(payload.session), conflict: JSON.stringify(payload.conflict) });
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await dialog().waitFor({ timeout: 20_000 });
    assert.match(await dialog().innerText(), /与已保存的版本不一致/);
    assert.match(await dialog().innerText(), /恢复草稿会覆盖那些修改/);
    assert.equal(await nameBox().inputValue(), '雾港来信');
    assert.equal(await dialog().getByRole('button', { name: '关闭' }).count(), 0);
    await page.locator('.ui-overlay-modal').click({ position: { x: 8, y: 8 } });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await dialog().count(), 1);
    await dialog().getByRole('button', { name: '恢复草稿' }).click();
    await dialog().waitFor({ state: 'hidden', timeout: 5_000 });
    assert.equal(await nameBox().inputValue(), '草稿雾港');
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dialog().waitFor({ timeout: 20_000 });
    assert.equal(await nameBox().inputValue(), '雾港来信');
    await dialog().getByRole('button', { name: '使用已保存版本' }).click();
    await dialog().waitFor({ state: 'hidden', timeout: 5_000 });
    assert.equal(await nameBox().inputValue(), '雾港来信');
    await page.getByRole('button', { name: /② 角色/ }).first().click();
    await page.waitForTimeout(400);
    assert.equal(await dialog().count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /下一步：/ }).waitFor({ timeout: 20_000 });
    assert.equal(await dialog().count(), 0);
  } finally {
    await browser.close();
  }
});

/**
 * 冲突草稿：入口/编辑器须二选一；选完前不打开表单、不跳上次填写位置。
 * 遮罩、Esc、关闭钮不能关掉，也不能替用户选版本。
 * 弹窗文案：本机草稿与已保存版本都写出保存时间。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'Romance/src/components/ModEditorPanel.tsx'), 'utf8');
const wiz = readFileSync(join(root, 'Romance/src/components/WorldGenWizard.tsx'), 'utf8');
const modal = readFileSync(join(root, 'Romance/src/components/ui.tsx'), 'utf8');
const draftLib = readFileSync(join(root, 'Romance/src/lib/useDraft.ts'), 'utf8');
const PAGE = process.env.ROMANCE_STEP_URL || 'http://39.106.250.199/funloom/romance/?createWorld=1';

test('草稿冲突_入口与编辑器文案按钮', () => {
  assert.match(panel, /<Modal title="发现本机未保存的草稿" locked /);
  assert.match(panel, /继续填写草稿/);
  assert.match(panel, /从已保存版本开始/);
  assert.match(panel, /继续填写草稿会覆盖那些修改/);
  assert.match(panel, /草稿已存本机/);
  assert.doesNotMatch(panel, />恢复草稿</);
  assert.doesNotMatch(panel, />使用已保存版本</);
  assert.match(wiz, /继续编辑已有内容/);
  assert.match(wiz, /继续填写草稿/);
  assert.match(wiz, /从已保存版本开始/);
  assert.match(wiz, /选定前不打开表单/);
  assert.match(wiz, /bootFromSession/);
  assert.match(wiz, /step: 1 as const/);
  assert.match(modal, /if \(lockedRef\.current\) return/);
  assert.match(modal, /onClick=\{locked \? undefined : onClose\}/);
  assert.match(modal, /locked \? null : \(/);
});

test('草稿冲突_已保存版本也写出时间', () => {
  // 功能注释：两边都写 fmtDraftTime，禁止只给本机草稿带时间
  assert.match(panel, /已保存的版本（\$\{fmtDraftTime\(savedAtMs\)\}）/);
  assert.match(panel, /自动保存的草稿（\{fmtDraftTime\(draft\.pending\.at\)\}）/);
  assert.match(panel, /writeSavedVersionAt/);
  assert.match(panel, /resolveSavedVersionAt/);
  assert.match(wiz, /已保存的版本（\$\{fmtDraftTime\(entranceDraftGate\.savedAt\)\}）/);
  assert.match(wiz, /savedAt: resolveSavedVersionAt/);
  assert.match(wiz, /writeSavedVersionAt\(WORLD_GEN_DRAFT_ID/);
  assert.match(draftLib, /export function writeSavedVersionAt/);
  assert.match(draftLib, /export function resolveSavedVersionAt/);
  assert.match(draftLib, /SAVED_VERSION_AT_PREFIX/);
});

test('fmtDraftTime与resolveSavedVersionAt_今天与日期格式', async () => {
  const mod = await import(pathToFileURL(join(root, 'Romance/src/lib/useDraft.ts')).href);
  const now = new Date();
  const todayLabel = mod.fmtDraftTime(now.getTime());
  assert.match(todayLabel, /^今天 \d{2}:\d{2}$/);
  const older = new Date(2024, 9, 24, 15, 30, 0).getTime(); // 10月24日
  assert.equal(mod.fmtDraftTime(older), '10月24日 15:30');
  assert.equal(mod.resolveSavedVersionAt('__missing_draft_id__', 12345), 12345);
  assert.equal(mod.resolveSavedVersionAt('__missing_draft_id__', null), null);
  assert.equal(mod.resolveSavedVersionAt('__missing_draft_id__', 0), null);
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
    scrollY: 420,
    editorGroup: 'cast',
    updatedAt: Date.now(),
  };
  const conflict = {
    at: Date.now() - 86_400_000,
    base: 'older-than-saved',
    value: { ...mod, name: '草稿雾港' },
    cursor: { group: 'cast', scrollY: 200 },
  };
  return { session, conflict };
}

test('再进入_先停入口_有草稿才弹窗且选完前不开表单', { timeout: 90_000 }, async (t) => {
  // 功能注释：仅在显式指向已部署本改动的地址时跑浏览器；默认远端可能仍是旧包
  if (!process.env.ROMANCE_STEP_URL) {
    t.skip('未设置 ROMANCE_STEP_URL，跳过线上 E2E（静态契约已覆盖）');
    return;
  }
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
    // 功能注释：再进入先停设定入口，禁止直接打开编辑器表单
    await page.getByRole('heading', { name: '生成世界' }).waitFor({ timeout: 20_000 });
    assert.equal(await dialog().count(), 0);
    assert.equal(await nameBox().count(), 0);
    await page.getByRole('button', { name: '继续编辑已有内容' }).click();
    await dialog().waitFor({ timeout: 20_000 });
    assert.match(await dialog().innerText(), /请先选择，再打开表单|与已保存的版本不一致/);
    assert.equal(await nameBox().count(), 0);
    assert.equal(await dialog().getByRole('button', { name: '关闭' }).count(), 0);
    await page.locator('.ui-overlay-modal').click({ position: { x: 8, y: 8 } });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert.equal(await dialog().count(), 1);
    await dialog().getByRole('button', { name: '继续填写草稿' }).click();
    await dialog().waitFor({ state: 'hidden', timeout: 5_000 });
    await nameBox().waitFor({ timeout: 20_000 });
    assert.equal(await nameBox().inputValue(), '草稿雾港');
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '生成世界' }).waitFor({ timeout: 20_000 });
    await page.getByRole('button', { name: '继续编辑已有内容' }).click();
    await dialog().waitFor({ timeout: 20_000 });
    await dialog().getByRole('button', { name: '从已保存版本开始' }).click();
    await dialog().waitFor({ state: 'hidden', timeout: 5_000 });
    await nameBox().waitFor({ timeout: 20_000 });
    assert.equal(await nameBox().inputValue(), '雾港来信');
    await page.getByRole('button', { name: /② 角色/ }).first().click();
    await page.waitForTimeout(400);
    assert.equal(await dialog().count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '生成世界' }).waitFor({ timeout: 20_000 });
    assert.equal(await dialog().count(), 0);
  } finally {
    await browser.close();
  }
});

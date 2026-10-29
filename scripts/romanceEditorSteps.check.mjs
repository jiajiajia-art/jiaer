/**
 * 脏生成结果从「① 基础」连点「下一步」直到「⑤ 玩法」。
 * 任何一页抛 TypeError（some / trim / map / join）都算失败。
 * 打的是已部署的 cn-gogo，用来抓住源码字符串断言覆盖不到的渲染崩溃。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const PAGE = process.env.ROMANCE_STEP_URL || 'http://39.106.250.199/funloom/romance/?createWorld=1';

function dirtySession() {
  const s1 = {
    title: '雾港来信',
    setting: '玩家继承海边旅店。',
    aiPolish: true,
    engineId: 'balanced',
    contentIds: ['world'],
    editorStepIds: ['rooms', 'npcs', 'creation', 'rules', 'lore'],
    scopeVersion: 2,
  };
  const mod = {
    id: 'ai-steps',
    name: '雾港来信',
    version: '0.1.0',
    kind: 'world',
    dependencies: [],
    content: {
      rooms: { inn: { name: { n: '旅店' }, desc: '海边旅店', bg: '暖光客厅，沙发靠窗' } },
      startRoom: 'inn',
      customAttrs: [{ id: 'ling', init: 10 }],
      creation: {
        paths: [{
          id: 'p1',
          name: '继承人',
          open: true,
          fx: { attr: [{ val: 8 }], favor: [{ val: 3 }], reputation: [{ val: 1 }] },
          npcs: { id: 'a' },
          eventId: 'missing',
        }],
        startFactions: [{ id: 'sf', name: { zh: '港务' } }],
        fields: [{ id: 'f1', label: '座右铭', type: 'select', options: [{ name: '甲' }] }],
      },
      identities: [{ id: 'p1', name: { n: '继承人' } }],
      styles: [{ id: 's', name: { zh: '清冷' }, desc: { text: '少话' } }],
      school: [{ name: '雾港一中' }],
      parentJobs: [{ name: '教师', desc: '严' }],
      zodiacs: [{ id: 'aries', name: '白羊座' }],
      npcs: [{
        id: 'a',
        name: '阿宁',
        role: '掌柜',
        age: 24,
        gender: '女',
        home: 'inn',
        kind: 'staff',
        timeline: '大学分手',
        works: [{ name: '风起南巷' }],
      }],
      gameRules: [{ id: 'r1', name: '过劳', when: 'day' }],
      lore: [{ id: 'r1', name: '雾港', factions: [{ id: 'f1', name: '港务局', chars: [{ id: 'c1' }] }] }],
      worldBook: [{ id: 'w1', title: { zh: '雾' }, enabled: true, mode: 'keyword' }],
      storylines: [{ id: 'sl', name: '主线', nodes: { id: 'n1' } }],
      income: [{ id: 'i1', name: { n: '房租' } }],
      fixedEvents: [{ id: 'e1', name: '夜', trigger: { kind: 'clock', from: '22:00', to: '06:00' } }],
      phoneAppsCfg: { apps: [] },
      bgm: { tracks: [] },
      navTabs: [{ id: 'home', label: { zh: '日程' } }],
    },
  };
  return {
    step: 2,
    s1,
    draft: { ...s1 },
    mod,
    scrollY: 0,
    editorGroup: 'base',
    updatedAt: Date.now(),
  };
}

test('脏模组连点下一步_停在玩法且无TypeError', { timeout: 60_000 }, async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const logs = [];
  page.on('pageerror', (err) => logs.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /TypeError|reading '|is not a function|not iterable/.test(msg.text())) {
      logs.push(msg.text());
    }
  });
  try {
    await page.addInitScript((raw) => {
      sessionStorage.removeItem('star:wgTrimRecover');
      sessionStorage.removeItem('star:wgPersistBlock');
      localStorage.setItem('star:worldGenSession.v2', raw);
    }, JSON.stringify(dirtySession()));
    await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const next = page.getByRole('button', { name: /下一步：/ });
    await next.waitFor({ timeout: 20_000 });
    const tabCount = page.locator('button[aria-pressed="true"] .wg-tab-count');
    await tabCount.waitFor({ timeout: 15_000 });
    const tabColors = await tabCount.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.color, bg: style.backgroundColor };
    });
    assert.notEqual(tabColors.color, 'rgb(255, 255, 255)', `选中页签数量白字看不清：${JSON.stringify(tabColors)}`);
    const thumb = page.getByRole('button', { name: '上传背景图' });
    await thumb.waitFor({ timeout: 15_000 });
    const broken = await thumb.locator('img').evaluateAll((imgs) => imgs
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.getAttribute('src') || ''));
    assert.deepEqual(broken, [], `场景背景图缩略图裂开：${broken.join(', ')}`);
    for (let i = 0; i < 4; i++) {
      const label = await next.innerText();
      await next.click();
      await page.waitForTimeout(500);
      const crashed = logs.find((line) => /TypeError/.test(line));
      assert.equal(crashed, undefined, `点「${label}」后崩溃：\n${logs.join('\n')}`);
    }
    const pressed = await page.locator('[aria-pressed="true"]').allInnerTexts();
    assert.ok(pressed.some((text) => text.includes('⑤ 玩法')), `应停在玩法，实际高亮：${pressed.join(' | ')}`);
    assert.equal(logs.length, 0, logs.join('\n'));
  } finally {
    await browser.close();
  }
});

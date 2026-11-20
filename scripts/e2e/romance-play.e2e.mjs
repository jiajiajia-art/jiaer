import { open, BASE, buttons } from "./e2e-lib.mjs";
const R = []; const ok = (n, c, x = "") => { R.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  — " + String(x).slice(0, 160) : ""}`); };
const { browser, ctx, page, errors, calls } = await open();
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
try {
  await ctx.addInitScript(() => {
    localStorage.setItem("auth-storage", JSON.stringify({ state: { user: { role: "operator" } } }));
  });
  await page.goto(BASE + "/romance/", { timeout: 60000 }); await page.waitForTimeout(6000);
  // 建角 · 第 2 步
  await page.getByText("下一步 · 开局").click(); await page.waitForTimeout(1500);
  const step2 = await body();
  ok("建角：无「跟随世界观」，三种人称", !step2.includes("跟随世界观") && step2.includes("第一人称") && step2.includes("第三人称"));
  ok("建角：世界规则卡已移除", !step2.includes("世界规则"));
  await page.getByRole("radio", { name: "第二人称" }).click();
  await page.getByRole("button", { name: "开始", exact: true }).click();
  await page.waitForTimeout(9000);
  if (await page.getByRole("button", { name: "跳过" }).count()) await page.getByRole("button", { name: "跳过" }).first().click();
  await page.waitForTimeout(800);
  let t = await body();
  ok("开局：AI 开场正文渲染", t.includes("第1回合"));
  ok("开局：剧情选项 3 个", (await page.locator(".option-btn").count()) === 3, await page.locator(".option-btn").count());
  ok("底栏为中文页签名（无英文 key）", !/\b(home|npc|phone|settings)\b/.test(t), (await buttons(page)).filter((b) => /世界|人脉|手机|事业|日程/.test(b)).join(" "));
  ok("开局：无状态补全占位泄漏", !t.includes("状态没写完整"));
  // 字体与字重
  const fonts = await page.evaluate(() => {
    const opt = document.querySelector(".option-btn span.min-w-0");
    const prose = document.querySelector(".story-prose");
    const cs = (el) => el ? getComputedStyle(el) : null;
    return { optF: cs(opt)?.fontFamily, proseF: cs(prose)?.fontFamily, optW: cs(opt)?.fontWeight, proseW: cs(prose)?.fontWeight };
  });
  ok("正文与选项字体一致", fonts.optF && fonts.optF === fonts.proseF, `${fonts.optF} | ${fonts.proseF}`);
  ok("正文与选项不加粗（400）", fonts.optW === "400" && fonts.proseW === "400", `${fonts.optW}/${fonts.proseW}`);
  // 第 2 回合
  await page.locator(".option-btn").first().click();
  await page.waitForTimeout(9000);
  t = await body();
  ok("第 2 回合：点选项后 AI 再次生成并渲染", t.includes("第2回合"), `AI 调用 ${calls.length} 次`);
  const last = calls.filter((c) => Array.isArray(c.messages)).at(-1);
  const prompt = (last?.messages ?? []).map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  ok("请求含文风基底预设（首条 system）", String(last?.messages?.[0]?.content ?? "").startsWith("【文风基底"));
  ok("请求含第二人称提醒", prompt.includes("【叙事视角 · 本回合必须遵守】") && prompt.includes("第二人称"));
  ok("请求含剧情记忆（第 1 回合事件）", prompt.includes("【剧情记忆】") && prompt.includes("第1回合：主角在樱花树下遇见陆知远"));
  ok("请求含收尾写作要求", prompt.includes("【本轮写作要求】"));
  ok("请求含活人感规则", prompt.includes("2.4.1 活人感"));
  ok("请求含世界观命名规则", prompt.includes("不得在非中文背景里起中文名"));
  ok("请求带个人线路采样参数", last?.temperature === 0.8 && last?.top_p === 0.9, `${last?.temperature}/${last?.top_p}`);
  // 地图：输入与选项隐藏
  await page.getByRole("button", { name: /外出/ }).first().click(); await page.waitForTimeout(2500);
  const mapOpts = await page.locator(".option-btn:visible").count();
  const mapInput = await page.locator("textarea:visible, input[placeholder*='行动']:visible").count();
  ok("大地图打开时不显示选项与自定义输入", mapOpts === 0 && mapInput === 0, `选项 ${mapOpts} 输入 ${mapInput}`);
  await page.screenshot({ path: "/tmp/e2e-r_map.png" });
  const back = page.getByRole("button", { name: /返回此地/ });
  if (await back.count()) await back.first().click(); await page.waitForTimeout(1500);
  // 人物档案
  await page.getByRole("button", { name: "人脉", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(2500);
  const lu = page.getByText("陆知远").first();
  if (await lu.count()) { await lu.click().catch(() => {}); await page.waitForTimeout(2000); }
  t = await body();
  ok("人物档案不再显示「个人能力」", !t.includes("个人能力"));
  await page.screenshot({ path: "/tmp/e2e-r_npc.png" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  await page.getByRole("button", { name: "世界", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(1500);
  // 悬浮球 · 消耗明细浮层
  const fab = page.locator('[data-ai-route-fab="1"]');
  ok("游戏内显示 AI 线路悬浮球", (await fab.count()) > 0);
  if (await fab.count()) {
    await fab.first().click(); await page.waitForTimeout(1500);
    const url0 = page.url();
    await page.getByRole("button", { name: "消耗明细" }).first().click(); await page.waitForTimeout(3500);
    const overlay = await page.locator('[role="dialog"][aria-label="消耗明细"]').count();
    ok("消耗明细以浮层打开，不切路由", overlay > 0 && page.url() === url0, page.url());
    await page.screenshot({ path: "/tmp/e2e-r_ledger.png" });
    await page.keyboard.press("Escape"); await page.waitForTimeout(1500);
    t = await body();
    ok("关闭明细后仍在游戏内（存档未丢）", t.includes("第2回合") && !(await page.locator('[role="dialog"][aria-label="消耗明细"]').count()));
  }
  // 刷新恢复
  await page.waitForTimeout(3000);
  await page.reload({ timeout: 60000 }); await page.waitForTimeout(9000);
  const loadBtn = page.getByRole("button", { name: "读取存档" });
  ok("刷新后建角页出现「读取存档」", (await loadBtn.count()) > 0);
  if (await loadBtn.count()) {
    await loadBtn.first().click(); await page.waitForTimeout(2000);
    await page.screenshot({ path: "/tmp/e2e-r_saves.png" });
    const slotTexts = (await page.locator('button:visible').allInnerTexts()).map((x) => x.replace(/\s+/g, " ")).filter(Boolean);
    const slot = page.getByRole("button", { name: "读取", exact: true }).first();
    if (await slot.count()) { await slot.click(); await page.waitForTimeout(6000); }
    t = await body();
    ok("读取存档后回到游戏内进度", t.includes("第2回合"), slotTexts.slice(0, 6).join(" / "));
  }
} catch (e) { R.push("ERROR " + e.message.slice(0, 300)); await page.screenshot({ path: "/tmp/e2e-r_err.png" }); }
ok("全程无未捕获脚本错误", !errors.length, errors.join(" | "));
console.log(R.join("\n"));
await browser.close();

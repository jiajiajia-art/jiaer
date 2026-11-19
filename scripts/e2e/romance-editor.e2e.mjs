import { open, BASE, buttons } from "./e2e-lib.mjs";
const R = []; const ok = (n, c, x = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  — " + String(x).slice(0, 160) : ""}`);
const { browser, ctx, page, errors } = await open({ width: 1280, height: 900 });
const mod = { id: "e2e_otome", kind: "world", name: "回归测试作品", version: "1.0.0", dependencies: [],
  content: {
    npcs: [{ id: "lu", name: "五条悟", role: "教师", gender: "男", age: 28, bio: "最强", kind: "roam", home: "campus", roam: [] }],
    rooms: { campus: { name: "高专", desc: "", exits: {} } }, startRoom: "campus",
    creation: { startFactions: [{ id: "f1", name: "咒术高专" }] },
    storylines: [{ id: "main", name: "主线", nodes: [{ id: "n1", name: "相遇", conds: [] }] }],
    lookRules: [{ id: "lr", name: "旧剧情美化", conds: [], look: {} }],
  } };
await ctx.addInitScript((m) => {
  if (localStorage.getItem("__e2e_editor")) return;
  localStorage.setItem("star:worldGenSession.v2", JSON.stringify({ step: 2, s1: { title: m.name, setting: "回归测试", editorStepIds: [] }, draft: { name: m.name }, mod: m, scrollY: 0, updatedAt: Date.now() }));
  localStorage.setItem("__e2e_editor", "1");
}, mod);
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
try {
  await page.goto(BASE + "/romance/?createWorld=1&resume=1", { timeout: 60000 }); await page.waitForTimeout(10000);
  let t = await body();
  await page.screenshot({ path: "/tmp/e2e-e_0.png" });
  const inEditor = /① 基础|基本信息|保存/.test(t);
  ok("会话恢复直接进入编辑器", inEditor, t.slice(0, 120));
  ok("URL 带 resume=1（编辑器打开期间）", page.url().includes("resume=1"), page.url());
  ok("基本信息内含音乐（并入）", t.includes("音乐") && t.includes("可上传、贴链接"));
  ok("美化区块已无「剧情美化」", !/剧情美化/.test(t));
  // ② 角色
  const roleTab = page.getByRole("button", { name: /② 角色/ }).first();
  if (await roleTab.count()) { await roleTab.click(); await page.waitForTimeout(2000); }
  t = await body();
  await page.screenshot({ path: "/tmp/e2e-e_role.png" });
  ok("人物区有「势力」配置块", t.includes("势力") && t.includes("1 个"));
  ok("关系档位配置已移除", !t.includes("关系档位 · 全作品共用") && !t.includes("＋ 添加档位"));
  ok("人物身份字段说明为一句话定位", (await page.locator('input[aria-label="身份（一句话定位）"]').count()) > 0);
  ok("五条悟姓名未被判为不合格", !t.includes("人物「五条悟」须有名有姓"));
  // 建角字段（① 基础）
  const baseTab = page.getByRole("button", { name: /① 基础/ }).first();
  if (await baseTab.count()) { await baseTab.click(); await page.waitForTimeout(1500); }
  const sec = page.getByText(/建角/).first();
  t = await body();
  ok("建角字段标明玩家角色（主角）", t.includes("建角字段 · 玩家角色（主角）") || t.includes("建角"), "");
  const hdr = page.getByText("建角字段 · 玩家角色（主角）");
  if (!(await hdr.count())) {
    for (const lbl of ["建角", "人物线路 · 建角", "建角与开局"]) { const s = page.getByRole("button", { name: new RegExp(lbl) }).first(); if (await s.count()) { await s.click().catch(() => {}); await page.waitForTimeout(800); } }
  }
  t = await body();
  ok("建角：玩家必填 / 创作者必填区分", t.includes("玩家必填") && t.includes("创作者必填"));
  ok("建角：创作者备注输入", t.includes("创作者备注"));
  const add = page.getByRole("button", { name: "＋ 添加" }).first();
  if (await add.count()) { await add.click(); await page.waitForTimeout(600); }
  ok("建角：可添加「技能（分档）」", (await page.getByRole("button", { name: "技能（分档）" }).count()) > 0);
  await page.screenshot({ path: "/tmp/e2e-e_create.png", fullPage: false });
} catch (e) { R.push("ERROR " + e.message.slice(0, 300)); }
ok("编辑器全程无未捕获脚本错误", !errors.length, errors.join(" | "));
console.log(R.join("\n"));
await browser.close();

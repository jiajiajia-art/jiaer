import { open, BASE, buttons } from "./e2e-lib.mjs";
const R = []; const ok = (n, c, x = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  — " + String(x).slice(0, 200) : ""}`);
const { browser, ctx, page, errors } = await open({ width: 1280, height: 900 });
const mod = { id: "e2e_otome", kind: "world", name: "回归测试作品", version: "1.0.0", dependencies: [],
  content: { npcs: [{ id: "lu", name: "五条悟", role: "教师", gender: "男", age: 28, bio: "最强的咒术师", kind: "roam", home: "campus", roam: [], init: 10, metStart: true }],
    rooms: { campus: { name: "高专", desc: "咒术高专校园", exits: {} } }, startRoom: "campus", startMoney: 0, moneyLabel: "元",
    prompt: { scriptTone: "咒术回战同人，第二人称。" } } };
await ctx.addInitScript((m) => {
  if (localStorage.getItem("__e2e_editor")) return;
  localStorage.setItem("star:worldGenSession.v2", JSON.stringify({ step: 2, s1: { title: m.name, setting: "回归测试", editorStepIds: [] }, draft: { name: m.name }, mod: m, scrollY: 0, updatedAt: Date.now() }));
  localStorage.setItem("__e2e_editor", "1");
}, mod);
const body = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");
try {
  await page.goto(BASE + "/romance/?createWorld=1", { timeout: 60000 }); await page.waitForTimeout(9000);
  await page.reload({ timeout: 60000 }); await page.waitForTimeout(9000);
  ok("编辑器内刷新仍回到编辑器（B-06）", /① 基础/.test(await body()));
  await page.getByRole("button", { name: /② 角色/ }).first().click(); await page.waitForTimeout(1500);
  const cp = page.locator('input[aria-label="常用语"]').first();
  await cp.fill("我可是最强的哦");
  const nameIn = page.locator('input[aria-label="姓名（须有名有姓）"]').first();
  await nameIn.fill("五条悟改");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "预览", exact: true }).first().click();
  await page.waitForTimeout(8000);
  let t = await body();
  await page.screenshot({ path: "/tmp/e2e-e2_preview.png" });
  const inPreview = /退出预览|作者预览|开始/.test(t);
  ok("点预览进入作者预览", inPreview, t.slice(0, 120));
  // 进局
  const next = page.getByText("下一步 · 开局"); if (await next.count()) { await next.click(); await page.waitForTimeout(1200); }
  const start = page.getByRole("button", { name: /^(开始|开启故事)$/ });
  console.log("START count", await start.count(), "BTNS", (await buttons(page)).join(" | "));
  if (await start.count()) { await start.first().click(); await page.waitForTimeout(3000); console.log("AFTER START:", (await body()).slice(0, 600)); await page.screenshot({ path: "/tmp/e2e-e2_afterstart.png" }); await page.waitForTimeout(7000); }
  if (await page.getByRole("button", { name: "跳过" }).count()) await page.getByRole("button", { name: "跳过" }).first().click();
  t = await body();
  await page.screenshot({ path: "/tmp/e2e-e2_game.png" });
  ok("预览可进局并生成开场", t.includes("第1回合"), t.slice(0, 120));
  // 退出预览
  const exit = page.getByRole("button", { name: /退出预览|返回编辑/ }).first();
  if (await exit.count()) { await exit.click(); await page.waitForTimeout(4000); }
  const confirm = page.getByRole("button", { name: /确定|退出|返回/ }).filter({ hasNotText: "预览" });
  t = await body();
  if (!/① 基础|② 角色/.test(t) && await confirm.count()) { await confirm.first().click().catch(() => {}); await page.waitForTimeout(3000); }
  t = await body();
  ok("退出预览回到编辑器", /① 基础|② 角色/.test(t), t.slice(0, 120));
  const roleTab = page.getByRole("button", { name: /② 角色/ }).first(); if (await roleTab.count()) { await roleTab.click(); await page.waitForTimeout(1500); }
  const cpVal = await page.locator('input[aria-label="常用语"]').first().inputValue().catch(() => "");
  ok("预览返回后常用语仍在（C-09）", cpVal === "我可是最强的哦", cpVal);
  const nmVal = await page.locator('input[aria-label="姓名（须有名有姓）"]').first().inputValue().catch(() => "");
  ok("预览返回后改的名字仍在（C-03）", nmVal === "五条悟改", nmVal);
} catch (e) { R.push("ERROR " + e.message.slice(0, 300)); await page.screenshot({ path: "/tmp/e2e-e2_err.png" }); }
ok("全程无未捕获脚本错误", !errors.length, errors.join(" | "));
console.log(R.join("\n"));
await browser.close();

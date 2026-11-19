import { createRequire } from "node:module";
const { chromium } = createRequire((process.env.PW_DIR || "/tmp/pw") + "/")("playwright-core");
const BASE = (process.env.E2E_BASE || "http://localhost:3000/funloom");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote", "--headless=new"] });
const out = [];
const pages = ["/home", "/romance/", "/romance/?createWorld=1", "/library", "/search?q=test", "/asset/details", "/create"];
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
  let status = "";
  try {
    const r = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 60000 });
    status = String(r?.status());
    await page.waitForTimeout(6000);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 90);
    const crash = /Something went wrong|出错了|页面崩溃|Cannot read prop/i.test(text);
    out.push(`${crash || errs.some((e) => e.startsWith("pageerror")) ? "FAIL" : "PASS"}  ${p}  [${status}]  ${text}`);
    errs.filter((e) => !/favicon|401|403|Failed to load resource|net::ERR/.test(e)).slice(0, 4).forEach((e) => out.push("      " + e));
    await page.screenshot({ path: `/tmp/e2e-shot_${p.replace(/[^a-z0-9]/gi, "_")}.png` });
  } catch (e) { out.push(`FAIL  ${p}  ${e.message.slice(0, 160)}`); }
  await page.close();
}
console.log(out.join("\n"));
await browser.close();

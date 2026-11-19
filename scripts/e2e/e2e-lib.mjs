import { createRequire } from "node:module";
const { chromium } = createRequire((process.env.PW_DIR || "/tmp/pw") + "/")("playwright-core");
export const BASE = (process.env.E2E_BASE || "http://localhost:3000/funloom");
export const REPLY = (n = 1) => `樱花落在你肩上。你回头，有人站在三步外，手里攥着文件夹。

「陆知远」：……你挡着路了。

他嘴上这么说，却没有绕开。第${n}回合。

\`\`\`json
{"narrative":"樱花树下的相遇（第${n}回合）","world":{"location":"樱花树下"},
"npc_changes":[{"name":"陆知远","gender":"男","age":"18岁","identity":"学生会长","relation":"学长","bio":"冷淡但温柔的学长","affinity_delta":6,"dims":[{"label":"爱慕","delta":1}],"interaction":"樱花树下相遇","mood":"嘴上嫌弃，其实有点在意"}],
"memory_updates":[{"scope":"main","text":"第${n}回合：主角在樱花树下遇见陆知远","imp":2,"who":["陆知远"]}],
"thoughts":[{"name":"陆知远","text":"她怎么一直看着我。"}],
"options":[{"label":"把花瓣从他肩上拿下来","value":"帮他拿掉花瓣"},{"label":"道歉让路","value":"让路"},{"label":"问他学生会在哪","value":"问路"}]}
\`\`\``;
export async function open({ width = 390, height = 844 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote", "--headless=new"] });
  const ctx = await browser.newContext({ viewport: { width, height } });
  let turn = 0; const calls = [];
  await ctx.route("https://mock.ai/**", async (route) => {
    const req = route.request();
    let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch {}
    calls.push(body);
    if (req.url().includes("/models")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ id: "mock-model" }] }) });
    turn += 1;
    const text = REPLY(turn);
    if (body.stream) {
      const chunks = text.match(/[\s\S]{1,40}/g).map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join("") + "data: [DONE]\n\n";
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: chunks });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ choices: [{ message: { content: text } }] }) });
  });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem("__e2e_init")) {
      localStorage.setItem("xh_ai_config", JSON.stringify({ baseUrl: "https://mock.ai/v1", apiKey: "sk-test", model: "mock-model", models: ["mock-model"], temperature: 0.8, topP: 0.9, stream: true }));
      localStorage.setItem("__e2e_init", "1");
    }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  return { browser, ctx, page, errors, calls };
}
export const buttons = async (page) => (await page.locator("button:visible").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);

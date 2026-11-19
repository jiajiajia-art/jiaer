// 功能注释：模拟一段 AI 回复（正文 + JSON）→ 解析 → 结算好感 / 爱慕 / 选项 / 记忆。运行：node scripts/sim/romance-ai-step.sim.mjs
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
globalThis.sessionStorage = globalThis.localStorage; globalThis.window ??= globalThis; globalThis.location ??= new URL("http://localhost/funloom/romance/");
const server = await createServer({ root: ROOT, configFile: false, logLevel: "silent", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
const L = (p) => server.ssrLoadModule(p);
const out = []; const ok = (n, c, x = "") => out.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`);
try {
  const reg = await L("/Romance/src/mods/registry.ts");
  const ai = await L("/Romance/src/lib/ai.ts");
  const sp = await L("/Romance/src/lib/stepParse.ts");
  const store = await L("/Romance/src/lib/store.ts");
  const mod = { id: "sim_otome2", kind: "world", name: "测试乙女", version: "1.0.0", content: {
    npcs: [{ id: "lu", name: "陆知远", role: "学生会长", gender: "男", age: 18, bio: "冷淡但温柔", kind: "roam", home: "campus", roam: [] }],
    rooms: { campus: { name: "樱花学园", desc: "", exits: {} } }, startRoom: "campus" } };
  reg.beginAuthorPreviewMod(mod);
  let g;
  try { g = store.newGame({ name: "苏晚", age: "17", gender: "女", identity: "转学生", background: "", klass: "", description: "", attrs: [], history: [] }); ok("newGame 建档", !!g?.sim); }
  catch (e) { ok("newGame 建档", false, e.message.slice(0, 200)); }
  const lu = g.npcs.find((n) => n.name === "陆知远");
  ok("开局人物里有可攻略男主", !!lu, g.npcs.map((n) => n.name).join("、"));
  g = { ...g, story: [{ id: "p1", role: "player", segments: [{ kind: "narration", text: "我在樱花树下等他" }] }] };
  const reply = `樱花落在你肩上。你回头，陆知远站在三步外，手里还攥着学生会的文件夹。

「陆知远」：……你挡着路了。

他嘴上这么说，却没有绕开。

\`\`\`json
{"narrative":"樱花树下初遇陆知远","world":{"location":"樱花学园"},
"npc_changes":[{"id":"${lu?.id}","name":"陆知远","affinity_delta":8,"dims":[{"label":"爱慕","delta":2}],"interaction":"在樱花树下与主角初遇","mood":"嘴上嫌弃，其实有点在意"}],
"memory_updates":[{"scope":"main","text":"苏晚在樱花树下初遇陆知远","imp":2,"who":["陆知远"]}],
"thoughts":[{"name":"陆知远","text":"她怎么一直看着我。"}],
"options":[{"label":"把落在他肩上的花瓣拿下来","value":"帮他拿掉花瓣"},{"label":"道歉让路","value":"让路"},{"label":"问他学生会在哪","value":"问路"}]}
\`\`\``;
  const parsed = ai.parseStepDetailed(reply);
  ok("AI 回复解析出状态块", !!parsed.step, parsed.reason ?? "");
  const before = lu ? (g.sim.rel?.[lu.id] ?? lu.affinity ?? 0) : 0;
  const { next, changes } = ai.applyStep(g, parsed.step);
  const luAfter = next.npcs.find((n) => n.id === lu.id);
  ok("好感增加", (next.sim.rel?.[lu.id] ?? luAfter.affinity) > before, changes.filter((c) => /好感|爱慕/.test(c)).join("；"));
  ok("爱慕（心动）独立记账", changes.some((c) => c.includes("爱慕")) || JSON.stringify(next.sim).includes("romantic"), "");
  ok("选项固定 3 个落地", (next.options ?? []).length === 3, (next.options ?? []).map((o) => o.label).join(" / "));
  ok("剧情记忆写入事件线", (next.chronicle ?? []).some((e) => e.text.includes("初遇陆知远")));
  ok("人物心情更新", luAfter.mood?.includes("在意"));
  ok("回合数推进", next.turnCount === g.turnCount + 1, `${g.turnCount} → ${next.turnCount}`);
  reg.endAuthorPreviewMod();
} catch (e) { out.push("ERROR " + (e.stack || e.message).slice(0, 800)); }
console.log(out.join("\n")); await server.close(); process.exit(0);

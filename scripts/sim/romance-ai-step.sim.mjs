import assert from "node:assert/strict";
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
  const status = await L("/Romance/src/lib/liveStatus.ts");
  const optionHeading = "【苏晴】：好久没联系啦。\n\n* （此刻你可以做出的动作——） *";
  const optionProse = optionHeading + "\n\n【1】：回苏晴。\n\n[2]：打开课表。\n\n「3」：坐到琴前。";
  const expectedProse = "【苏晴】：好久没联系啦。";
  assert.equal(ai.displayText(optionProse), expectedProse);
  assert.equal(ai.displayText(optionHeading), expectedProse);
  assert.equal(ai.displayText(optionHeading + "\n【1】：回苏晴。"), expectedProse);
  assert.equal(ai.displayText("他留下纸条。\n- 等我回来"), "他留下纸条。\n- 等我回来");
  assert.equal(ai.proseToSegments("【12】：回苏晴。")[0].kind, "narration");
  assert.deepEqual(ai.withReplyOptions({}, optionProse).options?.map((o) => o.label), ["回苏晴。", "打开课表。", "坐到琴前。"]);
  const structured = { options: [{ label: "保持沉默", value: "沉默" }] };
  assert.equal(ai.withReplyOptions(structured, optionProse), structured);
  assert.deepEqual(status.splitStateRepair(expectedProse + "（状态没写完整，正在补全……）\n"), { text: expectedProse, repairing: true });
  assert.deepEqual(status.splitStateRepair(expectedProse + status.STATE_REPAIR_MARK), { text: expectedProse, repairing: true });
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
  const intro = await L("/Romance/src/game/npcIntro.ts");
  const suspicious = ["有事想", "一句", "没有", "只是需要一个由头", "你现在"];
  const segments = ai.proseToSegments("他没有寒暄，也没有问是谁。只是需要一个由头开口。你现在说。\n【一句】：稍后回你。");
  const step = {
    npc_changes: suspicious.map((name) => ({ name, identity: "初次登场" })),
    scene_memory: { looks: [{ name: "没有", outfit: "西装" }] },
  };
  const rejected = ai.applyStep(g, step).next;
  assert.deepEqual(rejected.npcs.map((n) => n.id), g.npcs.map((n) => n.id));
  assert.deepEqual(intro.withNewcomers(g, rejected, segments, step).ids, []);
  assert.deepEqual(rejected.looks, g.looks);
  ok("旁白、对话标签、穿着和不完整登记均不新建人物", true);

  const firstAppearance = { npc_changes: [{ name: "陈洛", age: "29岁", gender: "男", identity: "记者", bio: "负责本地新闻" }] };
  const registered = ai.applyStep(g, firstAppearance);
  const newcomer = registered.next.npcs.find((n) => n.name === "陈洛");
  assert.ok(newcomer);
  assert.deepEqual(intro.withNewcomers(g, registered.next, ai.proseToSegments("陈洛站在门口。"), firstAppearance).ids, [newcomer.id]);
  ok("完整登记的旁白新人仍触发初遇", true);

  const legacyId = "legacy-artifact";
  const legacy = {
    ...registered.next,
    npcs: [...registered.next.npcs, { ...newcomer, id: legacyId, name: "没有", identity: "初次登场", age: "", bio: "", interactions: [{ text: "本回合在场" }] }],
    story: [{ ...g.story[0], segments, newcomers: [legacyId, newcomer.id] }],
    npcIntro: { [legacyId]: "pending", [newcomer.id]: "pending" },
    sim: { ...registered.next.sim, mobs: { [legacyId]: "campus", [newcomer.id]: "campus" }, metPeople: [legacyId] },
  };
  const cleaned = intro.cleanLegacyNpcArtifacts(legacy);
  assert.ok(!cleaned.npcs.some((n) => n.id === legacyId));
  assert.deepEqual(cleaned.story[0].newcomers, [newcomer.id]);
  assert.equal(cleaned.story[0].segments, segments);
  assert.deepEqual(cleaned.npcIntro, { [newcomer.id]: "pending" });
  assert.deepEqual(cleaned.sim.mobs, { [newcomer.id]: "campus" });
  assert.deepEqual(cleaned.sim.metPeople, []);
  assert.equal(intro.cleanLegacyNpcArtifacts(cleaned), cleaned);
  ok("旧档清理保留剧情和正常人物，可重复读档", true);
  reg.endAuthorPreviewMod();
} catch (e) { out.push("ERROR " + (e.stack || e.message).slice(0, 800)); }
console.log(out.join("\n")); await server.close(); process.exit(out.some((line) => /^(FAIL|ERROR)/.test(line)) ? 1 : 0);

// 功能注释：Romance 完整链路无界面模拟（真实引擎代码经 Vite SSR 加载）。运行：node scripts/sim/romance-plot-loop.sim.mjs
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.window ??= globalThis; globalThis.location ??= new URL("http://localhost/funloom/romance/");
const root = ROOT;
const server = await createServer({ root, configFile: false, logLevel: "silent", appType: "custom", server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
const L = (p) => server.ssrLoadModule(p);
const results = []; const ok = (name, cond, extra = "") => results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
try {
  const reg = await L("/Romance/src/mods/registry.ts");
  const fx = await L("/Romance/src/game/fixedEvents.ts");
  const ai = await L("/Romance/src/lib/ai.ts");
  const mod = {
    id: "sim_otome", kind: "world", name: "测试乙女·樱花学园", version: "1.0.0",
    content: {
      prompt: { scriptTone: "校园恋爱，女主角是转学生，第二人称。" },
      npcs: [{ id: "lu", name: "陆知远", role: "学生会长", gender: "男", age: 18, bio: "冷淡但温柔的学长", kind: "roam", home: "campus", roam: [] }],
      rooms: { campus: { name: "樱花学园", desc: "春日的校园", exits: {} } }, startRoom: "campus",
      fixedEvents: [{ id: "ev_meet", name: "樱花树下的初遇", prompt: "女主在樱花树下撞见陆知远", conds: [] }],
      storylines: [{ id: "main", name: "心动轨迹", desc: "与学长一起完成学园祭筹备", nodes: [
        { id: "n1", name: "初遇学长", conds: [{ kind: "event", key: "ev_meet" }] },
        { id: "n2", name: "关系升温", conds: [{ kind: "rel", key: "lu", op: "gte", value: 30 }] },
      ] }],
      sidelines: [
        { id: "s_club", name: "社团招新", conds: [{ kind: "event", key: "ev_meet" }] },
        { id: "s_timed", name: "限时委托", limitDays: 2, conds: [{ kind: "flag", key: "never", op: "gte", value: 1 }] },
      ],
      endings: [{ id: "he", title: "樱花之约", body: "与陆知远在一起", badge: "HE", auto: true, conds: [{ kind: "quest", key: "main", state: "done" }] }],
    },
  };
  const errs = reg.validateMod(mod);
  ok("作品数据校验通过", !errs.length, errs.join("；"));
  const r = reg.beginAuthorPreviewMod(mod);
  ok("作者预览激活作品", r.ok, r.ok ? "" : r.errors.join("；"));
  ok("当前世界的主线 / 支线 / 结局已加载", reg.getWorldStorylines()?.length === 1 && reg.getWorldSidelines()?.length === 2 && reg.getWorldEndings()?.length === 1);
  const lines = reg.getWorldStorylines(), sides = reg.getWorldSidelines(), ends = reg.getWorldEndings();

  // 回合 0：开局
  let s = { day: 0, week: 1, room: "campus", flags: {}, eventsFired: [], rel: { lu: 0 }, stats: {}, money: 0 };
  ok("开局主线停在第 1 节点", fx.storylineBrief(s, lines).includes("初遇学长"), fx.storylineBrief(s, lines).replace(/\n/g, " ").slice(0, 80));

  // 注入：buildMessages 里有【主线进度】
  const state = { id: "g", player: { name: "苏晚", age: "17", gender: "女", identity: "转学生", background: "", klass: "", description: "", attrs: [], history: [] },
    npcs: [{ id: "lu", name: "陆知远", identity: "学生会长", relation: "学长", affinity: 0, mood: "平静", interactions: [] }],
    world: { time: "第1周", location: "樱花学园" }, sim: s, story: [], memory: "", turnCount: 0, playPrefs: { pov: "2" }, worldBook: [] };
  let msgs = [];
  try { msgs = ai.buildMessages(state, "去樱花树下看看", undefined, { model: "deepseek-chat", focusMainStory: true }); } catch (e) { ok("buildMessages 运行", false, e.message.slice(0, 200)); }
  const all = msgs.map((m) => m.content).join("\n");
  ok("提示词含文风基底预设", all.includes("【文风基底"));
  ok("提示词含主线进度注入", all.includes("【主线进度】") && all.includes("初遇学长"));
  ok("主线注入包含作者填写的整体目标", all.includes("主线目标：与学长一起完成学园祭筹备"));
  ok("玩家输入前提示主线选项与触发边界", msgs.at(-2)?.role === "system" && msgs.at(-2).content.includes("至少留一条当下可做") && msgs.at(-2).content.includes("不提前演出事件"));
  ok("提示词含第二人称提醒", all.includes("【叙事视角 · 本回合必须遵守】") && all.includes("第二人称"));
  ok("提示词含作者系统提示词", all.includes("校园恋爱"));
  ok("提示词含可攻略男主与好感", all.includes("陆知远") && all.includes("好感"));

  // 回合 1：初遇事件触发 → 每回合检查推进主线
  s = { ...s, eventsFired: ["ev_meet"] };
  let st = fx.applyStorylines(s, lines); s = st.next;
  ok("事件触发后主线节点 1 达成", st.changes.some((c) => c.includes("初遇学长")), st.changes.join("；"));
  let sd = fx.applySidelines(s, sides); s = sd.next;
  ok("支线「社团招新」出现并完成", sd.changes.some((c) => c.includes("社团招新」出现")) && sd.changes.some((c) => c.includes("社团招新」完成")), sd.changes.join("；"));
  ok("支线「限时委托」进行中", sd.changes.some((c) => c.includes("限时委托」出现")));
  const brief2 = ai.buildMessages({ ...state, sim: s }, "约他放学一起走").map((m) => m.content).join("\n");
  ok("注入随进度更新到节点 2", brief2.includes("关系升温"));
  ok("进行中支线注入提示词", brief2.includes("【进行中的支线】") && brief2.includes("限时委托"));
  ok("未达成前不触发好结局", !fx.matchCustomEnding(ends, s, true));

  // 回合 2~3：天数推进，限时支线超时
  s = { ...s, day: 2 };
  sd = fx.applySidelines(s, sides); s = sd.next;
  ok("限时支线到期判失败（超时）", sd.changes.some((c) => c.includes("限时委托」失败（超时）")), sd.changes.join("；"));

  // 回合 4：好感达标 → 主线完成 → 达成即落幕结局
  s = { ...s, rel: { lu: 35 } };
  st = fx.applyStorylines(s, lines); s = st.next;
  ok("好感达标主线完成", st.changes.some((c) => c.includes("主线「心动轨迹」完成")), st.changes.join("；"));
  const hit = fx.matchCustomEnding(ends, s, true);
  ok("主线完成后命中 HE 结局（达成即落幕）", hit?.id === "he");
  ok("任务面板主线显示完成后无当前节点", !(await L("/Romance/src/lib/homeMainQuest.ts")).homeMainQuest(s, lines));
  reg.endAuthorPreviewMod();
} catch (e) { results.push("ERROR " + (e.stack || e.message).slice(0, 600)); }
console.log(results.join("\n"));
await server.close();
process.exitCode = results.some((line) => /^(FAIL|ERROR) /.test(line)) ? 1 : 0;

import { loadGlobal, saveGlobal, removeGlobal } from "../lib/saveScope";
import { useEffect, useRef, useState } from "react";
import { completeWithTools, isConfigured, type ChatMsg, type ToolDef } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadConfig } from "../lib/store";
import { exportModJson, importModJson, modTemplate, useMods, validateMod } from "../mods/registry";
import type { Mod, ModContent } from "../mods/types";
import { useConfirm } from "./EditorKit";
import { IconCheck, IconSpark, StatusMark } from "../lib/icons";

/* ═══ AI 创意工坊 ═══
 * 创作者用对话描述世界观，AI 逐步产出「模组补丁」（manifest + 部分 content），
 * 工坊把补丁合并进草稿：数组按 id 合并（同 id 替换），对象浅合并，标量覆盖。
 * 草稿复用 validateMod 校验；可保存为用户模组，或转入模组编辑器手改。 */

type Turn = { role: "user" | "assistant"; text: string; patch?: boolean; diff?: string; bad?: boolean };

/* 两种模式：world = 世界观模组；play = 玩法 Mod（叠加包，追加合并，改玩法不换世界） */
type Mode = "world" | "play";
const LS_OF: Record<Mode, string> = { world: "mod-workshop-draft-v1", play: "mod-workshop-play-v1" };
const loadSaved = (mode: Mode): { draft: Mod; turns: Turn[] } | null => {
  const v = loadGlobal<any>(LS_OF[mode], null); return v?.draft?.content ? v : null;
};

/** 草稿过大时给 AI 结构摘要，避免截断出残缺 JSON 误导模型 */
function draftContext(d: Mod): string {
  const full = JSON.stringify(d);
  if (full.length <= 6000) return full;
  const sum: Record<string, unknown> = { manifest: { id: d.id, name: d.name, description: d.description } };
  for (const [k, v] of Object.entries(d.content)) {
    if (Array.isArray(v)) sum[k] = v.map((x: { id?: string; name?: string; title?: string }) => x?.id ? `${x.id}(${x.name ?? x.title ?? ""})` : "…");
    else if (v && typeof v === "object") { const j = JSON.stringify(v); sum[k] = j.length < 800 ? v : `{键:${Object.keys(v).join(",")}}`; }
    else sum[k] = v;
  }
  return `（草稿较大，以下为结构摘要，未列出的细节保持不变）${JSON.stringify(sum).slice(0, 7000)}`;
}

const parseJson = (t: string) => { try { return JSON.parse(t); } catch { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } };

const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

const STEPS = [
  { label: "剧本基调与世界书", ask: "先帮我写一段完整剧本基调（包含世界设定与叙事口吻），再补几条常驻世界书。" },
  { label: "地图地点", ask: "根据世界观设计 6~10 个地点（rooms，含出口连通）和开局地点。" },
  { label: "NPC", ask: "设计 6~8 个性格鲜明、彼此有关系的 NPC，分布在各个地点。" },
  { label: "人物线路 / 建角", ask: "设计建角页：人物线路 creation.paths 与对应 identities、家庭背景、外形风格。" },
  { label: "事件与世界书", ask: "补充 6 个以上固定事件 / 条件邂逅，以及关键词触发的世界书条目。" },
  { label: "结局", ask: "设计 4~6 个差异明显的结局（endings）。" },
];

const PLAY_STEPS = [
  { label: "新属性", ask: "根据我的玩法想法，设计 2~4 个自定义属性（customAttrs），含上下限、初始值和分档。" },
  { label: "头衔", ask: "设计 6~10 个头衔（titles），条件要用到名气 / 口碑 / 八维 / 自定义属性，难度递进。" },
  { label: "日程玩法", ask: "设计新的培训课程（含自定义等级与解锁条件）、打工档位和周末活动，收益可加自定义属性。" },
  { label: "事件链", ask: "设计一条 4~6 环的事件链（fixedEvents，用 nextIds 串联、locked 锁住后续环），条件和效果绑定属性。" },
  { label: "规则与开关", ask: "给出玩法规则：需要关闭的功能（features）、每周收支（income），以及用 gameRules 组合的条件分歧规则（必要时用规则变量 flag 串联）。" },
  { label: "剧情美化", ask: "按这个世界的剧情设计 3~5 条 lookRules：在关键情境（深夜、高压、热恋、成名、破产等）自动切换外观，说明每条的意图。" },
  { label: "结局", ask: "按新玩法设计 3~5 个结局（endings），与新属性挂钩。" },
  { label: "引擎平衡", ask: "按新玩法调整引擎规则：先在 tuning.modules 勾选需要的模块（dayGrade/work/breach/course/rest/jobPay），再填对应数值；不要预填用不上的现代打工项。必要时用 stats 改八维叫法。说明每项为什么这样调。" },
];

/* 玩法字段说明：玩法 Mod 与世界观对话修改共用 */
const PLAY_FIELDS = `- customAttrs[{id,label,init,initMode?:"fixed|random",min,max,color?:"jade|coral|gold|danger",tiers?:[{min,label}],display?:"num|tier|both",pin?:true,desc?}] 自定义属性（开局勾选固定数值，或不勾在 min～max 随机；须写属性说明 desc）
- titles[{id,name,tier:"青铜|白银|黄金|钻石",req:{键:阈值},desc}] 头衔；req 键可为 fame/reputation/works/awards、"stat:<yanji|geyi|koucai|yitai|donggan|tineng|caizhi|zixin>"、"c:<自定义属性id>"
- trainings[{id,name,effect,gain:{八维键:[min,max]},cgain:{自定义属性id:[min,max]},cost,energy,stress,grades?:[{id,label,costMul,gainMul,cap,stressAdd,needPrev?:上一级需完成次数,reqs?:[{metric,min}]}]}] 课程；metric 写法同上（八维用 "stat:键"，自定义用 "c:id"，其余 fame/reputation/money/stress）
- sideJobs[{id,label,pay,stress,fameReq,note,cgain?,reqs?,needPrev?}] 打工（按顺序成档）；weekendActs[{id,name,effect,icon:"",cost,energy,stress,fame?,reputation?,cgain?,reqs?}]
- bills{weekly:[{label,amount}],monthly:[...],tiers?:[{minFame,label?,weekly?,monthly?}]}（tiers=按名气门槛的生活水准，取已达到的最高一档；未达任何一档用顶层 weekly/monthly）；meals[{id,name,desc,cost:每周伙食费,stress?,gain?:{八维键:每周变化},styling?,reqs?,default?:true}] 饮食生活（玩家每周选吃什么，周日随账单结算）；pregnancy{gestationDays?:孕期天数(默认300),baseChance?:基础受孕率%(25),maxChance?:上限%(50),stressFrom?:压力门槛(50),revealMin?,revealMax?:第几天察觉(14~30),fertilityMin?,fertilityMax?:隐藏生育率区间(20~80),birthStress?,childNames?:[名字不含姓]} 孕育参数（需 features.pregnancy=true）
  说明：数值分档写在 customAttrs[].tiers（多少分叫什么），不要单独写 fameTiers；头衔用 titles[]（玩法 Mod），不要与分档混在养成规则里。
- fixedEvents[{id,name,time?:{kind:"none"}|{kind:"day",day}|{kind:"date",date:"YYYY.MM.DD"},conds?:[{kind:"stat"|"metric",key,op:"gte"|"lte",value}|{kind:"rel",key:npcId,op,value}|{kind:"event",key:事件id}|{kind:"location",key}],prompt:"交给 AI 演绎的事件描述",effects?:[{kind:"stat"|"metric",key,delta}|{kind:"rel",key,delta}],nextIds?:[],once?:true,locked?:true,random?:true}] 事件链；metric 的 key 可为 fame/reputation/stress/energy/money/works 或 "c:自定义属性id"
- income[{id,label,conds?,target:{kind:"metric",key},min,max}] 每周收支（负数=扣除）
- gameRules[{id,name,when:"day"|"week",branches:[{conds:[条件],match?:"all"|"any",effects:[效果],notice?:"给玩家的提示"}],chance?:1~100,once?:true,cooldown?:天}] 玩法规则：分支按序比对命中第一个即执行，conds 为空的分支=「否则」；条件可用 {kind:"flag",key:变量名,op,value}、{kind:"clock",from:"HH:MM",to:"HH:MM"}，效果可用 {kind:"flag",key,delta,set?:true} 写规则变量
- lookRules[{id,name,conds:[条件],match?,look:{mode?:"light|dark",skin?:"dream|bloody|cute|glass|paper",accent?:"fuchsia|plum|rose|gold|cyan|jade|coral|ink",tint?:"#hex",font?:"song|round|elegant|brush",sceneTone?:"none|warm|cool|dusk|vintage|mono",sceneDim?:0~90,sceneBg?:图片URL,dialogStyle?:"soft|avg|letter|glass|minimal",bubbleStyle?:"frost|solid|outline|comic|plain",topbar?:"gradient|aurora|plain",topbarText?,css?}}] 剧情美化：条件满足时临时覆盖外观
- endings[{id,title,desc}]、worldBook[{id,title,keywords,content,enabled:true,constant?}]
- features{industryTab,weeklyPaper,career,imageCrisis,phone,pregnancy,cars,transport: true/false}
- tuning{modules{dayGrade,work,breach,course,rest,jobPay},gradeOdds,gradeMul,luckStat,luckDiv,stressDiv,restStress,trainGainMul,trainFeeMul,jobPayMul,lessonGrades[],gigRules?} 引擎规则（先勾 modules；没写开局不生效；勿预填某一打工剧本数值）
- stats{labels:{八维键:"新叫法"},hidden:[停用的八维键],base:{八维键:初值},range:{八维键:{min,max}},metaLabels:{fame,looks,stress}} 内置八维与名气/容貌/压力的叫法（只写要改的键，会与世界观合并）
- startDate（时间与推进）、startMoney（基础·建角）、weather/startRoom（世界·地点树）、growModules（养成模块勾选）
- terms{fame:"名气的叫法",money:"…",reputation:"…"}、gameRules[]`;

const PLAY_SYS = (draft: Mod, base: string) => `你是文字模拟游戏编辑器的玩法设计师，帮助创作者用对话做「玩法 Mod」。
玩法 Mod 是叠加在世界观「${base}」之上的叠加包（kind: addon，slotMerge: merge）：列表内容按 id 追加，同 id 覆盖原条目，世界观已有内容保留。它不换题材，只改变/扩展玩法。
可用字段（全部可省略，只写需要改的）：
${PLAY_FIELDS}
当前草稿：
${draftContext(draft)}

回复规则：
1. 先用中文简短说明本轮改动了哪些玩法、还想追问什么（不超过 150 字）。
2. 然后输出一个 \`\`\`json 代码块：{"manifest":{"name":"","description":"","id":"小写英文id"},"content":{...本轮新增或修改的字段}}。数组条目必须带 id；删除条目用 content 外的 "remove":{"字段名":["id"]}。
3. 只追问不改动时可不输出代码块。数值要平衡：参考八维 0~999、名气数百、口碑 0~100。`;

const SYS = (draft: Mod) => `你是文字模拟游戏编辑器的模组设计师，帮助创作者用对话做「世界观模组」。
模组是纯 JSON 数据，引擎读取它来替换题材。结构参考模板（字段均可省略）：
${modTemplate("world")}
常用内容：rooms{id:{name,desc,exits:{方向:房间id}}}、startRoom、npcs[{id,name,role,kind,home,roam,bio,gender,age}]、startMet、worldBook[{id,title,keywords,content,enabled,constant}]、prompt{scriptTone}（旧 gmIntro/worldIntro/narratorPersona 会并入）、terms、features(开关)、events/fixedEvents、encounters、endings[{id,title,desc}]、creation、identities、backgrounds、styles、opening、cover。
玩法与数值字段（同样可写进世界观）：
${PLAY_FIELDS}
当前草稿（已有内容，修改时只输出变化的部分）：
${draftContext(draft)}

回复规则：
1. 先用中文简短说明你做了什么、还想追问创作者什么（不超过 150 字）。
2. 然后输出一个 \`\`\`json 代码块，形如 {"manifest":{"name":"","description":"","id":"小写英文id"},"content":{...本轮新增或修改的字段}}。数组条目需带 id，同 id 会替换旧条目；要删除条目时在 content 外加 "remove":{"字段名":["id"]}。
3. 若本轮只是追问、没有改动，可以不输出代码块。所有 id 用小写英文/数字/-_。`;

function mergeContent(base: ModContent, patch: Record<string, unknown>): ModContent {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k];
    if (Array.isArray(v) && Array.isArray(cur) && v.every((x) => x && typeof x === "object" && "id" in x)) {
      const next = [...cur] as { id?: string }[];
      for (const item of v as { id: string }[]) {
        const i = next.findIndex((x) => x?.id === item.id);
        if (i >= 0) next[i] = { ...next[i], ...item }; else next.push(item);
      }
      out[k] = next;
    } else if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      out[k] = { ...(cur as object), ...(v as object) };
    } else out[k] = v;
  }
  return out as ModContent;
}

type Patch = { manifest?: Partial<Mod>; content?: Record<string, unknown>; remove?: Record<string, string[]> };

/* 工具调用：模型直接以结构化参数提交模组补丁 */
const PATCH_TOOL: ToolDef = {
  name: "apply_mod_patch",
  description: "把本轮新增或修改的模组内容合并进草稿。只写变化的字段；数组条目必须带 id，同 id 替换旧条目。只追问、不改动时不要调用。",
  parameters: {
    type: "object",
    properties: {
      manifest: { type: "object", description: "模组信息，只写要改的", properties: { name: { type: "string" }, description: { type: "string" }, id: { type: "string", description: "小写英文 id" } } },
      content: { type: "object", description: "本轮新增或修改的内容字段（结构见系统提示）", additionalProperties: true },
      remove: { type: "object", description: "要删除的条目：{字段名: [id, …]}", additionalProperties: { type: "array", items: { type: "string" } } },
    },
  },
};
const TOOL_RULE = "\n\n若接口支持工具调用：请改为调用 apply_mod_patch 提交改动（参数即上面的 manifest / content / remove），正文只写说明，不要再输出 json 代码块。";

function patchFromText(raw: string): Patch | "bad" | null {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/```(?:json)?\s*([\s\S]*)$/);
  if (!m) return null;
  try { const p = parseJson(m[1].trim()); return p && typeof p === "object" ? p : "bad"; } catch { return "bad"; }
}

function applyPatch(draft: Mod, p: Patch | "bad" | null): Mod | "bad" | null {
  if (p === null || p === "bad") return p;
  if (!p || typeof p !== "object") return "bad";
  const mf = p.manifest ?? {};
  let content = p.content ? mergeContent(draft.content, p.content) : draft.content;
  if (p.remove) {
    const c: Record<string, unknown> = { ...content };
    for (const [k, ids] of Object.entries(p.remove)) {
      const v = c[k];
      if (Array.isArray(v)) c[k] = v.filter((x: { id?: string }) => !ids.includes(x?.id ?? ""));
      else if (v && typeof v === "object") c[k] = Object.fromEntries(Object.entries(v).filter(([id]) => !ids.includes(id)));
    }
    content = c as ModContent;
  }
  const id = typeof mf.id === "string" && /^[a-z0-9][a-z0-9_-]{1,40}$/.test(mf.id) && draft.id.startsWith("ai-") ? mf.id : draft.id;
  return { ...draft, id, name: mf.name || draft.name, description: mf.description ?? draft.description, content };
}

const visible = (t: string) => t.replace(/```(?:json)?[\s\S]*?```/g, "").trim();

const nOf = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);
function tally(m: Mod): [string, number][] {
  const c = m.content;
  return [
    ["世界观", c.prompt ? 1 : 0], ["地点", nOf(c.rooms)], ["人物", nOf(c.npcs)], ["人物线路", nOf(c.creation?.paths)],
    ["事件", nOf(c.events) + nOf(c.fixedEvents) + nOf(c.encounters)], ["世界书", nOf(c.worldBook)], ["结局", nOf(c.endings)], ["平衡", nOf(c.tuning) + nOf(c.stats)],
  ];
}
const counts = (m: Mod) => tally(m).slice(1).map(([k, v]) => `${k} ${v}`).join(" · ");
function diffOf(a: Mod, b: Mod): string {
  const ta = tally(a), tb = tally(b);
  const parts = tb.map(([k, v], i) => (v !== ta[i][1] ? `${k} ${v > ta[i][1] ? "+" : ""}${v - ta[i][1]}` : "")).filter(Boolean);
  if (a.name !== b.name) parts.unshift(`更名「${b.name}」`);
  return parts.join(" · ") || "细节调整";
}
function playDiff(a: Mod, b: Mod): string {
  const ta = playTally(a), tb = playTally(b);
  const parts = tb.map(([k, v], i) => (v !== ta[i][1] ? `${k} ${v > ta[i][1] ? "+" : ""}${v - ta[i][1]}` : "")).filter(Boolean);
  if (a.name !== b.name) parts.unshift(`更名「${b.name}」`);
  return parts.join(" · ") || "细节调整";
}
/** 引导步骤与 tally 对应的下标，用于标记完成 */
const STEP_KEY = [0, 1, 2, 3, 4, 6];

const blank = (mode: Mode = "world", base = "ent"): Mod => mode === "play"
  ? { id: `ai-${Date.now().toString(36)}`, name: "新的玩法 Mod", version: "0.1.0", author: "", description: "", kind: "addon", slotMerge: "merge", dependencies: [base], content: {} }
  : { id: `ai-${Date.now().toString(36)}`, name: "新的世界观", version: "0.1.0", author: "", description: "", kind: "world", dependencies: [], content: {} };

/* 玩法 Mod 的进度统计（对应 PLAY_STEPS） */
function playTally(m: Mod): [string, number][] {
  const c = m.content;
  return [
    ["属性", nOf(c.customAttrs)], ["头衔", nOf(c.titles)], ["日程", nOf(c.trainings) + nOf(c.sideJobs) + nOf(c.weekendActs)],
    ["事件", nOf(c.fixedEvents)], ["规则", nOf(c.features) + nOf(c.income) + nOf(c.gameRules)], ["美化", nOf(c.lookRules)], ["结局", nOf(c.endings)], ["平衡", nOf(c.tuning) + nOf(c.stats)],
  ];
}

export default function ModWorkshop({ onEdit, onClose, target, forceMode, hideModeSwitch }: {
  onEdit: (m: Mod) => void;
  /** 功能注释：savedMod 供平台入口在保存后打 .kkmod；旧调用只收名称仍兼容 */
  onClose: (savedName?: string, savedMod?: Mod) => void;
  target?: { mod: Mod; isNew: boolean };
  /** 功能注释：平台「玩法 Mod」入口锁定玩法对话，禁止切到世界观 */
  forceMode?: Mode;
  hideModeSwitch?: boolean;
}) {
  const { mods, applied } = useMods();
  const [confirm, confirmEl] = useConfirm();
  // 对话修改指定模组：模式跟随模组类型，草稿就是该模组本身，不读写工坊的新建草稿
  const [mode, setMode] = useState<Mode>(() => {
    if (forceMode) return forceMode;
    if (target) return target.mod.kind === "addon" ? "play" : "world";
    return loadGlobal<Mode>("mod-workshop-mode", "world") === "play" ? "play" : "world";
  });
  const [draft, setDraftRaw] = useState<Mod>(() => target?.mod ?? loadSaved(mode)?.draft ?? blank(mode, applied.world));
  const [turns, setTurns] = useState<Turn[]>(() => target
    ? [{ role: "assistant", text: `已载入「${target.mod.name}」。直接告诉我想怎么改，比如「加一个理智值属性，低于 20 触发失控事件」「打工收入减半、休息只减 3 点压力」「再加 5 个头衔」。改完可以保存，或回编辑器手调。` }]
    : loadSaved(mode)?.turns ?? []);
  const play = mode === "play";
  const baseName = mods.find((x) => x.id === (draft.dependencies?.[0] ?? applied.world))?.name ?? "当前世界观";
  // 切换模式：先存当前草稿，再载入另一模式的草稿
  const switchMode = (m: Mode) => {
    if (forceMode || hideModeSwitch) return;
    if (m === mode || busy) return;
    saveGlobal(LS_OF[mode], { draft, turns: turns.slice(-30) });
    saveGlobal("mod-workshop-mode", m);
    const sv = loadSaved(m);
    setMode(m); setHistory([]); setDraftRaw(sv?.draft ?? blank(m, applied.world)); setTurns(sv?.turns ?? []); setErr("");
  };
  const [history, setHistory] = useState<Mod[]>([]);
  const setDraft = (d: Mod) => { setHistory((h) => [...h.slice(-19), draft]); setDraftRaw(d); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory(history.slice(0, -1)); setDraftRaw(prev); setTurns((t) => [...t, { role: "assistant", text: "已撤销上一次改动。" }]); };
  useEffect(() => { if (!target) saveGlobal(LS_OF[mode], { draft, turns: turns.slice(-30) }); }, [draft, turns]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = play ? playTally(draft) : tally(draft);
  const steps = play ? PLAY_STEPS : STEPS;
  const stepKey = play ? [0, 1, 2, 3, 4, 5, 6] : STEP_KEY;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ai = isConfigured(loadConfig());
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  const problems = validateMod(draft);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const cfg = loadConfig();
    if (!isConfigured(cfg)) { setErr("需要先在菜单「AI 配置」里接入模型。"); return; }
    const hist = [...turns, { role: "user", text: t } as Turn];
    setTurns(hist); setInput(""); setBusy(true); setErr(""); setLastFailed(null);
    try {
      const msgs: ChatMsg[] = [{ role: "system", content: play ? PLAY_SYS(draft, baseName) : SYS(draft) }, ...hist.slice(-10).map((x) => ({ role: x.role, content: x.text }))];
      msgs[0] = { ...msgs[0], content: msgs[0].content + TOOL_RULE };
      let r = await completeWithTools(cfg, msgs, [PATCH_TOOL]);
      const pick = (x: typeof r): Patch | "bad" | null => {
        const c = x.calls.find((k) => k.name === PATCH_TOOL.name);
        if (c) return c.args && typeof c.args === "object" ? (c.args as Patch) : "bad";
        return patchFromText(x.text);
      };
      let patch = pick(r);
      // 补丁格式坏了：把错误回给模型，让它自我修正一次
      if (patch === "bad") {
        const fix: ChatMsg[] = [...msgs, { role: "assistant", content: r.text || "（调用了 apply_mod_patch，但参数不是合法 JSON）" }, { role: "user", content: "上一次提交的补丁不是合法 JSON，无法合并。请重新提交同样的改动，保证 JSON 完整、无注释、无尾逗号。" }];
        const r2 = await completeWithTools(cfg, fix, [PATCH_TOOL]);
        const p2 = pick(r2);
        if (p2 && p2 !== "bad") { r = { ...r2, text: r.text || r2.text }; patch = p2; }
      }
      const raw = r.text.trim() || (patch && patch !== "bad" ? "已按要求修改草稿。" : "");
      const patched = applyPatch(draft, patch);
      // 玩法 Mod 始终保持叠加包 + 追加合并，避免 AI 改掉 kind
      const next = patched && patched !== "bad" && (target ? { ...patched, kind: target.mod.kind, id: target.mod.id } : play ? { ...patched, kind: "addon" as const, slotMerge: "merge" as const } : patched) || patched;
      const ok = next && next !== "bad" ? next : null;
      if (ok) setDraft(ok);
      setTurns([...hist, { role: "assistant", text: raw, patch: !!ok, diff: ok ? (play ? playDiff(draft, ok) : diffOf(draft, ok)) : undefined, bad: next === "bad" }]);
    } catch (e) {
      setErr(friendlyAIError(e).text); setLastFailed(t); setTurns(turns);
    } finally { setBusy(false); }
  };

  const loadBase = async (id: string) => {
    if (!id) { setDraft(blank(mode, applied.world)); setTurns([]); return; }
    if (turns.length > 1 && !(await confirm("换起点会替换当前草稿（可撤销），继续吗？", { ok: "继续", danger: false }))) return;
    const src = JSON.parse(exportModJson(id)) as Mod;
    const own = !src.builtin && mods.some((m) => m.id === id && !m.builtin);
    setDraft(own ? src : { ...src, id: `ai-${Date.now().toString(36)}`, name: `${src.name}（改）`, builtin: undefined });
    setTurns([{ role: "assistant", text: `已载入「${src.name}」作为草稿。告诉我想怎么改，比如「加 3 个反派 NPC」「把地图改成民国上海」。` }]);
  };

  const save = () => {
    const r = importModJson(JSON.stringify({ ...draft, builtin: undefined }));
    if (!r.ok) { setErr(r.errors.join("；")); return; }
    if (!target) removeGlobal(LS_OF[mode]);
    onClose(r.mod!.name, r.mod);
  };

  return (
    <div className="flex flex-col gap-2 text-ink">
      {confirmEl}
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 truncate text-[14px] font-bold"><IconSpark size={16} className="shrink-0" />{target ? `对话修改「${target.mod.name}」` : "AI 创意工坊"}</p>
        <button className={btn} onClick={() => onClose()}>返回</button>
      </div>
      {!target && !hideModeSwitch && !forceMode && (
        <div className="inline-flex self-start rounded-full border border-line bg-paper-2 p-0.5 text-[12px] font-bold">
          {([["world", "世界观模组"], ["play", "玩法 Mod"]] as const).map(([k, l]) => (
            <button key={k} disabled={busy} onClick={() => switchMode(k)} className={`rounded-full px-3 py-1 transition ${mode === k ? "bg-jade text-white" : "text-ink-soft hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      )}
      <p className="text-[12px] leading-relaxed text-ink-soft">
        {target
          ? `用聊天直接改这个${target.mod.kind === "addon" ? "叠加包" : "世界观"}：属性、头衔、课程打工、事件链、引擎规则、地点人物……每轮改动都能撤销。${target.isNew ? "这是内置模组的副本，保存后作为你的新模组。" : "保存会覆盖原模组。"}`
          : play
          ? `用聊天描述你想要的玩法改变：新属性、头衔、课程打工、事件链、规则开关、结局……AI 会生成叠加在「${baseName}」上的玩法 Mod，原有内容全部保留。保存后在创意工坊里打开它，开新局生效。`
          : "用聊天描述你想要的世界，AI 会一步步生成模组草稿。满意后保存为你的模组，也可以转到编辑器里逐项手改。"}
      </p>

      {!ai && (
        <div className="rounded-2xl border border-gold/50 bg-gold/10 px-3 py-2.5 text-[12px]">需要接入 AI：请先在菜单「AI 配置」里接入模型，再回来使用工坊。</div>
      )}

      {!target && <label className="flex items-center gap-2 text-[11.5px] text-ink-soft">
        起点
        <select className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade" value="" onChange={(e) => loadBase(e.target.value)}>
          <option value="">从零开始</option>
          {mods.filter((m) => (play ? m.kind === "addon" : true)).map((m) => <option key={m.id} value={m.id}>改造「{m.name}」</option>)}
        </select>
      </label>}

      <div className="rounded-2xl border border-line bg-paper/60 px-3 py-2">
        <p className="flex items-center gap-2 text-[13px] font-bold"><span className="truncate">{draft.name}</span><span className="text-[10.5px] font-normal text-ink-soft">{draft.id}</span></p>
        {draft.description && <p className="mt-0.5 text-[11.5px] text-ink-soft">{draft.description}</p>}
        <p className="mt-1 text-[10.5px] text-ink-soft">{play ? playTally(draft).map(([k, v]) => `${k} ${v}`).join(" · ") : counts(draft)}</p>
        {play && mods.some((x) => x.kind === "world") && (
          <label className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-soft">
            叠加在
            <select className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-0.5 text-[11.5px] text-ink outline-none focus:border-jade" value={draft.dependencies?.[0] ?? applied.world}
              onChange={(e) => setDraft({ ...draft, dependencies: [e.target.value] })}>
              {mods.filter((x) => x.kind === "world").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        )}
        {problems.length > 0 && <p className="mt-1 text-[11px] text-danger">待修正：{problems.slice(0, 3).join("；")}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className={`${btn} !border-transparent bg-jade !text-white`} disabled={problems.length > 0} onClick={save}>{target && !target.isNew ? "保存修改" : "保存为我的模组"}</button>
          <button className={btn} onClick={() => onEdit({ ...draft, builtin: undefined })}>在编辑器里手改</button>
          <button className={btn} disabled={!history.length || busy} onClick={undo}>撤销改动{history.length ? ` (${history.length})` : ""}</button>
          {!target && <button className={btn} disabled={busy} onClick={async () => { if (await confirm("清空草稿和对话，重新开始？", { ok: "重新开始" })) { setDraft(blank(mode, applied.world)); setTurns([]); } }}>重新开始</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          const ok = done[stepKey[i]][1] > 0;
          return <button key={s.label} className={`${btn} ${ok ? "!border-jade/60 !text-jade" : ""}`} disabled={busy || !ai} title={s.ask} onClick={() => send(ok ? `${s.ask}（已有部分内容，请在此基础上补充完善，不要重复已有条目）` : s.ask)}>{ok ? <IconCheck size={12} className="mr-0.5 inline" /> : `${i + 1}. `}{s.label}</button>;
        })}
      </div>

      <div className="max-h-[50vh] min-h-[160px] space-y-2 overflow-y-auto rounded-2xl border border-line bg-paper-2/60 p-3">
        {turns.length === 0 && <p className="text-[12px] leading-relaxed text-ink-soft">{play
          ? "例如：「加一个『心理值』属性，压力太大会掉；心理值低于 20 触发崩溃事件链；新增心理咨询课程，上满 5 次解锁进阶疗程。」或「改成求生玩法：加饥饿和体温属性，每周自动下降，归零就进入坏结局。」"
          : "例如：「做一个民国上海的歌女世界，女主从百乐门伴舞起步，想要权谋和情感线并重。」"}</p>}
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${t.role === "user" ? "bg-jade text-white" : "border border-line bg-paper text-ink"}`}>
              {t.role === "user" ? t.text : visible(t.text) || "（已更新草稿）"}
              {t.patch && <p className="mt-1 text-[10.5px] text-jade"><StatusMark kind="ok">已合并进草稿：{t.diff}</StatusMark></p>}
              {t.bad && <p className="mt-1 text-[10.5px] text-danger">这轮的数据格式没能解析，草稿未改动。可以回复「数据格式有误，请重新输出完整 JSON」。</p>}
            </div>
          </div>
        ))}
        {busy && <p className="text-[12px] text-ink-soft">正在构思…</p>}
        <div ref={endRef} />
      </div>

      {err && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <span>{err}</span>
          {lastFailed && <button className={btn} onClick={() => send(lastFailed)}>重新生成</button>}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={2}
          disabled={!ai}
          placeholder={ai ? (play ? "描述想要的玩法改变…（Enter 发送）" : "描述你的世界，或要修改的地方…（Enter 发送）") : "需要接入 AI"}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink outline-none focus:border-jade"
        />
        <button className="shrink-0 self-end rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40" disabled={busy || !ai || !input.trim()} onClick={() => send(input)}>发送</button>
      </div>
    </div>
  );
}

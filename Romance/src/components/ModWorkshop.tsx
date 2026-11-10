import { loadGlobal, saveGlobal, removeGlobal } from "../lib/saveScope";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { completeWithTools, isConfigured, type ChatMsg, type ToolDef } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadConfig } from "../lib/store";
import { exportModJson, importModJson, modTemplate, useMods, validateMod } from "../mods/registry";
import type { Mod, ModContent } from "../mods/types";
import { healModBeforeSave } from "../lib/modSaveHeal";
import { healNpcListNames } from "../lib/personName";
import { assessAuthorPreview, requestAuthorPreview } from "../lib/authorPreview";
import { useConfirm } from "./EditorKit";
import { IconCheck, IconSpark, StatusMark } from "../lib/icons";
import { PLAY_STEP_KEY, WORLD_STEP_KEY, stepDoneFlag } from "../lib/modWorkshopSteps";
import { attrPromptSpec, auditAttrRefs, auditOk, collectAttrSpecs, describeAudit, copyBaseFile, diffModFiles, filesPromptSpec, materializeOverrides, removeModFile, type FileChange } from "../mods/kkmod/sdk";
import ModAssetsPanel, { FileBadge, fileTitle } from "./ModAssetsPanel";
import ModPreviewPanel from "./ModPreviewPanel";
import { assessAuthorPreview, requestAuthorPreview } from "../lib/authorPreview";
import { OFFICIAL_PLATFORM_APP_IDS, installedPlatformAppIds } from "../lib/phoneAppsConfig";
import { asModArray } from "../lib/asModArray";

/** 功能注释：对话合并后立刻补缺 id / 身份占位姓名，避免顶栏长期红字「缺少 id」且保存按钮灰掉 */
function healWorkshopDraft(mod: Mod): Mod {
  const next: Mod = { ...mod, content: { ...(mod.content ?? {}) } as ModContent };
  if (Array.isArray(next.content.npcs) && next.content.npcs.length) {
    const { npcs } = healNpcListNames(next.content.npcs);
    next.content.npcs = npcs as ModContent["npcs"];
  }
  healModBeforeSave(next.content);
  return next;
}

/* ═══ AI 创意工坊 ═══
 * 创作者用对话描述世界观，AI 逐步产出「模组补丁」（manifest + 部分 content），
 * 工坊把补丁合并进草稿：数组按 id 合并（同 id 替换），对象浅合并，标量覆盖。
 * 草稿复用 validateMod 校验；可保存为用户模组，或转入模组编辑器手改。 */

type Turn = { role: "user" | "assistant"; text: string; patch?: boolean; diff?: string; bad?: boolean; files?: FileChange[] };
type Content = Record<string, unknown>;

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
  { label: "属性 / 建角", ask: "先按世界观设计 2~6 个自定义属性（customAttrs，含说明、范围、初始值与分档），再设计建角页：人物线路 creation.paths 与对应 identities、家庭背景、外形风格，加成写到自定义属性上。" },
  { label: "事件与世界书", ask: "补充 6 个以上固定事件 / 条件邂逅，以及关键词触发的世界书条目。" },
  { label: "结局", ask: "设计 4~6 个差异明显的结局（endings）。" },
];

const PLAY_STEPS = [
  { label: "新属性", ask: "根据我的玩法想法，设计 2~4 个自定义属性（customAttrs），含上下限、初始值和分档。" },
  { label: "头衔", ask: "设计 6~10 个头衔（titles），门槛以自定义属性（\"c:属性id\"）为主，可搭配名气 / 口碑，难度递进。" },
  { label: "日程玩法", ask: "设计新的培训课程（含自定义等级与解锁条件）、打工档位和周末活动，收益一律用 cgain 加到自定义属性上。" },
  { label: "事件链", ask: "设计一条 4~6 环的事件链（fixedEvents，用 nextIds 串联、locked 锁住后续环），条件和效果绑定属性。" },
  { label: "规则与开关", ask: "给出玩法规则：需要关闭的功能（features）、每周收支（income），以及用 gameRules 组合的条件分歧规则（必要时用规则变量 flag 串联）。" },
  { label: "剧情美化", ask: "按这个世界的剧情设计 3~5 条 lookRules：在关键情境（深夜、高压、热恋、成名、破产等）自动切换外观，说明每条的意图。" },
  { label: "结局", ask: "按新玩法设计 3~5 个结局（endings），与新属性挂钩。" },
  { label: "引擎平衡", ask: "按新玩法调整引擎规则：先在 tuning.modules 勾选需要的模块（dayGrade/work/breach/course/rest/jobPay），再填对应数值；不要预填用不上的现代打工项。luckStat 等需要属性的参数填自定义属性。说明每项为什么这样调。" },
];

/* 玩法字段说明：玩法 Mod 与世界观对话修改共用 */
const PLAY_FIELDS = `属性（核心，先定义再引用）：
- customAttrs[{id:小写英文,label,desc,min,max,init,initMode?:"fixed|random",color?:"jade|coral|gold|danger",tiers?:[{min,label}],display?:"num|tier|both",pin?:true}] 自定义属性：开局固定为 init（fixed）或在 min～max 随机（random）；分档写在 tiers；必须写说明 desc
下面所有「属性」都按【属性规范】的写法引用：条件 "c:属性id"、收益 cgain、fx "attr:属性id"。
养成：
- titles[{id,name,tier:"青铜|白银|黄金|钻石",req:{"c:属性id"|fame|reputation|works|awards:阈值},desc}] 头衔
- trainings[{id,name,effect,cgain:{属性id:[min,max]},cost,energy,stress,grades?:[{id,label,costMul,gainMul,cap,stressAdd,needPrev?,reqs?:[{metric:"c:属性id"|内置指标,min}]}]}] 课程
- sideJobs[{id,label,pay,stress,fameReq,note,cgain?,reqs?,needPrev?}] 打工（按顺序成档）；weekendActs[{id,name,effect,icon:"",cost,energy,stress,fame?,reputation?,cgain?,reqs?}] 周末活动
- bills{weekly:[{label,amount}],monthly:[...],tiers?:[{minFame,label?,weekly?,monthly?}]} 生活开销；meals[{id,name,desc,cost,stress?,reqs?,default?:true}] 每周伙食
- pregnancy{gestationDays?,baseChance?,maxChance?,stressFrom?,revealMin?,revealMax?,fertilityMin?,fertilityMax?,birthStress?,childNames?} 孕育参数（需 features.pregnancy=true）
事件与规则：
- fixedEvents[{id,name,time?:{kind:"none"}|{kind:"day",day}|{kind:"date",date:"YYYY.MM.DD"},conds?:[{kind:"metric",key:"c:属性id"|内置指标,op:"gte"|"lte",value}|{kind:"rel",key:npcId,op,value}|{kind:"event",key:事件id}|{kind:"location",key}],prompt:"交给 AI 演绎的事件描述",effects?:[{kind:"metric",key,delta}|{kind:"rel",key,delta}],nextIds?:[],once?:true,locked?:true,random?:true}] 事件链
- income[{id,label,conds?,target:{kind:"metric",key:"c:属性id"|money|…},min,max}] 每周收支（负数=扣除）
- gameRules[{id,name,when:"day"|"week",branches:[{conds:[条件],match?:"all"|"any",effects:[效果],notice?}],chance?:1~100,once?:true,cooldown?:天}] 玩法规则：分支按序命中第一个；conds 为空=「否则」；可用 {kind:"flag",key,op,value}、{kind:"clock",from:"HH:MM",to:"HH:MM"}，效果 {kind:"flag",key,delta,set?:true}
- lookRules[{id,name,conds:[条件],match?,look:{mode?:"light|dark",skin?:"dream|bloody|cute|glass|paper",accent?:"fuchsia|plum|rose|gold|cyan|jade|coral|ink",tint?:"#hex",font?:"song|round|elegant|brush",sceneTone?:"none|warm|cool|dusk|vintage|mono",sceneDim?:0~90,sceneBg?,dialogStyle?:"soft|avg|letter|glass|minimal",bubbleStyle?:"frost|solid|outline|comic|plain",topbar?:"gradient|aurora|plain",topbarText?,css?}}] 剧情美化
- endings[{id,title,desc}]、worldBook[{id,title,keywords,content,enabled:true,constant?}]
系统：
- features{industryTab,weeklyPaper,career,imageCrisis,phone,pregnancy,cars,transport: true/false}
- tuning{modules{dayGrade,work,breach,course,rest,jobPay},gradeOdds,gradeMul,luckStat,luckDiv,stressDiv,restStress,trainGainMul,trainFeeMul,jobPayMul,lessonGrades[],gigRules?} 引擎规则（先勾 modules；勿预填用不上的模块）
- stats{metaLabels:{fame,looks,stress}} 只用于改名气 / 容貌 / 压力的叫法；不要写 stats.labels / base / order（内置八维已停用）
- startDate、startMoney、weather、startRoom、growModules
- terms{fame:"名气的叫法",money:"…",reputation:"…"}`;

const PLAY_SYS = (draft: Mod, base: string, baseAttrs: unknown[] = [], baseContent?: Content) => `你是文字模拟游戏编辑器的玩法设计师，帮助创作者用对话做「玩法 Mod」。
玩法 Mod 是叠加在世界观「${base}」之上的叠加包（kind: addon，slotMerge: merge）：列表内容按 id 追加，同 id 覆盖原条目，世界观已有内容保留。它不换题材，只改变/扩展玩法。
${filesPromptSpec(baseContent, draft.content as Content)}

${attrPromptSpec(collectAttrSpecs(baseAttrs, draft.content.customAttrs))}

可用字段（全部可省略，只写需要改的）：
${PLAY_FIELDS}
当前草稿：
${draftContext(draft)}

回复规则：
1. 先用中文简短说明本轮改动了哪些玩法、还想追问什么（不超过 150 字）。
2. 然后输出一个 \`\`\`json 代码块：{"manifest":{"name":"","description":"","id":"小写英文id"},"content":{...本轮新增或修改的字段}}。数组条目必须带 id；删除条目用 content 外的 "remove":{"字段名":["id"]}。
3. 只追问不改动时可不输出代码块。数值平衡以各属性自己的 min~max 为准；名气数百、口碑 0~100。`;

const SYS = (draft: Mod) => `你是文字模拟游戏编辑器的模组设计师，帮助创作者用对话做「世界观模组」。
模组是纯 JSON 数据，引擎读取它来替换题材。结构参考模板（字段均可省略）：
${modTemplate("world")}
常用内容：rooms{id:{name,desc,exits:{方向:房间id}}}、startRoom、npcs[{id,name,role,kind,home,roam,bio,gender,age}]、startMet、worldBook[{id,title,keywords,content,enabled,constant}]、prompt{scriptTone}（旧 gmIntro/worldIntro/narratorPersona 会并入）、terms、features(开关)、events/fixedEvents、encounters、endings[{id,title,desc}]、creation、identities、backgrounds、styles、opening、cover。
${attrPromptSpec(collectAttrSpecs(draft.content.customAttrs))}

手机应用与已装玩法（对话可直接装 / 卸）：
- phoneAppsCfg[{id}] 本作品手机上装的应用（appId 列表）。官方应用：${OFFICIAL_PLATFORM_APP_IDS.join("、")}；创作者应用用平台 appId（形如 platform:xxx）。安装=追加 {id}；卸载=remove:{"phoneAppsCfg":["appId"]}；写 [] 表示一个都不装。
- playModInstalls[{modId,…}] 本作品已添加的玩法包。卸载=remove:{"playModInstalls":["modId"]}；新增玩法请让作者在「添加玩法」里安装，不要凭空编造 modId。
当前手机应用：${JSON.stringify(installedPlatformAppIds(draft.content.phoneAppsCfg))}；当前玩法：${JSON.stringify(asModArray<{ modId?: string }>(draft.content.playModInstalls).map((x) => x.modId))}

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

function applyPatch(draft: Mod, p: Patch | "bad" | null, baseContent?: Content): Mod | "bad" | null {
  if (p === null || p === "bad") return p;
  if (!p || typeof p !== "object") return "bad";
  const mf = p.manifest ?? {};
  // 功能注释：材质包式覆盖——补丁写到原版已有的条目时，先整份复制原版文件再叠加改动
  // 功能注释：老作品未写 phoneAppsCfg = 默认预装官方应用；对话装 / 卸前先展开，避免装一个就丢掉其余预装
  if ((p.content && "phoneAppsCfg" in p.content || p.remove?.phoneAppsCfg) && draft.content.phoneAppsCfg == null) {
    draft = { ...draft, content: { ...draft.content, phoneAppsCfg: installedPlatformAppIds(undefined).map((id) => ({ id })) } };
  }
  const patchContent = p.content ? materializeOverrides(p.content, draft.content as Content, baseContent) : undefined;
  let content = patchContent ? mergeContent(draft.content, patchContent) : draft.content;
  if (p.remove) {
    const c: Record<string, unknown> = { ...content };
    for (const [k, ids] of Object.entries(p.remove)) {
      const v = c[k];
      // 功能注释：玩法安装记录以 modId 标识，其余条目以 id
      if (Array.isArray(v)) c[k] = v.filter((x: { id?: string; modId?: string }) => !ids.includes(x?.id ?? x?.modId ?? ""));
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
/** 功能注释：玩法空白底默认无依赖；禁止再绑死已删的娱乐圈·星光2005（ent） */
const blank = (mode: Mode = "world", base = ""): Mod => mode === "play"
  ? { id: `ai-${Date.now().toString(36)}`, name: "新的玩法 Mod", version: "0.1.0", author: "", description: "", kind: "addon", slotMerge: "merge", dependencies: base ? [base] : [], content: {} }
  : { id: `ai-${Date.now().toString(36)}`, name: "新的世界观", version: "0.1.0", author: "", description: "", kind: "world", dependencies: [], content: {} };

/* 玩法 Mod 的进度统计（对应 PLAY_STEPS） */
function playTally(m: Mod): [string, number][] {
  const c = m.content;
  return [
    ["属性", nOf(c.customAttrs)], ["头衔", nOf(c.titles)], ["日程", nOf(c.trainings) + nOf(c.sideJobs) + nOf(c.weekendActs)],
    ["事件", nOf(c.fixedEvents)], ["规则", nOf(c.features) + nOf(c.income) + nOf(c.gameRules)], ["美化", nOf(c.lookRules)], ["结局", nOf(c.endings)], ["平衡", nOf(c.tuning) + nOf(c.stats)],
  ];
}

export default function ModWorkshop({ onEdit, onClose, target, forceMode, hideModeSwitch, embedInShell, livePreview }: {
  onEdit: (m: Mod) => void;
  /** 功能注释：savedMod 供平台入口在保存后打 .kkmod；旧调用只收名称仍兼容 */
  onClose: (savedName?: string, savedMod?: Mod) => void;
  target?: { mod: Mod; isNew: boolean };
  /** 功能注释：平台「玩法 Mod」入口锁定玩法对话，禁止切到世界观 */
  forceMode?: Mode;
  hideModeSwitch?: boolean;
  /** 功能注释：嵌在创作壳里时去掉「AI 创意工坊」套娃标题，默认空白叠加底 */
  embedInShell?: boolean;
  /** 功能注释：C2.2 每轮补丁成功后自动刷新真运行时预览；也可手动点「刷新预览」 */
  livePreview?: boolean;
}) {
  const { mods, applied } = useMods();
  const [confirm, confirmEl] = useConfirm();
  // 功能注释：平台壳默认空白底；编辑器内工坊仍可用当前世界作参考，但不得回落 ent
  const defaultPlayBase = embedInShell || forceMode === "play" ? "" : (applied.world && applied.world !== "ent" ? applied.world : "");
  // 对话修改指定模组：模式跟随模组类型，草稿就是该模组本身，不读写工坊的新建草稿
  const [mode, setMode] = useState<Mode>(() => {
    if (forceMode) return forceMode;
    if (target) return target.mod.kind === "addon" ? "play" : "world";
    return loadGlobal<Mode>("mod-workshop-mode", "world") === "play" ? "play" : "world";
  });
  const [draft, setDraftRaw] = useState<Mod>(() => target?.mod ?? loadSaved(mode)?.draft ?? blank(mode, defaultPlayBase));
  const [turns, setTurns] = useState<Turn[]>(() => target
    ? [{ role: "assistant", text: `已载入「${target.mod.name}」。直接告诉我想怎么改，比如「加一个理智值属性，低于 20 触发失控事件」「打工收入减半、休息只减 3 点压力」「再加 5 个头衔」。改动会直接生效。` }]
    : loadSaved(mode)?.turns ?? []);
  const play = mode === "play";
  const depId = draft.dependencies?.[0] || "";
  const baseMod = mods.find((x) => x.id === (depId || applied.world));
  const baseName = depId
    ? (mods.find((x) => x.id === depId)?.name ?? depId)
    : (baseMod?.name ?? "空白叠加底");
  const authorWorlds = mods.filter((x) => x.kind === "world" && !x.builtin && x.id !== "ent");
  // 功能注释：玩法 Mod 可引用底层世界已定义的属性
  const baseAttrs: unknown[] = play ? [baseMod?.content?.customAttrs] : [];
  const baseContent = play ? (baseMod?.content as Content | undefined) : undefined;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<"preview" | "assets">("preview");
  const [playtestIssues, setPlaytestIssues] = useState<string[]>([]);
  // 切换模式：先存当前草稿，再载入另一模式的草稿
  const switchMode = (m: Mode) => {
    if (forceMode || hideModeSwitch) return;
    if (m === mode || busy) return;
    saveGlobal(LS_OF[mode], { draft, turns: turns.slice(-30) });
    saveGlobal("mod-workshop-mode", m);
    const sv = loadSaved(m);
    setMode(m); setHistory([]); setDraftRaw(sv?.draft ?? blank(m, defaultPlayBase)); setTurns(sv?.turns ?? []); setErr("");
  };
  const [history, setHistory] = useState<Mod[]>([]);
  const setDraft = (d: Mod) => { setHistory((h) => [...h.slice(-19), draft]); setDraftRaw(d); };
  const undo = () => { const prev = history[history.length - 1]; if (!prev) return; setHistory(history.slice(0, -1)); setDraftRaw(prev); setTurns((t) => [...t, { role: "assistant", text: "已撤销上一次改动。" }]); };
  useEffect(() => { if (!target) saveGlobal(LS_OF[mode], { draft, turns: turns.slice(-30) }); }, [draft, turns]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = play ? playTally(draft) : tally(draft);
  const steps = play ? PLAY_STEPS : STEPS;
  const stepKey = play ? PLAY_STEP_KEY : WORLD_STEP_KEY;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lastFailed, setLastFailed] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ai = isConfigured(loadConfig());
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  // 功能注释：展示/保存门槛按自愈后的草稿算，与编辑器保存路径一致（worldRules 缺 id 不再拦）
  const problems = validateMod(healWorkshopDraft(draft));

  /** 功能注释：C2.2 用当前草稿挂游戏运行时；致命缺项只提示，不阻断对话 */
  const pushLivePreview = (mod: Mod) => {
    if (!livePreview && !embedInShell) return;
    const healed = healWorkshopDraft(mod);
    const { fatal, warnings } = assessAuthorPreview(healed);
    if (fatal.length) {
      setErr(`预览暂不可用：${fatal.slice(0, 2).join("；")}`);
      return;
    }
    requestAuthorPreview(healed, warnings, window.scrollY || 0);
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const cfg = loadConfig();
    if (!isConfigured(cfg)) { setErr("需要先在菜单「AI 配置」里接入模型。"); return; }
    const hist = [...turns, { role: "user", text: t } as Turn];
    setTurns(hist); setInput(""); setBusy(true); setErr(""); setLastFailed(null);
    try {
      const msgs: ChatMsg[] = [{ role: "system", content: play ? PLAY_SYS(draft, baseName, baseAttrs, baseContent) : SYS(draft) }, ...hist.slice(-10).map((x) => ({ role: x.role, content: x.text }))];
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
      // 功能注释：属性 SDK 审计——引用未定义属性 / 旧八维键时回传模型自我修正一次
      const auditOf = (p: typeof patch) => {
        const m = applyPatch(draft, p, baseContent);
        return m && m !== "bad" ? auditAttrRefs(m.content as Record<string, unknown>, baseAttrs) : null;
      };
      let audit = auditOf(patch);
      if (audit && !auditOk(audit)) {
        const fix: ChatMsg[] = [...msgs, { role: "assistant", content: r.text || "（已调用 apply_mod_patch）" }, { role: "user", content: `补丁不符合属性规范：\n${describeAudit(audit)}\n请重新提交完整的同一份改动：缺的属性写进 customAttrs，旧八维键改成 "c:属性id" 或 cgain。` }];
        const r2 = await completeWithTools(cfg, fix, [PATCH_TOOL]);
        const p2 = pick(r2);
        const a2 = p2 && p2 !== "bad" ? auditOf(p2) : null;
        if (a2 && describeAudit(a2).length < describeAudit(audit).length) { r = { ...r2, text: r.text || r2.text }; patch = p2; audit = a2; }
      }
      const warn = audit && !auditOk(audit) ? `\n\n属性检查：\n${describeAudit(audit)}` : "";
      const raw = (r.text.trim() || (patch && patch !== "bad" ? "已按要求修改草稿。" : "")) + warn;
      const patched = applyPatch(draft, patch, baseContent);
      // 玩法 Mod 始终保持叠加包 + 追加合并，避免 AI 改掉 kind
      const next = patched && patched !== "bad" && (target ? { ...patched, kind: target.mod.kind, id: target.mod.id } : play ? { ...patched, kind: "addon" as const, slotMerge: "merge" as const } : patched) || patched;
      const ok = next && next !== "bad" ? healWorkshopDraft(next) : null;
      if (ok) {
        setDraft(ok);
        if (livePreview || embedInShell) pushLivePreview(ok);
        if (target && !target.isNew) importModJson(JSON.stringify({ ...ok, builtin: undefined }));
      }
      setTurns([...hist, { role: "assistant", text: raw, patch: !!ok, diff: ok ? (play ? playDiff(draft, ok) : diffOf(draft, ok)) : undefined, bad: next === "bad", files: ok ? diffModFiles(draft.content as Content, ok.content as Content, baseContent) : undefined }]);
    } catch (e) {
      setErr(friendlyAIError(e).text); setLastFailed(t); setTurns(turns);
    } finally { setBusy(false); }
  };

  const loadBase = async (id: string) => {
    if (!id) { setDraft(blank(mode, defaultPlayBase)); setTurns([]); return; }
    if (turns.length > 1 && !(await confirm("换起点会替换当前草稿（可撤销），继续吗？", { ok: "继续", danger: false }))) return;
    const src = JSON.parse(exportModJson(id)) as Mod;
    const own = !src.builtin && mods.some((m) => m.id === id && !m.builtin);
    setDraft(own ? src : { ...src, id: `ai-${Date.now().toString(36)}`, name: `${src.name}（改）`, builtin: undefined });
    setTurns([{ role: "assistant", text: `已载入「${src.name}」作为草稿。告诉我想怎么改，比如「加 3 个反派 NPC」「把地图改成民国上海」。` }]);
  };

  const copyFromBase = (path: string) => {
    if (!baseContent) return;
    setDraft({ ...draft, content: copyBaseFile(path, draft.content as Content, baseContent) as ModContent });
    setSelectedFile(path);
  };
  // 功能注释：进入试玩——把当前草稿叠加到世界上真实开一局（作者预览，存档隔离）
  const playtest = () => {
    const { fatal, warnings } = assessAuthorPreview(draft);
    const errs = [...fatal, ...problems];
    setPlaytestIssues(errs);
    if (errs.length) return;
    if (!target) saveGlobal(LS_OF[mode], { draft, turns: turns.slice(-30) });
    requestAuthorPreview({ ...draft, builtin: undefined }, warnings, window.scrollY || 0);
  };
  const removeFile = (path: string) => setDraft({ ...draft, content: removeModFile(path, draft.content as Content) as ModContent });

  const save = () => {
    const healed = healWorkshopDraft({ ...draft, builtin: undefined });
    const r = importModJson(JSON.stringify(healed));
    if (!r.ok) { setErr(r.errors.join("；")); return; }
    if (!target) removeGlobal(LS_OF[mode]);
    onClose(r.mod!.name, r.mod);
  };

  // 功能注释：对话修改已有世界时，关闭弹窗把改动带回表单，避免对话结果丢失
  const back = () => {
    if (!target || !history.length) return onClose();
    if (target.isNew) return onEdit({ ...draft, builtin: undefined });
    importModJson(JSON.stringify({ ...draft, builtin: undefined }));
    onClose(draft.name, draft);
  };

  return (
    <Wrap modal={!!target} onClose={back}>
      {confirmEl}
      {!embedInShell ? (
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1 truncate text-[14px] font-bold"><IconSpark size={16} className="shrink-0" />{target ? `对话修改「${target.mod.name}」` : "AI 创意工坊"}</p>
          <button className={btn} disabled={busy} onClick={() => (target ? back() : onClose())}>{target ? "完成" : "返回"}</button>
        </div>
      ) : null}
      {!target && !hideModeSwitch && !forceMode && (
        <div className="inline-flex self-start rounded-full border border-line bg-paper-2 p-0.5 text-[12px] font-bold">
          {([["world", "世界观模组"], ["play", "玩法 Mod"]] as const).map(([k, l]) => (
            <button key={k} disabled={busy} onClick={() => switchMode(k)} className={`rounded-full px-3 py-1 transition ${mode === k ? "bg-jade text-white" : "text-ink-soft hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      )}
      {!embedInShell ? (
        <p className="text-[12px] leading-relaxed text-ink-soft">
          {target
            ? `用聊天直接改这个${target.mod.kind === "addon" ? "叠加包" : "游戏世界"}：属性、头衔、课程打工、事件链、引擎规则、地点人物……改动会直接生效，每轮都能撤销。${target.isNew ? "这是内置模组的副本，保存后作为你的新模组。" : "保存会覆盖原模组。"}`
            : play
            ? `用聊天描述你想要的玩法改变：新属性、头衔、课程打工、事件链、规则开关、结局……AI 会生成叠加在「${baseName}」上的玩法 Mod，原有内容全部保留。保存后在创意工坊里打开它，开新局生效。`
            : "用聊天描述你想要的世界，AI 会一步步生成模组草稿。满意后保存为你的模组，也可以转到编辑器里逐项手改。"}
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-ink-soft">
          当前叠加底：{baseName}。可先选自己的世界草稿再聊，或保持空白底从零叠加。
        </p>
      )}

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

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-2">
      <div className="rounded-2xl border border-line bg-paper/60 px-3 py-2">
        <p className="flex items-center gap-2 text-[13px] font-bold"><span className="truncate">{draft.name}</span><span className="text-[10.5px] font-normal text-ink-soft">{draft.id}</span></p>
        {draft.description && <p className="mt-0.5 text-[11.5px] text-ink-soft">{draft.description}</p>}
        <p className="mt-1 text-[10.5px] text-ink-soft">{play ? playTally(draft).map(([k, v]) => `${k} ${v}`).join(" · ") : counts(draft)}</p>
        {play && (
          <label className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-soft">
            叠加在
            <select
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-0.5 text-[11.5px] text-ink outline-none focus:border-jade"
              value={depId}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({ ...draft, dependencies: v ? [v] : [] });
              }}
            >
              <option value="">从零开始 / 空白叠加底</option>
              {authorWorlds.length === 0 ? (
                <option value="" disabled>先创作并保存一部游戏世界</option>
              ) : (
                authorWorlds.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)
              )}
            </select>
          </label>
        )}
        {problems.length > 0 && <p className="mt-1 text-[11px] text-danger">待修正：{problems.slice(0, 3).join("；")}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button className={`${btn} !border-transparent bg-jade !text-white`} disabled={problems.length > 0} onClick={save}>{target && !target.isNew ? "保存修改" : "保存为我的模组"}</button>
          {(livePreview || embedInShell) ? (
            <button type="button" className={btn} disabled={busy} onClick={() => pushLivePreview(draft)}>刷新预览</button>
          ) : null}
          {!embedInShell ? <button className={btn} onClick={() => onEdit(healWorkshopDraft({ ...draft, builtin: undefined }))}>在编辑器里手改</button> : null}
          <button className={btn} disabled={!history.length || busy} onClick={undo}>撤销改动{history.length ? ` (${history.length})` : ""}</button>
          {!target && <button className={btn} disabled={busy} onClick={async () => { if (await confirm("清空草稿和对话，重新开始？", { ok: "重新开始" })) { setDraft(blank(mode, defaultPlayBase)); setTurns([]); } }}>重新开始</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => {
          // 功能注释：用 stepDoneFlag，避免 PLAY_STEPS 比 key 表长时读 undefined[1] 整页崩
          const ok = stepDoneFlag(done, stepKey[i]);
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
              {t.files && t.files.length > 0 && (
                <div className="mt-2 border-t border-line pt-1.5">
                  <p className="mb-1 text-[10.5px] font-semibold text-ink-soft">这一轮的产出</p>
                  <div className="flex flex-wrap gap-1">
                    {t.files.slice(0, 12).map((f) => (
                      <button key={f.path} type="button" title={f.path} onClick={() => { setSelectedFile(f.change === "removed" ? null : f.path); setSideTab("assets"); }}
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border border-line bg-paper-2 px-1.5 py-0.5 text-[11px] hover:border-jade">
                        <span className="truncate font-mono">{fileTitle(f.path)}</span>
                        <FileBadge kind={f.change === "added" && f.overridesBase ? "override" : f.change} />
                      </button>
                    ))}
                    {t.files.length > 12 && <span className="text-[10.5px] text-ink-soft">…共 {t.files.length} 个</span>}
                  </div>
                </div>
              )}
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
      <div className="flex min-h-0 flex-col gap-2 lg:sticky lg:top-2 lg:self-start">
        <div className="inline-flex self-start rounded-full border border-line bg-paper-2 p-0.5 text-[12px] font-bold" role="tablist">
          {([["preview", "实时预览"], ["assets", "资产文件"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={sideTab === k} onClick={() => setSideTab(k)}
              className={`rounded-full px-3 py-1 transition ${sideTab === k ? "bg-jade text-white" : "text-ink-soft hover:text-ink"}`}>{l}</button>
          ))}
        </div>
        {sideTab === "preview" ? (
          <div className="rounded-2xl border border-line bg-paper-2/60 p-3">
            <ModPreviewPanel modContent={draft.content as Content} baseContent={baseContent} onPlaytest={play ? playtest : undefined} playtestIssues={playtestIssues} />
          </div>
        ) : (
          <ModAssetsPanel
            modContent={draft.content as Content}
            baseContent={baseContent}
            baseName={baseName}
            selected={selectedFile}
            onSelect={setSelectedFile}
            onCopyBase={play && baseContent ? copyFromBase : undefined}
            onRemove={removeFile}
          />
        )}
      </div>
      </div>
    </Wrap>
  );
}

function Wrap({ modal, onClose, children }: { modal: boolean; onClose: () => void; children: ReactNode }) {
  if (!modal) return <div className="flex flex-col gap-2 text-ink">{children}</div>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-5xl flex-col gap-2 overflow-y-auto rounded-3xl border border-line bg-paper p-4 text-ink shadow-2xl">{children}</div>
    </div>
  );
}

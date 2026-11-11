import { useMemo, useState, type ReactNode } from "react";

/* ═══ 通用可视化数据编辑器 ═══
 * 把任意 JSON 结构（合约 / 项目 / 舆情 / 行业等玩法包的嵌套设定）渲染成表单：
 * 对象 → 字段网格（简单值在前，复杂值折叠在后）；对象数组 → 可增删 / 复制 / 排序 / 搜索的条目卡片；
 * 字符串数组 → 每行一项；数字数组 → 逗号分隔。键名按 LABELS 翻译成中文，未收录的显示原键名。 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

/* 常见键名 → 中文（合约 / 项目 / 舆情 / 行业 / 通用） */
export const DATA_LABELS: Record<string, string> = {
  id: "ID", name: "名称", label: "名称", title: "标题", desc: "说明", blurb: "简介", note: "备注", icon: "图标", tone: "配色", tag: "标签", tags: "标签",
  intro: "引导语", button: "按钮文案", labels: "界面文案", masks: "隐藏信息文案", synopsis: "剧情梗概", source: "来源", category: "类别",
  // 合约
  natures: "通告性质", meta: "通告档位参数", negotiation: "议价规则", signing: "开局候选合约", company: "公司", companyStyle: "公司风格", focusLabel: "主攻方向",
  baseSalary: "底薪（元/月）", revenueShare: "分成比例", penalty: "违约金（元）", exclusive: "独家条款", signBonus: "签约奖金（元）", trust: "信任", reputation: "口碑",
  waitMargin: "等待容差", standbyTrust: "候补信任", snatchChance: "被抢概率", outcomes: "结果", formal: "正式签约", formalMargin: "正式签约容差", downgrade: "降档",
  standby: "候补", standbyBonus: "候补加成", wait: "等待", reject: "拒绝", lowprice: "低价",
  // 项目
  statusLabels: "状态文案", categoryLabels: "类别文案", roleTypeLabels: "角色类型文案", audition: "试镜参数", crash: "片场崩溃", quality: "作品质量",
  workStrategies: "拍摄策略", starThresholds: "星级门槛", releaseDelays: "上映延迟（天）", releaseFame: "上映名气", releaseQBonus: "质量加成", releaseRepBase: "基础口碑",
  growthMain: "主属性成长", growthSub: "副属性成长", publicity: "宣传", buzz: "话题热度", onSet: "片场事件", producer: "制片人", negotiate: "片酬谈判", projects: "项目模板",
  starLevel: "星级", roleType: "角色类型", requirements: "要求", workDayCount: "拍摄天数", openWeek: "开放周", deadlineWeek: "截止周", releaseDelayDays: "上映延迟天数",
  feeYuan: "片酬（元）", feeRange: "片酬区间", advanceRate: "预付比例", breachRate: "违约比例", exclusivityTags: "排他标签", mainStat: "主属性", subStat: "副属性", fit: "契合度",
  followUps: "后续项目", roleSlot: "角色位", competitor: "竞争者", rewardMultiplier: "奖励倍率", baseQuality: "基础质量", managerNpcId: "经纪人 NPC",
  downgradeType: "降级类型", downgradeMultiplier: "降级倍率", prep: "准备", prepBase: "准备基础", baseChance: "基础概率", minChance: "最低概率", maxChance: "最高概率",
  stressGate: "压力门槛", energyGate: "体力门槛", perfPenalty: "表现惩罚", tinengThreshold: "体能门槛", tinengRelief: "体能缓解", friendReliefMin: "好友缓解门槛",
  friendRelief: "好友缓解", datingRelief: "恋人缓解", crashPenalty: "崩溃惩罚", tiers: "分档", min: "下限", max: "上限", payMul: "片酬倍率", growthMul: "成长倍率", rep: "口碑",
  energy: "体力", stress: "压力", floor: "下限", ceil: "上限", fame: "名气", ability: "能力", maxUses: "最多次数", costYuan: "花费（元）", indexPer: "每次热度",
  smallMin: "小爆门槛", smallBonus: "小爆加成", bigMin: "大爆门槛", bigBonus: "大爆加成", triggerChance: "触发概率", byCategory: "按类别", stat: "检定属性",
  threshold: "门槛", pass: "成功", fail: "失败", perf: "表现", meetEnergyCost: "会面体力", questions: "可问问题", reveals: "揭示信息", requires: "前置",
  friendMin: "好友门槛", perFriend: "每位好友", perTrust: "每点信任", raiseRate: "加价比例", partialRate: "部分成功比例", partialBand: "部分成功区间",
  film: "电影", tv: "电视剧", variety: "综艺", music: "音乐", advertising: "广告", stage: "舞台", special: "特别", lead: "主角", support: "配角", guest: "客串", minor: "龙套",
  // 舆情
  unlock: "解锁条件", fanTiers: "粉丝分层", personas: "人设", publicActs: "公开行动", actOutcome: "行动结果", crises: "危机", responses: "公关应对", resolve: "判定权重",
  perFame: "每点名气粉丝", coreFromMatch: "核心粉来自契合", antiPerBlack: "每黑粉", core: "核心粉", casual: "路人粉", anti: "黑粉", audience: "受众", fameGain: "名气收益",
  fits: "契合人设", brandMatch: "品牌契合", controversy: "争议", blackFans: "黑粉", streakBonusEvery: "连续奖励间隔", streakBonusMatch: "连续奖励契合",
  consistent: "人设一致", neutral: "中性", reversal: "人设反转", crisisAtControversy: "争议达到即爆危机", severity: "严重度", baseEvidence: "证据情况",
  voices: "舆论声音", pro: "支持方", con: "反对方", base: "基础值", evidenceSens: "证据敏感", timingSens: "时机敏感", integritySens: "诚信敏感", trustSens: "信任敏感",
  costMoney: "花费（万）", good: "好结果", mixed: "一般结果", bad: "坏结果", weights: "权重", evidence: "证据", timing: "时机", integrity: "诚信",
  timingFastDays: "及时回应天数", goodAt: "好结果线", badBelow: "坏结果线",
  // 行业
  companies: "经纪公司", movies: "影视片名库", ads: "代言品牌库", awards: "奖项", starEvents: "圈内动态", gen: "生成参数", prestige: "声望", boss: "老板",
  style: "风格", quote: "口头禅", bio: "生平", age: "年龄", ceremony: "典礼", gender: "性别", metric: "评比口径", romance: "恋情", rivalry: "竞争", rise: "走红",
  collab: "合作", breakup: "分手", npcCount: "艺人数量", minPerCompany: "每家公司至少", fameMin: "名气下限", fameMax: "名气上限", statMin: "属性下限", statMax: "属性上限",
  debutBaseYear: "出道起始年", debutSpan: "出道跨度（年）", coupleRate: "情侣比例",
};
const lab = (k: string, labels?: Record<string, string>) => labels?.[k] ?? DATA_LABELS[k] ?? k;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const isPrim = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);
const titleOf = (o: Obj, i: number) => String(o.name ?? o.label ?? o.title ?? o.company ?? o.ceremony ?? o.id ?? `第 ${i + 1} 项`);
const subOf = (o: Obj) => { const s = o.desc ?? o.blurb ?? o.note ?? o.synopsis ?? o.category; return typeof s === "string" ? s : ""; };
const freshId = (base: string) => `${base.replace(/_[a-z0-9]{4}$/, "")}_${Math.random().toString(36).slice(2, 6)}`;
/* 新条目模板：沿用第一项的结构，文字清空、数字保留（多为权重 / 倍率，保留更安全），简单列表清空 */
function blankLike(v: Json): Json {
  if (typeof v === "string") return "";
  if (Array.isArray(v)) return v.every(isPrim) ? [] : v.slice(0, 1).map(blankLike);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "id" && typeof x === "string" ? freshId(x || "item") : blankLike(x)]));
  return v;
}

/* 单个简单值 */
function Prim({ k, v, onChange, labels }: { k: string; v: Json; onChange: (v: Json) => void; labels?: Record<string, string> }) {
  const name = lab(k, labels);
  if (typeof v === "boolean") {
    return (
      <label className="flex items-center gap-1.5 text-[11.5px] text-ink">
        <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--jade)]" />{name}
      </label>
    );
  }
  const long = typeof v === "string" && (v.length > 34 || v.includes("\n"));
  return (
    <label className={`block min-w-0 text-[10.5px] text-ink-soft ${long ? "col-span-full" : ""}`} title={k}>
      <span className="mb-0.5 block truncate">{name}</span>
      {typeof v === "number"
        ? <input type="number" className={`${inp} tabular-nums`} value={Number.isFinite(v) ? v : 0} step="any" onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
        : long
          ? <textarea rows={Math.min(6, Math.max(2, Math.ceil(String(v).length / 40)))} className={inp} value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} />
          : <input className={inp} value={v === null ? "" : String(v)} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

/* 简单值列表：字符串每行一项，数字逗号分隔 */
function PrimList({ k, v, onChange, labels }: { k: string; v: Json[]; onChange: (v: Json) => void; labels?: Record<string, string> }) {
  const nums = v.length > 0 && v.every((x) => typeof x === "number");
  const [text, setText] = useState(() => (nums ? v.join(", ") : v.join("\n")));
  return (
    <label className="col-span-full block text-[10.5px] text-ink-soft" title={k}>
      <span className="mb-0.5 block">{lab(k, labels)} <span className="text-ink-soft/70">· {nums ? "逗号分隔" : `每行一项 · ${v.length} 项`}</span></span>
      {nums
        ? <input className={`${inp} tabular-nums`} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(/[,，\s]+/).filter(Boolean).map(Number).filter(Number.isFinite)); }} />
        : <textarea rows={Math.min(8, Math.max(2, v.length))} className={inp} value={text} onChange={(e) => { setText(e.target.value); onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)); }} />}
    </label>
  );
}

/* 对象：简单字段排成网格，复杂字段折叠在下方 */
export function ObjForm({ v, onChange, labels, depth = 0, templates }: { v: Obj; onChange: (v: Obj) => void; labels?: Record<string, string>; depth?: number;
  /** 功能注释：按字段名给对象列表提供条目样板；空列表也能识别为条目列表并按样板新增（玩法包通用模板用） */
  templates?: Record<string, Obj>; }) {
  const entries = Object.entries(v);
  const isObjList = (k: string, x: Json) => Array.isArray(x) && (!!templates?.[k] || !(x as Json[]).every(isPrim));
  const prims = entries.filter(([, x]) => isPrim(x));
  const lists = entries.filter(([k, x]) => Array.isArray(x) && !isObjList(k, x));
  const complex = entries.filter(([k, x]) => !isPrim(x) && !(Array.isArray(x) && !isObjList(k, x)));
  const set = (k: string, x: Json) => onChange({ ...v, [k]: x });
  return (
    <div className="space-y-2">
      {(prims.length > 0 || lists.length > 0) && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3">
          {prims.map(([k, x]) => <Prim key={k} k={k} v={x} labels={labels} onChange={(n) => set(k, n)} />)}
          {lists.map(([k, x]) => <PrimList key={k} k={k} v={x as Json[]} labels={labels} onChange={(n) => set(k, n)} />)}
        </div>
      )}
      {complex.map(([k, x]) => (
        <Fold key={k} title={lab(k, labels)} hint={Array.isArray(x) ? `${x.length} 项` : isObj(x) ? `${Object.keys(x).length} 项设定` : ""} depth={depth}>
          {Array.isArray(x) ? <ObjList v={x as Obj[]} labels={labels} depth={depth + 1} template={templates?.[k]} templates={templates} onChange={(n) => set(k, n)} />
            : <ObjForm v={x as Obj} labels={labels} depth={depth + 1} templates={templates} onChange={(n) => set(k, n)} />}
        </Fold>
      ))}
    </div>
  );
}

function Fold({ title, hint, depth, children, open }: { title: string; hint?: string; depth: number; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`group/f rounded-xl border border-line/70 ${depth % 2 ? "bg-paper" : "bg-paper-2/60"}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5">
        <span className="text-[12px] font-bold text-ink">{title}</span>
        {hint && <span className="text-[10.5px] text-ink-soft">{hint}</span>}
        <span className="ml-auto text-[11px] text-ink-soft transition group-open/f:rotate-90">›</span>
      </summary>
      <div className="border-t border-line/50 px-2.5 py-2">{children}</div>
    </details>
  );
}

const PAGE = 20;
/* 对象数组：条目卡片，可搜索 / 新增 / 复制 / 上下移 / 删除 */
export function ObjList({ v, onChange, labels, depth = 0, addLabel = "＋ 新增一项", template, templates }: { v: Obj[]; onChange: (v: Obj[]) => void; labels?: Record<string, string>; depth?: number; addLabel?: string; template?: Obj; templates?: Record<string, Obj> }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return v.map((o, i) => ({ o, i })).filter(({ o }) => !s || JSON.stringify(o).toLowerCase().includes(s));
  }, [v, q]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const setAt = (i: number, o: Obj) => onChange(v.map((x, j) => (j === i ? o : x)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= v.length) return; const a = [...v]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const dup = (i: number) => { const c = structuredClone(v[i]); if (typeof c.id === "string") c.id = freshId(c.id); if (typeof c.name === "string") c.name = `${c.name}（副本）`; else if (typeof c.label === "string") c.label = `${c.label}（副本）`; const a = [...v]; a.splice(i + 1, 0, c); onChange(a); };
  const add = () => { const base = template ?? v[0]; onChange([...v, base ? (blankLike(base) as Obj) : {}]); setQ(""); setPage(Math.floor(v.length / PAGE)); };
  if (!v.every(isObj)) return <p className="text-[11px] text-ink-soft">（此列表结构较特殊，请用「AI 对话修改」或导出 JSON 编辑）</p>;
  return (
    <div className="space-y-1.5">
      {v.length > 8 && (
        <input className={inp} value={q} placeholder={`在 ${v.length} 项里搜索…`} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
      )}
      {shown.slice(pg * PAGE, pg * PAGE + PAGE).map(({ o, i }) => (
        <details key={i} className={`group/i rounded-lg border border-line/70 ${depth % 2 ? "bg-paper-2/60" : "bg-paper"}`}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5">
            <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-ink-soft">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{titleOf(o, i) || <i className="font-normal text-ink-soft">未命名</i>}
              {subOf(o) && <span className="ml-1.5 font-normal text-ink-soft">{subOf(o)}</span>}</span>
            <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.preventDefault()}>
              <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button type="button" className={btn} disabled={i === v.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
              <button type="button" className={btn} onClick={() => dup(i)}>复制</button>
              <button type="button" className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => onChange(v.filter((_, j) => j !== i))} aria-label="删除">×</button>
            </span>
          </summary>
          <div className="border-t border-line/50 px-2 py-2"><ObjForm v={o} labels={labels} depth={depth + 1} templates={templates} onChange={(n) => setAt(i, n)} /></div>
        </details>
      ))}
      {q && !shown.length && <p className="text-[11px] text-ink-soft">没有匹配「{q}」的条目。</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={btn} onClick={add}>{addLabel}</button>
        {pages > 1 && <>
          <span className="ml-auto text-[10.5px] tabular-nums text-ink-soft">第 {pg + 1} / {pages} 页 · 共 {shown.length} 项</span>
          <button type="button" className={btn} disabled={pg === 0} onClick={() => setPage(pg - 1)}>‹</button>
          <button type="button" className={btn} disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>›</button>
        </>}
      </div>
    </div>
  );
}

/* 整个内容槽的入口：未填写只提示；填写后可移除。不预填、不提供娱乐圈一键载入。 */
export default function SlotDataEditor<T>({ value, onChange, labels, emptyText, note, starter, templates }: {
  value: T | undefined; onChange: (v: T | undefined) => void;
  labels?: Record<string, string>; emptyText: string; note?: ReactNode;
  /** @deprecated 已不再预填内置数据；保留以免旧调用方类型报错 */
  defaults?: () => T;
  /** 功能注释：通用模板（引擎参数 + 空内容列表，不含娱乐圈属性）；提供则空状态可「用通用模板开始」 */
  starter?: () => T;
  /** 功能注释：各对象列表的条目样板（按字段名） */
  templates?: Record<string, Record<string, unknown>>;
}) {
  const tpl = templates as Record<string, Obj> | undefined;
  if (value === undefined) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3 text-center text-[11.5px] text-ink-soft">
        {emptyText}
        {starter && (
          <button type="button" className={`${btn} ml-2`} onClick={() => onChange(starter())}>用通用模板开始</button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {note && <p className="text-[11px] leading-snug text-ink-soft">{note}</p>}
      {isObj(value) ? <ObjForm v={value as Obj} labels={labels} templates={tpl} onChange={(n) => onChange(n as T)} />
        : Array.isArray(value) ? <ObjList v={value as Obj[]} labels={labels} templates={tpl} onChange={(n) => onChange(n as T)} />
        : null}
      <div className="flex flex-wrap gap-1.5 border-t border-line/50 pt-2">
        <button type="button" className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => onChange(undefined)}>移除此项（不再由本模组提供）</button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { takeReopenEditorMod } from "../lib/authorPreview";
import { Chip, SectionHead } from "./ui";
import {
  exportModJson, missingDeps, modTemplate, moveAddon, removeUserMod, replaceAddon,
  selectWorld, selectionProblems, toggleAddon, useMods,
} from "../mods/registry";
import type { Mod } from "../mods/types";
import { ENT_PACK_IDS } from "../mods/entPacks";
import { useGame } from "../store/gameCtx";
import StatsTunePanel from "./StatsTunePanel";
import ModEditorPanel, { blankMod } from "./ModEditorPanel";
import ModWorkshop from "./ModWorkshop";
import { EmptyState, ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { addonImpact, chainShadows, inheritedSlots, priorFor } from "../mods/balance";
import { parseNmod, previewImport, sampleFeatureMod, modDependents, type ImportPreview } from "../mods/nmod";
import { CategoryChip, ModConflicts, ModFeaturePanels, ModCommPanel, ModLogView, ModTools, NmodImportReview, ReversePack, SourceChip, exportNmod } from "./ModCenter";
import { IconPencil, IconSpark, StatusMark } from "../lib/icons";

/* 叠加包对数值的影响，一行摘要：替换 / 覆盖 / 追加 */
function ImpactLine({ m }: { m: Mod }) {
  const imp = addonImpact(m, priorFor(m)).filter((i) => i.numeric);
  if (!imp.length) return <p className="mt-0.5 pl-10 text-[10.5px] text-ink-soft">不改动数值</p>;
  const tone = { replace: "text-coral", merge: "text-gold", add: "text-jade" } as const;
  const verb = { replace: "替换", merge: "覆盖", add: "追加" } as const;
  return (
    <p className="mt-0.5 pl-10 text-[10.5px] leading-relaxed text-ink-soft">
      <span className="font-semibold text-ink">影响数值：</span>
      {imp.map((i, n) => <span key={i.key}>{n > 0 && " · "}<span className={tone[i.op]}>{verb[i.op]}</span> {i.label}<span className="opacity-70">（{i.text}）</span></span>)}
    </p>
  );
}

/* 模组 / 世界观管理：选世界观（新局生效）· 开关叠加包 · 导入导出 JSON · 校验报错 */

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function summary(m: Mod): string {
  const c = m.content;
  const n = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);
  const FEAT: Record<string, string> = { career: "演艺事业", industryTab: "行业页", imageCrisis: "舆情", weeklyPaper: "周报", cars: "座驾", pregnancy: "孕育", transport: "交通", phone: "手机" };
  const on = Object.entries(c.features ?? {}).filter(([k, v]) => v === true && FEAT[k]).map(([k]) => FEAT[k]);
  const off = Object.entries(c.features ?? {}).filter(([k, v]) => v === false && FEAT[k]).length;
  const parts = [
    n(c.rooms) && `地点 ${n(c.rooms)}`, n(c.npcs) && `人物 ${n(c.npcs)}`, n(c.gigs) && `通告 ${n(c.gigs)}`,
    n(c.customAttrs) && `属性 ${n(c.customAttrs)}`, n(c.titles) && `头衔 ${n(c.titles)}`,
    n(c.trainings) && `课程 ${n(c.trainings)}`, n(c.sideJobs) && `打工 ${n(c.sideJobs)}`, n(c.weekendActs) && `周末活动 ${n(c.weekendActs)}`,
    n(c.fixedEvents) + n(c.events) && `事件 ${n(c.fixedEvents) + n(c.events)}`,
    n(c.endings) && `结局 ${n(c.endings)}`, n(c.worldBook) && `世界书 ${n(c.worldBook)}`, n(c.lore) && `地区 ${n(c.lore)}`, n(c.festivals) && `节日 ${n(c.festivals)}`, n(c.income) && `收支 ${n(c.income)}`,
    n(c.meals) && `伙食 ${n(c.meals)} 档`, n(c.bills) && "住行账单", n(c.gigPrices) && "通告价目", n(c.cars) && `座驾 ${n(c.cars)}`,
    c.contracts?.signing?.length && `开局合约 ${c.contracts.signing.length}`, c.projects?.projects?.length && `影视项目 ${c.projects.projects.length}`,
    c.industry?.companies?.length && `经纪公司 ${c.industry.companies.length}`, c.imageCrisis?.crises?.length && `舆情危机 ${c.imageCrisis.crises.length}`,
    n(c.weeklyPaper) && "周报版式", n(c.pregnancy) && "孕育参数",
    n(c.tuning) && "引擎规则", n(c.phoneAppsCfg) && `手机应用 ${n(c.phoneAppsCfg)}`, (n(c.navTabs) || n(c.terms)) && `底栏页签`,
    on.length && `玩法：${on.join("、")}`, off && `关闭 ${off} 项玩法`,
  ].filter(Boolean);
  return parts.join(" · ") || "无内容";
}

/* 「新建玩法 Mod」预设：都是追加合并的叠加包，只预填示例条目 */
const gameplayMod = (name: string, description: string, content: Mod["content"]): Mod => ({ ...blankMod("addon"), name, description, slotMerge: "merge", content });
const GAMEPLAY_PRESETS: { key: string; name: string; desc: string; make: () => Mod }[] = [
  { key: "blank", name: "空白玩法 Mod", desc: "什么都不预填，自己挑区块改", make: () => gameplayMod("", "", {}) },
  { key: "titles", name: "头衔 Mod", desc: "追加新头衔：条件可用名气 / 口碑 / 八维 / 自定义属性", make: () => gameplayMod("我的头衔包", "追加自定义头衔", {
    titles: [{ id: `t_${Date.now().toString(36).slice(-5)}`, name: "新头衔", tier: "白银", req: { fame: 100 }, desc: "名气 ≥ 100" }],
  }) },
  { key: "growth", name: "养成节奏 Mod", desc: "追加课程 / 打工 / 周末活动，可设等级与解锁条件", make: () => gameplayMod("我的养成包", "追加课程与打工", {
    trainings: [{ id: `tr_${Date.now().toString(36).slice(-5)}`, name: "新课程", effect: "", gain: {}, cost: 1000, energy: 6, stress: 1 }],
    sideJobs: [{ id: `sj_${Date.now().toString(36).slice(-5)}`, label: "新打工", pay: 2000, stress: 3, fameReq: 0, note: "" }],
  }) },
];

export default function ModManagerPanel({ inGame = true }: { inGame?: boolean }) {
  const { mods, selection, applied, pending } = useMods();
  const { game, patchGame } = useGame();
  /* 内置玩法扩展包（座驾 / 孕育 / 舆情…）只开关功能、不改地图人物，可对当前局即时生效；
   * 其余叠加包仍然新局生效。写进存档的 addons 后，GameContext 会按存档重新激活组合。 */
  const liveToggle = (id: string) => inGame && !!game && applied.world === "ent" && ENT_PACK_IDS.includes(id);
  const toggle = async (id: string, on: boolean) => {
    // 关闭前检查引用链：其他已启用 MOD / 当前存档仍在调用它时，需要确认
    if (!on) {
      const refs = modDependents(id, inGame ? game : null).filter((x) => !x.startsWith("未启用"));
      if (refs.length && !(await confirm(`关闭后以下调用会失效（条件视为不成立、动作不执行）：\n\n${refs.slice(0, 12).join("\n")}\n\n仍然关闭？`, { ok: "仍然关闭" }))) return;
    }
    toggleAddon(id, on);
    if (!liveToggle(id)) return;
    patchGame((g) => {
      const cur = g.addons ?? applied.addons;
      const addons = on ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id);
      return { ...g, addons, entSplit: true };
    });
    setNotice(`「${mods.find((m) => m.id === id)?.name ?? id}」已${on ? "开启" : "关闭"}，当前局即时生效`);
  };
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [paste, setPaste] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<{ mod: Mod; isNew: boolean; from?: string } | null>(null);
  // 功能注释：从作者预览返回时，用草稿重新打开编辑器（局内进预览会卸掉本面板）
  useEffect(() => {
    const pendingMod = takeReopenEditorMod();
    if (pendingMod) setEditing({ mod: structuredClone(pendingMod), isNew: false });
  }, []);
  const [q, setQ] = useState("");
  const [presetOpen, setPresetOpen] = useState(false);
  // 工坊：true = 新建；{ mod, isNew } = 对话修改指定模组
  const [workshop, setWorkshop] = useState<boolean | { mod: Mod; isNew: boolean }>(false);
  const [confirm, confirmEl] = useConfirm();
  const [review, setReview] = useState<{ p: ImportPreview; warnings: string[] } | null>(null);
  const [tools, setTools] = useState<string | null>(null);
  const hit = (m: Mod) => matches(q, m.name, m.id, m.description, m.author);
  const worlds = mods.filter((m) => m.kind === "world" && hit(m));
  const addons = mods.filter((m) => m.kind === "addon" && hit(m));
  const problems = selectionProblems(selection);
  // 已启用叠加包之间：被后面的包盖掉的改动
  const shadows = chainShadows(selection.addons.map((id) => mods.find((x) => x.id === id)).filter((x): x is Mod => !!x));

  // .nmod（兼容旧 .json）：解析 + 安全清洗 → 审阅依赖 / 冲突 / 增量差异 → 确认后安装
  const doImport = (text: string) => {
    const r = parseNmod(text);
    setErrors(r.errors); setNotice("");
    if (!r.ok || !r.mod) return;
    setReview({ p: previewImport(r.mod), warnings: r.warnings });
    setPaste("");
  };
  const doExport = (m: Mod) => {
    try { exportNmod(JSON.parse(exportModJson(m.id)) as Mod); setNotice(`已导出「${m.name}」.nmod`); }
    catch (e) { setErrors([(e as Error).message]); }
  };
  const toolsBtn = (m: Mod) => <button className={`${btn} ${tools === m.id ? "!border-jade !text-jade" : ""}`} aria-expanded={tools === m.id} onClick={() => setTools(tools === m.id ? null : m.id)}>体检 / 详情</button>;
  const toolsEl = (m: Mod, pad: string) => tools === m.id && <div className={pad}><ModTools m={m} game={inGame ? game : null} patchGame={patchGame} confirm={confirm} onNotice={setNotice} /></div>;
  const guard = (fn: () => void) => { try { setErrors([]); fn(); } catch (e) { setErrors([(e as Error).message]); } };
  const remove = async (m: Mod) => {
    const refs = modDependents(m.id, inGame ? game : null);
    const warn = refs.length ? `\n\n引用链检查：\n${refs.slice(0, 12).join("\n")}${refs.length > 12 ? `\n…共 ${refs.length} 处` : ""}\n这些调用会失效。` : "";
    if (await confirm(`删除模组「${m.name}」？\n只会移除该 MOD 自己的内容与配置，原生内容与其他 MOD 不受影响；已开局的存档不受影响。建议先导出备份。${warn}`, { ok: refs.length ? "仍然删除" : "删除" })) guard(() => removeUserMod(m.id));
  };
  const edit = (m: Mod) => { setErrors([]); setNotice(""); setEditing({ mod: JSON.parse(exportModJson(m.id)) as Mod, isNew: false }); };
  const fork = (m: Mod) => {
    try {
      const src = JSON.parse(exportModJson(m.id)) as Mod;
      let id = `${m.id}-my`, n = 2;
      while (mods.some((x) => x.id === id)) id = `${m.id}-my${n++}`;
      setErrors([]); setNotice("");
      setEditing({ mod: { ...src, id, name: `${m.name}（我的）`, version: "0.1.0", author: "", builtin: undefined }, isNew: true, from: m.id });
    } catch (e) { setErrors([(e as Error).message]); }
  };

  if (workshop && !editing) {
    return (
      <ModWorkshop
        key={typeof workshop === "object" ? workshop.mod.id : "new"}
        target={typeof workshop === "object" ? workshop : undefined}
        onEdit={(m) => { const isNew = typeof workshop === "object" ? workshop.isNew : true; setWorkshop(false); setEditing({ mod: m, isNew }); }}
        onClose={(saved) => { setWorkshop(false); if (saved) { setErrors([]); setNotice(`已保存「${saved}」（在上方选中它，下次开新局生效）`); } }}
      />
    );
  }
  if (editing) {
    return (
      <ModEditorPanel
        key={editing.mod.id}
        initial={editing.mod}
        isNew={editing.isNew}
        onClose={(saved, savedId) => {
          const from = editing.from;
          setEditing(null);
          if (!saved) return;
          setErrors([]);
          // 内置叠加包另存的副本：原包正启用时，直接在原位置换上副本（否则两份同时生效，删掉的条目会被原包补回来）
          const swapped = !!from && !!savedId && savedId !== from && replaceAddon(from, savedId);
          setNotice(swapped ? `已保存「${saved}」，并替换掉内置的「${mods.find((x) => x.id === from)?.name ?? from}」（下次开新局生效）` : `已保存「${saved}」（下次开新局生效）`);
        }}
        onAiChat={(m) => { const isNew = editing.isNew; setEditing(null); setWorkshop({ mod: m, isNew }); }}
      />
    );
  }
  // 对话修改：内置模组先复制一份（内置不可覆盖），用户模组直接改原件
  const aiEdit = (m: Mod) => {
    try {
      const src = JSON.parse(exportModJson(m.id)) as Mod;
      setErrors([]); setNotice("");
      if (!m.builtin) { setWorkshop({ mod: src, isNew: false }); return; }
      let id = `${m.id}-my`, n = 2;
      while (mods.some((x) => x.id === id)) id = `${m.id}-my${n++}`;
      setWorkshop({ mod: { ...src, id, name: `${m.name}（我的）`, version: "0.1.0", author: "", builtin: undefined }, isNew: true });
    } catch (e) { setErrors([(e as Error).message]); }
  };
  const editBtns = (m: Mod) => (
    <>
      {m.builtin
        ? <button className={`${btn} !border-jade/50 !text-jade`} onClick={() => fork(m)} title="内置包不能直接改：会复制一份「我的」副本打开编辑，保存后自动替换原包"><span className="inline-flex items-center gap-1"><IconPencil size={12} /> 可视化编辑</span></button>
        : <button className={btn} onClick={() => edit(m)}>编辑</button>}
      <button className={btn} onClick={() => aiEdit(m)} title={m.builtin ? "复制一份后用聊天修改" : "用聊天修改这个模组"}><span className="inline-flex items-center gap-1"><IconSpark size={14} /> AI 对话修改</span></button>
    </>
  );

  const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

  return (
    <div className="space-y-2 text-ink">
      {confirmEl}
      <ScopeBanner scope="newgame">改动从下一局开始生效，不影响当前存档。</ScopeBanner>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        本游戏是一个可换世界观的引擎：「娱乐圈」只是内置的一个世界观模组。选择的世界观与叠加包在<span className="text-ink">开新局时</span>生效；
        {inGame && "当前局固定使用存档记录的组合（地图、人物、数值与存档数据相互绑定，中途切换会错乱），更改将在下次开新局时生效。内置玩法扩展包（座驾、孕育、舆情等）例外，开关后当前局立即生效。"}
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper/60 px-3 py-2 text-[12px]">
        <span className="text-ink-soft">当前生效：</span>
        <Chip tone="jade">{mods.find((m) => m.id === applied.world)?.name ?? applied.world}</Chip>
        {applied.addons.map((id) => <Chip key={id}>{mods.find((m) => m.id === id)?.name ?? id}</Chip>)}
        {pending && <span className="text-gold">· 有未生效的更改{inGame ? "（下次开新局时生效）" : ""}</span>}
      </div>

      {problems.length > 0 && (
        <ul className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-[12px] text-ink">
          {problems.map((p, i) => <li key={i}><StatusMark kind="warn">{p}</StatusMark></li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="rounded-full bg-jade px-3 py-1 text-[12px] font-bold text-white" onClick={() => setEditing({ mod: blankMod("world"), isNew: true })}>＋ 新建世界观</button>
        <button className="rounded-full bg-jade px-3 py-1 text-[12px] font-bold text-white" aria-expanded={presetOpen} onClick={() => setPresetOpen(!presetOpen)}>＋ 新建玩法 Mod</button>
        <button className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-3 py-1 text-[12px] font-bold text-white" onClick={() => setWorkshop(true)}><IconSpark size={14} /> AI 对话生成模组</button>
      </div>
      {presetOpen && (
        <div className="rounded-2xl border border-jade/40 bg-jade/5 p-3">
          <p className="text-[12px] font-bold text-ink">玩法 Mod：叠加在世界观上，专门调整玩法</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">默认「追加合并」：只加新内容，原世界观的头衔 / 课程 / 打工等都保留。选一个起点，进编辑器后还能改任何区块。</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {GAMEPLAY_PRESETS.map((p) => (
              <button key={p.key} onClick={() => { setPresetOpen(false); setEditing({ mod: p.make(), isNew: true }); }}
                className="rounded-xl border border-line bg-paper px-3 py-2 text-left transition hover:border-jade">
                <span className="block text-[12.5px] font-bold text-ink">{p.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {mods.length > 5 && <SearchBox value={q} onChange={setQ} placeholder="搜索模组名 / id / 简介" count={worlds.length + addons.length} />}

      <SectionHead code="WORLD" cn="世界观" hint="单选 · 一局一个" />
      {worlds.length === 0 && <EmptyState>{q ? `没有匹配「${q}」的世界观。` : "暂无世界观。"}</EmptyState>}
      <div className="space-y-2">
        {worlds.map((m) => {
          const on = selection.world === m.id;
          return (
            <div key={m.id} className={`rounded-2xl border px-3 py-2.5 transition ${on ? "border-jade/60 bg-jade/10" : "border-line bg-paper/50"}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => guard(() => selectWorld(m.id))} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? "border-jade" : "border-line"}`}>
                    {on && <span className="h-2 w-2 rounded-full bg-jade" />}
                  </span>
                  {m.icon && <img src={m.icon} alt="" className="h-6 w-6 shrink-0 rounded-md border border-line object-cover" />}
                  <span className="truncate text-[13.5px] font-bold">{m.name}</span>
                  <span className="text-[10.5px] text-ink-soft">v{m.version}</span>
                  <SourceChip m={m} />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                {editBtns(m)}
                <button className={btn} onClick={() => doExport(m)}>导出 .nmod</button>
                {toolsBtn(m)}
                {!m.builtin && <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => remove(m)}>删除</button>}
              </div>
              {toolsEl(m, "pl-6")}
              {m.description && <p className="mt-1 pl-6 text-[11.5px] text-ink-soft">{m.description}</p>}
              <p className="mt-0.5 pl-6 text-[10.5px] text-ink-soft">{m.author ? `作者 ${m.author} · ` : ""}{summary(m)}</p>
              {(() => { const inh = inheritedSlots(m).filter((x) => x.numeric); return inh.length > 0 && (
                <p className="mt-0.5 pl-6 text-[10.5px] text-gold">沿用娱乐圈数值：{inh.map((x) => x.label).join("、")}</p>
              ); })()}
            </div>
          );
        })}
      </div>

      <SectionHead code="ADDON" cn="叠加包" hint="多选 · 越靠后优先级越高" />
      {addons.length === 0 && <EmptyState>{q ? `没有匹配「${q}」的叠加包。` : "暂无叠加包。点上方「新建叠加包」，或下载模板编辑后导入。"}</EmptyState>}
      <div className="space-y-2">
        {addons.map((m) => {
          const idx = selection.addons.indexOf(m.id);
          const on = idx >= 0;
          const miss = missingDeps(m, { ...selection, addons: on ? selection.addons : [...selection.addons, m.id] });
          return (
            <div key={m.id} className={`rounded-2xl border px-3 py-2.5 ${on ? "border-jade/60 bg-jade/10" : "border-line bg-paper/50"}`}>
              <div className="flex items-center gap-2">
                <button onClick={() => guard(() => toggle(m.id, !on))} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`relative h-4 w-8 shrink-0 rounded-full transition ${on ? "bg-jade" : "bg-line"}`}>
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                  </span>
                  {m.icon && <img src={m.icon} alt="" className="h-6 w-6 shrink-0 rounded-md border border-line object-cover" />}
                  <span className="truncate text-[13.5px] font-bold">{m.name}</span>
                  <span className="text-[10.5px] text-ink-soft">v{m.version}</span>
                  <CategoryChip m={m} />
                  <SourceChip m={m} />
                </button>
                {on && <button className={btn} disabled={idx === 0} onClick={() => moveAddon(m.id, -1)} title="提前">↑</button>}
                {on && <button className={btn} disabled={idx === selection.addons.length - 1} onClick={() => moveAddon(m.id, 1)} title="靠后">↓</button>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-10">
                {editBtns(m)}
                <button className={btn} onClick={() => doExport(m)}>导出 .nmod</button>
                {toolsBtn(m)}
                {!m.builtin && <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => remove(m)}>删除</button>}
              </div>
              {toolsEl(m, "pl-10")}
              {m.description && <p className="mt-1 pl-10 text-[11.5px] text-ink-soft">{m.description}</p>}
              <p className="mt-0.5 pl-10 text-[10.5px] text-ink-soft">{summary(m)}{m.deps?.length ? ` · 依赖 ${m.deps.map((d) => `${d.id}${d.min ? ` ≥${d.min}` : ""}`).join("、")}` : m.dependencies?.length ? ` · 依赖 ${m.dependencies.join("、")}` : ""}{m.nativeDeps?.length ? ` · 需要原生 ${m.nativeDeps.join("、")}` : ""}</p>
              <ImpactLine m={m} />
              {on && shadows[m.id]?.map((t, i) => <p key={i} className="mt-0.5 pl-10 text-[11px] text-gold"><StatusMark kind="warn">{t}</StatusMark></p>)}
              {miss.length > 0 && <p className="mt-0.5 pl-10 text-[11px] text-danger">缺少依赖：{miss.join("、")}（启用后会被跳过）</p>}
            </div>
          );
        })}
      </div>

      <ModConflicts />
      {inGame && game && <ModFeaturePanels game={game} />}

      <StatsTunePanel />

      <SectionHead code="NMOD" cn="导入 / 导出 .nmod" hint="兼容旧版 .json" />
      {review && (
        <NmodImportReview preview={review.p} warnings={review.warnings} onCancel={() => setReview(null)}
          onDone={(msg) => { setReview(null); setErrors([]); setNotice(msg); }} />
      )}
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => fileRef.current?.click()}>从文件导入 .nmod / .json</button>
        <button className={btn} onClick={() => { setErrors([]); setReview({ p: previewImport(sampleFeatureMod()), warnings: [] }); }}>安装示例功能 MOD</button>
        <button className={btn} onClick={() => download("my-world.mod.json", modTemplate("world"))}>下载世界观模板</button>
        <button className={btn} onClick={() => download("my-addon.mod.json", modTemplate("addon"))}>下载叠加包模板</button>
        <input
          ref={fileRef}
          type="file"
          accept=".nmod,.json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            f.text().then(doImport, () => setErrors(["文件读取失败"]));
          }}
        />
      </div>
      <textarea
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder="或在此粘贴模组 JSON …"
        rows={4}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 font-mono text-[11.5px] text-ink outline-none focus:border-jade"
      />
      <button className={btn} disabled={!paste.trim()} onClick={() => doImport(paste)}>导入粘贴内容</button>
      {inGame && game && <ReversePack game={game} />}
      <ModCommPanel />
      <ModLogView />

      {notice && <p className="text-[12px] text-jade"><StatusMark kind="ok">{notice}</StatusMark></p>}
      {errors.length > 0 && (
        <ul className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <li className="font-bold">校验未通过：</li>
          {errors.map((e, i) => <li key={i}>· {e}</li>)}
        </ul>
      )}
    </div>
  );
}

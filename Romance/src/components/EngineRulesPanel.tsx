import { IconClose } from "../lib/icons";
/* 底层世界规则编辑器：判定与标记 / 叙事权限 / 数值与好感 / NPC 行为 / 记忆与知识库 / 素材媒体。
 * 只作用于当前存档；沙盒与酒馆（世界书会话）共用这一套约束。 */
import { useState, type ReactNode } from "react";
import type { BlockWord, CdState, EngineRules, FlagLife, StoryRegex, TextStage } from "../lib/types";
import { useGame } from "../store/gameCtx";
import { KwInput, ScopeBanner, useConfirm } from "./EditorKit";
import { DEFAULT_ENGINE_RULES, ENGINE_SCHEMA, PLACEHOLDERS, importRules, newSeed, resolveRules, safeRegex, syncEngineRules } from "../game/engineRules";
import { auditGame, type AuditReport } from "../game/refAudit";
import { repTier } from "../game/factions";

const box = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";
const num = `${box} w-20 tabular-nums`;
const LIFE: Record<FlagLife, string> = { perm: "永久", temp: "临时", once: "一次性" };
const STAGE: Record<TextStage, string> = { card: "单卡屏蔽词", global: "全局屏蔽词", regex: "正则脚本" };
const ORDERS: TextStage[][] = [["card", "global", "regex"], ["global", "card", "regex"], ["regex", "card", "global"], ["card", "regex", "global"], ["global", "regex", "card"], ["regex", "global", "card"]];
const rid = () => `rx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function Section({ title, desc, children, open }: { title: string; desc: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-paper/80">
      <summary className="flex cursor-pointer list-none items-baseline gap-2 px-3.5 py-3">
        <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="truncate text-[11.5px] text-ink-soft">{desc}</span>
        <span className="ml-auto text-[11px] text-ink-soft transition group-open:rotate-90">›</span>
      </summary>
      <div className="divide-y divide-line border-t border-line px-3.5">{children}</div>
    </details>
  );
}
function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        {hint && <p className="text-[11px] leading-snug text-ink-soft">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition ${on ? "bg-jade" : "bg-line"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
function Num({ v, onChange, min, max, step = 1, label }: { v: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return <input type="number" aria-label={label} className={num} value={v} min={min} max={max} step={step}
    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))); }} />;
}
function Seg<T extends string>({ v, opts, onChange }: { v: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="inline-flex overflow-hidden rounded-lg border border-line">
      {opts.map(([k, l], i) => (
        <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => onChange(k)}
          className={`px-2.5 py-1 text-[12px] transition ${i ? "border-l border-line" : ""} ${v === k ? "bg-ink font-semibold text-paper" : "bg-paper text-ink-soft hover:text-ink"}`}>{l}</button>
      ))}
    </div>
  );
}

export default function EngineRulesPanel() {
  const { game, commitGame } = useGame();
  const [confirm, confirmEl] = useConfirm();
  const [flagKey, setFlagKey] = useState("");
  const [cdNpc, setCdNpc] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [ioMsg, setIoMsg] = useState("");
  if (!game) return null;
  const R = resolveRules(game.engineRules);
  const set = <K extends keyof EngineRules>(k: K, p: Partial<EngineRules[K]>) => {
    const next = { ...game, engineRules: { ...(game.engineRules ?? {}), [k]: { ...R[k], ...p } } };
    syncEngineRules(next);
    commitGame(next);
  };
  const reset = async () => {
    if (!(await confirm("把全部底层规则恢复为默认值？", { danger: true, ok: "恢复默认" }))) return;
    const next = { ...game, engineRules: undefined };
    syncEngineRules(next);
    commitGame(next);
  };
  const npcName = (id: string) => game.npcs.find((n) => n.id === id)?.name ?? id;
  const { flags, random, narrative, affinity, attrs, faction, npc, memory, media, text, ai, interact, save } = R;
  const setBlocked = (list: BlockWord[]) => set("text", { blocked: list });
  const setRegex = (list: StoryRegex[]) => set("text", { regex: list });
  const upload = async (f?: File) => {
    if (!f) return;
    if (f.size > 512 * 1024) { setIoMsg("文件过大（上限 512 KB）"); return; }
    const res = importRules(await f.text());
    if (res.error) { setIoMsg(`导入失败：${res.error}`); return; }
    if (!(await confirm("用文件里的底层规则覆盖当前设置？未包含的项保持默认。", { ok: "导入" }))) return;
    const next = { ...game, engineRules: res.rules };
    syncEngineRules(next);
    commitGame(next);
    setIoMsg("已导入");
  };

  return (
    <div className="space-y-3">
      <ScopeBanner scope="save">底层规则作用于当前存档，切换即时生效；沙盒与酒馆（世界书会话）共用这套约束。</ScopeBanner>

      <Section title="判定与标记" desc="条件引擎 · 标记生命周期 · 随机种子" open>
        <Row label="条件表达式" hint="剧情桥段 / 结局 / 玩法规则的条件里选「（ ）括号子组」：组内可选且 / 或，点「非」整组取反，子组可再嵌套。比较符统一为 ≥ ≤ = > <，另有「持有物品」「标记是否存在」。">
          <span className="text-[11.5px] text-ink-soft">已启用</span>
        </Row>
        <Row label="标记生命周期" hint="未登记的标记一律视为永久。临时 = 对局结束时清除；一次性 = 写下后的下一回合自动清除。">
          <input className={`${box} w-32`} placeholder="标记名" value={flagKey} maxLength={24} onChange={(e) => setFlagKey(e.target.value)} />
          <button type="button" disabled={!flagKey.trim()} onClick={() => { set("flags", { life: { ...flags.life, [flagKey.trim()]: "temp" } }); setFlagKey(""); }}
            className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink disabled:opacity-40">登记</button>
        </Row>
        {Object.entries(flags.life).map(([k, life]) => (
          <Row key={k} label={`「${k}」`}>
            <Seg v={life} opts={(Object.keys(LIFE) as FlagLife[]).map((x) => [x, LIFE[x]])} onChange={(v) => set("flags", { life: { ...flags.life, [k]: v } })} />
            <button type="button" aria-label={`移除 ${k}`} onClick={() => { const life2 = { ...flags.life }; delete life2[k]; set("flags", { life: life2 }); }} className="px-1.5 text-[12px] font-bold text-danger"></button>
          </Row>
        ))}
        <Row label="对局结束清除临时标记" hint="防止临时状态带进下一轮游玩。">
          <Switch label="对局结束清除临时标记" on={flags.clearTempOnEnd} onChange={(v) => set("flags", { clearTempOnEnd: v })} />
        </Row>
        <Row label="标记跨模式共享（高级）" hint="默认沙盒标记与酒馆会话标记互相隔离；开启后两边读写同一套标记池。（已保存，暂未接入运行时）">
          <Switch label="标记跨模式共享" on={flags.shareModes} onChange={(v) => set("flags", { shareModes: v })} />
        </Row>
        <Row label="随机种子" hint="同一种子下，事件概率、刷新与偷听等判定可复现。">
          <Num label="随机种子" v={random.seed} min={0} onChange={(n) => set("random", { seed: Math.round(n) })} />
          <button type="button" onClick={() => set("random", { seed: newSeed() })} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">重置种子</button>
        </Row>
        <Row label="每个地点 / 房间独立种子" hint="开启后各房间的随机序列互不干扰。">
          <Switch label="每房独立种子" on={random.perRoom} onChange={(v) => set("random", { perRoom: v })} />
        </Row>
      </Section>

      <Section title="叙事权限" desc="扮演控制权 · 旁白分层 · OOC">
        <Row label="允许 AI 操控主角行为" hint="默认禁止：AI 不替主角说话、做决定或描写心理。">
          <Switch label="允许 AI 操控主角" on={narrative.aiControlPlayer} onChange={(v) => set("narrative", { aiControlPlayer: v })} />
        </Row>
        <Row label="允许 AI 强制结局 / 替玩家选择" hint="默认禁止：结局只由系统判定。">
          <Switch label="允许 AI 强制结局" on={narrative.aiForceEnding} onChange={(v) => set("narrative", { aiForceEnding: v })} />
        </Row>
        <Row label="旁白分层" hint="玩家动作、角色动作、客观旁白与 OOC 注释分开书写。">
          <Switch label="旁白分层" on={narrative.tagNarration} onChange={(v) => set("narrative", { tagNarration: v })} />
        </Row>
        <Row label="OOC 标记符" hint="以这些符号开头（成对符号需首尾包住）的输入视为场外话，不推进剧情。">
          <KwInput className="w-56" value={narrative.oocMarks} placeholder="如 // 、()" onChange={(v) => set("narrative", { oocMarks: v?.length ? v : DEFAULT_ENGINE_RULES.narrative.oocMarks })} />
        </Row>
      </Section>

      <Section title="数值与好感" desc="沙盒结算；酒馆只把标签当文本提示">
        <Row label="数值运算" hint="关闭 = 酒馆式：AI 给出的好感增减、阵营声望、店铺调价、压力崩溃标记一律不结算，只把标签当文本提示。">
          <Switch label="数值运算" on={attrs.numeric} onChange={(v) => set("attrs", { numeric: v })} />
        </Row>
        <Row label="好感值域" hint="所有 NPC 统一；剧情内置的特殊角色上限不受影响。">
          <Num label="好感下限" v={affinity.min} max={affinity.max - 1} onChange={(n) => set("affinity", { min: Math.round(n) })} />
          <span className="text-[12px] text-ink-soft">~</span>
          <Num label="好感上限" v={affinity.max} min={affinity.min + 1} onChange={(n) => set("affinity", { max: Math.round(n) })} />
        </Row>
        <Row label="超过上限" hint="封顶，或封顶的同时写下隐藏标记「溢出:<人物 id>」供事件判定。">
          <Seg v={affinity.overflow} opts={[["cap", "封顶"], ["flag", "封顶 + 隐藏标记"]]} onChange={(v) => set("affinity", { overflow: v })} />
        </Row>
        <Row label="冷落衰减" hint="久未联系时心情回落；倍数 1 = 世界观默认速率。">
          <Switch label="冷落衰减" on={affinity.decay} onChange={(v) => set("affinity", { decay: v })} />
          <Num label="衰减倍数" v={affinity.decayRate} min={0} max={10} step={0.1} onChange={(n) => set("affinity", { decayRate: n })} />
        </Row>
        <Row label="不衰减的角色" hint="角色层覆盖全局。">
          <span className="flex max-w-80 flex-wrap gap-1">
            {game.npcs.map((n) => { const on = affinity.noDecay.includes(n.id); return (
              <button key={n.id} type="button" aria-pressed={on} onClick={() => set("affinity", { noDecay: on ? affinity.noDecay.filter((x) => x !== n.id) : [...affinity.noDecay, n.id] })}
                className={`rounded-full border px-2 py-0.5 text-[11.5px] transition ${on ? "border-transparent bg-jade text-white" : "border-line bg-paper-2 text-ink-soft"}`}>{n.name}</button>
            ); })}
          </span>
        </Row>
        <Row label="压力崩溃阈值" hint="压力达到阈值时写下标记，事件条件可用「标记是否存在」读取。">
          <Num label="压力阈值" v={attrs.stressLimit} min={1} max={100} onChange={(n) => set("attrs", { stressLimit: Math.round(n) })} />
          <input className={`${box} w-24`} aria-label="崩溃标记名" value={attrs.stressFlag} maxLength={24} onChange={(e) => set("attrs", { stressFlag: e.target.value.trim() })} />
        </Row>
        <Row label="阵营态度档位" hint={`统一为 ${[-80, -40, 0, 40, 80].map(repTier).join(" / ")}（按声望 -100~100 划分）。`}>
          <span className="text-[11.5px] text-ink-soft">固定</span>
        </Row>
        <Row label="声望传播" hint="阵营声望变动时，按立场同步影响同阵营成员的好感。">
          <Switch label="声望传播" on={faction.spread} onChange={(v) => set("faction", { spread: v })} />
        </Row>
      </Section>

      <Section title="NPC 行为" desc="闲聊冷却 · 自主交互 · 漫游">
        <Row label="闲聊冷却（回合）" hint="0 = 不限；冷却中的回应方式见下。">
          <Num label="闲聊冷却" v={npc.chatCd} min={0} max={50} onChange={(n) => set("npc", { chatCd: Math.round(n) })} />
        </Row>
        <Row label="冷却中的回应">
          <Seg<CdState> v={npc.cdState} opts={[["reply", "可回应"], ["named", "仅点名回应"], ["silent", "完全沉默"]]} onChange={(v) => set("npc", { cdState: v })} />
        </Row>
        <Row label="角色单独冷却" hint="覆盖全局冷却回合数，写进给 AI 的底层规则；0 = 此人不受冷却限制。">
          <select className={box} value={cdNpc} onChange={(e) => setCdNpc(e.target.value)} aria-label="选择角色">
            <option value="">（选择角色）</option>
            {game.npcs.filter((n) => !(n.id in npc.cdOverride)).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <button type="button" disabled={!cdNpc} onClick={() => { set("npc", { cdOverride: { ...npc.cdOverride, [cdNpc]: npc.chatCd } }); setCdNpc(""); }} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink disabled:opacity-40">添加</button>
        </Row>
        {Object.entries(npc.cdOverride).map(([id, v]) => (
          <Row key={id} label={npcName(id)}>
            <Num label={`${npcName(id)} 冷却`} v={v} min={0} max={50} onChange={(n) => set("npc", { cdOverride: { ...npc.cdOverride, [id]: Math.round(n) } })} />
            <button type="button" aria-label={`移除 ${npcName(id)}`} onClick={() => { const o = { ...npc.cdOverride }; delete o[id]; set("npc", { cdOverride: o }); }} className="px-1.5 text-[12px] font-bold text-danger"></button>
          </Row>
        ))}
        <Row label="NPC 之间自发对话"><Switch label="NPC 之间自发对话" on={npc.npcTalk} onChange={(v) => set("npc", { npcTalk: v })} /></Row>
        <Row label="NPC 主动靠近 / 搭话主角"><Switch label="NPC 主动搭话" on={npc.approach} onChange={(v) => set("npc", { approach: v })} /></Row>
        <Row label="NPC 行为写入记忆库" hint="关闭后 AI 回传的角色私有记忆不再写入，主线摘要照常。"><Switch label="写入记忆库" on={npc.writeMemory} onChange={(v) => set("npc", { writeMemory: v })} /></Row>
        <Row label="漫游间隔 / 能耗" hint="沙盒：每隔几拍世界心跳才走动一次（1 = 每拍）。能耗：已保存，暂未接入运行时（NPC 没有体力值）。">
          <Num label="漫游间隔" v={npc.roamEvery} min={1} max={30} onChange={(n) => set("npc", { roamEvery: Math.round(n) })} />
          <Num label="漫游能耗" v={npc.roamCost} min={0} max={100} onChange={(n) => set("npc", { roamCost: Math.round(n) })} />
        </Row>
        <Row label="允许跨地点树根漫游" hint="默认禁止：NPC 闲逛时不跨出所在地点树；回常驻地点 / 据点不受此限。">
          <Switch label="跨树根漫游" on={npc.roamCrossRoot} onChange={(v) => set("npc", { roamCrossRoot: v })} />
        </Row>
      </Section>

      <Section title="记忆与知识库" desc="Lorebook / 沙盒长期记忆 / 酒馆会话记忆相互隔离">
        <Row label="三类记忆" hint="Lorebook = 世界书（静态设定，跨房间复用）；沙盒长期记忆 = 主线摘要与 NPC 记忆（随存档）；酒馆会话记忆 = 单房间对话摘要（随会话，可清除）。">
          <span className="text-[11.5px] text-ink-soft">固定隔离</span>
        </Row>
        <Row label="单次最多注入世界书条数" hint="防止一次塞入过多设定挤占上下文。0 = 不限（仍受字数预算约束）。">
          <Num label="最大检索条数" v={memory.loreMax} min={0} max={100} onChange={(n) => set("memory", { loreMax: Math.round(n) })} />
        </Row>
        <Row label="检索排序">
          <Seg v={memory.loreSort} opts={[["keyword", "精准关键词优先"], ["priority", "优先级值优先"]]} onChange={(v) => set("memory", { loreSort: v })} />
        </Row>
        <Row label="世界书跨模式读取" hint="默认关闭。（已保存，暂未接入运行时）">
          <Switch label="世界书跨模式读取" on={memory.loreCrossMode} onChange={(v) => set("memory", { loreCrossMode: v })} />
        </Row>
        <Row label="摘要触发阈值（token）" hint="自上次压缩以来的对话累计到该量，自动压缩为主线记忆。">
          <Num label="摘要阈值" v={memory.summaryTokens} min={200} max={50000} step={100} onChange={(n) => set("memory", { summaryTokens: Math.round(n) })} />
        </Row>
        <Row label="保留完整对话历史" hint="关闭后压缩时只保留最近 8 个回合原文，更早的只存摘要。">
          <Switch label="保留完整历史" on={memory.keepHistory} onChange={(v) => set("memory", { keepHistory: v })} />
        </Row>
      </Section>

      <Section title="素材与媒体" desc="大小 · 格式 · BGM · 表情匹配">
        <Row label="单个素材大小上限（KB）" hint="0 = 不限。">
          <Num label="素材大小上限" v={media.maxKB} min={0} max={102400} step={256} onChange={(n) => set("media", { maxKB: Math.round(n) })} />
        </Row>
        <Row label="图片格式白名单"><KwInput className="w-56" value={media.imgFormats} placeholder="png、jpg…" onChange={(v) => set("media", { imgFormats: (v ?? []).map((x) => x.replace(/^\./, "").toLowerCase()) })} /></Row>
        <Row label="音频格式白名单"><KwInput className="w-56" value={media.audioFormats} placeholder="mp3、ogg…" onChange={(v) => set("media", { audioFormats: (v ?? []).map((x) => x.replace(/^\./, "").toLowerCase()) })} /></Row>
        <Row label="预加载 CG" hint="空闲时预先缓存尚未解锁的 CG（最多 24 张），解锁时立即显示。BGM 为本地单曲播放，无需预加载。"><Switch label="预加载" on={media.preload} onChange={(v) => set("media", { preload: v })} /></Row>
        <Row label="BGM 淡入时长（毫秒）" hint="切歌时音量从 0 渐入。">
          <Num label="淡入时长" v={media.fadeMs} min={0} max={10000} step={100} onChange={(n) => set("media", { fadeMs: Math.round(n) })} />
        </Row>
        <Row label="BGM 允许重叠播放" hint="默认不重叠：同一时间只播放一首。（已保存，暂未接入运行时）">
          <Switch label="BGM 重叠" on={media.overlap} onChange={(v) => set("media", { overlap: v })} />
        </Row>
        <Row label="表情自动触发" hint="（已保存，暂未接入运行时）"><Switch label="表情自动触发" on={media.spriteAuto} onChange={(v) => set("media", { spriteAuto: v })} /></Row>
        <Row label="表情匹配优先级" hint="（已保存，暂未接入运行时）">
          <Seg v={media.spriteMatch} opts={[["exact", "精准关键词 > 情绪标签"], ["emotion", "情绪标签优先"]]} onChange={(v) => set("media", { spriteMatch: v })} />
        </Row>
      </Section>

      <Section title="屏蔽词与正则" desc="作用于 AI 正文与台词（系统提示不受影响）">
        <Row label="执行顺序" hint="三段依次处理，前一段的输出是后一段的输入。">
          <select className={box} aria-label="执行顺序" value={text.order.join(",")} onChange={(e) => set("text", { order: e.target.value.split(",") as TextStage[] })}>
            {ORDERS.map((o) => <option key={o.join(",")} value={o.join(",")}>{o.map((x) => STAGE[x]).join(" → ")}</option>)}
          </select>
        </Row>
        <Row label="全局屏蔽词" hint="优先级大的先处理；同级时长词先处理。替换留空 = 按字数打 *。">
          <button type="button" onClick={() => setBlocked([...text.blocked, { word: "", priority: 0 }])} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">+ 屏蔽词</button>
        </Row>
        {text.blocked.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 py-2">
            <input className={`${box} w-28`} placeholder="屏蔽词" aria-label="屏蔽词" value={b.word} maxLength={40} onChange={(e) => setBlocked(text.blocked.map((x, j) => (j === i ? { ...x, word: e.target.value } : x)))} />
            <span className="text-[12px] text-ink-soft">→</span>
            <input className={`${box} w-24`} placeholder="替换为（可空）" aria-label="替换为" value={b.replace ?? ""} maxLength={40} onChange={(e) => setBlocked(text.blocked.map((x, j) => (j === i ? { ...x, replace: e.target.value || undefined } : x)))} />
            <span className="text-[12px] text-ink-soft">优先级</span>
            <Num label="优先级" v={b.priority} min={-99} max={99} onChange={(n) => setBlocked(text.blocked.map((x, j) => (j === i ? { ...x, priority: Math.round(n) } : x)))} />
            <button type="button" aria-label="删除屏蔽词" onClick={() => setBlocked(text.blocked.filter((_, j) => j !== i))} className="ml-auto px-1.5 text-[12px] font-bold text-danger"><IconClose size={14} /></button>          </div>
        ))}
        <Row label="正则脚本" hint="按列表从上到下执行。过长或含嵌套量词的表达式会被拒绝（防止卡死）。">
          <button type="button" onClick={() => setRegex([...text.regex, { id: rid(), find: "", replace: "", flags: "g", on: true }])} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">+ 正则</button>
        </Row>
        {text.regex.map((x, i) => {
          const bad = !!x.find && !safeRegex(x);
          const up = (p: Partial<StoryRegex>) => setRegex(text.regex.map((y) => (y.id === x.id ? { ...y, ...p } : y)));
          const move = (d: -1 | 1) => { const l = [...text.regex]; const j = i + d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setRegex(l); };
          return (
            <div key={x.id} className="flex flex-wrap items-center gap-1.5 py-2">
              <Switch label="启用正则" on={x.on} onChange={(v) => up({ on: v })} />
              <span className="text-[11px] tabular-nums text-ink-soft">#{i + 1}</span>
              <input className={`${box} w-36 font-mono ${bad ? "!border-danger" : ""}`} placeholder="查找（正则）" aria-label="查找" value={x.find} maxLength={400} onChange={(e) => up({ find: e.target.value })} />
              <input className={`${box} w-10 font-mono`} aria-label="标志" value={x.flags ?? "g"} maxLength={6} onChange={(e) => up({ flags: e.target.value })} />
              <span className="text-[12px] text-ink-soft">→</span>
              <input className={`${box} w-28 font-mono`} placeholder="替换（$1 可引用）" aria-label="替换" value={x.replace} maxLength={200} onChange={(e) => up({ replace: e.target.value })} />
              <span className="ml-auto flex items-center">
                <button type="button" aria-label="上移" disabled={!i} onClick={() => move(-1)} className="px-1.5 text-[12px] text-ink-soft disabled:opacity-30">↑</button>
                <button type="button" aria-label="下移" disabled={i === text.regex.length - 1} onClick={() => move(1)} className="px-1.5 text-[12px] text-ink-soft disabled:opacity-30">↓</button>
                <button type="button" aria-label="删除正则" onClick={() => setRegex(text.regex.filter((y) => y.id !== x.id))} className="px-1.5 text-[12px] font-bold text-danger"><IconClose size={14} /></button>              </span>
              {bad && <p className="w-full text-[11px] text-danger">表达式无效或不安全，不会执行。</p>}
            </div>
          );
        })}
      </Section>

      <Section title="AI 调度" desc="模型路由 · Token 告警 · 占位符 · 群聊裁决">
        <Row label="摘要模型" hint="记忆压缩改用这个模型（同一接口）；留空 = 与剧情同一模型。">
          <input className={`${box} w-44`} placeholder="如 gpt-4o-mini" aria-label="摘要模型" value={ai.summaryModel} maxLength={80} onChange={(e) => set("ai", { summaryModel: e.target.value })} />
        </Row>
        <Row label="Token 告警线" hint="本回合提示词估算超过该值时，在剧情末尾提示。0 = 不提示。">
          <Num label="Token 告警线" v={ai.tokenWarn} min={0} max={1000000} step={1000} onChange={(n) => set("ai", { tokenWarn: Math.round(n) })} />
        </Row>
        <Row label="群聊同回合最多开口角色" hint="同处一地 + 被点名的角色里，最多几位拿到私有知识库并开口。">
          <Num label="最多开口角色" v={ai.maxSpeakers} min={1} max={12} onChange={(n) => set("ai", { maxSpeakers: Math.round(n) })} />
        </Row>
        <Row label="保留占位符" hint={`世界书与人物卡里可写 ${PLACEHOLDERS.map(([k, l]) => `${k}（${l}）`).join("、")}，注入前自动替换。`}>
          <Switch label="保留占位符" on={ai.placeholders} onChange={(v) => set("ai", { placeholders: v })} />
        </Row>
      </Section>

      <Section title="交互解析" desc="选项模式 / 自由 RP 模式">
        <Row label="自由输入" hint="关闭 = 选项模式：只能点选项推进（没有选项时仍可输入，避免卡住）。">
          <Switch label="自由输入" on={interact.freeInput} onChange={(v) => set("interact", { freeInput: v })} />
        </Row>
        <Row label="RP 文本标记识别" hint="*动作* 或「台词」/“台词” 会被标注为玩家动作与玩家台词再交给 AI。">
          <Switch label="RP 标记识别" on={interact.rpMarks} onChange={(v) => set("interact", { rpMarks: v })} />
        </Row>
      </Section>

      <Section title="存档快照" desc="沙盒存档与酒馆会话存档">
        <Row label="沙盒存档" hint="存档槽、自动存档与复盘时间线的检查点都属于沙盒存档，按存档 id 隔离。">
          <span className="text-[11.5px] text-ink-soft">固定</span>
        </Row>
        <Row label="酒馆会话存档独立" hint="酒馆会话快照与沙盒存档分开保存、互不覆盖。（已保存，暂未接入运行时）">
          <Switch label="酒馆会话存档独立" on={save.tavernIsolated} onChange={(v) => set("save", { tavernIsolated: v })} />
        </Row>
      </Section>

      <Section title="工程与校验" desc={`Schema v${ENGINE_SCHEMA} · 导入 · 引用索引 · 循环依赖`}>
        <Row label="导入底层规则" hint={`文件带 Schema 版本号；导入时只保留已知字段与正确类型，拒绝更高版本与不安全的正则。`}>
          <label className="cursor-pointer rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">
            导入
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </Row>
        {ioMsg && <p className="py-2 text-[11.5px] text-ink-soft">{ioMsg}</p>}
        <Row label="引用索引与脏数据检查" hint="扫描剧情桥段、选项、事件链断点、结局、CG 与阵营：失效引用、只读不写的标记、互相等待的循环依赖。">
          <button type="button" onClick={() => setReport(auditGame(game))} className="rounded-lg bg-ink px-2.5 py-1 text-[12px] font-semibold text-paper">运行检查</button>
        </Row>
        {report && (
          <div className="space-y-1.5 py-2.5">
            <p className="text-[11.5px] text-ink-soft">
              共索引 {report.refs.length} 处引用 · {report.issues.filter((x) => x.level === "error").length} 个错误 · {report.issues.filter((x) => x.level === "warn").length} 个提醒
            </p>
            {!report.issues.length && <p className="text-[12.5px] font-medium text-jade">没有发现问题。</p>}
            {report.issues.slice(0, 80).map((x, i) => (
              <p key={i} className={`rounded-lg px-2 py-1.5 text-[12px] leading-snug ${x.level === "error" ? "bg-danger/10 text-danger" : "bg-paper-2 text-ink"}`}>
                <span className="font-semibold">{x.level === "error" ? "错误" : "提醒"}</span>
                {x.from && <span className="text-ink-soft"> · {x.from}</span>}
                <span>：{x.text}</span>
              </p>
            ))}
            {report.issues.length > 80 && <p className="text-[11px] text-ink-soft">仅显示前 80 条。</p>}
          </div>
        )}
      </Section>

      {game.engineRules && (
        <button onClick={reset} className="w-full rounded-xl border border-line py-2 text-[12.5px] font-medium text-ink-soft transition hover:text-ink">恢复默认底层规则</button>
      )}
      {confirmEl}
    </div>
  );
}

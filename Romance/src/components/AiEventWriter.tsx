import { useState } from "react";
import { complete, isConfigured } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadConfig } from "../lib/store";
import type { FixedEvent } from "../lib/types";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { FIXED_METRICS, normFixedTime } from "../game/fixedEvents";
import { LIVE_LOCATIONS, LIVE_PEOPLE, LIVE_ITEMS } from "../mods/registry";
import { IconSpark } from "../lib/icons";

/* 固定事件 · AI 帮写：一句话描述 → AI 产出可直接运行的 FixedEvent（含条件 / 效果 / 事件链），预览确认后加入。 */
const KINDS_COND = new Set(["stat", "metric", "rel", "location", "item", "event", "time", "date", "flag", "clock", "quest"]);
const KINDS_EFF = new Set(["stat", "metric", "rel", "addItem", "removeItem", "unlockLocation", "flag"]);

function sys(existing: FixedEvent[]) {
  const ids = (l: { id: string; name: string }[], n = 40) => l.slice(0, n).map((x) => `${x.id}=${x.name}`).join("，") || "（无）";
  return `你是文字养成游戏的剧本策划，把创作者的描述写成「固定事件」JSON。只输出一个 \`\`\`json 代码块，内容为数组 FixedEvent[]，不要其他文字。
FixedEvent：{"id":"fx_小写英文","name":"事件名","time":{"kind":"none"}|{"kind":"day","day":开局后第N天}|{"kind":"date","date":"YYYY.MM.DD"}|{"kind":"every","days":每隔N天,"start":从第几天起}|{"kind":"weekly","dow":0~6(0=周一)}|{"kind":"monthly","d":每月几号}|{"kind":"yearly","md":"MM.DD"}（后四种为周期事件，每周期上演一次，可重复）,"conds":[条件],"prompt":"交给 AI 演绎的剧情描述（60~200字，写清场景、人物、冲突与走向）","effects":[效果],"nextIds":["后续事件id"],"once":true,"locked":false,"random":false}
条件：{"kind":"stat","key":八维键,"op":"gte"|"lte","value":数}｜{"kind":"metric","key":指标键,"op","value"}｜{"kind":"rel","key":人物id,"op","value"}｜{"kind":"location","key":地点id}｜{"kind":"item","key":物品id}｜{"kind":"event","key":已触发事件id}｜{"kind":"time","unit":"day"|"week"|"month"|"year","op","value"}｜{"kind":"clock","from":"HH:MM","to":"HH:MM"}（当日时段，可跨午夜）｜{"kind":"flag","key":变量名,"op","value"}（规则变量，未写过=0）
效果：{"kind":"stat"|"metric"|"rel","key","delta":数}｜{"kind":"addItem"|"removeItem","key":物品id}｜{"kind":"unlockLocation","key":地点id}｜{"kind":"flag","key":变量名,"delta":数,"set"?:true}（写规则变量，供后续事件 / 规则判定）
事件链：前一环 nextIds 指向后一环，后续环设 "locked":true（被前一环激活后才可触发）。
八维键：${STAT_ORDER.map((k) => `${k}=${STAT_LABELS[k]}`).join("，")}
指标键：${FIXED_METRICS.map((m) => `${m.key}=${m.label}`).join("，")}
人物：${ids(LIVE_PEOPLE)}
地点：${ids(LIVE_LOCATIONS)}
物品：${ids(LIVE_ITEMS, 30)}
已有事件（可在条件 / nextIds 里引用，不要重复 id）：${ids(existing.map((e) => ({ id: e.id, name: e.name })), 60)}
只使用上面列出的键和 id；数值要合理（八维 0~999、口碑 0~100、好感 -100~100）。`;
}

/* 清洗 AI 输出：补 id、丢掉未知种类的条件 / 效果，避免坏数据进存档 */
function sanitize(raw: unknown, taken: Set<string>): FixedEvent[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events) ? (raw as { events: unknown[] }).events : [];
  const out: FixedEvent[] = [];
  const rename = new Map<string, string>();
  for (const x of arr as Partial<FixedEvent>[]) {
    if (!x || typeof x !== "object" || !x.name || !x.prompt) continue;
    let id = typeof x.id === "string" && /^[a-z0-9_-]+$/i.test(x.id) ? x.id : `fx_${Math.random().toString(36).slice(2, 8)}`;
    if (taken.has(id)) { const n = `${id}_${Math.random().toString(36).slice(2, 5)}`; rename.set(id, n); id = n; }
    taken.add(id);
    out.push({
      id, name: String(x.name), prompt: String(x.prompt),
      time: normFixedTime(x.time),
      conds: (x.conds ?? []).filter((c) => c && KINDS_COND.has(c.kind)),
      effects: (x.effects ?? []).filter((e) => e && KINDS_EFF.has(e.kind)),
      nextIds: Array.isArray(x.nextIds) ? x.nextIds.filter((s) => typeof s === "string") : undefined,
      once: x.once ?? true, locked: !!x.locked || undefined, random: !!x.random || undefined,
    });
  }
  // id 被改名时，同批次里的引用一并改
  if (rename.size) for (const e of out) {
    e.nextIds = e.nextIds?.map((i) => rename.get(i) ?? i);
    e.conds = e.conds?.map((c) => (c.kind === "event" && rename.has(c.key) ? { ...c, key: rename.get(c.key)! } : c));
  }
  return out;
}

export default function AiEventWriter({ existing, onAdd }: { existing: FixedEvent[]; onAdd: (list: FixedEvent[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<FixedEvent[] | null>(null);
  const ai = isConfigured(loadConfig());
  const btn = "rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

  const run = async (ask: string) => {
    if (!ask.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const raw = await complete(loadConfig(), [
        { role: "system", content: sys(existing) },
        ...(draft ? [{ role: "assistant" as const, content: "```json\n" + JSON.stringify(draft) + "\n```" }] : []),
        { role: "user", content: draft ? `在上面的基础上修改：${ask}` : ask },
      ]);
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
      const parsed = m ? JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, "$1")) : null;
      const list = sanitize(parsed, new Set(existing.map((e) => e.id)));
      if (!list.length) throw new Error("没有生成可用的事件，换个说法再试一次");
      setDraft(list); setText("");
    } catch (e) {
      setErr(e instanceof SyntaxError ? "AI 返回的格式有误，请重试" : friendlyAIError(e).text || (e as Error).message);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-2 rounded-2xl border border-jade/40 bg-gradient-to-r from-jade/10 to-coral/10 px-4 py-2.5 text-left transition hover:border-jade">
        <span>
          <span className="block text-[13px] font-bold text-ink">AI 帮写固定事件</span>
          <span className="block text-[11.5px] text-ink-soft">一句话描述，自动生成触发条件、数值变化和事件链</span>
        </span>
        <span className="shrink-0 text-[12px] font-bold text-jade">打开 ›</span>
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-jade/40 bg-jade/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-ink">AI 帮写固定事件</p>
        <button className="text-[12px] text-ink-soft hover:text-ink" onClick={() => { setOpen(false); setDraft(null); setErr(""); }}>收起</button>
      </div>
      {!ai && <p className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-[12px]">需要接入 AI：请先在菜单「AI 配置」里接入模型。</p>}
      <textarea rows={3} value={text} disabled={!ai || busy} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(text); }}
        placeholder={draft ? "继续调整，如：第二环改成在片场发生，好感门槛降到 30" : "例如：口碑跌破 30 时，经纪人约主角深夜谈话，之后连着三周触发「危机公关」事件链，每环处理得好口碑 +5"}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink outline-none focus:border-jade" />
      <div className="flex flex-wrap gap-1.5">
        <button className={`${btn} !border-transparent bg-jade !text-white`} disabled={!ai || busy || !text.trim()} onClick={() => run(text)}>{busy ? "生成中…" : draft ? "按要求修改" : "生成"}</button>
        {draft && <button className={btn} disabled={busy} onClick={() => { onAdd(draft); setDraft(null); }}>加入这 {draft.length} 个事件</button>}
        {draft && <button className={btn} disabled={busy} onClick={() => setDraft(null)}>放弃</button>}
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}
      {draft && (
        <ol className="space-y-1.5">
          {draft.map((e, i) => (
            <li key={e.id} className="rounded-xl border border-line bg-paper px-3 py-2 text-[12px]">
              <p className="font-bold text-ink">{i + 1}. {e.name}{e.locked && <span className="ml-1.5 rounded bg-coral/12 px-1.5 py-px text-[10px] text-coral">需激活</span>}{e.random && <span className="ml-1.5 rounded bg-gold/15 px-1.5 py-px text-[10px] text-gold">随机</span>}</p>
              <p className="mt-0.5 text-ink-soft">{e.prompt}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">条件 {e.conds?.length ?? 0} · 效果 {e.effects?.length ?? 0}{e.nextIds?.length ? ` · 接 ${e.nextIds.map((n) => draft.find((d) => d.id === n)?.name ?? n).join("、")}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
      {draft && <p className="text-[11px] text-ink-soft">加入后可在下方逐条展开精修。</p>}
    </div>
  );
}

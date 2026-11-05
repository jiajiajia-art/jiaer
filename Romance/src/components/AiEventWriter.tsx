import { useState } from "react";
import { complete, isConfigured } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadConfig } from "../lib/store";
import type { FixedEvent } from "../lib/types";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import { LIVE_LOCATIONS, LIVE_PEOPLE } from "../mods/registry";
import {
  AI_FIXED_EVENTS_COUNT,
  AI_FIXED_EVENTS_DEFAULT_ASK,
  buildAiFixedEventsSystemPrompt,
  mergeAiFixedEventsIntoLibrary,
  sanitizeAiFixedEvents,
  type AiFixedEventsWorldContext,
} from "../lib/aiFixedEvents";

/* 固定事件 · AI 帮写：按世界观一次生成恰好 5 条完整叙事事件（名称/触发/提示词/属性变化），禁止选项。 */

function defaultWorldContext(extra?: AiFixedEventsWorldContext): AiFixedEventsWorldContext {
  return {
    title: extra?.title,
    setting: extra?.setting,
    scriptTone: extra?.scriptTone,
    rooms: extra?.rooms?.length
      ? extra.rooms
      : LIVE_LOCATIONS.map((r) => ({ id: r.id, name: r.name })),
    npcs: extra?.npcs?.length
      ? extra.npcs
      : LIVE_PEOPLE.map((p) => ({ id: p.id, name: p.name })),
    metrics: extra?.metrics?.length ? extra.metrics : FIXED_METRICS.map((m) => ({ key: m.key, label: m.label })),
    stats: extra?.stats?.length
      ? extra.stats
      : STAT_ORDER.map((k) => ({ key: k, label: STAT_LABELS[k] })),
  };
}

export default function AiEventWriter({
  existing,
  world,
  onApply,
}: {
  existing: FixedEvent[];
  /** 功能注释：模组编辑器传入本作品世界观；缺省回退当前生效世界 */
  world?: AiFixedEventsWorldContext;
  onApply: (list: FixedEvent[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<FixedEvent[] | null>(null);
  const ai = isConfigured(loadConfig());
  const btn = "rounded-full border border-line bg-paper px-3 py-1 text-[12px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

  const run = async (ask: string) => {
    const q = ask.trim() || AI_FIXED_EVENTS_DEFAULT_ASK;
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const ctx = defaultWorldContext(world);
      const raw = await complete(loadConfig(), [
        { role: "system", content: buildAiFixedEventsSystemPrompt(ctx, existing) },
        ...(draft ? [{ role: "assistant" as const, content: "```json\n" + JSON.stringify(draft) + "\n```" }] : []),
        {
          role: "user",
          content: draft
            ? `在上面的基础上修改，仍保持恰好 ${AI_FIXED_EVENTS_COUNT} 条完整事件（每条都有 prompt 与 effects，禁止 choices）：${q}`
            : q,
        },
      ]);
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
      const parsed = m ? JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, "$1")) : null;
      const list = sanitizeAiFixedEvents(parsed, new Set(existing.map((e) => e.id)));
      if (list.length < AI_FIXED_EVENTS_COUNT) {
        throw new Error(
          `需要 ${AI_FIXED_EVENTS_COUNT} 条带事件提示词与属性变化的完整事件（本次可用 ${list.length} 条），请再点一次生成`,
        );
      }
      setDraft(list.slice(0, AI_FIXED_EVENTS_COUNT));
      setText("");
    } catch (e) {
      setErr(e instanceof SyntaxError ? "AI 返回的格式有误，请重试" : friendlyAIError(e).text || (e as Error).message);
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-2 rounded-2xl border border-jade/40 bg-gradient-to-r from-jade/10 to-coral/10 px-4 py-2.5 text-left transition hover:border-jade">
        <span>
          <span className="block text-[13px] font-bold text-ink">AI 帮写固定事件</span>
          <span className="block text-[11.5px] text-ink-soft">按世界观一次生成 {AI_FIXED_EVENTS_COUNT} 条完整事件（名称 · 触发 · 提示词 · 属性变化）</span>
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
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(text); }}
        placeholder={draft ? "继续调整，如：把第 2 条改到片场、压力 +8" : `可留空，直接点「生成 ${AI_FIXED_EVENTS_COUNT} 条」：按世界观写满名称、触发、事件提示词与属性变化`}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink outline-none focus:border-jade" />
      <div className="flex flex-wrap gap-1.5">
        <button
          className={`${btn} !border-transparent bg-jade !text-white`}
          disabled={!ai || busy}
          onClick={() => void run(text)}
        >
          {busy ? "生成中…" : draft ? "按要求修改" : `生成 ${AI_FIXED_EVENTS_COUNT} 条完整事件`}
        </button>
        {draft && (
          <button
            className={btn}
            disabled={busy}
            onClick={() => {
              onApply(mergeAiFixedEventsIntoLibrary(existing, draft));
              setDraft(null);
            }}
          >
            写入这 {draft.length} 个事件
          </button>
        )}
        {draft && <button className={btn} disabled={busy} onClick={() => setDraft(null)}>放弃</button>}
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}
      {draft && (
        <ol className="space-y-1.5">
          {draft.map((e, i) => (
            <li key={e.id} className="rounded-xl border border-line bg-paper px-3 py-2 text-[12px]">
              <p className="font-bold text-ink">{i + 1}. {e.name}{e.locked && <span className="ml-1.5 rounded bg-coral/12 px-1.5 py-px text-[10px] text-coral">需激活</span>}</p>
              <p className="mt-0.5 text-ink-soft">{e.prompt}</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">效果 {e.effects?.length ?? 0} · 触发 auto{e.time && e.time.kind !== "none" ? ` · 时间 ${e.time.kind}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
      {draft && <p className="text-[11px] text-ink-soft">若当前多为缺提示词的空壳，写入时会整表替换为这 {AI_FIXED_EVENTS_COUNT} 条，避免顶部再刷提醒。</p>}
    </div>
  );
}

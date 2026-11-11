import { useState } from "react";
import { complete, isConfigured } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { loadConfig } from "../lib/store";
import type { FixedEvent } from "../lib/types";
import {
  AI_FIXED_EVENTS_COUNT,
  AI_FIXED_EVENTS_DEFAULT_ASK,
  AI_FIXED_EVENTS_SUGGEST_MIN,
  buildAiFixedEventsSystemPrompt,
  mergeAiFixedEventsIntoLibrary,
  sanitizeAiFixedEvents,
  type AiFixedEventsWorldContext,
} from "../lib/aiFixedEvents";

/* 固定事件 · AI 帮写：只读本作品表单上下文，空白时保持空白，禁止回落 LIVE_*。 */

function defaultWorldContext(extra?: AiFixedEventsWorldContext): AiFixedEventsWorldContext {
  return {
    title: extra?.title,
    setting: extra?.setting,
    scriptTone: extra?.scriptTone,
    worldBook: extra?.worldBook ?? [],
    rooms: extra?.rooms ?? [],
    npcs: extra?.npcs ?? [],
    metrics: extra?.metrics ?? [],
    stats: extra?.stats ?? [],
  };
}

export default function AiEventWriter({
  existing,
  world,
  onApply,
}: {
  existing: FixedEvent[];
  /** 功能注释：模组编辑器传入本作品世界观；为空就空，不读旧世界 */
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
  const exampleRoom = world?.rooms?.[0]?.name;
  const exampleAttr = world?.stats?.[0]?.label || world?.metrics?.[0]?.label;
  const placeholder = exampleRoom || exampleAttr
    ? `例如：在「${exampleRoom || "本作品地点"}」围绕「${exampleAttr || "本作品属性"}」写一场可结算的戏`
    : "用一句话描述想要的事件走向（可选）";

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
            ? `在上面的基础上修改，仍保持约 ${AI_FIXED_EVENTS_SUGGEST_MIN} 条以上完整事件（每条都有 prompt 与 effects）：${q}`
            : q,
        },
      ]);
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/);
      const parsed = m ? JSON.parse(m[1].trim().replace(/,\s*([}\]])/g, "$1")) : null;
      const list = sanitizeAiFixedEvents(parsed, new Set(existing.map((e) => e.id)));
      if (list.length < 1) {
        throw new Error("需要至少 1 条带事件提示词与属性变化的完整事件，请再点一次生成");
      }
      setDraft(list);
    } catch (e) {
      setErr(friendlyAIError(e).text);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className={btn} disabled={!ai} title={ai ? "按本作品设定帮写固定事件" : "先配置 AI"} onClick={() => setOpen(true)}>
        AI 帮写固定事件
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-line bg-paper-2/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-ink">AI 帮写固定事件</span>
        <span className="text-[11px] text-ink-soft">建议约 {AI_FIXED_EVENTS_SUGGEST_MIN}–{AI_FIXED_EVENTS_COUNT + 2} 条，只读本作品地点/人物/属性</span>
        <button type="button" className={`${btn} ml-auto`} onClick={() => { setOpen(false); setDraft(null); setErr(""); }}>收起</button>
      </div>
      <textarea
        className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-[12px] text-ink placeholder:text-ink-soft/70"
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => void run(text)}>{busy ? "生成中…" : draft ? "再改一版" : "开始生成"}</button>
        {draft && (
          <button
            type="button"
            className={btn}
            onClick={() => {
              onApply(mergeAiFixedEventsIntoLibrary(existing, draft));
              setOpen(false);
              setDraft(null);
              setText("");
            }}
          >
            写入事件库（{draft.length} 条）
          </button>
        )}
      </div>
      {err && <p className="text-[12px] text-danger">{err}</p>}
      {draft && (
        <ul className="space-y-1 text-[12px] text-ink">
          {draft.map((e) => (
            <li key={e.id} className="rounded-lg border border-line bg-paper px-2 py-1.5">
              <b>{e.name}</b>
              <span className="ml-2 text-ink-soft">{e.prompt.slice(0, 48)}{e.prompt.length > 48 ? "…" : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

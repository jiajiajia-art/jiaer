/* 角色卡增强编辑区：约束规则 / 示例对话（场景标签 + 权重 + 格式高亮）/ 单卡屏蔽词。嵌在固定人物编辑器的「人设」页 */
import { useState } from "react";
import type { CharExample, NpcPersona } from "../lib/types";
import { EXAMPLE_TAGS, RULE_FIELDS, exampleIssues, lintExample, rulesFilled } from "../game/charCard";

const field = "w-full rounded-xl border border-line bg-paper text-[13px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade/60";
const label = "mb-2 flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-bold text-ink";
const newId = () => `ex_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SAMPLE = "*放下杯子，别过脸*「……谁要你管。」(小声)";

function Highlight({ text }: { text: string }) {
  return (
    <div className="space-y-0.5 rounded-lg bg-paper-2 px-2.5 py-1.5 font-mono text-[12px] leading-relaxed">
      {text.split("\n").map((line, i) => {
        const m = line.match(/^\s*[^\s:：「*（(]{1,8}[:：]\s*/);
        const head = m?.[0] ?? "";
        return (
          <p key={i} className="whitespace-pre-wrap break-all">
            {head && <span className="text-ink-soft">{head}</span>}
            {lintExample(line.slice(head.length)).map((p, j) => (
              <span key={j} className={p.kind === "act" ? "italic text-jade" : p.kind === "say" ? "text-ink" : p.kind === "aside" ? "text-ink-soft" : p.kind === "bad" ? "rounded bg-danger/12 text-danger underline decoration-wavy underline-offset-2" : ""}>{p.text}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function CharCardExtras({ draft, onChange }: { draft: NpcPersona; onChange: (p: NpcPersona) => void }) {
  const [wordText, setWordText] = useState(() => (draft.blockWords ?? []).join("、"));
  const exs = draft.examples ?? [];
  const setEx = (id: string, patch: Partial<CharExample>) => onChange({ ...draft, examples: exs.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  return (
    <>
      <section>
        <p className={label}>角色约束 <span className="text-[11px] font-normal text-ink-soft">作为 TA 的独立 system 下发，优先级最高；留空的项不发</span>
          {rulesFilled(draft).length > 0 && <span className="ml-auto text-[11px] font-normal text-jade">已填 {rulesFilled(draft).length}/{RULE_FIELDS.length}</span>}
        </p>
        <div className="space-y-2">
          {RULE_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[11.5px] font-semibold text-ink-soft">{f.label}</span>
              <textarea rows={2} maxLength={300} value={draft.rules?.[f.key] ?? ""} placeholder={f.hint}
                onChange={(e) => onChange({ ...draft, rules: { ...draft.rules, [f.key]: e.target.value } })}
                className={`${field} resize-y px-3 py-2 leading-relaxed`} />
            </label>
          ))}
        </div>
      </section>

      <section>
        <p className={label}>示例对话 <span className="text-[11px] font-normal text-ink-soft">按场景标签命中与权重挑最多 3 条，只学口吻不照抄</span></p>
        <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">推荐格式 <code className="rounded bg-paper-2 px-1 text-jade">*动作*「台词」(小声)</code>，可在行首写「名字：」。不合规的片段会被标红。</p>
        <div className="space-y-3">
          {exs.map((e, i) => {
            const bad = exampleIssues(e.text);
            const w = e.weight ?? 1;
            return (
              <div key={e.id} className="rounded-xl border border-line p-2.5">
                <div className="mb-2 flex items-center gap-2 text-[11.5px] text-ink-soft">
                  <span className="font-bold text-ink">#{i + 1}</span>
                  {bad > 0 && <span className="rounded-full bg-danger/12 px-1.5 py-px font-semibold text-danger">{bad} 行格式不统一</span>}
                  <span className="ml-auto">权重</span>
                  <div className="flex gap-0.5" role="radiogroup" aria-label="权重">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={w === n} onClick={() => setEx(e.id, { weight: n === 1 ? undefined : n })}
                        className={`h-5 w-5 rounded text-[11px] font-bold transition ${n <= w ? "bg-jade text-paper-2" : "bg-paper-2 text-ink-soft hover:bg-jade/15"}`}>{n}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => onChange({ ...draft, examples: exs.filter((x) => x.id !== e.id) })} className="ml-1 text-danger hover:underline">删除</button>
                </div>
                <textarea rows={3} maxLength={500} value={e.text} placeholder={SAMPLE} onChange={(x) => setEx(e.id, { text: x.target.value })}
                  className={`${field} resize-y px-3 py-2 font-mono leading-relaxed`} />
                {e.text.trim() && <div className="mt-1.5"><Highlight text={e.text} /></div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...EXAMPLE_TAGS, ...(e.tags ?? []).filter((t) => !EXAMPLE_TAGS.includes(t))].map((t) => {
                    const on = (e.tags ?? []).includes(t);
                    return (
                      <button key={t} type="button" aria-pressed={on} onClick={() => setEx(e.id, { tags: on ? (e.tags ?? []).filter((x) => x !== t) : [...(e.tags ?? []), t] })}
                        className={`rounded-full border px-2 py-0.5 text-[11.5px] transition ${on ? "border-coral bg-coral/12 font-bold text-coral" : "border-line text-ink-soft hover:border-coral/50"}`}>{t}</button>
                    );
                  })}
                  <input placeholder="＋自定义标签，回车" className="w-28 rounded-full border border-dashed border-line bg-transparent px-2 py-0.5 text-[11.5px] outline-none focus:border-coral"
                    onKeyDown={(x) => { const v = x.currentTarget.value.trim(); if (x.key === "Enter" && v) { x.preventDefault(); if (!(e.tags ?? []).includes(v)) setEx(e.id, { tags: [...(e.tags ?? []), v] }); x.currentTarget.value = ""; } }} />
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => onChange({ ...draft, examples: [...exs, { id: newId(), text: "", tags: [] }] })}
            className="w-full rounded-xl border border-dashed border-jade/60 py-2 text-[12.5px] font-bold text-jade transition hover:bg-jade/8">＋ 添加示例对话</button>
        </div>
      </section>

      <section>
        <p className={label}>TA 的屏蔽词 <span className="text-[11px] font-normal text-ink-soft">只作用于这张卡，优先于全局设定；TA 的台词里出现会被遮成 ＊</span></p>
        <input value={wordText} placeholder="用顿号或逗号分隔，如：宝宝、呵呵、女人"
          onChange={(e) => { setWordText(e.target.value); onChange({ ...draft, blockWords: e.target.value.split(/[、，,\n]/).map((x) => x.trim()).filter(Boolean) }); }}
          className={`${field} px-3 py-2`} />
      </section>
    </>
  );
}

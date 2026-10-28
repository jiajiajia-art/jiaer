import { useState } from "react";
import { getWorld } from "../mods/registry";
import type { PromptFragments } from "../mods/types";

/** 功能注释：编辑器只保留开场白 / 世界观 / 文风；另四项 prompt 片段已下架 UI，类型与引擎仍可读旧模组字段 */
type K = "gmIntro" | "worldIntro" | "narratorPersona";
const FIELDS: { k: K; label: string; help: string; rows: number }[] = [
  { k: "gmIntro", label: "GM 开场白", help: "系统提示词的第一段，定义 AI 是谁、写什么类型的故事。留空则用引擎通用开场。", rows: 3 },
  { k: "worldIntro", label: "世界观设定", help: "时代、地点、社会规则、基调。每回合都会注入。", rows: 6 },
  { k: "narratorPersona", label: "叙事口吻 / 文风", help: "人称、节奏、用词禁忌等。", rows: 4 },
];

const inp = "w-full min-w-0 resize-y rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";

/* 拼接预览：与 lib/ai.ts buildSystemPrompt 中世界观相关部分的顺序一致 */
function promptStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function assemble(p: PromptFragments): string {
  // 功能注释：脏数据里 prompt 字段可能是对象，禁止 ?.trim() 整页崩
  const head = promptStr(p.gmIntro) || "你是一款中文沉浸式养成模拟器的游戏主持（GM），文风细腻、有画面感、克制而深情。";
  const world = promptStr(p.worldIntro);
  const tone = promptStr(p.narratorPersona);
  const parts = [
    world && `【世界观】\n${world}`,
    tone && `【叙事口吻】\n${tone}`,
  ].filter(Boolean);
  return `${head}\n\n〔主角设定 · 由系统按存档自动填写〕\n\n${parts.join("\n\n")}${parts.length ? "\n\n" : ""}〔世界规则 / 当前状态 / 人物 / 记忆 / 输出规范 · 由引擎自动生成，不可编辑〕`;
}

export default function ModPromptEditor({ value, onChange }: { value?: PromptFragments; onChange: (v: PromptFragments) => void }) {
  const [preview, setPreview] = useState(false);
  const v = value ?? {};
  const live = getWorld().content.prompt;
  const set = (k: K, s: string) => onChange({ ...v, [k]: s });
  const loadLive = () => {
    const next: PromptFragments = { ...v };
    for (const { k } of FIELDS) if (!promptStr(v[k]) && live[k]) next[k] = live[k];
    onChange(next);
  };
  const chars = assemble(v).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={loadLive} className="rounded-lg border border-line bg-paper-2 px-3 py-1.5 text-[12px] text-ink transition hover:border-jade">
          载入当前世界的提示词
        </button>
        <button type="button" onClick={() => setPreview((x) => !x)} className={`rounded-lg border px-3 py-1.5 text-[12px] transition ${preview ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper-2 text-ink hover:border-jade"}`}>
          {preview ? "收起预览" : "预览拼接结果"}
        </button>
        <span className="ml-auto self-center text-[11px] text-ink-soft">约 {chars} 字</span>
      </div>

      {preview && (
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-paper p-3 text-[11.5px] leading-relaxed text-ink-soft">{assemble(v)}</pre>
      )}

      {FIELDS.map(({ k, label, help, rows }) => (
        <label key={k} className="block">
          <span className="mb-0.5 flex items-center text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">
            {label}
            {promptStr(v[k]) ? <span className="ml-auto font-normal tracking-normal">{promptStr(v[k]).length} 字</span> : null}
          </span>
          <textarea className={inp} rows={rows} value={typeof v[k] === "string" ? v[k]! : ""} placeholder={live[k] ? `当前世界：${live[k]!.slice(0, 60)}${live[k]!.length > 60 ? "…" : ""}` : "留空则不注入"} onChange={(e) => set(k, e.target.value)} />
          <span className="mt-0.5 block text-[11px] text-ink-soft/80">{help}</span>
        </label>
      ))}
    </div>
  );
}

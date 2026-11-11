import { synthSpeech, voiceOf } from "./phone/screenShare";
import { loadConfig } from "../lib/store";
import { NpcMemory } from "./NpcKbPanel";
import { kbOf } from "../game/npcKnowledge";
/* 固定人物编辑器：新增人物、改写基础资料与常驻地点；为每位 NPC 定下性别 / 人设 / 说话口吻，微信、通话与主线叙事统一遵守 */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { Avatar } from "./ui";
import type { Npc, NpcBaseField, NpcPersona } from "../lib/types";
import TimelineEditor from "./TimelineEditor";
import CharCardExtras from "./CharCardExtras";
import { blockWordsOf, rulesFilled } from "../game/charCard";
import PortraitUpload from "./PortraitUpload";
import { timelineOf } from "../game/npcTimeline";
import { dayDateLabel } from "../game/logic";
import RelationEditor from "./RelationEditor";
import { REL_FIELDS, personGender, relationsOf } from "../game/relNet";
import { PERSON_BY_ID, resolveMobs, seatAtHome } from "../game/mud";
import CustomPersonModal from "./CustomPersonModal";
import HomeSpotSelect from "./HomeSpotSelect";
import { homeHint, placeName } from "../game/homeSpot";
import { normAge } from "../lib/npcIdentity";
import { IconCheck } from "../lib/icons";

const VOICES = ["温柔体贴", "霸道总裁", "傲娇嘴硬", "元气少年", "高冷禁欲", "撒娇黏人", "毒舌损友", "成熟稳重", "慵懒随性", "话少冷淡", "爱开玩笑", "客气疏离"];
const TRAITS = ["嘴硬心软", "占有欲强", "外冷内热", "很黏我", "爱吃醋", "事业狂", "护短", "表面玩世不恭", "有秘密", "暗恋我", "看不起我", "慢热"];
const GENDERS = ["男", "女", "其他"] as const;
const MAX = 300;

const splitVoice = (v?: string) => (v ?? "").split(/[、，,]/).map((x) => x.trim()).filter(Boolean);
const customized = (p?: NpcPersona) => !!(p?.gender || p?.text?.trim() || p?.voice?.trim() || p?.ttsVoice?.trim() || p?.timeline?.length || rulesFilled(p).length || p?.examples?.some((e) => e.text.trim()) || blockWordsOf(p).length);
const clean = (p: NpcPersona): NpcPersona => {
  const o: NpcPersona = {};
  if (p.gender) o.gender = p.gender;
  if (p.text?.trim()) o.text = p.text.trim();
  if (p.voice?.trim()) o.voice = p.voice.trim();
  if (p.ttsVoice?.trim()) o.ttsVoice = p.ttsVoice.trim();
  // 时间线：去掉空条目；全部删掉也保留空数组，表示「不用模组预设」
  if (p.timeline) o.timeline = p.timeline.filter((e) => e.text.trim() || e.when.trim()).map((e) => ({ ...e, when: e.when.trim(), text: e.text.trim(), place: e.place?.trim() || undefined }));
  const rules = Object.fromEntries(Object.entries(p.rules ?? {}).map(([k, v]) => [k, v?.trim()]).filter(([, v]) => v));
  if (Object.keys(rules).length) o.rules = rules;
  const ex = (p.examples ?? []).filter((e) => e.text.trim()).map((e) => ({ id: e.id, text: e.text.trim(), ...(e.tags?.length ? { tags: e.tags } : {}), ...(e.weight && e.weight > 1 ? { weight: e.weight } : {}) }));
  if (ex.length) o.examples = ex;
  const bw = blockWordsOf(p);
  if (bw.length) o.blockWords = bw;
  return o;
};

/* —— 基础资料（姓名 / 年龄 / 身份 / 关系 / 简介）+ 常驻地点 —— */
type Base = Record<NpcBaseField, string> & { home: string };
const BASE_FIELDS: NpcBaseField[] = ["name", "age", "identity", "relation", "bio"];
const BIO_MAX = 300;
const ageInput = (a?: string) => (a ?? "").trim().replace(/\s*岁$/, "");
const baseOf = (n: Npc): Base => ({ name: n.name, age: ageInput(n.age), identity: n.identity ?? "", relation: n.relation ?? "", bio: n.bio ?? "", home: n.home ?? "" });
// 内容池原设定（与开局 seedNpcs 写入存档的值一致）；自定义 / 剧情新增人物没有原设定
const contentBase = (id: string): Base | undefined => {
  const p = PERSON_BY_ID[id];
  return p && { name: p.name, age: "", identity: p.role, relation: p.relation ?? "", bio: p.bio, home: "" };
};
const sameBase = (a: Base, b: Base) => a.home === b.home && BASE_FIELDS.every((k) => a[k].trim() === b[k].trim());
const touched = (n: Npc) => customized(n.persona) || !!n.edited?.length || !!n.home;

/* 写回人物：只写改动过的字段；与原设定不同的记为「玩家改过」，资料卡据此优先显示存档值。
 * 清空或改回原设定的字段不算改过（资料卡回落到原设定）；年龄纯数字存成「N 岁」，自由文本原样 */
function applyBase(n: Npc, b: Base): Npc {
  const cur = baseOf(n);
  const orig = contentBase(n.id);
  const next: Npc = { ...n };
  const edited = new Set(n.edited ?? []);
  for (const k of BASE_FIELDS) {
    const v = b[k].trim();
    if (v === cur[k].trim() || (k === "name" && !v)) continue;
    next[k] = k === "age" ? normAge(v) : v;
    if (!v || (orig && v === orig[k])) edited.delete(k);
    else edited.add(k);
  }
  next.edited = edited.size ? [...edited] : undefined;
  if (b.home !== cur.home) next.home = b.home || undefined;
  return next;
}

function ProfileEditor({ npc, onSave }: { npc: Npc; onSave: (b: Base) => void }) {
  const { game } = useGame();
  const [draft, setDraft] = useState<Base>(() => baseOf(npc));
  const [saved, setSaved] = useState(false);
  const ok = draft.name.trim().length > 0;
  const dirty = !sameBase(draft, baseOf(npc));
  // 切换人物 / 分页、关闭弹窗时，未保存的修改自动保存（姓名留空则不存）
  const pending = useRef<Base | null>(null);
  pending.current = dirty && ok ? draft : null;
  useEffect(() => () => { if (pending.current) onSave(pending.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!game) return null;

  const set = (k: keyof Base, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const save = () => { onSave(draft); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  const orig = contentBase(npc.id);
  const wp = PERSON_BY_ID[npc.id];
  const here = resolveMobs(game.sim, game.npcs)[npc.id];

  const label = "mb-2 flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-bold text-ink";
  const sub = "mb-1 block text-[11.5px] font-semibold text-ink-soft";
  const field = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade/60 sm:text-[13px]";

  return (
    <div className="space-y-5">
      <section>
        <p className={label}>基础资料 <span className="text-[11px] font-normal text-ink-soft">人脉资料卡、见面名片与剧情都按这里显示</span></p>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.62fr)] gap-x-2.5 gap-y-3">
          <label className="min-w-0">
            <span className={sub}>姓名 <span className="text-coral">*</span></span>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={12} placeholder={orig?.name ?? "如：沈知夏"} aria-invalid={!ok} className={`${field} ${ok ? "" : "border-danger/60"}`} />
          </label>
          <label className="min-w-0">
            <span className={sub}>年龄</span>
            <input value={draft.age} onChange={(e) => set("age", e.target.value)} inputMode="numeric" maxLength={8} placeholder={wp?.age ? `原设定 ${wp.age}` : "如 24"} className={field} />
          </label>
          <label className="min-w-0">
            <span className={sub}>身份 / 职业</span>
            <input value={draft.identity} onChange={(e) => set("identity", e.target.value)} maxLength={40} placeholder={orig?.identity || "如：星辰传媒 · 新人演员"} className={field} />
          </label>
          <label className="min-w-0">
            <span className={sub}>与你的关系</span>
            <input value={draft.relation} onChange={(e) => set("relation", e.target.value)} maxLength={16} placeholder={orig?.relation || "如：老同学"} className={field} />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={`${sub} flex items-baseline justify-between`}>
            简介
            <span className={`font-normal tabular-nums ${draft.bio.length >= BIO_MAX ? "text-danger" : ""}`}>{draft.bio.length}/{BIO_MAX}</span>
          </span>
          <textarea value={draft.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={BIO_MAX} placeholder={orig?.bio || "外貌、性格、身世……"} className={`${field} min-h-[6.5rem] resize-y leading-relaxed`} />
        </label>
      </section>

      <section>
        <p className={label}>常驻地点 <span className="text-[11px] font-normal text-ink-soft">只能从当前地图上已有的地点里选</span></p>
        <HomeSpotSelect game={game} pid={npc.id} value={draft.home} onChange={(v) => set("home", v)} className={field} />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-relaxed text-ink-soft">
          <span className="min-w-0 flex-1">{homeHint(game, npc.id, draft.home)}</span>
          {here && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-jade/10 px-2 py-0.5 font-semibold text-jade">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-jade" />
              此刻在 {placeName(game, here)}
            </span>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-3 -mb-3 flex items-center gap-2 border-t border-line bg-paper-2/95 px-3 py-3 backdrop-blur sm:static sm:m-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none">
        {orig && (
          <button onClick={() => setDraft(orig)} disabled={sameBase(draft, orig)} className="shrink-0 rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper disabled:opacity-40 sm:px-4 sm:py-2">恢复原资料</button>
        )}
        <button onClick={save} disabled={!dirty || !ok} className="flex-1 rounded-xl bg-jade py-2.5 text-[13px] font-bold text-paper-2 transition hover:brightness-110 disabled:opacity-40 sm:py-2">
          {saved ? "已保存 " : !ok ? "请先填写姓名" : dirty ? "保存" : "已是最新"}
        </button>
      </div>
    </div>
  );
}

function Editor({ npc, onSave }: { npc: Npc; onSave: (p: NpcPersona) => void }) {
  const [draft, setDraft] = useState<NpcPersona>(npc.persona ?? {});
  const [saved, setSaved] = useState(false);
  const [tts, setTts] = useState("");
  const { game, setNpcPortrait } = useGame();
  const dirty = JSON.stringify(clean(draft)) !== JSON.stringify(clean(npc.persona ?? {}));
  // 切换人物 / 关闭弹窗时，未保存的修改自动保存
  const pending = useRef<NpcPersona | null>(null);
  pending.current = dirty ? clean(draft) : null;
  useEffect(() => () => { if (pending.current) onSave(pending.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => { onSave(clean(draft)); setSaved(true); setTimeout(() => setSaved(false), 1600); };
  const text = draft.text ?? "";
  const voices = splitVoice(draft.voice);
  // 补充口吻用本地原文，避免输入「、」时被即时拆分吃掉
  const [custom, setCustom] = useState(() => voices.filter((v) => !VOICES.includes(v)).join("、"));
  const setVoices = (l: string[]) => setDraft({ ...draft, voice: l.join("、") });
  const toggleVoice = (v: string) => setVoices(voices.includes(v) ? voices.filter((x) => x !== v) : [...voices, v]);
  const addTrait = (t: string) => {
    if (text.includes(t)) return;
    const n = text.trim() ? `${text.trim().replace(/[，。；、]$/, "")}，${t}` : t;
    setDraft({ ...draft, text: n.slice(0, MAX) });
  };

  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12.5px] transition active:scale-95 sm:py-1 ${on ? "border-jade bg-jade/12 font-bold text-jade" : "border-line bg-paper text-ink-soft hover:border-jade/50"}`;
  const label = "mb-2 flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-bold text-ink";
  const field = "w-full rounded-xl border border-line bg-paper text-[14px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade/60 sm:text-[13px]";

  const summary = [
    draft.gender && `性别 ${draft.gender}`,
    text.trim() ? `人设「${text.trim().slice(0, 40)}${text.trim().length > 40 ? "…" : ""}」` : "人设沿用原设定",
    voices.length ? `口吻 ${voices.join("、")}` : "",
    rulesFilled(draft).length ? `约束 ${rulesFilled(draft).map((f) => f.label).join("、")}` : "",
    draft.examples?.some((e) => e.text.trim()) ? `示例对话 ${draft.examples.filter((e) => e.text.trim()).length} 条` : "",
    blockWordsOf(draft).length ? `屏蔽词 ${blockWordsOf(draft).length} 个` : "",
    (draft.timeline ?? timelineOf(npc)).length ? `时间线 ${(draft.timeline ?? timelineOf(npc)).length} 条` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar src={npc.avatar} name={npc.name} size={44} editable={false} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-serif text-[17px] font-black text-ink">
            {npc.name}
            {customized(npc.persona) && <span className="rounded-full bg-coral/15 px-1.5 py-px font-sans text-[10px] font-semibold text-coral">已定制</span>}
          </p>
          <p className="truncate text-[11.5px] text-ink-soft">{[npc.identity, npc.relation, npc.age && `${npc.age}`].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <section>
        <p className={label}>TA 的立绘 <span className="text-[11px] font-normal text-ink-soft">立绘模式下说话时显示</span></p>
        <div className="rounded-xl border border-line bg-paper px-3">
          <PortraitUpload name={npc.name} src={npc.portrait} onChange={(u) => setNpcPortrait(npc.id, u)} />
        </div>
      </section>

      <section>
        <p className={label}>TA 的性别 <span className="text-[11px] font-normal text-ink-soft">不选则由剧情自行判断</span></p>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {GENDERS.map((g) => (
            <button key={g} onClick={() => setDraft({ ...draft, gender: draft.gender === g ? undefined : g })} className={pill(draft.gender === g)} aria-pressed={draft.gender === g}>{g}</button>
          ))}
        </div>
      </section>

      <section>
        <p className={label}>
          TA 的人设 <span className="text-[11px] font-normal text-ink-soft">留空则用原设定</span>
          {npc.bio && !text.trim() && (
            <button onClick={() => setDraft({ ...draft, text: npc.bio.slice(0, MAX) })} className="ml-auto text-[11.5px] font-semibold text-jade">以原设定为底稿改写</button>
          )}
        </p>
        <textarea
          value={text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          rows={5}
          maxLength={MAX}
          placeholder={npc.bio ? `原设定：${npc.bio}` : "例如：表面高冷的顶流歌手，私下很黏我，占有欲强，喜欢叫我宝宝……"}
          className={`${field} min-h-[7.5rem] resize-y p-3 leading-relaxed`}
        />
        <div className="mt-1.5 flex items-start gap-2">
          <div className="no-scrollbar -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible">
            {TRAITS.map((t) => (
              <button key={t} onClick={() => addTrait(t)} disabled={text.includes(t)}
                className="shrink-0 rounded-full border border-dashed border-line px-2 py-0.5 text-[11.5px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-35">＋{t}</button>
            ))}
          </div>
          <span className={`shrink-0 pt-0.5 text-[10.5px] tabular-nums ${text.length >= MAX ? "text-danger" : "text-ink-soft"}`}>{text.length}/{MAX}</span>
        </div>
      </section>

      <section>
        <p className={label}>说话口吻 <span className="text-[11px] font-normal text-ink-soft">可多选</span></p>
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
          {VOICES.map((v) => (
            <button key={v} onClick={() => toggleVoice(v)} className={pill(voices.includes(v))} aria-pressed={voices.includes(v)}>{v}</button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setVoices([...voices.filter((v) => VOICES.includes(v)), ...splitVoice(e.target.value)]); }}
          placeholder="补充口吻：比如说话带东北口音、爱用叠词"
          className={`${field} mt-2 px-3 py-2`}
        />
      </section>

      <section>
        <p className={label}>TA 的声音 <span className="text-[11px] font-normal text-ink-soft">语音模型的音色名；留空沿用编辑器 / 设置里的默认</span></p>
        <div className="flex items-center gap-2">
          <input value={draft.ttsVoice ?? ""} onChange={(e) => setDraft({ ...draft, ttsVoice: e.target.value })}
            placeholder={voiceOf(npc.id) ? `当前：${voiceOf(npc.id)}` : loadConfig().ttsModel ? "如 nova / onyx" : "需先在设置里配置语音模型"}
            className={`${field} flex-1 px-3 py-2`} />
          <button type="button" disabled={!loadConfig().ttsModel || tts === "busy"}
            onClick={async () => { setTts("busy"); try { const u = await synthSpeech(loadConfig(), `我是${npc.name}。`, draft.gender || (game ? personGender(game, npc.id) : undefined), draft.ttsVoice?.trim() || voiceOf(npc.id)); await new Audio(u).play(); setTts(""); } catch (e) { setTts(e instanceof Error ? e.message : "试听失败"); } }}
            className="shrink-0 rounded-full border border-jade px-3 py-1.5 text-[12px] font-bold text-jade transition hover:bg-jade/10 disabled:opacity-40">{tts === "busy" ? "合成中…" : "试听"}</button>
        </div>
        {tts && tts !== "busy" && <p className="mt-1 text-[11px] text-danger">{tts}</p>}
      </section>

      <section>
        <p className={label}>
          TA 的时间线 <span className="text-[11px] font-normal text-ink-soft">过去的经历与未来的安排，随游戏日期推进</span>
          {!draft.timeline && timelineOf(npc).length > 0 && <span className="ml-auto text-[11px] font-normal text-ink-soft">当前沿用模组预设</span>}
        </p>
        <TimelineEditor value={draft.timeline ?? timelineOf(npc)} today={dayDateLabel(game?.sim?.day ?? 0)} onChange={(timeline) => setDraft({ ...draft, timeline: timeline ?? [] })} />
      </section>

      <CharCardExtras draft={draft} onChange={setDraft} />

      <div className="rounded-xl bg-jade/6 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
        <b className="text-jade">AI 会这样理解 TA：</b>{summary}
      </div>

      <div className="sticky bottom-0 -mx-3 -mb-3 flex items-center gap-2 border-t border-line bg-paper-2/95 px-3 py-3 backdrop-blur sm:static sm:m-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none">
        <button onClick={() => { setDraft({}); setCustom(""); }} disabled={!customized(draft)} className="shrink-0 rounded-xl border border-line px-3 py-2.5 text-[13px] text-ink-soft hover:bg-paper disabled:opacity-40 sm:px-4 sm:py-2">恢复原设定</button>
        <button onClick={save} disabled={!dirty} className="flex-1 rounded-xl bg-jade py-2.5 text-[13px] font-bold text-paper-2 transition hover:brightness-110 disabled:opacity-40 sm:py-2">
          {saved ? "已保存 " : dirty ? "保存" : "已是最新"}
        </button>
      </div>
    </div>
  );
}

export default function FixedPersonPanel() {
  const { game, commitGame } = useGame();
  const npcs = game!.npcs;
  const [sel, setSel] = useState(npcs[0]?.id ?? "");
  const [q, setQ] = useState("");
  const [onlyDone, setOnlyDone] = useState(false);
  const [pane, setPane] = useState<"profile" | "persona" | "memory" | "relations">("profile");
  const [adding, setAdding] = useState(false);
  const gRef = useRef(game);
  gRef.current = game;
  const addBtn = (
    <button onClick={() => setAdding(true)}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-jade/60 bg-jade/5 px-3 py-2 text-[13px] font-bold text-jade transition hover:border-jade hover:bg-jade/10 active:scale-[0.98] sm:py-1.5 sm:text-[12.5px]">
      <span aria-hidden className="text-[15px] leading-none">＋</span>新增人物
    </button>
  );
  const addModal = adding && <CustomPersonModal onClose={() => setAdding(false)} onCreated={(id) => { setSel(id); setPane("profile"); }} />;
  if (!npcs.length) return (
    <div className="space-y-3 py-8 text-center">
      <p className="text-[13px] text-ink-soft">还没有认识的人物。</p>
      <div className="mx-auto max-w-[220px]">{addBtn}</div>
      {addModal}
    </div>
  );

  const kw = q.trim();
  const doneCount = npcs.filter(touched).length;
  const list = npcs.filter((n) => (!onlyDone || touched(n)) && (!kw || n.name.includes(kw) || n.identity.includes(kw) || n.relation.includes(kw)));
  const cur = npcs.find((n) => n.id === sel) ?? npcs[0];
  // 用最新 game 写入，避免卸载时的自动保存拿到旧快照
  const save = (id: string, p: NpcPersona) => {
    const g = gRef.current!;
    commitGame({ ...g, npcs: g.npcs.map((n) => (n.id === id ? { ...n, persona: Object.keys(p).length ? p : undefined } : n)) });
  };
  // 基础资料：常驻地点变了，人物当即落座到新的常驻地点（只动 mobs，不碰其它模拟状态）
  const saveBase = (id: string, b: Base) => {
    const g = gRef.current!;
    const old = g.npcs.find((n) => n.id === id);
    if (!old) return;
    const next = applyBase(old, b);
    const sim = (next.home ?? "") !== (old.home ?? "") && g.sim ? seatAtHome(g.sim, id, next.home) : g.sim;
    commitGame({ ...g, npcs: g.npcs.map((n) => (n.id === id ? next : n)), sim });
  };
  const memN = (id: string) => { const kb = kbOf(game!, id); return kb.playerMemory.length + kb.selfMemory.length + (kb.heard?.length ?? 0); };
  const relN = (id: string) => { const r = relationsOf(game, id); return REL_FIELDS.reduce((s, f) => s + r[f].length, 0); };
  const tab = (on: boolean) => `rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition ${on ? "bg-ink text-paper-2" : "text-ink-soft hover:bg-line/50"}`;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[190px_minmax(0,1fr)] md:grid-cols-[210px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          {addBtn}
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="搜索名字 / 身份 / 关系"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade/60 sm:py-1.5 sm:text-[12.5px]" />
          <div className="flex gap-1">
            <button className={tab(!onlyDone)} onClick={() => setOnlyDone(false)}>全部 {npcs.length}</button>
            <button className={tab(onlyDone)} onClick={() => setOnlyDone(true)}>已定制 {doneCount}</button>
          </div>
          <div className="no-scrollbar -mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:max-h-[56dvh] sm:snap-none sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:px-0">
            {!list.length && <p className="px-1 py-2 text-[12px] text-ink-soft">{onlyDone ? "还没有定制过的人物" : "没有匹配的人物"}</p>}
            {list.map((n) => {
              const on = n.id === cur.id;
              return (
                <button key={n.id} onClick={() => setSel(n.id)} aria-pressed={on}
                  className={`relative flex shrink-0 snap-start flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition sm:w-full sm:flex-row sm:gap-2 sm:py-1.5 sm:text-left ${on ? "border-jade bg-jade/10" : "border-line bg-paper hover:bg-paper-2"}`}>
                  <Avatar src={n.avatar} name={n.name} size={32} editable={false} />
                  <span className="min-w-0 sm:flex-1">
                    <span className={`block w-14 truncate text-[12px] sm:w-auto sm:text-[12.5px] ${on ? "font-bold text-jade" : "text-ink"}`}>{n.name}</span>
                    <span className="hidden truncate text-[10.5px] text-ink-soft sm:block">{n.relation || n.identity}</span>
                  </span>
                  {touched(n) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-coral sm:static sm:shrink-0" title="已定制" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Avatar src={cur.avatar} name={cur.name} size={40} editable={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-ink">{cur.name}</p>
              <p className="truncate text-[11.5px] text-ink-soft">{[cur.identity, cur.relation].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            {/* 竖屏窄屏：四个分页单独占一行，不挤掉名字 */}
            <div className="flex w-full shrink-0 rounded-full border border-line bg-paper p-0.5 sm:w-auto">
              {([["profile", "资料"], ["persona", "人设"], ["memory", `记忆 ${memN(cur.id)}`], ["relations", `关系网 ${relN(cur.id)}`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPane(k)} aria-pressed={pane === k} className={`flex-auto whitespace-nowrap rounded-full px-2 py-1 text-[12px] font-semibold transition sm:flex-none sm:px-3 ${pane === k ? "bg-ink text-paper-2" : "text-ink-soft hover:text-ink"}`}>{l}</button>
              ))}
            </div>
          </div>
          {pane === "profile" ? <ProfileEditor key={cur.id} npc={cur} onSave={(b) => saveBase(cur.id, b)} /> : pane === "persona" ? <Editor key={cur.id} npc={cur} onSave={(p) => save(cur.id, p)} /> : pane === "memory" ? <NpcMemory key={cur.id} pid={cur.id} /> : <RelationEditor key={cur.id} npc={cur} />}
        </div>
      </div>
      {addModal}
    </div>
  );
}

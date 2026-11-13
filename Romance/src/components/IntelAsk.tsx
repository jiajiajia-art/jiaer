import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { complete, isConfigured, stripMarkup } from "../lib/ai";
import { friendlyAIError } from "../lib/aiError";
import { kbBlock, recentStoryBlock, remember } from "../game/npcKnowledge";
import { gameTimeLabel } from "../game/phone";
import type { IntelView } from "../game/mud";
import { loadData, saveData } from "../lib/saveScope";

/* 打听（AI 驱动）：任何已结识的人都能问。
 * · 模组写好的情报 = 「必说要点」：AI 用 TA 的口吻、结合当前剧情自然说出，并照常记入 knownIntel（状态中枢）
 * · 门槛未达的情报：只让 AI 卖关子，不泄露内容
 * · 回答写入该 NPC 私有记忆；每人每回合限问 2 次，避免刷
 * · 未接 AI / 请求失败：退回模组原文，离线也能玩 */
const PER_TURN = 2;
type Line = { who: "me" | "npc" | "sys"; text: string };

/* 功能注释：通用追问不带任何题材措辞（娱乐圈「圈里」等），所有世界观通用 */
const GENERIC = ["最近有什么新鲜事吗？", "你觉得我现在该做什么？", "你最近在忙什么？"];

export default function IntelAsk({ pid, name, role, intel }: { pid: string; name: string; role?: string; intel: IntelView[] }) {
  const { game, cfg, patchGame, simAskIntel } = useGame();
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  if (!game) return null;

  const key = `intel.asked.${pid}`;
  const rec = loadData<{ turn: number; n: number }>(key, { turn: -1, n: 0 });
  const used = rec.turn === game.turnCount ? rec.n : 0;
  const left = PER_TURN - used;
  const fresh = intel.filter((it) => it.available && !it.unlocked);
  const locked = intel.filter((it) => !it.available && !it.unlocked);
  const heard = intel.filter((it) => it.unlocked);
  const chips = [...fresh.map((it) => ({ label: it.topic, intelId: it.id })), ...GENERIC.slice(0, fresh.length ? 1 : 2).map((g) => ({ label: g, intelId: undefined as string | undefined }))];

  async function ask(question: string, intelId?: string) {
    const q = question.trim();
    if (!q || busy || left <= 0 || !game) return;
    setDraft("");
    setLines((l) => [...l, { who: "me", text: q }]);
    saveData(key, { turn: game.turnCount, n: used + 1 });
    const target = intelId ? fresh.find((it) => it.id === intelId) : undefined;

    // 离线兜底：有模组原文就照原文说，否则如实提示
    const offline = () => {
      if (target) { simAskIntel(pid, target.id); setLines((l) => [...l, { who: "npc", text: target.text }]); }
      else setLines((l) => [...l, { who: "sys", text: `${name}想了想，没多说什么。（接入 AI 后可以自由打听）` }]);
    };
    if (!isConfigured(cfg)) { offline(); return; }

    setBusy(true);
    try {
      const g0 = game;
      const npc = g0.npcs.find((n) => n.id === pid);
      const persona = npc ? `${npc.identity}，对主角好感${npc.affinity}，心情${npc.mood || "平常"}${npc.persona?.text ? `，人设：${npc.persona.text}` : ""}${npc.persona?.voice ? `，口吻：${npc.persona.voice}` : ""}` : role || "本地人";
      const must = fresh.map((it) => `- [${it.id}]「${it.topic}」要点：${it.text}`).join("\n");
      const tease = locked.map((it) => `- 「${it.topic}」（时机未到：${it.hint || "条件不足"}，只能卖关子，绝不透露内容）`).join("\n");
      const out = await complete(cfg, [
        { role: "system", content: `你扮演「${name}」（${persona}），主角正当面向你打听消息。
规则：
1. 只说你这个身份在现实中可能知道的事；不知道就坦白说不知道或岔开，不编造世界外的事实。
2. 好感越高越坦诚，好感低时可以敷衍或婉拒。
3. 用你自己的口吻说话，2~4 句，口语化，不要旁白腔、不要列表、不要出现任何数值。
4. 若问题与下列【你掌握的情报】相关，必须把其要点自然地说出来（换成你此刻的说法，可结合最近剧情），并在 covered 里列出其 id。
5. 【时机未到】的话题只能卖关子。

【你掌握的情报】
${must || "（无特定情报，凭你的身份与见闻回答）"}
${tease ? `【时机未到】\n${tease}` : ""}

${kbBlock(g0, pid)}

${recentStoryBlock(g0)}

只输出 JSON：{"reply":"你说的话","covered":["情报id"],"memo":"你的第一人称一句记忆，≤30字，只记事实"}` },
        { role: "user", content: `【当前】${gameTimeLabel(g0)}\n主角：${g0.player.name}（${g0.player.identity}）\n${lines.slice(-6).map((l) => (l.who === "me" ? `主角：${l.text}` : l.who === "npc" ? `${name}：${l.text}` : "")).filter(Boolean).join("\n")}\n主角问：${q}` },
      ]);
      const m = out.match(/\{[\s\S]*\}/);
      let p: { reply?: string; covered?: unknown; memo?: string } | null = null;
      try { p = m ? JSON.parse(m[0]) : null; } catch { p = null; }
      const reply = stripMarkup(String(p?.reply ?? "")).trim();
      if (!reply) { offline(); return; }
      setLines((l) => [...l, { who: "npc", text: reply.slice(0, 400) }]);
      // 回流状态中枢：先写 NPC 私有记忆，再把说到的模组情报记为已知
      const memo = (p?.memo?.trim() || `她向我打听「${q.slice(0, 16)}」`).slice(0, 40);
      patchGame((g) => remember(g, pid, "player", `被打听：${memo}`, gameTimeLabel(g))); // 以最新状态为准，避免覆盖等待期间的变更
      const covered = new Set(Array.isArray(p?.covered) ? p!.covered.map(String) : []);
      if (target) covered.add(target.id);
      for (const it of fresh) if (covered.has(it.id)) simAskIntel(pid, it.id);
    } catch (e) {
      setLines((l) => [...l, { who: "sys", text: friendlyAIError(e).text }]);
      if (target) offline();
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-2.5 space-y-2 border-l border-line pl-3">
      <p className="text-[11px] text-ink-soft">向{name}打听——TA 只会说自己知道的事。<span className="tabular-nums">本回合还能问 {Math.max(0, left)} 次</span></p>

      {lines.length > 0 && (
        <div className="space-y-1.5">
          {lines.map((l, i) =>
            l.who === "sys" ? <p key={i} className="text-[11.5px] text-ink-soft">{l.text}</p> : (
              <div key={i} className={`flex ${l.who === "me" ? "justify-end" : "justify-start"}`}>
                <p className={`ui-bubble ${l.who === "me" ? "ui-bubble-me" : "ui-bubble-them"}`}>{l.text}</p>
              </div>
            ),
          )}
          {busy && <p className="text-[11.5px] text-ink-soft">{name}想了想……</p>}
        </div>
      )}

      {left > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button key={c.label} disabled={busy} onClick={() => void ask(c.label, c.intelId)}
                className={`ui-chip ${c.intelId ? "ui-chip-accent" : ""}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="ui-inputbar">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void ask(draft); }}
              placeholder={`想问${name}什么？`} disabled={busy} />
            <button disabled={busy || !draft.trim()} onClick={() => void ask(draft)} className="ui-btn ui-btn-primary ui-btn-sm">问</button>
          </div>
        </>
      ) : (
        <p className="text-[11.5px] text-ink-soft">今天问得够多了，{name}有点不耐烦。推进之后再来吧。</p>
      )}

      {heard.length > 0 && (
        <div>
          <button onClick={() => setShowOld((v) => !v)} className="text-[11px] font-medium text-ink-soft hover:text-jade">{showOld ? "收起" : `听过的 ${heard.length} 条`}</button>
          {showOld && heard.map((it) => (
            <div key={it.id} className="mt-1">
              <p className="text-[11.5px] font-bold text-ink">· {it.topic}</p>
              <p className="story-prose text-[12px] leading-relaxed text-ink/80">{it.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

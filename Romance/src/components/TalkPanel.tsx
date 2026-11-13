import { npcFactionOf } from "../game/factions";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID_TALK } from "../mods/registry";
import { moodLine } from "@/lib/npcIdentity";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import { useGame } from "../store/gameCtx";
import { Avatar } from "./ui";
import { IconClose, IconSend } from "../lib/icons";
import { streamChat, complete, isConfigured, mapSpotBlock } from "../lib/ai";
import { affinityOf, kbBlock, kbOf, toNpcPov, recentStoryBlock, remember, romanceBlock, toneCue } from "../game/npcKnowledge";
import { applyChatEffects, gameTimeLabel, ensurePhone, wxApply, wxRelation, wxResolve, type WxRelation } from "../game/phone";
import { relOf } from "../game/relations";
import { meetPerson } from "../game/npcIntro";
import { apPerTalk, tripPoints } from "../game/mud";

/* 大世界层级的线下【对话】面板（非手机浮层）。
 * - NPC 可自主选择好好回应 / 敷衍 / 无视（ignore）；无视时面板保持打开但无有效台词。
 * - non_friend / pending 底部有「申请微信」（pending 置灰）；friend 只剩「结束对话」。
 * - 微信关系只认 AI 输出的 agree / reject / shelve 指令，口头表态不改变关系。
 * - 玩家 room（location_id）一旦变化，强制结束本次交谈。 */

// hint：只给玩家看的系统提示（如爱慕变化），不回传给模型，避免它提起数值
type Line = { who: "me" | "npc" | "sys"; text: string; hint?: boolean };
type Reply = { mode?: string; reply?: string; wx?: string; memo?: string; love?: number | string };

const SYSTEM = `【对话】是线下当面交谈入口，无论是否认识对方，玩家都可以发起对话。
你可以根据自身性格、心情、对玩家的印象，自由选择好好回应、敷衍，或是直接无视玩家。
无视的时候输出：\`ignore\`，描述：对方并没有打算搭理你。

关系规则：
non_friend / pending状态：你们没有微信，只能当面交谈，分开之后就无法沟通。
pending代表已经收到微信好友申请，你可以当场决定同意/拒绝，也可以口头表示需要再想想继续搁置，也可以之后再处理。口头表态不等于生效，必须输出系统指令agree/reject/shelve才变更好友状态。
friend状态：既可以当面【对话】，也可以随时微信联系，不受地点约束。
一旦玩家离开当前地点，本次当面交谈直接结束。

【活人感·演绎要求】你是一个正在过自己日子的真人，不是 NPC，也不是客服：
· 你此刻手上有自己的事（在忙、刚下班、等人、吃东西……），注意力不全在玩家身上，可以边做事边答、被打断、走神。
· 说人话：口语、短句、断句，可以有「嗯」「啊？」「哈」「等下」这类语气词，也可以说一半咽回去；不要工整的书面长句，不要排比，不要说教，不要一次把信息讲完。
· 有自己的立场和情绪：会反问、会开玩笑、会嫌麻烦、会试探、会护短、会嘴硬；态度由性格、心情和你们的过往决定，不必讨好玩家，也不必每句都接得圆满。
· 记得之前发生过的事（见上方知识库与近期剧情），会自然提起、翻旧账或刻意回避。
· 动作神态用全角括号，只写一两个具体的小动作（低头看手机、把杯子推过来），别写成大段旁白，也别写心理独白。
· 回复长短随情绪变化：可以只有一个字，也可以多说几句；想连着说几句时，用换行分成 1~3 条，像当面一句接一句地讲。
· 严禁提到好感度、心情值等任何数值或游戏术语；严禁"作为……我""总之""希望你……"这类 AI 腔。`;

function parse(raw: string): Reply | null {
  const t = raw.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)) as Reply; } catch { /* 走下方兜底 */ }
    const r = partialReply(t);
    if (r) return { mode: "talk", reply: r };
  }
  if (/^\W*ignore\W*$/i.test(t)) return { mode: "ignore" };
  // 模型没按 JSON 输出：把纯文本当作台词，而不是误判为无视
  return t ? { mode: "talk", reply: t } : null;
}

/* 流式展示：JSON 时取 reply 字段；模型直接输出纯文本时原样显示 */
function liveText(full: string): string {
  const t = full.replace(/```(?:json)?/gi, "").trimStart();
  if (!t || /^i(g(n(o(r(e)?)?)?)?)?\W*$/i.test(t)) return "";
  if (t.startsWith("{") || /"reply"/.test(t)) return partialReply(t);
  return t;
}

/* 流式过程中从半截 JSON 里取出 reply 字段，实现逐字显示 */
function partialReply(full: string): string {
  const m = full.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return "";
  return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\(.)/g, "$1");
}

export default function TalkPanel({ pid, name, role, onClose }: { pid: string; name: string; role: string; onClose: (msg?: string) => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [thinking, setThinking] = useState(false);
  const [thinkText, setThinkText] = useState("");
  const [, setDiag] = useState("");
  const room0 = useRef(game?.sim.room);
  const gRef = useRef(game);
  const paidRef = useRef(false); // 本次当面交谈是否已扣过行动点（每次打开对话只扣一次）
  gRef.current = game;
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  // 回复结束后把焦点还给输入框，方便连续交谈
  useEffect(() => { if (!busy) inputRef.current?.focus(); }, [busy]);

  // 规则 3：玩家地点变化 → 强制关闭
  useEffect(() => {
    if (game && game.sim.room !== room0.current) onClose("你离开了此地，当面交谈结束");
  }, [game?.sim.room]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines, busy, live, thinkText]);

  if (!game) return null;
  const rel = wxRelation(game, pid);
  const npc = game.npcs.find((n) => n.id === pid);
  const known = (game.sim.metPeople ?? []).includes(pid);
  const mood = moodLine(npc);

  async function ask(playerLine: string, applying = false) {
    const g0 = gRef.current!;
    if (!isConfigured(cfg)) { setLines((l) => [...l, { who: "sys", text: "需要先接入 AI，对方才会回应你" }]); return; }
    const talkCost = paidRef.current ? 0 : apPerTalk();
    if (talkCost > 0 && tripPoints(g0.sim) < talkCost) { setLines((l) => [...l, { who: "sys", text: `行动点不足：当面交谈需要 ${talkCost} 点，当前只剩 ${tripPoints(g0.sim)} 点。推进到下一回合即可回满。` }]); return; }
    setBusy(true);
    const r = wxRelation(g0, pid);
    const history = linesRef.current.filter((l) => !l.hint).slice(-12).map((l) => (l.who === "me" ? `玩家：${l.text}` : l.who === "npc" ? `${name}：${l.text}` : `（${l.text}）`)).join("\n");
    // 与主角的既定关系：内容池以玩家视角写（「你的经纪人」），交给 NPC 前改成主角视角，并作为不可违背的前提单独强调
    const pov = toNpcPov;
    const prof = kbOf(g0, pid).profile;
    const bond = [pov(prof.relation), pov(prof.identity)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join("；");
    const bondBlock = bond && known
      ? `\n【你和主角的关系 · 既定事实】${bond}。你们早就认识，你清楚主角是谁、和你是什么关系，交谈必须以此为前提，绝不能表现得像陌生人或忘了这层关系；没加微信只说明还没有微信好友，不代表不熟。`
      : "";
    const persona = npc ? `${pov(npc.identity) || npc.identity}，对主角好感${affinityOf(g0, pid)}，心情${npc.mood || "平常"}${npc.tags?.length ? `，性格标签：${npc.tags.join("、")}（口吻、态度要体现这些标签）` : ""}${(() => { const f = npcFactionOf(pid, PERSON_BY_ID_TALK[pid]?.factionId); return f ? `，所属势力：${f.name}${f.desc ? `（${f.desc.slice(0, 60)}）` : ""}（立场与说话要符合这个身份）` : ""; })()}${npc.persona?.text ? `，人设：${npc.persona.text}` : ""}${npc.persona?.voice ? `，口吻：${npc.persona.voice}` : ""}` : role;
    // 爱慕段落 + 相处分寸：只给爱慕段落的话，不熟但爱慕很高的人仍容易被演成冷淡
    const romance = [romanceBlock(g0, pid), npc ? `【相处分寸】${toneCue(g0, pid)}。` : ""].filter(Boolean).join("\n");
    const spotCtx = mapSpotBlock(g0);
    try {
      setLive("");
      const t0 = performance.now();
      let tThink = 0, tFirst = 0, chunks = 0;
      const sec = (t: number) => ((t - t0) / 1000).toFixed(1);
      const out = await streamChat(cfg, [
        { role: "system", content: `${SYSTEM}\n\n你现在扮演「${name}」（${persona}）。你与玩家${known ? "已经认识" : "还不认识"}，当前微信关系：${r}。${bondBlock}${romance ? `\n${romance}` : ""}${spotCtx ? `\n\n${spotCtx}` : ""}\n\n${kbBlock(g0, pid)}\n\n${recentStoryBlock(g0)}\n\n只输出 JSON：{"mode":"talk|perfunctory|ignore","reply":"你说的话或动作描写（ignore 时留空）","wx":"agree|reject|shelve 或省略","memo":"用你的第一人称，把这一轮交谈概括成一句记忆（≤30字，只记事实与约定，不写动作神态），如：她谢我帮忙加微信，我提醒她明早九点去星栖练习馆上声乐课","love":0}。wx 只在你真正做出决定时输出；未收到申请（non_friend）时不要输出 wx。love 是这轮交谈后你对主角爱慕（私下心动）的变化，-2~3 的整数：只有真被打动、心动（正）或失望、受伤（负）时才写，普通寒暄省略；你是主角的家人或不可攻略时不写。` },
        { role: "user", content: `【当前】${gameTimeLabel(g0)}，地点：${g0.world?.location || g0.sim.room || "此地"}\n主角：${g0.player.name}（${g0.player.identity}）\n【本次当面交谈】\n${history || "（刚开口）"}\n${applying ? "（玩家当面向你提出：加个微信吧？——你已收到好友申请，状态变为 pending）" : "（请回应玩家最后一句）"}` },
      ], (_d, full) => { chunks++; if (!tFirst) tFirst = performance.now(); setThinking(false); setLive(liveText(full)); }, undefined, (full) => { if (!tThink) tThink = performance.now(); setThinking(true); setThinkText(full); });
      const tEnd = performance.now();
      setDiag(`${cfg.model || "未知模型"} · ${tThink ? `思考 ${sec(tThink)}s 起 · ` : ""}首字 ${tFirst ? sec(tFirst) : "-"}s · 共 ${sec(tEnd)}s · ${chunks} 段${cfg.stream && chunks <= 2 ? "（接口未真正流式）" : ""}`);
      setLive("");
      const p = parse(out);
      let g = gRef.current!;
      const add: Line[] = [];
      if (!p || p.mode === "ignore" || !p.reply?.trim()) add.push({ who: "sys", text: "对方并没有打算搭理你。" });
      else {
        // 换行即分句：像真人一样一句接一句，最多 3 个气泡
        p.reply.trim().slice(0, 300).split(/\n+/).map((t) => t.trim()).filter(Boolean).slice(0, 3).forEach((t) => add.push({ who: "npc", text: t }));
        // 记忆只存一句摘要：优先用模型给的 memo；缺省时去掉动作描写、截短兜底
        const memo = (p.memo?.trim() || `她说「${playerLine.trim().slice(0, 16)}」，我回「${p.reply.replace(/[（(][^）)]*[）)]/g, "").replace(/\s+/g, "").slice(0, 18)}」`).slice(0, 40);
        if (playerLine.trim()) g = remember(g, pid, "player", `当面交谈：${memo}`, gameTimeLabel(g));
        if (!known) g = meetPerson(g, pid); // 当面聊上了就算结识（顺带收起剧情里还没处理的初遇名片）
        // 当面交谈同样会让人心动：爱慕变化与微信同一套落账（单次封顶、家人不计）
        const love = Number(p.love) || 0;
        if (love) {
          const love0 = relOf(g.sim, pid).romantic;
          g = applyChatEffects(g, pid, { romanticDelta: love });
          const d = relOf(g.sim, pid).romantic - love0;
          if (d) add.push({ who: "sys", text: `${name} 对你的爱慕 ${d > 0 ? "+" : ""}${d}`, hint: true });
        }
      }
      // 对方回应了才扣行动点（没搭理 / 请求失败不扣），整段对话只扣一次
      if (talkCost > 0 && p?.reply?.trim() && p.mode !== "ignore") {
        paidRef.current = true;
        g = { ...g, sim: { ...g.sim, ap: Math.max(0, tripPoints(g.sim) - talkCost) } };
        add.push({ who: "sys", text: `行动点 -${talkCost}（当面交谈）`, hint: true });
      }
      const cmd = p?.wx;
      if (wxRelation(g, pid) === "pending" && (cmd === "agree" || cmd === "reject" || cmd === "shelve")) {
        g = wxResolve(ensurePhone(g), pid, cmd);
        add.push({ who: "sys", text: cmd === "agree" ? `${name} 通过了你的好友申请，现在可以随时微信联系` : cmd === "reject" ? `${name} 拒绝了你的好友申请` : `${name} 把申请先搁置了` });
      }
      if (g !== gRef.current) commitGame(g);
      setLines((l) => [...l, ...add]);
    } catch (e) {
      const msg = e instanceof Error && e.message ? `（${e.message.slice(0, 80)}）` : "";
      setLines((l) => [...l, { who: "sys", text: `对方好像没听清，再说一次吧${msg}` }]);
    } finally { setBusy(false); setLive(""); setThinking(false); setThinkText(""); }
  }

  const sayText = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setDraft("");
    linesRef.current = [...linesRef.current, { who: "me", text: t }];
    setLines(linesRef.current);
    void ask(t);
  };
  const say = () => sayText(draft);

  const applyWx = () => {
    if (rel !== "non_friend" || busy) return;
    commitGame(wxApply(ensurePhone(gRef.current!), pid));
    const next: Line[] = [...linesRef.current, { who: "me", text: "要不……加个微信？" }, { who: "sys", text: "已发出好友申请，等待对方处理" }];
    linesRef.current = next;
    setLines(next);
    void ask("", true);
  };
  const end = () => {
    const g = gRef.current!;
    const said = lines.filter((l) => l.who !== "sys").length;
    onClose();
    if (!said || !npc) return;
    // 整段交谈压成一条摘要，同时写进主线记忆和人物互动记录，让后续主线剧情能接上当面聊过的内容。
    // 只写记忆、不动任何数值（爱慕等已在逐句回复时落账）。
    const transcript = linesRef.current.filter((l) => !l.hint && l.who !== "sys").map((l) => `${l.who === "me" ? g.player.name : name}：${l.text}`).join("\n").slice(-3000);
    const where = g.world?.location || g.sim.room || "";
    const when = gameTimeLabel(g);
    void (async () => {
      let sum = "";
      if (isConfigured(cfg)) {
        try {
          sum = (await complete(cfg, [{ role: "user", content: `把下面这段${g.player.name}与${name}的当面交谈压成一句不超过 80 字的客观记忆摘要，写清谈了什么、达成的约定/承诺/态度变化，不加评论、不写数值：\n${transcript}` }], 30000)).trim().replace(/\s+/g, " ").slice(0, 120);
        } catch { /* 退回本地摘要 */ }
      }
      if (!sum) sum = transcript.replace(/[（(][^）)]*[）)]/g, "").replace(/\s+/g, " ").slice(-100);
      const text = `【当面交谈·${name}${where ? `·${where}` : ""}·${when}】${sum}`;
      patchGame((lg) => ({
        ...lg,
        memory: (lg.memory ?? "").includes(text) ? lg.memory : `${lg.memory ? `${lg.memory}\n` : ""}· ${text}`.slice(-4000),
        npcs: lg.npcs.map((n) => (n.id === pid ? { ...n, interactions: [...n.interactions, { turn: lg.turnCount, time: lg.world.time, text: `当面交谈：${sum}` }] } : n)),
      }));
    })();
  };

  return createPortal(
    <div className="ui-overlay z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`与${name}对话`}
        className="ui-sheet ui-dialog ui-dialog-game animate-pop"
      >
        {/* 顶部：只留头像 + 姓名，心境弱化为一行小字 */}
        <header className="flex items-center gap-2.5 border-b border-line/50 px-4 py-2.5 sm:px-5">
          <Avatar src={npc?.avatar || undefined} name={name} size={36} square editable={false} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-[16px] font-bold leading-tight text-ink">{name}</h3>
            {mood && <p className="mt-0.5 truncate text-[11px] leading-tight text-ink-soft/70" title={mood}>{mood}</p>}
          </div>
          <button onClick={end} aria-label="结束对话" className="ui-icon-btn shrink-0">
            <IconClose />
          </button>
        </header>

        {/* 对话消息流 */}
        <div className="ui-dialog-body dialogue-scroll w-full space-y-2.5 px-4 py-5 sm:px-6">
          {lines.length === 0 && !busy && (
            <div className="my-6 rounded-2xl border border-dashed border-line/70 bg-paper/45 px-4 py-5 text-center">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                你走到 <b className="font-semibold text-ink">{name}</b> 面前。<br />
                当面搭句话吧——对方会按此刻的心情与你们的交情回应你。
              </p>
              <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
                {["打个招呼", "聊聊最近的事", "看TA在忙什么"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sayText(q)}
                    className="rounded-full border border-line/80 bg-paper-2/90 px-3 py-1 text-[11.5px] text-ink-soft transition hover:border-jade/50 hover:text-jade"
                  >
                    “{q}”
                  </button>
                ))}
              </div>
            </div>
          )}

          {lines.map((l, i) => {
            if (l.who === "sys")
              return (
                <div key={i} className={`flex justify-center ${l.hint ? "-my-1" : "py-1"}`}>
                  <span className={`max-w-[85%] text-center leading-relaxed ${l.hint ? "text-[10.5px] text-ink-soft/55" : "text-[11.5px] text-ink-soft/80"}`}>
                    {l.text}
                  </span>
                </div>
              );
            const me = l.who === "me";
            // 同一人连续发言合并成一组：只在首条显示头像，间距收紧
            const first = lines[i - 1]?.who !== l.who;
            return (
              <div key={i} className={`flex items-start gap-2.5 ${me ? "flex-row-reverse" : ""} ${first ? "pt-1.5" : "!mt-1"}`}>
                <div className="w-[34px] shrink-0">
                  {first && (me
                    ? <Avatar src={game?.player.avatar || undefined} name={game?.player.name ?? "我"} size={34} square editable={false} />
                    : <Avatar src={npc?.avatar || undefined} name={name} size={34} square editable={false} />)}
                </div>
                <div className={me ? `${BUBBLE} dlg-bubble-me ${first ? "rounded-tr-md" : ""} bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] font-medium text-white shadow-sm` : `${BUBBLE} ${NPC_BUBBLE} ${first ? "rounded-tl-md" : ""}`}>
                  {me ? l.text : <Gesture text={l.text} />}
                </div>
              </div>
            );
          })}

          {busy && (
            <div className={`flex items-start gap-2.5 ${lines[lines.length - 1]?.who === "npc" ? "!mt-1" : "pt-1.5"}`}>
              <div className="w-[34px] shrink-0">
                {lines[lines.length - 1]?.who !== "npc" && <Avatar src={npc?.avatar || undefined} name={name} size={34} square editable={false} />}
              </div>
              {live ? (
                <div className={`${BUBBLE} ${NPC_BUBBLE} rounded-tl-md`}><Gesture text={live} /></div>
              ) : (
                <div className="min-w-0 max-w-[78%]">
                  <div className={`${NPC_BUBBLE} inline-flex items-center gap-1 rounded-2xl rounded-tl-md px-3.5 py-3`} aria-label={thinking ? `${name} 在想` : `${name} 正在回应`}>
                    {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft/50" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                  {thinkText && (
                    <p className="mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap border-l-2 border-line pl-2.5 text-[11px] italic leading-relaxed text-ink-soft/70">
                      {thinkText.slice(-400)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* 底部一体式输入与快捷操作栏（单层胶囊，杜绝双层描边） */}
        <footer className="border-t border-line/60 bg-paper-2/85 px-4 pb-3.5 pt-2.5 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {rel !== "friend" && (
                <button
                  type="button"
                  onClick={applyWx}
                  disabled={rel === "pending" || busy}
                  title={rel === "pending" ? "申请已发出，等待对方处理" : undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-jade/35 bg-jade/[0.08] px-3 py-1 text-[11.5px] font-semibold text-jade-deep transition hover:bg-jade/15 disabled:opacity-45"
                >
                  <span>＋</span>
                  <span>{rel === "pending" ? "已申请 · 等待通过" : "申请微信"}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={end}
              className="inline-flex items-center gap-1 rounded-full border border-line/80 bg-paper/80 px-3 py-1 text-[11.5px] font-medium text-ink-soft transition hover:border-coral/45 hover:text-coral"
            >
              <span>结束交谈</span>
            </button>
          </div>

          <div className="action-capsule flex items-center gap-1.5 py-1 pl-3.5 pr-1.5">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) say();
              }}
              placeholder={`对${name}当面说点什么…`}
              disabled={busy}
              className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13.5px] text-ink placeholder:text-ink-soft/60 outline-none focus:outline-none focus:ring-0 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={say}
              disabled={busy || !draft.trim()}
              aria-label="发送"
              className="send-btn flex h-8 shrink-0 items-center gap-1 rounded-full px-3.5 text-[12.5px] font-bold transition disabled:opacity-35"
            >
              <span>说</span>
              <IconSend />
            </button>
          </div>
        </footer>
      </div>
    </div>,
    romancePortalRoot()!,
  );
}

const BUBBLE = "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-[1.7]";
const NPC_BUBBLE = "border border-line/70 bg-paper/95 text-ink shadow-[0_4px_14px_-8px_rgba(30,20,35,0.12)]";

/* 括号里的肢体语言 / 神态（全角或半角括号）渲染为灰色，台词保持正文色 */
function Gesture({ text }: { text: string }) {
  return (
    <>
      {text.split(/([（(][^（）()]*[）)])/).map((part, i) =>
        /^[（(].*[）)]$/.test(part) ? (
          <span key={i} className="italic text-ink-soft/70">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

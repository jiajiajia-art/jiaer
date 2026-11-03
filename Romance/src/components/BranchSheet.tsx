import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import { useGame, useLive } from "../store/gameCtx";
import { Segments } from "./StoryTab";
import NewcomerCards from "./NewcomerCards";
import { newcomerSlots } from "../game/npcIntro";
import { hopEnergy, tripPoints } from "../game/mud";

/* 支线剧场：点地图事件 / 邂逅 / 支线剧情后进入。入口已扣体力，本支线内的每一步行动都不再扣体力。
 * 可「收起」去看别的页面（右下角留一枚续玩胶囊），也可「结束支线」回到主线，整段落入剧情志。 */
export default function BranchSheet() {
  const { game, busy, branchAct, leaveBranch } = useGame();
  const live = useLive();
  const b = game?.branch;
  const [min, setMin] = useState(false);
  const [input, setInput] = useState("");
  const [confirm, setConfirm] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (b && !b.turns.length) setMin(false); }, [b]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [b?.turns.length, live]);
  useEffect(() => { setConfirm(false); }, [b?.srcId]);
  if (!game || !b) return null;

  const act = (v: string) => { if (!busy && v.trim()) { branchAct(v); setInput(""); } };
  const introSlots = newcomerSlots(b.turns); // 支线里初遇的人物：名片挂在 TA 最近一次登场的回合底部

  if (min)
    return createPortal(
      <button onClick={() => setMin(false)} className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-3 z-50 flex items-center gap-2 rounded-full border border-coral/50 bg-paper-2/95 py-2 pl-2.5 pr-3.5 text-[12.5px] font-bold text-ink shadow-xl backdrop-blur">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-coral text-[11px] font-black text-white">!</span>
        支线进行中 · {b.title.slice(0, 10)}
        <span className="text-coral">继续 ›</span>
      </button>,
      romancePortalRoot()!,
    );

  return createPortal(
    <div className="ui-overlay z-50">
      <section role="dialog" aria-modal="true" aria-label={b.title} className="ui-sheet ui-dialog animate-pop">
        {/* 顶部：支线身份 + 体力规则 */}
        <header className="relative shrink-0 border-b border-line/70 px-4 pb-3 pt-2.5 sm:px-5">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="ui-kicker">{b.kind === "quest" ? "支线剧情" : "地点事件"} · 支线</p>
              <h2 className="ui-title truncate text-[18px]">{b.title}</h2>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">{[b.location, b.when].filter(Boolean).join(" · ")}</p>
            </div>
            <button onClick={() => setMin(true)} className="ui-btn ui-btn-sm shrink-0">收起</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="ui-chip tone-coral text-[11px]">入口已扣行动点 {b.cost}</span>
            <span className="ui-chip tone-jade text-[11px]">支线内行动 · 不扣行动点</span>
            <span className="ui-chip text-[11px]">剩余行动点 {tripPoints(game.sim)}</span>
          </div>
        </header>

        {/* 支线正文 */}
        <div className="ui-dialog-body px-4 py-4">
          {b.annotation && <p className="mb-4 rounded-xl border border-dashed border-line px-3 py-2 text-[12px] leading-relaxed text-ink-soft">{b.annotation}</p>}
          {b.turns.map((t) =>
            t.role === "player" ? (
              <div key={t.id} className="my-3 flex justify-end">
                <p className="ui-bubble ui-bubble-me">{t.segments.map((s) => s.text).join("")}</p>
              </div>
            ) : (
              <div key={t.id}>
                <Segments segments={t.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
                <NewcomerCards ids={introSlots.get(t.id)} />
              </div>
            ),
          )}
          {busy && (
            <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-soft">
              {live || "剧情展开中"}<span className="ml-0.5 inline-block animate-pulse">▍</span>
            </p>
          )}
          <div ref={endRef} />
        </div>

        {/* 行动区 */}
        <footer className="ui-sheet-foot shrink-0 px-3 pt-2.5">
          {!busy && b.options.length > 0 && (
            <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:flex-wrap">
              {b.options.map((o, i) => (
                <button key={i} onClick={() => act(o.value || o.label)} className="ui-btn ui-btn-soft ui-btn-sm shrink-0">
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); act(input); } }}
              rows={1}
              disabled={busy}
              placeholder="在支线里做点什么……"
              className="ui-input max-h-28 min-h-[42px] flex-1 resize-none rounded-[20px] px-4 py-2.5 disabled:opacity-50"
            />
            <button onClick={() => act(input)} disabled={busy || !input.trim()} className="ui-btn ui-btn-primary ui-btn-lg shrink-0">行动</button>
          </div>
          <div className="mt-2 flex justify-center">
            {confirm ? (
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-ink-soft">结束后回到主线，本段存入剧情志</span>
                <button onClick={leaveBranch} disabled={busy} className="ui-btn ui-btn-primary ui-btn-sm tone-coral">确认结束</button>
                <button onClick={() => setConfirm(false)} className="ui-btn ui-btn-sm">再想想</button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} disabled={busy} className="text-[12px] font-semibold text-ink-soft underline-offset-4 hover:text-coral hover:underline disabled:opacity-40">结束支线 · 回到主线</button>
            )}
          </div>
        </footer>
      </section>
    </div>,
    romancePortalRoot()!,
  );
}

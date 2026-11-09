/* 剧情初遇：新人物改成一行（左：名字+身份，右：结识）。
 * 点行弹出人物详情；点「结识」记入人脉并触发结识剧情（AI 演绎 + memory 摘要）。 */
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { introState } from "../game/npcIntro";
import type { Npc } from "../lib/types";
import { IconCheck } from "../lib/icons";
import { Avatar, Modal } from "./ui";
import PersonProfile from "./PersonProfile";
import { affiliationOf } from "./personFields";

function identityLine(n: Npc): string {
  return affiliationOf(n.identity) || n.identity?.trim() || n.relation?.trim() || "新面孔";
}

function MeetRow({
  n,
  busy,
  onMeet,
  onOpen,
}: {
  n: Npc;
  busy: boolean;
  onMeet: () => void;
  onOpen: () => void;
}) {
  const line = identityLine(n);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`查看 ${n.name} 的人物详情`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper/90 py-1.5 pl-1.5 pr-1.5 text-left shadow-sm transition hover:border-jade/50"
    >
      <Avatar src={n.avatar || undefined} name={n.name} size={32} editable={false} />
      <span className="min-w-0 flex-1 truncate">
        <b className="font-serif text-[13.5px] text-ink">{n.name}</b>
        <span className="ml-1.5 text-[11.5px] text-ink-soft">{line}</span>
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label={`结识${n.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onMeet();
        }}
        className="ui-btn ui-btn-primary ui-btn-sm shrink-0 tone-coral"
      >
        结识
      </button>
    </div>
  );
}

function Receipt({ n, met }: { n: Npc; met: boolean }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 py-1 pl-1 pr-2 text-xs text-ink-soft"
    >
      <Avatar src={n.avatar || undefined} name={n.name} size={24} editable={false} />
      <span className="min-w-0 flex-1 truncate">
        {met ? (
          <>
            已结识 <b className="text-ink">{n.name}</b> · 已记入人脉
          </>
        ) : (
          <>
            已略过 <b className="text-ink">{n.name}</b>
          </>
        )}
      </span>
      {met && <IconCheck aria-hidden className="size-4 shrink-0 text-jade" />}
    </div>
  );
}

export default function NewcomerCards({ ids }: { ids?: string[] }) {
  const { game, busy, meetNewcomer } = useGame();
  const [decided, setDecided] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  if (!game || !ids?.length) return null;
  const people = ids
    .map((id) => game.npcs.find((n) => n.id === id))
    .filter((n): n is Npc => !!n);
  const open = people.filter((n) => introState(game, n.id) === "pending");
  const done = people.filter(
    (n) => decided.includes(n.id) && introState(game, n.id) !== "pending",
  );
  if (!open.length && !done.length) return null;

  const detail = detailId ? game.npcs.find((n) => n.id === detailId) : null;
  const detailKnown = detail ? introState(game, detail.id) === "met" : false;

  return (
    <section aria-label="初遇人物" className="mt-3 space-y-1.5">
      {open.length > 0 && (
        <>
          <p className="text-[11px] font-bold tracking-[0.14em] text-ink-soft">初 遇</p>
          <div className="space-y-1.5">
            {open.map((n) => (
              <MeetRow
                key={n.id}
                n={n}
                busy={busy}
                onOpen={() => setDetailId(n.id)}
                onMeet={() => {
                  setDecided((d) => (d.includes(n.id) ? d : [...d, n.id]));
                  setDetailId(null);
                  meetNewcomer(n.id);
                }}
              />
            ))}
          </div>
        </>
      )}
      {done.map((n) => (
        <Receipt key={n.id} n={n} met={introState(game, n.id) === "met"} />
      ))}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetailId(null)}>
          {detailKnown ? (
            <PersonProfile pid={detail.id} known />
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar src={detail.avatar || undefined} name={detail.name} size={56} editable={false} />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[18px] font-black text-ink">{detail.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-soft">{identityLine(detail)}</p>
                </div>
              </div>
              {detail.bio && (
                <p className="story-prose whitespace-pre-line rounded-[var(--radius-ui)] border border-line bg-paper-2/60 px-3 py-2.5 text-[13px] leading-relaxed text-[color:var(--story-ink)]">
                  {detail.bio}
                </p>
              )}
              <div className="flex justify-end border-t border-line pt-3">
                <button
                  type="button"
                  disabled={busy}
                  className="ui-btn ui-btn-primary tone-coral"
                  onClick={() => {
                    setDecided((d) => (d.includes(detail.id) ? d : [...d, detail.id]));
                    setDetailId(null);
                    meetNewcomer(detail.id);
                  }}
                >
                  结识
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

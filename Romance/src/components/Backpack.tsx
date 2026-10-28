import { createPortal } from "react-dom";
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import { IconSpark } from "../lib/icons";
import ContractDoc from "./ContractDoc";
import { worldItemById as itemById } from "../mods/registry";
import { findCustomItem } from "../game/mapedits";

/** 行囊内容可嵌入人物档案，也可独立以弹窗形式使用。 */
export default function Backpack({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { game, simUseItem, simGiftItem } = useGame();
  const [openContract, setOpenContract] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [giftItem, setGiftItem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [pageState, setPageState] = useState(0);
  if (!game) return null;

  const s = game.sim;
  const bag = s.bag ?? [];
  const empty = !game.contract && bag.length === 0;
  const contacts = game.npcs.filter((n) => (s.metPeople ?? []).includes(n.id));
  const resolve = (id: string) => {
    const base = itemById(id);
    if (base) return base;
    const custom = findCustomItem(game, id);
    return custom ? { id: custom.id, name: custom.name, desc: custom.desc, icon: custom.icon ?? "", price: undefined } : undefined;
  };
  const useItem = (id: string) => {
    const msg = simUseItem(id);
    if (msg) setFeedback(msg);
    else { setFeedback("已使用，互动记录已写入行程。 "); setOpenItem(null); }
  };
  const giftTo = (personId: string) => {
    if (!giftItem) return;
    const msg = simGiftItem(giftItem, personId);
    if (msg) setFeedback(msg);
    else { setFeedback("礼物已送出，关系已更新。 "); setGiftItem(null); setOpenItem(null); }
  };

  // ═══ RPG 格子背包：合约占首格，其后为行囊物件；每页 20 格，不足补空格，底部翻页 ═══
  const PER_PAGE = 20;
  type Cell = { kind: "contract" } | { kind: "item"; id: string };
  const cells: Cell[] = [
    ...(game.contract ? [{ kind: "contract" } as Cell] : []),
    ...bag.map((id) => ({ kind: "item", id } as Cell)),
  ];
  const pageCount = Math.max(1, Math.ceil(cells.length / PER_PAGE));
  const page = Math.min(pageState, pageCount - 1);
  const start = page * PER_PAGE;
  // 嵌入档案时只补齐到整行（5 格一行），不铺满 20 个空格
  const pageCells = cells.slice(start, start + PER_PAGE);
  const len = embedded ? Math.max(5, Math.ceil(pageCells.length / 5) * 5) : PER_PAGE;
  const slots: (Cell | null)[] = Array.from({ length: len }, (_, i) => pageCells[i] ?? null);

  const content = (
    <>
      {feedback &&<p className="mb-3 rounded-xl border border-jade/30 bg-jade/[0.06] px-3 py-2 text-[12px] leading-[1.6] text-jade">{feedback}</p>}
      <div className={embedded ? "" : "rounded-2xl border border-line bg-black/[0.03] p-2.5"}>
        <div className={`grid gap-2 ${embedded ? "grid-cols-5" : "grid-cols-4 sm:grid-cols-5"}`}>
          {slots.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} className="aspect-square rounded-[12px] border border-dashed border-line/60" aria-hidden />;
            }
            if (cell.kind === "contract") {
              return (
                <button key="contract" onClick={() => setOpenContract(true)} title={`经纪合约 · ${game.contract!.company}`} className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border border-gold/50 bg-gold/[0.06] p-1 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/20 text-gold"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg></span>
                  <span className="line-clamp-1 text-[10.5px] font-semibold text-gold">经纪合约</span>
                </button>
              );
            }
            const it = resolve(cell.id);
            if (!it) return <div key={`empty-${i}`} className="flex aspect-square rounded-lg border border-dashed border-line/70 bg-black/[0.02]" aria-hidden />;
            return (
              <button key={`${cell.id}-${i}`} onClick={() => { setFeedback(""); setOpenItem(cell.id); }} title={it.name} className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border border-line bg-paper-2 p-1 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05] text-[18px]">{it.icon || <IconSpark size={18} />}</span>
                <span className="line-clamp-1 w-full text-[10.5px] font-semibold text-ink">{it.name}</span>
              </button>
            );
          })}
        </div>
        {empty && <p className="py-4 text-center text-[12px] text-ink-soft">行囊空空，沿途拾取的物件会收纳在此。</p>}
        {pageCount > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-3 border-t border-line pt-2.5">
            <button onClick={() => setPageState((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-line bg-paper px-3 py-1 text-[13px] font-semibold text-ink transition enabled:hover:border-gold disabled:opacity-35">‹ 上一页</button>
            <span className="text-[12px] tabular-nums text-ink-soft">{page + 1} / {pageCount}</span>
            <button onClick={() => setPageState((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="rounded-lg border border-line bg-paper px-3 py-1 text-[13px] font-semibold text-ink transition enabled:hover:border-gold disabled:opacity-35">下一页 ›</button>
          </div>
        )}
      </div>
    </>
  );

  const overlays = createPortal(
    <>
      {openItem && (() => {
        const it = resolve(openItem);
        if (!it) return null;
        return (
          <div className="ui-overlay z-[60]" onClick={() => setOpenItem(null)}>
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="ui-sheet animate-pop max-w-sm p-5">
              <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/[0.04] text-[24px]">{it.icon || <IconSpark size={24} />}</span><div><p className="text-[16px] font-bold text-ink">{it.name}</p>{it.price ? <p className="text-[12px] text-gold">价值 ¥{it.price}</p> : null}</div></div>
              <p className="mt-3 text-[14px] leading-[1.6] text-ink/85">{it.desc}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => useItem(openItem)} className="ui-btn ui-btn-soft ui-btn-lg">使用</button>
                <button onClick={() => { setGiftItem(openItem); setOpenItem(null); }} className="ui-btn ui-btn-soft ui-btn-lg tone-gold">赠送</button>
              </div>
              <button onClick={() => setOpenItem(null)} className="ui-btn ui-btn-ghost ui-btn-block mt-2">收好</button>
            </div>
          </div>
        );
      })()}
      {giftItem && (() => {
        const it = resolve(giftItem);
        if (!it) return null;
        return (
          <div className="ui-overlay z-[70]" onClick={() => setGiftItem(null)}>
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className="ui-sheet animate-pop max-w-sm p-5">
              <p className="text-[16px] font-bold text-ink">把「{it.name}」送给谁？</p>
              <p className="mt-1 text-[12px] text-ink-soft">赠送后物品会离开行囊，对方关系与好感 +5。</p>
              <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
                {contacts.map((person) => <button key={person.id} onClick={() => giftTo(person.id)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper-2 px-3 py-2.5 text-left transition hover:border-gold hover:bg-gold/5"><span><span className="block text-[14px] font-semibold text-ink">{person.name}</span><span className="block text-[12px] text-ink-soft">{person.identity || person.relation || "联系人"}</span></span><span className="text-gold">赠予 ›</span></button>)}
                {contacts.length === 0 && <p className="py-4 text-center text-[12px] text-ink-soft">先在地图中认识一位联系人，才能赠礼。</p>}
              </div>
              <button onClick={() => setGiftItem(null)} className="ui-btn ui-btn-ghost ui-btn-block mt-3">取消</button>
            </div>
          </div>
        );
      })()}
      {openContract && game.contract && <ContractDoc contract={game.contract} onClose={() => setOpenContract(false)} />}
    </>,
    document.body,
  );

  if (embedded) return <section>{content}{overlays}</section>;
  return <Modal title="背包 · 行囊" onClose={onClose ?? (() => undefined)}>{content}{overlays}</Modal>;
}

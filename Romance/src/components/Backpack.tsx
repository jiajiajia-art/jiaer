import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import ContractDoc from "./ContractDoc";
import { itemById } from "../worlds/star2005/content";
import { findCustomItem } from "../game/mapedits";

/** 行囊内容可嵌入人物档案，也可独立以弹窗形式使用。 */
export default function Backpack({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { game, simUseItem, simGiftItem, submit } = useGame();
  const [openContract, setOpenContract] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [giftItem, setGiftItem] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  if (!game) return null;

  const s = game.sim;
  const bag = s.bag ?? [];
  const empty = !game.contract && bag.length === 0;
  const contacts = game.npcs.filter((n) => (s.metPeople ?? []).includes(n.id));
  const resolve = (id: string) => {
    const base = itemById(id);
    if (base) return base;
    const custom = findCustomItem(game, id);
    return custom ? { id: custom.id, name: custom.name, desc: custom.desc, icon: custom.icon ?? "◇", price: undefined } : undefined;
  };
  const useItem = (id: string) => {
    const msg = simUseItem(id);
    if (msg) setFeedback(msg);
    else { setFeedback("已使用，互动记录已写入行程。 "); setOpenItem(null); }
  };
  const giftTo = (personId: string) => {
    if (!giftItem) return;
    const itemId = giftItem;
    const item = resolve(itemId);
    const person = game?.npcs.find((n) => n.id === personId);
    const msg = simGiftItem(itemId, personId);
    if (msg) setFeedback(msg);
    else {
      setFeedback("礼物已送出，正在记录对方的反应……");
      setGiftItem(null);
      setOpenItem(null);
      if (item && person) void submit(`你把「${item.name}」送给${person.name}。请根据${person.name}的性格、当前关系和这件物品，描写对方收到礼物后的自然反应，并保持事实不变；不要修改数值。`, true);
    }
  };

  const content = (
    <>
      {embedded && (
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-line pb-2">
          <div>
            <p className="text-[12px] font-bold tracking-[0.16em] text-jade">BAG · 行囊</p>
            <p className="mt-1 text-[12px] text-ink-soft">可使用、可赠予已结识的联系人</p>
          </div>
          <span className="rounded-full bg-gold/12 px-2 py-1 text-[12px] font-semibold text-gold">{bag.length} 件</span>
        </div>
      )}
      {feedback && <p className="mb-3 rounded-xl border border-jade/30 bg-jade/[0.06] px-3 py-2 text-[12px] leading-[1.6] text-jade">{feedback}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {game.contract && (
          <button onClick={() => setOpenContract(true)} className="group flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-2 py-3 text-center transition hover:border-gold hover:shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#f3e4bd] to-[#d8bd77] text-[20px] shadow-inner">📜</span>
            <span className="text-[12px] font-semibold text-ink">经纪合约</span>
            <span className="text-[12px] text-ink-soft">{game.contract.company}</span>
          </button>
        )}
        {bag.map((id) => {
          const it = resolve(id);
          if (!it) return null;
          return (
            <button key={`${id}-${it.name}`} onClick={() => { setFeedback(""); setOpenItem(id); }} className="group flex min-h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-[22px] leading-none">{it.icon || "◇"}</span>
              <span className="line-clamp-2 w-full text-[12px] font-semibold leading-tight text-ink">{it.name}</span>
              <span className="text-[11px] text-ink-soft">{it.price ? `¥${it.price}` : "可互动"}</span>
            </button>
          );
        })}
        {empty && <p className="col-span-full py-5 text-center text-[12px] text-ink-soft">行囊空空，沿途拾取的物件会收纳在此。</p>}
      </div>
    </>
  );

  const overlays = (
    <>
      {openItem && (() => {
        const it = resolve(openItem);
        if (!it) return null;
        return (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 px-4 sm:items-center" onClick={() => setOpenItem(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl bg-paper p-5 shadow-2xl sm:rounded-2xl">
              <div className="flex flex-col items-center text-center"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/[0.04] text-[30px] leading-none">{it.icon || "◇"}</span><p className="mt-2 text-[16px] font-bold text-ink">{it.name}</p>{it.price ? <p className="text-[12px] text-gold">价值 ¥{it.price}</p> : null}</div>
              <p className="mt-3 text-center text-[14px] leading-[1.6] text-ink/85">{it.desc}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => useItem(openItem)} className="rounded-xl border border-jade/50 bg-jade/8 py-2 text-[14px] font-semibold text-jade transition hover:bg-jade/15">使用</button>
                <button onClick={() => { setGiftItem(openItem); setOpenItem(null); }} className="rounded-xl border border-gold/55 bg-gold/10 py-2 text-[14px] font-semibold text-gold transition hover:bg-gold/20">赠送</button>
              </div>
              <button onClick={() => setOpenItem(null)} className="mt-2 w-full py-2 text-[12px] text-ink-soft">收好</button>
            </div>
          </div>
        );
      })()}
      {giftItem && (() => {
        const it = resolve(giftItem);
        if (!it) return null;
        return (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 px-4 sm:items-center" onClick={() => setGiftItem(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-2xl bg-paper p-5 shadow-2xl sm:rounded-2xl">
              <p className="text-[16px] font-bold text-ink">把「{it.name}」送给谁？</p>
              <p className="mt-1 text-[12px] text-ink-soft">赠送后物品会离开行囊，对方关系与好感 +5。</p>
              <div className="mt-4 max-h-60 space-y-2 overflow-y-auto">
                {contacts.map((person) => <button key={person.id} onClick={() => giftTo(person.id)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper-2 px-3 py-2.5 text-left transition hover:border-gold hover:bg-gold/5"><span><span className="block text-[14px] font-semibold text-ink">{person.name}</span><span className="block text-[12px] text-ink-soft">{person.identity || person.relation || "联系人"}</span></span><span className="text-gold">赠予 ›</span></button>)}
                {contacts.length === 0 && <p className="py-4 text-center text-[12px] text-ink-soft">先在地图中认识一位联系人，才能赠礼。</p>}
              </div>
              <button onClick={() => setGiftItem(null)} className="mt-3 w-full py-2 text-[12px] text-ink-soft">取消</button>
            </div>
          </div>
        );
      })()}
      {openContract && game.contract && <ContractDoc contract={game.contract} onClose={() => setOpenContract(false)} />}
    </>
  );

  if (embedded) return <section>{content}{overlays}</section>;
  return <Modal title="背包 · 行囊" onClose={onClose ?? (() => undefined)}>{content}{overlays}</Modal>;
}

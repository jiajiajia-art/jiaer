import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import { useState } from "react";
import { useGame, type BagAction } from "../store/gameCtx";
import { Modal } from "./ui";
import { IconClose, IconSpark } from "../lib/icons";
import ContractDoc from "./ContractDoc";
import { worldItemById as itemById } from "../mods/registry";
import { findCustomItem } from "../game/mapedits";

const ACTION_LABEL = { use: "使用", gift: "赠送", discard: "丢弃" };

/** 行囊内容可嵌入人物档案，也可独立以弹窗形式使用。 */
export default function Backpack({ onClose, onAction, embedded = false }: { onClose?: () => void; onAction?: () => void; embedded?: boolean }) {
  const { game, busy, simActOnItem } = useGame();
  const [openContract, setOpenContract] = useState(false);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: BagAction; id: string } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [pageState, setPageState] = useState(0);
  if (!game) return null;

  const s = game.sim;
  const bag = s.bag ?? [];
  const counts = new Map<string, number>();
  for (const id of bag) counts.set(id, (counts.get(id) ?? 0) + 1);
  const empty = !game.contract && bag.length === 0;
  const contacts = game.npcs.filter((n) => (s.metPeople ?? []).includes(n.id));
  const resolve = (id: string) => {
    const base = itemById(id);
    if (base) return base;
    const custom = findCustomItem(game, id);
    if (custom) return { id: custom.id, name: custom.name, desc: custom.desc, icon: custom.icon ?? "", price: undefined };
    const story = game.storyItems?.[id];
    if (story) return { id, ...story, icon: "", price: undefined };
    // 功能注释：卸包残留——定义已不在当前世界，用存档备忘显示，不再变成空格子
    const memo = game.itemMemo?.[id];
    if (memo) {
      const from = memo.modName ? `来自已移除的玩法「${memo.modName}」` : "来自已移除的玩法";
      return { id, name: memo.name, desc: `${memo.desc ? `${memo.desc}\n\n` : ""}${from}，重新安装后即可使用。`, icon: memo.icon ?? "", price: undefined, orphan: true as const };
    }
    return undefined;
  };
  const isOrphan = (it: ReturnType<typeof resolve>) => !!it && "orphan" in it && it.orphan === true;
  const submitAction = (kind: BagAction, id: string, count: number, personId?: string) => {
    const msg = simActOnItem(kind, id, count, personId);
    setFeedback(msg);
    if (msg) return;
    setOpenItem(null);
    setAction(null);
    (onAction ?? onClose)?.();
  };
  const startAction = (kind: BagAction, id: string) => {
    setFeedback("");
    if (kind !== "gift" && counts.get(id) === 1) {
      submitAction(kind, id, 1);
      return;
    }
    setQuantity(1);
    setOpenItem(null);
    setAction({ kind, id });
  };

  // ═══ RPG 格子背包：合约占首格，其后为行囊物件；每页 20 格，不足补空格，底部翻页 ═══
  const PER_PAGE = 20;
  type Cell = { kind: "contract" } | { kind: "item"; id: string };
  const cells: Cell[] = [
    ...(game.contract ? [{ kind: "contract" } as Cell] : []),
    ...Array.from(counts.keys(), (id): Cell => ({ kind: "item", id })),
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
            const count = counts.get(cell.id) ?? 0;
            return (
              <button key={`${cell.id}-${i}`} onClick={() => { setFeedback(""); setOpenItem(cell.id); }} title={it.name} className={`group flex aspect-square flex-col items-center justify-center gap-1 rounded-[12px] border border-line bg-paper-2 p-1 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-sm ${isOrphan(it) ? "opacity-55 grayscale" : ""}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05] text-[18px]">{it.icon || <IconSpark size={18} />}</span>
                <span className="line-clamp-1 w-full text-[10.5px] font-semibold text-ink">{it.name}{count > 1 && ` ×${count}`}</span>
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
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={it.name} className="ui-sheet ui-dialog ui-dialog-game animate-pop">
              <div className="flex items-center gap-3 px-5 pb-2 pt-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/[0.04] text-[24px]">{it.icon || <IconSpark size={24} />}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-bold text-ink">{it.name}</p>{it.price ? <p className="text-[12px] text-gold">价值 ¥{it.price}</p> : null}</div>
                <button onClick={() => setOpenItem(null)} aria-label="关闭" className="ui-icon-btn"><IconClose /></button>
              </div>
              <div className="ui-dialog-body px-5 pb-5">
                <p className="mt-1 whitespace-pre-line text-[14px] leading-[1.6] text-ink/85">{it.desc}</p>
                {feedback && <p role="alert" className="mt-2 text-[12px] text-coral">{feedback}</p>}
                {!isOrphan(it) && <div className="mt-4 grid grid-cols-3 gap-2">
                  {(["use", "gift", "discard"] as const).map((kind) => (
                    <button key={kind} type="button" disabled={busy} onClick={() => startAction(kind, openItem)} className="ui-btn ui-btn-soft ui-btn-lg">{ACTION_LABEL[kind]}</button>
                  ))}
                </div>}
                <button onClick={() => setOpenItem(null)} className="ui-btn ui-btn-ghost ui-btn-block mt-2">收好</button>
              </div>
            </div>
          </div>
        );
      })()}
      {action && (() => {
        const it = resolve(action.id);
        if (!it) return null;
        const available = counts.get(action.id) ?? 0;
        const count = Math.min(quantity, available);
        const label = ACTION_LABEL[action.kind];
        const cancel = () => { setAction(null); setFeedback(""); setOpenItem(action.id); };
        return (
          <div className="ui-overlay z-[70]" onClick={cancel}>
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${label}${it.name}`} className="ui-sheet ui-dialog ui-dialog-game animate-pop">
              <div className="flex items-start gap-3 px-5 pb-2 pt-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold text-ink">{label}「{it.name}」</p>
                  {action.kind === "gift" && <p className="mt-1 text-[12px] text-ink-soft">选择收礼人。每次赠送可提升对方关系与好感。</p>}
                </div>
                <button onClick={cancel} aria-label="关闭" className="ui-icon-btn"><IconClose /></button>
              </div>
              <div className="ui-dialog-body px-5 pb-5">
                {available > 1 && (
                  <label className="mb-3 flex items-center justify-between gap-3 text-[14px] text-ink">
                    {label}数量
                    <select value={count} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-lg border border-line bg-paper-2 px-3 py-2">
                      {Array.from({ length: available }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} 件</option>)}
                    </select>
                  </label>
                )}
                {feedback && <p role="alert" className="mb-2 text-[12px] text-coral">{feedback}</p>}
                {available === 0 && <p className="text-[12px] text-ink-soft">这件物品已不在行囊中。</p>}
                {action.kind === "gift" ? (
                  <div className="mt-2 space-y-2">
                    {contacts.map((person) => <button key={person.id} disabled={busy || count === 0} onClick={() => submitAction("gift", action.id, count, person.id)} className="flex w-full items-center justify-between rounded-xl border border-line bg-paper-2 px-3 py-2.5 text-left transition enabled:hover:border-gold disabled:opacity-40"><span><span className="block text-[14px] font-semibold text-ink">{person.name}</span><span className="block text-[12px] text-ink-soft">{person.identity || person.relation || "联系人"}</span></span><span className="text-gold">赠予 ›</span></button>)}
                    {contacts.length === 0 && <p className="py-4 text-center text-[12px] text-ink-soft">先在地图中认识一位联系人，才能赠礼。</p>}
                  </div>
                ) : (
                  <button disabled={busy || count === 0} onClick={() => submitAction(action.kind, action.id, count)} className="ui-btn ui-btn-soft ui-btn-block mt-2">确认{label}</button>
                )}
                <button onClick={cancel} className="ui-btn ui-btn-ghost ui-btn-block mt-3">取消</button>
              </div>
            </div>
          </div>
        );
      })()}
      {openContract && game.contract && <ContractDoc contract={game.contract} onClose={() => setOpenContract(false)} />}
    </>,
    romancePortalRoot()!,
  );

  if (embedded) return <section>{content}{overlays}</section>;
  return <Modal panelClassName="ui-dialog-game" title="背包 · 行囊" onClose={onClose ?? (() => undefined)}>{content}{overlays}</Modal>;
}

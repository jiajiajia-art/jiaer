/**
 * 编辑器 · 添加玩法 Mod：可视化卡片目录（玩法 + 手机应用）。
 * 依赖由系统解析；缺依赖时用明确中文提示询问是否一并添加，不暴露 slug / JSON。
 */
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  LOCAL_PLAY_MOD_CATALOG,
  catalogBySlug,
  makeInstallFromCatalog,
  missingPlayModDepNames,
  resolvePlayModInstallChain,
  type ComponentKind,
  type PlayModInstallConfig,
} from "../mods/playModCatalog";

type ShelfTab = "推荐" | "最新" | "最热" | "免费" | "已购买" | "已安装";

type Props = {
  installs: PlayModInstallConfig[];
  onChange: (next: PlayModInstallConfig[]) => void;
  onClose: () => void;
  /** 功能注释：缺依赖时询问「是否一并添加」；返回 false 则取消 */
  onConfirmDeps?: (message: string) => Promise<boolean>;
  gameFileId?: string;
  token?: string | null;
};

export default function AddPlayModModal({ installs, onChange, onClose, onConfirmDeps }: Props) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ComponentKind | "all">("all");
  const [tab, setTab] = useState<ShelfTab>("推荐");
  const installed = useMemo(() => new Set(installs.map((x) => x.slug)), [installs]);

  const list = useMemo(() => {
    let rows = LOCAL_PLAY_MOD_CATALOG.filter((x) => kind === "all" || x.componentKind === kind);
    const s = q.trim().toLowerCase();
    if (s) rows = rows.filter((x) => `${x.name}${x.description}`.toLowerCase().includes(s));
    if (tab === "免费") rows = rows.filter((x) => !x.priceKk);
    if (tab === "已安装") rows = rows.filter((x) => installed.has(x.slug));
    if (tab === "已购买") rows = rows.filter((x) => !x.priceKk || installed.has(x.slug));
    if (tab === "最热" || tab === "最新" || tab === "推荐") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "zh"));
    }
    return rows;
  }, [q, kind, tab, installed]);

  const installLocal = async (slug: string) => {
    const item = catalogBySlug(slug);
    if (!item) return;
    if (installed.has(item.slug)) {
      toast.error("已添加到本作品");
      return;
    }
    const depNames = missingPlayModDepNames(item, installs);
    if (depNames.length) {
      const msg = `「${item.name}」需要「${depNames.join("、")}」才能正常使用。是否一并添加？`;
      const ok = onConfirmDeps ? await onConfirmDeps(msg) : true;
      if (!ok) return;
    }
    const chain = resolvePlayModInstallChain(item, installs);
    if (!chain.length) {
      toast.error("已添加到本作品");
      return;
    }
    let next = [...installs];
    for (const row of chain) {
      if (next.some((x) => x.slug === row.slug)) continue;
      // 功能注释：依赖链里非目标项标 autoInstalled，取消主玩法时可提示卸掉无人再需要的自动依赖
      const rowInst = {
        ...makeInstallFromCatalog(row, next.length),
        ...(row.slug !== item.slug ? { autoInstalled: true as const } : {}),
      };
      next = [...next, rowInst];
    }
    onChange(next);
    const names = chain.map((x) => x.name).join("、");
    toast.success(chain.length > 1 ? `已添加：${names}` : `已添加「${item.name}」`);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-label="添加玩法 Mod">
      <div className="flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink">添加玩法 Mod</h2>
            <p className="text-[11px] text-ink-soft">用卡片挑选玩法或手机应用；需要其它功能时会提示你是否一并添加。</p>
          </div>
          <button type="button" className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft" onClick={onClose}>关闭</button>
        </div>
        <div className="space-y-2 border-b border-line px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {([["all", "全部"], ["gameplay", "玩法"], ["phone_app", "手机应用"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${kind === k ? "bg-jade text-paper" : "border border-line text-ink-soft"}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["推荐", "最新", "最热", "免费", "已购买", "已安装"] as ShelfTab[]).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${tab === t ? "border border-jade text-jade" : "border border-line text-ink-soft"}`}>{t}</button>
            ))}
          </div>
          <input className="w-full rounded-xl border border-line bg-paper-2 px-3 py-2 text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索玩法…" />
        </div>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {list.map((item) => {
            const on = installed.has(item.slug);
            const depNames = missingPlayModDepNames(item, installs);
            return (
              <li key={item.id} className="flex items-start gap-3 rounded-xl border border-line bg-paper-2 p-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-paper text-jade" dangerouslySetInnerHTML={{ __html: item.iconSvg }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold text-ink">{item.name}</span>
                    <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">
                      {item.componentKind === "phone_app" ? "手机应用" : "玩法"}
                    </span>
                    <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">{item.priceKk ? `${item.priceKk} KK` : "免费"}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{item.description}</p>
                  {!!depNames.length && !on && (
                    <p className="mt-0.5 text-[10.5px] text-ink-soft">需要：{depNames.join("、")}（添加时可一并安装）</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={on}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${on ? "border border-line text-ink-soft" : "bg-jade text-paper"}`}
                  onClick={() => void installLocal(item.slug)}
                >
                  {on ? "已添加" : depNames.length ? "添加（含依赖）" : "添加"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

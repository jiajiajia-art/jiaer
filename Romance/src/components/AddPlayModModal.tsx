/**
 * 编辑器 · 添加玩法 Mod：商店列表 + 详情页。
 * 点条目（非添加按钮）进详情：作者、下载量、详细说明、预览图；有依赖时按钮写「添加（含依赖）」。
 * 玩法 Mod ≠ 本体（设定/建角/地点/人物/事件/档案不进目录）；也不含娱乐圈/校园等世界观骨架。
 * 功能注释：本弹窗只列玩法；手机应用只在应用商店管理，不在此出现分类/搜索/清单。
 */
import { useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  LOCAL_PLAY_MOD_CATALOG,
  catalogBySlug,
  makeInstallFromCatalog,
  missingPlayModDepNames,
  resolvePlayModInstallChain,
  type LocalPlayModCatalogItem,
  type PlayModInstallConfig,
} from "../mods/playModCatalog";
import {
  THEME_MISMATCH_INSTALL_WARN,
  isItemThemeMismatch,
  type WorldThemeContext,
} from "../lib/officialThemeApplicability";

type ShelfTab = "推荐" | "最新" | "最热" | "免费" | "已购买" | "已安装";

type Props = {
  installs: PlayModInstallConfig[];
  onChange: (next: PlayModInstallConfig[]) => void;
  onClose: () => void;
  /** 功能注释：缺依赖时询问「是否一并添加」；返回 false 则取消 */
  onConfirmDeps?: (message: string) => Promise<boolean>;
  gameFileId?: string;
  token?: string | null;
  /** 功能注释：C0.2 当前世界主题材 id；与玩法适用题材不一致时安装前提示一次（不拦截） */
  worldThemeTagId?: number | null;
  /** 功能注释：无 id 时用题材名 / code 走语义比对 */
  worldThemeLabel?: string | null;
  worldThemeCode?: string | null;
  /** 功能注释：后台启用题材表；用于把官方语义 code 解析成 id 再比对 */
  enabledThemeTags?: WorldThemeContext["enabledThemeTags"];
};

/** 功能注释：预览图 — http(s) 用 img；local: 占位色块（官方种子无 CDN 时） */
function PlayModPreview({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith("local:") || src.startsWith("data:")) {
    if (src.startsWith("data:")) {
      return <img src={src} alt={alt} className="h-36 w-full rounded-xl object-cover border border-line" />;
    }
    const hue = Math.abs([...src].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
    return (
      <div
        className="flex h-36 w-full items-end rounded-xl border border-line p-3 text-[12px] font-semibold text-paper"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 42%), hsl(${(hue + 40) % 360} 38% 28%))` }}
        role="img"
        aria-label={alt}
      >
        {alt}
      </div>
    );
  }
  return <img src={src} alt={alt} className="h-36 w-full rounded-xl object-cover border border-line" />;
}

function formatDownloads(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)} 万`;
  return String(n);
}

export default function AddPlayModModal({
  installs, onChange, onClose, onConfirmDeps,
  worldThemeTagId, worldThemeLabel, worldThemeCode, enabledThemeTags,
}: Props) {
  const [tab, setTab] = useState<ShelfTab>("推荐");
  /** 功能注释：点列表项进入详情；null 表示列表态 */
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const installed = useMemo(() => new Set(installs.map((x) => x.slug)), [installs]);
  /** 功能注释：本弹窗生命周期内已提示过题材不一致的玩法，避免取消依赖确认后反复弹 */
  const themeWarnedRef = useRef<Set<string>>(new Set());

  const list = useMemo(() => {
    // 功能注释：只展示玩法；phone_app 归应用商店，不进本列表
    let rows = LOCAL_PLAY_MOD_CATALOG.filter((x) => x.componentKind === "gameplay");
    if (tab === "免费") rows = rows.filter((x) => !x.priceKk);
    if (tab === "已安装") rows = rows.filter((x) => installed.has(x.slug));
    if (tab === "已购买") rows = rows.filter((x) => !x.priceKk || installed.has(x.slug));
    if (tab === "最热") {
      rows = [...rows].sort((a, b) => b.downloadCount - a.downloadCount);
    } else if (tab === "最新" || tab === "推荐") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "zh"));
    }
    return rows;
  }, [tab, installed]);

  const detail = detailSlug ? catalogBySlug(detailSlug) : null;

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
    // 功能注释：C0.2 安装前题材提示——只警告不阻断；同一玩法只提示一次，链上任一包冲突即提示
    const worldTheme: WorldThemeContext = { worldThemeTagId, worldThemeLabel, worldThemeCode, enabledThemeTags };
    if (!themeWarnedRef.current.has(item.slug) && chain.some((row) => isItemThemeMismatch(row, worldTheme))) {
      themeWarnedRef.current.add(item.slug);
      toast(THEME_MISMATCH_INSTALL_WARN, { id: "theme-mismatch-install", duration: 4500 });
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

  const addButtonLabel = (item: LocalPlayModCatalogItem, on: boolean) => {
    if (on) return "已添加";
    const depNames = missingPlayModDepNames(item, installs);
    return depNames.length ? "添加（含依赖）" : "添加";
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-label="添加玩法 Mod">
      <div className="ui-dialog rounded-2xl border border-line bg-paper shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink">{detail ? detail.name : "添加玩法 Mod"}</h2>
            <p className="text-[11px] leading-relaxed text-ink-soft">
              {detail
                ? "玩法详情：作者、下载量、说明与预览图；可直接添加进本作品。"
                : "这里添加本作品要用的玩法。"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {detail ? (
              <button
                type="button"
                className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft"
                onClick={() => setDetailSlug(null)}
              >
                返回列表
              </button>
            ) : null}
            <button type="button" className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft" onClick={onClose}>关闭</button>
          </div>
        </div>

        {detail ? (
          <div className="ui-dialog-body space-y-3 px-4 py-3" data-testid="play-mod-detail">
            <div className="flex items-start gap-3">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-line bg-paper-2 text-jade"
                dangerouslySetInnerHTML={{ __html: detail.iconSvg }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{detail.name}</span>
                  <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">玩法</span>
                  <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">
                    {detail.priceKk ? `${detail.priceKk} KK` : "免费"}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-ink-soft">
                  作者 {detail.authorName || "创作者"} · 下载 {formatDownloads(detail.downloadCount)}
                </p>
              </div>
              <button
                type="button"
                disabled={installed.has(detail.slug)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  installed.has(detail.slug) ? "border border-line text-ink-soft" : "bg-jade text-paper"
                }`}
                onClick={() => void installLocal(detail.slug)}
              >
                {addButtonLabel(detail, installed.has(detail.slug))}
              </button>
            </div>
            <div>
              <h3 className="mb-1 text-[12px] font-bold text-ink">玩法说明</h3>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">
                {detail.detailDescription || detail.description}
              </p>
            </div>
            {!!missingPlayModDepNames(detail, installs).length && !installed.has(detail.slug) && (
              <p className="text-[11px] text-ink-soft">
                需要：{missingPlayModDepNames(detail, installs).join("、")}（添加时可一并安装）
              </p>
            )}
            <div>
              <h3 className="mb-1.5 text-[12px] font-bold text-ink">预览图</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(detail.previewImages || []).map((src, i) => (
                  <PlayModPreview key={`${src}-${i}`} src={src} alt={`${detail.name} 预览 ${i + 1}`} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 功能注释：保留货架筛选；去掉「全部/玩法/手机应用」与搜索框 */}
            <div className="border-b border-line px-4 py-2">
              <div className="flex flex-wrap gap-1.5">
                {(["推荐", "最新", "最热", "免费", "已购买", "已安装"] as ShelfTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      tab === t ? "border border-jade text-jade" : "border border-line text-ink-soft"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <ul className="ui-dialog-body space-y-2 px-4 py-3">
              {list.map((item) => {
                const on = installed.has(item.slug);
                const depNames = missingPlayModDepNames(item, installs);
                return (
                  <li
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper-2 p-3 transition hover:border-jade/40"
                    onClick={() => setDetailSlug(item.slug)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailSlug(item.slug);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`查看「${item.name}」详情`}
                  >
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-paper text-jade"
                      dangerouslySetInnerHTML={{ __html: item.iconSvg }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-bold text-ink">{item.name}</span>
                        <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">玩法</span>
                        <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">
                          {item.priceKk ? `${item.priceKk} KK` : "免费"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{item.description}</p>
                      {!!depNames.length && !on && (
                        <p className="mt-0.5 text-[10.5px] text-ink-soft">
                          需要：{depNames.join("、")}（添加时可一并安装）
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={on}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                        on ? "border border-line text-ink-soft" : "bg-jade text-paper"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void installLocal(item.slug);
                      }}
                    >
                      {addButtonLabel(item, on)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

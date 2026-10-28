/**
 * 模组编辑器 · 手机应用配置 + 可操作小手机预览。
 * 预览机身 / 状态栏 / 图标格 / Dock 与局内 Phone.tsx 实机一致；下载 / 卸载仅内存，不写存档。
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PhoneAppDef } from "../mods/types";
import {
  AVAIL_OPTIONS,
  catalogItem,
  compactPhoneApps,
  phoneAppLabel,
  resolvePhoneApps,
  storeVisibleIds,
  type PhoneAppAvail,
} from "../lib/phoneAppsConfig";
import { APP_ICON } from "./phone/appIcons";
import { IconCheck } from "../lib/icons";
import { frameById } from "./Phone";
import { resolveWallpaper } from "./phone/wallpapers";
import LivePhoneAppPreview from "./phone/LivePhoneAppPreview";

type Props = {
  value?: PhoneAppDef[];
  onChange: (next: PhoneAppDef[] | undefined) => void;
};

/** 与 Phone.tsx HomeGrid 底栏一致：已安装才进 Dock */
const DOCK_APPS = ["call", "sms", "wechat", "settings"] as const;

const AVAIL_SHORT: Record<PhoneAppAvail, string> = {
  preinstall: "预装",
  store: "商店",
  locked: "解锁",
  hidden: "隐藏",
  disabled: "禁用",
};

/** 与局内 Phone 相同的 iOS 变量，避免吃到编辑器主题色 */
const IOS_VARS: CSSProperties = {
  ["--ink" as string]: "#181818",
  ["--ink-soft" as string]: "#8a8a8e",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  colorScheme: "light",
  WebkitFontSmoothing: "antialiased",
};

function AppIcon({ id, custom, size = 56 }: { id: string; custom?: string; size?: number }) {
  return (
    <span
      className="ios-icon relative block overflow-hidden rounded-[15px] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10"
      style={{ width: size, height: size }}
    >
      {custom ? (
        <img src={custom} alt="" className="h-full w-full scale-[1.14] object-cover" />
      ) : (
        (APP_ICON[id] ?? (
          <span className="flex h-full w-full items-center justify-center bg-[#232323] text-[12px] font-medium text-white">
            {id.slice(0, 1)}
          </span>
        ))
      )}
    </span>
  );
}

function SignalBars() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
      <rect x="0" y="7" width="3" height="4" rx="1" />
      <rect x="4.5" y="5" width="3" height="6" rx="1" />
      <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
      <rect x="13.5" y="0" width="3" height="11" rx="1" />
    </svg>
  );
}
function WifiGlyph() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <path d="M8 2.2c2.6 0 5 1 6.7 2.7l-1.5 1.5A7.3 7.3 0 0 0 8 4.3 7.3 7.3 0 0 0 2.8 6.4L1.3 4.9A9.4 9.4 0 0 1 8 2.2Z" />
      <path d="M8 6c1.4 0 2.7.5 3.6 1.5L8 11 4.4 7.5A5.1 5.1 0 0 1 8 6Z" />
    </svg>
  );
}
function BatteryGlyph() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden>
      <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.5" />
      <rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor" />
      <rect x="24" y="3.5" width="1.5" height="5" rx="0.75" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

/** 功能注释：预览态商店安装进度条（纯装饰，约 0.9s 走完）。 */
function useFakeProgress(active: boolean, onDone: () => void) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!active) {
      setPct(0);
      return;
    }
    setPct(8);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / 900) * 100));
      setPct(p);
      if (p >= 100) {
        clearInterval(iv);
        onDone();
      }
    }, 40);
    return () => clearInterval(iv);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return pct;
}

export default function PhoneAppsEditor({ value, onChange }: Props) {
  const apps = useMemo(() => resolvePhoneApps(value), [value]);
  const [sel, setSel] = useState(apps[0]?.id ?? "wechat");
  const selected = apps.find((a) => a.id === sel) ?? apps[0];

  const [previewInstalled, setPreviewInstalled] = useState<string[]>(() =>
    apps.filter((a) => a.avail === "preinstall").map((a) => a.id),
  );
  const [screen, setScreen] = useState<"home" | "store" | "app">("home");
  const [openId, setOpenId] = useState<string | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const progress = useFakeProgress(!!installing, () => {
    if (!installing) return;
    setPreviewInstalled((prev) => Array.from(new Set([...prev, installing])));
    setInstalling(null);
  });

  useEffect(() => {
    const pre = apps.filter((a) => a.avail === "preinstall").map((a) => a.id);
    const allowed = new Set(apps.filter((a) => a.avail !== "hidden" && a.avail !== "disabled").map((a) => a.id));
    setPreviewInstalled((prev) => {
      const kept = prev.filter((id) => allowed.has(id) && apps.find((a) => a.id === id)?.avail !== "disabled");
      return Array.from(new Set([...pre, ...kept]));
    });
  }, [apps]);

  const patch = (id: string, p: Partial<PhoneAppDef>) => {
    const next = apps.map((a) => (a.id === id ? { ...a, ...p } : a));
    onChange(compactPhoneApps(next));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = apps.findIndex((a) => a.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= apps.length) return;
    const next = apps.map((a) => ({ ...a }));
    const t = next[idx];
    next[idx] = next[j];
    next[j] = t;
    onChange(compactPhoneApps(next.map((a, i) => ({ ...a, order: i }))));
  };

  // 功能注释：Dock 仅展示已安装的固定四件套，主屏网格不再重复它们（对齐实机 HomeGrid）
  const dock = DOCK_APPS.filter((id) => previewInstalled.includes(id));
  const dockSet = new Set<string>(dock);
  const homeApps = apps.filter(
    (a) =>
      a.avail !== "hidden" &&
      a.avail !== "disabled" &&
      !dockSet.has(a.id as (typeof DOCK_APPS)[number]) &&
      (previewInstalled.includes(a.id) || a.id === "appstore"),
  );
  const storeIds = storeVisibleIds(value);
  const frame = frameById("titanium");
  const wp = resolveWallpaper("ocean");

  const openApp = (id: string) => {
    if (id === "appstore") {
      setScreen("store");
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setScreen("app");
  };

  const goHome = () => {
    setScreen("home");
    setOpenId(null);
  };

  const onIconFile = (id: string, file: File | null) => {
    if (!file) {
      patch(id, { icon: undefined });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch(id, { icon: String(reader.result || "") || undefined });
    reader.readAsDataURL(file);
  };

  const AppTile = ({ id, inDock }: { id: string; inDock?: boolean }) => {
    const meta = apps.find((a) => a.id === id);
    const label = meta?.label || phoneAppLabel(id, value);
    return (
      <button
        type="button"
        onClick={() => openApp(id)}
        className="phone-icon-in group relative flex flex-col items-center gap-1.5 bg-transparent"
      >
        <AppIcon id={id} custom={meta?.icon} size={56} />
        {!inDock ? (
          <span className="max-w-[70px] truncate text-center text-[11px] font-medium tracking-tight text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
            {label}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3" data-phone-apps-editor="v2-top-preview">
      {/* 功能注释：预览必须排在清单之前（DOM 首块）；勿再放到表单下方 */}
      <p className="order-1 text-[11.5px] leading-relaxed text-ink-soft">
        小手机实时预览（置顶 · 与局内实机同机身 / 壁纸 / Dock）。可试玩下载 · 安装 · 打开 · 卸载（仅预览，不写存档）。
      </p>

      {/* —— 顶部：与实机一致的仿真机身预览 —— */}
      <div className="order-2 flex flex-col items-center gap-2 rounded-2xl border border-jade/30 bg-paper-2/60 px-2 py-3">
        <p className="text-[10.5px] font-bold tracking-[0.14em] text-jade">实时预览 · 与游戏实机一致</p>
        <div className="w-full max-w-[280px]" style={IOS_VARS}>
          <div
            className="phone-frame relative mx-auto aspect-[9/19.5] w-full max-h-[560px] rounded-[3.2rem] p-[5px]"
            style={{ background: frame.frame }}
          >
            <span className="phone-btn absolute -left-[3px] top-[15%] h-8 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -left-[3px] top-[23%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -left-[3px] top-[33%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r" style={{ background: frame.btn }} />
            <div className="relative h-full overflow-hidden rounded-[2.95rem]">
              <div
                className="phone-os relative isolate flex h-full flex-col overflow-hidden ring-1 ring-white/5"
                style={{ background: screen === "home" ? wp.css : "#f2f2f7" }}
              >
                {/* 状态栏：对齐实机（时间 · Dynamic Island · 信号/电量） */}
                <div
                  className={`relative flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[12px] font-semibold tracking-[-0.01em] ${
                    screen === "home" ? "text-white" : "text-black/80"
                  }`}
                >
                  <span className="tabular-nums tracking-tight">9:41</span>
                  <span
                    className="dynamic-island absolute left-1/2 top-2 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black"
                    aria-hidden
                  />
                  <div className="flex items-center gap-1.5">
                    <SignalBars />
                    <WifiGlyph />
                    <BatteryGlyph />
                  </div>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {screen === "home" ? (
                    <div className="relative flex h-full flex-col">
                      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/15 to-transparent" />
                      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/15 to-transparent" />
                      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-3">
                        <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-[14px] pb-3 [grid-auto-rows:72px]">
                          {homeApps.map((a) => (
                            <AppTile key={a.id} id={a.id} />
                          ))}
                        </div>
                      </div>
                      <div className="relative flex justify-center pb-2 pt-1">
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-[4px] text-[11px] font-medium text-white backdrop-blur-xl ring-1 ring-inset ring-white/10">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                          搜索
                        </span>
                      </div>
                      {dock.length > 0 ? (
                        <div className="relative mx-2 mb-1 flex items-center justify-around rounded-[28px] bg-white/[0.18] px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-inset ring-white/15 backdrop-blur-[30px]">
                          {dock.map((id) => (
                            <AppTile key={id} id={id} inDock />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {screen === "store" ? (
                    <div className="flex h-full flex-col bg-[#f7f7f9] text-[#181818]">
                      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
                        <button type="button" className="text-[12px] font-semibold text-[#007aff]" onClick={goHome}>
                          ‹ 桌面
                        </button>
                        <span className="text-[13px] font-bold">应用商店</span>
                      </div>
                      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                        {storeIds.map((id) => {
                          const meta = apps.find((a) => a.id === id)!;
                          const cat = catalogItem(id);
                          const installed = previewInstalled.includes(id);
                          const locked = meta.avail === "locked";
                          const busy = installing === id;
                          return (
                            <li key={id} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
                              <AppIcon id={id} custom={meta.icon} size={44} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-bold">{meta.label}</p>
                                <p className="truncate text-[10px] text-[#8a8a8e]">{cat?.blurb}</p>
                                {busy ? (
                                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/10">
                                    <div className="h-full bg-[#007aff] transition-all" style={{ width: `${progress}%` }} />
                                  </div>
                                ) : null}
                                {locked && meta.unlockHint ? (
                                  <p className="mt-0.5 text-[9.5px] text-amber-700">{meta.unlockHint}</p>
                                ) : null}
                              </div>
                              {installed ? (
                                <div className="flex shrink-0 flex-col gap-1">
                                  <button type="button" className="rounded-full bg-[#e8e8ed] px-2.5 py-1 text-[10px] font-bold" onClick={() => openApp(id)}>
                                    打开
                                  </button>
                                  {id !== "appstore" ? (
                                    <button
                                      type="button"
                                      className="text-[9.5px] font-semibold text-[#ff3b30]"
                                      onClick={() => setPreviewInstalled((p) => p.filter((x) => x !== id))}
                                    >
                                      卸载
                                    </button>
                                  ) : null}
                                </div>
                              ) : locked ? (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">未解锁</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!!installing}
                                  className="shrink-0 rounded-full bg-[#007aff] px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-50"
                                  onClick={() => setInstalling(id)}
                                >
                                  获取
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {screen === "app" && openId ? (
                    /* 功能注释：与局内 Phone 同一套应用组件，禁止示意页冒充实机 */
                    <div className="phone-app-in h-full">
                      <LivePhoneAppPreview id={openId} onBack={goHome} />
                    </div>
                  ) : null}
                </div>

                {/* Home Indicator：对齐实机 */}
                <div className="flex shrink-0 justify-center pb-2 pt-1">
                  <button
                    type="button"
                    aria-label="回桌面"
                    onClick={goHome}
                    className={`h-[5px] w-[120px] rounded-full transition ${
                      screen === "home" ? "bg-white/55" : "bg-black/35"
                    }`}
                  />
                </div>

                {/* 玻璃反光：与带边框实机一致 */}
                <div
                  className="pointer-events-none absolute inset-0 z-[60] rounded-[2.4rem]"
                  style={{ background: "linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 14%, transparent 34%)" }}
                />
              </div>
            </div>
          </div>
        </div>
        <p className="max-w-sm text-center text-[10.5px] leading-relaxed text-ink-soft">
          预览下载 / 卸载不会写入正式存档。玩家局内安装的应用随当前存档保存。
        </p>
        <button
          type="button"
          className="flex items-center justify-center gap-1 rounded-xl border border-line px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:border-jade hover:text-jade"
          onClick={() => {
            setPreviewInstalled(apps.filter((a) => a.avail === "preinstall").map((a) => a.id));
            goHome();
            setInstalling(null);
          }}
        >
          <IconCheck size={12} /> 重置预览安装状态
        </button>
      </div>

      {/* —— 下方：应用清单与属性（order-3，永远在预览之后） —— */}
      <div className="order-3 space-y-2">
        <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">应用清单与属性</p>
        <ul className="max-h-[360px] space-y-1 overflow-y-auto rounded-xl border border-line bg-paper-2 p-1.5">
          {apps.map((a, i) => {
            const on = a.id === selected?.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSel(a.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                    on ? "bg-jade/15 ring-1 ring-jade/40" : "hover:bg-paper"
                  }`}
                >
                  <AppIcon id={a.id} custom={a.icon} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold text-ink">{a.label}</span>
                    <span className="block text-[10.5px] text-ink-soft">
                      {AVAIL_SHORT[a.avail]} · {catalogItem(a.id)?.blurb}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="上移"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(a.id, -1);
                      }}
                      className="rounded px-1 text-[10px] text-ink-soft disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="下移"
                      disabled={i >= apps.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        move(a.id, 1);
                      }}
                      className="rounded px-1 text-[10px] text-ink-soft disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected ? (
          <div className="space-y-2.5 rounded-xl border border-line bg-paper px-3 py-2.5">
            <label className="block">
              <span className="mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">应用名称</span>
              <input
                className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none"
                value={selected.label}
                onChange={(e) => patch(selected.id, { label: e.target.value })}
              />
            </label>
            <div>
              <span className="mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">自定义图标</span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft hover:border-jade hover:text-jade">
                选择文件
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onIconFile(selected.id, e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {selected.icon ? (
                <button
                  type="button"
                  className="ml-2 text-[11px] font-semibold text-danger"
                  onClick={() => patch(selected.id, { icon: undefined })}
                >
                  清除
                </button>
              ) : null}
            </div>
            <div>
              <span className="mb-1 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">状态</span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {AVAIL_OPTIONS.map((o) => {
                  const on = selected.avail === o.v;
                  const lockedStore = selected.id === "appstore" && o.v !== "preinstall";
                  return (
                    <button
                      key={o.v}
                      type="button"
                      disabled={lockedStore}
                      onClick={() => patch(selected.id, { avail: o.v })}
                      className={`rounded-lg border px-2 py-1.5 text-left transition disabled:opacity-40 ${
                        on ? "border-jade bg-jade/10" : "border-line bg-paper-2 hover:border-jade/50"
                      }`}
                    >
                      <span className={`block text-[12px] font-bold ${on ? "text-jade" : "text-ink"}`}>{o.l}</span>
                      <span className="block text-[10px] text-ink-soft">{o.d}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {selected.avail === "locked" ? (
              <label className="block">
                <span className="mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">解锁条件说明</span>
                <input
                  className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none"
                  placeholder="例如：名气 ≥ 120 后解锁"
                  value={selected.unlockHint ?? ""}
                  onChange={(e) => patch(selected.id, { unlockHint: e.target.value })}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

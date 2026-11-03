/**
 * 模组编辑器 · 手机应用配置 + 可操作小手机预览。
 * 「编辑 / 预览」贴在手机屏幕顶部；点列表行弹窗改属性；应用商店弹窗改开局预装（只写作品配置）。
 */
import { useMemo, useState, type CSSProperties } from "react";
import type { PhoneAppDef } from "../mods/types";
import {
  catalogItem,
  compactPhoneApps,
  phoneAppLabel,
  preinstallIds,
  resolvePhoneApps,
  storeVisibleIds,
  type ResolvedPhoneApp,
} from "../lib/phoneAppsConfig";
import { APP_ICON } from "./phone/appIcons";
import { IconCheck } from "../lib/icons";
import { frameById } from "./Phone";
import { DEFAULT_WALLPAPER, customWallpaperCss, resolveEffectiveHomeWallpaper } from "./phone/wallpapers";
import LivePhoneAppPreview from "./phone/LivePhoneAppPreview";
import { Modal } from "./ui";

type Props = {
  value?: PhoneAppDef[];
  /** 作品默认桌面背景（data URL） */
  wallpaper?: string;
  onChange: (next: PhoneAppDef[] | undefined) => void;
  onWallpaperChange: (next: string | undefined) => void;
};

/** 与 Phone.tsx HomeGrid 底栏一致：已安装才进 Dock */
const DOCK_APPS = ["call", "sms", "wechat", "settings"] as const;

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

/** 功能注释：把某一应用的预装开关写回作品配置；应用商店始终预装。 */
function withAvail(list: ResolvedPhoneApp[], id: string, preinstall: boolean): PhoneAppDef[] {
  return list.map((a) => ({
    id: a.id,
    label: a.label,
    icon: a.icon,
    order: a.order,
    avail: id === "appstore" ? "preinstall" : a.id === id ? (preinstall ? "preinstall" : "store") : a.avail,
    unlockHint: a.unlockHint || undefined,
  }));
}

export default function PhoneAppsEditor({ value, wallpaper, onChange, onWallpaperChange }: Props) {
  const apps = useMemo(() => resolvePhoneApps(value), [value]);
  const installed = useMemo(() => preinstallIds(value), [value]);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [editId, setEditId] = useState<string | null>(null);
  const [storeOpen, setStoreOpen] = useState(false);
  const [screen, setScreen] = useState<"home" | "app">("home");
  const [openId, setOpenId] = useState<string | null>(null);

  const editing = apps.find((a) => a.id === editId) ?? null;

  const patch = (id: string, p: Partial<PhoneAppDef>) => {
    const next = apps.map((a) => (a.id === id ? { ...a, ...p } : a));
    onChange(compactPhoneApps(next));
  };

  const setPreinstall = (id: string, on: boolean) => {
    if (id === "appstore" && !on) return;
    onChange(compactPhoneApps(withAvail(apps, id, on)));
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

  // 功能注释：Dock / 主屏只反映作品开局预装，商店勾选即时同步到桌面
  const dock = DOCK_APPS.filter((id) => installed.includes(id));
  const dockSet = new Set<string>(dock);
  const homeApps = apps.filter(
    (a) =>
      !dockSet.has(a.id as (typeof DOCK_APPS)[number]) &&
      (installed.includes(a.id) || a.id === "appstore"),
  );
  const storeIds = storeVisibleIds(value);
  const frame = frameById("titanium");
  const wp = resolveEffectiveHomeWallpaper(wallpaper, { wallpaper: DEFAULT_WALLPAPER });

  const openApp = (id: string) => {
    if (mode === "edit") {
      if (id === "appstore") {
        setStoreOpen(true);
        return;
      }
      setEditId(id);
      return;
    }
    if (id === "appstore") {
      setStoreOpen(true);
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

  const onWallpaperFile = (file: File | null) => {
    if (!file) {
      onWallpaperChange(undefined);
      return;
    }
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      onWallpaperChange(raw || undefined);
    };
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

  const showHome = mode === "edit" || screen === "home" || !openId;

  // 功能注释：点背景条始终展示当前生效壁纸（作品自定义或引擎默认），上传后同步手机预览
  const wallpaperPreviewCss = wallpaper
    ? /url\(/i.test(wallpaper)
      ? wallpaper
      : customWallpaperCss(wallpaper)
    : wp.css;

  return (
    <div className="flex flex-col" data-phone-apps-editor="v3-inphone-tabs" data-phone-apps-compact="1">
      {/* 功能注释：预览 / 点背景 / 应用清单收成连续一块，不插说明文案与大间距 */}
      <div className="flex flex-col gap-2 rounded-2xl border border-jade/30 bg-paper-2/60 px-2 py-2.5">
        {/* —— 仿真机身；编辑/预览切换贴在屏幕内顶部 —— */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-full max-w-[240px]" style={IOS_VARS}>
          <div
            className="phone-frame relative mx-auto aspect-[9/19.5] w-full max-h-[420px] rounded-[3.2rem] p-[5px]"
            style={{ background: frame.frame }}
          >
            <span className="phone-btn absolute -left-[3px] top-[15%] h-8 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -left-[3px] top-[23%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -left-[3px] top-[33%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
            <span className="phone-btn absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r" style={{ background: frame.btn }} />
            <div className="relative h-full overflow-hidden rounded-[2.95rem]">
              <div
                className="phone-os relative isolate flex h-full flex-col overflow-hidden ring-1 ring-white/5"
                style={{ background: showHome ? wp.css : "#f2f2f7" }}
              >
                <div
                  className={`relative flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[12px] font-semibold tracking-[-0.01em] ${
                    showHome ? "text-white" : "text-black/80"
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

                {/* 功能注释：编辑/预览贴在手机屏幕顶部（不再放在机身外面） */}
                <div className="relative z-20 mx-3 mt-1 flex shrink-0 rounded-full bg-black/35 p-0.5 backdrop-blur-md ring-1 ring-white/20" role="tablist" aria-label="手机配置模式">
                  {([
                    ["edit", "编辑"],
                    ["preview", "预览"],
                  ] as const).map(([k, label]) => {
                    const on = mode === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setMode(k);
                          if (k === "edit") goHome();
                        }}
                        className={`flex-1 rounded-full py-1 text-[11px] font-bold transition ${
                          on ? "bg-white text-[#181818] shadow-sm" : "text-white/85 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  {showHome ? (
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

                  {mode === "preview" && screen === "app" && openId ? (
                    <div className="phone-app-in absolute inset-0 z-10 h-full">
                      <LivePhoneAppPreview id={openId} onBack={goHome} />
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 justify-center pb-2 pt-1">
                  <button
                    type="button"
                    aria-label="回桌面"
                    onClick={goHome}
                    className={`h-[5px] w-[120px] rounded-full transition ${
                      showHome ? "bg-white/55" : "bg-black/35"
                    }`}
                  />
                </div>

                <div
                  className="pointer-events-none absolute inset-0 z-[60] rounded-[2.4rem]"
                  style={{ background: "linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 14%, transparent 34%)" }}
                />
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="flex items-center justify-center gap-1 rounded-xl border border-jade/40 bg-jade/10 px-3 py-1.5 text-[11.5px] font-semibold text-jade hover:bg-jade/15"
          onClick={() => setStoreOpen(true)}
        >
          打开应用商店
        </button>
        </div>

        {/* —— 点背景：一条小预览 + 旁侧上传/清除 —— */}
        <div
          className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5"
          data-phone-wallpaper-strip="1"
        >
          <span className="shrink-0 text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">手机桌面背景</span>
          <div
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-cover bg-center"
            style={{ background: wallpaperPreviewCss }}
            aria-label="桌面背景预览"
          />
          <label className="inline-flex shrink-0 cursor-pointer items-center rounded-lg border border-line bg-paper-2 px-2 py-1 text-[11.5px] font-semibold text-ink-soft hover:border-jade hover:text-jade">
            上传
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                onWallpaperFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
          {wallpaper ? (
            <button
              type="button"
              className="shrink-0 text-[11px] font-semibold text-danger"
              onClick={() => onWallpaperChange(undefined)}
            >
              清除
            </button>
          ) : null}
        </div>

        {/* —— 应用清单：点行弹窗，不在行内展开 —— */}
        <div className="space-y-1.5">
          <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">应用清单与属性</p>
          <ul className="max-h-[280px] space-y-1 overflow-y-auto rounded-xl border border-line bg-paper p-1.5">
            {apps.map((a, i) => (
              <li key={a.id}>
                <div className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-paper-2">
                  <button
                    type="button"
                    onClick={() => setEditId(a.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <AppIcon id={a.id} custom={a.icon} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-ink">{a.label}</span>
                      <span className="block text-[10.5px] text-ink-soft">
                        {a.avail === "preinstall" ? "开局预装" : "商店可下"} · {catalogItem(a.id)?.blurb}
                      </span>
                    </span>
                    <span className="text-[12px] text-ink-soft" aria-hidden>›</span>
                  </button>
                  <span className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label="上移"
                      disabled={i === 0}
                      onClick={() => move(a.id, -1)}
                      className="rounded px-1 text-[10px] text-ink-soft disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="下移"
                      disabled={i >= apps.length - 1}
                      onClick={() => move(a.id, 1)}
                      className="rounded px-1 text-[10px] text-ink-soft disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing ? (
        <Modal title={`编辑 · ${editing.label}`} onClose={() => setEditId(null)}>
          <div className="space-y-2.5">
            <label className="block">
              <span className="mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">应用名称</span>
              <input
                className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none"
                value={editing.label}
                onChange={(e) => patch(editing.id, { label: e.target.value })}
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
                    onIconFile(editing.id, e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {editing.icon ? (
                <button
                  type="button"
                  className="ml-2 text-[11px] font-semibold text-danger"
                  onClick={() => patch(editing.id, { icon: undefined })}
                >
                  清除
                </button>
              ) : null}
            </div>
            <label
              className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 ${
                editing.id === "appstore" ? "border-line bg-paper-2 opacity-70" : "border-line bg-paper-2"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--jade,#A8283C)]"
                checked={editing.avail === "preinstall"}
                disabled={editing.id === "appstore"}
                onChange={(e) => setPreinstall(editing.id, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold text-ink">开局预装</span>
                <span className="block text-[10.5px] leading-snug text-ink-soft">
                  {editing.id === "appstore"
                    ? "应用商店始终预装，不可关闭"
                    : "勾选后新开局桌面自动安装；桌面预览立刻同步。只影响作品配置，不改已有玩家存档。"}
                </span>
              </span>
            </label>
            <button
              type="button"
              className="w-full rounded-full bg-jade py-2 text-[13px] font-bold text-white"
              onClick={() => setEditId(null)}
            >
              完成
            </button>
          </div>
        </Modal>
      ) : null}

      {storeOpen ? (
        <Modal title="应用商店" onClose={() => setStoreOpen(false)} heavyBackdrop>
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
            勾选或「获取」记为本作品开局预装，桌面预览同步出现图标；取消 / 卸载则从开局预装拿掉。不写玩家正式存档。
          </p>
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {storeIds.map((id) => {
              const meta = apps.find((a) => a.id === id)!;
              const cat = catalogItem(id);
              const on = meta.avail === "preinstall";
              return (
                <li key={id} className="flex items-center gap-2 rounded-xl border border-line bg-paper-2 p-2">
                  <AppIcon id={id} custom={meta.icon} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-ink">{meta.label}</p>
                    <p className="truncate text-[10.5px] text-ink-soft">{cat?.blurb}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-ink">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--jade,#A8283C)]"
                      checked={on}
                      disabled={id === "appstore"}
                      onChange={(e) => setPreinstall(id, e.target.checked)}
                    />
                    预装
                  </label>
                  {id !== "appstore" ? (
                    on ? (
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-[#e8e8ed] px-2.5 py-1 text-[10px] font-bold text-[#ff3b30]"
                        onClick={() => setPreinstall(id, false)}
                      >
                        卸载
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-[#007aff] px-2.5 py-1 text-[10px] font-bold text-white"
                        onClick={() => setPreinstall(id, true)}
                      >
                        获取
                      </button>
                    )
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] font-bold text-jade">
                      <IconCheck size={12} /> 必装
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

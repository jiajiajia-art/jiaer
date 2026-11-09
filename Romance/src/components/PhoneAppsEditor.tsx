/**
 * 作品编辑器 · 手机应用：只从平台已上架列表安装 / 卸下，作品仅保存 appId。
 * 不在此新建应用；卸下不删平台表记录，可再装回来。
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PhoneAppDef } from "../mods/types";
import {
  compactInstalledAppIds,
  installedPlatformAppIds,
} from "../lib/phoneAppsConfig";
import {
  listPublishedPlatformApps,
  resolvePlatformAppIconUrl,
  type PlatformApp,
} from "../lib/platformApps";
import { APP_ICON } from "./phone/appIcons";
import { frameById } from "./Phone";
import { DEFAULT_WALLPAPER, customWallpaperCss, resolveEffectiveHomeWallpaper } from "./phone/wallpapers";
import LivePhoneAppPreview from "./phone/LivePhoneAppPreview";
import { Modal } from "./ui";
import { platformAppLegacyUi } from "../lib/platformApps";

type Props = {
  value?: PhoneAppDef[];
  wallpaper?: string;
  onChange: (next: PhoneAppDef[] | undefined) => void;
  onWallpaperChange: (next: string | undefined) => void;
};

const DOCK_APPS = ["call", "sms", "wechat", "settings"] as const;

const IOS_VARS: CSSProperties = {
  ["--ink" as string]: "#181818",
  ["--ink-soft" as string]: "#8a8a8e",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  colorScheme: "light",
  WebkitFontSmoothing: "antialiased",
};

function AppIcon({ id, iconUrl, size = 56 }: { id: string; iconUrl?: string; size?: number }) {
  const resolved = iconUrl ? resolvePlatformAppIconUrl(iconUrl) : "";
  return (
    <span
      className="ios-icon relative block overflow-hidden rounded-[15px] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10"
      style={{ width: size, height: size }}
    >
      {resolved ? (
        <img src={resolved} alt="" className="h-full w-full scale-[1.14] object-cover" />
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

export default function PhoneAppsEditor({ value, wallpaper, onChange, onWallpaperChange }: Props) {
  const installedIds = useMemo(() => installedPlatformAppIds(value), [value]);
  const installedSet = useMemo(() => new Set(installedIds), [installedIds]);
  const [catalog, setCatalog] = useState<PlatformApp[]>([]);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [storeOpen, setStoreOpen] = useState(false);
  const [screen, setScreen] = useState<"home" | "app">("home");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listPublishedPlatformApps();
        if (!cancelled) {
          setCatalog(list);
          setLoadError("");
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "加载应用商店失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(catalog.map((a) => [a.appId, a])), [catalog]);

  const install = (appId: string) => {
    if (installedSet.has(appId)) return;
    onChange(compactInstalledAppIds([...installedIds, appId]));
  };

  const uninstall = (appId: string) => {
    onChange(compactInstalledAppIds(installedIds.filter((id) => id !== appId)));
  };

  const homeIds = useMemo(() => {
    const dockSet = new Set<string>(DOCK_APPS);
    const rest = installedIds.filter((id) => !dockSet.has(id));
    return ["appstore", ...rest];
  }, [installedIds]);

  const dock = DOCK_APPS.filter((id) => id === "settings" || installedSet.has(id));
  const frame = frameById("titanium");
  const wp = resolveEffectiveHomeWallpaper(wallpaper, { wallpaper: DEFAULT_WALLPAPER });

  const openApp = (id: string) => {
    if (id === "appstore") {
      setStoreOpen(true);
      return;
    }
    if (mode === "edit") {
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

  const onWallpaperFile = (file: File | null) => {
    if (!file) {
      onWallpaperChange(undefined);
      return;
    }
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => onWallpaperChange(String(reader.result || "") || undefined);
    reader.readAsDataURL(file);
  };

  const AppTile = ({ id, inDock }: { id: string; inDock?: boolean }) => {
    const meta = byId.get(id);
    const label = meta?.name || (id === "appstore" ? "应用商店" : id === "settings" ? "设置" : id);
    return (
      <button
        type="button"
        onClick={() => openApp(id)}
        className="phone-icon-in group relative flex flex-col items-center gap-1.5 bg-transparent"
      >
        <AppIcon id={id} iconUrl={meta?.icon} size={56} />
        {!inDock ? (
          <span className="max-w-[70px] truncate text-center text-[11px] font-medium tracking-tight text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">
            {label}
          </span>
        ) : null}
      </button>
    );
  };

  const showHome = mode === "edit" || screen === "home" || !openId;
  const wallpaperPreviewCss = wallpaper
    ? /url\(/i.test(wallpaper)
      ? wallpaper
      : customWallpaperCss(wallpaper)
    : wp.css;

  const previewLegacy = openId ? platformAppLegacyUi(byId.get(openId)?.content) || openId : null;

  return (
    <div className="flex flex-col" data-phone-apps-editor="v3-inphone-tabs" data-phone-apps-compact="1">
      <div className="flex flex-col gap-2 rounded-2xl border border-jade/30 bg-paper-2/60 px-2 py-2.5">
        <div className="flex flex-col items-center gap-1.5">
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
                  style={{ background: showHome ? wp.css : "#f2f2f7" }}
                >
                  <div
                    className={`relative flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[12px] font-semibold tracking-[-0.01em] ${
                      showHome ? "text-white" : "text-black/80"
                    }`}
                  >
                    <span className="tabular-nums tracking-tight">9:41</span>
                    <span className="dynamic-island absolute left-1/2 top-2 h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
                    <div className="flex items-center gap-1.5">
                      <SignalBars />
                      <WifiGlyph />
                      <BatteryGlyph />
                    </div>
                  </div>

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
                        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-2">
                          <div className="grid grid-cols-4 justify-items-center gap-x-3 gap-y-[18px] pb-3 [grid-auto-flow:row_dense] [grid-auto-rows:82px]">
                            {homeIds.map((id) => (
                              <AppTile key={id} id={id} />
                            ))}
                          </div>
                        </div>
                        {dock.length > 0 ? (
                          <div className="relative mx-[10px] mb-1.5 flex shrink-0 items-center justify-around rounded-[34px] bg-white/[0.18] px-3 py-3 ring-1 ring-inset ring-white/15 backdrop-blur-[30px]">
                            {dock.map((id) => (
                              <AppTile key={id} id={id} inDock />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {mode === "preview" && screen === "app" && previewLegacy ? (
                      <div className="phone-app-in absolute inset-0 z-10 h-full">
                        <LivePhoneAppPreview id={previewLegacy} onBack={goHome} />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 justify-center pb-2 pt-1">
                    <button
                      type="button"
                      aria-label="回桌面"
                      onClick={goHome}
                      className={`h-[5px] w-[120px] rounded-full transition ${showHome ? "bg-white/55" : "bg-black/35"}`}
                    />
                  </div>
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
            <button type="button" className="shrink-0 text-[11px] font-semibold text-danger" onClick={() => onWallpaperChange(undefined)}>
              清除
            </button>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">本作品已装应用</p>
          <ul className="max-h-[280px] space-y-1 overflow-y-auto rounded-xl border border-line bg-paper p-1.5">
            {installedIds.length === 0 ? (
              <li className="px-2 py-6 text-center text-[12px] text-ink-soft">还没有安装应用，打开应用商店安装</li>
            ) : (
              installedIds.map((id) => {
                const meta = byId.get(id);
                return (
                  <li key={id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                    <AppIcon id={id} iconUrl={meta?.icon} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-ink">{meta?.name || id}</span>
                      <span className="block truncate text-[10.5px] text-ink-soft">
                        {meta ? `${meta.summary || "暂无说明"} · ${meta.authorName || meta.authorId}` : "应用不可用"}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[#e8e8ed] px-2.5 py-1 text-[10px] font-bold text-[#ff3b30]"
                      onClick={() => uninstall(id)}
                    >
                      卸下
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {storeOpen ? (
        <Modal title="应用商店" onClose={() => setStoreOpen(false)} heavyBackdrop>
          <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
            只显示已上架应用。安装 / 卸下只改本作品的 appId 列表，不会写入玩家正式存档，也不会删除平台应用记录。
          </p>
          {loadError ? <p className="mb-2 text-[12px] text-danger">{loadError}</p> : null}
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto">
            {catalog.map((app) => {
              const on = installedSet.has(app.appId);
              return (
                <li key={app.appId} className="flex items-center gap-2 rounded-xl border border-line bg-paper-2 p-2">
                  <AppIcon id={app.appId} iconUrl={app.icon} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-ink">{app.name}</p>
                    <p className="truncate text-[10.5px] text-ink-soft">
                      {app.summary || "暂无说明"} · {app.authorName || app.authorId}
                    </p>
                  </div>
                  {on ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[#e8e8ed] px-2.5 py-1 text-[10px] font-bold text-[#ff3b30]"
                      onClick={() => uninstall(app.appId)}
                    >
                      卸下
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 rounded-full bg-[#007aff] px-2.5 py-1 text-[10px] font-bold text-white"
                      onClick={() => install(app.appId)}
                    >
                      安装
                    </button>
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

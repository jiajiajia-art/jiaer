/* 设置：仿 iOS 分组列表（墙纸 / 显示与亮度 / 通用），公共交互惯例、无品牌素材 */
import { useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { gameTimeLabel } from "../../game/phone";
import { dayDateLabel, weekdayName, clockLabel } from "../../game/logic";
import { WALLPAPERS, wallpaperById, resolveWallpaper, customWallpaperCss, CUSTOM_WALLPAPER_ID, type WallpaperKind } from "./wallpapers";
import { IconChevron, IconGear, IconSun, IconMusic, IconClock, IconUser } from "./icons";
import { PHONE_FRAMES, frameById, useWide, type FrameId } from "../Phone";
import type { ThemePref } from "../../lib/store";
import { liveTerm as T } from "../../mods/live";
import { ReviewCenter } from "./studio/Studio";

/* 界面主题风格（全站皮肤）：切换 <html> 上的 skin class。 */
type SkinId = NonNullable<ThemePref["skin"]>;
const SKINS: { id: SkinId; label: string; desc: string; paper: string; ink: string; accent: string }[] = [
  { id: "dream", label: "梦幻星紫", desc: "薰衣草糖霜 · 圆润柔光", paper: "#f1ecfd", ink: "#47376f", accent: "#8b6fe0" },
  { id: "paper", label: "宣纸年代", desc: "奶油纸白 · 旧报复古", paper: "#f3e9d6", ink: "#4a3f2f", accent: "#b06a4f" },
  { id: "glass", label: "毛玻璃", desc: "通透磨砂 · 冷调现代", paper: "#eef1f6", ink: "#26303f", accent: "#4a7bd0" },
  { id: "cute", label: "可爱奢华", desc: "甜粉描金 · 少女心", paper: "#fdeef4", ink: "#6b3a52", accent: "#e77aa6" },
  { id: "bloody", label: "血腥玛丽", desc: "玛丽红 × 奶油白", paper: "#fbf1ec", ink: "#5a2b2b", accent: "#d4425a" },
];
const skinLabel = (id?: SkinId) => SKINS.find((s) => s.id === (id ?? "cute"))?.label ?? "梦幻星紫";

type Prefs = {
  wallpaper: string;
  customWallpaper?: string;
  brightness: number; // 0.55 ~ 1
  dark: boolean;
  dnd: boolean;
  haptics: boolean;
  frameColor: FrameId;
  showFrame: boolean;
};

type WpCat = WallpaperKind | "custom";

/* iOS 风格行 */
function Row({ icon, tint, label, right, onClick, last }: { icon: ReactNode; tint: string; label: string; right?: ReactNode; onClick?: () => void; last?: boolean }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex w-full items-center gap-3 bg-white px-3.5 py-2 text-left ${onClick ? "cursor-pointer transition active:bg-black/[0.03]" : ""}`}
    >
      <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-white" style={{ background: tint }}>{icon}</span>
      <span className={`flex flex-1 items-center gap-2 py-1.5 text-[15.5px] text-ink ${last ? "" : "border-b border-black/[0.06]"}`}>
        <span className="shrink-0">{label}</span>
        <span className="ml-auto flex min-w-0 items-center justify-end gap-1.5 truncate text-[14px] text-ink-soft">{right}{onClick && <IconChevron size={14} />}</span>
      </span>
    </div>
  );
}

/* iOS 拨动开关 */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onChange(!on); }} className={`relative h-[26px] w-[42px] shrink-0 rounded-full transition-colors ${on ? "bg-[#34c759]" : "bg-black/15"}`} aria-pressed={on}>
      <span className={`absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-[2px]"}`} />
    </button>
  );
}

const WP_CATS: { id: WpCat; label: string }[] = [
  { id: "photo", label: "照片" },
  { id: "custom", label: "自定义" },
];

/* 墙纸预览：一张缩略手机，顶部锁屏时间 + 底部主屏图标点，随所选墙纸实时更新 */
function WallpaperPreview({ wp }: { wp: ReturnType<typeof wallpaperById> }) {
  const fg = wp.dark ? "#fff" : "#1c1c1e";
  const { game } = useGame();
  const sim = game!.sim;
  const dateLine = `${dayDateLabel(sim.day ?? 0)} ${weekdayName(sim.day ?? 0)}`;
  const clock = clockLabel(sim.clockMin ?? 480).split(" ").pop();
  return (
    <div className="relative mx-auto aspect-[9/17] w-[124px] overflow-hidden rounded-[22px] shadow-lg ring-1 ring-black/15" style={{ background: wp.css }}>
      <div className="absolute left-1/2 top-2 h-[13px] w-[38px] -translate-x-1/2 rounded-full bg-black/70" />
      <div className="pt-7 text-center" style={{ color: fg }}>
        <p className="text-[9px] font-medium tracking-wide opacity-90">{dateLine}</p>
        <p className="-mt-1 text-[30px] font-semibold tabular-nums leading-tight">{clock}</p>
      </div>
      <div className="absolute inset-x-0 bottom-3 grid grid-cols-4 gap-2 px-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="aspect-square rounded-[6px]" style={{ background: wp.dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.16)" }} />
        ))}
      </div>
    </div>
  );
}

const CHECK = (
  <span className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0a84ff] text-white shadow">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-11" /></svg>
  </span>
);

function WallpaperPicker({ current, customCss, onPick, onUpload, onBack }: {
  current: string;
  customCss?: string;
  onPick: (id: string) => void;
  onUpload: (dataUrl: string) => void;
  onBack: () => void;
}) {
  const [cat, setCat] = useState<WpCat>(current === CUSTOM_WALLPAPER_ID ? "custom" : wallpaperById(current).kind);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const list = cat === "custom" ? [] : WALLPAPERS.filter((w) => w.kind === cat);

  const pickFile = (file: File | undefined) => {
    setErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("请选择图片文件"); return; }
    if (file.size > 4 * 1024 * 1024) { setErr("图片过大，请选择 4MB 以内的图片"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") onUpload(reader.result); };
    reader.onerror = () => setErr("读取图片失败，请重试");
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex items-center bg-[#f7f7f9] px-3 py-2.5">
        <button onClick={onBack} className="flex items-center text-[15px] text-[#0a84ff]"><IconChevron size={16} className="rotate-180" /> 设置</button>
        <span className="flex-1 text-center text-[16px] font-semibold text-ink">墙纸</span>
        <span className="w-14" />
      </div>

      <div className="flex-1 overflow-y-auto pb-5">
        {/* 当前墙纸预览 */}
        <div className="px-4 py-4">
          <WallpaperPreview wp={resolveWallpaper(current, customCss)} />
          <p className="mt-2 text-center text-[12px] text-ink-soft">当前墙纸 · {resolveWallpaper(current, customCss).label}</p>
        </div>

        {/* 分类切换（照片 / 自定义） */}
        <div className="mx-4 mb-3 flex rounded-[9px] bg-black/[0.06] p-0.5">
          {WP_CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`flex-1 rounded-[7px] py-1 text-[12.5px] font-medium transition ${cat === c.id ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {cat === "custom" ? (
          <div className="px-4">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            {/* 上传按钮 */}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-black/15 bg-white/60 py-7 text-center transition active:bg-black/[0.03]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0a84ff]/10 text-[22px] text-[#0a84ff]">＋</span>
              <span className="text-[14px] font-medium text-ink">从相册上传照片</span>
              <span className="text-[11.5px] text-ink-soft">选一张你喜欢的图片作壁纸（≤4MB）</span>
            </button>
            {err && <p className="mt-2 text-center text-[12px] text-[#ff3b30]">{err}</p>}

            {/* 已上传的自定义壁纸缩略 */}
            {customCss && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] uppercase text-ink-soft">我的照片</p>
                <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => onPick(CUSTOM_WALLPAPER_ID)} className="text-center">
                    <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ background: customCss }}>
                      {current === CUSTOM_WALLPAPER_ID && CHECK}
                    </span>
                    <span className="mt-1 block text-[11.5px] text-ink-soft">自定义</span>
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="text-center">
                    <span className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl border-2 border-dashed border-black/15 text-[22px] text-ink-soft">↺</span>
                    <span className="mt-1 block text-[11.5px] text-ink-soft">换一张</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-3">
            <div className="grid grid-cols-3 gap-3">
              {list.map((w) => (
                <button key={w.id} onClick={() => onPick(w.id)} className="text-center">
                  <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ background: w.css }}>
                    {current === w.id && CHECK}
                  </span>
                  <span className="mt-1 block text-[11.5px] text-ink-soft">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* 通用子页面头 + iOS 分组容器 */
function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center bg-[#f7f7f9] px-3 py-2.5">
      <button onClick={onBack} className="flex items-center text-[15px] text-[#0a84ff]"><IconChevron size={16} className="rotate-180" /> 设置</button>
      <span className="flex-1 text-center text-[16px] font-semibold text-ink">{title}</span>
      <span className="w-14" />
    </div>
  );
}

/* 机身外壳：自选中框配色，附一台实时预览小机 */
function FramePage({ onBack, current, wpCss, onPick }: { onBack: () => void; current: FrameId; wpCss: string; onPick: (id: FrameId) => void }) {
  const sel = frameById(current);
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="机身外壳" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">
        {/* 预览：一台带中框的小机 */}
        <div className="flex justify-center px-4 py-6">
          <div className="relative rounded-[26px] p-[3px] shadow-xl" style={{ background: sel.frame }}>
            <span className="absolute -left-[2px] top-[24%] h-9 w-[2px] rounded-l" style={{ background: sel.btn }} />
            <span className="absolute -right-[2px] top-[30%] h-12 w-[2px] rounded-r" style={{ background: sel.btn }} />
            <div className="rounded-[23px] bg-black p-[5px]">
              <div className="relative aspect-[9/18] w-[112px] overflow-hidden rounded-[19px]" style={{ background: wpCss }}>
                <div className="absolute left-1/2 top-1.5 h-[11px] w-[34px] -translate-x-1/2 rounded-full bg-black/70" />
              </div>
            </div>
          </div>
        </div>
        <p className="-mt-2 mb-2 text-center text-[12px] text-ink-soft">当前外壳 · {sel.label}</p>

        <p className="px-6 pb-1.5 text-[12px] uppercase text-ink-soft">选择配色</p>
        <div className="mx-4 grid grid-cols-4 gap-3">
          {PHONE_FRAMES.map((f) => (
            <button key={f.id} onClick={() => onPick(f.id)} className="flex flex-col items-center gap-1.5">
              <span
                className={`relative flex h-[52px] w-[52px] items-center justify-center rounded-full ring-1 ring-black/10 transition ${current === f.id ? "ring-2 ring-[#0a84ff] ring-offset-2 ring-offset-[#f2f2f7]" : ""}`}
                style={{ background: f.frame }}
              >
                {current === f.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={f.id === "silver" || f.id === "gold" ? "#333" : "#fff"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-11" /></svg>
                )}
              </span>
              <span className={`text-[11px] ${current === f.id ? "font-semibold text-ink" : "text-ink-soft"}`}>{f.label}</span>
            </button>
          ))}
        </div>
        <p className="px-6 pt-4 text-[11.5px] leading-relaxed text-ink-soft">换个心情就换个壳——中框与侧键一起变色，屏幕四周仍保留黑色内边，质感更真实。</p>
      </div>
    </div>
  );
}

/* 界面主题风格：全站皮肤选择，带迷你排版预览 */
function ThemeStylePage({ onBack, current, onPick }: { onBack: () => void; current?: SkinId; onPick: (id: SkinId) => void }) {
  const cur = current ?? "cute";
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="界面主题风格" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 pb-2 text-[12px] uppercase text-ink-soft">选择排版风格</p>
        <div className="mx-4 grid grid-cols-2 gap-3.5">
          {SKINS.map((sk) => {
            const active = cur === sk.id;
            return (
              <button key={sk.id} onClick={() => onPick(sk.id)} className="text-left">
                {/* 迷你排版预览：标题条 + 正文行 + 一枚按钮 */}
                <span
                  className="relative block h-[92px] w-full overflow-hidden rounded-xl ring-1 ring-black/10 shadow-sm"
                  style={{ background: sk.paper }}
                >
                  <span className="absolute inset-x-2.5 top-2.5 h-3.5 rounded-md" style={{ background: sk.accent }} />
                  <span className="absolute left-2.5 top-9 h-1.5 w-12 rounded" style={{ background: sk.ink, opacity: 0.65 }} />
                  <span className="absolute left-2.5 top-[46px] h-1.5 w-16 rounded" style={{ background: sk.ink, opacity: 0.35 }} />
                  <span
                    className="absolute bottom-2.5 left-2.5 flex h-6 w-14 items-center justify-center text-[8px] font-bold text-white rounded-md"
                    style={{ background: sk.accent }}
                  >
                    Aa
                  </span>
                  {active && CHECK}
                </span>
                <span className={`mt-1.5 block text-[13.5px] ${active ? "font-bold text-ink" : "font-medium text-ink"}`}>{sk.label}</span>
                <span className="block text-[11px] leading-tight text-ink-soft">{sk.desc}</span>
              </button>
            );
          })}
        </div>
        <p className="px-6 pt-4 text-[11.5px] leading-relaxed text-ink-soft">
          主题风格作用于整个游戏界面，不同皮肤拥有独立调配的色彩、材质与质感。随时可切回。
        </p>
      </div>
    </div>
  );
}

/* 通用：软件更新 / 储存空间 / 日期与时间 / 键盘 / 还原 */
function GeneralPage({ onBack, week, dateLabel }: { onBack: () => void; week: number; dateLabel: string }) {
  const usedGB = 12 + (week % 20);
  return (
    <div className="relative flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="通用" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <div className="bg-white px-3.5 py-3">
            <div className="flex items-center justify-between text-[15px] text-ink"><span>iPhone 储存空间</span><span className="text-[13px] text-ink-soft">{usedGB} / 64 GB</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#0a84ff]" style={{ width: `${(usedGB / 64) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-soft">
              <span>· 应用 {Math.round(usedGB * 0.5)} GB</span><span>· 照片 {Math.round(usedGB * 0.3)} GB</span><span>· 系统 {Math.round(usedGB * 0.2)} GB</span>
            </div>
          </div>
        </div>
        <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<IconClock size={16} />} tint="#f5a623" label="日期与时间" right={`第 ${week} 周 · ${dateLabel}`} last />
        </div>
      </div>
    </div>
  );
}

export default function SettingsApp({ onBack, prefs, onChange }: { onBack: () => void; prefs: Prefs; onChange: (p: Partial<Prefs>) => void }) {
  const wide = useWide();
  const { game, theme, setTheme } = useGame();
  const [page, setPage] = useState<"root" | "wallpaper" | "frame" | "general" | "theme" | "review">("root");
  const wp = resolveWallpaper(prefs.wallpaper, prefs.customWallpaper);
  const week = game!.sim.week ?? 1;
  const dateLabel = gameTimeLabel(game!).split(" ")[0] ?? "";

  if (page === "wallpaper") {
    return (
      <WallpaperPicker
        current={prefs.wallpaper}
        customCss={prefs.customWallpaper}
        onPick={(id) => onChange({ wallpaper: id })}
        onUpload={(dataUrl) => onChange({ customWallpaper: customWallpaperCss(dataUrl), wallpaper: CUSTOM_WALLPAPER_ID })}
        onBack={() => setPage("root")}
      />
    );
  }
  if (page === "frame") return <FramePage current={prefs.frameColor} wpCss={wp.css} onPick={(id) => onChange({ frameColor: id })} onBack={() => setPage("root")} />;
  if (page === "theme") return <ThemeStylePage current={theme.skin} onPick={(skin) => setTheme({ ...theme, skin })} onBack={() => setPage("root")} />;
  if (page === "review") return (
    <div className="flex h-full flex-col bg-[#f2f2f7]"><SubHeader title="审核中心" onBack={() => setPage("root")} /><div className="relative min-h-0 flex-1 overflow-y-auto"><ReviewCenter /></div></div>
  );
  if (page === "general") return <GeneralPage week={week} dateLabel={dateLabel} onBack={() => setPage("root")}  />;

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex items-center bg-[#f7f7f9] px-3 py-2.5">
        <button onClick={onBack} className="flex w-16 items-center text-[15px] text-[#0a84ff]"><IconChevron size={16} className="rotate-180" /> 主屏</button>
        <span className="flex-1 text-center text-[16px] font-semibold text-ink">设置</span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* Apple ID 卡：玩家资料 */}
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/10 text-[20px] font-semibold text-ink-soft ring-1 ring-black/10">
            {game!.player.avatar
              ? <img src={(game!.player.avatar) || undefined} alt={game!.player.name} className="h-14 w-14 object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : game!.player.name?.[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold text-ink">{game!.player.name}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">星辰账户 · iCloud · {T("city")}</p>
          </div>
        </div>


        {/* 显示与亮度 + 墙纸 + 声音 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<IconSun size={16} />} tint="#0a84ff" label="深色模式" right={<Toggle on={prefs.dark} onChange={(v) => onChange({ dark: v })} />} />
          <div className="flex items-center gap-3 bg-white px-3.5 py-2.5">
            <span className="text-ink-soft"><IconSun size={16} /></span>
            <input
              type="range" min={55} max={100} value={Math.round(prefs.brightness * 100)}
              onChange={(e) => onChange({ brightness: Number(e.target.value) / 100 })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/10 accent-[#0a84ff]"
              aria-label="亮度"
            />
            <span className="w-9 text-right text-[12px] tabular-nums text-ink-soft">{Math.round(prefs.brightness * 100)}%</span>
          </div>
          <Row icon={<IconGear size={16} />} tint="#5856d6" label="墙纸" right={wp.label} onClick={() => setPage("wallpaper")} last={!wide} />
          {wide ? (
            <>
              <Row
                icon={<span className="block h-2.5 w-4 rounded-[2px] border-2 border-current" aria-hidden />}
                tint="#111114" label="显示手机边框" right={<Toggle on={prefs.showFrame} onChange={(v) => onChange({ showFrame: v })} />}
                last={!prefs.showFrame}
              />
              {prefs.showFrame && (
                <Row
                  icon={<span className="block h-3.5 w-3.5 rounded-full ring-1 ring-white/40" style={{ background: frameById(prefs.frameColor).swatch }} />}
                  tint="#5b5b60" label="机身外壳" right={frameById(prefs.frameColor).label} onClick={() => setPage("frame")} last
                />
              )}
            </>
          ) : null}
        </div>
        {wide && (
          <p className="px-6 pt-1.5 text-[11.5px] leading-relaxed text-ink-soft/70">
            {prefs.showFrame ? "已显示仿真机身，屏幕四周带钛金中框。" : "当前为整屏沉浸模式，无机身边框；打开开关可显示仿真手机外壳。"}
          </p>
        )}

        {/* 通用 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<IconGear size={16} />} tint="#3fb68b" label="审核中心" right="开发者工坊" onClick={() => setPage("review")} />
          <Row icon={<IconGear size={16} />} tint="#8e8e93" label="通用" onClick={() => setPage("general")} last />
        </div>

        <p className="px-6 py-4 text-center text-[11.5px] text-ink-soft/70">STARLIGHT OS · 版本 2005.1</p>
      </div>
    </div>
  );
}

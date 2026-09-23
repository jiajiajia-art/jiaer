/* 设置：仿 iOS 分组列表（壁纸切换 / 显示与亮度 / 声音 / 勿扰 / 关于本机），公共交互惯例、无品牌素材 */
import { useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { gameTimeLabel } from "../../game/phone";
import { dayDateLabel, weekdayName, clockLabel } from "../../game/logic";
import { WALLPAPERS, wallpaperById, resolveWallpaper, customWallpaperCss, CUSTOM_WALLPAPER_ID, type WallpaperKind } from "./wallpapers";
import { IconChevron, IconSearch, IconGear, IconSun, IconMusic, IconClock, IconUser } from "./icons";
import { PHONE_FRAMES, frameById, type FrameId } from "../Phone";

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
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-white" style={{ background: tint }}>{icon}</span>
      <span className={`flex flex-1 items-center gap-2 py-1.5 text-[15.5px] text-ink ${last ? "" : "border-b border-black/[0.06]"}`}>
        {label}
        <span className="ml-auto flex items-center gap-1.5 text-[14px] text-ink-soft">{right}{onClick && <IconChevron size={14} />}</span>
      </span>
    </div>
  );
}

/* iOS 拨动开关 */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-[26px] w-[42px] rounded-full transition-colors ${on ? "bg-[#34c759]" : "bg-black/15"}`} aria-pressed={on}>
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

/* 界面主题风格：全站皮肤选择（像素复古 / 现代排版等），带迷你排版预览 */
function ThemeStylePage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="界面主题风格" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 pb-2 text-[12px] uppercase text-ink-soft">选择排版风格</p>
        <div className="mx-4 grid grid-cols-2 gap-3.5">
          <p className="col-span-2 px-2 text-[12px] leading-relaxed text-ink-soft">手机只负责通讯与生活功能，游戏主题风格请在主界面的设置中调整。</p>
        </div>
      </div>
    </div>
  );
}

/* 关于本机：设备信息只读列表 */
function AboutPage({ onBack, week }: { onBack: () => void; week: number }) {
  const rows: [string, string][] = [
    ["名称", "星辰的手机"],
    ["软件版本", "STARLIGHT OS 2005.1"],
    ["型号名称", "Starlight X"],
    ["型号", "A2005-CN"],
    ["序列号", "SXC05" + String(week).padStart(3, "0") + "ZH"],
    ["无线局域网地址", "88:05:20:0" + (week % 10) + ":C5:A1"],
    ["容量", "64 GB"],
    ["可用", `${Math.max(6, 64 - 12 - (week % 20))} GB`],
    ["运营商", "星城移动 05.1"],
  ];
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="关于本机" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          {rows.map(([k, v], i) => (
            <div key={k} className="flex items-center gap-3 bg-white px-3.5 py-2.5">
              <span className={`flex flex-1 items-center justify-between py-1 text-[15px] text-ink ${i < rows.length - 1 ? "border-b border-black/[0.06]" : ""}`}>
                {k}<span className="text-[14px] text-ink-soft">{v}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 通用：软件更新 / 储存空间 / 日期与时间 / 键盘 / 还原 */
function GeneralPage({ onBack, week, dateLabel, onAbout }: { onBack: () => void; week: number; dateLabel: string; onAbout: () => void }) {
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const usedGB = 12 + (week % 20);
  return (
    <div className="relative flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="通用" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<IconGear size={16} />} tint="#8e8e93" label="关于本机" onClick={onAbout} />
          <Row icon={<span className="text-[12px] font-bold">↻</span>} tint="#34c759" label="软件更新" right="已是最新" onClick={() => flash("STARLIGHT OS 已是最新版本")} last />
        </div>
        <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <div className="bg-white px-3.5 py-3">
            <div className="flex items-center justify-between text-[15px] text-ink"><span>iPhone 储存空间</span><span className="text-[13px] text-ink-soft">{usedGB} / 64 GB</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#0a84ff]" style={{ width: `${(usedGB / 64) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex gap-3 text-[11px] text-ink-soft">
              <span>· 应用 {Math.round(usedGB * 0.5)} GB</span><span>· 照片 {Math.round(usedGB * 0.3)} GB</span><span>· 系统 {Math.round(usedGB * 0.2)} GB</span>
            </div>
          </div>
        </div>
        <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<IconClock size={16} />} tint="#f5a623" label="日期与时间" right={`第 ${week} 周 · ${dateLabel}`} onClick={() => flash(`当前游戏内时间：第 ${week} 周 ${dateLabel}`)} />
          <Row icon={<span className="text-[12px]">⌨</span>} tint="#5856d6" label="键盘" right="简体拼音" onClick={() => flash("已启用：简体拼音 · 手写 · 五笔")} last />
        </div>
        <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<span className="text-[12px]">⟲</span>} tint="#ff3b30" label="还原" onClick={() => flash("如需重来，请到主菜单开启新存档")} last />
        </div>
      </div>
      {toast && <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center"><span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span></div>}
    </div>
  );
}

/* 无线局域网：开关 + 可选网络列表 */
const WIFI_NETS = ["STAR-2005", "启星事务所-5G", "浮光影视基地", "云台传媒城-VIP", "CMCC-星城"];
function WifiPage({ onBack }: { onBack: () => void }) {
  const [on, setOn] = useState(true);
  const [joined, setJoined] = useState("STAR-2005");
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="无线局域网" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<IconGear size={16} />} tint="#0a84ff" label="无线局域网" right={<Toggle on={on} onChange={setOn} />} last />
        </div>
        {on && (
          <>
            <p className="px-6 pb-1 pt-4 text-[12px] uppercase text-ink-soft">选取网络</p>
            <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
              {WIFI_NETS.map((n, i) => (
                <div key={n} onClick={() => setJoined(n)} role="button" className="flex cursor-pointer items-center gap-3 bg-white px-3.5 py-2 transition active:bg-black/[0.03]">
                  <span className={`flex flex-1 items-center gap-2 py-1.5 text-[15.5px] text-ink ${i < WIFI_NETS.length - 1 ? "border-b border-black/[0.06]" : ""}`}>
                    {joined === n && <span className="text-[#0a84ff]">✓</span>}
                    {n}
                    <span className="ml-auto flex items-center gap-1.5 text-ink-soft">🔒 <span className="text-[12px]">📶</span></span>
                  </span>
                </div>
              ))}
            </div>
            <p className="px-6 pt-2 text-[12px] text-ink-soft">已连接「{joined}」。</p>
          </>
        )}
      </div>
    </div>
  );
}

/* 蜂窝网络：数据开关 + 用量 */
function CellularPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState(true);
  const [roam, setRoam] = useState(false);
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <SubHeader title="蜂窝网络" onBack={onBack} />
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<span className="text-[11px] font-bold">5G</span>} tint="#34c759" label="蜂窝数据" right={<Toggle on={data} onChange={setData} />} />
          <Row icon={<IconGear size={16} />} tint="#0a84ff" label="数据漫游" right={<Toggle on={roam} onChange={setRoam} />} last />
        </div>
        <p className="px-6 pb-1 pt-4 text-[12px] uppercase text-ink-soft">当前周期用量</p>
        <div className="mx-4 overflow-hidden rounded-xl border border-black/5 bg-white">
          <Row icon={<span className="text-[12px]">📶</span>} tint="#8e8e93" label="运营商" right="星城移动" />
          <Row icon={<span className="text-[12px]">↑↓</span>} tint="#8e8e93" label="已用流量" right={data ? "3.2 GB" : "已关闭"} last />
        </div>
        <p className="px-6 pt-2 text-[12px] text-ink-soft">{data ? "蜂窝数据已开启，可在无 Wi-Fi 时上网。" : "蜂窝数据已关闭，仅在无线局域网下联网。"}</p>
      </div>
    </div>
  );
}

export default function SettingsApp({ onBack, prefs, onChange }: { onBack: () => void; prefs: Prefs; onChange: (p: Partial<Prefs>) => void }) {
  const { game } = useGame();
  const [page, setPage] = useState<"root" | "wallpaper" | "frame" | "general" | "about" | "wifi" | "cellular">("root");
  const [airplane, setAirplane] = useState(false);
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
  if (page === "about") return <AboutPage week={week} onBack={() => setPage("root")} />;
  if (page === "general") return <GeneralPage week={week} dateLabel={dateLabel} onBack={() => setPage("root")} onAbout={() => setPage("about")} />;
  if (page === "wifi") return <WifiPage onBack={() => setPage("root")} />;
  if (page === "cellular") return <CellularPage onBack={() => setPage("root")} />;

  return (
    <div className="flex h-full flex-col bg-[#f2f2f7]">
      <div className="flex items-center bg-[#f7f7f9] px-3 py-2.5">
        <button onClick={onBack} className="w-16 text-left text-[15px] text-[#0a84ff]">‹ 主屏</button>
        <span className="flex-1 text-center text-[16px] font-semibold text-ink">设置</span>
        <span className="w-16" />
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* 搜索框（装饰） */}
        <div className="px-4 py-2">
          <div className="flex items-center gap-1.5 rounded-[10px] bg-black/[0.06] px-2.5 py-1.5 text-[15px] text-ink-soft">
            <IconSearch size={16} /> 搜索
          </div>
        </div>

        {/* Apple ID 卡：玩家资料 */}
        <button onClick={() => {}} disabled className="mx-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-black/10 text-[20px] font-semibold text-ink-soft ring-1 ring-black/10">
            {game!.player.avatar
              ? <img src={game!.player.avatar} alt={game!.player.name} className="h-14 w-14 object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : game!.player.name?.[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[18px] font-semibold text-ink">{game!.player.name}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">星辰账户 · iCloud · 星城</p>
          </div>
        </button>

        {/* 无线 / 蜂窝（只读信息） */}
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<span className="text-[13px]">✈︎</span>} tint="#f5a623" label="飞行模式" right={<Toggle on={airplane} onChange={setAirplane} />} />
          <Row icon={<IconGear size={16} />} tint="#0a84ff" label="无线局域网" right={airplane ? "已关闭" : "STAR-2005"} onClick={() => setPage("wifi")} />
          <Row icon={<span className="text-[12px] font-bold">5G</span>} tint="#34c759" label="蜂窝网络" right={airplane ? "无服务" : "星城移动"} onClick={() => setPage("cellular")} last />
        </div>

        {/* 显示与亮度 + 墙纸 + 声音 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<IconSun size={16} />} tint="#0a84ff" label="显示与亮度" right={prefs.dark ? "深色" : "浅色"} onClick={() => onChange({ dark: !prefs.dark })} />
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
          <Row icon={<IconGear size={16} />} tint="#5856d6" label="墙纸" right={wp.label} onClick={() => setPage("wallpaper")} />
          <Row
            icon={<span className="text-[13px]">▭</span>}
            tint="#111114" label="显示手机边框" right={<Toggle on={prefs.showFrame} onChange={(v) => onChange({ showFrame: v })} />}
            last={!prefs.showFrame}
          />
          {prefs.showFrame && (
            <Row
              icon={<span className="block h-3.5 w-3.5 rounded-full ring-1 ring-white/40" style={{ background: frameById(prefs.frameColor).swatch }} />}
              tint="#5b5b60" label="机身外壳" right={frameById(prefs.frameColor).label} onClick={() => setPage("frame")} last
            />
          )}
        </div>
        <p className="px-6 pt-1.5 text-[11.5px] leading-relaxed text-ink-soft/70">
          {prefs.showFrame ? "已显示仿真机身，屏幕四周带钛金中框。" : "当前为整屏沉浸模式，无机身边框；打开开关可显示仿真手机外壳。"}
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<IconMusic size={16} />} tint="#ff2d55" label="声音与触感" right={<Toggle on={prefs.haptics} onChange={(v) => onChange({ haptics: v })} />} />
          <Row icon={<IconClock size={16} />} tint="#5856d6" label="专注 · 勿扰模式" right={<Toggle on={prefs.dnd} onChange={(v) => onChange({ dnd: v })} />} last />
        </div>

        {/* 通用 / 关于本机 */}
        <div className="mt-4 overflow-hidden rounded-xl border border-black/5 bg-white mx-4">
          <Row icon={<IconGear size={16} />} tint="#8e8e93" label="通用" onClick={() => setPage("general")} />
          <Row icon={<IconUser size={16} />} tint="#34c759" label="关于本机" right={`星城 · 第 ${week} 周`} onClick={() => setPage("about")} last />
        </div>

        <p className="px-6 py-4 text-center text-[11.5px] text-ink-soft/70">STARLIGHT OS · 版本 2005.1{prefs.dnd ? " · 勿扰开启" : ""}</p>
      </div>
    </div>
  );
}

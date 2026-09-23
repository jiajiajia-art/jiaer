import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useGame } from "../store/gameCtx";
import { ensurePhone, gameTimeLabel } from "../game/phone";
import WeChatApp from "./phone/WeChatApp";
import SmsApp from "./phone/SmsApp";
import CallApp from "./phone/CallApp";
import WeiboApp from "./phone/WeiboApp";
import XhsApp from "./phone/XhsApp";
import DouyinApp from "./phone/DouyinApp";
import TicketApp from "./phone/TicketApp";
import SettingsApp from "./phone/SettingsApp";
import { AppStoreApp, PomodoroApp, ClockApp, CalculatorApp, NotesApp, WeatherApp, type StoreItem, type IconApp } from "./phone/UtilApps";
import MusicApp from "./phone/MusicApp";
import BossZhipinApp from "./phone/BossZhipinApp";
import XianyuApp from "./phone/XianyuApp";
import ForumApp from "./phone/ForumApp";
import { renderWidget, isWidget, DEFAULT_WIDGET_SIZE, SHAPE_RADIUS, SHAPE_LABEL, nextShape, nextSize, type WidgetSize, type WidgetShape } from "./phone/Widgets";
import { APP_ICON } from "./phone/appIcons";
import { resolveWallpaper } from "./phone/wallpapers";

/* 仿真手机外壳：状态栏 + 主屏应用网格 + 应用路由。
 * 各应用各自封装在 src/components/phone/<App>.tsx 里，此处只负责编排。 */

type AppId =
  | "wechat" | "sms" | "call" | "weibo" | "xhs" | "douyin" | "ticket" | "settings" | "appstore"
  | "clock" | "pomodoro" | "calculator" | "notes" | "weather" | "cloudmusic" | "bosspin" | "xianyu" | "forum";

type AppMeta = { id: AppId; label: string };
/* 预装应用（含应用商店） */
const CORE: AppMeta[] = [
  { id: "wechat", label: "绿信" }, { id: "sms", label: "信息" }, { id: "call", label: "电话" },
  { id: "weibo", label: "冲浪" }, { id: "xhs", label: "小粉书" }, { id: "douyin", label: "云抖" },
  { id: "ticket", label: "票团团" }, { id: "cloudmusic", label: "云音乐" },
  { id: "bosspin", label: "老板直聘" }, { id: "xianyu", label: "咸鱼" },
  { id: "appstore", label: "应用商店" }, { id: "settings", label: "设置" },
];
/* 应用商店可下载组件 */
const SC = (id: string) => `https://images.unsplash.com/photo-${id}?w=680&h=440&fit=crop&auto=format&q=75`;
const STORE: StoreItem[] = [
  { id: "pomodoro", label: "番茄钟", tagline: "专注 25 分钟，科学休息", desc: "把拖延，切成一颗颗番茄", kicker: "本日 App", story: "开机前先定一颗番茄：25 分钟只做一件事，铃响就起身走走。片场等戏的碎片时间，也能背完一段台词。", icon: APP_ICON.pomodoro, cat: "效率", rating: 4.9, size: "3.2 MB", cover: SC("1516414447565-b14be0adf13e") },
  { id: "clock", label: "时钟闹钟", tagline: "走时表盘 + 通告闹钟", desc: "别再睡过头错过早班通告", kicker: "我们喜爱的 App", story: "指针表盘走时到秒，多组闹钟随手开关。给明早六点的定妆通告设一个，铃响时它真的会响。", icon: APP_ICON.clock, cat: "实用工具", rating: 4.8, size: "2.1 MB", cover: SC("1495364141860-b0d03eccd065") },
  { id: "notes", label: "备忘录", tagline: "台词、灵感、待办随手记", desc: "灵感来时，立刻记下", kicker: "编辑精选", story: "深夜想到的角色小传、明天要带的证件、导演随口的一句要求——打开即写，本地留存，不怕忘。", icon: APP_ICON.notes, cat: "效率", rating: 4.8, size: "1.9 MB", cover: SC("1517842645767-c639042777db") },
  { id: "calculator", label: "计算器", tagline: "片酬分成随手算", desc: "经典键位，随手就算", kicker: "实用工具", story: "经纪抽成、通告费、打车报销……四则运算一步到位，键位手感一如熟悉的那台。", icon: APP_ICON.calculator, cat: "实用工具", rating: 4.7, size: "1.4 MB", cover: SC("1554224155-6726b3ff858f") },
  { id: "weather", label: "天气", tagline: "星城天气与一周预报", desc: "出门通告，先看天", kicker: "生活方式", story: "外景在即，先看星城这一周的阴晴。今日实时天气与一周走势，一屏尽览。", icon: APP_ICON.weather, cat: "生活", rating: 4.6, size: "2.6 MB", cover: SC("1504608524841-42fe6f032b4b") },
  { id: "forum", label: "星潮", tagline: "追星饭圈发帖楼中楼", desc: "一层一层，看她怎么被夸上天", kicker: "社区精选", story: "路人、CP 粉、代拍、还有几个嘴硬的黑子——一条帖子一百多层楼，谁也别想安静吃瓜。多语种自带翻译，正主偶尔会亲自下场。", icon: APP_ICON.forum, cat: "社交", rating: 4.9, size: "5.4 MB", cover: SC("1522202176988-66273c2fd55f") },
  // 桌面美化小组件
  { id: "w-hero-clock", kind: "widget", label: "大字号时钟横幅", tagline: "整行大字号日期与时间", desc: "把时间放在你想要的位置", kicker: "桌面美化", story: "谁说时间一定在最顶端？这是你的手机。大字号日期时钟横幅，随手拖到任意位置，或干脆收起来。", icon: APP_ICON.clock, cat: "美化", rating: 4.9, size: "0.4 MB", cover: SC("1501139083538-0139583c060f") },
  { id: "w-photo", kind: "widget", label: "照片卡片", tagline: "上传照片，点亮桌面", desc: "把你的高光时刻放上桌面", kicker: "桌面美化", story: "上传一张自己的照片或喜欢的海报，桌面立刻不一样。点按卡片随时更换，配一句专属文案。", icon: APP_ICON.moments, cat: "美化", rating: 4.9, size: "0.8 MB", cover: SC("1524504388940-b1c1722653e1") },
  { id: "w-note", kind: "widget", label: "便签卡片", tagline: "桌面速记待办清单", desc: "把今日行程贴在桌面", kicker: "桌面美化", story: "暖黄色的便签卡，写下今天的通告与心情，回到桌面一眼就能看到。", icon: APP_ICON.notes, cat: "美化", rating: 4.7, size: "0.6 MB", cover: SC("1517842645767-c639042777db") },
  { id: "w-clock", kind: "widget", label: "时钟卡片", tagline: "桌面大字号时钟", desc: "时间，一眼即见", kicker: "桌面美化", story: "深色大时钟卡，日期与秒数一并呈现，赶通告时抬眼就知道还剩多久。", icon: APP_ICON.clock, cat: "美化", rating: 4.6, size: "0.5 MB", cover: SC("1495364141860-b0d03eccd065") },
  { id: "w-music", kind: "widget", label: "音乐卡片", tagline: "桌面迷你播放器", desc: "在桌面控制云音乐", kicker: "桌面美化", story: "无需打开 App，在桌面就能看到正在播放的曲目并暂停 / 切歌，与云音乐实时同步。", icon: APP_ICON.cloudmusic, cat: "美化", rating: 4.8, size: "0.7 MB", cover: SC("1470225620780-dba8ba36b745") },
];
const WIDGET_IDS = new Set(STORE.filter((s) => s.kind === "widget").map((s) => s.id));
const LABEL: Record<string, string> = Object.fromEntries([...CORE.map((c) => [c.id, c.label]), ...STORE.map((s) => [s.id, s.label])]);
/* 不可删除项：应用商店（唯一能装回其它应用的入口）+ 原始时间横幅（只能移动位置，不能删） */
const PROTECTED = new Set(["appstore", "w-hero-clock"]);
const APP_IDS = new Set([...CORE.map((c) => c.id), ...STORE.filter((s) => s.kind !== "widget").map((s) => s.id)]);
/* 自带应用的商店条目（供删除后重新安装） */
const CORE_STORE: StoreItem[] = CORE.filter((c) => c.id !== "appstore").map((c) => ({
  id: c.id, label: c.label, tagline: "手机自带应用", desc: c.label, kicker: "自带", story: "", icon: APP_ICON[c.id], cat: "自带", rating: 5, size: "—", cover: "",
}));

/* 仿真手机中框配色：可在「设置 · 机身外壳」自选。frame=中框渐变，btn=侧键渐变。 */
export type FrameId = "titanium" | "graphite" | "silver" | "gold" | "rose" | "purple" | "blue";
export const PHONE_FRAMES: { id: FrameId; label: string; swatch: string; frame: string; btn: string }[] = [
  { id: "titanium", label: "钛金原色", swatch: "#4a4c50", frame: "linear-gradient(145deg,#6e7075 0%,#3a3c40 18%,#26282b 50%,#3a3c40 82%,#6e7075 100%)", btn: "linear-gradient(180deg,#55575c,#303236)" },
  { id: "graphite", label: "曜石黑", swatch: "#1a1a1c", frame: "linear-gradient(145deg,#4a4a4d 0%,#1c1c1e 18%,#0b0b0c 50%,#1c1c1e 82%,#4a4a4d 100%)", btn: "linear-gradient(180deg,#3a3a3c,#141416)" },
  { id: "silver", label: "陶瓷白", swatch: "#e8e8ec", frame: "linear-gradient(145deg,#ffffff 0%,#e6e7eb 18%,#cfd0d6 50%,#e6e7eb 82%,#ffffff 100%)", btn: "linear-gradient(180deg,#f2f2f4,#cfd0d6)" },
  { id: "gold", label: "香槟金", swatch: "#d9b878", frame: "linear-gradient(145deg,#f8e8bd 0%,#dcbb7d 18%,#c39d54 50%,#dcbb7d 82%,#f8e8bd 100%)", btn: "linear-gradient(180deg,#ead29a,#c39d54)" },
  { id: "rose", label: "蔷薇粉", swatch: "#e79bb6", frame: "linear-gradient(145deg,#fbdbe6 0%,#eaa1bb 18%,#d87c9c 50%,#eaa1bb 82%,#fbdbe6 100%)", btn: "linear-gradient(180deg,#f2b8cc,#d87c9c)" },
  { id: "purple", label: "星幻紫", swatch: "#a68bec", frame: "linear-gradient(145deg,#ddd2f7 0%,#a68bec 18%,#7f63c9 50%,#a68bec 82%,#ddd2f7 100%)", btn: "linear-gradient(180deg,#bda9f0,#7f63c9)" },
  { id: "blue", label: "远峰蓝", swatch: "#7d9cd0", frame: "linear-gradient(145deg,#d3ddf1 0%,#8098cc 18%,#5c78b2 50%,#8098cc 82%,#d3ddf1 100%)", btn: "linear-gradient(180deg,#9db2dc,#5c78b2)" },
];
export const frameById = (id?: string) => PHONE_FRAMES.find((f) => f.id === id) ?? PHONE_FRAMES[0];

export type PhonePrefs = { wallpaper: string; customWallpaper?: string; brightness: number; dark: boolean; dnd: boolean; haptics: boolean; frameColor: FrameId; showFrame: boolean; installed: string[]; widgets: string[]; layout: string[]; widgetSizes: Record<string, WidgetSize>; widgetShapes: Record<string, WidgetShape>; iconOverrides: Record<string, string> };
const PREFS_KEY = "star2005.phone.prefs";
const DEFAULT_LAYOUT = ["w-hero-clock", ...CORE.map((c) => c.id)];
const DEFAULT_PREFS: PhonePrefs = {
  wallpaper: "ocean", brightness: 1, dark: true, dnd: false, haptics: true, frameColor: "titanium", showFrame: false,
  installed: CORE.map((c) => c.id), widgets: ["w-hero-clock"], layout: DEFAULT_LAYOUT, widgetSizes: {}, widgetShapes: {}, iconOverrides: {},
};
function loadPrefs(): PhonePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const p = parsed ? { ...DEFAULT_PREFS, ...parsed } : DEFAULT_PREFS;
    // 旧版存档没有 widgets 字段时，默认给一张大字号时钟横幅
    if (parsed && !("widgets" in parsed)) p.widgets = ["w-hero-clock"];
    // 应用商店永远预装（唯一不可删的）
    const installed = Array.from(new Set([...(Array.isArray(p.installed) ? p.installed : DEFAULT_PREFS.installed), "appstore"])).filter((id) => APP_IDS.has(id));
    // 原始时间横幅始终存在（只可移动、不可删除）
    const widgets = Array.from(new Set([...(Array.isArray(p.widgets) ? p.widgets : []).filter((id: string) => WIDGET_IDS.has(id)), "w-hero-clock"]));
    // 统一布局：应用与组件混排。旧存档用 order+widgets 迁移
    const legacy = Array.isArray(p.order) ? [...(Array.isArray(p.widgets) ? p.widgets : []), ...p.order] : [];
    const baseLayout = Array.isArray(p.layout) && p.layout.length ? p.layout : (legacy.length ? legacy : DEFAULT_LAYOUT);
    const present = new Set([...installed, ...widgets]);
    // 过滤到已存在项，并把遗漏的已装项补到末尾
    const layout = Array.from(new Set([...baseLayout.filter((id: string) => present.has(id)), ...installed, ...widgets]));
    const widgetSizes = (p.widgetSizes && typeof p.widgetSizes === "object") ? p.widgetSizes : {};
    const widgetShapes = (p.widgetShapes && typeof p.widgetShapes === "object") ? p.widgetShapes : {};
    const iconOverrides = (p.iconOverrides && typeof p.iconOverrides === "object") ? p.iconOverrides : {};
    return { ...p, installed, widgets, layout, widgetSizes, widgetShapes, iconOverrides };
  } catch { return DEFAULT_PREFS; }
}
/* 各应用的顶/底“系统色”：应用打开时，状态栏条与底部 Home 指示条改用应用自身的
 * 页首 / 页脚底色，避免露出主屏壁纸（dark=true 时状态栏文字用白色，否则用深色）。 */
type Chrome = { top: string; bottom: string; dark: boolean };
const APP_CHROME: Record<AppId, Chrome> = {
  wechat: { top: "#ededed", bottom: "#f7f7f7", dark: false },
  sms: { top: "#ffffff", bottom: "#ffffff", dark: false },
  call: { top: "#ffffff", bottom: "#f7f8fa", dark: false },
  weibo: { top: "#ff8140", bottom: "#ffffff", dark: true },
  xhs: { top: "#ffffff", bottom: "#ffffff", dark: false },
  douyin: { top: "#000000", bottom: "#000000", dark: true },
  ticket: { top: "#ff2d55", bottom: "#ffffff", dark: true },
  settings: { top: "#f2f2f7", bottom: "#f2f2f7", dark: false },
  appstore: { top: "#ffffff", bottom: "#f7f7f9", dark: false },
  clock: { top: "#000000", bottom: "#000000", dark: true },
  pomodoro: { top: "#1c1024", bottom: "#2a1530", dark: true },
  calculator: { top: "#000000", bottom: "#000000", dark: true },
  notes: { top: "#1c1c1e", bottom: "#1c1c1e", dark: true },
  weather: { top: "#2b5876", bottom: "#4e4376", dark: true },
  cloudmusic: { top: "#241c33", bottom: "#241c33", dark: true },
  bosspin: { top: "#ffffff", bottom: "#ffffff", dark: false },
  xianyu: { top: "#1a9b98", bottom: "#f5f6f7", dark: true },
  forum: { top: "#fff1f2", bottom: "#fff1f2", dark: false },
};

const sizeOf = (sizes: Record<string, WidgetSize>, id: string): WidgetSize => sizes[id] ?? DEFAULT_WIDGET_SIZE[id] ?? "sm";
const shapeOf = (shapes: Record<string, WidgetShape>, id: string): WidgetShape => shapes[id] ?? "rounded";

export default function Phone() {
  const { game } = useGame();
  const [app, setApp] = useState<AppId | null>(null);
  const [locked, setLocked] = useState(true);
  const [prefs, setPrefs] = useState<PhonePrefs>(loadPrefs);
  if (!game) return null;
  const ph = ensurePhone(game).phone!;
  const time = gameTimeLabel(game).split(" ").pop() ?? "08:00";
  const unreadTotal = ph.threads.reduce((a, t) => a + t.unread, 0);
  const back = () => setApp(null);
  const wp = resolveWallpaper(prefs.wallpaper, prefs.customWallpaper);
  // 应用打开时，顶/底系统条改用应用自身底色，避免露出主屏壁纸
  const chrome = app ? APP_CHROME[app] : null;
  const frame = frameById(prefs.frameColor);
  const updatePrefs = (p: Partial<PhonePrefs>) => setPrefs((cur) => {
    const next = { ...cur, ...p };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // 应用商店中：应用与小组件都记入 installedSet 用于「获取/已装」判定
  const installedSet = new Set([...prefs.installed, ...prefs.widgets]);
  const appendLayout = (id: string) => (prefs.layout.includes(id) ? prefs.layout : [...prefs.layout, id]);
  const install = (id: string) => {
    if (WIDGET_IDS.has(id)) {
      updatePrefs({ widgets: Array.from(new Set([...prefs.widgets, id])), layout: appendLayout(id) });
    } else {
      updatePrefs({ installed: Array.from(new Set([...prefs.installed, id])), layout: appendLayout(id) });
    }
    if (prefs.haptics && "vibrate" in navigator) navigator.vibrate?.(15);
  };
  const removeItem = (id: string) => {
    if (WIDGET_IDS.has(id)) {
      const sizes = { ...prefs.widgetSizes }; delete sizes[id];
      updatePrefs({ widgets: prefs.widgets.filter((x) => x !== id), layout: prefs.layout.filter((x) => x !== id), widgetSizes: sizes });
    } else {
      updatePrefs({ installed: prefs.installed.filter((x) => x !== id), layout: prefs.layout.filter((x) => x !== id) });
    }
  };
  // 供「图标」个性化页使用（已安装的应用及其默认图标）
  const iconApps: IconApp[] = prefs.installed.map((id) => ({ id, label: LABEL[id] ?? id, node: APP_ICON[id] ?? null }));
  const setIcon = (id: string, url: string | null) => {
    const next = { ...prefs.iconOverrides };
    if (url) next[id] = url; else delete next[id];
    updatePrefs({ iconOverrides: next });
  };
  // 恢复手机自带应用：列出被删掉的自带应用
  const reinstallable = CORE_STORE.filter((c) => !prefs.installed.includes(c.id));

  // 是否显示仿真机身边框：默认关闭（整屏沉浸），玩家可在「设置 · 显示与亮度」里打开
  const framed = prefs.showFrame;
  const screenRadius = framed ? "rounded-[2.4rem]" : "rounded-none";
  const screen = (
        <div
          className={`relative isolate flex flex-col overflow-hidden ring-1 ring-white/5 ${framed ? "h-[min(88vh,860px)] rounded-[2.4rem]" : "h-full min-h-[520px]"}`}
          style={{ background: chrome ? chrome.bottom : wp.css }}
        >
          <div
            className={`relative flex items-center justify-between px-7 pt-3.5 pb-1 text-[13px] font-semibold ${chrome && !chrome.dark ? "text-black/80" : "text-white"}`}
            style={chrome ? { background: chrome.top } : undefined}
          >
            <span className="flex items-center gap-1.5 tabular-nums tracking-tight">
              {time}
              {prefs.dnd && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-label="勿扰模式" className="opacity-90">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </span>
            <button
              onClick={() => { setApp(null); setLocked(true); }}
              aria-label="锁屏"
              title="点按锁屏"
              className="dynamic-island absolute left-1/2 top-2.5 h-[26px] w-[92px] -translate-x-1/2" />
            <div className="flex items-center gap-1.5">
              <SignalBars />
              <WifiGlyph />
              <BatteryGlyph />
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {app === null && (
              <HomeGrid
                layout={prefs.layout} installed={prefs.installed} widgets={prefs.widgets} widgetSizes={prefs.widgetSizes} widgetShapes={prefs.widgetShapes}
                iconOverrides={prefs.iconOverrides} onOpen={setApp} unread={unreadTotal}
                onReorder={(layout) => updatePrefs({ layout })}
                onRemove={removeItem}
                onResize={(id) => updatePrefs({ widgetSizes: { ...prefs.widgetSizes, [id]: nextSize(sizeOf(prefs.widgetSizes, id)) } })}
                onReshape={(id) => updatePrefs({ widgetShapes: { ...prefs.widgetShapes, [id]: nextShape(shapeOf(prefs.widgetShapes, id)) } })}
                onSetIcon={setIcon}
              />
            )}
            {app !== null && (
              <div key={app} className="phone-app-in h-full">
                {app === "wechat" && <WeChatApp onBack={back} />}
                {app === "sms" && <SmsApp onBack={back} />}
                {app === "call" && <CallApp onBack={back} />}
                {app === "weibo" && <WeiboApp onBack={back} />}
                {app === "xhs" && <XhsApp onBack={back} />}
                {app === "douyin" && <DouyinApp onBack={back} />}
                {app === "ticket" && <TicketApp onBack={back} />}
                {app === "settings" && <SettingsApp onBack={back} prefs={prefs} onChange={updatePrefs} />}
                {app === "appstore" && <AppStoreApp onBack={back} catalog={STORE} reinstallable={reinstallable} installed={installedSet} onInstall={install} onOpen={(id) => (WIDGET_IDS.has(id) ? setApp(null) : setApp(id as AppId))} iconApps={iconApps} iconOverrides={prefs.iconOverrides} onSetIcon={setIcon} />}
                {app === "pomodoro" && <PomodoroApp onBack={back} />}
                {app === "clock" && <ClockApp onBack={back} />}
                {app === "calculator" && <CalculatorApp onBack={back} />}
                {app === "notes" && <NotesApp onBack={back} />}
                {app === "weather" && <WeatherApp onBack={back} />}
                {app === "cloudmusic" && <MusicApp onBack={back} />}
                {app === "bosspin" && <BossZhipinApp onBack={back} />}
                {app === "xianyu" && <XianyuApp onBack={back} />}
                {app === "forum" && <ForumApp onBack={back} />}
              </div>
            )}
          </div>

          <button
            onClick={back}
            disabled={app === null}
            className="group mx-auto flex h-7 w-32 shrink-0 items-center justify-center disabled:opacity-30"
            style={{ minHeight: 28 }}
            aria-label="回到主屏"
          >
            <span aria-hidden className={`h-1 w-24 rounded-full transition ${
              chrome && !chrome.dark ? "bg-black/30 group-enabled:group-hover:bg-black/55" : "bg-white/45 group-enabled:group-hover:bg-white/80"
            }`}
            />
          </button>

          {locked && <LockScreen unread={unreadTotal} wallpaper={wp.css} radius={screenRadius} onUnlock={() => setLocked(false)} />}

          {(prefs.brightness < 1 || prefs.dark) && (
            <div
              className={`pointer-events-none absolute inset-0 z-50 transition-opacity ${screenRadius}`}
              style={{ background: prefs.dark ? "rgba(6,10,20,1)" : "rgba(0,0,0,1)", opacity: (1 - prefs.brightness) * 0.7 + (prefs.dark ? 0.12 : 0) }}
            />
          )}

          {/* 玻璃反光：一道斜向高光，让屏幕像一块真实盖板玻璃（仅带边框时呈现） */}
          {framed && (
            <>
              <div
                className="pointer-events-none absolute inset-0 z-[60] rounded-[2.4rem]"
                style={{ background: "linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 14%, transparent 34%, transparent 100%)" }}
              />
              <div className="pointer-events-none absolute inset-0 z-[60] rounded-[2.4rem] shadow-[inset_0_0_1px_1px_rgba(255,255,255,0.08)]" />
            </>
          )}
        </div>
  );

  return (
    <div className={framed ? "mx-auto flex min-h-full w-full max-w-[min(440px,96vw)] flex-col justify-center px-2 py-2" : "flex h-full w-full flex-col"}>
      {framed ? (
        /* 机身：钛金属中框 + 侧键 + 内屏 */
        <div className="phone-frame relative rounded-[3.2rem] p-[5px]" style={{ background: frame.frame }}>
          <span className="phone-btn absolute -left-[3px] top-[15%] h-8 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -left-[3px] top-[23%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -left-[3px] top-[33%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r" style={{ background: frame.btn }} />
          <div className="rounded-[2.9rem] bg-black p-[9px]">{screen}</div>
        </div>
      ) : (
        screen
      )}
    </div>
  );
}

/* —— 状态栏图标（纯 SVG，随缩放清晰） —— */
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

/* 每格权重：应用 1；组件 小(2×2)=4、大(整行 4×2)=8。用于按页容量分页（每页 4×5=20 格）。 */
const cellWeight = (id: string, size: WidgetSize) => (isWidget(id) ? (size === "lg" ? 16 : size === "md" ? 8 : 4) : 1);

function HomeGrid({ layout, installed, widgets, widgetSizes, widgetShapes, iconOverrides, onOpen, unread, onReorder, onRemove, onResize, onReshape, onSetIcon }: {
  layout: string[]; installed: string[]; widgets: string[]; widgetSizes: Record<string, WidgetSize>; widgetShapes: Record<string, WidgetShape>;
  iconOverrides: Record<string, string>; onOpen: (a: AppId) => void; unread: number;
  onReorder: (layout: string[]) => void; onRemove: (id: string) => void; onResize: (id: string) => void;
  onReshape: (id: string) => void; onSetIcon: (id: string, url: string | null) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [iconEditing, setIconEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const present = new Set([...installed, ...widgets]);
  const external = layout.filter((id) => present.has(id));
  const [order, setOrder] = useState<string[]>(external);
  const drag = useRef<string | null>(null);
  const moved = useRef(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部布局变化时同步（安装 / 删除 / 尺寸）
  const extKey = external.join(",");
  if (extKey !== order.join(",") && drag.current === null) setOrder(external);

  const canRemove = (id: string) => !PROTECTED.has(id);
  const reorderTo = (target: string) => {
    const from = drag.current;
    if (!from || from === target) return;
    setOrder((cur) => { const n = cur.filter((x) => x !== from); n.splice(n.indexOf(target), 0, from); return n; });
    moved.current = true;
  };
  const endDrag = () => { drag.current = null; onReorder(order); };

  // 按格权重分页（每页 20 格），横向滑动翻页
  const PAGE_CAP = 20;
  const pages: string[][] = [[]];
  let used = 0;
  for (const id of order) {
    const w = cellWeight(id, sizeOf(widgetSizes, id));
    if (used + w > PAGE_CAP && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(id); used += w;
  }
  const scroller = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const onScroll = () => { const el = scroller.current; if (el) setPage(Math.round(el.scrollLeft / el.clientWidth)); };

  const holdProps = {
    onPointerDown: () => { moved.current = false; if (!edit) pressTimer.current = setTimeout(() => setEdit(true), 500); },
    onPointerUp: () => { if (pressTimer.current) clearTimeout(pressTimer.current); },
    onPointerLeave: () => { if (pressTimer.current) clearTimeout(pressTimer.current); },
  };
  const dragProps = (id: string) => ({
    draggable: edit,
    onDragStart: () => { drag.current = id; moved.current = false; },
    onDragEnter: () => reorderTo(id),
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragEnd: endDrag,
  });
  const RemoveBtn = ({ id }: { id: string }) => (
    <span onClick={(e) => { e.stopPropagation(); onRemove(id); setOrder((o) => o.filter((x) => x !== id)); }}
      className="absolute -left-1.5 -top-1.5 z-10 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-black/70 text-[13px] font-bold text-white shadow ring-1 ring-white/20">−</span>
  );

  const AppTile = ({ id, i }: { id: string; i: number }) => {
    const label = LABEL[id] ?? id;
    return (
      <button
        {...dragProps(id)} {...holdProps}
        onClick={(e) => { if (edit) { e.stopPropagation(); if (!moved.current) setIconEditing(id); return; } if (!moved.current) onOpen(id as AppId); }}
        className={`phone-icon-in group relative flex flex-col items-center gap-1.5 ${edit ? "phone-jiggle" : ""}`}
        style={{ animationDelay: edit ? undefined : `${i * 40}ms` }}
      >
        <span className="ios-icon relative block h-[58px] w-[58px] overflow-hidden rounded-[14px] shadow-sm">
          {iconOverrides?.[id]
            ? <img src={iconOverrides[id]} alt={label} className="h-full w-full scale-[1.14] object-cover" />
            : (APP_ICON[id] ?? <span className="flex h-full w-full items-center justify-center bg-[#232323] text-white font-medium">{label[0]}</span>)}
          {id === "wechat" && unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-black/10">{unread}</span>
          )}
          {edit && canRemove(id) && <RemoveBtn id={id} />}
        </span>
        <span className="max-w-[74px] truncate text-center text-[12px] font-medium tracking-tight text-white drop-shadow-sm">{label}</span>
      </button>
    );
  };

  const WidgetTile = ({ id }: { id: string }) => {
    const size = sizeOf(widgetSizes, id);
    const shape = shapeOf(widgetShapes, id);
    // 大字号时钟横幅是纯文字横幅：始终整行，但高度按内容收窄，避免留出一大块空框
    // 大字号时钟横幅是纯文字横幅：整行，高度贴合内容（最多 2 行），不留大空框
    const span = id === "w-hero-clock"
      ? (size === "sm" ? "col-span-4 row-span-1" : "col-span-4 row-span-2")
      : size === "lg" ? "col-span-4 row-span-4" : size === "md" ? "col-span-4 row-span-2" : "col-span-2 row-span-2";
    const sizeLabel = size === "sm" ? "小" : size === "md" ? "中" : "大";
    return (
      <div {...dragProps(id)} {...holdProps} onClick={(e) => edit && e.stopPropagation()}
        className={`relative ${span} ${edit ? "phone-jiggle" : ""}`}>
        <div className="h-full w-full overflow-hidden" style={{ borderRadius: SHAPE_RADIUS[shape] }}>
          {renderWidget(id)}
        </div>
        {edit && (
          <>
            {canRemove(id) && <RemoveBtn id={id} />}
            <div className="absolute -right-1.5 -top-1.5 z-10 flex gap-1">
              <button onClick={(e) => { e.stopPropagation(); onReshape(id); }}
                className="flex h-[20px] items-center justify-center rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-white shadow ring-1 ring-white/20">
                {SHAPE_LABEL[shape]}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onResize(id); }}
                className="flex h-[20px] items-center justify-center rounded-full bg-black/70 px-1.5 text-[10px] font-bold text-white shadow ring-1 ring-white/20">
                {sizeLabel}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col" onClick={() => edit && setEdit(false)}>
      {edit && (
        <div className="px-6 pb-2 pt-6 text-center text-white drop-shadow">
          <p className="text-[12px] font-medium text-white/85">拖动排序 · 点应用改图标 · 组件调大小 / 形状 · 点角标删除 · 左右翻页 · 空白处完成</p>
        </div>
      )}

      {/* 横向翻页容器 */}
      <div ref={scroller} onScroll={onScroll}
        className="phone-pages flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden">
        {pages.map((ids, pi) => (
          <div key={pi} className="phone-pages h-full w-full shrink-0 snap-center overflow-y-auto px-6 pt-4">
            <div className="grid grid-cols-4 gap-x-3 gap-y-5 pb-4 pt-1 [grid-auto-flow:row_dense] [grid-auto-rows:84px]">
              {ids.map((id, i) => isWidget(id) ? <WidgetTile key={id} id={id} /> : <AppTile key={id} id={id} i={i} />)}
            </div>
          </div>
        ))}
      </div>

      {/* 页码圆点 */}
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-1">
          {pages.map((_, pi) => (
            <span key={pi} className={`h-1.5 w-1.5 rounded-full transition ${pi === page ? "bg-white" : "bg-white/35"}`} />
          ))}
        </div>
      )}

      {/* 图标个性化：编辑模式下点应用图标弹出 */}
      {iconEditing && (
        <div className="absolute inset-0 z-[70] flex items-end bg-black/50" onClick={(e) => { e.stopPropagation(); setIconEditing(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-[#1c1c1e] p-5 pb-7 text-white">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
            <div className="flex items-center gap-3">
              <span className="ios-icon relative block h-[52px] w-[52px] overflow-hidden">
                {iconOverrides?.[iconEditing]
                  ? <img src={iconOverrides[iconEditing]} alt="" className="h-full w-full scale-[1.14] object-cover" />
                  : (APP_ICON[iconEditing] ?? <span className="flex h-full w-full items-center justify-center bg-zinc-600">{(LABEL[iconEditing] ?? iconEditing)[0]}</span>)}
              </span>
              <div>
                <p className="text-[15px] font-semibold">{LABEL[iconEditing] ?? iconEditing}</p>
                <p className="text-[12px] text-white/55">自定义主屏图标</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (!f || !iconEditing) return;
                const r = new FileReader();
                r.onload = () => { onSetIcon(iconEditing, String(r.result)); setIconEditing(null); };
                r.readAsDataURL(f);
              }} />
            <button onClick={() => fileRef.current?.click()}
              className="mt-5 w-full rounded-xl bg-white/10 py-3 text-[15px] font-medium text-white transition active:bg-white/[0.06]">
              从相册选择图片
            </button>
            {iconOverrides?.[iconEditing] && (
              <button onClick={() => { onSetIcon(iconEditing, null); setIconEditing(null); }}
                className="mt-2 w-full rounded-xl bg-white/10 py-3 text-[15px] font-medium text-[#ff6b6b] transition active:bg-white/[0.06]">
                恢复默认图标
              </button>
            )}
            <button onClick={() => setIconEditing(null)}
              className="mt-2 w-full rounded-xl bg-white/[0.06] py-3 text-[15px] text-white/70">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 锁屏：大字号时钟 + 日期，上滑 / 轻触解锁（时间走真实时钟，秒级更新） */
function LockScreen({ unread, wallpaper, radius = "rounded-[2.4rem]", onUnlock }: { unread: number; wallpaper: string; radius?: string; onUnlock: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const dateLine = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  const onDown = (e: ReactPointerEvent) => { startY.current = e.clientY; };
  const onMove = (e: ReactPointerEvent) => { if (startY.current != null) setDragY(Math.min(0, e.clientY - startY.current)); };
  const onUp = () => { if (dragY < -55) onUnlock(); else setDragY(0); startY.current = null; };

  const lift = Math.max(0, -dragY);
  return (
    <div
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      onClick={() => { if (lift < 6) onUnlock(); }}
      className={`absolute inset-0 z-[45] flex touch-none select-none flex-col items-center text-white ${radius}`}
      style={{ transform: `translateY(${dragY}px)`, opacity: Math.max(0, 1 - lift / 240), transition: startY.current == null ? "transform .32s cubic-bezier(.22,1,.36,1), opacity .32s" : "none" }}
    >
      {/* 锁屏自带壁纸底层：不透明，遮住背后的主屏 */}
      <div className={`pointer-events-none absolute inset-0 ${radius}`} style={{ background: wallpaper }} />
      {/* 顶部压暗，让白色时间在任意壁纸上都清晰 */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55 ${radius}`} />

      <div className="relative z-10 mt-[26%] flex flex-col items-center">
        {/* 小锁 */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mb-4 opacity-90 drop-shadow">
          <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" fill="currentColor" />
          <path d="M7.6 10.5V8a4.4 4.4 0 0 1 8.8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="text-[15px] font-medium tracking-wide text-white/85 drop-shadow">{dateLine}</p>
        <p className="mt-1 text-[86px] font-thin leading-none tabular-nums tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)]">{hh}:{mm}</p>

        {unread > 0 && (
          <div className="mt-8 flex items-center gap-2.5 rounded-2xl bg-white/12 px-4 py-2.5 backdrop-blur-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#07c160] text-[15px]">💬</span>
            <div className="text-left">
              <p className="text-[13px] font-semibold leading-tight">微信</p>
              <p className="text-[11.5px] text-white/80">你有 {unread} 条新消息</p>
            </div>
          </div>
        )}
      </div>

      {/* 底部上滑提示 */}
      <div className="relative z-10 mt-auto flex flex-col items-center pb-6">
        <p className="text-[12.5px] text-white/70 drop-shadow" style={{ opacity: Math.max(0, 1 - lift / 60) }}>轻触或上滑解锁</p>
        <div className="mt-3 h-1 w-32 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

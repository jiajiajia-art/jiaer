import { loadData, saveData, loadGlobal, saveGlobal } from "../lib/saveScope";
import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useGame } from "../store/gameCtx";
import { ensurePhone, gameTimeLabel } from "../game/phone";
import WeChatApp from "./phone/WeChatApp";
import SmsApp from "./phone/SmsApp";
import CallApp from "./phone/CallApp";
import WeiboApp from "./phone/WeiboApp";
import XhsApp from "./phone/XhsApp";
import TicketApp from "./phone/TicketApp";
import SettingsApp from "./phone/SettingsApp";
import { AppStoreApp, PomodoroApp, ClockApp, CalculatorApp, NotesApp, GlobalPhoneAlerts, WeatherApp, type StoreItem, type IconApp } from "./phone/UtilApps";
import MusicApp from "./phone/MusicApp";
import BossZhipinApp from "./phone/BossZhipinApp";
import XianyuApp from "./phone/XianyuApp";
import PeekApp from "./phone/PeekApp";
import CoupleApp from "./phone/CoupleApp";
import { useCouple } from "./phone/couple/store";
import { runSync, useSyncState, loadFeed } from "./phone/worldSync";
import { useProactiveMessages } from "./phone/wxFeatures";
import ForumApp from "./phone/ForumApp";
import { requestWallet } from "./phone/WalletBinder";
import MailApp from "./phone/MailApp";
import ReadApp from "./phone/ReadApp";
import VideoApp from "./phone/VideoApp";
import IncomingCall from "./phone/IncomingCall";
import { logAppOpen, mailUnread } from "../game/phoneLink";
import { useGameNow, renderWidget, isWidget, DEFAULT_WIDGET_SIZE, SHAPE_RADIUS, SHAPE_LABEL, nextShape, nextSize, type WidgetSize, type WidgetShape } from "./phone/Widgets";
import { APP_ICON } from "./phone/appIcons";
import { phoneAppAllowed, worldPhoneAppsCfg, worldPhoneHomeWallpaper } from "../mods/registry";
import { phoneAppLabel, preinstallIds } from "../lib/phoneAppsConfig";
import { resolveEffectiveHomeWallpaper } from "./phone/wallpapers";
import { liveTerm as T } from "../mods/live";
import SlimePet from "./phone/studio/Slime";
import { usePetMode, useStudioOpen } from "./phone/studio/pet";
import { requestStudio } from "./phone/studio/review";
import { usePlatformAppsCatalog } from "../lib/usePlatformAppsCatalog";
import {
  platformAppLegacyUi,
  resolvePlatformAppIconUrl,
  type PlatformApp,
} from "../lib/platformApps";
import PlatformTypeApp from "./phone/PlatformTypeApp";

/* 仿真手机外壳：状态栏 + 主屏应用网格 + 应用路由。
 * 各应用各自封装在 src/components/phone/<App>.tsx 里，此处只负责编排。 */

/** 功能注释：含平台动态 appId；专用页仍用字面量分支 */
type AppId = string;

type AppMeta = { id: AppId; label: string };
/* 预装应用（含应用商店） */
const CORE: AppMeta[] = [
  { id: "wechat", label: "绿信" }, { id: "sms", label: "信息" }, { id: "call", label: "电话" }, { id: "mail", label: "邮箱" },
  { id: "weibo", label: "冲浪" }, { id: "xhs", label: "小粉书" },
  { id: "ticket", label: "票团团" }, { id: "cloudmusic", label: "云音乐" }, { id: "read", label: "阅读" }, { id: "video", label: "视频" },
  { id: "bosspin", label: "老板直聘" }, { id: "xianyu", label: "咸鱼" }, { id: "peek", label: "视监" }, { id: "couple", label: "情侣空间" },
  { id: "appstore", label: "应用商店" }, { id: "settings", label: "设置" },
];
/* 应用商店可下载组件 */
const SC = (id: string) => `https://images.unsplash.com/photo-${id}?w=680&h=440&fit=crop&auto=format&q=75`;
const STORE: StoreItem[] = [
  { id: "pomodoro", label: "番茄钟", tagline: "专注 25 分钟，科学休息", desc: "把拖延，切成一颗颗番茄", kicker: "本日 App", story: "开机前先定一颗番茄：25 分钟只做一件事，铃响就起身走走。片场等戏的碎片时间，也能背完一段台词。", icon: APP_ICON.pomodoro, cat: "效率", rating: 4.9, size: "3.2 MB", cover: SC("1516414447565-b14be0adf13e") },
  { id: "clock", label: "时钟闹钟", get tagline() { return `走时表盘 + ${T("gig")}闹钟`; }, get desc() { return `别再睡过头错过早班${T("gig")}`; }, kicker: "我们喜爱的 App", get story() { return `指针表盘走时到秒，多组闹钟随手开关。给明早六点的定妆${T("gig")}设一个，铃响时它真的会响。`; }, icon: APP_ICON.clock, cat: "实用工具", rating: 4.8, size: "2.1 MB", cover: SC("1495364141860-b0d03eccd065") },
  { id: "notes", label: "备忘录", tagline: "台词、灵感、待办随手记", desc: "灵感来时，立刻记下", kicker: "编辑精选", story: "深夜想到的角色小传、明天要带的证件、导演随口的一句要求——打开即写，本地留存，不怕忘。", icon: APP_ICON.notes, cat: "效率", rating: 4.8, size: "1.9 MB", cover: SC("1517842645767-c639042777db") },
  { id: "calculator", label: "计算器", tagline: "片酬分成随手算", desc: "经典键位，随手就算", kicker: "实用工具", get story() { return `经纪抽成、${T("gig")}费、打车报销……四则运算一步到位，键位手感一如熟悉的那台。`; }, icon: APP_ICON.calculator, cat: "实用工具", rating: 4.7, size: "1.4 MB", cover: SC("1554224155-6726b3ff858f") },
  { id: "weather", label: "天气", get tagline() { return `${T("city")}天气与一周预报`; }, get desc() { return `出门${T("gig")}，先看天`; }, kicker: "生活方式", get story() { return `外景在即，先看${T("city")}这一周的阴晴。今日实时天气与一周走势，一屏尽览。`; }, icon: APP_ICON.weather, cat: "生活", rating: 4.6, size: "2.6 MB", cover: SC("1504608524841-42fe6f032b4b") },
  { id: "forum", label: "星潮", tagline: "追星饭圈发帖楼中楼", desc: "一层一层，看她怎么被夸上天", kicker: "社区精选", story: "路人、CP 粉、代拍、还有几个嘴硬的黑子——一条帖子一百多层楼，谁也别想安静吃瓜。多语种自带翻译，正主偶尔会亲自下场。", icon: APP_ICON.forum, cat: "社交", rating: 4.9, size: "5.4 MB", cover: SC("1522202176988-66273c2fd55f") },
  // 桌面美化小组件
  { id: "w-hero-clock", kind: "widget", label: "大字号时钟横幅", tagline: "整行大字号日期与时间", desc: "把时间放在你想要的位置", kicker: "桌面美化", story: "谁说时间一定在最顶端？这是你的手机。大字号日期时钟横幅，随手拖到任意位置，或干脆收起来。", icon: APP_ICON.clock, cat: "美化", rating: 4.9, size: "0.4 MB", cover: SC("1501139083538-0139583c060f") },
  { id: "w-photo", kind: "widget", label: "照片卡片", tagline: "上传照片，点亮桌面", desc: "把你的高光时刻放上桌面", kicker: "桌面美化", story: "上传一张自己的照片或喜欢的海报，桌面立刻不一样。点按卡片随时更换，配一句专属文案。", icon: APP_ICON.moments, cat: "美化", rating: 4.9, size: "0.8 MB", cover: SC("1524504388940-b1c1722653e1") },
  { id: "w-note", kind: "widget", label: "便签卡片", tagline: "桌面速记待办清单", desc: "把今日行程贴在桌面", kicker: "桌面美化", get story() { return `暖黄色的便签卡，写下今天的${T("gig")}与心情，回到桌面一眼就能看到。`; }, icon: APP_ICON.notes, cat: "美化", rating: 4.7, size: "0.6 MB", cover: SC("1517842645767-c639042777db") },
  { id: "w-clock", kind: "widget", label: "时钟卡片", tagline: "桌面大字号时钟", desc: "时间，一眼即见", kicker: "桌面美化", get story() { return `深色大时钟卡，日期与秒数一并呈现，赶${T("gig")}时抬眼就知道还剩多久。`; }, icon: APP_ICON.clock, cat: "美化", rating: 4.6, size: "0.5 MB", cover: SC("1495364141860-b0d03eccd065") },
  { id: "w-music", kind: "widget", label: "音乐卡片", tagline: "桌面迷你播放器", desc: "在桌面控制云音乐", kicker: "桌面美化", story: "无需打开 App，在桌面就能看到正在播放的曲目并暂停 / 切歌，与云音乐实时同步。", icon: APP_ICON.cloudmusic, cat: "美化", rating: 4.8, size: "0.7 MB", cover: SC("1470225620780-dba8ba36b745") },
  { id: "w-wallet", kind: "widget", label: "钱包卡片", tagline: "余额一眼可见", desc: "绑定世界里的货币", kicker: "桌面美化", story: "金币、灵石还是微信零钱？点按卡片就能把钱包绑到世界观里的任意货币属性，购物、打赏、红包、转账都自动记账。", icon: APP_ICON.wechat, cat: "美化", rating: 4.8, size: "0.3 MB", cover: SC("1579758258316-57081bac8ea8") },
];
/* 点按组件 → 打开对应 App（照片卡片自带点按换图，不跳转） */
const WIDGET_TARGET: Record<string, AppId> = { "w-hero-clock": "clock" as AppId, "w-clock": "clock" as AppId, "w-note": "notes" as AppId, "w-music": "cloudmusic" as AppId, "w-wallet": "wechat" as AppId };
const WIDGET_IDS = new Set(STORE.filter((s) => s.kind === "widget").map((s) => s.id));
const BUILTIN_LABEL: Record<string, string> = Object.fromEntries([...CORE.map((c) => [c.id, c.label]), ...STORE.map((s) => [s.id, s.label])]);
/** 功能注释：显示名优先平台表，再模组覆盖，再内置名 */
let platformNameLookup: (id: string) => string | undefined = () => undefined;
let platformIconLookup: (id: string) => string | undefined = () => undefined;
const appLabel = (id: string) =>
  platformNameLookup(id) || phoneAppLabel(id, worldPhoneAppsCfg(), BUILTIN_LABEL[id] ?? id);
/* 兼容旧引用：LABEL 仍导出内置表；运行时请用 appLabel() */
const LABEL = BUILTIN_LABEL;
/* 不可删除项：应用商店（唯一能装回其它应用的入口）+ 原始时间横幅（只能移动位置，不能删） */
const PROTECTED = new Set(["appstore", "w-hero-clock"]);
const APP_IDS = new Set([...CORE.map((c) => c.id), ...STORE.filter((s) => s.kind !== "widget").map((s) => s.id)]);
/* 旧官方应用封面回退（图标改由平台表 icon 字段驱动） */
const CORE_META: Record<string, [tagline: string, desc: string, cat: string, story: string, cover: string]> = {
  wechat: ["聊天、朋友圈、钱包", "和圈内人保持联络", "社交", "私聊、群聊与朋友圈都在这里。谁先回你消息，谁的朋友圈又暗戳戳在说什么，一刷就知道。", SC("1611162617213-7d7a39e9b1d7")],
  get sms(): [string, string, string, string, string] { return ["短信与通知", `${T("gig")}、快递与那条没署名的短信`, "通讯", `经纪公司的${T("gig")}、剧组的集合时间、银行的入账提醒，还有熟人发来的短信，都汇到这里。`, SC("1512941937669-90a1b58e7e9c")]; },
  call: ["通话记录与拨号", "未接来电，往往最要紧", "通讯", "拨给想见的人，翻看未接来电和留言。每通电话都记在通话记录里。", SC("1523966211575-eb4a01e7dd51")],
  weibo: ["热搜、话题与博文", "今天，谁又上了热搜", "社交", "冲浪热榜随剧情实时更新。点进话题，看媒体、路人和圈内人怎么说你。", SC("1611162616475-46b635cb6868")],
  xhs: ["种草笔记与穿搭", "红毯造型，先来这里抄作业", "生活", "造型、探店、试镜心得，一页页翻下去，也许会看到关于你的那篇。", SC("1483985988355-763728e1935b")],
  ticket: ["演出、首映与展览购票", "首映礼的票，抢到了吗", "生活", "演唱会、话剧、电影首映、展览，选好场次和票档就能下单，票会收进票夹。", SC("1501281668745-f7f57925c3b4")],
  cloudmusic: ["音乐、歌词与榜单", "片尾曲一响，就想起那场戏", "音乐", "能播放的歌单、滚动歌词和热评。剧里的插曲、她唱的 OST，都在榜上。", SC("1470225620780-dba8ba36b745")],
  get bosspin(): [string, string, string, string, string] { return [`试镜、${T("gig")}与招募`, "下一个角色，在这里等你", "事业", "剧组选角、品牌代言、综艺招募。投递之后，和对方 HR 直接聊。", SC("1521737604893-d14cc237f11d")]; },
  xianyu: ["二手闲置交易", "旧礼服，也有人在等", "购物", "卖掉闲置的礼服和道具，也能逛集市，淘到和剧情有关的小东西。", SC("1556742049-0cfed4f6a45d")],
  peek: ["偷看 TA 的手机", "TA 的手机里，藏着什么", "社交", "选一个人，看看 TA 的聊天、搜索记录、备忘录和相册。TA 对你的真实态度，可能就写在里面。", SC("1512428559087-560fa5ceab42")],
  read: ["小说、随笔与连载", "圈内人的书，也在这里", "阅读", "书城随剧情上新：圈内人物的随笔自传、以你为原型的同人连载。读到喜欢的章节，可以直接打赏作者，余额走手机钱包。", SC("1512820790803-83ca734da794")],
  video: ["视频、弹幕与直播", "今天的名场面，有人剪好了", "娱乐", "刷推荐流、发弹幕、给喜欢的 UP 主充电；直播间也在这里，打赏同样从手机钱包扣款。", SC("1611162616475-46b635cb6868")],
  mail: ["来信、通知与回信", "有些话，适合写成一封信", "通讯", "角色的来信、平台通知与合作邀约都寄到这里。写给 TA 的信，TA 会在之后的剧情里择机回复。", SC("1634562876572-5abe57afcceb")],
  settings: ["壁纸、机身与通用", "把小手机调成你喜欢的样子", "工具", "更换壁纸、机身外壳配色，查看储存空间与游戏内时间。", SC("1511707171634-5f897ff02aa9")],
};
/** 功能注释：平台应用 → 商店条目；列表用作者名，不再写内置标签 */
function platformToStoreItem(app: PlatformApp): StoreItem {
  const iconUrl = app.icon ? resolvePlatformAppIconUrl(app.icon) : "";
  const cover = app.previews?.[0] ? resolvePlatformAppIconUrl(app.previews[0]) : (CORE_META[app.appId]?.[4] || SC("1516414447565-b14be0adf13e"));
  const author = app.authorName || app.authorId || "作者";
  return {
    id: app.appId,
    label: app.name || app.appId,
    tagline: app.summary || "暂无说明",
    desc: app.summary || app.name || app.appId,
    kicker: author,
    story: app.summary || "",
    icon: iconUrl ? <img src={iconUrl} alt="" className="h-full w-full object-cover" /> : (APP_ICON[app.appId] ?? null),
    cat: app.category || PLATFORM_TYPE_CAT[app.type] || "应用",
    rating: 4.9,
    size: author,
    cover,
    core: true,
    authorName: author,
  };
}
const PLATFORM_TYPE_CAT: Record<string, string> = {
  chat: "社交",
  message: "通讯",
  browse: "浏览",
  read: "阅读",
  video: "娱乐",
  job: "招聘",
};
const UTILITY_CATALOG: StoreItem[] = STORE;

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

export type PhonePrefs = { wallpaper: string; customWallpaper?: string; /** 玩家在设置里主动换过桌面背景 */ wallpaperUserSet?: boolean; brightness: number; dark: boolean; dnd: boolean; haptics: boolean; frameColor: FrameId; showFrame: boolean; installed: string[]; widgets: string[]; layout: string[]; widgetSizes: Record<string, WidgetSize>; widgetShapes: Record<string, WidgetShape>; iconOverrides: Record<string, string> };
/** 外观偏好：全局 UI（壁纸 / 机身等） */
const PREFS_KEY = "star2005.phone.prefs";
/** 已装应用 / 布局：存档私有，刷新与读档保持一致 */
const APPS_KEY = "star2005.phone.apps";
const DEFAULT_LAYOUT = ["w-hero-clock", ...CORE.map((c) => c.id)];
const defaultInstalled = () => preinstallIds(worldPhoneAppsCfg()).filter((id) => APP_IDS.has(id));
const DEFAULT_PREFS: PhonePrefs = {
  wallpaper: "ocean", brightness: 1, dark: false, dnd: false, haptics: false, frameColor: "titanium", showFrame: true,
  installed: CORE.map((c) => c.id).filter((id) => id !== "xianyu"),
  widgets: ["w-hero-clock"], layout: DEFAULT_LAYOUT, widgetSizes: {}, widgetShapes: {}, iconOverrides: {},
};

type AppsSlice = Pick<PhonePrefs, "installed" | "widgets" | "layout" | "widgetSizes" | "widgetShapes">;
type LookSlice = Pick<PhonePrefs, "wallpaper" | "customWallpaper" | "wallpaperUserSet" | "brightness" | "dark" | "dnd" | "haptics" | "frameColor" | "showFrame" | "iconOverrides"> & { lookV2?: boolean };

function normalizeApps(raw: Partial<AppsSlice> & { order?: string[] }): AppsSlice {
  // 功能注释：允许平台表 appId（不限于本地 APP_IDS）；小组件仍校验 WIDGET_IDS
  const installed = Array.from(
    new Set([...(Array.isArray(raw.installed) ? raw.installed : defaultInstalled()), "appstore", "settings"]),
  ).filter((id) => typeof id === "string" && id.trim() && !WIDGET_IDS.has(id));
  const widgets = Array.from(new Set([...(Array.isArray(raw.widgets) ? raw.widgets : []).filter((id) => WIDGET_IDS.has(id)), "w-hero-clock"])).filter((id) => id !== "w-today");
  const legacy = Array.isArray(raw.order) ? [...widgets, ...raw.order] : [];
  const baseLayout = (Array.isArray(raw.layout) && raw.layout.length ? raw.layout : (legacy.length ? legacy : DEFAULT_LAYOUT)).filter((id) => id !== "w-today");
  const present = new Set([...installed, ...widgets]);
  const layout = Array.from(new Set([...baseLayout.filter((id) => present.has(id)), ...installed, ...widgets]));
  return {
    installed,
    widgets,
    layout,
    widgetSizes: (raw.widgetSizes && typeof raw.widgetSizes === "object") ? raw.widgetSizes : {},
    widgetShapes: (raw.widgetShapes && typeof raw.widgetShapes === "object") ? raw.widgetShapes : {},
  };
}

function loadLook(): LookSlice {
  const parsed = loadGlobal<any>(PREFS_KEY, null);
  const base: LookSlice = {
    wallpaper: DEFAULT_PREFS.wallpaper,
    brightness: DEFAULT_PREFS.brightness,
    dark: DEFAULT_PREFS.dark,
    dnd: false,
    haptics: false,
    frameColor: DEFAULT_PREFS.frameColor,
    showFrame: DEFAULT_PREFS.showFrame,
    iconOverrides: {},
  };
  if (!parsed) return base;
  const look: LookSlice = {
    ...base,
    wallpaper: parsed.wallpaper ?? base.wallpaper,
    customWallpaper: parsed.customWallpaper,
    wallpaperUserSet: !!parsed.wallpaperUserSet || (parsed.wallpaper === "custom" && !!parsed.customWallpaper),
    brightness: parsed.brightness ?? base.brightness,
    dark: parsed.dark ?? base.dark,
    frameColor: parsed.frameColor ?? base.frameColor,
    showFrame: parsed.showFrame ?? base.showFrame,
    iconOverrides: (parsed.iconOverrides && typeof parsed.iconOverrides === "object") ? parsed.iconOverrides : {},
    lookV2: parsed.lookV2,
  };
  if (!parsed.lookV2) { look.showFrame = true; look.dark = false; look.lookV2 = true; }
  return look;
}

/** 功能注释：已装列表按存档隔离；无存档键时从全局旧 prefs 迁一次，否则按模组预装播种。 */
function loadApps(): AppsSlice {
  const scoped = loadData<any>(APPS_KEY, null);
  if (scoped && Array.isArray(scoped.installed)) return normalizeApps(scoped);
  const global = loadGlobal<any>(PREFS_KEY, null);
  if (global && Array.isArray(global.installed)) {
    let installed = [...global.installed];
    if (!global.peekV1) installed.push("peek");
    if (!global.coupleV1) installed.push("couple");
    if (!global.mailV1) installed.push("mail");
    if (!global.readVideoV1) installed.push("read", "video");
    const apps = normalizeApps({ ...global, installed });
    saveData(APPS_KEY, apps);
    return apps;
  }
  return normalizeApps({ installed: defaultInstalled(), widgets: ["w-hero-clock"], layout: DEFAULT_LAYOUT });
}

function loadPrefs(): PhonePrefs {
  try {
    return { ...loadLook(), ...loadApps(), dnd: false, haptics: false };
  } catch {
    return { ...DEFAULT_PREFS, installed: defaultInstalled() };
  }
}

function persistPrefs(next: PhonePrefs) {
  const look: LookSlice = {
    wallpaper: next.wallpaper,
    customWallpaper: next.customWallpaper,
    wallpaperUserSet: next.wallpaperUserSet,
    brightness: next.brightness,
    dark: next.dark,
    dnd: next.dnd,
    haptics: next.haptics,
    frameColor: next.frameColor,
    showFrame: next.showFrame,
    iconOverrides: next.iconOverrides,
    lookV2: true,
  };
  saveGlobal(PREFS_KEY, look);
  saveData(APPS_KEY, {
    installed: next.installed,
    widgets: next.widgets,
    layout: next.layout,
    widgetSizes: next.widgetSizes,
    widgetShapes: next.widgetShapes,
  });
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
  peek: { top: "#0d0f12", bottom: "#f2f2f7", dark: true },
  forum: { top: "#fff1f2", bottom: "#fff1f2", dark: false },
  couple: { top: "#fdf2f6", bottom: "#fbf4f6", dark: false },
  mail: { top: "#f2f2f7", bottom: "#f2f2f7", dark: false },
  read: { top: "#f6f1e7", bottom: "#f6f1e7", dark: false },
  video: { top: "#ffffff", bottom: "#ffffff", dark: false },
};

const sizeOf = (sizes: Record<string, WidgetSize>, id: string): WidgetSize => sizes[id] ?? DEFAULT_WIDGET_SIZE[id] ?? "sm";
const shapeOf = (shapes: Record<string, WidgetShape>, id: string): WidgetShape => shapes[id] ?? "rounded";

/* 手机内固定 iOS 字体与配色，不随游戏主题（深色 / 纸张风）变化 */
const IOS_VARS = {
  "--ink": "#181818",
  "--ink-soft": "#8a8a8e",
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  colorScheme: "light",
  WebkitFontSmoothing: "antialiased",
} as React.CSSProperties;

export default function Phone() {
  const { game } = useGame();
  // 先判空再进入内部组件，保证内部 Hook 调用顺序恒定
  if (!game) return null;
  return <PhoneInner />;
}

function PhoneInner() {
  const { game, patchGame } = useGame();
  const [app, setApp] = useState<AppId | null>(null);
  const [platformFocus, setPlatformFocus] = useState<PlatformApp | null>(null);
  const [platformMissing, setPlatformMissing] = useState(false);
  const [locked, setLocked] = useState(true);
  const [prefs, setPrefs] = useState<PhonePrefs>(loadPrefs);
  // 功能注释：已装里除系统入口/小组件外都按平台表解析
  const installedPlatformIds = prefs.installed.filter(
    (id) => id !== "appstore" && id !== "settings" && !WIDGET_IDS.has(id) && !["pomodoro", "clock", "notes", "calculator", "weather", "forum", "xianyu", "peek", "couple"].includes(id),
  );
  const { published, byId } = usePlatformAppsCatalog(installedPlatformIds);
  platformNameLookup = (id) => byId.get(id)?.name;
  platformIconLookup = (id) => {
    const icon = byId.get(id)?.icon;
    return icon ? resolvePlatformAppIconUrl(icon) : undefined;
  };
  if (!game) return null;
  const ph = ensurePhone(game).phone!;
  const time = gameTimeLabel(game).split(" ").pop() ?? "08:00";
  const unreadTotal = ph.threads.reduce((a, t) => a + t.unread, 0);
  // 各应用真实未读角标：绿信=会话未读；信息=服务号短信未读；电话=上次打开电话后的未接来电
  const svcFeed = loadFeed<{ unread?: number }[]>("sms");
  const smsUnread = Array.isArray(svcFeed) ? svcFeed.reduce((a, t) => a + (Number(t?.unread) || 0), 0) : 0;
  const callSeen = Number(loadData<number>(CALL_SEEN_KEY, 0)) || 0;
  const missedCalls = (ph.calls ?? []).filter((c) => c.outcome === "missed" && c.ts > callSeen).length;
  // 情侣空间：TA 寄来的未读信件
  const [couple] = useCouple(game.id);
  const coupleUnread = couple ? couple.bindings.reduce((n, id) => n + (couple.spaces[id]?.letters.filter((l) => l.from === "char" && !l.read).length ?? 0), 0) : 0;
  const badges: Record<string, number> = { wechat: unreadTotal, sms: smsUnread, call: missedCalls, couple: coupleUnread, mail: mailUnread(game) };
  const openApp = (a: AppId) => {
    if (a === "call") saveData(CALL_SEEN_KEY, Date.now());
    const plat = byId.get(a);
    const legacy = plat ? platformAppLegacyUi(plat.content) : "";
    const label = plat?.name || appLabel(a);
    // 线上联动：刷了哪个 App 记入手机流水，并消耗线下时间
    patchGame((g) => logAppOpen(g, a, label));
    if (plat) {
      setPlatformFocus(plat);
      setPlatformMissing(false);
      // 功能注释：有 legacyUi 走现成专用页；否则按 type 打开通用内容页
      setApp((legacy || `platform:${plat.type || "browse"}`) as AppId);
      return;
    }
    // 已装但平台记录没了 → 应用不可用
    if (installedPlatformIds.includes(a) && !APP_IDS.has(a)) {
      setPlatformFocus(null);
      setPlatformMissing(true);
      setApp("platform:missing");
      return;
    }
    setPlatformFocus(null);
    setPlatformMissing(false);
    setApp(a);
  };
  const back = () => {
    setApp(null);
    setPlatformFocus(null);
    setPlatformMissing(false);
  };

  const storeCatalog: StoreItem[] = [
    ...published.map(platformToStoreItem),
    // 已装但记录缺失：仍占一行，打开时提示不可用
    ...installedPlatformIds
      .filter((id) => !byId.has(id))
      .map((id) => ({
        id,
        label: id,
        tagline: "应用不可用",
        desc: "应用不可用",
        kicker: "不可用",
        story: "",
        icon: APP_ICON[id] ?? null,
        cat: "应用",
        rating: 0,
        size: "应用不可用",
        cover: "",
        core: true,
        authorName: "应用不可用",
      })),
    ...UTILITY_CATALOG,
  ];
  const petMode = usePetMode();
  const studioOpen = useStudioOpen();
  // 其它应用请求跳转（如「设置 · 审核中心」→ 应用商店里的开发者工坊）
  useEffect(() => {
    const h = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (id) setApp(id as AppId); };
    window.addEventListener("phone:open-app", h);
    return () => window.removeEventListener("phone:open-app", h);
  }, []);
  // 功能注释：未主动换过桌面时用作品默认背景；玩家设置优先。不改场景背景与机身外壳。
  const wp = resolveEffectiveHomeWallpaper(worldPhoneHomeWallpaper(), prefs);
  // 应用打开时，顶/底系统条改用应用自身底色，避免露出主屏壁纸
  const chromeKey = app && platformAppLegacyUi(platformFocus?.content) ? platformAppLegacyUi(platformFocus?.content) : app;
  const chrome = chromeKey && APP_CHROME[chromeKey as keyof typeof APP_CHROME] ? APP_CHROME[chromeKey as keyof typeof APP_CHROME] : (app?.startsWith("platform:") ? { top: "#ffffff", bottom: "#ffffff", dark: false } : null);
  const sync = useSyncState(app);
  useProactiveMessages(); // 好友主动来消息：整部手机在线即生效，不必停在绿信里
  const [syncTip, setSyncTip] = useState("");
  // 真实手机式通知：未读会话逐条预览（锁屏）+ 新消息顶部横幅
  const previews = ph.threads.filter((t) => t.unread > 0).sort((a, b) => b.lastTs - a.lastTs).slice(0, 4)
    .map((t) => ({ id: t.id, title: t.title, n: t.unread, text: [...t.msgs].reverse().find((m) => m.role !== "me")?.text ?? "", ts: t.lastTs }));
  const [banner, setBanner] = useState<(typeof previews)[number] | null>(null);
  const lastSeenTs = useRef(previews[0]?.ts ?? 0);
  const topPrev = previews[0];
  useEffect(() => {
    if (!topPrev || topPrev.ts <= lastSeenTs.current) return;
    lastSeenTs.current = topPrev.ts;
    if (app === "wechat" || prefs.dnd) return;
    setBanner(topPrev);
    if (prefs.haptics && "vibrate" in navigator) navigator.vibrate?.(20);
    const t = setTimeout(() => setBanner(null), 4500);
    return () => clearTimeout(t);
  }, [topPrev?.ts]); // eslint-disable-line react-hooks/exhaustive-deps
  const doSync = async () => {
    if (!app || sync.busy) return;
    const tip = await runSync(app);
    if (tip) { setSyncTip(tip); setTimeout(() => setSyncTip(""), 2000); }
  };
  const frame = frameById(prefs.frameColor);
  const updatePrefs = (p: Partial<PhonePrefs>) => setPrefs((cur) => {
    const next = { ...cur, ...p };
    persistPrefs(next);
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
  const iconApps: IconApp[] = prefs.installed.map((id) => {
    const plat = byId.get(id);
    const iconUrl = plat?.icon ? resolvePlatformAppIconUrl(plat.icon) : "";
    return {
      id,
      label: plat?.name || appLabel(id),
      node: iconUrl ? <img src={iconUrl} alt="" className="h-full w-full object-cover" /> : (APP_ICON[id] ?? null),
    };
  });
  const setIcon = (id: string, url: string | null) => {
    const next = { ...prefs.iconOverrides };
    if (url) next[id] = url; else delete next[id];
    updatePrefs({ iconOverrides: next });
  };
  // 是否显示仿真机身边框：默认关闭（整屏沉浸），玩家可在「设置 · 显示与亮度」里打开
  // 窄屏（真机）本身就是手机：整屏使用；宽屏才显示仿真机身
  const wide = useWide();
  const framed = wide && prefs.showFrame;
  const screenRadius = framed ? "rounded-[2.95rem]" : "rounded-none";
  const screen = (
        <div
          className={`phone-os relative isolate flex flex-col overflow-hidden ring-1 ring-white/5 ${framed ? "h-full w-full rounded-[2.95rem]" : "h-full"}`}
          style={{ background: chrome ? chrome.bottom : wp.css }}
        >
          <div
            className={`relative flex shrink-0 items-center justify-between px-8 pt-3.5 pb-1 text-[14.5px] font-semibold tracking-[-0.01em] ${chrome && !chrome.dark ? "text-black/80" : "text-white"}`}
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
              {sync.available && (
                <button onClick={doSync} disabled={sync.busy} aria-label="联动世界剧情刷新" title="联动世界剧情刷新"
                  className={`-my-1 mr-0.5 grid h-6 w-6 place-items-center rounded-full ${chrome && !chrome.dark ? "bg-black/[0.07] active:bg-black/15" : "bg-white/15 active:bg-white/30"}`}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={sync.busy ? "animate-spin" : ""}>
                    <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
                  </svg>
                </button>
              )}
              <SignalBars />
              <WifiGlyph />
              <BatteryGlyph />
            </div>
          </div>

          <div id="phone-app-root" className="relative min-h-0 flex-1 overflow-hidden">
            {app === null && (
              <HomeGrid
                layout={prefs.layout} installed={prefs.installed.filter(phoneAppAllowed)} widgets={prefs.widgets} widgetSizes={prefs.widgetSizes} widgetShapes={prefs.widgetShapes}
                iconOverrides={prefs.iconOverrides} onOpen={openApp} badges={badges}
                onReorder={(layout) => updatePrefs({ layout })}
                onRemove={removeItem}
                onResize={(id) => updatePrefs({ widgetSizes: { ...prefs.widgetSizes, [id]: nextSize(sizeOf(prefs.widgetSizes, id)) } })}
                onReshape={(id) => updatePrefs({ widgetShapes: { ...prefs.widgetShapes, [id]: nextShape(shapeOf(prefs.widgetShapes, id)) } })}
                onSetIcon={setIcon}
              />
            )}
            {app !== null && (
              <div key={app} className="phone-app-in h-full min-h-0 overflow-hidden">
                {app === "wechat" && <WeChatApp onBack={back} />}
                {app === "sms" && <SmsApp onBack={back} />}
                {app === "call" && <CallApp onBack={back} />}
                {app === "weibo" && <WeiboApp onBack={back} />}
                {app === "xhs" && <XhsApp onBack={back} />}
                {app === "ticket" && <TicketApp onBack={back} />}
                {app === "settings" && <SettingsApp onBack={back} prefs={prefs} onChange={updatePrefs} />}
                {app === "appstore" && (
                  <AppStoreApp
                    onBack={back}
                    catalog={storeCatalog.filter((c) => c.kind === "widget" || phoneAppAllowed(c.id) || c.core)}
                    installed={installedSet}
                    onInstall={install}
                    onOpen={(id) => (WIDGET_IDS.has(id) ? setApp(null) : openApp(id as AppId))}
                    iconApps={iconApps}
                    iconOverrides={prefs.iconOverrides}
                    onSetIcon={setIcon}
                  />
                )}
                {app === "pomodoro" && <PomodoroApp onBack={back} />}
                {app === "clock" && <ClockApp onBack={back} />}
                {app === "calculator" && <CalculatorApp onBack={back} />}
                {app === "notes" && <NotesApp onBack={back} />}
                {app === "weather" && <WeatherApp onBack={back} />}
                {app === "cloudmusic" && <MusicApp onBack={back} />}
                {app === "bosspin" && <BossZhipinApp onBack={back} />}
                {app === "xianyu" && <XianyuApp onBack={back} />}
                {app === "forum" && <ForumApp onBack={back} />}
                {app === "peek" && <PeekApp onBack={back} />}
                {app === "couple" && <CoupleApp onBack={back} />}
                {app === "mail" && <MailApp onBack={back} />}
                {app === "read" && <ReadApp onBack={back} />}
                {app === "video" && <VideoApp onBack={back} />}
                {(app.startsWith("platform:") || platformMissing) && (
                  <PlatformTypeApp app={platformFocus} unavailable={platformMissing || !platformFocus} onBack={back} />
                )}
              </div>
            )}
          </div>

          {/* 常驻桌宠：主屏与各应用里都在；工坊打开或锁屏时暂时隐藏 */}
          {petMode === "pinned" && !studioOpen && !locked && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-10 z-[45]"><SlimePet onOpen={() => requestStudio()} /></div>
          )}

          <HomeIndicator active={app !== null} light={!!chrome && !chrome.dark} onHome={back} />

          {syncTip && <div className="pointer-events-none absolute inset-x-0 top-12 z-40 flex justify-center"><span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{syncTip}</span></div>}

          <GlobalPhoneAlerts dnd={prefs.dnd} />

          {/* 线下剧情触发的来电：锁屏 / 任意应用里都会弹出 */}
          <IncomingCall />

          {banner && !locked && (
            <button onClick={() => { setBanner(null); openApp("wechat" as AppId); }}
              className="absolute inset-x-2.5 top-11 z-[60] flex items-center gap-2.5 rounded-[22px] bg-white/75 px-3.5 py-3 text-left text-black shadow-[0_10px_34px_-6px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/50 backdrop-blur-2xl backdrop-saturate-150 animate-[phoneBanner_.35s_cubic-bezier(.22,1,.36,1)]">
              <span className="ios-icon block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[8px]">{APP_ICON.wechat}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><b className="truncate text-[13px]">{banner.title}</b><span className="shrink-0 text-[11px] text-black/45">现在</span></span>
                <span className="block truncate text-[12.5px] text-black/75">{banner.n > 1 ? `[${banner.n}条] ` : ""}{banner.text || "发来一条消息"}</span>
              </span>
            </button>
          )}
          {locked && <LockScreen previews={previews} onOpenChat={() => { setLocked(false); openApp("wechat" as AppId); }} dnd={prefs.dnd} notices={[["wechat", "绿信", unreadTotal, "条新消息"], ["sms", "信息", smsUnread, "条未读短信"], ["call", "电话", missedCalls, "个未接来电"]]} wallpaper={wp.css} radius={screenRadius} onUnlock={() => setLocked(false)} />}

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
    /* 功能注释：宽屏机身舞台用 container-size，外框按 85%×竖屏比例锁死，通讯录/聊天只在内屏滚动 */
    <div
      className={framed ? "phone-stage flex h-full w-full items-center justify-center overflow-hidden px-2 py-2" : "flex h-full w-full flex-col"}
      style={IOS_VARS}
      data-phone-stage={framed ? "1" : undefined}
    >
      {framed ? (
        <div
          className="phone-frame phone-frame-fixed relative shrink-0 overflow-hidden rounded-[3.2rem] p-[5px]"
          style={{ background: frame.frame }}
          data-phone-frame="1"
        >
          <span className="phone-btn absolute -left-[3px] top-[15%] h-8 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -left-[3px] top-[23%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -left-[3px] top-[33%] h-14 w-[3px] rounded-l" style={{ background: frame.btn }} />
          <span className="phone-btn absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r" style={{ background: frame.btn }} />
          <div className="h-full min-h-0 overflow-hidden rounded-[2.95rem]">{screen}</div>
        </div>
      ) : (
        screen
      )}
    </div>
  );
}

export function useWide() {
  const q = "(min-width: 640px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
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
// 每项占用的格数（4 列 × 行），须与 WidgetTile 实际的 col/row-span 一致
const cellWeight = (id: string, size: WidgetSize) =>
  id === "w-hero-clock" ? (size === "sm" ? 4 : 8)
  : isWidget(id) ? (size === "lg" ? 16 : size === "md" ? 8 : 4) : 1;

const DOCK_APPS = ["call", "sms", "wechat", "settings"];
const CALL_SEEN_KEY = "star2005.phone.callSeen";

/* 底部 Home 指示条：上滑（或点按）回到主屏，跟手上移 */
function HomeIndicator({ active, light, onHome }: { active: boolean; light: boolean; onHome: () => void }) {
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const end = () => { if (start.current != null && dy < -24) onHome(); start.current = null; setDy(0); };
  return (
    <div
      role="button" aria-label="上滑回到主屏" aria-disabled={!active}
      onPointerDown={(e) => { if (!active) return; start.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => { if (start.current != null) setDy(Math.max(-60, Math.min(0, e.clientY - start.current))); }}
      onPointerUp={() => { if (start.current != null && dy > -4) onHome(); end(); }}
      onPointerCancel={end}
      className={`relative z-30 flex h-6 shrink-0 touch-none items-center justify-center ${active ? "cursor-grab" : ""}`}
    >
      <span
        className={`block h-[5px] w-32 rounded-full transition-opacity ${light ? "bg-black/70" : "bg-white/80"} ${active ? "" : "opacity-40"}`}
        style={{ transform: `translateY(${dy / 3}px) scaleX(${1 - dy / 400})`, transition: start.current == null ? "transform .25s" : "none" }}
      />
    </div>
  );
}

function HomeGrid({ layout, installed, widgets, widgetSizes, widgetShapes, iconOverrides, onOpen, badges, onReorder, onRemove, onResize, onReshape, onSetIcon }: {
  layout: string[]; installed: string[]; widgets: string[]; widgetSizes: Record<string, WidgetSize>; widgetShapes: Record<string, WidgetShape>;
  iconOverrides: Record<string, string>; onOpen: (a: AppId) => void; badges: Record<string, number>;
  onReorder: (layout: string[]) => void; onRemove: (id: string) => void; onResize: (id: string) => void;
  onReshape: (id: string) => void; onSetIcon: (id: string, url: string | null) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [iconEditing, setIconEditing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const present = new Set([...installed, ...widgets]);
  // 底部 Dock：固定四个常用应用（已安装才显示），不再出现在主屏网格里
  const dock = DOCK_APPS.filter((id) => installed.includes(id));
  const external = layout.filter((id) => present.has(id) && !dock.includes(id));
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

  // 按格权重分页：每页容量按屏幕实际可容纳的行数计算（行高 84 + 行距 16），排满才翻页
  const scroller = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(6);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setRows(Math.max(3, Math.floor((el.clientHeight - 24 + 16) / (84 + 16))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PAGE_CAP = rows * 4;
  const pages: string[][] = [[]];
  let used = 0;
  for (const id of order.filter((x) => isWidget(x) || APP_IDS.has(x))) {
    const w = cellWeight(id, sizeOf(widgetSizes, id));
    if (used + w > PAGE_CAP && pages[pages.length - 1].length) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(id); used += w;
  }
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

  const AppTile = ({ id, i, inDock }: { id: string; i: number; inDock?: boolean }) => {
    const label = appLabel(id);
    const customIcon = iconOverrides?.[id] || platformIconLookup(id);
    return (
      <button
        {...dragProps(id)} {...holdProps}
        onClick={(e) => { if (edit) { e.stopPropagation(); if (!moved.current) setIconEditing(id); return; } if (!moved.current) onOpen(id as AppId); }}
        className={`phone-icon-in group relative flex flex-col items-center gap-1.5 bg-transparent ${edit ? "phone-jiggle" : ""}`}
        style={{ animationDelay: edit ? undefined : `${Math.min(i, 12) * 12}ms` }}
      >
        <span className="relative block">
        <span className="ios-icon relative block h-[56px] w-[56px] overflow-hidden rounded-[15px] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10 transition-transform duration-150 group-active:scale-90 group-active:brightness-90">
          {customIcon
            ? <img src={customIcon} alt={label} className="h-full w-full scale-[1.14] object-cover" />
            : (APP_ICON[id] ?? <span className="flex h-full w-full items-center justify-center bg-[#232323] text-white font-medium">{label[0]}</span>)}
        </span>
        {edit && canRemove(id) && <RemoveBtn id={id} />}
        {!edit && (badges[id] ?? 0) > 0 && (
          <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[#ff3b30] px-[5px] text-[12px] font-medium tabular-nums leading-none text-white">{badges[id] > 99 ? "99+" : badges[id]}</span>
        )}
        </span>
        {!inDock && <span className="max-w-[70px] truncate text-center text-[11px] font-medium tracking-tight text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">{label}</span>}
      </button>
    );
  };

  const WidgetTile = ({ id }: { id: string }) => {
    const size = sizeOf(widgetSizes, id);
    const shape = shapeOf(widgetShapes, id);
    // 大字号时钟横幅是纯文字横幅：整行，高度贴合内容（最多 2 行），不留大空框
    const span = id === "w-hero-clock"
      ? (size === "sm" ? "col-span-4 row-span-1" : "col-span-4 row-span-2")
      : size === "lg" ? "col-span-4 row-span-4" : size === "md" ? "col-span-4 row-span-2" : "col-span-2 row-span-2";
    const sizeLabel = size === "sm" ? "小" : size === "md" ? "中" : "大";
    return (
      <div {...dragProps(id)} {...holdProps}
        onClick={(e) => { if (edit) { e.stopPropagation(); return; } const to = WIDGET_TARGET[id]; if (id === "w-wallet") requestWallet(); if (to) onOpen(to); }}
        className={`relative h-full w-full justify-self-stretch ${span} ${edit ? "phone-jiggle" : WIDGET_TARGET[id] ? "cursor-pointer transition active:scale-[0.97]" : ""}`}>
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
    <div className="relative flex h-full flex-col" onClick={() => edit && setEdit(false)}>
      {/* 柔光遮罩：顶部与底部轻微压暗，保证任意壁纸下文字与 Dock 清晰 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/15 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/15 to-transparent" />
      {edit && (
        <div className="px-6 pb-2 pt-6 text-center text-white drop-shadow">
          <p className="text-[12px] font-medium text-white/85">拖动排序 · 点应用改图标 · 组件调大小 / 形状 · 点角标删除 · 左右翻页 · 空白处完成</p>
        </div>
      )}

      {/* 横向翻页容器 */}
      <div ref={scroller} onScroll={onScroll}
        className="phone-pages relative flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden">
        {pages.map((ids, pi) => (
          <div key={pi} className="phone-pages h-full w-full shrink-0 snap-center overflow-y-auto px-[22px] pt-4">
            <div className="grid grid-cols-4 justify-items-center gap-x-3 gap-y-[18px] pb-4 [grid-auto-flow:row_dense] [grid-auto-rows:82px]">
              {ids.map((id, i) => isWidget(id) ? <WidgetTile key={id} id={id} /> : <AppTile key={id} id={id} i={i} />)}
            </div>
          </div>
        ))}
      </div>

      {/* 页码：iOS 式「搜索」胶囊，多页时改为毛玻璃圆点条 */}
      <div className="relative flex justify-center pb-2.5 pt-1">
        {pages.length > 1 ? (
          <div className="flex items-center gap-[7px] rounded-full bg-white/18 px-2.5 py-[7px] backdrop-blur-xl">
            {pages.map((_, pi) => (
              <span key={pi} className={`h-[6px] w-[6px] rounded-full transition ${pi === page ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-3.5 py-[5px] text-[12px] font-medium text-white backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/10">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            搜索
          </span>
        )}
      </div>

      {/* Dock：毛玻璃托盘 + 四个常用应用，无文字标签 */}
      {dock.length > 0 && (
        <div className="relative mx-[10px] mb-1.5 flex items-center justify-around rounded-[34px] bg-white/[0.18] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/15 backdrop-blur-[30px] backdrop-saturate-[1.8]">
          {dock.map((id, i) => <AppTile key={id} id={id} i={i} inDock />)}
        </div>
      )}

      {/* 图标个性化：编辑模式下点应用图标弹出 */}
      {iconEditing && (
        <div className="absolute inset-0 z-[70] flex items-end bg-black/50" onClick={(e) => { e.stopPropagation(); setIconEditing(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-[#1c1c1e] p-5 pb-7 text-white">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
            <div className="flex items-center gap-3">
              <span className="ios-icon relative block h-[52px] w-[52px] overflow-hidden">
                {iconOverrides?.[iconEditing] || platformIconLookup(iconEditing)
                  ? <img src={(iconOverrides?.[iconEditing] || platformIconLookup(iconEditing)) || undefined} alt="" className="h-full w-full scale-[1.14] object-cover" />
                  : (APP_ICON[iconEditing] ?? <span className="flex h-full w-full items-center justify-center bg-zinc-600">{appLabel(iconEditing)[0]}</span>)}
              </span>
              <div>
                <p className="text-[15px] font-semibold">{appLabel(iconEditing)}</p>
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

/* 锁屏：大字号时钟 + 日期，上滑 / 轻触解锁（与状态栏同为游戏内时间） */
function LockScreen({ previews = [], onOpenChat, dnd = false, notices, wallpaper, radius = "rounded-[2.4rem]", onUnlock }: { previews?: { id: string; title: string; n: number; text: string }[]; onOpenChat?: () => void; dnd?: boolean; notices: [id: string, label: string, n: number, unit: string][]; wallpaper: string; radius?: string; onUnlock: () => void }) {
  const now = useGameNow();
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
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 ${radius}`} />

      <div className="relative z-10 mt-[14%] flex w-full flex-1 flex-col items-center">
        {/* 小锁 */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mb-2 opacity-90 drop-shadow">
          <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" fill="currentColor" />
          <path d="M7.6 10.5V8a4.4 4.4 0 0 1 8.8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <p className="text-[16px] font-semibold tracking-[0.04em] text-white/90 drop-shadow">{dateLine}</p>
        <p className="mt-0.5 text-[92px] font-semibold leading-[0.95] tabular-nums tracking-[-0.04em] text-white/95 drop-shadow-[0_2px_16px_rgba(0,0,0,0.3)]">{hh}:{mm}</p>

        <div className="mt-auto mb-4 flex w-[calc(100%-24px)] max-w-[340px] flex-col gap-2">
          {dnd && notices.some(([id, , n]) => n > 0 && phoneAppAllowed(id)) && (
            <div className="flex items-center justify-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-[12px] text-white/85 backdrop-blur-xl">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
              勿扰模式中 · 通知已静默
            </div>
          )}
          {!dnd && phoneAppAllowed("wechat") && previews.map((p) => (
            <button key={p.id} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onOpenChat?.(); }}
              className="flex items-center gap-2.5 rounded-[20px] bg-white/25 px-3.5 py-3 text-left shadow-[0_6px_20px_-10px_rgba(0,0,0,0.4)] backdrop-blur-2xl backdrop-saturate-150 active:bg-white/35">
              <span className="ios-icon block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[8px]">{APP_ICON.wechat}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight">{p.title}</span>
                <span className="block truncate text-[12px] text-white/85">{p.n > 1 ? `[${p.n}条] ` : ""}{p.text || "发来一条消息"}</span>
              </span>
              <span className="self-start text-[11px] text-white/60">现在</span>
            </button>
          ))}
          {!dnd && notices.filter(([id, , n]) => n > 0 && phoneAppAllowed(id) && !(id === "wechat" && previews.length)).map(([id, label, n, unit]) => (
            <div key={id} className="flex items-center gap-2.5 rounded-[20px] bg-white/25 px-3.5 py-3 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.4)] backdrop-blur-2xl backdrop-saturate-150">
              <span className="ios-icon block h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[8px]">{APP_ICON[id]}</span>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[13px] font-semibold leading-tight">{label}</p>
                <p className="truncate text-[12px] text-white/85">你有 {n} {unit}</p>
              </div>
              <span className="self-start text-[11px] text-white/60">现在</span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部上滑提示 */}
      <div className="relative z-10 flex w-full items-end justify-between px-9 pb-3">
        <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-black/30 backdrop-blur-xl" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M8 2h8v4l-2 4v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V10L8 6Z" /><path d="M12 13v2" strokeLinecap="round" /></svg>
        </span>
        <div className="flex flex-col items-center pb-1">
          <p className="text-[12px] font-medium text-white/75 drop-shadow" style={{ opacity: Math.max(0, 1 - lift / 60) }}>上滑解锁</p>
          <div className="mt-2.5 h-[5px] w-[134px] rounded-full bg-white/85" />
        </div>
        <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-black/30 backdrop-blur-xl" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </span>
      </div>
    </div>
  );
}

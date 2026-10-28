/* 图标 DIY 的内置图标库：线性风格，随 currentColor / 线宽变量走。可替换任意图标位。 */
import type { SVGProps } from "react";
import { IconBook, IconCamera, IconClock, IconFlag, IconHeart, IconMoon, IconPin, IconSave, IconScroll, IconSend, IconSettings, IconSparkle, IconSun, IconUser, IconUsers, IconWallet } from "./icons";

type P = SVGProps<SVGSVGElement>;
const b = (p: P) => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p });

const Menu = (p: P) => <svg {...b(p)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const Dots = (p: P) => <svg {...b(p)}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></svg>;
const Arrow = (p: P) => <svg {...b(p)}><path d="M5 12h12M13 6l6 6-6 6" /></svg>;
const Play = (p: P) => <svg {...b(p)}><path d="M8 5.5v13l10-6.5z" /></svg>;
const Globe = (p: P) => <svg {...b(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>;
const Compass = (p: P) => <svg {...b(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>;
const Pen = (p: P) => <svg {...b(p)}><path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L3 12.5V21h8.5z" /><path d="M16 8 2 22M17.5 15H9" /></svg>;
const Pencil = (p: P) => <svg {...b(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>;
const Chat = (p: P) => <svg {...b(p)}><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12z" /></svg>;
const Plane = (p: P) => <svg {...b(p)}><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>;
const Star = (p: P) => <svg {...b(p)}><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6-4.5-4.2 6.1-.8z" /></svg>;
const Crown = (p: P) => <svg {...b(p)}><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>;
const Diamond = (p: P) => <svg {...b(p)}><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4l3 16 3-16" /></svg>;
const Music = (p: P) => <svg {...b(p)}><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>;
const Gift = (p: P) => <svg {...b(p)}><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z" /></svg>;
const Bell = (p: P) => <svg {...b(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>;
const Flower = (p: P) => <svg {...b(p)}><circle cx="12" cy="12" r="2.2" /><path d="M12 9.8C10 6 10.5 3 12 3s2 3 0 6.8M14.2 12c3.8-2 6.8-1.5 6.8 0s-3 2-6.8 0M12 14.2c2 3.8 1.5 6.8 0 6.8s-2-3 0-6.8M9.8 12C6 14 3 13.5 3 12s3-2 6.8 0" /></svg>;
const Clover = (p: P) => <svg {...b(p)}><path d="M12 12c-4-1-5-4-3.5-5.5S12 6 12 10c0-4 2-5 3.5-3.5S16 11 12 12zm0 0c4 1 5 4 3.5 5.5S12 18 12 14c0 4-2 5-3.5 3.5S8 13 12 12z" /><path d="M12 12l5 9" /></svg>;
const Ribbon = (p: P) => <svg {...b(p)}><path d="M12 10C9 6 4 5 4 8.5S9 12 12 10zm0 0c3-4 8-5 8-1.5S15 12 12 10zm0 0-3 10 3-2 3 2z" /></svg>;
const Butterfly = (p: P) => <svg {...b(p)}><path d="M12 8v10M12 11C9 5 3 4 3 8s4 5 9 3zm0 0c3-6 9-7 9-3s-4 5-9 3zm0 1c-3 2-6 4-5 6.5S11 18 12 14zm0 0c3 2 6 4 5 6.5S13 18 12 14z" /></svg>;
const Cat = (p: P) => <svg {...b(p)}><path d="M5 9V4l4 3h6l4-3v5a7 7 0 0 1-14 0z" /><path d="M9.5 11.5h.01M14.5 11.5h.01M11 14h2" /></svg>;
const Coffee = (p: P) => <svg {...b(p)}><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2" /></svg>;
const Home = (p: P) => <svg {...b(p)}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></svg>;
const Lock = (p: P) => <svg {...b(p)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const Mic = (p: P) => <svg {...b(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;

export const GLYPHS: Record<string, { label: string; C: (p: P) => React.ReactElement }> = {
  menu: { label: "菜单", C: Menu }, dots: { label: "更多", C: Dots }, arrow: { label: "箭头", C: Arrow }, play: { label: "播放", C: Play },
  flag: { label: "旗帜", C: IconFlag }, bell: { label: "铃铛", C: Bell }, globe: { label: "地球", C: Globe }, compass: { label: "罗盘", C: Compass },
  pin: { label: "定位", C: IconPin }, home: { label: "小屋", C: Home }, pen: { label: "羽毛笔", C: Pen }, pencil: { label: "铅笔", C: Pencil },
  chat: { label: "对话", C: Chat }, send: { label: "纸飞机", C: Plane }, send2: { label: "发送", C: IconSend }, mic: { label: "话筒", C: Mic },
  star: { label: "星星", C: Star }, sparkle: { label: "闪光", C: IconSparkle }, heart: { label: "爱心", C: IconHeart }, crown: { label: "皇冠", C: Crown },
  diamond: { label: "钻石", C: Diamond }, ribbon: { label: "蝴蝶结", C: Ribbon }, butterfly: { label: "蝴蝶", C: Butterfly }, flower: { label: "小花", C: Flower },
  clover: { label: "四叶草", C: Clover }, cat: { label: "猫咪", C: Cat }, coffee: { label: "咖啡", C: Coffee }, music: { label: "音符", C: Music },
  gift: { label: "礼物", C: Gift }, camera: { label: "相机", C: IconCamera }, book: { label: "书本", C: IconBook }, scroll: { label: "卷轴", C: IconScroll },
  save: { label: "存档", C: IconSave }, wallet: { label: "钱包", C: IconWallet }, clock: { label: "时钟", C: IconClock }, user: { label: "个人", C: IconUser },
  users: { label: "人群", C: IconUsers }, settings: { label: "齿轮", C: IconSettings }, moon: { label: "月亮", C: IconMoon }, sun: { label: "太阳", C: IconSun },
  lock: { label: "锁", C: Lock },
};

/* 可 DIY 的图标位：id → 名称 / 分组 */
export const ICON_SLOTS: { id: string; label: string; group: "main" | "menu" }[] = [
  { id: "top.flag", label: "待办标记（右上）", group: "main" },
  { id: "top.menu", label: "菜单按钮（右上）", group: "main" },
  { id: "scene.loc", label: "地点卡图标", group: "main" },
  { id: "adv.arrow", label: "「日程」按钮", group: "main" },
  { id: "input.pen", label: "输入框 · 灵感笔", group: "main" },
  { id: "input.send", label: "输入框 · 发送", group: "main" },
  ...["存档管理", "结束游戏", "我的作品", "CG 图鉴", "剧情志", "财务 · 支票账单", "暗色模式", "编辑器", "AI 配置", "游戏设置"].map((l) => ({ id: `menu:${l}`, label: l, group: "menu" as const })),
];

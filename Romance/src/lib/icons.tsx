/**
 * 功能注释：Romance 统一线性图标入口。
 * 全站优先 Lucide React；默认线宽 1.75、常规 16px，颜色继承 currentColor。
 * 禁止在 UI 再塞 Emoji / 颜文字 / 装饰性字符当图标。
 */
import type { ComponentType, CSSProperties, ReactNode, SVGProps } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Badge,
  Ban,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Cake,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CloudRain,
  Clock,
  Coffee,
  Crosshair,
  Dice5,
  Droplets,
  ExternalLink,
  Eye,
  Flag,
  Flame,
  FlaskConical,
  Flower2,
  Frown,
  Gem,
  Gift,
  Globe,
  Heart,
  HeartHandshake,
  HelpCircle,
  Home,
  IdCard,
  Image,
  Info,
  LayoutGrid,
  Leaf,
  Lock,
  Mail,
  MapPin,
  Maximize2,
  Meh,
  Menu,
  MessageCircle,
  Mic,
  Minimize2,
  Monitor,
  Moon,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Smile,
  Sparkles,
  Square,
  Star,
  Sun,
  User,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { EmotionId } from "../game/phone";
import { EMOTIONS } from "../game/phone";
import type { SkinIconKey } from "./skins";

export type IconSize = "sm" | "md" | "lg" | "nav" | number;

const SIZE_PX: Record<"sm" | "md" | "lg" | "nav", number> = {
  sm: 16,
  md: 18,
  lg: 20,
  nav: 22,
};

export type RomanceIconProps = Omit<LucideProps, "size" | "strokeWidth"> & {
  /** 常规 16 / 按钮 18 / 导航 20–22；或直接传像素 */
  size?: IconSize;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

/** 功能注释：把 Lucide 图标套上 Romance 默认线宽与尺寸，颜色走 currentColor。 */
export function lucideIcon(Icon: LucideIcon, defaults?: { size?: IconSize }) {
  const Wrapped = ({ size = defaults?.size ?? "sm", strokeWidth = 1.75, ...rest }: RomanceIconProps) => {
    const px = typeof size === "number" ? size : SIZE_PX[size];
    return <Icon size={px} strokeWidth={strokeWidth} absoluteStrokeWidth={false} aria-hidden {...rest} />;
  };
  Wrapped.displayName = `Romance(${Icon.displayName || Icon.name || "Icon"})`;
  return Wrapped;
}

/** 兼容旧 `SVGProps` 调用：把 width/height 映射到 Lucide size */
type LegacyP = SVGProps<SVGSVGElement> & { size?: IconSize };
function adapt(Icon: LucideIcon) {
  const Comp = lucideIcon(Icon);
  return (p: LegacyP) => {
    const { width, height, size, strokeWidth, className, style, ...rest } = p;
    const n =
      size ??
      (typeof width === "number" ? width : typeof height === "number" ? height : undefined) ??
      "sm";
    return (
      <Comp
        {...(rest as LucideProps)}
        size={n as IconSize}
        strokeWidth={typeof strokeWidth === "number" ? strokeWidth : 1.75}
        className={className}
        style={style}
      />
    );
  };
}

export const IconBook = adapt(BookOpen);
export const IconUser = adapt(User);
export const IconUsers = adapt(Users);
export const IconSpark = adapt(Sparkles);
export const IconSparkle = adapt(Sparkles);
export const IconClock = adapt(Clock);
export const IconPin = adapt(MapPin);
export const IconHeart = adapt(Heart);
export const IconWallet = adapt(Wallet);
export const IconSettings = adapt(Settings);
export const IconSave = adapt(Save);
export const IconMoon = adapt(Moon);
export const IconSun = adapt(Sun);
export const IconSend = adapt(Send);
export const IconFlask = adapt(FlaskConical);
export const IconScroll = adapt(ScrollText);
export const IconClose = adapt(X);
export const IconMaximize = adapt(Maximize2);
export const IconMinimize = adapt(Minimize2);
export const IconCamera = adapt(Camera);
export const IconDice = adapt(Dice5);
/**
 * 功能注释：建角重掷用的双骰子（前正后斜）；线色走 currentColor，正面底用白以免叠糊。
 * 与 Lucide Dice5 区分，专给人设字段 / 属性整组重掷。
 */
export function IconDiceDuo({
  size = 16,
  width,
  height,
  className,
  style,
}: {
  size?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  const px = typeof size === "number" ? size : 16;
  const w = width ?? px;
  const h = height ?? px;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={w}
      height={h}
      fill="none"
      className={className}
      style={style}
      aria-hidden
    >
      <g transform="translate(34 14) rotate(28)">
        <rect x="-14" y="-14" width="28" height="28" rx="6" ry="6" stroke="currentColor" strokeWidth="3.2" />
        <circle cx="-6" cy="-6" r="2.4" fill="currentColor" />
        <circle cx="6" cy="-6" r="2.4" fill="currentColor" />
        <circle cx="-6" cy="6" r="2.4" fill="currentColor" />
        <circle cx="6" cy="6" r="2.4" fill="currentColor" />
      </g>
      <g transform="translate(24 36)">
        <rect x="-16" y="-16" width="32" height="32" rx="7" ry="7" stroke="currentColor" strokeWidth="3.2" fill="#fff" />
        <circle cx="-7" cy="-7" r="2.6" fill="currentColor" />
        <circle cx="7" cy="-7" r="2.6" fill="currentColor" />
        <circle cx="-7" cy="7" r="2.6" fill="currentColor" />
        <circle cx="7" cy="7" r="2.6" fill="currentColor" />
      </g>
    </svg>
  );
}
export const IconFlag = adapt(Flag);
export const IconPlay = adapt(Play);
export const IconRefresh = adapt(RefreshCw);
export const IconArrowUp = adapt(ArrowUp);
export const IconStop = adapt(Square);
export const IconPlus = adapt(Plus);
export const IconChevronDown = adapt(ChevronDown);
export const IconChevronRight = adapt(ChevronRight);
export const IconChevronUp = adapt(ChevronUp);
export const IconUndo = adapt(RotateCcw);
export const IconRedo = adapt(RotateCw);
export const IconCheck = adapt(Check);
export const IconShare = adapt(Share2);
export const IconLock = adapt(Lock);
export const IconAlert = adapt(AlertTriangle);
export const IconStar = adapt(Star);
export const IconMenu = adapt(Menu);
export const IconMusic = adapt(Music);
export const IconThought = adapt(Brain);
export const IconMessage = adapt(MessageCircle);
export const IconEye = adapt(Eye);
export const IconFlower = adapt(Flower2);
export const IconHome = adapt(Home);
export const IconGem = adapt(Gem);
export const IconImage = adapt(Image);
export const IconGrid = adapt(LayoutGrid);
export const IconCrosshair = adapt(Crosshair);
export const IconBan = adapt(Ban);
export const IconShop = adapt(ShoppingBag);
export const IconPencil = adapt(Pencil);
export const IconCake = adapt(Cake);
export const IconBadge = adapt(Badge);
export const IconIdCard = adapt(IdCard);
export const IconCalendar = adapt(CalendarDays);
export const IconUserRound = adapt(User);
export const IconPhone = adapt(Smartphone);
export const IconBriefcase = adapt(Briefcase);
export const IconMonitor = adapt(Monitor);
export const IconMic = adapt(Mic);
export const IconGlobe = adapt(Globe);
export const IconChart = adapt(BarChart3);
export const IconGift = adapt(Gift);
export const IconFlame = adapt(Flame);
export const IconCoffee = adapt(Coffee);
export const IconSearch = adapt(Search);
export const IconInfo = adapt(Info);
export const IconMail = adapt(Mail);
export const IconPause = adapt(Pause);
export const IconSkipBack = adapt(SkipBack);
export const IconSkipForward = adapt(SkipForward);
export const IconShuffle = adapt(Shuffle);
export const IconExternal = adapt(ExternalLink);

const SKIN_ICON: Record<SkinIconKey, ReturnType<typeof adapt>> = {
  spark: IconSpark,
  heart: IconHeart,
  sparkle: IconSparkle,
  star: IconStar,
  scroll: IconScroll,
};

/** 功能注释：皮肤选项线性图标，配合 lib/skins 的 icon 键。 */
export function SkinIcon({ id, size = "md", className }: { id: SkinIconKey; size?: IconSize; className?: string }) {
  const I = SKIN_ICON[id] ?? IconSpark;
  return <I size={size} className={className} />;
}

/** 功能注释：行囊线性图标（与 Lucide 线宽一致的手写路径）。 */
export const IconBackpack = (p: RomanceIconProps & LegacyP) => {
  const size = p.size ?? (typeof p.width === "number" ? p.width : "sm");
  const px = typeof size === "number" ? size : SIZE_PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={typeof p.strokeWidth === "number" ? p.strokeWidth : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={p.className}
      style={p.style}
      aria-hidden
    >
      <path d="M6 10a6 6 0 0 1 12 0v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
      <path d="M9 10V7a3 3 0 0 1 6 0v3" />
      <path d="M9 14h6a2 2 0 0 1 2 2v4H7v-4a2 2 0 0 1 2-2z" />
    </svg>
  );
};

/** 功能注释：内心 OS 统一组件 —— 线性 SVG +「内心 OS」文案，禁止再写 💭。 */
export function InnerOsLabel({
  text,
  colon = true,
  className = "",
  iconClassName = "",
}: {
  text?: ReactNode;
  colon?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={`inline-flex items-start gap-1 ${className}`}>
      <IconThought size="sm" className={`mt-[2px] shrink-0 ${iconClassName}`} />
      <span>
        <span className="font-semibold">内心 OS{colon ? "：" : ""}</span>
        {text}
      </span>
    </span>
  );
}

/** 功能注释：状态/结果小标签 —— 线性勾/叉/警告 + 文字，替代 ✓ ✕ ⚠。 */
export function StatusMark({
  kind,
  children,
  className = "",
}: {
  kind: "ok" | "warn" | "err" | "lock" | "star" | "heart" | "spark";
  children?: ReactNode;
  className?: string;
}) {
  const map: Record<typeof kind, ComponentType<LegacyP>> = {
    ok: IconCheck,
    warn: IconAlert,
    err: IconClose,
    lock: IconLock,
    star: IconStar,
    heart: IconHeart,
    spark: IconSpark,
  };
  const I = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <I size="sm" />
      {children}
    </span>
  );
}

/** 功能注释：星级展示 —— N 个线性星，替代 ★.repeat。 */
export function StarRating({ n, className = "" }: { n: number; className?: string }) {
  const count = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${count} 星`}>
      {Array.from({ length: count }, (_, i) => (
        <IconStar key={i} size={14} />
      ))}
    </span>
  );
}

const EMOTION_ICON: Record<(typeof EMOTIONS)[EmotionId]["icon"], LucideIcon> = {
  flame: Flame,
  frown: Frown,
  blush: Heart,
  meh: Meh,
  heart: Heart,
  spark: Sparkles,
  smile: Smile,
  cloud: CloudRain,
  droplet: Droplets,
  leaf: Leaf,
  zap: Zap,
  help: HelpCircle,
  search: Search,
  heartHandshake: HeartHandshake,
};

/** 功能注释：情绪标签 —— 线性图标 + 中文名，替代彩色 Emoji。 */
export function EmotionBadge({
  id,
  bpm,
  className = "",
}: {
  id: EmotionId;
  bpm?: number;
  className?: string;
}) {
  const meta = EMOTIONS[id];
  const I = lucideIcon(EMOTION_ICON[meta.icon]);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <I size={14} />
      <span>{meta.label}</span>
      {typeof bpm === "number" && (
        <span className="inline-flex items-center gap-0.5 text-[#fa5151]">
          <IconHeart size={12} /> {bpm} BPM
        </span>
      )}
    </span>
  );
}

/**
 * 功能注释：编辑器小手机内打开应用时，挂载与 Phone.tsx 实机同一套组件；禁止再画「首页/空状态/入口」示意页。
 */
import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import type { FrameId } from "../Phone";
import WeChatApp from "./WeChatApp";
import SmsApp from "./SmsApp";
import CallApp from "./CallApp";
import WeiboApp from "./WeiboApp";
import XhsApp from "./XhsApp";
import TicketApp from "./TicketApp";
import SettingsApp from "./SettingsApp";
import { PomodoroApp, ClockApp, CalculatorApp, NotesApp, WeatherApp } from "./UtilApps";
import MusicApp from "./MusicApp";
import BossZhipinApp from "./BossZhipinApp";
import XianyuApp from "./XianyuApp";
import PeekApp from "./PeekApp";
import CoupleApp from "./CoupleApp";
import MailApp from "./MailApp";
import ReadApp from "./ReadApp";
import VideoApp from "./VideoApp";
import { phoneAppLabel } from "../../lib/phoneAppsConfig";

/** 不依赖局内存档也能安全打开的本地工具 */
const LOCAL_OK = new Set(["calculator", "pomodoro", "notes", "clock"]);

type SettingsPrefs = {
  wallpaper: string;
  customWallpaper?: string;
  brightness: number;
  dark: boolean;
  dnd: boolean;
  haptics: boolean;
  frameColor: FrameId;
  showFrame: boolean;
};

const DEFAULT_SETTINGS: SettingsPrefs = {
  wallpaper: "ocean",
  brightness: 1,
  dark: false,
  dnd: false,
  haptics: true,
  frameColor: "titanium",
  showFrame: true,
};

function NeedGameGate({ id, onBack }: { id: string; onBack: () => void }) {
  const label = phoneAppLabel(id);
  return (
    <div className="flex h-full flex-col bg-[#f2f2f7] text-[#181818]">
      <div className="flex shrink-0 items-center px-3 pb-2 pt-1">
        <button type="button" onClick={onBack} className="w-12 text-left text-[22px] text-[#007aff]">
          ‹
        </button>
        <div className="flex-1 text-center text-[16px] font-semibold">{label}</div>
        <span className="w-12" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-[14px] font-semibold text-ink">与游戏实机为同一套应用</p>
        <p className="text-[12px] leading-relaxed text-[#8a8a8e]">
          当前没有局内存档，无法载入会话 / 人物数据。请点编辑器顶部「预览」进入作者预览（实机同款）后再试玩；桌面上的「视监」在无认识的人时也会显示空列表。
        </p>
      </div>
    </div>
  );
}

/** 功能注释：按应用 id 分发到局内真实页面；appstore 由外层商店屏承接，此处不应再进 */
export default function LivePhoneAppPreview({ id, onBack }: { id: string; onBack: () => void }) {
  const { game } = useGame();
  const [settingsPrefs, setSettingsPrefs] = useState<SettingsPrefs>(DEFAULT_SETTINGS);

  // appstore 由外层商店屏承接，不应落到此处
  if (id === "appstore") return null;

  if (!game && !LOCAL_OK.has(id) && id !== "peek") {
    return <NeedGameGate id={id} onBack={onBack} />;
  }

  // 视监：无存档时 PeekApp 内部走与实机一致的空列表；有存档则完整玩法
  if (id === "peek") return <PeekApp onBack={onBack} />;
  if (id === "wechat") return <WeChatApp onBack={onBack} />;
  if (id === "sms") return <SmsApp onBack={onBack} />;
  if (id === "call") return <CallApp onBack={onBack} />;
  if (id === "weibo") return <WeiboApp onBack={onBack} />;
  if (id === "xhs") return <XhsApp onBack={onBack} />;
  if (id === "ticket") return <TicketApp onBack={onBack} />;
  if (id === "settings") {
    if (!game) return <NeedGameGate id={id} onBack={onBack} />;
    return (
      <SettingsApp
        onBack={onBack}
        prefs={settingsPrefs}
        onChange={(p) => setSettingsPrefs((cur) => ({ ...cur, ...p }))}
      />
    );
  }
  if (id === "pomodoro") return <PomodoroApp onBack={onBack} />;
  if (id === "clock") return <ClockApp onBack={onBack} />;
  if (id === "calculator") return <CalculatorApp onBack={onBack} />;
  if (id === "notes") return <NotesApp onBack={onBack} />;
  if (id === "weather") {
    if (!game) return <NeedGameGate id={id} onBack={onBack} />;
    return <WeatherApp onBack={onBack} />;
  }
  if (id === "cloudmusic") return <MusicApp onBack={onBack} />;
  if (id === "bosspin") return <BossZhipinApp onBack={onBack} />;
  if (id === "xianyu") return <XianyuApp onBack={onBack} />;
  if (id === "couple") return <CoupleApp onBack={onBack} />;
  if (id === "mail") return <MailApp onBack={onBack} />;
  if (id === "read") return <ReadApp onBack={onBack} />;
  if (id === "video") return <VideoApp onBack={onBack} />;

  return <NeedGameGate id={id} onBack={onBack} />;
}

/* 微信：仿原生四栏（微信 / 通讯录 / 发现 / 我），微信绿 #07c160、圆角方头像、灰底会话表 */
import { useMemo, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, threadFor, openThread, toggleLike, type ChatMsg } from "../../game/phone";
import { PERSON_BY_ID } from "../../worlds/star2005/content";
import { Empty } from "./shared";
import { ChatView } from "./chat";
import { Moments } from "./Moments";
import ProfileView from "./ProfileView";
import { IconSearch, IconPlus, IconWallet, IconStar, IconImage, IconSmiley, IconGear, IconVideo, IconScan, IconCompass, IconGrid, IconShop, IconPin, IconChevron } from "./icons";

const WX_GREEN = "#07c160";
type WxTab = "chats" | "contacts" | "discover" | "me";

/* 会话时间：取最后一条消息的时刻标签，只留「时:分」；跨天则显示日期段 */
function lastTimeLabel(m?: ChatMsg) {
  if (!m?.label) return "";
  const parts = m.label.split(" ");
  return parts[parts.length - 1] ?? "";
}

/* 微信方形圆角头像（原生是 ~6px 圆角方形，而非圆形） */
function WxAvatar({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
  return (
    <div className="overflow-hidden rounded-[6px] bg-black/5" style={{ width: size, height: size }}>
      <Avatar shape="rounded" src={src} name={name} size={size} editable={false} />
    </div>
  );
}

/* 微信子页面通用头（返回 + 居中标题） */
function WxSubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center bg-[#ededed] px-3 pb-2 pt-1 text-ink">
      <button onClick={onBack} className="w-16 text-left text-[15px] text-ink/70">‹ 返回</button>
      <span className="flex-1 text-center text-[16px] font-semibold">{title}</span>
      <span className="w-16" />
    </div>
  );
}

/* 微信绿开关 */
function WxToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-[26px] w-[42px] shrink-0 rounded-full transition-colors ${on ? "bg-[#07c160]" : "bg-black/15"}`} aria-pressed={on}>
      <span className={`absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-[2px]"}`} />
    </button>
  );
}

/* 微信设置行（可点进 or 带右侧控件） */
function WxSetRow({ label, right, onClick, danger }: { label: string; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`flex items-center gap-3 bg-white px-4 py-3 text-left ${onClick ? "cursor-pointer transition active:bg-black/[0.03]" : ""}`}
    >
      <span className={`flex-1 border-b border-black/[0.06] pb-3 text-[16px] ${danger ? "text-center text-[#e0533d]" : "text-ink"}`}>{label}</span>
      {right && <span className="text-[14px] text-ink-soft">{right}</span>}
      {onClick && !danger && <span className="text-ink-soft/50">›</span>}
    </div>
  );
}

/* 顶部标题栏：微信原生浅灰 #ededed、标题居中、右上「+」 */
function WxHeader({ title, count, onBack, onSearch, onPlus }: { title: string; count?: number; onBack: () => void; onSearch: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center bg-[#ededed] px-3 pb-2 pt-1 text-ink">
      <button onClick={onBack} className="w-16 text-left text-[14px] text-ink/70">‹ 主屏</button>
      <span className="flex-1 text-center text-[16px] font-semibold">
        {title}{count ? `(${count})` : ""}
      </span>
      <span className="flex w-16 items-center justify-end gap-4 leading-none text-ink/80">
        <button onClick={onSearch} aria-label="搜索"><IconSearch size={20} /></button>
        <button onClick={onPlus} aria-label="更多"><IconPlus size={20} /></button>
      </span>
    </div>
  );
}

/* 底栏 4 图标（微信 / 通讯录 / 发现 / 我），激活态微信绿 */
function WxTabBar({ active, onPick, unread }: { active: WxTab; onPick: (t: WxTab) => void; unread: number }) {
  const items: { id: WxTab; label: string; icon: ReactNode; badge?: number }[] = [
    { id: "chats", label: "绿信", icon: <IconChat />, badge: unread },
    { id: "contacts", label: "通讯录", icon: <IconContacts /> },
    { id: "discover", label: "发现", icon: <IconDiscover /> },
    { id: "me", label: "我", icon: <IconMe /> },
  ];
  return (
    <div className="flex border-t border-black/10 bg-[#f7f7f7] pb-1 pt-1.5">
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onPick(it.id)} className="relative flex flex-1 flex-col items-center gap-0.5 py-1">
            <span className="relative" style={{ color: on ? WX_GREEN : "#7a7a7a" }}>
              {it.icon}
              {!!it.badge && it.badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#fa5151] px-1 text-[9px] font-bold text-white">{it.badge > 99 ? "99+" : it.badge}</span>
              )}
            </span>
            <span className="text-[10.5px]" style={{ color: on ? WX_GREEN : "#7a7a7a" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContactList({ onOpen }: { onOpen: (threadId: string) => void }) {
  const { game } = useGame();
  const ph = ensurePhone(game!).phone!;
  if (ph.contacts.length === 0) return <Empty text="通讯录还没人。交换联系方式后，联系人会出现在这里。" />;
  // 按拼音无从取，简单按名字聚合到「星标/联系人」
  return (
    <div className="bg-white">
      <p className="bg-[#ededed] px-4 py-1 text-[12px] text-ink-soft">联系人</p>
      {ph.contacts.map((pid) => {
        const npc = game!.npcs.find((n) => n.id === pid);
        const p = PERSON_BY_ID[pid];
        const t = threadFor(ph, pid);
        return (
          <button key={pid} onClick={() => t && onOpen(t.id)} className="flex w-full items-center gap-3 px-3.5 py-2 text-left active:bg-black/5">
            <WxAvatar src={npc?.avatar} name={npc?.name ?? pid} size={40} />
            <div className="min-w-0 flex-1 border-b border-black/[0.06] pb-2">
              <p className="truncate text-[16px] text-ink">{npc?.name ?? p?.name}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* 发现：仿原生分组菜单（朋友圈 / 视频号 / 扫一扫 / 摇一摇 / 看一看 / 搜一搜 / 附近 / 购物 / 小程序），朋友圈进入动态流 */
function DiscoverPage() {
  const { game } = useGame();
  const [inMoments, setInMoments] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [sub, setSub] = useState<"channels" | "mini" | null>(null);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const recent = game!.npcs.slice(0, 3);

  if (profile) return <ProfileView pid={profile} onBack={() => setProfile(null)} />;
  if (sub === "channels") return <WxChannelsPage onBack={() => setSub(null)} />;
  if (sub === "mini") return <WxMiniProgramsPage onBack={() => setSub(null)} />;

  if (inMoments) {
    return (
      <div className="flex h-full flex-col bg-white">
        <div className="flex items-center gap-2 bg-[#ededed] px-3 pb-2 pt-1 text-ink">
          <button onClick={() => setInMoments(false)} className="w-16 text-left text-[14px] text-ink/70">‹ 发现</button>
          <span className="flex-1 text-center text-[16px] font-semibold">朋友圈</span>
          <span className="w-16" />
        </div>
        <div className="flex-1 overflow-y-auto"><Moments onOpenProfile={setProfile} /></div>
      </div>
    );
  }

  const Item = ({ icon, label, onClick, foot, thumbs }: { icon: ReactNode; label: string; onClick: () => void; foot?: string; thumbs?: boolean }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition active:bg-black/[0.03]">
      <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      <span className="flex flex-1 items-center gap-2 border-b border-black/[0.06] pb-3 text-[16px] text-ink">
        {label}
        {thumbs && (
          <span className="ml-auto flex -space-x-1.5">
            {recent.map((n) => <span key={n.id} className="overflow-hidden rounded-[4px] ring-1 ring-white"><WxAvatar src={n.avatar} name={n.name} size={22} /></span>)}
          </span>
        )}
        {foot && <span className="ml-auto text-[13px] text-ink-soft">{foot}</span>}
        <span className={thumbs || foot ? "" : "ml-auto"}><IconChevron size={15} /></span>
      </span>
    </button>
  );

  return (
    <div className="relative space-y-2 pt-2 text-ink-soft/60">
      <div><Item icon={<IconImage size={20} className="text-[#2ca35b]" />} label="朋友圈" onClick={() => setInMoments(true)} thumbs /></div>
      <div>
        <Item icon={<IconVideo size={20} className="text-[#fa7b2c]" />} label="视频号" onClick={() => setSub("channels")} />
      </div>
      <div>
        <Item icon={<IconScan size={20} className="text-[#2c86fa]" />} label="扫一扫" onClick={() => flash("没有可扫描的二维码")} />
        <Item icon={<IconGrid size={20} className="text-[#f5a623]" />} label="摇一摇" onClick={() => flash("摇一摇 · 附近暂时没人")} />
      </div>
      <div>
        <Item icon={<IconStar size={20} className="text-[#f5a623]" />} label="看一看" onClick={() => flash("去冲浪热搜看看今天发生了什么")} />
        <Item icon={<IconSearch size={20} className="text-[#e15b64]" />} label="搜一搜" onClick={() => flash("搜索：试试艺人名、剧名")} />
      </div>
      <div>
        <Item icon={<IconPin size={20} className="text-[#2ca35b]" />} label="附近的人" onClick={() => flash("正在定位…星城 · 附近暂时没人")} />
      </div>
      <div>
        <Item icon={<IconShop size={20} className="text-[#fa7b2c]" />} label="购物" onClick={() => flash("去小粉书商城逛逛好物吧")} />
        <Item icon={<IconCompass size={20} className="text-[#2c86fa]" />} label="小程序" onClick={() => setSub("mini")} />
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* 微信 · 账号与安全子页 */
function WxAccountPage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const wxid = `star_${game!.player.name}`;
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="账号与安全" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label="绿信号" right={wxid} />
          <WxSetRow label="手机号" right="+86 138****0000" />
          <WxSetRow label="声音锁" right="未开启" />
        </div>
        <div>
          <p className="px-4 pb-1 text-[12px] text-ink-soft">安全</p>
          <WxSetRow label="绿信安全中心" right="正常" />
          <WxSetRow label="账号保护" right="已开启" />
          <WxSetRow label="登录设备管理" right="1 台" />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">你的账号处于安全状态，未发现异常登录。</p>
      </div>
    </div>
  );
}

/* 微信 · 通用子页 */
function WxGeneralPage({ onBack }: { onBack: () => void }) {
  const [cleared, setCleared] = useState(false);
  const [multi, setMulti] = useState(false);
  const [enterSend, setEnterSend] = useState(true);
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="通用" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label="多语言" right="简体中文" />
          <WxSetRow label="字体大小" right="标准" />
        </div>
        <div>
          <WxSetRow label="按下 Enter 键发送消息" right={<WxToggle on={enterSend} onChange={setEnterSend} />} />
          <WxSetRow label="照片、视频、文件与通话" right="自动" />
        </div>
        <div>
          <WxSetRow label="发现页管理" right="全部开启" />
          <WxSetRow label="辅助功能" right={<WxToggle on={multi} onChange={setMulti} />} />
        </div>
        <div>
          <WxSetRow label="存储空间" right={cleared ? "0.3 GB" : "2.1 GB"} onClick={() => setCleared(true)} />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">
          {cleared ? "缓存已清理，释放约 1.8 GB 空间。" : "点击「存储空间」可清理聊天缓存。"}
        </p>
      </div>
    </div>
  );
}

/* 微信 · 关于子页 */
function WxAboutPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="关于绿信" onBack={onBack} />
      <div className="flex flex-1 flex-col items-center overflow-y-auto pt-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-[30px]" style={{ background: WX_GREEN }}>💬</div>
        <p className="mt-3 text-[17px] font-semibold text-ink">绿信 · 星城版</p>
        <p className="mt-1 text-[12.5px] text-ink-soft">Version 6.0 (2005)</p>
        <div className="mt-8 w-full">
          <WxSetRow label="功能介绍" />
          <WxSetRow label="服务协议" />
          <WxSetRow label="隐私保护指引" />
        </div>
        <p className="mt-auto pb-6 pt-10 text-[11px] text-ink-soft/60">STARLIGHT://2005 · 仿真通讯</p>
      </div>
    </div>
  );
}

/* 微信 · 设置：账号 / 通知 / 隐私 / 通用 / 关于（开关为本地状态，即时生效于界面提示） */
function WxSettingsPage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const [page, setPage] = useState<"root" | "account" | "general" | "about">("root");
  const [notify, setNotify] = useState(true);
  const [sound, setSound] = useState(true);
  const [dnd, setDnd] = useState(false);
  const [momentsPush, setMomentsPush] = useState(true);
  const [hideRead, setHideRead] = useState(false);
  const [needVerify, setNeedVerify] = useState(true);
  const [strangerTen, setStrangerTen] = useState(true);

  if (page === "account") return <WxAccountPage onBack={() => setPage("root")} />;
  if (page === "general") return <WxGeneralPage onBack={() => setPage("root")} />;
  if (page === "about") return <WxAboutPage onBack={() => setPage("root")} />;

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="设置" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label="账号与安全" right={`绿信号 star_${game!.player.name}`} onClick={() => setPage("account")} />
        </div>
        <div>
          <p className="px-4 pb-1 pt-1 text-[12px] text-ink-soft">新消息通知</p>
          <WxSetRow label="接收新消息通知" right={<WxToggle on={notify} onChange={setNotify} />} />
          <WxSetRow label="通知显示消息详情" right={<WxToggle on={!hideRead} onChange={(v) => setHideRead(!v)} />} />
          <WxSetRow label="声音" right={<WxToggle on={sound} onChange={setSound} />} />
          <WxSetRow label="勿扰模式" right={<WxToggle on={dnd} onChange={setDnd} />} />
        </div>
        <div>
          <p className="px-4 pb-1 text-[12px] text-ink-soft">隐私</p>
          <WxSetRow label="朋友圈推送提醒" right={<WxToggle on={momentsPush} onChange={setMomentsPush} />} />
          <WxSetRow label="加我为朋友时需要验证" right={<WxToggle on={needVerify} onChange={setNeedVerify} />} />
          <WxSetRow label="朋友圈允许陌生人查看十条" right={<WxToggle on={strangerTen} onChange={setStrangerTen} />} />
        </div>
        <div>
          <WxSetRow label="通用" right="存储 2.1 GB" onClick={() => setPage("general")} />
          <WxSetRow label="关于绿信" right="版本 6.0（星城版）" onClick={() => setPage("about")} />
        </div>
        <div>
          <WxSetRow label="退出登录" danger onClick={onBack} />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">
          {dnd ? "勿扰模式已开启，新消息不再响铃震动。" : notify ? "新消息通知已开启。" : "已关闭通知，可能错过重要消息。"}
        </p>
      </div>
    </div>
  );
}

/* 微信 · 表情：可选一枚，底部预览「已添加到常用」 */
const STICKERS = ["😀", "😂", "🥰", "😎", "😭", "😡", "👍", "🙏", "🎉", "💪", "🌹", "☕", "🍜", "🌙", "⭐", "🔥", "💰", "🎬", "🎤", "📷", "✈️", "💄", "👑", "🍰", "🐱", "🐶", "🌸", "🎀", "💤", "😴", "🤔", "😏"];
function WxStickersPage({ onBack }: { onBack: () => void }) {
  const [fav, setFav] = useState<string[]>([]);
  const toggle = (s: string) => setFav((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  return (
    <div className="flex h-full flex-col bg-white">
      <WxSubHeader title="表情" onBack={onBack} />
      {fav.length > 0 && (
        <div className="border-b border-black/[0.06] bg-[#fafafa] px-4 py-2">
          <p className="mb-1 text-[12px] text-ink-soft">我的常用（{fav.length}）</p>
          <div className="flex flex-wrap gap-1.5 text-[22px]">{fav.map((s) => <span key={s}>{s}</span>)}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-6 gap-1">
          {STICKERS.map((s) => (
            <button key={s} onClick={() => toggle(s)} className={`flex aspect-square items-center justify-center rounded-lg text-[26px] transition ${fav.includes(s) ? "bg-[#07c160]/15 ring-1 ring-[#07c160]" : "active:bg-black/5"}`}>
              {s}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[12px] text-ink-soft/70">点一枚加入 / 移出常用表情</p>
      </div>
    </div>
  );
}

/* 微信 · 视频号：竖排短视频卡片流（虚构内容） */
const CHANNEL_FEED = [
  { author: "星城美食地图", title: "本周探店 · 弄堂口那家生煎", tag: "美食", likes: "1.2万" },
  { author: "片场那些事", title: "偶遇剧组转场，围观了半小时", tag: "娱乐", likes: "8973" },
  { author: "老唱片收藏家", title: "2005 年最好听的十首华语金曲", tag: "音乐", likes: "3.4万" },
  { author: "城市夜跑团", title: "沿江夜跑十公里，风景绝了", tag: "运动", likes: "622" },
  { author: "手作小店", title: "手冲一杯挂耳，慢下来的下午", tag: "生活", likes: "2156" },
];
function WxChannelsPage({ onBack }: { onBack: () => void }) {
  const { game, commitGame } = useGame();
  const likeSet = new Set(game!.phone?.likes ?? []);
  return (
    <div className="flex h-full flex-col bg-white">
      <WxSubHeader title="视频号" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {CHANNEL_FEED.map((v, i) => {
          const liked = likeSet.has(`wx:ch:${i}`);
          return (
          <div key={i} className="border-b border-black/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07c160]/15 text-[13px] font-bold text-[#07c160]">{v.author[0]}</span>
              <span className="text-[14px] font-semibold text-ink">{v.author}</span>
              <span className="ml-auto rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] text-ink-soft">{v.tag}</span>
            </div>
            <p className="mt-2 text-[14px] text-ink">{v.title}</p>
            <div className="mt-2 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-[#1f2937] to-[#0b1220] text-white/80">
              <span className="text-[34px]">▶</span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[13px] text-ink-soft">
              <button onClick={() => commitGame(toggleLike(game!, `wx:ch:${i}`))} className={liked ? "text-[#e0533d]" : ""}>♥ {liked ? "已赞" : v.likes}</button>
              <span>评论</span>
              <span>转发</span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* 微信 · 小程序：常用小程序宫格，点击进入简易详情 */
const MINI_PROGRAMS = [
  { name: "星城天气", icon: "🌤", desc: "查看星城未来一周天气。" },
  { name: "叫车出行", icon: "🚕", desc: "一键叫车，前往片场或通告地点。" },
  { name: "外卖到家", icon: "🍱", desc: "深夜收工，点份夜宵慰劳自己。" },
  { name: "院线购票", icon: "🎬", desc: "查看正在热映的电影并选座购票。" },
  { name: "健身打卡", icon: "🏋", desc: "记录每日训练，保持体能与身材。" },
  { name: "记账本", icon: "📒", desc: "记录片酬与开销，理清一周收支。" },
  { name: "星座运势", icon: "🔮", desc: "今日宜：签约；忌：冲动发言。" },
  { name: "快递查询", icon: "📦", desc: "粉丝寄来的礼物到哪儿了？" },
];
function WxMiniProgramsPage({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  if (open !== null) {
    const mp = MINI_PROGRAMS[open];
    return (
      <div className="flex h-full flex-col bg-[#f6f6f6]">
        <WxSubHeader title={mp.name} onBack={() => setOpen(null)} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-[64px]">{mp.icon}</span>
          <p className="text-[18px] font-semibold text-ink">{mp.name}</p>
          <p className="text-[14px] leading-relaxed text-ink-soft">{mp.desc}</p>
          <p className="mt-2 text-[12px] text-ink-soft/60">小程序无需下载，用完即走。</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col bg-[#f6f6f6]">
      <WxSubHeader title="小程序" onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-4">
          {MINI_PROGRAMS.map((mp, i) => (
            <button key={mp.name} onClick={() => setOpen(i)} className="flex flex-col items-center gap-1.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[28px] shadow-sm ring-1 ring-black/5">{mp.icon}</span>
              <span className="text-[11.5px] text-ink">{mp.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* 我：个人资料卡 */
function MePage() {
  const { game } = useGame();
  const [toast, setToast] = useState("");
  const [sub, setSub] = useState<"settings" | "stickers" | null>(null);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2000); };
  if (sub === "settings") return <WxSettingsPage onBack={() => setSub(null)} />;
  if (sub === "stickers") return <WxStickersPage onBack={() => setSub(null)} />;
  const bal = game!.sim.money;
  const money = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);
  const Row = ({ icon, label, right, onClick }: { icon: ReactNode; label: string; right?: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition active:bg-black/[0.03]">
      <span className="flex h-7 w-7 items-center justify-center text-ink/70">{icon}</span>
      <span className="flex-1 border-b border-black/[0.06] pb-3 text-[16px] text-ink">{label}</span>
      {right && <span className="text-[14px] text-ink-soft">{right}</span>}
      <span className="text-ink-soft/50">›</span>
    </button>
  );
  return (
    <div className="relative space-y-2 pt-2">
      <button onClick={() => flash("这就是你自己的主页啦")} className="flex w-full items-center gap-4 bg-white px-4 py-5 text-left">
        <WxAvatar src={game!.player.avatar} name={game!.player.name} size={64} />
        <div className="min-w-0">
          <p className="truncate text-[20px] font-semibold text-ink">{game!.player.name}</p>
          <p className="mt-1 text-[13px] text-ink-soft">绿信号：star_{game!.player.name}</p>
        </div>
        <span className="ml-auto text-ink-soft/50">›</span>
      </button>
      <div>
        <Row icon={<IconWallet size={20} style={{ color: WX_GREEN }} />} label="服务 · 钱包" right={`¥${money(bal)}`} onClick={() => flash(`钱包余额 ¥${money(bal)}（与游戏资金同步）`)} />
      </div>
      <div>
        <Row icon={<IconStar size={20} />} label="收藏" onClick={() => flash("还没有收藏内容")} />
        <Row icon={<IconImage size={20} />} label="朋友圈" onClick={() => flash("去发现页看看朋友圈吧")} />
        <Row icon={<IconSmiley size={20} />} label="表情" onClick={() => setSub("stickers")} />
      </div>
      <div><Row icon={<IconGear size={20} />} label="设置" onClick={() => setSub("settings")} /></div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default function WeChatApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame } = useGame();
  const ph = ensurePhone(game!).phone!;
  const [tab, setTab] = useState<WxTab>("chats");
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };

  const thread = open ? ph.threads.find((t) => t.id === open) : null;
  const threads = useMemo(
    () => [...ph.threads].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.lastTs - a.lastTs),
    [ph.threads],
  );
  const unread = ph.threads.reduce((a, t) => a + t.unread, 0);

  if (thread) return <ChatView thread={thread} onBack={() => setOpen(null)} />;

  if (searching) {
    const q = query.trim();
    const hitThreads = q ? threads.filter((t) => t.title.includes(q)) : [];
    const hitContacts = q
      ? ph.contacts
          .map((pid) => game!.npcs.find((n) => n.id === pid))
          .filter((n): n is NonNullable<typeof n> => !!n && (n.name.includes(q) || (n.identity ?? "").includes(q)) && !threads.some((t) => t.personId === n.id))
      : [];
    return (
      <div className="flex h-full flex-col bg-[#ededed]">
        <div className="flex items-center gap-2 bg-[#ededed] px-3 py-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5">
            <IconSearch size={15} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索聊天记录、联系人" className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-soft/60" />
          </div>
          <button onClick={() => { setSearching(false); setQuery(""); }} className="text-[14px] text-[#576b95]">取消</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!q && <p className="px-4 py-6 text-center text-[13px] text-ink-soft">输入名字，搜索聊天或通讯录里的 TA</p>}
          {q && hitThreads.length === 0 && hitContacts.length === 0 && <Empty text={`没有找到与「${q}」相关的联系人`} />}
          {hitThreads.length > 0 && (
            <div className="bg-white">
              <p className="px-4 pt-3 pb-1 text-[12px] text-ink-soft">聊天</p>
              {hitThreads.map((t) => {
                const npc = game!.npcs.find((n) => n.id === t.personId);
                return (
                  <button key={t.id} onClick={() => { setOpen(t.id); setSearching(false); setQuery(""); }} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-black/5">
                    <WxAvatar src={npc?.avatar} name={t.title} size={40} />
                    <span className="text-[15px] text-ink">{t.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          {hitContacts.length > 0 && (
            <div className="mt-2 bg-white">
              <p className="px-4 pt-3 pb-1 text-[12px] text-ink-soft">联系人</p>
              {hitContacts.map((n) => (
                <button key={n.id} onClick={() => { commitGame(openThread(game!, n.id)); setOpen(`th_${n.id}`); setSearching(false); setQuery(""); }} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-black/5">
                  <WxAvatar src={n.avatar} name={n.name} size={40} />
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink">{n.name}</p>
                    {n.identity && <p className="truncate text-[12px] text-ink-soft">{n.identity}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const title = tab === "chats" ? "绿信" : tab === "contacts" ? "通讯录" : tab === "discover" ? "发现" : "我";

  return (
    <div className="relative flex h-full flex-col bg-[#ededed]">
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
      <WxHeader
        title={title}
        count={tab === "chats" && unread ? unread : undefined}
        onBack={onBack}
        onSearch={() => setSearching(true)}
        onPlus={() => { setTab("contacts"); flash("在通讯录里选一位就能开始聊天"); }}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === "chats" && (
          threads.length === 0 ? (
            <Empty text="还没有聊天。去「人脉」里跟 TA 交换联系方式，就能私聊了。" />
          ) : (
            <div className="bg-white">
              {threads.map((t) => {
                const npc = game!.npcs.find((n) => n.id === t.personId);
                const last = [...t.msgs].reverse().find((m) => m.role !== "sys");
                return (
                  <button key={t.id} onClick={() => setOpen(t.id)} className={`flex w-full items-stretch gap-3 px-3.5 py-2.5 text-left active:bg-black/5 ${t.pinned ? "bg-[#f4f4f4]" : ""}`}>
                    <div className="relative shrink-0">
                      <WxAvatar src={npc?.avatar} name={t.title} size={48} />
                      {t.unread > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#fa5151] px-1 text-[10px] font-bold text-white">{t.unread}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center border-b border-black/[0.05] pb-2.5">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[16px] text-ink">{t.title}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-ink-soft/70">{lastTimeLabel(last)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-ink-soft">{last ? (last.role === "me" ? "我：" : "") + last.text : "打个招呼吧"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
        {tab === "contacts" && <ContactList onOpen={setOpen} />}
        {tab === "discover" && <DiscoverPage />}
        {tab === "me" && <MePage />}
      </div>
      <WxTabBar active={tab} onPick={setTab} unread={unread} />
    </div>
  );
}

/* —— 底栏图标（纯 SVG 描边，贴近微信底栏观感，不使用品牌 logo） —— */
function IconChat() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3C6.9 3 3 6.4 3 10.6c0 2.3 1.2 4.3 3.1 5.7L5.4 19l3-1.5c1.1.3 2.3.5 3.6.5 5.1 0 9-3.4 9-7.6S17.1 3 12 3Zm-3 6.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Zm6 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
    </svg>
  );
}
function IconContacts() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" strokeLinecap="round" />
    </svg>
  );
}
function IconDiscover() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 11 11l-2.5 4.5L13 13l2.5-4.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconMe() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2" strokeLinecap="round" />
    </svg>
  );
}

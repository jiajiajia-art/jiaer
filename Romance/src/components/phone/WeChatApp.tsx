/* 微信：仿原生四栏（微信 / 通讯录 / 发现 / 我），微信绿 #07c160、圆角方头像、灰底会话表 */
import { commTerm, commPromptHint } from "../../lib/commSkin";
import { canInitiate, isBlocked, MSG_PREFS, msgPrefLabel, msgPrefOf, setMsgPref, type MsgPref } from "../../game/msgPref";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, threadFor, openThread, createGroup, toggleLike, pushMsg, msgId, gameMinutes, gameTimeLabel, togglePinned, markRead, setThreadCustom, type Thread } from "../../game/phone";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../../mods/registry";
import { Empty, LoadMoreButton, seenOf } from "./shared";
import { ChatView } from "./chat";
import { Moments, addFeedMoments, type FeedMoment } from "./Moments";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";
import ProfileView from "./ProfileView";
import { useWxSettings, setWxSettings, setWxChat, WX_CHAT_DEFAULT, WX_FONT_LABEL, WX_FONT_ORDER, WX_FONT_PX } from "./wxSettings";
import { BUBBLE_STYLES, CHAT_BGS, bgCss, chatLook, chatBgOptions } from "./wxFeatures";
import { fileToDataUrl } from "./chat";
import { generateStranger, saveStranger, useStrangers, customOf, msgPreview, wxTime, initialOf, zhCompare, useFavs, removeFav, incomingReqs, addIncomingReq, resolveIncomingReq, type Stranger, type XCustom } from "./wxFeatures";
import type { GameState } from "../../lib/types";
import { IconSearch, IconPlus, IconWallet, IconStar, IconImage, IconGear, IconVideo, IconChevron, IconPlay } from "./icons";
import { liveTerm as T } from "../../mods/live";
import WalletBinder, { peekWalletRequest, takeWalletRequest } from "./WalletBinder";
import { walletDef, wallet } from "../../game/wallet";
import { logNpcNet } from "../../game/phoneLink";
import { affinityOf, romanceBlock } from "../../game/npcKnowledge";
import { IconCheck, IconHeart, IconMessage } from "../../lib/icons";
import { useCommsBrand } from "./commsBrand";

const WX_GREEN = "var(--wx-accent, #07c160)"; // 功能注释：古风「传讯」皮肤由 .comm-ancient 改写为朱砂
type WxTab = "chats" | "contacts" | "discover" | "me";

/* 微信方形圆角头像（原生是 ~6px 圆角方形，而非圆形） */
function WxAvatar({ src, name, size = 48 }: { src?: string; name: string; size?: number }) {
  return (
    <div className="overflow-hidden rounded-[6px] bg-black/5" style={{ width: size, height: size }}>
      <Avatar src={src} name={name} size={size} editable={false} />
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
function WxTabBar({ active, onPick, unread, newFriends }: { active: WxTab; onPick: (t: WxTab) => void; unread: number; newFriends: number }) {
  const brand = useCommsBrand();
  const items: { id: WxTab; label: string; icon: ReactNode; badge?: number }[] = [
    { id: "chats", label: brand.appName, icon: <IconChat />, badge: unread },
    { id: "contacts", label: brand.skin === "letter" ? commTerm("contacts") : "通讯录", icon: <IconContacts />, badge: newFriends },
    { id: "discover", label: brand.skin === "letter" ? commTerm("discover") : "发现", icon: <IconDiscover /> },
    { id: "me", label: "我", icon: <IconMe /> },
  ];
  return (
    <div className="flex border-t border-black/10 bg-[#f7f7f7] pb-1 pt-1.5">
      {items.map((it) => {
        const on = active === it.id;
        return (
          <button key={it.id} onClick={() => onPick(it.id)} className="relative flex flex-1 flex-col items-center gap-0.5 py-1">
            <span className="relative" style={{ color: on ? WX_GREEN : "var(--wx-muted, #7a7a7a)" }}>
              {it.icon}
              {!!it.badge && it.badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#fa5151] px-1 text-[9px] font-bold text-white">{it.badge > 99 ? "99+" : it.badge}</span>
              )}
            </span>
            <span className="text-[10.5px]" style={{ color: on ? WX_GREEN : "var(--wx-muted, #7a7a7a)" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContactList({ onOpen, onOpenPid }: { onOpen: (threadId: string) => void; onOpenPid: (pid: string) => void }) {
  const { game, commitGame } = useGame();
  const strangers = useStrangers();
  const ph = ensurePhone(game!).phone!;
  const [sub, setSub] = useState<"new" | "groups" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nameOf = (pid: string) => game!.npcs.find((n) => n.id === pid)?.name ?? strangers[pid]?.name ?? PERSON_BY_ID[pid]?.name ?? "";
  const avatarOf = (pid: string) => game!.npcs.find((n) => n.id === pid)?.avatar ?? strangers[pid]?.avatar;
  const pending = ph.pending ?? [];
  const reqs = incomingReqs(game!).filter((r) => game!.npcs.some((n) => n.id === r.pid) || strangers[r.pid]);
  const reqNew = reqs.filter((r) => r.state === "pending").length;
  const groups = ph.threads.filter((t) => t.kind === "group");

  if (sub === "new") {
    return (
      <div className="absolute inset-0 z-30 flex flex-col bg-[#ededed]">
        <WxSubHeader title="新的朋友" onBack={() => setSub(null)} />
        <div className="flex-1 overflow-y-auto">
          {pending.length === 0 && reqs.length === 0 && <p className="pt-16 text-center text-[13px] text-[#9a9a9a]">暂无新的朋友</p>}
          {reqs.length > 0 && (
            <div className="bg-white">
              <p className="bg-[#ededed] px-4 py-1.5 text-[12px] text-[#9a9a9a]">朋友验证</p>
              {reqs.map((r) => (
                <div key={r.pid} className="flex items-center gap-3 px-4 py-2.5">
                  <WxAvatar src={avatarOf(r.pid)} name={nameOf(r.pid) || r.pid} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] text-[#181818]">{nameOf(r.pid) || "对方"}</p>
                    <p className="truncate text-[13px] text-[#9a9a9a]">{r.text}</p>
                  </div>
                  {r.state === "pending" ? (
                    <span className="flex shrink-0 gap-1.5">
                      <button onClick={() => commitGame(resolveIncomingReq(game!, r.pid, false))} className="rounded-[4px] bg-[#f2f2f2] px-2.5 py-1 text-[13px] text-[#576b95]">拒绝</button>
                      <button onClick={() => commitGame(resolveIncomingReq(game!, r.pid, true))} className="rounded-[4px] px-2.5 py-1 text-[13px] font-medium text-white" style={{ background: WX_GREEN }}>接受</button>
                    </span>
                  ) : (
                    <span className="shrink-0 text-[13px] text-[#b2b2b2]">{r.state === "accepted" ? "已添加" : "已拒绝"}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {pending.length > 0 && (
            <div className="mt-2 bg-white">
              <p className="bg-[#ededed] px-4 py-1.5 text-[12px] text-[#9a9a9a]">好友申请</p>
              {pending.map((pid) => (
                <div key={pid} className="flex items-center gap-3 px-4 py-2.5">
                  <WxAvatar src={avatarOf(pid)} name={nameOf(pid) || pid} size={44} />
                  <div className="min-w-0 flex-1 border-b border-black/[0.06] pb-2.5">
                    <p className="truncate text-[16px] text-[#181818]">{nameOf(pid) || "对方"}</p>
                    <p className="truncate text-[13px] text-[#9a9a9a]">我：你好，我是{game!.player.name}</p>
                  </div>
                  <span className="shrink-0 text-[13px] text-[#b2b2b2]">等待验证</span>
                </div>
              ))}
            </div>
          )}
          <p className="px-6 pt-3 text-center text-[11.5px] text-[#b2b2b2]">对方通过验证后，会出现在通讯录里，才能互发消息</p>
        </div>
      </div>
    );
  }
  if (sub === "groups") {
    return (
      <div className="absolute inset-0 z-30 flex flex-col bg-[#ededed]">
        <WxSubHeader title="群聊" onBack={() => setSub(null)} />
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? <p className="pt-16 text-center text-[13px] text-[#9a9a9a]">暂无群聊，点右上角「+」发起群聊</p> : (
            <div className="bg-white">
              {groups.map((t) => (
                <button key={t.id} onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/5">
                  <GroupAvatar members={t.members ?? []} size={40} />
                  <span className="min-w-0 flex-1 truncate border-b border-black/[0.06] pb-2.5 pt-1 text-[16px] text-[#181818]">{t.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const people = ph.contacts.map((pid) => ({ pid, name: nameOf(pid) })).filter((x) => x.name);
  const sections = new Map<string, typeof people>();
  [...people].sort((a, b) => zhCompare(a.name, b.name)).forEach((x) => {
    const k = initialOf(x.name);
    sections.set(k, [...(sections.get(k) ?? []), x]);
  });
  const keys = [...sections.keys()].sort((a, b) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)));
  const jump = (k: string) => listRef.current?.querySelector(`[data-sec="${k}"]`)?.scrollIntoView({ block: "start" });
  const Top = ({ color, icon, label, badge, onClick }: { color: string; icon: ReactNode; label: string; badge?: number; onClick: () => void }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-black/5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-white" style={{ background: color }}>{icon}</span>
      <span className="flex flex-1 items-center border-b border-black/[0.06] py-2.5 text-[16px] text-[#181818]">
        {label}
        {!!badge && <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#fa5151] px-1 text-[11px] text-white">{badge}</span>}
      </span>
    </button>
  );
  return (
    <div ref={listRef} className="relative bg-white">
      <Top color="#fa9d3b" label="新的朋友" badge={reqNew} onClick={() => setSub("new")} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="10" cy="8" r="3.6" /><path d="M3.5 19.5c0-3.6 2.9-5.8 6.5-5.8 1.4 0 2.6.3 3.6.9-.5.8-.8 1.8-.8 2.9 0 .7.1 1.4.4 2H3.5Z" /><path d="M18 13.5v6M15 16.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>} />
      <Top color="#07c160" label="群聊" onClick={() => setSub("groups")} icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="8.5" cy="8.5" r="3" /><circle cx="15.5" cy="8.5" r="3" /><path d="M2.5 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2ZM13.6 14c.6-.1 1.2-.2 1.9-.2 3.3 0 6 2 6 5.2h-5.3c0-2-.9-3.7-2.6-5Z" /></svg>} />
      {people.length === 0 && <p className="px-6 py-10 text-center text-[13px] text-[#9a9a9a]">通讯录还没人。交换联系方式后，联系人会出现在这里。</p>}
      {keys.map((k) => (
        <div key={k} data-sec={k}>
          <p className="bg-[#ededed] px-4 py-1 text-[12px] text-[#7f7f7f]">{k}</p>
          {sections.get(k)!.map(({ pid, name }) => (
            <button key={pid} onClick={() => onOpenPid(pid)} className="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-black/5">
              <WxAvatar src={avatarOf(pid)} name={name} size={40} />
              <p className="min-w-0 flex-1 truncate border-b border-black/[0.06] py-2.5 text-[16px] text-[#181818]">{name}{strangers[pid] && <span className="ml-1.5 rounded bg-[#07c160]/10 px-1 text-[10.5px] text-[#07a050]">摇一摇</span>}</p>
            </button>
          ))}
        </div>
      ))}
      {people.length > 0 && <p className="bg-[#ededed] py-4 text-center text-[13px] text-[#9a9a9a]">{people.length} 个朋友</p>}
      {keys.length > 1 && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-5">
          <div className="pointer-events-auto sticky top-24 flex flex-col items-center py-1">
            {keys.map((k) => <button key={k} onClick={() => jump(k)} className="px-1 text-[10.5px] font-medium leading-[15px] text-[#555]">{k}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* 摇一摇 / 遇见：AI 随机匹配一位虚拟陌生人，可换一个 / 打招呼 / 加为联系人 */
function addStrangerThread(g: GameState, s: Stranger): GameState {
  const tid = `th_${s.id}`;
  const g1 = openThread(g, s.id);
  const ph = g1.phone!;
  return {
    ...g1,
    phone: {
      ...ph,
      threads: ph.threads.map((t) => (t.id === tid && t.title !== s.name
        ? { ...t, title: s.name, msgs: t.msgs.map((m, i) => (i === 0 && m.role === "sys" ? { ...m, text: `你通过「摇一摇」添加了${s.name}，现在可以开始聊天了。` } : m)) }
        : t)),
    },
  };
}

function ShakePage({ onBack, onOpenChat }: { onBack: () => void; onOpenChat: (threadId: string, greet?: string) => void }) {
  const { game, cfg, commitGame } = useGame();
  const [cand, setCand] = useState<Stranger | null>(null);
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const all = useStrangers();
  const ph = ensurePhone(game!).phone!;
  const met = Object.values(all).filter((s) => ph.contacts.includes(s.id));
  const busyRef = useRef(false);

  const shake = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setCand(null);
    setCard(false);
    try { navigator.vibrate?.([120, 80, 120]); } catch { /* 部分设备不支持 */ }
    try {
      const [s] = await Promise.all([generateStranger(cfg, game!), new Promise((r) => setTimeout(r, 1100))]);
      setCand(s as Stranger);
    } catch (e) {
      flash((e as Error)?.message || "附近暂时没人，再摇一次试试");
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  };
  // 真机摇动也能触发（devicemotion 加速度阈值）
  useEffect(() => {
    let last = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const f = Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (f > 38 && Date.now() - last > 2000) { last = Date.now(); void shake(); }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = (greet: boolean) => {
    if (!cand) return;
    saveStranger(cand);
    commitGame(addStrangerThread(game!, cand));
    const tid = `th_${cand.id}`;
    if (greet) onOpenChat(tid, "你好呀，摇一摇遇见你～");
    else { flash(`已添加 ${cand.name} 到通讯录`); setCard(false); setCand(null); }
  };

  if (card && cand) {
    return (
      <div className="flex h-full flex-col bg-[#ededed]">
        <WxSubHeader title="" onBack={() => setCard(false)} />
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-4 bg-white px-5 pb-6 pt-4">
            <WxAvatar src={cand.avatar} name={cand.name} size={64} />
            <div className="min-w-0 pt-1">
              <p className="flex items-center gap-1.5 text-[20px] font-semibold text-ink">{cand.name}<span className={`text-[15px] ${cand.gender === "男" ? "text-[#2c86fa]" : "text-[#fa5c8b]"}`}>{cand.gender === "男" ? "男" : "女"}</span></p>
              <p className="mt-1 text-[13px] text-ink-soft">{cand.age} 岁 · {cand.occupation}</p>
              <p className="text-[13px] text-ink-soft">同在 {game!.world.location}</p>
            </div>
          </div>
          <div className="mt-2 bg-white">
            <div className="flex border-b border-black/[0.06] px-5 py-3.5 text-[15px]"><span className="w-20 shrink-0 text-ink">个性签名</span><span className="text-ink-soft">{cand.signature}</span></div>
            <div className="flex px-5 py-3.5 text-[15px]"><span className="w-20 shrink-0 text-ink">来源</span><span className="text-ink-soft">通过摇一摇</span></div>
          </div>
          <p className="px-5 pt-3 text-[12.5px] leading-relaxed text-ink-soft">{cand.persona}</p>
          <div className="mt-6 bg-white">
            <button onClick={() => add(true)} className="w-full border-b border-black/[0.06] py-3.5 text-[16px] font-medium" style={{ color: "#576b95" }}>打招呼</button>
            <button onClick={() => add(false)} className="w-full py-3.5 text-[16px] font-medium" style={{ color: "#576b95" }}>添加到通讯录</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#2b2b2b] text-white">
      <div className="flex items-center px-3 pb-2 pt-1">
        <button onClick={onBack} className="w-16 text-left text-[22px] leading-none text-white/85" aria-label="返回">‹</button>
        <span className="flex-1 text-center text-[17px] font-medium">摇一摇</span>
        <span className="w-16" />
      </div>

      <button onClick={() => void shake()} aria-label="摇一摇" className="relative flex flex-1 flex-col items-center justify-center outline-none">
        {/* 原版手势：上下两半在摇动时分开，露出中间的光 */}
        <span className="relative block h-[180px] w-[150px]">
          <span className="absolute inset-x-6 top-1/2 h-0 -translate-y-1/2 rounded-full bg-[#4a4a4a] transition-all duration-300" style={{ height: loading ? 56 : 0, boxShadow: loading ? "0 0 40px 6px rgba(7,193,96,.35)" : "none" }} />
          <svg viewBox="0 0 150 90" className="absolute left-0 top-0 w-full transition-transform duration-300" style={{ transform: loading ? "translateY(-30px)" : "none" }} aria-hidden>
            <path d="M40 88 V40 a10 10 0 0 1 20 0 V20 a10 10 0 0 1 20 0 V30 a10 10 0 0 1 20 0 V45 a10 10 0 0 1 20 0 V88 Z" fill="#c9c9c9" />
          </svg>
          <svg viewBox="0 0 150 90" className="absolute bottom-0 left-0 w-full transition-transform duration-300" style={{ transform: loading ? "translateY(30px)" : "none" }} aria-hidden>
            <path d="M40 2 H120 V30 q0 40 -40 56 q-40 -16 -40 -56 Z" fill="#c9c9c9" />
          </svg>
        </span>
        <span className="mt-8 text-[13px] text-white/50">{loading ? "正在搜寻同一时刻摇晃手机的人…" : "摇动手机或点击屏幕"}</span>
      </button>

      {cand && !loading && (
        <button onClick={() => setCard(true)} className="bubble-in absolute inset-x-4 bottom-24 flex items-center gap-3 rounded-[6px] bg-white px-3 py-2.5 text-left shadow-xl">
          <WxAvatar src={cand.avatar} name={cand.name} size={44} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-[16px] text-ink">{cand.name}<span className={`text-[12px] ${cand.gender === "男" ? "text-[#2c86fa]" : "text-[#fa5c8b]"}`}>{cand.gender === "男" ? "男" : "女"}</span></span>
            <span className="block truncate text-[12.5px] text-ink-soft">{cand.signature}</span>
          </span>
          <span className="shrink-0 text-[12px] text-ink-soft">{game!.world.location}</span>
        </button>
      )}

      <div className="flex items-center justify-around border-t border-white/10 pb-3 pt-2 text-[12px]">
        <span className="text-[#07c160]">人</span>
        {met.length > 0 ? (
          <button onClick={() => onOpenChat(`th_${met[met.length - 1].id}`)} className="text-white/60">遇见过 {met.length} 人</button>
        ) : <span className="text-white/30">还没遇见过人</span>}
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* 发现：仿原生分组菜单（朋友圈 / 视频号 / 扫一扫 / 摇一摇 / 看一看 / 搜一搜 / 附近 / 购物 / 小程序），朋友圈进入动态流 */
function DiscoverPage({ onSearch, onOpenChat }: { onSearch: () => void; onOpenChat: (threadId: string, greet?: string) => void }) {
  const { momentsPush } = useWxSettings();
  const { game } = useGame();
  // 功能注释：P4.1 传讯（书信风）下不做朋友圈 / 视频号 / 摇一摇这类现代社交入口，只保留「搜一搜」找人
  const letterSkin = useCommsBrand().skin === "letter";
  const [inMoments, setInMoments] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [sub, setSub] = useState<"channels" | "shake" | null>(null);
  const recent = game!.npcs.slice(0, 3);

  if (profile) return <div className="absolute inset-0 z-30 bg-white"><ProfileView pid={profile} onBack={() => setProfile(null)} /></div>;
  if (sub === "channels") return <div className="absolute inset-0 z-30 bg-white"><WxChannelsPage onBack={() => setSub(null)} /></div>;
  if (sub === "shake") return <div className="absolute inset-0 z-30 bg-white"><ShakePage onBack={() => setSub(null)} onOpenChat={onOpenChat} /></div>;

  if (inMoments) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col bg-white">
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
    <div className="space-y-2 pt-2 text-[#b2b2b2]" data-comms-discover={letterSkin ? "letter" : "modern"}>
      {!letterSkin && (
        <div><Item icon={<IconImage size={20} className="text-[#2ca35b]" />} label="朋友圈" onClick={() => setInMoments(true)} thumbs={momentsPush} /></div>
      )}
      {letterSkin && (
        <div><Item icon={<IconImage size={20} className="text-[#2ca35b]" />} label={commTerm("moments")} onClick={() => setInMoments(true)} thumbs={momentsPush} /></div>
      )}
      {!letterSkin && (
        <div>
          <Item icon={<IconVideo size={20} className="text-[#fa7b2c]" />} label="视频号" onClick={() => setSub("channels")} />
        </div>
      )}
      {!letterSkin && (
        <div>
          <Item icon={<IconSearch size={20} className="text-[#576b95]" />} label="摇一摇" onClick={() => setSub("shake")} />
        </div>
      )}
      <div>
        <Item icon={<IconSearch size={20} className="text-[#e15b64]" />} label="搜一搜" onClick={onSearch} />
      </div>
    </div>
  );
}

/* 微信 · 账号与安全子页 */
function WxAccountPage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const brand = useCommsBrand();
  const wxid = `star_${game!.player.name}`;
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="账号与安全" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label={brand.accountLabel} right={wxid} />
          <WxSetRow label="手机号" right="+86 138****0000" />
          <WxSetRow label="声音锁" right="未开启" />
        </div>
        <div>
          <p className="px-4 pb-1 text-[12px] text-ink-soft">安全</p>
          <WxSetRow label={brand.safetyCenter} right="正常" />
          <WxSetRow label="账号保护" right="已开启" />
          <WxSetRow label="登录设备管理" right="1 台" />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">你的账号处于安全状态，未发现异常登录。</p>
      </div>
    </div>
  );
}

/* 微信 · 通用子页（设置持久化，Enter 发送 / 字体大小作用于聊天页） */
function WxGeneralPage({ onBack }: { onBack: () => void }) {
  const st = useWxSettings();
  const nextFont = () => setWxSettings({ font: WX_FONT_ORDER[(WX_FONT_ORDER.indexOf(st.font) + 1) % WX_FONT_ORDER.length] });
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="通用" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label="多语言" right="简体中文" />
          <WxSetRow label="字体大小" right={WX_FONT_LABEL[st.font]} onClick={nextFont} />
        </div>
        <div>
          <WxSetRow label="按下 Enter 键发送消息" right={<WxToggle on={st.enterSend} onChange={(v) => setWxSettings({ enterSend: v })} />} />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">
          点击「字体大小」可切换聊天文字大小；关闭 Enter 发送后，Enter 换行、点「发送」发出。
        </p>
      </div>
    </div>
  );
}

/* 微信 · 聊天样式：全局气泡 / 圆角 / 描边 / 颜色 / 透明度 / 头像 / 背景，顶部实时预览 */
function WxChatStylePage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const st = useWxSettings();
  const c = st.chat;
  const look = chatLook(c);
  const fileRef = useRef<HTMLInputElement>(null);
  const fpx = WX_FONT_PX[st.font];
  const sec = "rounded-xl bg-white p-3";
  const h = "mb-2 text-[12px] font-semibold text-ink-soft";
  const seg = (on: boolean) => `flex-1 rounded-[6px] border py-1.5 text-[12.5px] transition ${on ? "border-[#07c160] bg-[#07c160]/10 font-semibold text-[#07a050]" : "border-black/10 text-ink"}`;
  const ColorRow = ({ label, value, onChange, fallback }: { label: string; value: string; onChange: (v: string) => void; fallback: string }) => (
    <label className="flex items-center justify-between py-1 text-[13px] text-ink">
      {label}
      <span className="flex items-center gap-2">
        {value && <button type="button" onClick={(e) => { e.preventDefault(); onChange(""); }} className="text-[11px] text-ink-soft">恢复预设</button>}
        <span className="relative h-7 w-7 overflow-hidden rounded-[6px] border border-black/15" style={{ background: value || fallback }}>
          <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </span>
      </span>
    </label>
  );
  const Bub = ({ mine, text }: { mine: boolean; text: string }) => (
    <div className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 overflow-hidden" style={{ borderRadius: c.avatarRadius }}>
        <Avatar src={mine ? game?.player.avatar : undefined} name={mine ? game?.player.name ?? "我" : "TA"} size={34} editable={false} />
      </div>
      <p className={`max-w-[70%] whitespace-pre-wrap leading-relaxed ${look.cls(mine)}`} style={look.style(mine, fpx)}>{text}</p>
    </div>
  );
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="聊天样式" onBack={onBack} />
      {/* 实时预览 */}
      <div className="mx-3 mt-1 space-y-2.5 overflow-hidden rounded-xl border border-black/10 p-3" style={{ background: look.bg }}>
        <Bub mine={false} text="几点的？" />
        <Bub mine text="两点多，应该要俩小时。" />
        <Bub mine={false} text="那还有二十分钟，先趴会儿也好。" />
      </div>
      <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto px-3 pb-6">
        <div className={sec}>
          <p className={h}>气泡预设</p>
          <div className="grid grid-cols-3 gap-2">
            {BUBBLE_STYLES.map((b) => {
              const on = c.bubble === b.id;
              return (
                <button key={b.id} onClick={() => setWxChat({ bubble: b.id })} className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 ${on ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/10"} ${b.id === "dark" ? "bg-[#1d2028]" : b.id === "frost" ? "bg-gradient-to-br from-[#dcecff] to-[#f4f9ff]" : "bg-[#f3f3f3]"}`}>
                  <span className={`self-start rounded-lg px-2 py-0.5 text-[11px] ${b.them}`} style={b.themStyle}>你好</span>
                  <span className={`self-end rounded-lg px-2 py-0.5 text-[11px] ${b.me}`} style={b.meStyle}>在呢～</span>
                  <span className={`text-[11px] ${on ? "font-semibold text-[#07a050]" : b.id === "dark" ? "text-white/70" : "text-ink-soft"}`}>{b.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={sec}>
          <p className={h}>形状</p>
          <p className="mb-1 text-[12px] text-ink">气泡圆角 <span className="text-ink-soft">{c.radius}px</span></p>
          <div className="mb-3 flex gap-1.5">
            {[[4, "方角"], [10, "微圆"], [16, "圆润"], [22, "胶囊"]].map(([v, l]) => <button key={v} className={seg(c.radius === v)} onClick={() => setWxChat({ radius: v as number })}>{l}</button>)}
          </div>
          <p className="mb-1 text-[12px] text-ink">头像形状</p>
          <div className="flex gap-1.5">
            {[[4, "方形"], [10, "圆角"], [20, "圆形"]].map(([v, l]) => <button key={v} className={seg(c.avatarRadius === v)} onClick={() => setWxChat({ avatarRadius: v as number })}>{l}</button>)}
          </div>
        </div>

        <div className={sec}>
          <p className={h}>描边</p>
          <div className="flex items-center justify-between py-1 text-[13px] text-ink">
            显示气泡描边
            <WxToggle on={c.border} onChange={(v) => setWxChat({ border: v })} />
          </div>
          {c.border && <ColorRow label="描边颜色" value={c.borderColor} fallback="#8fa8cc" onChange={(v) => setWxChat({ borderColor: v || "#8fa8cc" })} />}
        </div>

        <div className={sec}>
          <p className={h}>颜色（留空 = 跟随预设）</p>
          <ColorRow label="我的气泡底色" value={c.meColor} fallback="#95ec69" onChange={(v) => setWxChat({ meColor: v })} />
          <ColorRow label="我的文字颜色" value={c.meText} fallback="#1a1a1a" onChange={(v) => setWxChat({ meText: v })} />
          <ColorRow label="对方气泡底色" value={c.themColor} fallback="#ffffff" onChange={(v) => setWxChat({ themColor: v })} />
          <ColorRow label="对方文字颜色" value={c.themText} fallback="#1a1a1a" onChange={(v) => setWxChat({ themText: v })} />
          <div className={`mt-2 ${c.meColor || c.themColor ? "" : "opacity-40"}`}>
            <p className="mb-1 text-[12px] text-ink">气泡不透明度 <span className="text-ink-soft">{c.alpha}%</span></p>
            <input type="range" min={20} max={100} step={5} value={c.alpha} disabled={!c.meColor && !c.themColor} onChange={(e) => setWxChat({ alpha: Number(e.target.value) })} className="w-full accent-[#07c160]" />
            <p className="text-[10.5px] text-ink-soft">调低后能透出聊天背景（需先设置自定义底色）。</p>
          </div>
        </div>

        <div className={sec}>
          <p className={h}>文字大小</p>
          <div className="flex gap-1.5">
            {WX_FONT_ORDER.map((f) => <button key={f} className={seg(st.font === f)} onClick={() => setWxSettings({ font: f })}>{WX_FONT_LABEL[f]}</button>)}
          </div>
        </div>

        <div className={sec}>
          <p className={h}>默认聊天背景</p>
          <div className="grid grid-cols-4 gap-2">
            {chatBgOptions().map((b) => {
              const on = (c.chatBg || "") === b.id;
              return (
                <button key={b.id || "def"} onClick={() => setWxChat({ chatBg: b.id })} className="flex flex-col items-center gap-1">
                  <span className={`h-12 w-full rounded-lg border ${on ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/10"}`} style={{ background: b.css }} />
                  <span className={`text-[11px] ${on ? "font-semibold text-[#07a050]" : "text-ink-soft"}`}>{b.label}</span>
                </button>
              );
            })}
            <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1">
              <span className={`flex h-12 w-full items-center justify-center rounded-lg border border-dashed text-[18px] text-ink-soft ${c.chatBg.startsWith("data:") ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/20"}`}
                style={c.chatBg.startsWith("data:") ? { background: bgCss(c.chatBg) } : undefined}>{c.chatBg.startsWith("data:") ? "" : "+"}</span>
              <span className="text-[11px] text-ink-soft">相册</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setWxChat({ chatBg: await fileToDataUrl(f) }); } catch { /* 忽略 */ } } e.target.value = ""; }} />
          <p className="mt-2 text-[10.5px] text-ink-soft">单个聊天里另设过背景或气泡的，以那个聊天的设置为准。</p>
        </div>

        <button onClick={() => setWxSettings({ chat: WX_CHAT_DEFAULT, font: "standard" })} className="w-full rounded-xl bg-white py-3 text-[14px] text-[#fa5151]">恢复默认样式</button>
      </div>
    </div>
  );
}

/* 微信 · 关于子页 */
function WxAboutPage({ onBack }: { onBack: () => void }) {
  const brand = useCommsBrand();
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title={brand.aboutTitle} onBack={onBack} />
      <div className="flex flex-1 flex-col items-center overflow-y-auto pt-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-white" style={{ background: WX_GREEN }}><IconMessage size={28} className="text-white" /></div>
        <p className="mt-3 text-[17px] font-semibold text-ink">{brand.appName} · {T("city")}版</p>
        <p className="mt-1 text-[12.5px] text-ink-soft">Version 6.0 (2005)</p>
        <p className="mt-auto pb-6 pt-10 text-[11px] text-ink-soft/60">STARLIGHT://2005 · 仿真通讯</p>
      </div>
    </div>
  );
}

/* 微信 · 设置：账号 / 通知 / 朋友圈 / 通用 / 关于（开关持久化并实际生效） */
function WxSettingsPage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const brand = useCommsBrand();
  const st = useWxSettings();
  const [page, setPage] = useState<"root" | "account" | "general" | "about" | "chatStyle" | "msgPref">("root");

  if (page === "account") return <WxAccountPage onBack={() => setPage("root")} />;
  if (page === "chatStyle") return <WxChatStylePage onBack={() => setPage("root")} />;
  if (page === "general") return <WxGeneralPage onBack={() => setPage("root")} />;
  if (page === "about") return <WxAboutPage onBack={() => setPage("root")} />;
  if (page === "msgPref") return <WxMsgPrefPage onBack={() => setPage("root")} />;

  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="设置" onBack={onBack} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-6">
        <div className="mt-1">
          <WxSetRow label="账号与安全" right={`${brand.accountLabel} star_${game!.player.name}`} onClick={() => setPage("account")} />
        </div>
        <div>
          <p className="px-4 pb-1 pt-1 text-[12px] text-ink-soft">新消息通知</p>
          <WxSetRow label="新消息未读提醒" right={<WxToggle on={st.notify} onChange={(v) => setWxSettings({ notify: v })} />} />
          {brand.skin !== "letter" && <WxSetRow label="朋友圈更新提醒" right={<WxToggle on={st.momentsPush} onChange={(v) => setWxSettings({ momentsPush: v })} />} />}
          <WxSetRow label="允许好友主动发消息" right={<WxToggle on={st.proactive} onChange={(v) => setWxSettings({ proactive: v })} />} />
          <WxSetRow label="好友消息权限" right="逐人设置 ›" onClick={() => setPage("msgPref")} />
        </div>
        <div>
          <WxSetRow label="聊天样式" right={BUBBLE_STYLES.find((b) => b.id === st.chat.bubble)?.label ?? "经典绿"} onClick={() => setPage("chatStyle")} />
          <WxSetRow label="通用" right={`字体 ${WX_FONT_LABEL[st.font]}`} onClick={() => setPage("general")} />
          <WxSetRow label={brand.aboutTitle} right={`版本 6.0（${T("city")}版）`} onClick={() => setPage("about")} />
        </div>
        <div>
          <WxSetRow label="退出登录" danger onClick={onBack} />
        </div>
        <p className="px-6 text-center text-[11px] text-ink-soft/70">
          {st.notify ? "未读消息会以红点角标提醒。" : "已关闭未读提醒，会话列表与底栏不再显示红点角标。"}
          {st.proactive ? " 好友默认只在剧情需要时联系你；设为「主动联系」的人每到新的一天可能来找你聊天。" : " 已关闭剧情之外的主动消息，好友只在剧情需要时联系你。"}
        </p>
      </div>
    </div>
  );
}

/* 微信 · 视频号：竖排短视频卡片流（虚构内容） */
const CHANNEL_FEED = [
  { get author() { return `${T("city")}美食地图`; }, title: "本周探店 · 弄堂口那家生煎", tag: "美食", likes: "1.2万" },
  { author: "片场那些事", title: "偶遇剧组转场，围观了半小时", tag: "娱乐", likes: "8973" },
  { author: "老唱片收藏家", title: "2005 年最好听的十首华语金曲", tag: "音乐", likes: "3.4万" },
  { author: "城市夜跑团", title: "沿江夜跑十公里，风景绝了", tag: "运动", likes: "622" },
  { author: "手作小店", title: "手冲一杯挂耳，慢下来的下午", tag: "生活", likes: "2156" },
];
type ChannelItem = { author: string; title: string; tag: string; likes: string };
function WxChannelsPage({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame } = useGame();
  const likeSet = new Set(game!.phone?.likes ?? []);
  const [more, setMore] = useState<ChannelItem[]>(() => loadFeed<ChannelItem[]>("wechat.channels.more") ?? []);
  const [moreLoading, setMoreLoading] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1800); };
  const feed: ChannelItem[] = [...CHANNEL_FEED, ...more];
  /* 底部「查看更多」：结合剧情再生成一批视频号内容，接在末尾（持久化） */
  const loadMore = async () => {
    if (moreLoading) return;
    setMoreLoading(true);
    try {
      const seen = seenOf(feed.map((v) => v.title));
      const r = await syncJson<{ videos?: unknown }>(cfg, game!, "wechat-channels", "视频号", `再生成 5 条视频号推荐视频，作者可以是圈内人物（用本名）或各类账号，标题贴合最近剧情或生活日常。返回 JSON：{"videos":[{"author":"作者","title":"视频标题≤24字","tag":"分类2字","likes":"如 3.2万 或 8721"}]}；不要与这些已有内容重复：${seen}`);
      if (!r) { flash("未配置 AI，暂无更多"); return; }
      const str = (v: unknown, n: number) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, n) : "");
      const fresh: ChannelItem[] = (Array.isArray(r.videos) ? r.videos : []).map((x: any) => ({ author: str(x?.author, 16) || "视频号", title: str(x?.title, 30), tag: str(x?.tag, 4) || "推荐", likes: str(x?.likes, 8) || "1024" })).filter((v) => v.title);
      if (!fresh.length) { flash("生成失败，请重试"); return; }
      const next = [...more, ...fresh].slice(-60);
      setMore(next); saveFeed("wechat.channels.more", next);
      flash(`新加载 ${fresh.length} 条`);
    } catch { flash("加载失败，请重试"); } finally { setMoreLoading(false); }
  };
  return (
    <div className="relative flex h-full flex-col bg-white">
      <WxSubHeader title="视频号" onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        {feed.map((v, i) => {
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
              <IconPlay size={34} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-[13px] text-ink-soft">
              <button onClick={() => commitGame(toggleLike(game!, `wx:ch:${i}`))} className={liked ? "text-[#e0533d]" : ""}><span className="inline-flex items-center gap-0.5"><IconHeart size={12} /> {liked ? "已赞" : v.likes}</span></button>
            </div>
          </div>
          );
        })}
        <LoadMoreButton loading={moreLoading} onClick={loadMore} color="#07c160" />
      </div>
      {toast && <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"><span className="rounded-full bg-black/75 px-3.5 py-1.5 text-[12px] text-white">{toast}</span></div>}
    </div>
  );
}

/* 我 · 收藏：长按消息「收藏」的内容，可删除 */
function WxFavsPage({ onBack }: { onBack: () => void }) {
  const favs = useFavs();
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="收藏" onBack={onBack} />
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {favs.length === 0 && <p className="pt-16 text-center text-[13px] text-[#9a9a9a]">在聊天中长按消息，选择「收藏」</p>}
        {favs.map((f) => (
          <div key={f.id} className="rounded-[8px] bg-white px-3.5 py-3">
            {f.img ? <img src={(f.img) || undefined} alt="" className="max-h-32 rounded-[4px] object-contain" /> : <p className="line-clamp-4 whitespace-pre-wrap text-[15px] leading-snug text-[#181818]">{f.text}</p>}
            <div className="mt-2 flex items-center text-[12px] text-[#9a9a9a]">
              <span className="flex-1 truncate">{f.from}</span>
              <button onClick={() => removeFav(f.id)} className="text-[#576b95]">删除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 我 · 服务 → 钱包：默认零钱 = 游戏资金；可绑定自定义货币属性 */
function WxWalletPage({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const bound = walletDef(game!);
  const bal = wallet.balance(game!);
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="钱包" onBack={onBack} />
      <div className="mx-3 mt-2 rounded-[10px] px-5 py-6 text-white" style={{ background: WX_GREEN }}>
        <p className="text-[13px] text-white/80">{bound ? `${bound.icon ? bound.icon + " " : ""}${bound.label}` : "零钱（元）"}</p>
        <p className="mt-1 text-[32px] font-semibold tabular-nums">{bound ? bal.toLocaleString("zh-CN") : bal.toFixed(2)}</p>
        {bound?.max ? <p className="mt-1 text-[11.5px] text-white/70">上限 {bound.max.toLocaleString("zh-CN")}</p> : null}
      </div>
      <div className="mx-3 mt-3 min-h-0 flex-1 overflow-y-auto pb-6"><WalletBinder /></div>
    </div>
  );
}

/* 我：个人资料卡 */
function MePage() {
  const { game, commitGame } = useGame();
  const brand = useCommsBrand();
  const favs = useFavs();
  const [sub, setSub] = useState<"settings" | "favs" | "wallet" | null>(() => (takeWalletRequest() ? "wallet" : null));
  if (sub === "settings") return <div className="absolute inset-0 z-30"><WxSettingsPage onBack={() => setSub(null)} /></div>;
  if (sub === "favs") return <div className="absolute inset-0 z-30"><WxFavsPage onBack={() => setSub(null)} /></div>;
  if (sub === "wallet") return <div className="absolute inset-0 z-30"><WxWalletPage onBack={() => setSub(null)} /></div>;
  const bal = wallet.balance(game!);
  const money = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);
  const Row = ({ icon, label, right, onClick }: { icon: ReactNode; label: string; right?: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition active:bg-black/[0.03]">
      <span className="flex h-7 w-7 items-center justify-center text-[#181818]/70">{icon}</span>
      <span className="flex flex-1 items-center gap-2 border-b border-black/[0.06] pb-3 text-[16px] text-[#181818]">
        <span className="flex-1">{label}</span>
        {right && <span className="text-[14px] text-[#9a9a9a]">{right}</span>}
        <span className="text-[#b2b2b2]"><IconChevron size={15} /></span>
      </span>
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="flex w-full items-center gap-4 bg-white px-6 pb-8 pt-6 text-left">
        <div className="overflow-hidden rounded-[8px]">
          <Avatar src={game!.player.avatar} name={game!.player.name} size={64} onPick={(src) => commitGame({ ...game!, player: { ...game!.player, avatar: src } })} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[21px] font-semibold text-[#181818]">{game!.player.name}</p>
          <p className="mt-1 text-[14px] text-[#7f7f7f]">{brand.accountLabel}：star_{game!.player.name}</p>
        </div>
      </div>
      <div><Row icon={<IconWallet size={20} style={{ color: WX_GREEN }} />} label="服务" right={wallet.fmt(bal, game!, (n) => `¥${money(n)}`)} onClick={() => setSub("wallet")} /></div>
      <div><Row icon={<IconStar size={20} className="text-[#fa9d3b]" />} label="收藏" right={favs.length ? String(favs.length) : undefined} onClick={() => setSub("favs")} /></div>
      <div><Row icon={<IconGear size={20} className="text-[#2c86fa]" />} label="设置" onClick={() => setSub("settings")} /></div>
    </div>
  );
}

/* 发起群聊：从联系人里勾选 ≥2 人，可选填群名 */
function CreateGroupPage({ onBack, onCreated }: { onBack: () => void; onCreated: (id: string) => void }) {
  const { game, commitGame } = useGame();
  const ph = ensurePhone(game!).phone!;
  const pool = ph.contacts
    .map((id) => game!.npcs.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => !!n);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const create = () => {
    const r = createGroup(game!, picked, name);
    commitGame(r.g);
    onCreated(r.id);
  };
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <div className="flex items-center gap-2 bg-[#ededed] px-3 py-2.5">
        <button onClick={onBack} className="text-[15px]">取消</button>
        <span className="flex-1 text-center text-[15px] font-semibold text-ink">发起群聊</span>
        <button onClick={create} disabled={picked.length < 2} className="rounded-[5px] px-3 py-1 text-[13px] font-medium text-white disabled:opacity-40" style={{ background: WX_GREEN }}>
          完成{picked.length ? `(${picked.length})` : ""}
        </button>
      </div>
      <div className="px-3 pb-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="群聊名称（可不填）" className="w-full rounded-md bg-white px-3 py-2 text-[14px] text-ink outline-none placeholder:text-ink-soft/60" />
      </div>
      {picked.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-2">
          {picked.map((id) => { const n = game!.npcs.find((x) => x.id === id)!; return (
            <button key={id} onClick={() => toggle(id)} className="shrink-0" aria-label={`移除${n.name}`}><WxAvatar src={n.avatar} name={n.name} size={36} /></button>
          ); })}
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-white">
        {pool.length < 2 && <p className="px-4 py-8 text-center text-[13px] text-ink-soft">至少需要 2 位联系人才能建群。先去「人脉」里交换联系方式吧。</p>}
        {pool.map((n) => {
          const on = picked.includes(n.id);
          return (
            <button key={n.id} onClick={() => toggle(n.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/5">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[12px] text-white ${on ? "border-transparent" : "border-black/25"}`} style={on ? { background: WX_GREEN } : undefined}>{on ? <IconCheck size={12} /> : ""}</span>
              <WxAvatar src={n.avatar} name={n.name} size={40} />
              <div className="min-w-0 flex-1 border-b border-black/[0.05] pb-2.5">
                <p className="text-[15px] text-ink">{n.name}</p>
                <p className="truncate text-[12px] text-ink-soft">{n.identity}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="bg-[#ededed] px-4 py-2 text-center text-[11px] text-ink-soft">群里每个人都会记得和你私聊过的事</p>
    </div>
  );
}

/* 群头像：最多 4 位成员拼成九宫格 */
function GroupAvatar({ members, size = 48 }: { members: string[]; size?: number }) {
  const { game } = useGame();
  const list = members.slice(0, 4).map((id) => game!.npcs.find((n) => n.id === id));
  const cell = list.length > 1 ? size / 2 - 1 : size;
  return (
    <div className="grid grid-cols-2 gap-[2px] overflow-hidden rounded-md bg-[#dcdcdc] p-[1px]" style={{ width: size, height: size }}>
      {list.map((n, i) => (
        n?.avatar
          ? <img key={i} src={(n.avatar) || undefined} alt={n.name} className="object-cover" style={{ width: cell, height: cell }} />
          : <span key={i} className="flex items-center justify-center bg-white text-[10px] font-bold text-[#07a050]" style={{ width: cell, height: cell }}>{n?.name?.[0] ?? "?"}</span>
      ))}
    </div>
  );
}

const str = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/**
 * 功能注释：P4.1 通讯 App 外壳——按世界题材给整棵子树挂 data-comms-skin（modern=绿信 / letter=传讯）。
 * display: contents 不参与布局，仅供 index.css 里的书信风样式按属性选择。
 */
export default function WeChatApp({ onBack }: { onBack: () => void }) {
  const brand = useCommsBrand();
  return (
    <div className="contents" data-comms-skin={brand.skin}>
      <WeChatAppInner onBack={onBack} />
    </div>
  );
}

function WeChatAppInner({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, patchGame } = useGame();
  const brand = useCommsBrand();
  const strangers = useStrangers();

  /* 右上角刷新：联动世界剧情，生成老朋友的新消息 + 新朋友圈 */
  useWorldSync("wechat", async () => {
    const g0 = ensurePhone(game!);
    const p0 = g0.phone!;
    const chatPids = p0.contacts.filter((id) => canInitiate(g0, id)); // 只有微信好友（friend）能发来消息；被设为不主动 / 禁止的除外
    const people = chatPids.map((id) => g0.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    const momentPool = people.filter((n) => !isBlocked(g0, n.id)).slice(0, 12); // 朋友圈只来自好友
    const list = (ns: typeof people) => ns.map((n) => `${n.id}=${n.name}`).join("、") || "（无）";
    // 好友主动找主角的频率与语气取决于好感 / 爱慕（幕后资料，只给 AI 把握分寸；家人不标爱慕）
    const friendList = people.map((n) => { const love = romanceBlock(g0, n.id, true); return `${n.id}=${n.name}（好感${affinityOf(g0, n.id)}${love ? `，${love}` : ""}）`; }).join("、") || "（无）";
    const strangersPool = g0.npcs.filter((n) => !p0.contacts.includes(n.id) && !(p0.pending ?? []).includes(n.id) && !isBlocked(g0, n.id)).slice(0, 12);
    const res = await syncJson<{ messages?: unknown; moments?: unknown; requests?: unknown }>(cfg, g0, "wechat", brand.appName,
      `${commPromptHint()}为${brand.appName}生成新内容。1) messages：0~4 条好友主动发来的私聊消息，发送者只能从【好友】中选，用 pid 标识，语气贴合人设与当前剧情，并按【好友】里标注的好感与爱慕把握分寸——好感决定熟络与热络；爱慕越高越可能主动来找主角、更上心（分享日常、找借口聊天、关心近况），但仍含蓄不说破；爱慕为 0 或标注不可攻略的人不暧昧、不说情话，家人只有亲情；2) moments：1~3 条朋友圈动态，作者只能从【圈内人物】中选，text ≤80 字，images 为配图张数 0~6，likers 为点赞者 pid 数组（从圈内人物选）；朋友圈是公开的，不得出现任何数值、私聊内容、内心想法或未公开的心意，心动最多是旁人看不懂的含蓄暗示；3) requests：0~1 条好友申请，只能来自【非好友】且剧情上确有理由想认识主角的人物，text 为验证消息（≤30 字），多数时候返回空数组。
【好友】${friendList}
【非好友】${list(strangersPool)}
【圈内人物】${list(momentPool)}
返回 {"messages":[{"pid":"","text":""}],"moments":[{"pid":"","text":"","images":0,"likers":[]}],"requests":[{"pid":"","text":""}]}`);
    if (!res) return "未配置 AI，无法联动剧情";
    const okChat = new Set(people.map((n) => n.id));
    const okAll = new Set(momentPool.map((n) => n.id));
    const msgs = (Array.isArray(res.messages) ? res.messages.slice(0, 6) : []).map((raw) => {
      const m = raw as { pid?: unknown; text?: unknown };
      return { pid: str(m?.pid, 60), text: str(m?.text, 200) };
    }).filter((m) => okChat.has(m.pid) && m.text);
    const posts: FeedMoment[] = [];
    for (const raw of Array.isArray(res.moments) ? res.moments.slice(0, 4) : []) {
      const m = raw as { pid?: unknown; text?: unknown; images?: unknown; likers?: unknown };
      const pid = str(m?.pid, 60), text = str(m?.text, 140);
      if (!okAll.has(pid) || !text) continue;
      const n = Number(m?.images);
      const likers = Array.isArray(m?.likers) ? m.likers.filter((x): x is string => typeof x === "string" && okAll.has(x) && x !== pid).slice(0, 6) : [];
      posts.push({ id: `ai_${msgId()}`, pid, text, imgCount: Number.isFinite(n) ? Math.max(0, Math.min(6, Math.round(n))) : 0, ts: Date.now() - posts.length * 60000, likers });
    }
    const okReq = new Set(strangersPool.map((n) => n.id));
    const reqs = (Array.isArray(res.requests) ? res.requests.slice(0, 2) : []).map((raw) => {
      const r = raw as { pid?: unknown; text?: unknown };
      return { pid: str(r?.pid, 60), text: str(r?.text, 60) };
    }).filter((r) => okReq.has(r.pid));
    const nMsg = msgs.length;
    let nReq = 0;
    // 落库基于最新存档：AI 生成要好几秒，期间调过的好感 / 爱慕、刚聊的消息不能被发起刷新时的旧快照覆盖
    if (nMsg || reqs.length || posts.length) patchGame((cur) => {
      let g = ensurePhone(cur);
      for (const [i, m] of msgs.entries()) {
        if (!threadFor(g.phone!, m.pid)) g = openThread(g, m.pid);
        g = pushMsg(g, threadFor(g.phone!, m.pid)!.id, { id: msgId(), role: "npc", text: m.text, ts: Date.now() + i, gt: gameMinutes(g), label: gameTimeLabel(g) });
      }
      for (const r of reqs) {
        const before = g;
        g = addIncomingReq(g, r.pid, r.text);
        if (g !== before) nReq++;
      }
      // 角色发的朋友圈：写进角色本人的记忆（线上线下都记得自己发过什么）
      for (const p of posts) g = logNpcNet(g, p.pid, "朋友圈", `发朋友圈：${p.text}`);
      return g;
    });
    if (posts.length) addFeedMoments(posts);
    if (!nMsg && !posts.length && !nReq) return "暂时没有新动态";
    return [nMsg ? `收到 ${nMsg} 条新消息` : "", nReq ? `${nReq} 条好友申请` : "", posts.length ? `朋友圈 ${posts.length} 条新动态` : ""].filter(Boolean).join("，");
  });
  const ph = ensurePhone(game!).phone!;
  const [tab, setTab] = useState<WxTab>(() => (peekWalletRequest() ? "me" : "chats"));
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<Thread | null>(null);
  const [plus, setPlus] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [greet, setGreet] = useState<string | null>(null);

  const thread = open ? ph.threads.find((t) => t.id === open) : null;
  const threads = useMemo(
    () => [...ph.threads]
      .filter((t) => { const h = customOf(t).hiddenAt; return !h || t.lastTs > h || t.unread > 0; })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.lastTs - a.lastTs),
    [ph.threads],
  );
  const { notify } = useWxSettings();
  const unread = notify ? ph.threads.reduce((a, t) => a + (customOf(t).muted ? 0 : t.unread), 0) : 0;
  const setC = (t: Thread, p: Partial<XCustom>) => commitGame(setThreadCustom(game!, t.id, p as Partial<NonNullable<Thread["custom"]>>));
  const [prefPid, setPrefPid] = useState<string | null>(null);
  const [swiped, setSwiped] = useState<string | null>(null);
  const toggleUnread = (t: Thread) => commitGame(t.unread > 0 || customOf(t).markUnread
    ? setThreadCustom(markRead(game!, t.id), t.id, { markUnread: false } as Partial<NonNullable<Thread["custom"]>>)
    : setThreadCustom(game!, t.id, { markUnread: true } as Partial<NonNullable<Thread["custom"]>>));
  const delThread = (t: Thread) => commitGame({ ...game!, phone: { ...ph, threads: ph.threads.filter((x) => x.id !== t.id) } });
  const openPid = (pid: string) => { const t = threadFor(ph, pid); if (!t) commitGame(openThread(game!, pid)); setOpen(t?.id ?? `th_${pid}`); };

  if (thread) return <ChatView thread={thread} autoSend={greet ?? undefined} onBack={() => { setOpen(null); setGreet(null); }} />;
  if (creating) return <CreateGroupPage onBack={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id); }} />;

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
                const npc = game!.npcs.find((n) => n.id === t.personId) ?? (t.personId ? strangers[t.personId] : undefined);
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

  const title = tab === "chats" ? brand.appName : tab === "contacts" ? (brand.skin === "letter" ? commTerm("contacts") : "通讯录") : tab === "discover" ? (brand.skin === "letter" ? commTerm("discover") : "发现") : "我";

  return (
    <div className="relative flex h-full flex-col bg-[#ededed]">
      <WxHeader
        title={title}
        count={tab === "chats" && unread ? unread : undefined}
        onBack={onBack}
        onSearch={() => setSearching(true)}
        onPlus={() => setPlus((v) => !v)}
      />
      {plus && (
        <>
          <div className="absolute inset-0 z-40" onClick={() => setPlus(false)} />
          <div className="absolute right-2 top-11 z-50 w-40 rounded-[6px] bg-[#4c4c4c] py-1 shadow-xl">
            <span className="absolute -top-1.5 right-3.5 h-3 w-3 rotate-45 bg-[#4c4c4c]" />
            {[
              { label: "发起群聊", on: () => setCreating(true) },
              { label: "添加朋友", on: () => setSearching(true) },
            ].map((it, i) => (
              <button key={it.label} onClick={() => { setPlus(false); it.on(); }} className={`relative block w-full px-5 py-3 text-left text-[15px] text-white active:bg-white/10 ${i ? "border-t border-white/10" : ""}`}>{it.label}</button>
            ))}
          </div>
        </>
      )}
      {menu && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setMenu(null)}>
          <div className="bg-[#f7f7f7] pb-2" onClick={(e) => e.stopPropagation()}>
            <p className="truncate bg-white px-6 py-3 text-center text-[13px] text-[#9a9a9a]">{menu.title}</p>
            {[
              { label: menu.unread > 0 || customOf(menu).markUnread ? "标为已读" : "标为未读", on: () => toggleUnread(menu) },
              { label: menu.pinned ? "取消置顶" : "置顶该聊天", on: () => commitGame(togglePinned(game!, menu.id)) },
              { label: customOf(menu).muted ? "开启新消息提醒" : "消息免打扰", on: () => setC(menu, { muted: !customOf(menu).muted }) },
              ...(menu.kind === "private" && menu.personId ? [{ label: `消息权限：${msgPrefLabel(msgPrefOf(game, menu.personId))}`, on: () => setPrefPid(menu.personId!) }] : []),
              { label: "不显示该聊天", on: () => commitGame(setThreadCustom(markRead(game!, menu.id), menu.id, { hiddenAt: menu.lastTs, markUnread: false } as Partial<NonNullable<Thread["custom"]>>)) },
              { label: "删除该聊天", danger: true, on: () => delThread(menu) },
            ].map((it) => (
              <button key={it.label} onClick={() => { it.on(); setMenu(null); }} className={`block w-full border-t border-black/[0.06] bg-white py-3.5 text-[16px] ${it.danger ? "text-[#fa5151]" : "text-[#181818]"}`}>{it.label}</button>
            ))}
            <button onClick={() => setMenu(null)} className="mt-2 block w-full bg-white py-3.5 text-[16px] text-[#181818]">取消</button>
          </div>
        </div>
      )}
      {prefPid && (
        <MsgPrefSheet
          name={game!.npcs.find((n) => n.id === prefPid)?.name ?? "TA"}
          value={msgPrefOf(game, prefPid)}
          onPick={(v) => { commitGame(setMsgPref(ensurePhone(game!), prefPid, v)); setPrefPid(null); }}
          onClose={() => setPrefPid(null)}
        />
      )}
      <div className="flex-1 overflow-y-auto">
        {tab === "chats" && (
          threads.length === 0 ? (
            <Empty text="还没有聊天。去「人脉」里跟 TA 交换联系方式，就能私聊了。" />
          ) : (
            <div className="bg-white">
              {threads.map((t) => (
                <ThreadRow key={t.id} t={t} notify={notify} open={swiped === t.id} onSwipe={(o) => setSwiped(o ? t.id : null)}
                  onOpen={() => setOpen(t.id)} onMenu={() => { setSwiped(null); setMenu(t); }} onToggleUnread={() => toggleUnread(t)} onDelete={() => delThread(t)} />
              ))}
            </div>
          )
        )}
        {tab === "contacts" && <ContactList onOpen={setOpen} onOpenPid={openPid} />}
        {tab === "discover" && <DiscoverPage onSearch={() => setSearching(true)} onOpenChat={(id, greet) => { setTab("chats"); setGreet(greet ?? null); setOpen(id); }} />}
        {tab === "me" && <MePage />}
      </div>
      <WxTabBar active={tab} onPick={setTab} unread={unread} newFriends={incomingReqs(game!).filter((r) => r.state === "pending").length} />
    </div>
  );
}

/* 会话行：左滑露出「标为未读 / 删除」，长按 / 右键弹出操作；免打扰显示灰点 + 静音图标 */
const SWIPE_W = 148;
function ThreadRow({ t, notify, open, onSwipe, onOpen, onMenu, onToggleUnread, onDelete }: { t: Thread; notify: boolean; open: boolean; onSwipe: (open: boolean) => void; onOpen: () => void; onMenu: () => void; onToggleUnread: () => void; onDelete: () => void }) {
  const { game } = useGame();
  const strangers = useStrangers();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const drag = useRef<{ x: number; y: number; base: number; axis: "x" | "y" | null } | null>(null);
  const [dx, setDx] = useState<number | null>(null);
  const c = customOf(t);
  const npc = game!.npcs.find((n) => n.id === t.personId) ?? (t.personId ? strangers[t.personId] : undefined);
  const last = [...t.msgs].reverse().find((m) => m.role !== "sys" || (m as { kind?: string }).kind === "recall");
  const fromName = last && last.role !== "me" && t.kind === "group" && last.from ? `${game!.npcs.find((n) => n.id === last.from)?.name ?? ""}：` : "";
  const preview = last ? fromName + msgPreview(last) : "";
  const showNum = notify && !c.muted && t.unread > 0;
  const showDot = notify && ((c.muted && t.unread > 0) || (!t.unread && c.markUnread));
  const isUnread = t.unread > 0 || !!c.markUnread;
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const offset = dx ?? (open ? -SWIPE_W : 0);
  const onDown = (e: React.PointerEvent) => {
    fired.current = false;
    drag.current = { x: e.clientX, y: e.clientY, base: open ? -SWIPE_W : 0, axis: null };
    clear();
    timer.current = setTimeout(() => { fired.current = true; drag.current = null; setDx(null); onMenu(); }, 480);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.axis && (Math.abs(mx) > 8 || Math.abs(my) > 8)) { d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y"; clear(); if (d.axis === "x") (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
    if (d.axis === "x") { fired.current = true; setDx(Math.max(-SWIPE_W - 24, Math.min(0, d.base + mx))); }
  };
  const onUp = () => {
    clear();
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "x" && dx != null) onSwipe(dx < -SWIPE_W / 2.5);
    setDx(null);
  };
  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: SWIPE_W }}>
        <button onClick={() => { onToggleUnread(); onSwipe(false); }} className="flex-1 bg-[#2c86fa] text-[14px] leading-tight text-white">{isUnread ? "标为已读" : "标为未读"}</button>
        <button onClick={() => { onDelete(); onSwipe(false); }} className="flex-1 bg-[#fa5151] text-[14px] text-white">删除</button>
      </div>
      <button
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { clear(); if (drag.current?.axis !== "x") drag.current = null; }} onPointerCancel={onUp}
        onContextMenu={(e) => { e.preventDefault(); clear(); fired.current = true; onMenu(); }}
        onClick={() => { if (fired.current) return; if (open) onSwipe(false); else onOpen(); }}
        style={{ transform: `translateX(${offset}px)`, transition: dx == null ? "transform .2s ease" : "none", touchAction: "pan-y" }}
        className={`relative flex w-full select-none items-stretch gap-3 px-4 py-3 text-left active:bg-[#dedede] ${t.pinned ? "bg-[#f7f7f7]" : "bg-white"}`}
      >
        <div className="relative shrink-0">
          {t.kind === "group" ? <GroupAvatar members={t.members ?? []} /> : <WxAvatar src={npc?.avatar} name={t.title} size={48} />}
          {showNum && <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#fa5151] px-1 text-[11px] text-white">{t.unread > 99 ? "···" : t.unread}</span>}
          {showDot && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#fa5151]" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[16px] text-[#181818]">{t.title}</span>
            <span className="ml-auto shrink-0 text-[11.5px] text-[#b2b2b2]">{last ? wxTime(game!, last.gt) : ""}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] text-[#9a9a9a]">{c.muted && t.unread > 1 ? `[${t.unread}条] ` : ""}{preview}</p>
            {c.muted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b2b2b2" strokeWidth="1.8" strokeLinecap="round" aria-label="免打扰"><path d="M18 16V11a6 6 0 0 0-9.4-4.9M6 9.5V16l-2 2h14M10 20a2 2 0 0 0 4 0M3 3l18 18" /></svg>}
          </div>
        </div>
      </button>
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

/* 好友消息权限：单人选择面板（会话长按菜单 / 设置页共用） */
function MsgPrefSheet({ name, value, onPick, onClose }: { name: string; value: MsgPref; onPick: (v: MsgPref) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="bg-[#f7f7f7] pb-2" onClick={(e) => e.stopPropagation()}>
        <p className="bg-white px-6 pb-2 pt-3.5 text-center text-[14px] font-semibold text-[#181818]">{name} 的消息权限</p>
        <p className="bg-white px-6 pb-3 text-center text-[12px] text-[#9a9a9a]">决定 TA 能否主动给你发消息</p>
        {MSG_PREFS.map((o) => (
          <button key={o.id} onClick={() => onPick(o.id)} className="flex w-full items-center gap-3 border-t border-black/[0.06] bg-white px-5 py-3 text-left">
            <span className="min-w-0 flex-1">
              <span className={`block text-[15.5px] ${o.id === "block" ? "text-[#fa5151]" : "text-[#181818]"}`}>{o.label}</span>
              <span className="mt-0.5 block text-[12px] text-[#9a9a9a]">{o.desc}</span>
            </span>
            {value === o.id && <IconCheck width={18} height={18} className="shrink-0 text-[#07c160]" />}
          </button>
        ))}
        <button onClick={onClose} className="mt-2 block w-full bg-white py-3.5 text-[16px] text-[#181818]">取消</button>
      </div>
    </div>
  );
}

/* 设置 · 好友消息权限：列出全部好友，逐人设定 */
function WxMsgPrefPage({ onBack }: { onBack: () => void }) {
  const { game, commitGame } = useGame();
  const [pick, setPick] = useState<string | null>(null);
  const g = ensurePhone(game!);
  const friends = g.phone!.contacts.map((id) => g.npcs.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
  return (
    <div className="relative flex h-full flex-col bg-[#ededed]">
      <WxSubHeader title="好友消息权限" onBack={onBack} />
      <div className="flex-1 overflow-y-auto pb-6">
        <p className="px-4 pb-2 pt-1 text-[12px] leading-relaxed text-ink-soft">默认「随剧情」：只有剧情需要时 TA 才会发消息或来电。也可以设为主动联系、不主动发，或禁止发消息。</p>
        {friends.length ? (
          <div className="bg-white">
            {friends.map((n) => {
              const v = msgPrefOf(g, n.id);
              return (
                <button key={n.id} onClick={() => setPick(n.id)} className="flex w-full items-center gap-3 border-b border-black/[0.05] px-4 py-2.5 text-left last:border-b-0">
                  <Avatar name={n.name} src={n.avatar} size={36} editable={false} />
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[#181818]">{n.name}</span>
                  <span className={`shrink-0 text-[13px] ${v === "block" ? "text-[#fa5151]" : v === "story" ? "text-[#9a9a9a]" : "text-[#07a050]"}`}>{msgPrefLabel(v)} ›</span>
                </button>
              );
            })}
          </div>
        ) : <Empty text="还没有好友。" />}
      </div>
      {pick && (
        <MsgPrefSheet
          name={g.npcs.find((n) => n.id === pick)?.name ?? "TA"}
          value={msgPrefOf(g, pick)}
          onPick={(v) => { commitGame(setMsgPref(g, pick, v)); setPick(null); }}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

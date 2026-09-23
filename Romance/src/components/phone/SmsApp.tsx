/* 信息：仿 iOS「信息」（大标题、搜索栏、圆头像列表、蓝色强调、iMessage 气泡由 ChatView 提供） */
import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { ensurePhone, phoneNumber, type ChatMsg } from "../../game/phone";
import { Empty } from "./shared";
import { ChatView } from "./chat";
import { IconEdit, IconSearch, IconClose } from "./icons";

const IOS_BLUE = "#0b8aff";

function timeLabel(m?: ChatMsg) {
  if (!m?.label) return "";
  return m.label.split(" ").pop() ?? "";
}

export default function SmsApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const ph = ensurePhone(game!).phone!;
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const thread = open ? ph.threads.find((t) => t.id === open) : null;
  if (thread) return <ChatView thread={thread} onBack={() => setOpen(null)} sms />;
  const q = query.trim();
  const threads = [...ph.threads]
    .filter((t) => !q || t.title.includes(q))
    .sort((a, b) => b.lastTs - a.lastTs);

  return (
    <div className="relative flex h-full flex-col bg-white">
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
        </div>
      )}
      {/* iOS 顶栏：编辑 / 标题 / 新建 */}
      <div className="flex items-center justify-between px-4 pb-1 pt-1 text-[15px]" style={{ color: IOS_BLUE }}>
        <button onClick={onBack}>‹ 主屏</button>
        <button onClick={() => { setToast("新建信息：先在「人脉」交换联系方式"); setTimeout(() => setToast(""), 1800); }} aria-label="新建"><IconEdit size={20} /></button>
      </div>
      <div className="px-4 pb-2">
        <h1 className="text-[30px] font-bold tracking-tight text-ink">信息</h1>
        <div className="mt-2 flex items-center gap-2 rounded-[10px] bg-black/[0.06] px-2.5 py-1.5 text-[14px]">
          <span className="text-ink-soft"><IconSearch size={16} /></span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索" className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink-soft/70" />
          {query && <button onClick={() => setQuery("")} className="text-ink-soft/60" aria-label="清除"><IconClose size={15} /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <Empty text={q ? "没有匹配的会话。" : "没有信息。先在「人脉」交换联系方式，才能收发短信。"} />
        ) : (
          threads.map((t) => {
            const npc = game!.npcs.find((n) => n.id === t.personId);
            const last = [...t.msgs].reverse().find((m) => m.role !== "sys");
            return (
              <button key={t.id} onClick={() => setOpen(t.id)} className="flex w-full items-center gap-3 pl-4 text-left active:bg-black/5">
                <div className="relative shrink-0">
                  <Avatar src={npc?.avatar} name={t.title} size={50} editable={false} />
                  {t.unread > 0 && <span className="absolute -left-0.5 top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-3 rounded-full" style={{ background: IOS_BLUE }} />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center border-b border-black/[0.07] py-2.5 pr-4">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[16px] font-semibold text-ink">{t.title}</span>
                    <span className="ml-auto shrink-0 text-[12.5px] text-ink-soft/70">{timeLabel(last)} ›</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-soft">{last?.text ?? phoneNumber(t.personId!)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
